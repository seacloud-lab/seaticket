import re
import logging
import ipaddress
import dns.resolver
from urllib.parse import urlsplit

from django.conf import settings


logger = logging.getLogger(__name__)

HOST_LABEL_RE = re.compile(r'^(?!-)[a-z0-9-]{1,63}(?<!-)$')
CUSTOM_DOMAIN_TXT_RECORD_PREFIX = '_seaqa-portal-challenge'
CUSTOM_DOMAIN_VERIFICATION_VALUE_PREFIX = 'seaqa-portal-verification='
DEFAULT_TLS_ASK_ALLOWED_IPS = ('127.0.0.1', '::1')


def normalize_portal_custom_domain(domain):
    domain = (domain or '').strip().lower()
    if not domain:
        return ''

    if '://' in domain:
        raise ValueError('Custom domain must not include scheme.')

    if any(char in domain for char in '/?#'):
        raise ValueError('Custom domain must not include path, query string or fragment.')

    if domain.endswith('.'):
        domain = domain[:-1]

    try:
        domain = domain.encode('idna').decode('ascii')
    except Exception as error:
        raise ValueError('Custom domain is invalid.') from error

    if ':' in domain:
        raise ValueError('Custom domain must not include port.')

    if len(domain) > 253:
        raise ValueError('Custom domain is too long.')

    labels = domain.split('.')
    if len(labels) < 2:
        raise ValueError('Custom domain must be a fully-qualified domain name.')

    if labels[-1].isdigit():
        raise ValueError('Custom domain is invalid.')

    for label in labels:
        if not HOST_LABEL_RE.match(label):
            raise ValueError('Custom domain is invalid.')
    reserved_domains = set()
    service_url = getattr(settings, 'SEAQA_WEB_SERVICE_URL', '')
    service_host = urlsplit(service_url).hostname
    if service_host:
        reserved_domains.add(service_host.lower())

    if domain in reserved_domains:
        raise ValueError('This domain is reserved.')

    return domain



def get_request_host_without_port(request):
    host = ''
    try:
        host = request.get_host()
    except Exception:
        host = request.META.get('HTTP_HOST') or request.META.get('SERVER_NAME') or ''

    parsed = urlsplit('//%s' % host)
    return (parsed.hostname or '').lower()


def query_dns_txt_values(record_name):
    try:
        answers = dns.resolver.resolve(record_name, 'TXT', lifetime=5)
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN) as e:
        logger.error(e)
        return []
    except Exception as e:
        logger.exception(e)
        raise

    values = []
    for answer in answers:
        strings = getattr(answer, 'strings', None)
        if strings is not None:
            values.append(''.join([
                item.decode('utf-8') if isinstance(item, bytes) else str(item)
                for item in strings
            ]))
        else:
            values.append(answer.to_text())
    return [str(value or '').strip().strip('"') for value in values]


def verify_portal_custom_domain_dns(domain, verification_token):
    record_name = '%s.%s' % (CUSTOM_DOMAIN_TXT_RECORD_PREFIX, normalize_portal_custom_domain(domain))
    expected_value = '%s%s' % (CUSTOM_DOMAIN_VERIFICATION_VALUE_PREFIX, verification_token)
    return expected_value in query_dns_txt_values(record_name)


def is_portal_custom_domain_tls_ask_allowed_source(request):
    remote_addr = (request.META.get('REMOTE_ADDR') or '').strip()
    if not remote_addr:
        return False

    try:
        remote_ip = ipaddress.ip_address(remote_addr)
    except ValueError:
        return False

    allowed_entries = list(DEFAULT_TLS_ASK_ALLOWED_IPS)
    allowed_entries.extend(getattr(settings, 'PORTAL_CUSTOM_DOMAIN_TLS_ASK_ALLOWED_IPS', []))

    for entry in allowed_entries:
        entry = (entry or '').strip()
        if not entry:
            continue
        try:
            if remote_ip in ipaddress.ip_network(entry, strict=False):
                return True
        except ValueError:
            logger.warning('Invalid portal custom-domain TLS ask allowed IP entry: %s', entry)

    return False


def is_request_using_portal_custom_domain(request, project_uuid=None):
    binding = getattr(request, 'portal_custom_domain', None)
    if project_uuid is None:
        return bool(binding)
    return bool(binding and str(getattr(binding, 'project_uuid', '')) == str(project_uuid))


def get_custom_domain_origin(domain, request=None):
    if not domain:
        return ''
    scheme = request.scheme if request is not None else 'https'
    return '%s://%s' % (scheme, domain)

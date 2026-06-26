import re
import logging
import dns.resolver
from urllib.parse import urlsplit

from django.conf import settings


logger = logging.getLogger(__name__)

HOST_LABEL_RE = re.compile(r'^(?!-)[a-z0-9-]{1,63}(?<!-)$')
CUSTOM_DOMAIN_TXT_RECORD_PREFIX = '_seaqa-portal-challenge'
CUSTOM_DOMAIN_VERIFICATION_VALUE_PREFIX = 'seaqa-portal-verification='
PORTAL_SUBDOMAIN_PREFIX_MIN_LENGTH = 3
PORTAL_SUBDOMAIN_PREFIX_MAX_LENGTH = 63
PORTAL_RESERVED_SUBDOMAIN_PREFIXES = ('admin', 'api', 'assets', 'auth', 'cdn', 'custom-domains', 'internal', 'mail', 'media',
    'static', 'status', 'support', 'www')


def normalize_portal_custom_domain(domain, check_reserved=True):
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

    portal_root_domain = getattr(settings, 'PORTAL_SERVICE_ROOT_DOMAIN', '')
    if portal_root_domain:
        try:
            portal_root_domain = portal_root_domain.encode('idna').decode('ascii')
        except Exception:
            portal_root_domain = ''

    if check_reserved:
        if domain in reserved_domains:
            raise ValueError('This domain is reserved.')
        if portal_root_domain and (domain == portal_root_domain or domain.endswith('.%s' % portal_root_domain)):
            raise ValueError('This domain is reserved.')

    return domain


def normalize_portal_subdomain_prefix(prefix):
    prefix = (prefix or '').strip().lower()
    if not prefix:
        return ''

    try:
        prefix = prefix.encode('idna').decode('ascii')
    except Exception as error:
        raise ValueError('Portal subdomain is invalid.') from error

    if len(prefix) < PORTAL_SUBDOMAIN_PREFIX_MIN_LENGTH:
        raise ValueError('Portal subdomain is too short.')

    if len(prefix) > PORTAL_SUBDOMAIN_PREFIX_MAX_LENGTH:
        raise ValueError('Portal subdomain is too long.')

    if not HOST_LABEL_RE.match(prefix):
        raise ValueError('Portal subdomain is invalid.')

    return prefix


def get_portal_reserved_subdomain_prefixes():
    reserved_prefixes = set()
    for prefix in PORTAL_RESERVED_SUBDOMAIN_PREFIXES:
        reserved_prefixes.add(prefix)

    dns_target = getattr(settings, 'PORTAL_CUSTOM_DOMAIN_DNS_TARGET', '')
    try:
        target_prefix = get_portal_subdomain_prefix(dns_target)
    except ValueError:
        target_prefix = ''
    if target_prefix:
        reserved_prefixes.add(target_prefix)

    return reserved_prefixes


def is_portal_subdomain_prefix_reserved(prefix):
    normalized_prefix = normalize_portal_subdomain_prefix(prefix)
    return normalized_prefix in get_portal_reserved_subdomain_prefixes()


def validate_portal_subdomain_prefix_available(prefix):
    normalized_prefix = normalize_portal_subdomain_prefix(prefix)
    if normalized_prefix in get_portal_reserved_subdomain_prefixes():
        raise ValueError('Portal subdomain is reserved.')
    return normalized_prefix

def build_portal_service_domain(prefix):
    root_domain = getattr(settings, 'PORTAL_SERVICE_ROOT_DOMAIN', '')
    if not prefix or not root_domain:
        return ''
    return '%s.%s' % (prefix, root_domain)


def get_portal_subdomain_prefix(host):
    host = normalize_portal_custom_domain(host, check_reserved=False)
    root_domain = getattr(settings, 'PORTAL_SERVICE_ROOT_DOMAIN', '')
    if not host or not root_domain:
        return ''
    suffix = '.%s' % root_domain
    if not host.endswith(suffix):
        return ''
    prefix = host[:-len(suffix)]
    if '.' in prefix:
        return ''
    return normalize_portal_subdomain_prefix(prefix)

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
    record_name = '%s.%s' % (CUSTOM_DOMAIN_TXT_RECORD_PREFIX, domain)
    expected_value = '%s%s' % (CUSTOM_DOMAIN_VERIFICATION_VALUE_PREFIX, verification_token)
    return expected_value in query_dns_txt_values(record_name)


def is_request_using_portal_domain(request, project_uuid=None):
    binding = getattr(request, 'portal_domain', None)
    if project_uuid is None:
        return bool(binding)
    return bool(binding and str(getattr(binding, 'project_uuid', '')) == str(project_uuid))

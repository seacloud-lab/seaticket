import re
import logging
from urllib.parse import urlsplit

from django.conf import settings


logger = logging.getLogger(__name__)

HOST_LABEL_RE = re.compile(r'^(?!-)[a-z0-9-]{1,63}(?<!-)$')
CUSTOM_DOMAIN_TXT_RECORD_PREFIX = '_seaqa-portal-challenge'
CUSTOM_DOMAIN_VERIFICATION_VALUE_PREFIX = 'seaqa-portal-verification='


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
    import dns.resolver

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


def is_request_using_portal_custom_domain(request, project_uuid=None):
    binding = getattr(request, 'portal_custom_domain', None)
    if binding:
        if project_uuid is None:
            return True
        if str(getattr(binding, 'project_uuid', '')) == str(project_uuid):
            return True

    if project_uuid is None:
        return False

    request_host = get_request_host_without_port(request)
    if not request_host:
        return False

    from seahub.portal.models import PortalCustomDomain

    binding = PortalCustomDomain.objects.get_by_project_uuid(project_uuid)
    return bool(binding and binding.verified and binding.domain == request_host)


def get_custom_domain_origin(domain, request=None):
    if not domain:
        return ''
    service_scheme = urlsplit(getattr(settings, 'SEAQA_WEB_SERVICE_URL', '') or '').scheme or 'https'
    scheme = request.scheme if request is not None else service_scheme
    return '%s://%s' % (scheme, domain)

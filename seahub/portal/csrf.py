from urllib.parse import urlsplit

from django.middleware.csrf import CsrfViewMiddleware

from seahub.portal.custom_domain import get_request_host_without_port
from seahub.portal.domain_resolver import resolve_portal_domain


def _get_origin_host(origin):
    parsed = urlsplit(origin or '')
    if parsed.scheme not in ('http', 'https'):
        return ''
    return (parsed.hostname or '').lower()


def is_portal_origin_verified(request):
    origin_host = _get_origin_host(request.META.get('HTTP_ORIGIN'))
    if not origin_host:
        return False

    request_host = get_request_host_without_port(request)
    if not request_host:
        return False

    origin_domain = resolve_portal_domain(origin_host)
    if not origin_domain:
        return False

    request_domain = getattr(request, 'portal_domain', None) or resolve_portal_domain(request_host)
    if not request_domain:
        return False

    return str(origin_domain.project_uuid) == str(request_domain.project_uuid)


class PortalAwareCsrfViewMiddleware(CsrfViewMiddleware):

    def _origin_verified(self, request):
        if super()._origin_verified(request):
            return True
        return is_portal_origin_verified(request)

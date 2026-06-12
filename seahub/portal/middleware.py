import re

from django.http import Http404
from django.utils.deprecation import MiddlewareMixin

from seahub.portal.custom_domain import (
    build_portal_external_accept_path,
    build_site_root_path,
    build_standard_portal_path,
    get_request_host_without_port,
)


def _normalize_path(path):
    normalized_path = '/%s' % str(path or '').lstrip('/')
    return normalized_path.rstrip('/') or '/'


def _get_project_uuid_from_standard_path(path):
    parts = _normalize_path(path).strip('/').split('/')
    if len(parts) >= 2 and parts[0] in ('portal', 'portal-edit'):
        return parts[1]
    if len(parts) >= 4 and parts[:3] == ['api', 'v1', 'portal']:
        return parts[3]
    if len(parts) >= 3 and parts[:2] == ['portal-external', 'logout']:
        return parts[2]
    if len(parts) >= 4 and parts[:2] == ['portal-external', 'accept']:
        return parts[3]
    if len(parts) >= 3 and parts[0] in ('upload-file', 'file') and parts[1] == 'portal':
        return parts[2]
    return ''


def _build_internal_path(project_uuid, path):
    normalized_path = _normalize_path(path)
    page_path_map = {
        '/': (),
        '/submit-issue': ('submit-issue',),
        '/my-issues': ('my-issues',),
        '/knowledge-base': ('knowledge-base',),
        '/chat': ('chat',),
        '/login': ('login',),
        '/anonymous-validate': ('anonymous-validate',),
    }
    if normalized_path in page_path_map:
        return build_standard_portal_path(project_uuid, *page_path_map[normalized_path])
    if normalized_path == '/logout':
        return build_site_root_path('portal-external/logout/%s/' % project_uuid)

    match = re.match(r'^/(my-issues|knowledge-base)/(\d+)$', normalized_path)
    if match:
        return build_standard_portal_path(project_uuid, match.group(1), match.group(2))

    match = re.match(r'^/chat/[-0-9a-f]{36}$', normalized_path)
    if match:
        return build_standard_portal_path(project_uuid, *normalized_path.strip('/').split('/'))

    match = re.match(r'^/external/accept/(?P<token>[a-f0-9]{32})$', normalized_path)
    if match:
        return build_portal_external_accept_path(match.group('token'), project_uuid)

    return ''


class PortalCustomDomainMiddleware(MiddlewareMixin):

    def process_request(self, request):
        path = request.path_info or '/'
        request_host = get_request_host_without_port(request)
        if not request_host:
            return None

        from seahub.portal.models import PortalCustomDomain

        binding = PortalCustomDomain.objects.get_by_domain(request_host)
        if not binding or not binding.verified:
            return None

        requested_project_uuid = _get_project_uuid_from_standard_path(path)
        if requested_project_uuid and str(requested_project_uuid) != str(binding.project_uuid):
            raise Http404

        request.portal_custom_domain = binding

        internal_path = _build_internal_path(binding.project_uuid, path)
        if not internal_path:
            return None

        request.META['ORIGINAL_PATH_INFO'] = path
        request.META['PATH_INFO'] = internal_path
        request.path_info = internal_path
        request.path = internal_path
        return None

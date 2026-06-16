import re

from django.conf import settings
from django.http import Http404
from django.utils.deprecation import MiddlewareMixin

from seahub.portal.custom_domain import get_request_host_without_port
from seahub.portal.models import PortalCustomDomain



# Static and auth resources needed by Portal custom-domain pages.
PASS_THROUGH_PREFIXES = ('/accounts/', '/captcha/', '/custom-css/', '/i18n/', '/media/', '/static/')

# Existing Portal APIs and file routes handled by normal URLConf.
PORTAL_PASS_THROUGH_PREFIXES = ('/api/v1/portal/', '/file/portal/', '/upload-file/portal/', '/portal/', '/portal-external/')


def _get_project_uuid_from_standard_path(normalized_path):
    parts = normalized_path.strip('/').split('/')
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


def _build_internal_path(project_uuid, normalized_path):
    site_root = getattr(settings, 'SITE_ROOT', '/') or '/'
    site_root = site_root if site_root.endswith('/') else '%s/' % site_root
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
        suffix = '/'.join(page_path_map[normalized_path])
        suffix = '%s/' % suffix if suffix else ''
        return '%sportal/%s/%s' % (site_root, project_uuid, suffix)
    if normalized_path == '/logout':
        return '%sportal-external/logout/%s/' % (site_root, project_uuid)

    match = re.match(r'^/(my-issues|knowledge-base)/(\d+)$', normalized_path)
    if match:
        return '%sportal/%s/%s/%s/' % (site_root, project_uuid, match.group(1), match.group(2))

    match = re.match(r'^/chat/[-0-9a-f]{36}$', normalized_path)
    if match:
        return '%sportal/%s%s/' % (site_root, project_uuid, normalized_path)

    match = re.match(r'^/external/accept/(?P<token>[a-f0-9]{32})$', normalized_path)
    if match:
        return '%sportal-external/accept/%s/%s/' % (site_root, match.group('token'), project_uuid)

    return ''


class PortalCustomDomainMiddleware(MiddlewareMixin):

    def process_request(self, request):
        path = request.path_info or '/'
        normalized_path = ('/%s' % path.lstrip('/')).rstrip('/') or '/'
        request_host = get_request_host_without_port(request)
        if not request_host:
            return None
        seaticket_server_hostname = getattr(settings, 'SEATICKET_SERVER_HOSTNAME', '').lower()
        if seaticket_server_hostname and request_host == seaticket_server_hostname:
            return None

        binding = PortalCustomDomain.objects.get_by_domain(request_host)
        if not binding or not binding.verified:
            return None

        request.portal_custom_domain = binding

        if any(normalized_path == prefix.rstrip('/') or normalized_path.startswith(prefix) for prefix in PASS_THROUGH_PREFIXES):
            return None

        requested_project_uuid = _get_project_uuid_from_standard_path(normalized_path)
        if requested_project_uuid and str(requested_project_uuid) != str(binding.project_uuid):
            raise Http404
        if requested_project_uuid and any(
            normalized_path == prefix.rstrip('/') or normalized_path.startswith(prefix)
            for prefix in PORTAL_PASS_THROUGH_PREFIXES
        ):
            return None

        internal_path = _build_internal_path(binding.project_uuid, normalized_path)
        if not internal_path:
            raise Http404

        request.META['ORIGINAL_PATH_INFO'] = path
        request.META['PATH_INFO'] = internal_path
        request.path_info = internal_path
        request.path = internal_path
        return None

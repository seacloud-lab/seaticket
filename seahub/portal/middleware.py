from urllib.parse import urlsplit

from django.conf import settings
from django.http import Http404, HttpResponseRedirect
from django.urls import Resolver404, resolve
from django.utils.deprecation import MiddlewareMixin

from seahub.portal.models import PortalCustomDomain
from seahub.portal.utils import PORTAL_DOMAIN_TYPE_SERVICE_ALIAS, resolve_portal_domain


# Static and auth resources needed by Portal domain pages.
PASS_THROUGH_PREFIXES = ('/accounts/', '/captcha/', '/custom-css/', '/i18n/', '/media/', '/portal-preview/', '/static/')

# Existing Portal APIs and file routes handled by normal URLConf.
PORTAL_PASS_THROUGH_PREFIXES = ('/api/v1/portal/', '/file/portal/', '/file/portal-chat-image/', '/upload-file/portal/', '/portal/', '/portal-external/')
PORTAL_ROOT_PAGES = ('submit-issue', 'my-issues', 'knowledge-base', 'chat', 'login', 'anonymous-validate')
PORTAL_DETAIL_PAGES = ('my-issues', 'knowledge-base')


def _get_project_uuid_from_origin_path(normalized_path):
    if normalized_path == '/':
        return ''
    try:
        match = resolve(normalized_path)
    except Resolver404:
        try:
            match = resolve('%s/' % normalized_path)
        except Resolver404:
            return ''
    return match.kwargs.get('project_uuid') or ''


def _get_internal_path_for_portal_domain(project_uuid, normalized_path):
    site_root = getattr(settings, 'SITE_ROOT', '/')
    site_root = site_root if site_root.endswith('/') else '%s/' % site_root
    segments = normalized_path.strip('/').split('/') if normalized_path != '/' else []
    if not segments:
        return '%sportal/%s/' % (site_root, project_uuid)

    if len(segments) == 1:
        page = segments[0]
        if page in PORTAL_ROOT_PAGES:
            return '%sportal/%s/%s/' % (site_root, project_uuid, page)
        if page == 'logout':
            return '%sportal-external/logout/%s/' % (site_root, project_uuid)
        return ''

    if len(segments) == 2:
        page, item_id = segments
        if page in PORTAL_DETAIL_PAGES and item_id.isdigit():
            return '%sportal/%s/%s/%s/' % (site_root, project_uuid, page, item_id)
        if page == 'chat' and item_id:
            return '%sportal/%s/%s/%s/' % (site_root, project_uuid, page, item_id)
        return ''

    if len(segments) == 3:
        token = segments[2]
        if segments[:2] == ['external', 'accept'] and token:
            return '%sportal-external/accept/%s/%s/' % (site_root, token, project_uuid)

    return ''


class PortalDomainMiddleware(MiddlewareMixin):

    def process_request(self, request):
        path = request.path_info or '/'
        normalized_path = ('/%s' % path.lstrip('/')).rstrip('/') or '/'
        host = request.get_host()
        parsed = urlsplit('//%s' % (host or '').strip())
        request_host = (parsed.hostname or '').lower().rstrip('.')
        if not request_host:
            return None

        seaticket_server_hostname = getattr(settings, 'SEATICKET_SERVER_HOSTNAME', '')
        if request_host == seaticket_server_hostname:
            return None

        portal_domain = resolve_portal_domain(request_host)
        if not portal_domain:
            return None

        request.portal_domain = portal_domain
        project_uuid = portal_domain.binding.project_uuid
        requested_project_uuid = _get_project_uuid_from_origin_path(normalized_path)
        if requested_project_uuid and requested_project_uuid != project_uuid:
            raise Http404

        if portal_domain.domain_type == PORTAL_DOMAIN_TYPE_SERVICE_ALIAS:
            custom_domain = PortalCustomDomain.objects.get_verified_by_project_uuid(project_uuid)
            if custom_domain:
                return HttpResponseRedirect('%s://%s%s' % (request.scheme, custom_domain.domain, request.get_full_path()))

        if any(normalized_path == prefix.rstrip('/') or normalized_path.startswith(prefix) for prefix in PASS_THROUGH_PREFIXES):
            return None

        if requested_project_uuid and any(
            normalized_path == prefix.rstrip('/') or normalized_path.startswith(prefix)
            for prefix in PORTAL_PASS_THROUGH_PREFIXES
        ):
            return None

        internal_path = _get_internal_path_for_portal_domain(project_uuid, normalized_path)
        if not internal_path:
            raise Http404

        request.META['ORIGINAL_PATH_INFO'] = path
        request.META['PATH_INFO'] = internal_path
        request.path_info = internal_path
        request.path = internal_path
        return None

from urllib.parse import urlsplit

from django.conf import settings
from django.http import HttpResponseNotFound, HttpResponseRedirect
from django.urls import Resolver404, resolve
from django.utils.deprecation import MiddlewareMixin

from seahub.portal.models import PortalCustomDomain
from seahub.portal.paths import get_internal_portal_path
from seahub.portal.utils import PORTAL_DOMAIN_TYPE_SERVICE_ALIAS, get_request_project_and_portal_settings, resolve_portal_domain


# Static and auth resources needed by Portal domain pages.
PASS_THROUGH_PREFIXES = ('/accounts/', '/captcha/', '/custom-css/', '/i18n/', '/media/', '/portal-preview/', '/static/')

# Existing Portal APIs and file routes handled by normal URLConf.
PORTAL_PASS_THROUGH_PREFIXES = ('/api/v1/portal/', '/file/portal/', '/file/portal-chat-image/', '/upload-file/portal/', '/portal/', '/portal-external/')


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

        project_uuid = portal_domain.binding.project_uuid
        project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
        if not project or not portal_settings.get('enable_portal'):
            return None

        request.portal_domain = portal_domain
        requested_project_uuid = _get_project_uuid_from_origin_path(normalized_path)
        if requested_project_uuid and requested_project_uuid != project_uuid:
            return HttpResponseNotFound()

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

        internal_path = get_internal_portal_path(project_uuid, normalized_path)
        if not internal_path:
            return HttpResponseNotFound()

        request.META['ORIGINAL_PATH_INFO'] = path
        request.META['PATH_INFO'] = internal_path
        request.path_info = internal_path
        request.path = internal_path
        return None

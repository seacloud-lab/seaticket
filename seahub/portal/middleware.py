from django.conf import settings
from django.http import Http404, HttpResponseRedirect
from django.urls import Resolver404, resolve
from django.utils.deprecation import MiddlewareMixin

from seahub.portal.models import PortalCustomDomain
from seahub.portal.utils import PORTAL_DOMAIN_TYPE_CUSTOM, PORTAL_DOMAIN_TYPE_SERVICE_ALIAS, resolve_portal_domain


# Static and auth resources needed by Portal custom-domain pages.
PASS_THROUGH_PREFIXES = ('/accounts/', '/captcha/', '/custom-css/', '/i18n/', '/media/', '/portal-preview/', '/static/')

# Existing Portal APIs and file routes handled by normal URLConf.
PORTAL_PASS_THROUGH_PREFIXES = ('/api/v1/portal/', '/file/portal/', '/upload-file/portal/', '/portal/', '/portal-external/')
PORTAL_ROOT_PAGES = ('submit-issue', 'my-issues', 'knowledge-base', 'chat', 'login', 'anonymous-validate')
PORTAL_DETAIL_PAGES = ('my-issues', 'knowledge-base')


def _get_project_uuid_from_origin_path(normalized_path):
    paths = [normalized_path]
    if normalized_path != '/' and not normalized_path.endswith('/'):
        paths.append('%s/' % normalized_path)

    for path in paths:
        try:
            match = resolve(path)
        except Resolver404:
            continue
        project_uuid = match.kwargs.get('project_uuid')
        if project_uuid:
            return project_uuid
    return ''


def _get_internal_path_for_custom_domain(project_uuid, normalized_path):
    site_root = getattr(settings, 'SITE_ROOT', '/') or '/'
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


class PortalCustomDomainMiddleware(MiddlewareMixin):

    def process_request(self, request):
        path = request.path_info or '/'
        normalized_path = ('/%s' % path.lstrip('/')).rstrip('/') or '/'
        try:
            host = request.get_host()
        except Exception:
            host = request.META.get('HTTP_HOST') or request.META.get('SERVER_NAME') or ''
        parsed = urlsplit('//%s' % (host or '').strip())
        request_host = (parsed.hostname or '').lower().rstrip('.')
        if not request_host:
            return None

        seaticket_server_hostname = getattr(settings, 'SEATICKET_SERVER_HOSTNAME', '').lower()
        if seaticket_server_hostname and request_host == seaticket_server_hostname:
            return None

        portal_domain = resolve_portal_domain(request_host)
        if not portal_domain:
            return None

        request.portal_domain = portal_domain
        if portal_domain.domain_type == PORTAL_DOMAIN_TYPE_CUSTOM:
            request.portal_custom_domain = portal_domain.binding
        elif portal_domain.domain_type == PORTAL_DOMAIN_TYPE_SERVICE_ALIAS:
            requested_project_uuid = _get_project_uuid_from_origin_path(normalized_path)
            if requested_project_uuid and str(requested_project_uuid) != str(portal_domain.project_uuid):
                raise Http404
            custom_domain = PortalCustomDomain.objects.filter(project_uuid=portal_domain.project_uuid, verified=True).first()
            if custom_domain:
                return HttpResponseRedirect('%s://%s%s' % (
                    request.scheme,
                    custom_domain.domain,
                    request.get_full_path(),
                ))

        if any(normalized_path == prefix.rstrip('/') or normalized_path.startswith(prefix) for prefix in PASS_THROUGH_PREFIXES):
            return None

        requested_project_uuid = _get_project_uuid_from_origin_path(normalized_path)
        if requested_project_uuid and str(requested_project_uuid) != str(portal_domain.project_uuid):
            raise Http404
        if requested_project_uuid and any(
            normalized_path == prefix.rstrip('/') or normalized_path.startswith(prefix)
            for prefix in PORTAL_PASS_THROUGH_PREFIXES
        ):
            return None

        internal_path = _get_internal_path_for_custom_domain(portal_domain.project_uuid, normalized_path)
        if not internal_path:
            raise Http404

        request.META['ORIGINAL_PATH_INFO'] = path
        request.META['PATH_INFO'] = internal_path
        request.path_info = internal_path
        request.path = internal_path
        return None

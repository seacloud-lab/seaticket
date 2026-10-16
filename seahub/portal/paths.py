from django.conf import settings


PORTAL_ROOT_PAGES = ('submit-issue', 'my-issues', 'team-issues', 'knowledge-base', 'chat', 'login', 'anonymous-validate', 'home')
PORTAL_DETAIL_PAGES = ('my-issues', 'team-issues', 'knowledge-base')


def get_internal_portal_path(project_uuid, normalized_path):
    site_root = settings.SITE_ROOT.rstrip('/') + '/'
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

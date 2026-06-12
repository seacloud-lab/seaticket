from django.core.cache import cache

from rest_framework import status

from seahub.utils import normalize_cache_key
from seahub.organizations.models import OrgUser
from seahub.profile.models import Profile
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.project.utils import check_same_org_permission
from seahub.portal.chat.utils import get_portal_external_username
from seahub.portal.visitor_session import (
    clear_visitor_cookie,
    load_visitor_session,
    set_visitor_cookie,
    touch_visitor_session,
)
from seahub.portal.custom_domain import build_site_root_path, is_request_using_portal_custom_domain



PORTAL_EXTERNAL_LOGIN_CODE_TTL = 10 * 60
PORTAL_EXTERNAL_LOGIN_SEND_COOLDOWN = 60
PORTAL_EXTERNAL_LOGIN_VERIFY_FAIL_LIMIT = 5
PORTAL_EXTERNAL_LOGIN_VERIFY_LOCK_TTL = 15 * 60


def normalize_external_login_email(email):
    return (email or '').strip().lower()


def _portal_external_login_cache_key(prefix, project_uuid, email):
    return normalize_cache_key(f'{project_uuid}:{email}', prefix=prefix)


def get_portal_external_login_code_key(project_uuid, email):
    return _portal_external_login_cache_key('portal_email_login_code_', project_uuid, email)


def get_portal_external_login_cooldown_key(project_uuid, email):
    return _portal_external_login_cache_key('portal_email_login_cd_', project_uuid, email)


def get_portal_external_login_fail_key(project_uuid, email):
    return _portal_external_login_cache_key('portal_email_login_fail_', project_uuid, email)


def get_portal_external_login_lock_key(project_uuid, email):
    return _portal_external_login_cache_key('portal_email_login_lock_', project_uuid, email)


def is_portal_external_login_locked(project_uuid, email):
    lock_key = get_portal_external_login_lock_key(project_uuid, email)
    return bool(cache.get(lock_key))


def incr_portal_external_login_fail(project_uuid, email):
    fail_key = get_portal_external_login_fail_key(project_uuid, email)
    attempts = 1
    try:
        attempts = cache.incr(fail_key)
    except ValueError:
        cache.set(fail_key, 1, PORTAL_EXTERNAL_LOGIN_CODE_TTL)
    return attempts


def clear_portal_external_login_code(project_uuid, email):
    cache.delete(get_portal_external_login_code_key(project_uuid, email))


def clear_portal_external_login_state(project_uuid, email):
    clear_portal_external_login_code(project_uuid, email)
    cache.delete(get_portal_external_login_cooldown_key(project_uuid, email))
    cache.delete(get_portal_external_login_fail_key(project_uuid, email))
    cache.delete(get_portal_external_login_lock_key(project_uuid, email))


def is_user_in_the_same_team(project, email):
    org_id = getattr(project.workspace, 'org_id', -1)
    if org_id == -1:
        return False

    username = Profile.objects.convert_login_str_to_username((email or '').strip())
    if not username:
        return False

    if not OrgUser.objects.org_user_exists(org_id, username):
        return False
    
    return True


def _build_visitor_session_error():
    response = api_error(status.HTTP_401_UNAUTHORIZED, 'Visitor session expired. Please refresh the page.')
    response.data['error_code'] = 'visitor_session_expired'
    clear_visitor_cookie(response)
    return response


def _get_project_or_error(project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
    return project, None


def _get_request_identity(request, project_uuid):
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        project = getattr(request, 'project', None) or Projects.objects.get_project_by_uuid(project_uuid)
        workspace = getattr(project, 'workspace', None)
        if workspace and check_same_org_permission(user, workspace):
            return {
                'username': user.username,
                'is_external_user': False,
                'is_anonymous': False,
            }, None

    external_username = get_portal_external_username(request, project_uuid)
    if external_username:
        return {
            'username': external_username,
            'is_external_user': True,
            'is_anonymous': False,
        }, None

    visitor_session = load_visitor_session(request)
    if visitor_session.get('status') != 'active':
        return None, _build_visitor_session_error()

    visitor_uuid = visitor_session['visitor_uuid']
    touched_session = touch_visitor_session(
        visitor_uuid,
        visitor_session['session_data'],
        refresh_cookie=visitor_session['should_refresh_cookie'],
    )
    if not touched_session:
        return None, _build_visitor_session_error()

    return {
        'username': visitor_uuid,
        'visitor_uuid': visitor_uuid,
        'is_external_user': False,
        'is_anonymous': True,
        'should_refresh_cookie': visitor_session['should_refresh_cookie'],
        'visitor_session': touched_session,
    }, None


def finalize_visitor_session_response(response, identity):
    if not identity or not identity.get('is_anonymous'):
        return response

    if identity.get('should_refresh_cookie'):
        set_visitor_cookie(response, identity['visitor_uuid'])
    return response


def is_portal_custom_domain_request(request, project_uuid=None):
    return bool(request and is_request_using_portal_custom_domain(request, project_uuid))


def portal_path(request, project_uuid, *segments, is_edit_mode=False):
    suffix = '/'.join([str(segment).strip('/') for segment in segments if segment not in (None, '', False)])
    if not is_edit_mode and is_portal_custom_domain_request(request, project_uuid):
        return '/%s/' % suffix if suffix else '/'

    prefix = 'portal-edit' if is_edit_mode else 'portal'
    path = '/'.join([prefix, str(project_uuid)] + ([suffix] if suffix else [])) + '/'
    return build_site_root_path(path)


def portal_endpoint(func):
    def wrapper(self, request, *args, **kwargs):
        project_uuid = kwargs.get('project_uuid')

        project, error = _get_project_or_error(project_uuid)
        if error:
            return error

        identity, error = _get_request_identity(request, project_uuid)
        if error:
            return error

        request.project = project
        request.identity = identity

        response = func(self, request, *args, **kwargs)
        return finalize_visitor_session_response(response, identity)
    return wrapper

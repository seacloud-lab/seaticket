import json
from types import SimpleNamespace

from django.conf import settings
from django.core.cache import cache
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired

from rest_framework import status

from seahub.utils import normalize_cache_key
from seahub.organizations.models import OrgUser
from seahub.profile.models import Profile
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.project.utils import check_project_admin_permission, check_same_org_permission
from seahub.portal.chat.utils import get_portal_external_username
from seahub.portal.visitor_session import (
    clear_visitor_cookie,
    load_visitor_session,
    set_visitor_cookie,
    touch_visitor_session,
)
from seahub.portal.custom_domain import is_request_using_portal_domain
from seahub.portal.models import PortalCustomDomain, PortalDomainAlias



PORTAL_DOMAIN_TYPE_SERVICE_ALIAS = 'service_alias'
PORTAL_DOMAIN_TYPE_CUSTOM = 'custom'
PORTAL_EXTERNAL_LOGIN_CODE_TTL = 10 * 60
PORTAL_EXTERNAL_LOGIN_SEND_COOLDOWN = 60
PORTAL_EXTERNAL_LOGIN_VERIFY_FAIL_LIMIT = 5
PORTAL_EXTERNAL_LOGIN_VERIFY_LOCK_TTL = 15 * 60
PORTAL_PREVIEW_TOKEN_SALT = 'seahub.portal.preview'
PORTAL_PREVIEW_TOKEN_TTL = 5 * 60
PORTAL_PREVIEW_SESSION_USERNAME_KEY = 'portal_preview_username'
PORTAL_PREVIEW_SESSION_PROJECT_KEY = 'portal_preview_project_uuid'

def resolve_portal_domain(host):
    if not host:
        return None

    alias = PortalDomainAlias.objects.get_by_host(host)
    if alias:
        return SimpleNamespace(
            domain_type=PORTAL_DOMAIN_TYPE_SERVICE_ALIAS,
            binding=alias,
        )

    custom_domain = PortalCustomDomain.objects.get_by_domain(host)
    if custom_domain and custom_domain.verified:
        return SimpleNamespace(
            domain_type=PORTAL_DOMAIN_TYPE_CUSTOM,
            binding=custom_domain,
        )

    return None


def load_portal_preview_token(token):
    try:
        payload = signing.loads(
            token,
            salt=PORTAL_PREVIEW_TOKEN_SALT,
            max_age=PORTAL_PREVIEW_TOKEN_TTL,
        )
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None

    project_uuid = str(payload.get('project_uuid') or '')
    username = payload.get('username') or ''
    if not project_uuid or not username:
        return None
    return {
        'project_uuid': project_uuid,
        'username': username,
    }


def set_portal_preview_session(request, project_uuid, username):
    request.session[PORTAL_PREVIEW_SESSION_PROJECT_KEY] = str(project_uuid)
    request.session[PORTAL_PREVIEW_SESSION_USERNAME_KEY] = username


def can_preview_portal(username, project):
    if check_project_admin_permission(username, project.workspace.owner):
        return True

    org_id = getattr(project.workspace, 'org_id', -1)
    if org_id == -1:
        return False
    return OrgUser.objects.org_user_exists(org_id, username)


def get_request_session(request):
    session = getattr(request, 'session', None)
    if session is not None:
        return session

    django_request = getattr(request, '_request', None)
    return getattr(django_request, 'session', None)


def get_portal_preview_username(request, project_uuid):
    session = get_request_session(request)
    if session is None:
        return ''

    preview_project_uuid = session.get(PORTAL_PREVIEW_SESSION_PROJECT_KEY)
    preview_username = session.get(PORTAL_PREVIEW_SESSION_USERNAME_KEY)
    if not preview_project_uuid or not preview_username:
        return ''
    if preview_project_uuid != project_uuid:
        return ''

    project, _portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        return ''
    if not can_preview_portal(preview_username, project):
        return ''
    return preview_username


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

def get_portal_settings(project):
    try:
        project_settings = json.loads(project.settings) if project.settings else {}
    except Exception:
        project_settings = {}
    portal_settings = project_settings.get('portal', {})
    streaming_response = bool(project_settings.get('streaming_response', True))
    return {
        'enable_portal': bool(portal_settings.get('enable_portal', False)),
        'allow_anonymous': bool(portal_settings.get('allow_anonymous', False)),
        'enable_password_protection': bool(portal_settings.get('enable_password_protection', False)),
        'show_kb_in_portal': bool(portal_settings.get('show_knowledge_base', False)),
        'password': portal_settings.get('password'),
        'streaming_response': streaming_response,
        'portal_name': portal_settings.get('portal_name', ''),
        'portal_logo': portal_settings.get('portal_logo', ''),
    }


def get_request_project_and_portal_settings(request, project_uuid):
    request_project = getattr(request, 'project', None)
    if request_project and str(getattr(request_project, 'uuid', '')) == str(project_uuid):
        portal_settings = getattr(request, 'portal_settings', None)
        if portal_settings is None:
            portal_settings = get_portal_settings(request_project)
            request.portal_settings = portal_settings
        return request_project, portal_settings

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return None, None

    portal_settings = get_portal_settings(project)
    request.project = project
    request.portal_settings = portal_settings
    return project, portal_settings

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

    preview_username = get_portal_preview_username(request, project_uuid)
    if preview_username:
        return {
            'username': preview_username,
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


def portal_path(request, project_uuid, *segments, is_edit_mode=False):
    suffix = '/'.join(str(segment).strip('/') for segment in segments)
    if not is_edit_mode and is_request_using_portal_domain(request, project_uuid):
        return '/%s/' % suffix if suffix else '/'

    prefix = 'portal-edit' if is_edit_mode else 'portal'
    path = '%s/%s/' % (prefix, project_uuid)
    if suffix:
        path = '%s%s/' % (path, suffix)

    site_root = getattr(settings, 'SITE_ROOT', '/')
    if not site_root.endswith('/'):
        site_root = '%s/' % site_root
    return '%s%s' % (site_root, path)


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


def build_absolute_portal_url(request, domain, path='/'):
    if not domain:
        return ''
    normalized_path = path if path.startswith('/') else '/%s' % path
    return '%s://%s%s' % (request.scheme, domain, normalized_path)

from django.core.cache import cache
from email.utils import formatdate

from seahub.utils import normalize_cache_key
from seahub.auth.models import EmailUser
from seahub.organizations.models import OrgUser
from seahub.profile.models import Profile



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

    user = EmailUser.objects.get_user_by_email(username)
    if not user or not user.is_active:
        return False

    if not OrgUser.objects.org_user_exists(org_id, username):
        return False
    
    return True

def etag_matches(request_etag_header, response_etag):
    if not request_etag_header or not response_etag:
        return False

    candidate_etags = [etag.strip() for etag in request_etag_header.split(',')]
    normalized_response_etag = response_etag[2:] if response_etag.startswith('W/') else response_etag
    for candidate in candidate_etags:
        if candidate == '*':
            return True
        normalized_candidate = candidate[2:] if candidate.startswith('W/') else candidate
        if normalized_candidate == normalized_response_etag:
            return True
    return False

def build_portal_logo_cache_response(response, metadata):
    response['Cache-Control'] = 'public, max-age=86400'
    response['ETag'] = metadata.get('ETag', '')
    last_modified = metadata.get('LastModified')
    if last_modified:
        response['Last-Modified'] = formatdate(int(last_modified.timestamp()), usegmt=True)
    return response
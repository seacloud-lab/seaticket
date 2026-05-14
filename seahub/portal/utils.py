from django.core.cache import cache

from seahub.utils import normalize_cache_key
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

    if not OrgUser.objects.org_user_exists(org_id, username):
        return False
    
    return True

from django.core.cache import cache
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status

from seahub.api2.utils import api_error
from seahub.project.constants import AIScenario
from seahub.project.models import AIUsageStatistics
from seahub.project.utils import convert_cost_to_credit
from seahub.portal.models import ProjectExternalUser
from seahub.utils import normalize_cache_key, uuid_str_to_32_chars


PORTAL_EXTERNAL_CHAT_USER_RATE_LIMIT = 20
PORTAL_EXTERNAL_CHAT_USER_RATE_WINDOW = 10 * 60
PORTAL_EXTERNAL_CHAT_PROJECT_RATE_LIMIT = 100
PORTAL_EXTERNAL_CHAT_PROJECT_RATE_WINDOW = 60 * 60


def get_portal_external_username(request, project_uuid):
    ext_username = request.session.get('portal_external_username')
    ext_project_uuid = request.session.get('portal_external_project_uuid')
    if not ext_username or ext_project_uuid != project_uuid:
        return ''
    exists = ProjectExternalUser.objects.filter(
        project_uuid=project_uuid, username=ext_username, activated=True
    ).exists()
    return ext_username if exists else ''


def _get_counter_cache_key(prefix, *parts):
    return normalize_cache_key(':'.join(str(part) for part in parts), prefix=prefix)


def _get_cached_counter(key):
    return cache.get(key, 0) or 0


def _increase_cached_counter(key, timeout):
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout)
        return 1


def _get_external_user_rate_limit_key(project_uuid, username):
    return _get_counter_cache_key('portal_ext_chat_user_', project_uuid, username)


def _get_external_project_rate_limit_key(project_uuid):
    return _get_counter_cache_key('portal_ext_chat_project_', project_uuid)


def check_external_chat_rate_limit(project_uuid, username):
    user_key = _get_external_user_rate_limit_key(project_uuid, username)
    if _get_cached_counter(user_key) >= PORTAL_EXTERNAL_CHAT_USER_RATE_LIMIT:
        return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Too many requests, please try again later.')

    project_key = _get_external_project_rate_limit_key(project_uuid)
    if _get_cached_counter(project_key) >= PORTAL_EXTERNAL_CHAT_PROJECT_RATE_LIMIT:
        return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Too many requests, please try again later.')

    return None


def mark_external_chat_rate_limit(project_uuid, username):
    _increase_cached_counter(
        _get_external_user_rate_limit_key(project_uuid, username),
        PORTAL_EXTERNAL_CHAT_USER_RATE_WINDOW
    )
    _increase_cached_counter(
        _get_external_project_rate_limit_key(project_uuid),
        PORTAL_EXTERNAL_CHAT_PROJECT_RATE_WINDOW
    )


def get_project_portal_chat_credit_used(project_uuid):
    today = timezone.localdate()
    total_cost = AIUsageStatistics.objects.filter(
        date=today,
        project_uuid=uuid_str_to_32_chars(project_uuid),
        scenario=AIScenario.PORTAL_CHAT.value,
    ).aggregate(
        total_cost=Coalesce(Sum('cost'), Value(0.0))
    )['total_cost']

    return convert_cost_to_credit(total_cost or 0)

from datetime import date, datetime, timezone as datetime_timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.utils import timezone

from seahub.portal.chat.utils import (
    _get_counter_cache_key,
    check_anonymous_chat_rate_limit,
    get_project_portal_chat_credit_used,
    mark_anonymous_chat_rate_limit,
)
from seahub.project.constants import AIScenario
from seahub.project.models import AIUsageStatistics


def _create_usage(project_uuid, usage_date, cost, scenario=AIScenario.PORTAL_CHAT.value, model='test-model'):
    return AIUsageStatistics.objects.create(
        project_uuid=project_uuid.hex,
        date=usage_date,
        owner='owner@example.com',
        model=model,
        scenario=scenario,
        cost=cost,
    )


@pytest.mark.django_db
class TestPortalChatCreditUsage:

    @pytest.mark.parametrize('active_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
    @pytest.mark.parametrize('now, expected_credits', [
        (datetime(2026, 10, 25, 15, 59, tzinfo=datetime_timezone.utc), 5),
        (datetime(2026, 10, 25, 16, 0, tzinfo=datetime_timezone.utc), 5),
        (datetime(2026, 10, 25, 23, 59, tzinfo=datetime_timezone.utc), 5),
        (datetime(2026, 10, 26, 0, 0, tzinfo=datetime_timezone.utc), 1),
    ])
    def test_uses_utc_date_independently_of_active_timezone(self, active_timezone, now, expected_credits):
        project_uuid = uuid4()
        _create_usage(project_uuid, date(2026, 10, 25), 0.02)
        _create_usage(project_uuid, date(2026, 10, 25), 0.03, model='another-model')
        _create_usage(project_uuid, date(2026, 10, 26), 0.01)

        with timezone.override(active_timezone), \
                patch('seahub.portal.chat.utils.timezone.now', return_value=now):
            credits = get_project_portal_chat_credit_used(str(project_uuid))

        assert credits == pytest.approx(expected_credits)

    def test_excludes_other_projects_and_scenarios(self):
        project_uuid = uuid4()
        usage_date = date(2026, 10, 25)
        _create_usage(project_uuid, usage_date, 0.01)
        _create_usage(uuid4(), usage_date, 1)
        _create_usage(project_uuid, usage_date, 1, scenario=AIScenario.CHAT.value)
        now = datetime(2026, 10, 25, 19, 57, tzinfo=datetime_timezone.utc)

        with timezone.override('Asia/Shanghai'), \
                patch('seahub.portal.chat.utils.timezone.now', return_value=now):
            credits = get_project_portal_chat_credit_used(str(project_uuid))

        assert credits == pytest.approx(1)

    def test_returns_zero_without_usage(self):
        assert get_project_portal_chat_credit_used(str(uuid4())) == 0


@pytest.fixture
def anonymous_cache(settings):
    settings.CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': f'portal-chat-utc-{uuid4().hex}',
        },
    }
    yield cache
    cache.clear()


@pytest.mark.usefixtures('anonymous_cache')
class TestPortalAnonymousChatUTC:

    @pytest.mark.parametrize('active_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
    @pytest.mark.parametrize('limit_type', ['visitor', 'ip'])
    def test_daily_limits_reset_only_at_utc_midnight(self, active_timezone, limit_type):
        limits = {
            'anonymous_chat_session_daily_limit': 1 if limit_type == 'visitor' else 100,
            'anonymous_chat_ip_daily_limit': 1 if limit_type == 'ip' else 100,
        }
        expected_error = (
            'Anonymous chat daily limit exceeded. Please try again tomorrow or log in.'
            if limit_type == 'visitor' else 'Too many requests from this IP. Please try again tomorrow.'
        )
        visitor, ip = uuid4().hex, uuid4().hex

        with timezone.override(active_timezone):
            with patch('seahub.portal.chat.utils.timezone.now', return_value=datetime(
                2026, 10, 25, 15, 59, tzinfo=datetime_timezone.utc,
            )):
                mark_anonymous_chat_rate_limit(visitor, ip)

            for hour, minute in ((16, 0), (23, 59)):
                with patch('seahub.portal.chat.utils.timezone.now', return_value=datetime(
                    2026, 10, 25, hour, minute, tzinfo=datetime_timezone.utc,
                )):
                    assert check_anonymous_chat_rate_limit(visitor, ip, limits) == expected_error

            with patch('seahub.portal.chat.utils.timezone.now', return_value=datetime(
                2026, 10, 26, tzinfo=datetime_timezone.utc,
            )):
                assert check_anonymous_chat_rate_limit(visitor, ip, limits) is None
                mark_anonymous_chat_rate_limit(visitor, ip)
                assert check_anonymous_chat_rate_limit(visitor, ip, limits) == expected_error

    def test_visitor_and_ip_counters_remain_independent(self):
        limits = {'anonymous_chat_session_daily_limit': 2, 'anonymous_chat_ip_daily_limit': 3}
        visitor, other_visitor = uuid4().hex, uuid4().hex
        ip, other_ip = uuid4().hex, uuid4().hex
        now = datetime(2026, 10, 25, 19, 57, tzinfo=datetime_timezone.utc)

        with patch('seahub.portal.chat.utils.timezone.now', return_value=now):
            mark_anonymous_chat_rate_limit(visitor, ip)
            mark_anonymous_chat_rate_limit(visitor, ip)
            assert check_anonymous_chat_rate_limit(visitor, other_ip, limits).startswith('Anonymous chat daily limit')
            assert check_anonymous_chat_rate_limit(other_visitor, ip, limits) is None
            mark_anonymous_chat_rate_limit(other_visitor, ip)
            assert check_anonymous_chat_rate_limit(other_visitor, ip, limits).startswith('Too many requests from this IP')
            assert check_anonymous_chat_rate_limit(other_visitor, other_ip, limits) is None

    def test_legacy_local_day_counters_do_not_affect_utc_counters(self, anonymous_cache):
        visitor, ip = uuid4().hex, uuid4().hex
        limits = {'anonymous_chat_session_daily_limit': 1, 'anonymous_chat_ip_daily_limit': 1}
        for date_str in ('20261025', '20261026'):
            for prefix, identifier in (
                ('portal_anon_chat_session_daily_', visitor),
                ('portal_anon_chat_ip_daily_', ip),
            ):
                anonymous_cache.set(_get_counter_cache_key(prefix, identifier, date_str), 1, 86400)

        now = datetime(2026, 10, 25, 19, 57, tzinfo=datetime_timezone.utc)
        with timezone.override('Asia/Shanghai'), patch('seahub.portal.chat.utils.timezone.now', return_value=now):
            assert check_anonymous_chat_rate_limit(visitor, ip, limits) is None
            mark_anonymous_chat_rate_limit(visitor, ip)
            assert check_anonymous_chat_rate_limit(visitor, ip, limits).startswith('Anonymous chat daily limit')

        for prefix, identifier in (
            ('portal_anon_chat_session_daily_utc_', visitor),
            ('portal_anon_chat_ip_daily_utc_', ip),
        ):
            assert anonymous_cache.get(_get_counter_cache_key(prefix, identifier, '20261025')) == 1

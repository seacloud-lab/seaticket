import calendar
from datetime import date, datetime, timedelta, timezone as datetime_timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.utils import timezone

from seahub.api2.endpoints.org_admin.statistics import OrgAdminAIStatisticsOverviewView
from seahub.project.constants import AIScenario
from seahub.project.models import AIUsageStatistics
from seahub.project.utils import check_ai_limit, get_ai_cost_by_org_id
from seahub.utils.timeutils import get_month_date_range


@pytest.fixture
def month_cache(settings):
    settings.CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': f'ai-credit-month-{uuid4().hex}',
        },
    }
    yield cache
    cache.clear()


@pytest.mark.usefixtures('month_cache')
class TestAICreditMonthRange:

    @pytest.mark.parametrize('active_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
    @pytest.mark.parametrize('now, expected_start, expected_end', [
        (datetime(2026, 10, 31, 15, 59, tzinfo=datetime_timezone.utc), date(2026, 10, 1), date(2026, 10, 31)),
        (datetime(2026, 10, 31, 16, 30, tzinfo=datetime_timezone.utc), date(2026, 10, 1), date(2026, 10, 31)),
        (datetime(2026, 10, 31, 23, 59, tzinfo=datetime_timezone.utc), date(2026, 10, 1), date(2026, 10, 31)),
        (datetime(2026, 11, 1, tzinfo=datetime_timezone.utc), date(2026, 11, 1), date(2026, 11, 30)),
        (datetime(2026, 12, 31, 23, 59, tzinfo=datetime_timezone.utc), date(2026, 12, 1), date(2026, 12, 31)),
        (datetime(2027, 1, 1, tzinfo=datetime_timezone.utc), date(2027, 1, 1), date(2027, 1, 31)),
    ])
    def test_current_month_uses_utc(self, active_timezone, now, expected_start, expected_end):
        with timezone.override(active_timezone), patch('seahub.utils.timeutils.timezone.now', return_value=now):
            assert get_month_date_range() == (expected_start, expected_end)

    def test_explicit_month_is_preserved(self):
        assert get_month_date_range(2024, 2) == (date(2024, 2, 1), date(2024, 2, 29))


@pytest.mark.django_db
def test_org_limit_and_cache_switch_at_utc_month_boundary(month_cache):
    org_id = 123456
    for usage_date, cost, usage_org in (
        (date(2026, 9, 30), 9, org_id),
        (date(2026, 10, 1), 0.6, org_id),
        (date(2026, 10, 31), 0.4, org_id),
        (date(2026, 11, 1), 0.25, org_id),
        (date(2026, 12, 1), 9, org_id),
        (date(2026, 10, 31), 9, org_id + 1),
    ):
        AIUsageStatistics.objects.create(
            date=usage_date, project_uuid=uuid4().hex, owner='owner@example.com',
            org_id=usage_org, model='test-model', scenario=AIScenario.CHAT.value, cost=cost,
        )
    # A cached value from the old key must not leak into a UTC month.
    month_cache.set(f'ai_cost_org_{org_id}', 999, 600)

    with timezone.override('Asia/Shanghai'), \
            patch('seahub.project.utils.get_total_ai_credit_by_org_id', return_value=100):
        with patch('seahub.utils.timeutils.timezone.now', return_value=datetime(
            2026, 10, 31, 23, 59, tzinfo=datetime_timezone.utc,
        )):
            assert get_ai_cost_by_org_id(org_id) == pytest.approx(1)
            assert check_ai_limit(org_id) is True

        with patch('seahub.utils.timeutils.timezone.now', return_value=datetime(
            2026, 11, 1, tzinfo=datetime_timezone.utc,
        )):
            assert get_ai_cost_by_org_id(org_id) == pytest.approx(0.25)
            assert check_ai_limit(org_id) is False


class TestOrgCreditStatisticsUTC:

    @pytest.mark.parametrize('active_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
    @pytest.mark.parametrize('now, expected_today', [
        (datetime(2026, 10, 31, 16, 30, tzinfo=datetime_timezone.utc), date(2026, 10, 31)),
        (datetime(2026, 11, 1, tzinfo=datetime_timezone.utc), date(2026, 11, 1)),
        (datetime(2026, 12, 31, 23, 59, tzinfo=datetime_timezone.utc), date(2026, 12, 31)),
        (datetime(2027, 1, 1, tzinfo=datetime_timezone.utc), date(2027, 1, 1)),
    ])
    @pytest.mark.parametrize('group_by', [None, 'scenario', 'month', 'date'])
    def test_all_overview_modes_use_one_utc_date(self, active_timezone, now, expected_today, group_by):
        view = OrgAdminAIStatisticsOverviewView()
        request = SimpleNamespace(
            user=SimpleNamespace(org=SimpleNamespace(org_id=7)),
            GET={'group_by': group_by} if group_by else {},
        )
        with timezone.override(active_timezone), \
                patch('seahub.utils.timeutils.timezone.now', side_effect=[now, now + timedelta(days=1)]) as clock, \
                patch.object(view, '_get_total_credit_used', return_value=0) as total_usage, \
                patch.object(view, '_get_scenario_percentages', return_value={'results': [], 'count': 0}) as scenarios, \
                patch('seahub.api2.endpoints.org_admin.statistics.query_ai_statistics_detail', return_value=[]) as daily_usage:
            response = view.get(request, org_id=7)

        assert response.status_code == 200
        clock.assert_called_once()
        month_start = expected_today.replace(day=1)
        month_end = expected_today.replace(day=calendar.monthrange(expected_today.year, expected_today.month)[1])
        expected_range = [month_start.isoformat(), month_end.isoformat()]
        if group_by == 'month':
            assert response.data['results'][-1]['month'] == expected_today.strftime('%Y-%m')
            assert total_usage.call_args.args == (expected_range, 7)
        elif group_by == 'date':
            daily_usage.assert_called_once_with('date', [month_start, expected_today], {'org_id': 7})
            assert response.data['results'][-1]['date'] == expected_today.isoformat()
            assert response.data['count'] == expected_today.day
        elif group_by == 'scenario':
            scenarios.assert_called_once_with(expected_range, 7)
        else:
            assert total_usage.call_args_list[0].args == (expected_range, 7)

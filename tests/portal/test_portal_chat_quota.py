from datetime import date, datetime, timezone as datetime_timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.utils import timezone

from seahub.portal.chat.utils import get_project_portal_chat_credit_used
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

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from seahub.api2.endpoints.org_admin.projects import _storage_usage_dict as org_admin_storage_usage_dict


@pytest.mark.parametrize('serializer', [
    org_admin_storage_usage_dict,
])
def test_storage_usage_response_contains_only_s3_components(serializer):
    stat = SimpleNamespace(
        file_size=20,
        crawl_data_size=30,
        calculated_at=datetime(2026, 7, 23, 1, 2, 3, tzinfo=timezone.utc),
    )

    assert serializer(stat) == {
        'total_size': '50',
        'file_size': '20',
        'crawl_data_size': '30',
        'calculated_at': '2026-07-23T01:02:03Z',
    }


@pytest.mark.parametrize('serializer', [
    org_admin_storage_usage_dict,
])
def test_storage_usage_response_is_null_without_snapshot(serializer):
    assert serializer(None) is None

import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.urls import resolve
from rest_framework.test import force_authenticate

from seahub.project.connections import ProjectConnectionStatisticsView
from seahub.project.constants import ConnectionType
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI, ISSUE_STATISTICS_BUCKET_PAGE_SIZE

PROJECT_UUID = '12345678-1234-1234-1234-1234567890ab'
NOW = datetime.datetime(2026, 10, 12, 6, 0, tzinfo=datetime.timezone.utc)
VIEW_MODULE = 'seahub.project.connections'
DATA_MODULE = 'seahub.seadb_models.github_seadb_api'


def make_connection(connection_type='github_issue', connection_id=7):
    return SimpleNamespace(id=connection_id, type=connection_type)


def make_seadb(connection_type='github_issue', rows=None, options=None):
    api = MagicMock()
    type_column = {
        'name': 'issue_type',
        'data': {'options': options if options is not None else [
            {'name': 'Bug'}, {'name': 'Feature'}, {'name': 'Question'},
        ]},
    }
    api.get_base_metadata.return_value = {
        'tables': [{
            'name': f'{connection_type}_7',
            'columns': [type_column],
        }],
    }
    api.query_rows.return_value = {
        'success': True,
        'results': rows or [],
        'metadata': [{'name': 'month'}, type_column, {'name': 'count'}],
    }
    return api


def get_statistics(seadb_api):
    return GitHubSeaDBAPI(PROJECT_UUID, seadb_api=seadb_api).get_issue_statistics(7)


@pytest.fixture
def frozen_now():
    with patch(f'{DATA_MODULE}.timezone.now', return_value=NOW):
        yield


def test_monthly_counts_include_custom_and_unclassified_types(frozen_now):
    api = make_seadb(rows=[
        {'month': '2025-11', 'issue_type': 'Bug', 'count': 1201},
        {'month': '2026-01', 'issue_type': 'Feature', 'count': 3},
        {'month': '2026-10', 'issue_type': None, 'count': 2},
        {'month': '2026-10', 'issue_type': '', 'count': 1},
        {'month': '2026-10', 'issue_type': 'Security', 'count': 5},
    ])
    result = get_statistics(api)
    counts = {series['issue_type']: series['counts'] for series in result['series']}

    assert set(result) == {'connection_id', 'months', 'series', 'total'}
    assert result['months'] == [
        '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
        '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]
    assert all(len(values) == 12 for values in counts.values())
    assert counts['Bug'] == [1201] + [0] * 11
    assert counts['Feature'][2] == 3
    assert counts['Question'] == [0] * 12
    assert counts[None][-1] == 3
    assert counts['Security'][-1] == 5
    assert result['total'] == 1212
    assert [series['issue_type'] for series in result['series']] == [
        'Bug', 'Feature', 'Question', 'Security', None,
    ]


def test_task_ranks_before_custom_types_that_sort_alphabetically_first(frozen_now):
    api = make_seadb(options=[
        {'name': 'Bug'}, {'name': 'Feature'}, {'name': 'Task'}, {'name': 'Aaa'},
    ])
    result = get_statistics(api)
    assert [series['issue_type'] for series in result['series']] == [
        'Bug', 'Feature', 'Task', 'Aaa', None,
    ]


def test_query_is_connection_scoped_and_excludes_deleted_and_future_issues(frozen_now):
    api = make_seadb()
    get_statistics(api)
    args, kwargs = api.query_rows.call_args

    assert args[0] == PROJECT_UUID
    assert 'FROM `github_issue_7`' in args[1]
    assert '(`deleted` = False OR `deleted` IS NULL)' in args[1]
    assert '`created_time` >= ? AND `created_time` < ?' in args[1]
    assert 'GROUP BY ISOMONTH(`created_time`), `issue_type`' in args[1]
    assert 'state' not in args[1]
    assert kwargs['params'] == [
        '2025-11-01T00:00:00+00:00', '2026-10-12T06:00:00+00:00',
    ]


def test_utc_month_boundaries_are_consistent_for_non_utc_now():
    api = make_seadb()
    local_now = datetime.datetime(
        2026, 11, 1, 0, 30, tzinfo=datetime.timezone(datetime.timedelta(hours=8)),
    )
    with patch(f'{DATA_MODULE}.timezone.now', return_value=local_now):
        result = get_statistics(api)
    assert 'timezone' not in result
    assert result['months'][-1] == '2026-10'
    assert api.query_rows.call_args.kwargs['params'] == [
        '2025-11-01T00:00:00+00:00', '2026-10-31T16:30:00+00:00',
    ]


def test_synced_empty_connection_keeps_zero_filled_chart(frozen_now):
    api = make_seadb()
    result = get_statistics(api)
    assert set(result) == {'connection_id', 'months', 'series', 'total'}
    assert result['total'] == 0
    assert len(result['months']) == 12
    assert all(series['counts'] == [0] * 12 for series in result['series'])
    assert [series['issue_type'] for series in result['series']] == [
        'Bug', 'Feature', 'Question', None,
    ]
    api.query_rows.assert_called_once()
    api.get_base_metadata.assert_not_called()


def test_successful_statistics_do_not_request_project_metadata(frozen_now):
    api = make_seadb(rows=[{'month': '2026-10', 'issue_type': 'Bug', 'count': 4}])
    api.get_base_metadata.side_effect = AssertionError('Metadata should come from the query.')
    result = get_statistics(api)
    assert result['total'] == 4
    api.query_rows.assert_called_once()
    api.get_base_metadata.assert_not_called()


def test_empty_type_options_are_valid_and_keep_unclassified_series(frozen_now):
    api = make_seadb(options=[])
    result = get_statistics(api)
    assert result['series'] == [{'issue_type': None, 'counts': [0] * 12}]
    api.get_base_metadata.assert_not_called()


@pytest.mark.parametrize('metadata', [None, [], [{'name': 'month'}, {'name': 'count'}]])
def test_missing_issue_type_metadata_has_an_explicit_error(frozen_now, metadata):
    api = make_seadb()
    api.query_rows.return_value['metadata'] = metadata
    with pytest.raises(RuntimeError, match='require an issue_type column'):
        get_statistics(api)
    api.get_base_metadata.assert_not_called()


def test_query_failure_is_not_reported_as_zero(frozen_now):
    api = make_seadb()
    api.query_rows.return_value = {'success': False, 'error_message': 'unavailable'}
    with pytest.raises(RuntimeError, match='Could not query connection statistics'):
        get_statistics(api)
    api.get_base_metadata.assert_not_called()


def test_connection_errors_from_the_query_propagate_to_the_caller(frozen_now):
    api = make_seadb()
    error = ConnectionError(400, '{"error_message":"no such table"}')
    api.query_rows.side_effect = error
    with pytest.raises(ConnectionError) as exc:
        get_statistics(api)
    assert exc.value is error
    api.get_base_metadata.assert_not_called()


def test_aggregate_buckets_are_paginated_without_truncation(frozen_now):
    api = make_seadb()
    metadata = api.query_rows.return_value['metadata']
    api.query_rows.side_effect = [
        {'metadata': metadata, 'results': [
            {'month': '2026-10', 'issue_type': f'Type {index}', 'count': 1}
            for index in range(ISSUE_STATISTICS_BUCKET_PAGE_SIZE)
        ]},
        {'results': [{'month': '2026-10', 'issue_type': 'Final type', 'count': 7}]},
    ]
    result = get_statistics(api)
    assert result['total'] == ISSUE_STATISTICS_BUCKET_PAGE_SIZE + 7
    assert api.query_rows.call_count == 2
    assert f'LIMIT {ISSUE_STATISTICS_BUCKET_PAGE_SIZE}, {ISSUE_STATISTICS_BUCKET_PAGE_SIZE}' in api.query_rows.call_args.args[1]
    api.get_base_metadata.assert_not_called()


def test_later_page_errors_do_not_return_partial_statistics(frozen_now):
    api = make_seadb()
    metadata = api.query_rows.return_value['metadata']
    error = ConnectionError(400, '{"error_message":"no such table"}')
    api.query_rows.side_effect = [
        {'metadata': metadata, 'results': [
            {'month': '2026-10', 'issue_type': f'Type {index}', 'count': 1}
            for index in range(ISSUE_STATISTICS_BUCKET_PAGE_SIZE)
        ]},
        error,
    ]
    with pytest.raises(ConnectionError) as exc:
        get_statistics(api)
    assert exc.value is error
    api.get_base_metadata.assert_not_called()


@pytest.fixture
def endpoint_mocks():
    with patch(f'{VIEW_MODULE}.Projects') as projects, \
            patch(f'{VIEW_MODULE}.ProjectConnections') as connections, \
            patch(f'{VIEW_MODULE}.check_project_permission', return_value=True) as permission, \
            patch(f'{VIEW_MODULE}.GitHubSeaDBAPI') as github_api, \
            patch.object(ProjectConnectionStatisticsView, 'throttle_classes', ()):
        projects.objects.get_project_by_uuid.return_value = SimpleNamespace(
            workspace=SimpleNamespace(owner='owner@example.com'),
        )
        connections.objects.get_connection_in_project_by_id.return_value = make_connection()
        statistics = github_api.return_value.get_issue_statistics
        statistics.return_value = {'total': 3}
        yield SimpleNamespace(
            projects=projects, connections=connections, permission=permission, statistics=statistics,
            github_api=github_api,
        )


def call_endpoint(factory, user):
    request = factory.get(f'/api/v1/project/{PROJECT_UUID}/connections/7/statistics/')
    force_authenticate(request, user=user)
    return ProjectConnectionStatisticsView.as_view()(
        request, project_uuid=PROJECT_UUID, connection_id='7',
    )


def test_statistics_route():
    match = resolve(f'/api/v1/project/{PROJECT_UUID}/connections/7/statistics/')
    assert match.url_name == 'api-v1-connection-statistics'
    assert match.kwargs == {'project_uuid': PROJECT_UUID, 'connection_id': '7'}
    assert match.func.view_class is ProjectConnectionStatisticsView
    assert ProjectConnectionStatisticsView.__module__ == VIEW_MODULE


def test_endpoint_returns_statistics_for_project_readers(factory, user, endpoint_mocks):
    response = call_endpoint(factory, user)
    assert response.status_code == 200
    assert response.data['total'] == 3
    assert 'supported' not in response.data
    assert 'state' not in response.data
    assert 'timezone' not in response.data
    assert 'range_start' not in response.data
    assert 'range_end' not in response.data
    assert 'last_sync_time' not in response.data
    endpoint_mocks.connections.objects.get_connection_in_project_by_id.assert_called_once_with(
        PROJECT_UUID, '7',
    )
    endpoint_mocks.github_api.assert_called_once_with(PROJECT_UUID)
    endpoint_mocks.statistics.assert_called_once_with(7)


@pytest.mark.parametrize('connection_type', [
    connection_type.value for connection_type in ConnectionType
    if connection_type != ConnectionType.GITHUB_ISSUE
])
def test_endpoint_rejects_non_github_connections(factory, user, endpoint_mocks, connection_type):
    endpoint_mocks.connections.objects.get_connection_in_project_by_id.return_value = make_connection(
        connection_type,
    )
    response = call_endpoint(factory, user)
    assert response.status_code == 400
    assert response.data['error_msg'] == 'Connection type does not support statistics.'
    endpoint_mocks.github_api.assert_not_called()
    endpoint_mocks.statistics.assert_not_called()


def test_endpoint_rejects_missing_project(factory, user, endpoint_mocks):
    endpoint_mocks.projects.objects.get_project_by_uuid.return_value = None
    assert call_endpoint(factory, user).status_code == 404
    endpoint_mocks.statistics.assert_not_called()


def test_endpoint_rejects_non_members(factory, user, endpoint_mocks):
    endpoint_mocks.permission.return_value = False
    assert call_endpoint(factory, user).status_code == 403
    endpoint_mocks.statistics.assert_not_called()


def test_endpoint_rejects_deleted_or_foreign_connections(factory, user, endpoint_mocks):
    endpoint_mocks.connections.objects.get_connection_in_project_by_id.return_value = None
    assert call_endpoint(factory, user).status_code == 404
    endpoint_mocks.statistics.assert_not_called()


def test_endpoint_rejects_non_org_context(factory, no_org_user, endpoint_mocks):
    assert call_endpoint(factory, no_org_user).status_code == 403
    endpoint_mocks.statistics.assert_not_called()


def test_endpoint_rejects_anonymous_users(factory, endpoint_mocks):
    assert call_endpoint(factory, None).status_code in (401, 403)
    endpoint_mocks.statistics.assert_not_called()


def test_endpoint_reports_backend_failure(factory, user, endpoint_mocks):
    endpoint_mocks.statistics.side_effect = ConnectionError('SeaDB unavailable')
    assert call_endpoint(factory, user).status_code == 500

import datetime
import sqlite3
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from django.urls import resolve
from rest_framework.test import force_authenticate

from seahub.project.connections import ProjectConnectionStatisticsView
from seahub.project.constants import ConnectionType
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI, ISSUE_STATISTICS_MONTHS

PROJECT_UUID = '12345678-1234-1234-1234-1234567890ab'
NOW = datetime.datetime(2026, 10, 12, 6, 0, tzinfo=datetime.timezone.utc)
VIEW_MODULE = 'seahub.project.connections'
DATA_MODULE = 'seahub.seadb_models.github_seadb_api'


def instant(value):
    return datetime.datetime.fromisoformat(value).timestamp()


def make_connection(connection_type='github_issue', connection_id=7):
    return SimpleNamespace(id=connection_id, type=connection_type)


def type_column(options=None):
    return {
        'name': 'issue_type',
        'data': {'options': options if options is not None else [
            {'name': 'Bug'}, {'name': 'Feature'}, {'name': 'Question'},
        ]},
    }


def make_seadb(connection_type='github_issue', rows=None, options=None):
    api = MagicMock()
    column = type_column(options)
    api.get_base_metadata.return_value = {
        'tables': [{'name': f'{connection_type}_7', 'columns': [column]}],
    }
    api.query_rows.return_value = {
        'success': True,
        'results': rows or [],
        'metadata': [column, {'name': 'count'}],
    }
    return api


def get_statistics(seadb_api, timezone_name='UTC'):
    return GitHubSeaDBAPI(PROJECT_UUID, seadb_api=seadb_api).get_issue_statistics(
        7, ZoneInfo(timezone_name),
    )


@pytest.fixture
def frozen_now():
    with patch(f'{DATA_MODULE}.timezone.now', return_value=NOW):
        yield


@pytest.fixture
def sql_seadb():
    """Execute the generated SQL against in-memory SQLite with SeaDB's formula functions.

    SQLite runs the statement as-is (backtick quoting, GROUP BY on an output alias), so
    this exercises the real month classification instead of asserting on the SQL text.
    ISOMONTH is registered only so a test can prove the query never calls it.
    """
    connections = []

    def create(records, server_timezone='UTC'):
        db = sqlite3.connect(':memory:')
        connections.append(db)
        db.row_factory = sqlite3.Row
        db.execute(
            'CREATE TABLE github_issue_7 (created_time REAL, issue_type TEXT, deleted BOOLEAN)',
        )
        db.executemany(
            'INSERT INTO github_issue_7 VALUES (?, ?, ?)',
            [
                (instant(created_time), issue_type, deleted)
                for created_time, issue_type, deleted in records
            ],
        )

        def dateadd(value, amount, unit):
            assert unit == 'seconds'
            return instant(value) + amount

        db.create_function('DATEADD', 3, dateadd)
        db.create_function('TRUE', 0, lambda: True)
        db.create_function('IFS', -1, lambda *args: next((
            args[index + 1] for index in range(0, len(args) - 1, 2) if args[index]
        ), None))
        server_month = MagicMock(side_effect=lambda value: datetime.datetime.fromtimestamp(
            value, ZoneInfo(server_timezone),
        ).strftime('%Y-%m'))
        db.create_function('ISOMONTH', 1, server_month)

        api = make_seadb()
        column = type_column()

        def query_rows(_base_id, sql, params=None):
            # SeaDB compares a datetime column against a string parameter by parsing the
            # parameter into an instant, so the bounds are timezone independent.
            return {
                'success': True,
                'metadata': [column, {'name': 'count'}],
                'results': [dict(row) for row in db.execute(sql, [instant(p) for p in params])],
            }

        api.query_rows.side_effect = query_rows
        return api, server_month

    yield create
    for db in connections:
        db.close()


# (viewer timezone, now, records, expected counts per bucket label). Each case pins
# boundaries to the second: the instant just before and just after a month starts, the
# window's own edges, and a deleted row.
MONTH_BUCKET_CASES = [
    (
        'Asia/Shanghai', '2026-09-30T17:00:00+00:00',
        [
            ('2025-10-31T15:59:59+00:00', 'Bug', False),
            ('2025-10-31T16:00:00+00:00', 'Bug', False),
            ('2026-09-30T15:59:59+00:00', 'Bug', False),
            ('2026-09-30T16:00:00+00:00', 'Bug', False),
            ('2026-09-30T16:30:00+00:00', 'Bug', None),
            ('2026-09-30T16:45:00+00:00', 'Bug', True),
            ('2026-09-30T17:00:00+00:00', 'Bug', False),
        ],
        {'2025-11': 1, '2026-09': 1, '2026-10': 2},
    ),
    (
        'America/Los_Angeles', '2026-10-01T00:30:00+00:00',
        [
            ('2025-10-01T06:59:59+00:00', 'Bug', False),
            ('2025-10-01T07:00:00+00:00', 'Bug', False),
            ('2026-09-01T06:59:59+00:00', 'Bug', False),
            ('2026-09-01T07:00:00+00:00', 'Bug', False),
            ('2026-10-01T00:00:00+00:00', 'Bug', False),
            ('2026-10-01T00:30:00+00:00', 'Bug', False),
        ],
        {'2025-10': 1, '2026-08': 1, '2026-09': 2},
    ),
    (
        # Spring forward: 2026-03-08 02:00 PST becomes 03:00 PDT.
        'America/Los_Angeles', '2026-03-16T06:00:00+00:00',
        [
            ('2026-03-01T07:30:00+00:00', 'Bug', False),
            ('2026-03-01T08:00:00+00:00', 'Bug', False),
            ('2026-03-08T09:59:59+00:00', 'Bug', False),
            ('2026-03-08T10:00:00+00:00', 'Bug', False),
        ],
        {'2026-02': 1, '2026-03': 3},
    ),
    (
        # Fall back: 2026-11-01 02:00 PDT becomes 01:00 PST.
        'America/Los_Angeles', '2026-11-16T06:00:00+00:00',
        [
            ('2026-11-01T06:59:59+00:00', 'Bug', False),
            ('2026-11-01T07:00:00+00:00', 'Bug', False),
            ('2026-11-01T08:30:00+00:00', 'Bug', False),
            ('2026-11-01T09:30:00+00:00', 'Bug', False),
        ],
        {'2026-10': 1, '2026-11': 3},
    ),
    (
        # UTC+14, so the viewer's new year starts ten hours before UTC's.
        'Pacific/Kiritimati', '2025-12-31T10:30:00+00:00',
        [
            ('2024-12-31T10:30:00+00:00', 'Bug', False),
            ('2025-12-31T09:59:59+00:00', 'Bug', False),
            ('2025-12-31T10:00:00+00:00', 'Bug', False),
        ],
        {'2025-12': 1, '2026-01': 1},
    ),
]


@pytest.mark.parametrize('server_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
@pytest.mark.parametrize('user_timezone, now, records, expected', MONTH_BUCKET_CASES)
def test_month_buckets_follow_the_viewer_timezone(
    sql_seadb, user_timezone, server_timezone, now, records, expected,
):
    api, server_month = sql_seadb(records, server_timezone)
    with patch(f'{DATA_MODULE}.timezone.now', return_value=datetime.datetime.fromisoformat(now)):
        result = get_statistics(api, user_timezone)

    counts = next(item['counts'] for item in result['series'] if item['issue_type'] == 'Bug')
    actual = {month: count for month, count in zip(result['months'], counts) if count}

    assert actual == expected
    assert result['total'] == sum(expected.values())
    assert result['total'] == sum(sum(item['counts']) for item in result['series'])
    assert len(result['months']) == ISSUE_STATISTICS_MONTHS
    assert result['months'][-1] == datetime.datetime.fromisoformat(now).astimezone(
        ZoneInfo(user_timezone),
    ).strftime('%Y-%m')
    assert set(result) == {'connection_id', 'months', 'series', 'total'}
    api.query_rows.assert_called_once()
    api.get_base_metadata.assert_not_called()
    # The whole point: the buckets do not depend on the SeaDB server's timezone.
    server_month.assert_not_called()


def test_months_are_the_viewers_local_calendar_months():
    api = make_seadb()
    local_now = datetime.datetime(
        2026, 11, 1, 0, 30, tzinfo=datetime.timezone(datetime.timedelta(hours=8)),
    )
    with patch(f'{DATA_MODULE}.timezone.now', return_value=local_now):
        result = get_statistics(api, 'Asia/Shanghai')
    # 00:30 on Nov 1 in UTC+8 is still Oct 31 in UTC, but the viewer's calendar says
    # November, and the viewer's calendar is what the chart is labelled with.
    assert result['months'][-1] == '2026-11'
    assert api.query_rows.call_args.kwargs['params'] == [
        '2025-11-30T16:00:00+00:00', '2026-10-31T16:30:00+00:00',
    ]

    with patch(f'{DATA_MODULE}.timezone.now', return_value=local_now):
        utc_result = get_statistics(api, 'UTC')
    assert utc_result['months'][-1] == '2026-10'


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
    assert 'GROUP BY `month`, `issue_type`' in args[1]
    assert 'ISOMONTH' not in args[1]
    assert 'state' not in args[1]
    assert kwargs['params'] == [
        '2025-11-01T00:00:00+00:00', '2026-10-12T06:00:00+00:00',
    ]
    api.query_rows.assert_called_once()


def test_bucket_boundaries_are_inlined_and_never_bound_as_parameters(frozen_now):
    api = make_seadb()
    get_statistics(api)
    sql = api.query_rows.call_args.args[1]

    # Only the two window bounds are bound. A `?` inside a formula reaches the formula
    # layer as a string, where comparing it against a datetime column fails the kind
    # check and evaluates to NULL in silence, so the boundaries must be inlined and
    # wrapped in DATEADD to become timestamp values.
    assert sql.count('?') == 2
    assert "`created_time` >= DATEADD('2026-09-01T00:00:00+00:00', 0, 'seconds')" in sql
    assert "'2026-09'" in sql


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


def test_every_issue_type_in_a_month_is_counted(frozen_now):
    api = make_seadb(rows=[
        {'month': '2026-10', 'issue_type': f'Type {index}', 'count': 1}
        for index in range(50)
    ] + [{'month': '2026-10', 'issue_type': 'Final type', 'count': 7}])
    result = get_statistics(api)
    assert result['total'] == 57
    api.query_rows.assert_called_once()
    api.get_base_metadata.assert_not_called()


def test_empty_type_options_are_valid_and_keep_unclassified_series(frozen_now):
    api = make_seadb(options=[])
    result = get_statistics(api)
    assert result['series'] == [{'issue_type': None, 'counts': [0] * 12}]
    api.get_base_metadata.assert_not_called()


@pytest.mark.parametrize('metadata', [None, [], [{'name': 'count'}]])
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


def call_endpoint(factory, user, **params):
    request = factory.get(f'/api/v1/project/{PROJECT_UUID}/connections/7/statistics/', data=params)
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
    endpoint_mocks.statistics.assert_called_once_with(7, ZoneInfo('UTC'))


def test_endpoint_uses_the_browser_timezone(factory, user, endpoint_mocks):
    response = call_endpoint(factory, user, timezone='Asia/Shanghai')
    assert response.status_code == 200
    endpoint_mocks.statistics.assert_called_once_with(7, ZoneInfo('Asia/Shanghai'))


@pytest.mark.parametrize('timezone_name', ['', 'UTC'])
def test_blank_timezone_is_treated_as_not_provided(factory, user, endpoint_mocks, timezone_name):
    response = call_endpoint(factory, user, timezone=timezone_name)
    assert response.status_code == 200
    endpoint_mocks.statistics.assert_called_once_with(7, ZoneInfo('UTC'))


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

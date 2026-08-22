import pytest
from django.test import RequestFactory

from seahub.project.connections import (
    _parse_connection_config,
    _restore_firebase_crash_ticket_links,
    _sync_firebase_crash_ticket_link,
    _validate_firebase_crash_batch_record,
)
from seahub.project.firebase_crash_api import FirebaseCrashOAuthAPI, FirebaseCrashOAuthError
from seahub.project import views


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self.payload = payload
        self.text = str(payload)

    def json(self):
        return self.payload


def test_parse_connection_config_accepts_dict_and_json_object():
    config = {'project_id': 'firebase-project'}

    assert _parse_connection_config(config) is config
    assert _parse_connection_config('{"project_id": "firebase-project"}') == config


@pytest.mark.parametrize('value', ['', '{', '[]', 'null', None, 1])
def test_parse_connection_config_rejects_invalid_values(value):
    with pytest.raises(ValueError, match='config invalid'):
        _parse_connection_config(value)


def test_lists_all_firebase_projects_and_sorts_by_name(monkeypatch):
    responses = [
        FakeResponse(
            200,
            {
                'results': [
                    {'projectId': 'z-project', 'displayName': 'Zeta'},
                ],
                'nextPageToken': 'second-page',
            },
        ),
        FakeResponse(
            200,
            {
                'results': [
                    {'projectId': 'a-project', 'displayName': 'Alpha'},
                ],
            },
        ),
    ]
    calls = []

    def fake_get(url, headers, params, timeout):
        calls.append((url, params))
        return responses.pop(0)

    monkeypatch.setattr('seahub.project.firebase_crash_api.requests.get', fake_get)

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    assert api.list_projects() == [
        {'project_id': 'a-project', 'name': 'Alpha'},
        {'project_id': 'z-project', 'name': 'Zeta'},
    ]
    assert calls[1][1]['pageToken'] == 'second-page'


@pytest.mark.parametrize(
    ('method_name', 'args'),
    [
        ('list_projects', ()),
        ('list_datasets', ('firebase-project',)),
        ('_list_dataset_tables', ('firebase-project', 'firebase_crashlytics')),
    ],
)
def test_rejects_repeated_page_tokens(monkeypatch, method_name, args):
    responses = [
        FakeResponse(200, {'nextPageToken': 'same-token'}),
        FakeResponse(200, {'nextPageToken': 'same-token'}),
    ]
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *request_args, **request_kwargs: responses.pop(0),
    )

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    with pytest.raises(FirebaseCrashOAuthError, match='repeated page token'):
        getattr(api, method_name)(*args)


def test_refreshes_token_after_unauthorized_bigquery_request(monkeypatch):
    get_responses = [
        FakeResponse(401, {}),
        FakeResponse(
            200,
            {
                'datasets': [
                    {
                        'datasetReference': {'datasetId': 'other'},
                        'friendlyName': 'Other dataset',
                    },
                    {
                        'datasetReference': {'datasetId': 'firebase_crashlytics'},
                    },
                ],
            },
        ),
    ]

    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *args, **kwargs: get_responses.pop(0),
    )
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.post',
        lambda *args, **kwargs: FakeResponse(
            200,
            {'access_token': 'new-access-token', 'expires_in': 3600},
        ),
    )
    monkeypatch.setattr('seahub.project.firebase_crash_api.FIREBASE_CRASH_CLIENT_ID', 'client-id')
    monkeypatch.setattr('seahub.project.firebase_crash_api.FIREBASE_CRASH_CLIENT_SECRET', 'client-secret')

    api = FirebaseCrashOAuthAPI('expired-token', 'refresh-token')

    assert api.list_datasets('firebase-project') == [
        {'dataset_id': 'firebase_crashlytics', 'name': 'firebase_crashlytics'},
        {'dataset_id': 'other', 'name': 'Other dataset'},
    ]
    assert api.access_token == 'new-access-token'
    assert api.tokens_updated is True


def test_validates_dataset_contains_crashlytics_export_table(monkeypatch):
    responses = [
        FakeResponse(200, {'projectId': 'firebase-project'}),
        FakeResponse(200, {'datasetReference': {'datasetId': 'firebase_crashlytics'}}),
        FakeResponse(
            200,
            {
                'tables': [
                    {
                        'type': 'TABLE',
                        'tableReference': {'tableId': 'com_example_app_ANDROID'},
                    },
                ],
            },
        ),
        FakeResponse(
            200,
            {
                'schema': {
                    'fields': [
                        {'name': 'event_id'},
                        {'name': 'issue_id'},
                        {'name': 'event_timestamp'},
                        {'name': 'error_type'},
                        {'name': 'bundle_identifier'},
                        {'name': 'platform'},
                        {'name': 'exceptions', 'fields': [{'name': 'exception_message'}]},
                    ],
                },
            },
        ),
    ]
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *args, **kwargs: responses.pop(0),
    )

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    assert api.validate_connection_config('firebase-project', 'firebase_crashlytics') is None


def test_rejects_dataset_without_crashlytics_export_table(monkeypatch):
    responses = [
        FakeResponse(200, {'projectId': 'firebase-project'}),
        FakeResponse(200, {'datasetReference': {'datasetId': 'other_dataset'}}),
        FakeResponse(200, {'tables': [{'tableReference': {'tableId': 'events_20260819'}}]}),
    ]
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *args, **kwargs: responses.pop(0),
    )

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    try:
        api.validate_connection_config('firebase-project', 'other_dataset')
    except Exception as exc:
        assert 'does not contain Firebase Crashlytics export tables' in str(exc)
    else:
        raise AssertionError('Expected invalid Crashlytics dataset validation to fail.')


def test_accepts_hyphenated_ios_crashlytics_table(monkeypatch):
    responses = [
        FakeResponse(200, {'projectId': 'firebase-project'}),
        FakeResponse(200, {'datasetReference': {'datasetId': 'firebase_crashlytics'}}),
        FakeResponse(
            200,
            {
                'tables': [
                    {
                        'type': 'TABLE',
                        'tableReference': {'tableId': 'com_example_my-app_IOS'},
                    },
                ],
            },
        ),
        FakeResponse(
            200,
            {
                'schema': {
                    'fields': [
                        {'name': 'event_id'},
                        {'name': 'issue_id'},
                        {'name': 'event_timestamp'},
                        {'name': 'error_type'},
                        {'name': 'bundle_identifier'},
                        {'name': 'platform'},
                        {'name': 'error', 'fields': [{'name': 'title'}]},
                    ],
                },
            },
        ),
    ]
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *args, **kwargs: responses.pop(0),
    )

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    assert api.validate_connection_config('firebase-project', 'firebase_crashlytics') is None


def test_rejects_invalid_resource_ids_without_api_calls(monkeypatch):
    def fail_get(*args, **kwargs):
        raise AssertionError('invalid IDs must be rejected before making requests')

    monkeypatch.setattr('seahub.project.firebase_crash_api.requests.get', fail_get)
    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    with pytest.raises(FirebaseCrashOAuthError, match='project ID is invalid'):
        api.list_datasets('bad')
    with pytest.raises(FirebaseCrashOAuthError, match='dataset ID is invalid'):
        api.validate_connection_config('firebase-project', 'bad-dataset')


def test_accepts_dataset_with_unmapped_crashlytics_tables(monkeypatch):
    responses = [
        FakeResponse(200, {'projectId': 'firebase-project'}),
        FakeResponse(200, {'datasetReference': {'datasetId': 'firebase_crashlytics'}}),
        FakeResponse(
            200,
            {
                'tables': [
                    {
                        'type': 'TABLE',
                        'tableReference': {'tableId': 'com_example_unknown_ANDROID'},
                    },
                ],
            },
        ),
        FakeResponse(
            200,
            {
                'schema': {
                    'fields': [
                        {'name': 'event_id'},
                        {'name': 'issue_id'},
                        {'name': 'event_timestamp'},
                        {'name': 'error_type'},
                    ],
                },
            },
        ),
    ]
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *args, **kwargs: responses.pop(0),
    )

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    assert api.validate_connection_config('firebase-project', 'firebase_crashlytics') is None


def test_ignores_views_and_realtime_tables(monkeypatch):
    responses = [
        FakeResponse(200, {'projectId': 'firebase-project'}),
        FakeResponse(200, {'datasetReference': {'datasetId': 'firebase_crashlytics'}}),
        FakeResponse(
            200,
            {
                'tables': [
                    {
                        'type': 'VIEW',
                        'tableReference': {'tableId': 'com_example_app_ANDROID'},
                    },
                    {
                        'type': 'TABLE',
                        'tableReference': {'tableId': 'com_example_app_ANDROID_REALTIME'},
                    },
                ],
            },
        ),
    ]
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *args, **kwargs: responses.pop(0),
    )

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    with pytest.raises(FirebaseCrashOAuthError, match='does not contain Firebase Crashlytics export tables'):
        api.validate_connection_config('firebase-project', 'firebase_crashlytics')


def test_validates_firebase_crash_batch_record_shape():
    assert _validate_firebase_crash_batch_record(None)
    assert _validate_firebase_crash_batch_record({'row': {}})
    assert _validate_firebase_crash_batch_record({'row_id': 0, 'row': {}})
    assert _validate_firebase_crash_batch_record({'row_id': 'not-an-int', 'row': {}})
    assert _validate_firebase_crash_batch_record({'row_id': 1, 'row': []})
    assert _validate_firebase_crash_batch_record({'row_id': 1, 'row': {}}) is None


def test_invalid_firebase_crash_oauth_state_clears_session(monkeypatch):
    request = RequestFactory().get('/project/firebase-crash/oauth/callback/?state=wrong')
    request.session = {
        'firebase_crash_oauth_state': 'expected',
        'firebase_crash_oauth_project_uuid': 'project',
        'firebase_crash_oauth_return_to': '/connections/',
    }
    monkeypatch.setattr(
        views,
        'render_error',
        lambda request, message: message,
    )

    response = views.firebase_crash_oauth_callback.__wrapped__(request)

    assert 'Invalid Firebase Crashlytics OAuth state' in response
    assert request.session == {
        'firebase_crash_oauth_error': 'Google authorization was cancelled or failed.'
    }


def test_firebase_crash_ticket_link_same_ticket_is_a_noop():
    class FailingSeaDB:
        def update_rows(self, *args, **kwargs):
            raise AssertionError('same-ticket updates must not write')

    assert _sync_firebase_crash_ticket_link(
        FailingSeaDB(), 'project', 1, 2, 7, 7
    ) == []
    assert _sync_firebase_crash_ticket_link(
        FailingSeaDB(), 'project', 1, 2, None, None
    ) == []


def test_restores_firebase_crash_ticket_links_in_reverse_order():
    class FakeSeaDB:
        def __init__(self):
            self.updates = []

        def update_rows(self, project_uuid, table_name, rows):
            self.updates.append((project_uuid, table_name, rows))

    seadb = FakeSeaDB()
    _restore_firebase_crash_ticket_links(
        seadb,
        'project',
        [(20, ['record-2']), (10, ['record-1'])],
    )

    assert [update[2][0]['pk'] for update in seadb.updates] == [10, 20]

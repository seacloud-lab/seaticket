import pytest
from django.test import RequestFactory

from seahub.project.firebase_crash_api import FirebaseCrashOAuthAPI, FirebaseCrashOAuthError
from seahub.project import views


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self.payload = payload
        self.text = str(payload)

    def json(self):
        return self.payload


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


def test_lists_firebase_apps_across_platforms_and_sorts(monkeypatch):
    responses = [
        FakeResponse(
            200,
            {
                'apps': [
                    {'appId': '1:1:android:aaa', 'packageName': 'com.zeta', 'displayName': 'Zeta'},
                ],
            },
        ),
        FakeResponse(
            200,
            {
                'apps': [
                    {'appId': '1:1:ios:bbb', 'bundleId': 'com.alpha', 'displayName': 'Alpha'},
                ],
            },
        ),
    ]
    monkeypatch.setattr(
        'seahub.project.firebase_crash_api.requests.get',
        lambda *args, **kwargs: responses.pop(0),
    )

    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    assert api.list_apps('firebase-project') == [
        {'app_id': '1:1:ios:bbb', 'name': 'Alpha', 'platform': 'IOS', 'identifier': 'com.alpha'},
        {'app_id': '1:1:android:aaa', 'name': 'Zeta', 'platform': 'ANDROID', 'identifier': 'com.zeta'},
    ]


@pytest.mark.parametrize(
    ('method_name', 'args'),
    [
        ('list_projects', ()),
        ('list_apps', ('firebase-project',)),
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


def test_rejects_invalid_project_id_without_api_calls(monkeypatch):
    def fail_get(*args, **kwargs):
        raise AssertionError('invalid IDs must be rejected before making requests')

    monkeypatch.setattr('seahub.project.firebase_crash_api.requests.get', fail_get)
    api = FirebaseCrashOAuthAPI('access-token', 'refresh-token')

    with pytest.raises(FirebaseCrashOAuthError, match='project ID is invalid'):
        api.list_apps('bad')


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

from unittest.mock import Mock, patch

from seahub.project.jira_api import JiraAPI
from seahub.project.linear_api import LinearAPI


def test_jira_request_refreshes_and_retries_unauthorized():
    unauthorized = Mock(status_code=401)
    success = Mock(status_code=200)
    success.raise_for_status.return_value = None
    api = JiraAPI('access', 'refresh', None)

    with patch('seahub.project.jira_api.requests.request', side_effect=[unauthorized, success]) as request_mock, \
            patch.object(api, 'refresh_access_token') as refresh_mock:
        response = api._request('GET', 'https://example.invalid')

    assert response is success
    refresh_mock.assert_called_once_with()
    assert request_mock.call_count == 2


def _jira_token_response():
    response = Mock(status_code=200)
    response.raise_for_status.return_value = None
    response.json.return_value = {
        'access_token': 'access-new', 'refresh_token': 'refresh-new', 'expires_in': 3600,
    }
    return response


def test_jira_stores_rotated_token_even_when_the_retried_request_fails():
    unauthorized = Mock(status_code=401)
    unauthorized.raise_for_status.side_effect = RuntimeError('401 Client Error')
    stored = []
    api = JiraAPI('access-old', 'refresh-old', None, on_token_refreshed=stored.append)

    with patch('seahub.project.jira_api.requests.request', return_value=unauthorized), \
            patch('seahub.project.jira_api.requests.post', return_value=_jira_token_response()):
        try:
            api._request('POST', 'https://example.invalid')
        except RuntimeError:
            pass
        else:
            raise AssertionError('Expected the retried request to fail')

    assert stored[0]['access_token'] == 'access-new'
    assert stored[0]['refresh_token'] == 'refresh-new'


def test_jira_request_survives_a_failing_token_store():
    unauthorized = Mock(status_code=401)
    success = Mock(status_code=200)
    success.raise_for_status.return_value = None
    api = JiraAPI('access-old', 'refresh-old', None, on_token_refreshed=Mock(side_effect=RuntimeError('db down')))

    with patch('seahub.project.jira_api.requests.request', side_effect=[unauthorized, success]), \
            patch('seahub.project.jira_api.requests.post', return_value=_jira_token_response()):
        response = api._request('GET', 'https://example.invalid')

    assert response is success


def test_jira_create_issue_builds_adf_and_fetches_created_issue():
    create_response = Mock()
    create_response.json.return_value = {'id': '101', 'key': 'SEA-1'}
    api = JiraAPI('access', 'refresh', None)

    with patch.object(api, '_request', return_value=create_response) as request_mock, \
            patch.object(api, 'get_issue', return_value={'id': '101'}) as get_issue_mock:
        issue = api.create_issue('site', 'SEA', 'Title', 'Line 1\nLine 2', '10001')

    assert issue == {'id': '101'}
    payload = request_mock.call_args.kwargs['json']
    assert payload['fields']['description']['type'] == 'doc'
    assert len(payload['fields']['description']['content']) == 2
    get_issue_mock.assert_called_once_with('site', 'SEA-1')


def test_linear_create_issue_refreshes_and_uses_remote_ids():
    unauthorized = Mock(status_code=401)
    success = Mock(status_code=200)
    success.raise_for_status.return_value = None
    success.json.return_value = {
        'data': {
            'issueCreate': {
                'success': True,
                'issue': {'id': 'issue-1', 'identifier': 'SEA-1'},
            }
        }
    }
    api = LinearAPI('access', 'refresh')

    with patch('seahub.project.linear_api.requests.post', side_effect=[unauthorized, success]) as post_mock, \
            patch.object(api, 'refresh_access_token') as refresh_mock:
        issue = api.create_issue(
            'team', 'Title', 'Body', state_id='state', priority=2,
            assignee_id='user', label_ids=['label'], due_date='2026-01-02',
        )

    assert issue['id'] == 'issue-1'
    refresh_mock.assert_called_once_with()
    variables = post_mock.call_args.kwargs['json']['variables']
    assert variables['input'] == {
        'teamId': 'team', 'title': 'Title', 'description': 'Body',
        'stateId': 'state', 'priority': 2, 'assigneeId': 'user',
        'labelIds': ['label'], 'dueDate': '2026-01-02',
    }


def test_linear_graphql_errors_are_raised():
    response = Mock(status_code=200)
    response.raise_for_status.return_value = None
    response.json.return_value = {'errors': [{'message': 'not allowed'}]}
    api = LinearAPI('access', 'refresh')

    with patch('seahub.project.linear_api.requests.post', return_value=response):
        try:
            api.list_users('team')
        except RuntimeError as error:
            assert str(error) == 'not allowed'
        else:
            raise AssertionError('Expected Linear GraphQL error')

from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.http import HttpResponse
from django.utils import timezone

from seahub.project.models import ProjectGithubAppInstallation
from seahub.project.github_issues_api import validate_github_connection_config
from seahub.project.utils import create_connection
from seahub.project.views import github_install, github_installation_setup, github_oauth_callback


@pytest.fixture(autouse=True)
def github_settings(monkeypatch):
    monkeypatch.setattr('seahub.project.views.settings.GITHUB_CLIENT_ID', 'client-id')
    monkeypatch.setattr('seahub.project.views.settings.GITHUB_CLIENT_SECRET', 'client-secret')
    monkeypatch.setattr('seahub.project.views.settings.GITHUB_APP_ID', '7')


@pytest.fixture
def github_request(factory, project_creator, real_project):
    def make_request(params=None, stage='install'):
        request = factory.get('/github/installation-setup/', params or {'state': 'test-state', 'installation_id': '42'})
        request.user = project_creator
        request.session = {'github_installation_request': {
            'state': 'test-state', 'stage': stage, 'project_uuid': str(real_project.uuid),
            'username': project_creator.username, 'created_at': timezone.now().timestamp(),
            'return_url': '/connections/', 'installation_id': '42',
            'callback_url': 'https://testserver/github/oauth/callback/', 'code_verifier': 'verifier',
        }}
        return request
    return make_request


def test_install_uses_session_bound_random_state_and_safe_redirect(factory, project_creator, real_project):
    request = factory.get('/github/install/', {'project_uuid': str(real_project.uuid), 'next': 'https://evil.example/'})
    request.user = project_creator
    request.session = {}

    response = github_install(request)

    assert response.status_code == 302
    data = request.session['github_installation_request']
    assert data['return_url'] == '/'
    assert data['username'] == project_creator.username
    assert parse_qs(urlparse(response.url).query)['state'] == [data['state']]
    assert len(data['state']) >= 32


@pytest.mark.parametrize('invalid', ['state', 'user', 'expired', 'permission'])
def test_setup_rejects_invalid_transaction(github_request, invalid):
    request = github_request()
    data = request.session['github_installation_request']
    if invalid == 'state':
        data['state'] = 'different'
    elif invalid == 'user':
        data['username'] = 'other-user'
    elif invalid == 'expired':
        data['created_at'] -= 601
    with patch('seahub.project.views.check_project_admin_permission', return_value=invalid != 'permission'), \
            patch('seahub.project.views.render', return_value=HttpResponse(status=403)):
        response = github_installation_setup(request)
    assert response.status_code == 403
    assert not ProjectGithubAppInstallation.objects.exists()


def test_existing_installation_is_trusted_without_reauthorizing(github_request, real_project, project_creator):
    ProjectGithubAppInstallation.objects.create_app_installation(str(real_project.uuid), '42', project_creator.username)
    request = github_request()

    response = github_installation_setup(request)

    assert response.status_code == 302
    assert response.url.startswith('https://github.com/login/oauth/authorize?')
    assert request.session['github_installation_request']['stage'] == 'authorize'
    assert 'code_challenge=' in response.url
    assert request.session['github_installation_request']['state'] != 'test-state'


def test_existing_project_installation_does_not_repeat_oauth(github_request, real_project, project_creator):
    ProjectGithubAppInstallation.objects.create(
        project_uuid=str(real_project.uuid), installation_id='42', creator=project_creator.username,
        modifier=project_creator.username,
    )
    request = github_request()
    with patch('seahub.project.views.OAuth2Session') as oauth:
        response = github_installation_setup(request)
    assert response.url == '/connections/'
    oauth.assert_not_called()
    assert 'github_installation_request' not in request.session


@pytest.mark.parametrize('installation', [
    {'id': 42, 'app_id': 7, 'suspended_at': None},
    {'id': 99, 'app_id': 7, 'suspended_at': None},
    {'id': 42, 'app_id': 8, 'suspended_at': None},
    {'id': 42, 'app_id': 7, 'suspended_at': '2026-01-01'},
])
def test_callback_only_binds_user_accessible_installation(github_request, real_project, installation):
    allowed = installation == {'id': 42, 'app_id': 7, 'suspended_at': None}
    request = github_request({'state': 'test-state', 'code': 'code'}, stage='authorize')
    oauth = Mock()
    oauth.fetch_token.return_value = {'access_token': 'user-token'}
    installations_response = Mock()
    installations_response.json.return_value = {'installations': [installation]}
    with patch('seahub.project.views.OAuth2Session', return_value=oauth), \
            patch('seahub.project.views.requests.get', return_value=installations_response), \
            patch('seahub.project.views.render', return_value=HttpResponse(status=403)):
        response = github_oauth_callback(request)
    assert 'github_installation_request' not in request.session
    oauth.fetch_token.assert_called_once()
    assert oauth.fetch_token.call_args.kwargs['code_verifier'] == 'verifier'
    if allowed:
        assert response.url == '/connections/'
        binding = ProjectGithubAppInstallation.objects.get_project_installation(str(real_project.uuid), '42')
        assert binding.creator
    else:
        assert response.status_code == 403
        assert not ProjectGithubAppInstallation.objects.exists()


def test_callback_cannot_replay_without_transaction(github_request):
    request = github_request({'state': 'test-state', 'code': 'code'}, stage='authorize')
    request.session.clear()
    with patch('seahub.project.views.OAuth2Session') as oauth, \
            patch('seahub.project.views.render', return_value=HttpResponse(status=403)):
        response = github_oauth_callback(request)
    assert response.status_code == 403
    oauth.assert_not_called()


def test_repository_config_requires_project_authorization(real_project, project_creator):
    ProjectGithubAppInstallation.objects.create(
        project_uuid=str(real_project.uuid), installation_id='42', creator=project_creator.username,
        modifier=project_creator.username,
    )
    config = {'installation_id': '42', 'repository': 'https://github.com/acme/repo'}
    with patch('seahub.project.github_issues_api.GitHubAPI') as api:
        api.return_value.get_installation_repositories.return_value = [{'html_url': config['repository']}]
        assert validate_github_connection_config(real_project.uuid, config) == config
        with pytest.raises(ValueError):
            validate_github_connection_config('another-project', config)
        with pytest.raises(ValueError):
            validate_github_connection_config(real_project.uuid, {**config, 'repository': 'https://github.com/other/repo'})


def test_generic_connection_creation_cannot_bypass_authorization(real_project, project_creator):
    with patch('seahub.project.models.ProjectConnections.objects.create') as create:
        record, error = create_connection(
            real_project, project_creator.username, 'github_issue', 'repo',
            {'installation_id': '42', 'repository': 'https://github.com/acme/repo'},
        )
    assert record is None
    assert error.status_code == 403
    create.assert_not_called()

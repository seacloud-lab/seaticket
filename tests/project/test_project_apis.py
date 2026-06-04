import datetime
from unittest.mock import Mock, patch

import pytest

from seahub.project.apis import ProjectRelatedUsersView, ProjectItemsSearchView, ProjectConfluenceWorkspaces
from seahub.project.constants import ITEMS_SEARCH_QUERY_TYPES_SUPPORT
from seahub.project.models import ProjectConfluenceOauth


@pytest.mark.django_db
class TestProjectRelatedUsersView:

    def test_get_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = no_org_user

        resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_project_not_found(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        request = factory.get(f"/api/v1/project/{project_uuid}/related-users/")
        request.user = project_creator

        resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = auth_user

        resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_internal_error(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = project_creator

        with patch('seahub.avatar.templatetags.avatar_tags.get_primary_avatar', side_effect=Exception('boom')):
            resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 500

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = project_creator

        resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert 'user_list' in resp.data
        assert len(resp.data['user_list']) == 1
        assert resp.data['user_list'][0]['email'] == project.workspace.owner


class TestProjectItemsSearchView:

    def test_get_query_missing(self, factory, project_creator):
        request = factory.get('/api/v1/project/items-search/', {})
        request.user = project_creator

        resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 400

    def test_get_query_type_invalid(self, factory, project_creator):
        request = factory.get('/api/v1/project/items-search/', {'query_str': 'x', 'query_type': 'invalid'})
        request.user = project_creator

        resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 400

    def test_get_internal_error(self, factory, project_creator):
        query_type = ITEMS_SEARCH_QUERY_TYPES_SUPPORT[0]
        request = factory.get('/api/v1/project/items-search/', {'query_str': 'x', 'query_type': query_type})
        request.user = project_creator

        with patch('seahub.project.apis.query_items', side_effect=Exception('boom')):
            resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 500

    def test_get_success(self, factory, project_creator):
        query_type = ITEMS_SEARCH_QUERY_TYPES_SUPPORT[0]
        query_str = 'proj'
        request = factory.get('/api/v1/project/items-search/', {'query_str': query_str, 'query_type': query_type})
        request.user = project_creator
        resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 200
        assert isinstance(resp.data['results'], list)


@pytest.mark.django_db
class TestProjectConfluenceWorkspaces:

    def test_get_requires_oauth(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/confluence/workspaces/')
        request.user = project_creator

        resp = ProjectConfluenceWorkspaces.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_get_filters_non_confluence_resources(self, factory, project_creator, real_project):
        project = real_project
        ProjectConfluenceOauth.objects.create(
            project_uuid=project.uuid,
            access_token='access-token',
            refresh_token='refresh-token',
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1),
        )
        request = factory.get(f'/api/v1/project/{project.uuid}/confluence/workspaces/')
        request.user = project_creator

        self_response = Mock()
        self_response.status_code = 200
        self_response.json.return_value = [
            {'id': 'jira-1', 'name': 'Jira Site', 'url': 'https://jira.example.com', 'scopes': ['read:jira-work']},
            {'id': 'cf-2', 'name': 'Zulu Workspace', 'url': 'https://zulu.example.com', 'scopes': ['read:confluence-content.summary']},
            {'id': 'cf-1', 'name': 'Alpha Workspace', 'url': 'https://alpha.example.com', 'scopes': ['write:Confluence-content', 'read:me']},
            {'id': 'cf-3', 'name': 'Broken Workspace', 'scopes': ['read:confluence-content.summary']},
        ]
        self_response.raise_for_status.return_value = None

        with patch('seahub.project.apis.requests.get', return_value=self_response):
            resp = ProjectConfluenceWorkspaces.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['workspaces'] == [
            {'id': 'cf-1', 'name': 'Alpha Workspace', 'url': 'https://alpha.example.com'},
            {'id': 'cf-2', 'name': 'Zulu Workspace', 'url': 'https://zulu.example.com'},
        ]

    def test_get_refreshes_expired_token(self, factory, project_creator, real_project):
        project = real_project
        expired_oauth = ProjectConfluenceOauth.objects.create(
            project_uuid=project.uuid,
            access_token='expired-token',
            refresh_token='refresh-token',
            expires_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1),
        )
        refreshed_oauth = ProjectConfluenceOauth(
            project_uuid=project.uuid,
            access_token='fresh-token',
            refresh_token='refresh-token',
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1),
        )
        request = factory.get(f'/api/v1/project/{project.uuid}/confluence/workspaces/')
        request.user = project_creator

        self_response = Mock()
        self_response.status_code = 200
        self_response.json.return_value = []
        self_response.raise_for_status.return_value = None

        with patch('seahub.project.apis._refresh_confluence_access_token', return_value=refreshed_oauth) as refresh_mock, \
                patch('seahub.project.apis.requests.get', return_value=self_response):
            resp = ProjectConfluenceWorkspaces.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        refresh_mock.assert_called_once_with(expired_oauth)

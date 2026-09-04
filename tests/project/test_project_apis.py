import datetime
from unittest.mock import Mock, patch

import pytest

from seahub.project.apis import ProjectRelatedUsersView, ProjectItemsSearchView, ProjectConfluenceWorkspaces
from seahub.project.confluence_api import ConfluenceAPI
from seahub.project.constants import ITEMS_SEARCH_QUERY_TYPES_SUPPORT, ConnectionType
from seahub.project.models import ProjectConnectionOauth


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
        ProjectConnectionOauth.objects.create(
            project_uuid=project.uuid,
            type=ConnectionType.CONFLUENCE.value,
            access_token='access-token',
            refresh_token='refresh-token',
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1),
        )
        request = factory.get(f'/api/v1/project/{project.uuid}/confluence/workspaces/')
        request.user = project_creator

        mock_resources = [
            {'id': 'jira-1', 'name': 'Jira Site', 'url': 'https://jira.example.com', 'scopes': ['read:jira-work']},
            {'id': 'cf-2', 'name': 'Zulu Workspace', 'url': 'https://zulu.example.com', 'scopes': ['read:confluence-content.summary']},
            {'id': 'cf-1', 'name': 'Alpha Workspace', 'url': 'https://alpha.example.com', 'scopes': ['write:Confluence-content', 'read:me']},
            {'id': 'cf-3', 'name': 'Broken Workspace', 'scopes': ['read:confluence-content.summary']},
        ]

        with patch.object(ConfluenceAPI, 'list_accessible_resources', return_value=mock_resources):
            resp = ProjectConfluenceWorkspaces.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['workspaces'] == [
            {'id': 'cf-1', 'name': 'Alpha Workspace', 'url': 'https://alpha.example.com'},
            {'id': 'cf-2', 'name': 'Zulu Workspace', 'url': 'https://zulu.example.com'},
        ]

    def test_get_refreshes_expired_token(self, factory, project_creator, real_project):
        project = real_project
        ProjectConnectionOauth.objects.create(
            project_uuid=project.uuid,
            type=ConnectionType.CONFLUENCE.value,
            access_token='expired-token',
            refresh_token='refresh-token',
            expires_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1),
        )
        request = factory.get(f'/api/v1/project/{project.uuid}/confluence/workspaces/')
        request.user = project_creator

        new_expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)

        def mock_accessible_resources(self):
            # Token refresh happens inside _request before the API call
            if self.access_token == 'expired-token':
                self.access_token = 'fresh-token'
                self.expires_at = new_expires_at
            return []

        with patch.object(ConfluenceAPI, 'list_accessible_resources', mock_accessible_resources):
            resp = ProjectConfluenceWorkspaces.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        # Verify the token was persisted after being refreshed
        updated_oauth = ProjectConnectionOauth.objects.get_by_project_uuid(project.uuid, ConnectionType.CONFLUENCE.value)
        assert updated_oauth.access_token == 'fresh-token'
        assert updated_oauth.expires_at == new_expires_at


@pytest.mark.django_db
class TestProjectConnectionOauthManager:

    @pytest.mark.parametrize('expires_at', [1788343471.4274027, '1788343471.4274027'])
    def test_upsert_token_converts_timestamp_to_datetime(self, real_project, expires_at):

        ProjectConnectionOauth.objects.upsert_token(
            real_project.uuid,
            ConnectionType.EMAIL.value,
            'access-token',
            expires_at,
            'refresh-token',
        )

        oauth = ProjectConnectionOauth.objects.get_by_project_uuid(
            real_project.uuid, ConnectionType.EMAIL.value
        )
        assert oauth.expires_at == datetime.datetime.fromtimestamp(float(expires_at), tz=datetime.timezone.utc)

    def test_upsert_connection_token_keeps_other_email_connection_tokens(self, real_project):
        first = ProjectConnectionOauth.objects.upsert_connection_token(
            real_project.uuid, 1, 'first-access-token', 1788343471, 'first-refresh-token'
        )
        second = ProjectConnectionOauth.objects.upsert_connection_token(
            real_project.uuid, 2, 'second-access-token', 1788343472, 'second-refresh-token'
        )

        ProjectConnectionOauth.objects.upsert_connection_token(
            real_project.uuid, 2, 'updated-access-token', 1788343473, 'updated-refresh-token'
        )

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.access_token == 'first-access-token'
        assert first.refresh_token == 'first-refresh-token'
        assert second.access_token == 'updated-access-token'
        assert second.refresh_token == 'updated-refresh-token'

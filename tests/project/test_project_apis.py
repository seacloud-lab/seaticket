from unittest.mock import patch

import pytest

from seahub.project.apis import ProjectRelatedUsersView, ProjectItemsSearchView
from seahub.project.constants import ITEMS_SEARCH_QUERY_TYPES_SUPPORT


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
        request = factory.get('/api/v1/project/items-search/', {'query_str': 'x', 'query_type': query_type})
        request.user = project_creator

        with patch('seahub.project.apis.query_items', return_value=[{'id': 1}]):
            resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data == {'results': [{'id': 1}]}

from unittest.mock import patch

import pytest

from seahub.project.apis import ProjectRelatedUsersView, ProjectItemsSearchView
from seahub.project.constants import ITEMS_SEARCH_QUERY_TYPES_SUPPORT


@pytest.mark.django_db
class TestProjectRelatedUsersView:

    def test_get_feature_not_enabled(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_project_not_found(self, factory, auth_user):
        request = factory.get('/api/v1/project/p1/related-users/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectRelatedUsersView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.apis.check_project_permission', return_value=False):
            resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_internal_error(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.apis.check_project_permission', return_value=True), \
                patch('seahub.project.apis.get_project_related_users', side_effect=Exception('boom')):
            resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 500

    def test_get_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/project/{project.uuid}/related-users/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.apis.get_project_related_users', return_value=['u1']):
            resp = ProjectRelatedUsersView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data == {'user_list': ['u1']}


class TestProjectItemsSearchView:

    def test_get_query_missing(self, factory, auth_user):
        request = factory.get('/api/v1/project/items-search/', {})
        request.user = auth_user

        resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 400

    def test_get_query_type_invalid(self, factory, auth_user):
        request = factory.get('/api/v1/project/items-search/', {'query_str': 'x', 'query_type': 'invalid'})
        request.user = auth_user

        resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 400

    def test_get_internal_error(self, factory, auth_user):
        query_type = ITEMS_SEARCH_QUERY_TYPES_SUPPORT[0]
        request = factory.get('/api/v1/project/items-search/', {'query_str': 'x', 'query_type': query_type})
        request.user = auth_user

        with patch('seahub.project.apis.query_items', side_effect=Exception('boom')):
            resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 500

    def test_get_success(self, factory, auth_user):
        query_type = ITEMS_SEARCH_QUERY_TYPES_SUPPORT[0]
        request = factory.get('/api/v1/project/items-search/', {'query_str': 'x', 'query_type': query_type})
        request.user = auth_user

        with patch('seahub.project.apis.query_items', return_value=[{'id': 1}]):
            resp = ProjectItemsSearchView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data == {'results': [{'id': 1}]}

from unittest.mock import Mock, patch

from seahub.project_tags.project_tags import ProjectTagsAPIView, ProjectTagAPIView


def test_get_tags_feature_not_enabled(factory, user):
    request = factory.get('/api/v1/project/p1/tags/?link_type=tickets')
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_get_tags_success(factory, user):
    request = factory.get('/api/v1/project/p1/tags/?link_type=tickets')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI'), \
            patch('seahub.project_tags.project_tags.get_tag_counts_by_link_type', return_value=([{'id': 'tag1', 'name': 't'}], None)):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert 'tags' in resp.data


def test_get_tags_project_not_found(factory, user):
    request = factory.get('/api/v1/project/p1/tags/?link_type=tickets')
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=None):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_get_tags_permission_denied(factory, user):
    request = factory.get('/api/v1/project/p1/tags/?link_type=tickets')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_get_tags_internal_server_error(factory, user):
    request = factory.get('/api/v1/project/p1/tags/?link_type=tickets')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', side_effect=Exception('err')):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 500


# Note: POST/PUT/DELETE tests are consolidated in tests/test_project_tags.py.

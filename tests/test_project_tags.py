from unittest.mock import Mock, patch

import pytest
from rest_framework.test import APIRequestFactory

from seahub.project_tags.project_tags import ProjectTagsAPIView, ProjectTagAPIView


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def user():
    u = Mock()
    u.id = 1
    u.pk = 1
    u.username = 'test@seafile.com'
    return u


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_post_tag_feature_not_enabled(factory, user, link_type):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post(f'/api/v1/project/p1/tags/?link_type={link_type}', data=payload)
    request.user = user

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_post_tag_missing_name(factory, user, link_type):
    payload = {'color': '#fff', 'text_color': '#000'}
    request = factory.post(f'/api/v1/project/p1/tags/?link_type={link_type}', data=payload)
    request.user = user

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_post_tag_duplicate_name(factory, user, link_type):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post(f'/api/v1/project/p1/tags/?link_type={link_type}', data=payload)
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'tag1'}]}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.project_tags.project_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.project_tags.project_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_post_tag_success(factory, user, link_type):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post(f'/api/v1/project/p1/tags/?link_type={link_type}', data=payload)
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.project_tags.project_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.project_tags.project_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.project_tags.project_tags.add_select_option', return_value={'id': 'tag1', 'name': 'tag1'}):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 201
    assert 'tag' in resp.data


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_delete_tags_feature_not_enabled(factory, user, link_type):
    request = factory.delete(
        f'/api/v1/project/p1/tags/?link_type={link_type}', data={'tag_ids': ['t1']}, format='json'
    )
    request.user = user

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_delete_tags_missing_ids(factory, user, link_type):
    request = factory.delete(f'/api/v1/project/p1/tags/?link_type={link_type}', data={}, format='json')
    request.user = user

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_delete_tags_success(factory, user, link_type):
    payload = {'tag_ids': ['tag1']}
    request = factory.delete(f'/api/v1/project/p1/tags/?link_type={link_type}', data=payload, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k'}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.project_tags.project_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.project_tags.project_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.project_tags.project_tags.batch_delete_select_option'):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_delete_tag_success(factory, user, link_type):
    request = factory.delete('/api/v1/project/p1/tags/t1/', data={}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    tag_option = {'id': 't1', 'name': 'tag1'}
    column = {'key': 'k', 'data': {'options': [tag_option]}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.project_tags.project_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.project_tags.project_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True
    assert seadb.delete_column_option.call_count == 1


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_put_tag_argument_invalid(factory, user, link_type):
    request = factory.put('/api/v1/project/p1/tags/t1/', data={}, format='multipart')
    request.user = user

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 400


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_put_tag_not_found(factory, user, link_type):
    request = factory.put(
        '/api/v1/project/p1/tags/t1/', data={'name': 'n2'}, format='multipart'
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.project_tags.project_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.project_tags.project_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_put_tag_success(factory, user, link_type):
    request = factory.put(
        '/api/v1/project/p1/tags/t1/', data={'name': 'tag2'}, format='multipart'
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    tag_option = {'id': 't1', 'name': 'tag1'}
    column = {'key': 'k', 'data': {'options': [tag_option]}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.project_tags.project_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.project_tags.project_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.project_tags.project_tags.update_select_option'):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


@pytest.mark.parametrize('link_type', ['tickets', 'knowledge_base'])
def test_delete_tag_not_found(factory, user, link_type):
    request = factory.delete('/api/v1/project/p1/tags/t1/', data={}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.project_tags.project_tags.is_org_context', return_value=True), \
            patch('seahub.project_tags.project_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project_tags.project_tags.check_project_permission', return_value=True), \
            patch('seahub.project_tags.project_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.project_tags.project_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.project_tags.project_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404

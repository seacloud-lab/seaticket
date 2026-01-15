from unittest.mock import Mock, patch

from seahub.project_tags.project_tags import ProjectTagsAPIView, ProjectTagAPIView


def test_get_tags_feature_not_enabled(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_get_tags_success(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI'), \
            patch('seahub.tickets.ticket_tags.get_ticket_counts_group_by_column_name', return_value=([{'id': 'tag1', 'name': 't'}], None)):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert 'tags' in resp.data


def test_get_tags_project_not_found(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=None):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_get_tags_permission_denied(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_get_tags_internal_server_error(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', side_effect=Exception('err')):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 500


def test_post_tag_missing_name(factory, user):
    payload = {'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=True):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_delete_tags_feature_not_enabled(factory, user):
    request = factory.delete(
        '/api/v1/projects/p1/ticket-tags/', data={'tag_ids': ['t1']}, format='json'
    )
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_post_tag_feature_not_enabled(factory, user):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=False):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_post_tag_duplicate_name(factory, user):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'tag1'}]}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_post_tag_success(factory, user):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.add_select_option', return_value={'id': 'tag1', 'name': 'tag1'}):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 201
    assert 'tag' in resp.data


def test_delete_tags_missing_ids(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-tags/', data={}, format='json')
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=True):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_delete_tags_success(factory, user):
    payload = {'tag_ids': ['tag1']}
    request = factory.delete('/api/v1/projects/p1/ticket-tags/', data=payload, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k'}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.batch_delete_select_option'):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_get_tag_not_found(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/t1/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'data': {'options': []}}
    table_meta = {'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_delete_tag_success(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-tags/t1/', data={}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    tag_option = {'id': 't1', 'name': 'tag1'}
    column = {'key': 'k', 'data': {'options': [tag_option]}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True
    assert seadb.delete_column_option.call_count == 1


def test_put_tag_success(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-tags/t1/', data={'name': 'tag2'}, format='json'
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

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.update_select_option'):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_get_tag_project_not_found(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/t1/')
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=None):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_put_tag_argument_invalid(factory, user):
    request = factory.put('/api/v1/projects/p1/ticket-tags/t1/', data={}, format='json')
    request.user = user

    with patch('seahub.utils.decorators.is_org_context', return_value=True):
        resp = ProjectTagsAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 400


def test_put_tag_not_found(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-tags/t1/', data={'name': 'n2'}, format='json'
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_delete_tag_not_found(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-tags/t1/', data={}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_get_tag_success(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/t1/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    tag_option = {'id': 't1', 'name': 'tag1'}
    column = {'data': {'options': [tag_option]}}
    table_meta = {'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.filter_tickets_by_select', return_value=([{'_pk': 1}], ['c'])):
        resp = ProjectTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert 'tickets' in resp.data

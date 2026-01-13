from unittest.mock import Mock, patch

from tests.tickets.conftest import mock_project_and_permission
from seahub.tickets.ticket_tags import TicketTagsAPIView, TicketTagAPIView


def test_get_tags_feature_not_enabled(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    request.cloud_mode = False
    request.user.org = None
    
    resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_get_tags_success(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI'), \
            patch('seahub.tickets.ticket_tags.get_ticket_counts_group_by_column_name', return_value=([{'id': 'tag1', 'name': 't'}], None)):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert 'tags' in resp.data


def test_get_tags_project_not_found(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    with mock_project_and_permission(user, project_exists=False):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_get_tags_permission_denied(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    with mock_project_and_permission(user, has_permission=False):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_get_tags_internal_server_error(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/')
    request.user = user

    seadb = Mock()
    
    # Make the business logic throw an exception, not SeaDBAPI creation
    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_ticket_counts_group_by_column_name', side_effect=Exception('err')):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 500


def test_post_tag_missing_name(factory, user):
    payload = {'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    with mock_project_and_permission(user):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_delete_tags_feature_not_enabled(factory, user):
    request = factory.delete(
        '/api/v1/projects/p1/ticket-tags/', data={'tag_ids': ['t1']}, format='json'
    )
    request.user = user

    request.cloud_mode = False
    request.user.org = None
    
    resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_post_tag_feature_not_enabled(factory, user):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    request.cloud_mode = False
    request.user.org = None
    
    resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_post_tag_duplicate_name(factory, user):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'tag1'}]}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_post_tag_success(factory, user):
    payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post('/api/v1/projects/p1/ticket-tags/', data=payload)
    request.user = user

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.add_select_option', return_value={'id': 'tag1', 'name': 'tag1'}):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 201
    assert 'tag' in resp.data


def test_delete_tags_missing_ids(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-tags/', data={}, format='json')
    request.user = user

    with mock_project_and_permission(user):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_delete_tags_success(factory, user):
    payload = {'tag_ids': ['tag1']}
    request = factory.delete('/api/v1/projects/p1/ticket-tags/', data=payload, format='json')
    request.user = user

    column = {'key': 'k'}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.batch_delete_select_option'):
        resp = TicketTagsAPIView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_get_tag_not_found(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/t1/')
    request.user = user

    column = {'data': {'options': []}}
    table_meta = {'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_delete_tag_success(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-tags/t1/', data={}, format='json')
    request.user = user

    tag_option = {'id': 't1', 'name': 'tag1'}
    column = {'key': 'k', 'data': {'options': [tag_option]}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True
    assert seadb.delete_column_option.call_count == 1


def test_put_tag_success(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-tags/t1/', data={'name': 'tag2'}, format='json'
    )
    request.user = user

    tag_option = {'id': 't1', 'name': 'tag1'}
    column = {'key': 'k', 'data': {'options': [tag_option]}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.update_select_option'):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_get_tag_project_not_found(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/t1/')
    request.user = user

    with mock_project_and_permission(user, project_exists=False):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_put_tag_argument_invalid(factory, user):
    request = factory.put('/api/v1/projects/p1/ticket-tags/t1/', data={}, format='json')
    request.user = user

    with mock_project_and_permission(user):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 400


def test_put_tag_not_found(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-tags/t1/', data={'name': 'n2'}, format='json'
    )
    request.user = user

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_delete_tag_not_found(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-tags/t1/', data={}, format='json')
    request.user = user

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 404


def test_get_tag_success(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-tags/t1/')
    request.user = user

    tag_option = {'id': 't1', 'name': 'tag1'}
    column = {'data': {'options': [tag_option]}}
    table_meta = {'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with mock_project_and_permission(user), \
            patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_tags.filter_tickets_by_select', return_value=([{'_pk': 1}], ['c'])):
        resp = TicketTagAPIView.as_view()(request, project_uuid='p1', tag_id='t1')

    assert resp.status_code == 200
    assert 'tickets' in resp.data

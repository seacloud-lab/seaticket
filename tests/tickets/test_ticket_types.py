from unittest.mock import Mock, patch

from seahub.tickets.ticket_types import TicketTypesAPIView, TicketTypeAPIView


def test_get_types_feature_not_enabled(factory, no_org_user, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-types/")
    request.user = no_org_user

    resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 403


def test_get_types_success(factory, project_creator, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-types/")
    request.user = project_creator

    with patch('seahub.tickets.ticket_types.SeaDBAPI'), \
            patch('seahub.tickets.ticket_types.get_ticket_counts_group_by_column_name', return_value=([{'id': 't1', 'name': 'bug'}], None)):
        resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 200
    assert 'types' in resp.data


def test_get_types_project_not_found(factory, project_creator):
    project_uuid = '00000000-0000-0000-0000-000000000000'
    request = factory.get(f'/api/v1/projects/{project_uuid}/ticket-types/')
    request.user = project_creator

    resp = TicketTypesAPIView.as_view()(request, project_uuid=project_uuid)

    assert resp.status_code == 404


def test_get_types_permission_denied(factory, auth_user, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-types/")
    request.user = auth_user

    resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 403


def test_post_type_missing_name(factory, project_creator, real_project):
    project = real_project
    payload = {'color': '#fff', 'text_color': '#000'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-types/", data=payload)
    request.user = project_creator

    resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 400


def test_post_type_feature_not_enabled(factory, no_org_user, real_project):
    project = real_project
    payload = {'name': 'bug', 'color': '#fff', 'text_color': '#000'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-types/", data=payload)
    request.user = no_org_user

    resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 403


def test_post_type_duplicate_name(factory, project_creator, real_project):
    project = real_project
    payload = {'name': 'bug', 'color': '#fff', 'text_color': '#000'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-types/", data=payload)
    request.user = project_creator

    column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'bug'}]}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=column):
        resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 400


def test_post_type_success(factory, project_creator, real_project):
    project = real_project
    payload = {'name': 'bug', 'color': '#fff', 'text_color': '#000'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-types/", data=payload)
    request.user = project_creator

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_types.add_select_option', return_value={'id': 't1', 'name': 'bug'}):
        resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 201
    assert 'type' in resp.data


def test_delete_types_missing_type_ids(factory, project_creator, real_project):
    project = real_project
    request = factory.delete(f"/api/v1/projects/{project.uuid}/ticket-types/", data={}, format='json')
    request.user = project_creator

    resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 400


def test_delete_types_feature_not_enabled(factory, no_org_user, real_project):
    project = real_project
    request = factory.delete(
        f"/api/v1/projects/{project.uuid}/ticket-types/", data={'type_ids': ['t1']}, format='json'
    )
    request.user = no_org_user

    resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 403


def test_delete_types_success(factory, project_creator, real_project):
    project = real_project
    payload = {'type_ids': ['t1']}
    request = factory.delete(f"/api/v1/projects/{project.uuid}/ticket-types/", data=payload, format='json')
    request.user = project_creator

    table_meta = {'id': 'tbl', 'columns': [{'key': 'k'}]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=table_meta['columns'][0]), \
            patch('seahub.tickets.ticket_types.batch_delete_select_option'):
        resp = TicketTypesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_get_type_not_found(factory, project_creator, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-types/t1/")
    request.user = project_creator

    table_meta = {'columns': [{'data': {'options': []}}]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=table_meta['columns'][0]):
        resp = TicketTypeAPIView.as_view()(request, project_uuid=project.uuid, type_id='t1')

    assert resp.status_code == 404


def test_put_type_argument_invalid(factory, project_creator, real_project):
    project = real_project
    request = factory.put(f"/api/v1/projects/{project.uuid}/ticket-types/t1/", data={}, format='json')
    request.user = project_creator

    resp = TicketTypeAPIView.as_view()(request, project_uuid=project.uuid, type_id='t1')

    assert resp.status_code == 400


def test_delete_type_not_found(factory, project_creator, real_project):
    project = real_project
    request = factory.delete(f"/api/v1/projects/{project.uuid}/ticket-types/t1/", data={}, format='json')
    request.user = project_creator

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=column):
        resp = TicketTypeAPIView.as_view()(request, project_uuid=project.uuid, type_id='t1')

    assert resp.status_code == 404


def test_put_type_success(factory, project_creator, real_project):
    project = real_project
    payload = {'name': 'bug2'}
    request = factory.put(f"/api/v1/projects/{project.uuid}/ticket-types/t1/", data=payload, format='json')
    request.user = project_creator

    type_option = {'id': 't1', 'name': 'bug'}
    column = {'key': 'k', 'data': {'options': [type_option]}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_types.update_select_option'):
        resp = TicketTypeAPIView.as_view()(request, project_uuid=project.uuid, type_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_delete_type_success(factory, project_creator, real_project):
    project = real_project
    request = factory.delete(f"/api/v1/projects/{project.uuid}/ticket-types/t1/", data={}, format='json')
    request.user = project_creator

    column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'bug'}]}}
    table_meta = {'id': 'tbl', 'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_types.SeaDBAPI.delete_column_option'):
        resp = TicketTypeAPIView.as_view()(request, project_uuid=project.uuid, type_id='t1')

    assert resp.status_code == 200
    assert resp.data['success'] is True

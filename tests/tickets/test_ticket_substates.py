from unittest.mock import Mock, patch

from seahub.tickets.ticket_substates import TicketSubstatesAPIView, TicketSubstateAPIView


def test_get_substates_feature_not_enabled(factory, no_org_user, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-substates/")
    request.user = no_org_user

    resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 403


def test_get_substates_success(factory, project_creator, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-substates/")
    request.user = project_creator

    substate_column = {'data': {'cascade_settings': {}, 'cascade_column_key': 'state'}}

    seadb = Mock()

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_ticket_counts_group_by_column_name', return_value=([{'id': 's1', 'name': 'open'}], substate_column)):
        resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 200
    assert 'substates' in resp.data


def test_get_substates_project_not_found(factory, project_creator, real_project):
    project_uuid = '00000000-0000-0000-0000-000000000000'
    request = factory.get(f'/api/v1/projects/{project_uuid}/ticket-substates/')
    request.user = project_creator

    resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project_uuid)

    assert resp.status_code == 404


def test_get_substates_permission_denied(factory, auth_user, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-substates/")
    request.user = auth_user

    resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 403


def test_get_substates_filter_by_state_id(factory, project_creator, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-substates/", {'state_id': 'st1'})
    request.user = project_creator

    substate_column = {
        'data': {
            'cascade_settings': {'st1': ['s1'], 'st2': ['s2']},
            'cascade_column_key': 'state',
        }
    }

    seadb = Mock()

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_ticket_counts_group_by_column_name', return_value=([
                {'id': 's1', 'name': 'sub1'},
                {'id': 's2', 'name': 'sub2'},
            ], substate_column)):
        resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 200
    assert resp.data['cascade_column_key'] == 'state'
    assert len(resp.data['substates']) == 1
    assert resp.data['substates'][0]['id'] == 's1'


def test_post_substate_missing_name(factory, project_creator, real_project):
    project = real_project
    payload = {'color': '#fff', 'text_color': '#000', 'parent_id': 'st1'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-substates/", data=payload)
    request.user = project_creator

    resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 400


def test_delete_substates_feature_not_enabled(factory, no_org_user, real_project):
    project = real_project
    request = factory.delete(
        f"/api/v1/projects/{project.uuid}/ticket-substates/", data={'substate_ids': ['s1']}, format='json'
    )
    request.user = no_org_user

    resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 403


def test_delete_substates_success(factory, project_creator, real_project):
    project = real_project
    request = factory.delete(
        f"/api/v1/projects/{project.uuid}/ticket-substates/", data={'substate_ids': ['s1']}, format='json'
    )
    request.user = project_creator

    column = {'key': 'k'}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_substates.batch_delete_select_option'):
        resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_post_substate_missing_parent_id(factory, project_creator, real_project):
    project = real_project
    payload = {'name': 'sub1', 'color': '#fff', 'text_color': '#000'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-substates/", data=payload)
    request.user = project_creator

    resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 400


def test_post_substate_duplicate_name(factory, project_creator, real_project):
    project = real_project
    payload = {'name': 'sub1', 'color': '#fff', 'text_color': '#000', 'parent_id': 'st1'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-substates/", data=payload)
    request.user = project_creator

    column = {'key': 'k', 'data': {'options': [{'id': 's1', 'name': 'sub1'}], 'cascade_settings': {}}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column):
        resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 400


def test_post_substate_success(factory, project_creator, real_project):
    project = real_project
    payload = {'name': 'sub1', 'color': '#fff', 'text_color': '#000', 'parent_id': 'st1'}
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-substates/", data=payload)
    request.user = project_creator

    column_data = {'options': [], 'cascade_settings': {'st1': []}}
    column = {'key': 'k', 'data': column_data}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_substates.add_select_option', return_value={'id': 's1', 'name': 'sub1'}):
        resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 201
    assert 'substate' in resp.data


def test_delete_substates_missing_ids(factory, project_creator, real_project):
    project = real_project
    request = factory.delete(f"/api/v1/projects/{project.uuid}/ticket-substates/", data={}, format='json')
    request.user = project_creator

    resp = TicketSubstatesAPIView.as_view()(request, project_uuid=project.uuid)

    assert resp.status_code == 400


def test_get_substate_not_found(factory, project_creator, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-substates/s1/")
    request.user = project_creator

    column = {'data': {'options': []}}
    table_meta = {'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column):
        resp = TicketSubstateAPIView.as_view()(request, project_uuid=project.uuid, substate_id='s1')

    assert resp.status_code == 404


def test_put_substate_argument_invalid(factory, project_creator, real_project):
    project = real_project
    request = factory.put(f"/api/v1/projects/{project.uuid}/ticket-substates/s1/", data={}, format='json')
    request.user = project_creator

    resp = TicketSubstateAPIView.as_view()(request, project_uuid=project.uuid, substate_id='s1')

    assert resp.status_code == 400


def test_delete_substate_not_found(factory, project_creator, real_project):
    project = real_project
    request = factory.delete(f"/api/v1/projects/{project.uuid}/ticket-substates/s1/", data={}, format='json')
    request.user = project_creator

    column = {'key': 'k', 'data': {'options': []}}
    table_meta = {'id': 'tbl', 'columns': [column]}
    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column):
        resp = TicketSubstateAPIView.as_view()(request, project_uuid=project.uuid, substate_id='s1')

    assert resp.status_code == 404


def test_get_substate_success(factory, project_creator, real_project):
    project = real_project
    request = factory.get(f"/api/v1/projects/{project.uuid}/ticket-substates/s1/")
    request.user = project_creator

    substate_option = {'id': 's1', 'name': 'open'}
    column = {'data': {'options': [substate_option]}}
    table_meta = {'columns': [column]}

    seadb = Mock()
    seadb.get_base_metadata.return_value = {'tables': [table_meta]}

    with patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
            patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
            patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column), \
            patch('seahub.tickets.ticket_substates.filter_tickets_by_select', return_value=([{'_pk': 1}], ['c'])):
        resp = TicketSubstateAPIView.as_view()(request, project_uuid=project.uuid, substate_id='s1')

    assert resp.status_code == 200
    assert 'tickets' in resp.data

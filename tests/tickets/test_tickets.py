import datetime
import json
from unittest.mock import Mock, patch

from seahub.tickets.tickets import (
    TicketsAPIView,
    TicketAPIView,
    TicketsSearchAPIView,
    TicketCommentsAPIView,
    TicketCommentAPIView,
    MyTicketAPIView,
    TicketMetadataAPIView,
    TicketTrashAPIView,
)


class TestTicketsAPIView:
    # GET
    def test_get_feature_not_enabled(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/', {})
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 403

    def test_get_missing_view_id(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/', {})
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 400

    def test_get_invalid_start_limit(self, factory, user):
        request = factory.get(
            '/api/v1/projects/p1/tickets/',
            {'view_id': 'v1', 'start': '-1', 'limit': '-10'},
        )
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 400

    def test_get_non_int_start_limit_use_default(self, factory, user):
        request = factory.get(
            '/api/v1/projects/p1/tickets/',
            {'view_id': 'v1', 'start': 'a', 'limit': 'b'},
        )
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.TicketViews.objects.get_view', return_value=Mock()), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.list_tickets_view_records') as list_mock:
            list_mock.return_value = ([], [])
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 200
        list_mock.assert_called_once()
        assert list_mock.call_args[0][-2:] == (0, 1000)

    def test_get_project_not_found(self, factory, user):
        request = factory.get(
            '/api/v1/projects/p1/tickets/',
            {'view_id': 'v1', 'start': '0', 'limit': '10'},
        )
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=None):
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 404

    def test_get_permission_denied(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/', {'view_id': 'v1'})
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=False):
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 403

    def test_get_success(self, factory, user):
        request = factory.get(
            '/api/v1/projects/p1/tickets/',
            {'view_id': 'v1', 'start': '0', 'limit': '10'},
        )
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.TicketViews.objects.get_view') as get_view_mock, \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.list_tickets_view_records') as list_mock:
            get_view_mock.return_value = Mock()
            seadb_cls_mock.return_value = Mock()
            list_mock.return_value = ([{'_pk': 1, 'title': 'test_ticket'}], ['col1'])
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 200
        assert 'tickets' in response.data
        assert len(response.data['tickets']) == 1

    def test_get_internal_server_error(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/', {'view_id': 'v1'})
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.TicketViews.objects.get_view', side_effect=Exception('err')):
            response = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert response.status_code == 500

    # POST
    def test_post_feature_not_enabled(self, factory, user):
        data = {'title': 't', 'content': json.dumps({'text': 'c'})}
        request = factory.post('/api/v1/projects/p1/tickets/', data=data)
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403

    def test_post_assignees_invalid_json(self, factory, user):
        data = {
            'title': 't',
            'content': json.dumps({'text': 'c'}),
            'assignees': '{',
        }
        request = factory.post('/api/v1/projects/p1/tickets/', data=data)
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_post_permission_denied(self, factory, user):
        data = {'title': 't', 'content': json.dumps({'text': 'c'})}
        request = factory.post('/api/v1/projects/p1/tickets/', data=data)
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=False):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403

    def test_post_creation_interval_too_frequent(self, factory, user):
        data = {'title': 't', 'content': json.dumps({'text': 'c'})}
        request = factory.post('/api/v1/projects/p1/tickets/', data=data)
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.check_ticket_creation_interval', return_value=False):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 429

    def test_post_success(self, factory, user):
        data = {
            'title': 't',
            'content': json.dumps({'text': 'c'}),
            'priority': '7',
            'tags': '[]',
            'assignees': '[]',
        }
        request = factory.post('/api/v1/projects/p1/tickets/', data=data)
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        seadb_api = Mock()
        seadb_api.insert_rows.return_value = {'pks': [1]}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.check_ticket_creation_interval', return_value=True):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 201
        assert resp.data['ticket']['_pk'] == 1
        assert resp.data['ticket']['priority'] == 5

    # PUT
    def test_put_missing_data(self, factory, user):
        request = factory.put('/api/v1/projects/p1/tickets/', data={}, format='json')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_put_row_id_invalid(self, factory, user):
        data = {'tickets_data': [{'row': {'state': 'closed'}}]}
        request = factory.put('/api/v1/projects/p1/tickets/', data=data, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_put_invalid_content(self, factory, user):
        data = {'tickets_data': [{'row_id': '1', 'row': {'content': 'invalid'}}]}
        request = factory.put('/api/v1/projects/p1/tickets/', data=data, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'results': [{'_pk': 1}]}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_put_success_update_state_closed(self, factory, user):
        data = {'tickets_data': [{'row_id': '1', 'row': {'state': 'Closed'}}]}
        request = factory.put('/api/v1/projects/p1/tickets/', data=data, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'results': [{'_pk': 1}]}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert seadb_api.update_rows.call_count == 1
        update_rows = seadb_api.update_rows.call_args[0][2]
        assert update_rows[0]['row']['state'] == 'closed'
        assert 'closed_time' in update_rows[0]['row']

    # DELETE
    def test_delete_missing_ticket_ids(self, factory, user):
        request = factory.delete('/api/v1/projects/p1/tickets/', data={}, format='json')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_delete_partial_success(self, factory, user):
        data = {'ticket_ids': ['1', '2']}
        request = factory.delete('/api/v1/projects/p1/tickets/', data=data, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_tickets_by_ids', return_value=[{'_pk': 1}]):
            resp = TicketsAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200
        assert set(resp.data['success']) == {'1'}
        assert set(resp.data['failed']) == {'2'}


class TestTicketAPIView:
    def test_get_ticket_not_found(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/1/')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.get_ticket', return_value=(None, None)):
            seadb_cls_mock.return_value = Mock()
            resp = TicketAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 404

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/1/')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1, 'title': 'test_ticket'}
        metadata = {'columns': []}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.convert_ticket_select_column_name_to_option_id'), \
                patch('seahub.tickets.tickets.get_ticket_comments', return_value=[]):
            seadb_cls_mock.return_value = Mock()
            resp = TicketAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 200
        assert 'ticket' in resp.data

    def test_put_ticket_not_found(self, factory, user):
        request = factory.put('/api/v1/projects/p1/tickets/1/', data={'title': 't'}, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(None, None)):
            resp = TicketAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 404

    def test_put_permission_denied(self, factory, user):
        request = factory.put('/api/v1/projects/p1/tickets/1/', data={'title': 't'}, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_ticket_permission', return_value=False):
            resp = TicketAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 403

    def test_put_priority_invalid(self, factory, user):
        request = factory.put('/api/v1/projects/p1/tickets/1/', data={'priority': 'abc'}, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_ticket_permission', return_value=True):
            resp = TicketAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 400

    def test_put_success_state_closed_and_participants(self, factory, user):
        data = {'state': 'CLOSED', 'priority': '7'}
        request = factory.put('/api/v1/projects/p1/tickets/1/', data=data, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1, 'participants': []}
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_ticket_permission', return_value=True):
            resp = TicketAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 200
        assert seadb_api.update_rows.call_count == 1
        update_row = seadb_api.update_rows.call_args[0][2][0]['row']
        assert update_row['state'] == 'closed'
        assert 'closed_time' in update_row
        assert user.username in update_row['participants']
        assert update_row['priority'] == 5

    def test_delete_ticket_not_found(self, factory, user):
        request = factory.delete('/api/v1/projects/p1/tickets/1/', data={}, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(None, None)):
            resp = TicketAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 404


class TestTicketsSearchAPIView:
    def test_feature_not_enabled(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/search/', {'query': ''})
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = TicketsSearchAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/search/', {'query': 'test'})
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.list_tickets_by_search', return_value=[{'_pk': 1, 'title': 'T'}]):
            resp = TicketsSearchAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200
        assert 'tickets' in resp.data

    def test_get_permission_denied(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/search/', {'query': 'test'})
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=False):
            resp = TicketsSearchAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403


class TestMyTicketAPIView:
    def test_feature_not_enabled(self, factory, user):
        request = factory.post('/api/v1/projects/p1/tickets/my/')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = MyTicketAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403

    def test_post_success(self, factory, user):
        request = factory.post('/api/v1/projects/p1/tickets/my/')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.list_my_tickets', return_value=([{'_pk': 1}], ['title'])):
            resp = MyTicketAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200
        assert 'tickets' in resp.data

    def test_post_invalid_view_id_default_open(self, factory, user):
        request = factory.post(
            '/api/v1/projects/p1/tickets/my/',
            data={'view': 'invalid', 'config': {"filters": [], "filter_conjunction": "And", "basic_filters": [], "sorts": []}},
            format='json',
        )
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.list_my_tickets', return_value=([], [])) as list_my_tickets_mock:
            resp = MyTicketAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200
        assert list_my_tickets_mock.call_args[0][3] == 'open'


class TestTicketMetadataAPIView:
    def test_feature_not_enabled(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/meta/')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = TicketMetadataAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/meta/')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.get_current_table_metadata', return_value={'columns': [{'name': 'tags'}]}):
            resp = TicketMetadataAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200

    def test_get_permission_denied(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/meta/')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=False):
            resp = TicketMetadataAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403


class TestTicketTrashAPIView:
    def test_feature_not_enabled(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/trash/')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = TicketTrashAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 403

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/trash/')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.list_trash_tickets', return_value=([{'_pk': 1}], ['title'])):
            resp = TicketTrashAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200
        assert 'tickets' in resp.data

    def test_delete_no_deleted_tickets(self, factory, user):
        request = factory.delete('/api/v1/projects/p1/tickets/trash/', data={}, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_deleted_tickets_ids', return_value=[]):
            resp = TicketTrashAPIView.as_view()(request, project_uuid='p1')
        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert seadb_api.delete_rows.call_count == 0


class TestTicketCommentsAPIView:
    def test_get_feature_not_enabled(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/1/comments/')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = TicketCommentsAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 403

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/1/comments/')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1}
        metadata = {}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.get_ticket_comments', return_value=[{'_pk': 2}]):
            resp = TicketCommentsAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 200
        assert 'ticket_comments' in resp.data

    def test_get_invalid_pagination_use_default(self, factory, user):
        request = factory.get('/api/v1/projects/p1/tickets/1/comments/', {'page': 'a', 'per_page': 'b'})
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1}
        metadata = {}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.get_ticket_comments', return_value=[]) as get_comments_mock:
            resp = TicketCommentsAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 200
        assert get_comments_mock.call_args[0][-2:] == (25, 50)

    def test_post_creation_interval_too_frequent(self, factory, user):
        data = {'content': json.dumps({'text': 'hi'})}
        request = factory.post('/api/v1/projects/p1/tickets/1/comments/', data=data)
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1, 'participants': []}
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_project_permission', return_value=True), \
                patch('seahub.tickets.tickets.check_ticket_comment_creation_interval', return_value=False):
            resp = TicketCommentsAPIView.as_view()(request, project_uuid='p1', ticket_id='1')
        assert resp.status_code == 429


class TestTicketCommentAPIView:
    def test_put_feature_not_enabled(self, factory, user):
        request = factory.put('/api/v1/projects/p1/tickets/1/comments/1/', data={}, format='json')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = TicketCommentAPIView.as_view()(request, project_uuid='p1', ticket_id='1', comment_id='1')
        assert resp.status_code == 403

    def test_put_missing_content(self, factory, user):
        request = factory.put('/api/v1/projects/p1/tickets/1/comments/1/', data={}, format='json')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            resp = TicketCommentAPIView.as_view()(request, project_uuid='p1', ticket_id='1', comment_id='1')
        assert resp.status_code == 400

    def test_put_comment_not_found(self, factory, user):
        data = {'content': json.dumps({'text': 'hi'})}
        request = factory.put('/api/v1/projects/p1/tickets/1/comments/1/', data=data, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        ticket = {'_pk': 1}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.get_ticket_comment_by_pk', return_value=None):
            resp = TicketCommentAPIView.as_view()(request, project_uuid='p1', ticket_id='1', comment_id='1')
        assert resp.status_code == 404

    def test_put_too_frequent(self, factory, user):
        data = {'content': json.dumps({'text': 'hi'})}
        request = factory.put('/api/v1/projects/p1/tickets/1/comments/1/', data=data, format='json')
        request.user = user
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        now = datetime.datetime(2025, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
        ticket = {'_pk': 1}
        ticket_comment = {'_pk': 2, 'modified_time': (now - datetime.timedelta(seconds=5)).isoformat()}
        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.get_ticket_comment_by_pk', return_value=ticket_comment), \
                patch('seahub.tickets.tickets.check_comment_permission', return_value=True), \
                patch('seahub.tickets.tickets.timezone.now', return_value=now):
            resp = TicketCommentAPIView.as_view()(request, project_uuid='p1', ticket_id='1', comment_id='1')
        assert resp.status_code == 429

    def test_delete_feature_not_enabled(self, factory, user):
        request = factory.delete('/api/v1/projects/p1/tickets/1/comments/1/', data={}, format='json')
        request.user = user
        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            resp = TicketCommentAPIView.as_view()(request, project_uuid='p1', ticket_id='1', comment_id='1')
        assert resp.status_code == 403

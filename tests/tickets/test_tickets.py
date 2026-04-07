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
    def test_get_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/projects/{project.uuid}/tickets/', {})
        request.user = no_org_user
        response = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert response.status_code == 403

    def test_get_missing_view_id(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f'/api/v1/projects/{project.uuid}/tickets/', {})
        request.user = project_creator
        response = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert response.status_code == 400

    def test_get_invalid_start_limit(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(
            f'/api/v1/projects/{project.uuid}/tickets/',
            {'view_id': 'v1', 'start': '-1', 'limit': '-10'},
        )
        request.user = project_creator
        response = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert response.status_code == 400

    def test_get_non_int_start_limit_use_default(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(
            f"/api/v1/projects/{project.uuid}/tickets/",
            {'view_id': 'v1', 'start': 'a', 'limit': 'b'},
        )
        request.user = project_creator
        with patch('seahub.tickets.tickets.TicketViews.objects.get_view', return_value=Mock()), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.list_tickets_view_records') as list_mock:
            list_mock.return_value = ([], [])
            response = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert response.status_code == 200
        list_mock.assert_called_once()
        assert list_mock.call_args[0][-2:] == (0, 1000)

    def test_get_project_not_found(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        request = factory.get(
            f'/api/v1/projects/{project_uuid}/tickets/',
            {'view_id': 'v1', 'start': '0', 'limit': '10'},
        )
        request.user = project_creator
        response = TicketsAPIView.as_view()(request, project_uuid=project_uuid)
        assert response.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/", {'view_id': 'v1'})
        request.user = auth_user
        response = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert response.status_code == 403

    def test_get_success(self, factory, project_creator, real_project, ticket_views_record):
        project = real_project
        request = factory.get(
            f"/api/v1/projects/{project.uuid}/tickets/",
            {'view_id': 'v1', 'start': '0', 'limit': '10'},
        )
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.list_tickets_view_records') as list_mock:
            seadb_cls_mock.return_value = Mock()
            list_mock.return_value = ([{'_pk': 1, 'title': 'test_ticket'}], [])
            response = TicketsAPIView.as_view()(request, project_uuid=str(project.uuid))
        assert response.status_code == 200
        assert 'tickets' in response.data
        assert len(response.data['tickets']) == 1

    def test_get_internal_server_error(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/", {'view_id': 'v1'})
        request.user = project_creator
        with patch('seahub.tickets.tickets.TicketViews.objects.get_view', side_effect=Exception('err')):
            response = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert response.status_code == 500

    def test_post_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        data = {'title': 't', 'content': json.dumps({'text': 'c'})}
        request = factory.post(f'/api/v1/projects/{project.uuid}/tickets/', data=data)
        request.user = no_org_user
        resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403

    def test_post_assignees_invalid_json(self, factory, project_creator, real_project):
        project = real_project
        data = {
            'title': 't',
            'content': json.dumps({'text': 'c'}),
            'assignees': '{',
        }
        request = factory.post(f'/api/v1/projects/{project.uuid}/tickets/', data=data)
        request.user = project_creator
        resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 400

    def test_post_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        data = {'title': 't', 'content': json.dumps({'text': 'c'})}
        request = factory.post(f"/api/v1/projects/{project.uuid}/tickets/", data=data)
        request.user = auth_user
        resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403

    def test_post_creation_interval_too_frequent(self, factory, project_creator, real_project):
        project = real_project
        data = {'title': 't', 'content': json.dumps({'text': 'c'})}
        request = factory.post(f"/api/v1/projects/{project.uuid}/tickets/", data=data)
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.check_ticket_creation_interval', return_value=False):
            resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 429

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        data = {
            'title': 't',
            'content': json.dumps({'text': 'c'}),
            'priority': '7',
            'tags': '[]',
            'assignees': '[]',
        }
        request = factory.post(f"/api/v1/projects/{project.uuid}/tickets/", data=data)
        request.user = project_creator
        seadb_api = Mock()
        seadb_api.insert_rows.return_value = {'pks': [1]}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.check_ticket_creation_interval', return_value=True):
            resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 201
        assert resp.data['ticket']['_pk'] == 1
        assert resp.data['ticket']['priority'] == 5

    def test_put_missing_data(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(f'/api/v1/projects/{project.uuid}/tickets/', data={}, format='json')
        request.user = project_creator
        resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 400

    def test_put_row_id_invalid(self, factory, project_creator, real_project):
        project = real_project
        data = {'tickets_data': [{'row': {'state': 'closed'}}]}
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/", data=data, format='json')
        request.user = project_creator
        resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 400

    def test_put_invalid_content(self, factory, project_creator, real_project):
        project = real_project
        data = {'tickets_data': [{'row_id': '1', 'row': {'content': 'invalid'}}]}
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/", data=data, format='json')
        request.user = project_creator
        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'results': [{'_pk': 1}]}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api):
            resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 400

    def test_put_success_update_state_closed(self, factory, project_creator, real_project):
        project = real_project
        data = {'tickets_data': [{'row_id': '1', 'row': {'state': 'Closed'}}]}
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/", data=data, format='json')
        request.user = project_creator
        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'results': [{'_pk': 1}]}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api):
            resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert seadb_api.update_rows.call_count == 1
        update_rows = seadb_api.update_rows.call_args[0][2]
        assert update_rows[0]['row']['state'] == 'closed'
        assert 'closed_time' in update_rows[0]['row']

    def test_delete_missing_ticket_ids(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f'/api/v1/projects/{project.uuid}/tickets/', data={}, format='json')
        request.user = project_creator
        resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 400

    def test_delete_partial_success(self, factory, project_creator, real_project):
        project = real_project
        data = {'ticket_ids': ['1', '2']}
        request = factory.delete(f"/api/v1/projects/{project.uuid}/tickets/", data=data, format='json')
        request.user = project_creator
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_tickets_by_ids', return_value=[{'_pk': 1}]):
            resp = TicketsAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200
        assert set(resp.data['success']) == {'1'}
        assert set(resp.data['failed']) == {'2'}


class TestTicketAPIView:
    def test_get_ticket_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/1/")
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.get_ticket', return_value=(None, None)):
            seadb_cls_mock.return_value = Mock()
            resp = TicketAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 404

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/1/")
        request.user = project_creator
        ticket = {'_pk': 1, 'title': 'test_ticket'}
        metadata = {'columns': []}
        with patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.convert_ticket_select_column_name_to_option_id'), \
                patch('seahub.tickets.tickets.get_ticket_comments', return_value=[]):
            seadb_cls_mock.return_value = Mock()
            resp = TicketAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 200
        assert 'ticket' in resp.data

    def test_put_ticket_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/1/", data={'title': 't'}, format='json')
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(None, None)):
            resp = TicketAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 404

    def test_put_permission_denied(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/1/", data={'title': 't'}, format='json')
        request.user = project_creator
        ticket = {'_pk': 1}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_ticket_permission', return_value=False):
            resp = TicketAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 403

    def test_put_priority_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/1/", data={'priority': 'abc'}, format='json')
        request.user = project_creator
        ticket = {'_pk': 1}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_ticket_permission', return_value=True):
            resp = TicketAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 400

    def test_put_success_state_closed_and_participants(self, factory, project_creator, real_project):
        project = real_project
        data = {'state': 'CLOSED', 'priority': '7'}
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/1/", data=data, format='json')
        request.user = project_creator
        ticket = {'_pk': 1, 'participants': []}
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_ticket_permission', return_value=True):
            resp = TicketAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 200
        assert seadb_api.update_rows.call_count == 1
        update_row = seadb_api.update_rows.call_args[0][2][0]['row']
        assert update_row['state'] == 'closed'
        assert 'closed_time' in update_row
        assert project_creator.username in update_row['participants']
        assert update_row['priority'] == 5

    def test_delete_ticket_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/projects/{project.uuid}/tickets/1/", data={}, format='json')
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(None, None)):
            resp = TicketAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 404


class TestTicketsSearchAPIView:
    def test_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/projects/{project.uuid}/tickets/search/', {'query': ''})
        request.user = no_org_user
        resp = TicketsSearchAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/search/", {'query': 'test'})
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.list_tickets_by_search', return_value=[{'_pk': 1, 'title': 'T'}]):
            resp = TicketsSearchAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200
        assert 'tickets' in resp.data

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/search/", {'query': 'test'})
        request.user = auth_user
        resp = TicketsSearchAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403


class TestMyTicketAPIView:
    def test_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.post(f"/api/v1/projects/{project.uuid}/tickets/my/")
        request.user = no_org_user
        resp = MyTicketAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/projects/{project.uuid}/tickets/my/")
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.list_my_tickets', return_value=([{'_pk': 1}], ['title'])):
            resp = MyTicketAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200
        assert 'tickets' in resp.data

    def test_post_invalid_view_id_default_open(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/projects/{project.uuid}/tickets/my/",
            data={'view': 'invalid', 'config': {"filters": [], "filter_conjunction": "And", "basic_filters": [], "sorts": []}},
            format='json',
        )
        request.user = project_creator
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.list_my_tickets', return_value=([], [])) as list_my_tickets_mock:
            resp = MyTicketAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200
        assert list_my_tickets_mock.call_args[0][3] == 'open'


class TestTicketMetadataAPIView:
    def test_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/meta/")
        request.user = no_org_user
        resp = TicketMetadataAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/meta/")
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.get_current_table_metadata', return_value={'columns': [{'name': 'tags'}]}):
            resp = TicketMetadataAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/meta/")
        request.user = auth_user
        resp = TicketMetadataAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403


class TestTicketTrashAPIView:
    def test_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/trash/")
        request.user = no_org_user
        resp = TicketTrashAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/trash/")
        request.user = project_creator
        with patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.list_trash_tickets', return_value=([{'_pk': 1}], ['title'])):
            resp = TicketTrashAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200
        assert 'tickets' in resp.data

    def test_delete_no_deleted_tickets(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/projects/{project.uuid}/tickets/trash/", data={}, format='json')
        request.user = project_creator
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_deleted_tickets', return_value=[]):
            resp = TicketTrashAPIView.as_view()(request, project_uuid=project.uuid)
        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert seadb_api.delete_rows.call_count == 0

    def test_delete_with_portal_issue_links(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/projects/{project.uuid}/tickets/trash/", data={}, format='json')
        request.user = project_creator

        seadb_api = Mock()
        # Portal issues query returns issue with linked_ticket pointing to deleted ticket
        seadb_api.query_rows.return_value = {'results': [{'_pk': 5, 'linked_ticket': 1}]}
        deleted_tickets = [{'ticket_id': 1, 'linked_connection_records': ['portal_5']}]

        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_deleted_tickets', return_value=deleted_tickets), \
                patch('seahub.tickets.tickets.delete_record_attachments_from_s3'), \
                patch('seahub.tickets.tickets.delete_ticket_comments_by_ids'), \
                patch('seahub.tickets.tickets.delete_ticket_activities_by_ids'):
            resp = TicketTrashAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['success'] is True
        # Should update portal issues to clear linked_ticket
        portal_update_call = seadb_api.update_rows.call_args_list[0]
        update_row = portal_update_call[0][2][0]
        assert update_row['pk'] == 5
        assert update_row['row']['linked_ticket'] is None
        seadb_api.delete_rows.assert_called_once()

    def test_delete_with_connection_and_portal_links(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/projects/{project.uuid}/tickets/trash/", data={}, format='json')
        request.user = project_creator

        seadb_api = Mock()
        # Portal issues query
        seadb_api.query_rows.return_value = {'results': [{'_pk': 5, 'linked_ticket': 1}]}
        deleted_tickets = [{'ticket_id': 1, 'linked_connection_records': ['1_100', 'portal_5']}]

        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_deleted_tickets', return_value=deleted_tickets), \
                patch('seahub.tickets.tickets.delete_record_attachments_from_s3'), \
                patch('seahub.tickets.tickets.delete_ticket_comments_by_ids'), \
                patch('seahub.tickets.tickets.delete_ticket_activities_by_ids'), \
                patch('seahub.tickets.tickets.ProjectConnections') as mock_conn_cls:
            # Need to mock connection lookup
            mock_conn = Mock()
            mock_conn.id = 1
            mock_conn.type = 'discourse'
            mock_conn_cls.objects.filter.return_value = [mock_conn]
            with patch('seahub.tickets.tickets.get_connection_table_name', return_value='discourse_1'):
                resp = TicketTrashAPIView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestTicketCommentsAPIView:
    def test_get_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f'/api/v1/projects/{project.uuid}/tickets/1/comments/')
        request.user = no_org_user
        resp = TicketCommentsAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/1/comments/")
        request.user = project_creator
        ticket = {'_pk': 1}
        metadata = {}
        with patch('seahub.tickets.tickets.SeaDBAPI'), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.get_ticket_comments', return_value=[{'_pk': 2}]):
            resp = TicketCommentsAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 200
        assert 'ticket_comments' in resp.data

    def test_get_invalid_pagination_use_default(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/projects/{project.uuid}/tickets/1/comments/", {'page': 'a', 'per_page': 'b'})
        request.user = project_creator
        ticket = {'_pk': 1}
        metadata = {}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.get_ticket_comments', return_value=[]) as get_comments_mock:
            resp = TicketCommentsAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 200
        assert get_comments_mock.call_args[0][-2:] == (25, 50)

    def test_post_creation_interval_too_frequent(self, factory, project_creator, real_project):
        project = real_project
        data = {'content': json.dumps({'text': 'hi'})}
        request = factory.post(f"/api/v1/projects/{project.uuid}/tickets/1/comments/", data=data)
        request.user = project_creator
        ticket = {'_pk': 1, 'participants': []}
        seadb_api = Mock()
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.check_ticket_comment_creation_interval', return_value=False):
            resp = TicketCommentsAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1')
        assert resp.status_code == 429


class TestTicketCommentAPIView:
    def test_put_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.put(f'/api/v1/projects/{project.uuid}/tickets/1/comments/1/', data={}, format='json')
        request.user = no_org_user
        resp = TicketCommentAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1', comment_id='1')
        assert resp.status_code == 403

    def test_put_missing_content(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(f'/api/v1/projects/{project.uuid}/tickets/1/comments/1/', data={}, format='json')
        request.user = project_creator
        resp = TicketCommentAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1', comment_id='1')
        assert resp.status_code == 400

    def test_put_comment_not_found(self, factory, project_creator, real_project):
        project = real_project
        data = {'content': json.dumps({'text': 'hi'})}
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/1/comments/1/", data=data, format='json')
        request.user = project_creator
        ticket = {'_pk': 1}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.get_ticket_comment_by_pk', return_value=None):
            resp = TicketCommentAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1', comment_id='1')
        assert resp.status_code == 404

    def test_put_too_frequent(self, factory, project_creator, real_project):
        project = real_project
        data = {'content': json.dumps({'text': 'hi'})}
        request = factory.put(f"/api/v1/projects/{project.uuid}/tickets/1/comments/1/", data=data, format='json')
        request.user = project_creator
        now = datetime.datetime(2025, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
        ticket = {'_pk': 1}
        ticket_comment = {'_pk': 2, 'modified_time': (now - datetime.timedelta(seconds=5)).isoformat()}
        with patch('seahub.tickets.tickets.SeaDBAPI', return_value=Mock()), \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, {})), \
                patch('seahub.tickets.tickets.get_ticket_comment_by_pk', return_value=ticket_comment), \
                patch('seahub.tickets.tickets.timezone.now', return_value=now):
            resp = TicketCommentAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1', comment_id='1')
        assert resp.status_code == 429

    def test_delete_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.delete(f'/api/v1/projects/{project.uuid}/tickets/1/comments/1/', data={}, format='json')
        request.user = no_org_user
        resp = TicketCommentAPIView.as_view()(request, project_uuid=project.uuid, ticket_id='1', comment_id='1')
        assert resp.status_code == 403

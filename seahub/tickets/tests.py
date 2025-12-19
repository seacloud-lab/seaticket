# -*- coding: utf-8 -*-

import json
from unittest import TestCase
from unittest.mock import Mock, patch

from rest_framework.test import APIRequestFactory

from seahub.tickets.tickets import (
    TicketsAPIView,
    TicketAPIView,
    TicketCommentsAPIView,
)
from seahub.tickets.ticket_types import TicketTypesAPIView, TicketTypeAPIView
from seahub.tickets.ticket_tags import TicketTagsAPIView, TicketTagAPIView
from seahub.tickets.ticket_substates import TicketSubstatesAPIView, TicketSubstateAPIView
from seahub.tickets.ticket_views import (
    TicketFolders,
    TicketViewsAPI,
    TicketViewView,
    TicketViewsDuplicateView,
    TicketViewsMoveView,
)


class TicketAPITestBase(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = Mock()
        self.user.id = 1
        self.user.pk = 1
        self.user.username = 'test@seafile.com'


class TicketsAPIViewGetTest(TicketAPITestBase):

    def _view(self):
        return TicketsAPIView.as_view()

    def test_feature_not_enabled(self):
        request = self.factory.get('/api/v2.1/projects/p1/tickets/', {})
        request.user = self.user

        with patch('seahub.tickets.tickets.is_org_context', return_value=False):
            response = self._view()(request, project_uuid='p1')

        self.assertEqual(response.status_code, 403)

    def test_missing_view_id(self):
        request = self.factory.get('/api/v2.1/projects/p1/tickets/', {})
        request.user = self.user

        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            response = self._view()(request, project_uuid='p1')

        self.assertEqual(response.status_code, 400)

    def test_get_success(self):
        request = self.factory.get(
            '/api/v2.1/projects/p1/tickets/',
            {'view_id': 'v1', 'start': '0', 'limit': '10'},
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.tickets.TicketViews.objects.get_view') as get_view_mock, \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.list_tickets_view_records') as list_mock:

            get_view_mock.return_value = Mock()
            seadb_cls_mock.return_value = Mock()
            list_mock.return_value = ([{'_pk': 1, 'title': 'test_ticket'}], ['col1'])

            response = self._view()(request, project_uuid='p1')

        self.assertEqual(response.status_code, 200)
        self.assertIn('tickets', response.data)
        self.assertEqual(len(response.data['tickets']), 1)


class TicketsAPIViewPostTest(TicketAPITestBase):
    def _view(self):
        return TicketsAPIView.as_view()

    def test_missing_title(self):
        payload = {'content': json.dumps({'text': 'hello'})}
        request = self.factory.post('/api/v2.1/projects/p1/tickets/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            response = self._view()(request, project_uuid='p1')

        self.assertEqual(response.status_code, 400)

    def test_invalid_priority_type(self):
        payload = {
            'title': 'test_ticket',
            'content': json.dumps({'text': 'hello'}),
            'priority': 'abc',
        }
        request = self.factory.post('/api/v2.1/projects/p1/tickets/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.check_ticket_creation_interval',
                      return_value=True):

            seadb_cls_mock.return_value = Mock()
            response = self._view()(request, project_uuid='p1')

        self.assertEqual(response.status_code, 400)

    def test_create_success(self):
        payload = {
            'title': 'test_ticket',
            'content': json.dumps({'text': 'hello'}),
        }
        request = self.factory.post('/api/v2.1/projects/p1/tickets/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        seadb_instance = Mock()
        seadb_instance.insert_rows.return_value = {'pks': [1]}

        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI', return_value=seadb_instance), \
                patch('seahub.tickets.tickets.check_ticket_creation_interval',
                      return_value=True), \
                patch('seahub.tickets.tickets.upload_files_to_s3'), \
                patch('seahub.tickets.tickets.replace_file_url_in_content'):

            response = self._view()(request, project_uuid='p1')

        self.assertEqual(response.status_code, 201)
        self.assertIn('ticket', response.data)
        self.assertEqual(response.data['ticket']['_pk'], 1)


class TicketAPIViewGetTest(TicketAPITestBase):
    def _view(self):
        return TicketAPIView.as_view()

    def test_ticket_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/tickets/1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.get_ticket', return_value=(None, None)):

            seadb_cls_mock.return_value = Mock()
            response = self._view()(request, project_uuid='p1', ticket_id='1')

        self.assertEqual(response.status_code, 404)

    def test_get_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/tickets/1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        ticket = {'_pk': 1, 'title': 'test_ticket'}
        metadata = {'columns': []}

        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.tickets.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.get_ticket', return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.convert_ticket_select_column_name_to_option_id'), \
                patch('seahub.tickets.tickets.get_ticket_comments', return_value=[]):

            seadb_cls_mock.return_value = Mock()
            response = self._view()(request, project_uuid='p1', ticket_id='1')

        self.assertEqual(response.status_code, 200)
        self.assertIn('ticket', response.data)
        self.assertEqual(response.data['ticket']['_pk'], 1)


class TicketCommentsAPIViewPostTest(TicketAPITestBase):
    def _view(self):
        return TicketCommentsAPIView.as_view()

    def test_missing_content(self):
        request = self.factory.post(
            '/api/v2.1/projects/p1/tickets/1/comments/', data={}
        )
        request.user = self.user

        with patch('seahub.tickets.tickets.is_org_context', return_value=True):
            response = self._view()(request, project_uuid='p1', ticket_id='1')

        self.assertEqual(response.status_code, 400)

    def test_ticket_not_found(self):
        payload = {'content': json.dumps({'text': 'hello'})}
        request = self.factory.post(
            '/api/v2.1/projects/p1/tickets/1/comments/', data=payload
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI') as seadb_cls_mock, \
                patch('seahub.tickets.tickets.get_ticket',
                      return_value=(None, None)):

            seadb_cls_mock.return_value = Mock()
            response = self._view()(request, project_uuid='p1', ticket_id='1')

        self.assertEqual(response.status_code, 404)

    def test_create_comment_success(self):
        payload = {'content': json.dumps({'text': 'hello'})}
        request = self.factory.post(
            '/api/v2.1/projects/p1/tickets/1/comments/', data=payload
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        ticket = {'_pk': 1, 'participants': []}
        metadata = {}

        seadb_instance = Mock()
        seadb_instance.insert_rows.return_value = {'pks': [10]}
        seadb_instance.query_rows.return_value = {'results': [{'count': 1}]}

        with patch('seahub.tickets.tickets.is_org_context', return_value=True), \
                patch('seahub.tickets.tickets.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.tickets.SeaDBAPI',
                      return_value=seadb_instance), \
                patch('seahub.tickets.tickets.get_ticket',
                      return_value=(ticket, metadata)), \
                patch('seahub.tickets.tickets.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.tickets.check_ticket_comment_creation_interval',
                      return_value=True), \
                patch('seahub.tickets.tickets.upload_files_to_s3'), \
                patch('seahub.tickets.tickets.replace_file_url_in_content'):

            response = self._view()(request, project_uuid='p1', ticket_id='1')

        self.assertEqual(response.status_code, 201)
        self.assertIn('ticket_comment', response.data)
        self.assertEqual(response.data['ticket_comment']['number'], 10)

class TicketTypesAPIViewTest(TicketAPITestBase):
    def _view(self):
        return TicketTypesAPIView.as_view()

    def test_get_feature_not_enabled(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-types/')
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 403)

    def test_get_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-types/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI'), \
                patch('seahub.tickets.ticket_types.get_ticket_counts_group_by_column_name',
                      return_value=([{'id': 't1', 'name': 'bug'}], None)):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('types', resp.data)

    def test_post_missing_name(self):
        payload = {'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-types/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 400)

    def test_post_success(self):
        payload = {'name': 'bug', 'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-types/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': []}}
        table_meta = {'id': 'tbl', 'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_types.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_types.get_column_from_columns_by_name',
                      return_value=column), \
                patch('seahub.tickets.ticket_types.add_select_option',
                      return_value={'id': 't1', 'name': 'bug'}):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 201)
        self.assertIn('type', resp.data)

    def test_delete_missing_type_ids(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-types/', data={}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 400)

    def test_delete_success(self):
        payload = {'type_ids': ['t1']}
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-types/', data=payload, format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        table_meta = {'id': 'tbl', 'columns': [{'key': 'k'}]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_types.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_types.get_column_from_columns_by_name',
                      return_value=table_meta['columns'][0]), \
                patch('seahub.tickets.ticket_types.batch_delete_select_option'):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])


class TicketTypeAPIViewTest(TicketAPITestBase):
    def _view(self):
        return TicketTypeAPIView.as_view()

    def test_get_type_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-types/t1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        table_meta = {'columns': [{'data': {'options': []}}]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_types.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_types.get_column_from_columns_by_name',
                      return_value=table_meta['columns'][0]):

            resp = self._view()(request, project_uuid='p1', type_id='t1')

        self.assertEqual(resp.status_code, 404)

    def test_put_type_success(self):
        payload = {'name': 'bug2'}
        request = self.factory.put(
            '/api/v2.1/projects/p1/ticket-types/t1/', data=payload, format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        type_option = {'id': 't1', 'name': 'bug'}
        column = {'key': 'k', 'data': {'options': [type_option]}}
        table_meta = {'id': 'tbl', 'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_types.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_types.get_column_from_columns_by_name',
                      return_value=column), \
                patch('seahub.tickets.ticket_types.update_select_option'):

            resp = self._view()(request, project_uuid='p1', type_id='t1')

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])

    def test_delete_type_success(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-types/t1/', data={}, format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'bug'}]}}
        table_meta = {'id': 'tbl', 'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_types.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_types.get_column_from_columns_by_name',
                      return_value=column), \
                patch('seahub.tickets.ticket_types.SeaDBAPI.delete_column_option'):

            # delete_column_option 是实例方法，这里只关心不会抛异常即可
            resp = self._view()(request, project_uuid='p1', type_id='t1')

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])

class TicketTagsAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketTagsAPIView.as_view()

    def test_get_tags_feature_not_enabled(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/')
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 403)

    def test_get_tags_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI'), \
                patch('seahub.tickets.ticket_tags.get_ticket_counts_group_by_column_name',
                      return_value=([{'id': 'tag1', 'name': 't'}], None)):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('tags', resp.data)

    def test_post_tag_missing_name(self):
        payload = {'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-tags/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 400)

    def test_post_tag_success(self):
        payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-tags/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': []}}
        table_meta = {'id': 'tbl', 'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name',
                      return_value=column), \
                patch('seahub.tickets.ticket_tags.add_select_option',
                      return_value={'id': 'tag1', 'name': 'tag1'}):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 201)
        self.assertIn('tag', resp.data)

    def test_delete_tags_missing_ids(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-tags/', data={}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 400)

    def test_delete_tags_success(self):
        payload = {'tag_ids': ['tag1']}
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-tags/', data=payload, format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k'}
        table_meta = {'id': 'tbl', 'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name',
                      return_value=column), \
                patch('seahub.tickets.ticket_tags.batch_delete_select_option'):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])


class TicketTagAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketTagAPIView.as_view()

    def test_get_tag_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/t1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'data': {'options': []}}
        table_meta = {'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name',
                      return_value=column):

            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        self.assertEqual(resp.status_code, 404)

    def test_get_tag_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/t1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        tag_option = {'id': 't1', 'name': 'tag1'}
        column = {'data': {'options': [tag_option]}}
        table_meta = {'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name',
                      return_value=column), \
                patch('seahub.tickets.ticket_tags.filter_tickets_by_select',
                      return_value=([{'_pk': 1}], ['c'])):

            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('tickets', resp.data)

class TicketSubstatesAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketSubstatesAPIView.as_view()

    def test_get_substates_feature_not_enabled(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/')
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 403)

    def test_get_substates_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        substate_column = {'data': {'cascade_settings': {}, 'cascade_column_key': 'state'}}

        seadb = Mock()

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_ticket_counts_group_by_column_name',
                      return_value=([{'id': 's1', 'name': 'open'}], substate_column)):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('substates', resp.data)

    def test_post_substate_missing_name(self):
        payload = {'color': '#fff', 'text_color': '#000', 'parent_id': 'st1'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-substates/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 400)

    def test_delete_substates_missing_ids(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-substates/', data={}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 400)


class TicketSubstateAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketSubstateAPIView.as_view()

    def test_get_substate_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/s1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'data': {'options': []}}
        table_meta = {'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name',
                      return_value=column):

            resp = self._view()(request, project_uuid='p1', substate_id='s1')

        self.assertEqual(resp.status_code, 404)

    def test_get_substate_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/s1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        substate_option = {'id': 's1', 'name': 'open'}
        column = {'data': {'options': [substate_option]}}
        table_meta = {'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid',
                      return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_current_table_metadata',
                      return_value=table_meta), \
                patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name',
                      return_value=column), \
                patch('seahub.tickets.ticket_substates.filter_tickets_by_select',
                      return_value=([{'_pk': 1}], ['c'])):

            resp = self._view()(request, project_uuid='p1', substate_id='s1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('tickets', resp.data)

class TicketFoldersAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketFolders.as_view()

    def test_post_folder_missing_name(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-folders/', data={})
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        self.assertEqual(resp.status_code, 400)

    def test_post_folder_success(self):
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-folders/', data={'name': 'folder1'}
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record',
                      return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.add_folder',
                      return_value={'_id': 'f1', 'name': 'folder1'}):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('folder', resp.data)


class TicketViewsAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketViewsAPI.as_view()

    def test_get_views_project_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-views/')
        request.user = self.user

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=None):
            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 404)

    def test_get_views_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-views/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.list_views',
                      return_value=[{'id': 'v1', 'name': 'view1'}]):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)

    def test_post_view_missing_name(self):
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/', data={}, format='json'
        )
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        self.assertEqual(resp.status_code, 400)


class TicketViewViewAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketViewView.as_view()

    def test_get_view_record_not_exists(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-views/v1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record',
                      return_value=None):

            resp = self._view()(request, project_uuid='p1', view_id='v1')

        self.assertEqual(resp.status_code, 404)

    def test_get_view_success(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-views/v1/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record',
                      return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_view',
                      return_value={'id': 'v1'}):

            resp = self._view()(request, project_uuid='p1', view_id='v1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('view', resp.data)


class TicketViewsDuplicateAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketViewsDuplicateView.as_view()

    def test_post_duplicate_missing_view_id(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/duplicate/', data={})
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        self.assertEqual(resp.status_code, 400)

    def test_post_duplicate_success(self):
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/duplicate/',
            data={'view_id': 'v1'},
            format='json',
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()
        record.views_ids = ['v1']
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record',
                      return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.duplicate_view',
                      return_value={'id': 'v2'}):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertIn('view', resp.data)


class TicketViewsMoveAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketViewsMoveView.as_view()

    def test_post_move_missing_source(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/move/', data={})
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        self.assertEqual(resp.status_code, 400)

    def test_post_move_missing_target(self):
        data = {'source_view_id': 'v1'}
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/move/', data=data, format='json'
        )
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        self.assertEqual(resp.status_code, 400)

    def test_post_move_success(self):
        data = {
            'source_view_id': 'v1',
            'target_view_id': 'v2',
            'is_above_folder': False,
        }
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/move/', data=data, format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()
        record.views_ids = ['v1', 'v2']
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission',
                      return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record',
                      return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.move_view',
                      return_value={'navigation': ['v1', 'v2']}):

            resp = self._view()(request, project_uuid='p1')

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['navigation'], ['v1', 'v2'])

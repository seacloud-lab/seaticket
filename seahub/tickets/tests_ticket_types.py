# -*- coding: utf-8 -*-

from unittest.mock import Mock, patch

from seahub.tickets.tests import TicketAPITestBase
from seahub.tickets.ticket_types import TicketTypesAPIView, TicketTypeAPIView


class TicketTypesAPIViewTest(TicketAPITestBase):
    def _view(self):
        return TicketTypesAPIView.as_view()

    def test_get_feature_not_enabled(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-types/')
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

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

        assert resp.status_code == 200
        assert 'types' in resp.data

    def test_get_project_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-types/')
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid', return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_get_permission_denied(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-types/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_missing_name(self):
        payload = {'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-types/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_feature_not_enabled(self):
        payload = {'name': 'bug', 'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-types/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_duplicate_name(self):
        payload = {'name': 'bug', 'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-types/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'bug'}]}}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

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

        assert resp.status_code == 201
        assert 'type' in resp.data

    def test_delete_missing_type_ids(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-types/', data={}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_delete_feature_not_enabled(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-types/', data={'type_ids': ['t1']}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

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

        assert resp.status_code == 200
        assert resp.data['success'] is True


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

        assert resp.status_code == 404

    def test_put_type_argument_invalid(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-types/t1/', data={}, format='json')
        request.user = self.user

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1', type_id='t1')

        assert resp.status_code == 400

    def test_delete_type_not_found(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-types/t1/', data={}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': []}}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_types.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_types.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_types.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_types.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_types.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_types.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1', type_id='t1')

        assert resp.status_code == 404

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

        assert resp.status_code == 200
        assert resp.data['success'] is True

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

            resp = self._view()(request, project_uuid='p1', type_id='t1')

        assert resp.status_code == 200
        assert resp.data['success'] is True

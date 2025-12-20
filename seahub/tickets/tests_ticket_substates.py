# -*- coding: utf-8 -*-

from unittest.mock import Mock, patch

from seahub.tickets.tests import TicketAPITestBase
from seahub.tickets.ticket_substates import TicketSubstatesAPIView, TicketSubstateAPIView


class TicketSubstatesAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketSubstatesAPIView.as_view()

    def test_get_substates_feature_not_enabled(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/')
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

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

        assert resp.status_code == 200
        assert 'substates' in resp.data

    def test_get_substates_project_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/')
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid', return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_get_substates_permission_denied(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_get_substates_filter_by_state_id(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-substates/', {'state_id': 'st1'})
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        substate_column = {
            'data': {
                'cascade_settings': {'st1': ['s1'], 'st2': ['s2']},
                'cascade_column_key': 'state',
            }
        }

        seadb = Mock()

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_ticket_counts_group_by_column_name',
                      return_value=([
                          {'id': 's1', 'name': 'sub1'},
                          {'id': 's2', 'name': 'sub2'},
                      ], substate_column)):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert resp.data['cascade_column_key'] == 'state'
        assert len(resp.data['substates']) == 1
        assert resp.data['substates'][0]['id'] == 's1'

    def test_post_substate_missing_name(self):
        payload = {'color': '#fff', 'text_color': '#000', 'parent_id': 'st1'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-substates/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_delete_substates_feature_not_enabled(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-substates/', data={'substate_ids': ['s1']}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_delete_substates_success(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-substates/', data={'substate_ids': ['s1']}, format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k'}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column), \
                patch('seahub.tickets.ticket_substates.batch_delete_select_option'):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_post_substate_missing_parent_id(self):
        payload = {'name': 'sub1', 'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-substates/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_substate_duplicate_name(self):
        payload = {'name': 'sub1', 'color': '#fff', 'text_color': '#000', 'parent_id': 'st1'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-substates/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': [{'id': 's1', 'name': 'sub1'}], 'cascade_settings': {}}}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_substate_success(self):
        payload = {'name': 'sub1', 'color': '#fff', 'text_color': '#000', 'parent_id': 'st1'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-substates/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column_data = {'options': [], 'cascade_settings': {'st1': []}}
        column = {'key': 'k', 'data': column_data}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column), \
                patch('seahub.tickets.ticket_substates.add_select_option', return_value={'id': 's1', 'name': 'sub1'}):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 201
        assert 'substate' in resp.data

    def test_delete_substates_missing_ids(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-substates/', data={}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400


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

        assert resp.status_code == 404

    def test_put_substate_argument_invalid(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-substates/s1/', data={}, format='json')
        request.user = self.user

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1', substate_id='s1')

        assert resp.status_code == 400

    def test_delete_substate_not_found(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-substates/s1/', data={}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': []}}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_substates.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_substates.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_substates.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_substates.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_substates.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_substates.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1', substate_id='s1')

        assert resp.status_code == 404

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

        assert resp.status_code == 200
        assert 'tickets' in resp.data

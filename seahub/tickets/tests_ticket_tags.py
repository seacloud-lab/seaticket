# -*- coding: utf-8 -*-

from unittest.mock import Mock, patch

from seahub.tickets.tests import TicketAPITestBase
from seahub.tickets.ticket_tags import TicketTagsAPIView, TicketTagAPIView


class TicketTagsAPIViewTest(TicketAPITestBase):
    def _view(self):
        return TicketTagsAPIView.as_view()

    def test_get_tags_feature_not_enabled(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/')
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

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

        assert resp.status_code == 200
        assert 'tags' in resp.data

    def test_get_tags_project_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/')
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_get_tags_permission_denied(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_get_tags_internal_server_error(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', side_effect=Exception('err')):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 500

    def test_post_tag_missing_name(self):
        payload = {'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-tags/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_delete_tags_feature_not_enabled(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-tags/', data={'tag_ids': ['t1']}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_tag_feature_not_enabled(self):
        payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-tags/', data=payload)
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_tag_duplicate_name(self):
        payload = {'name': 'tag1', 'color': '#fff', 'text_color': '#000'}
        request = self.factory.post('/api/v2.1/projects/p1/ticket-tags/', data=payload)
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': [{'id': 't1', 'name': 'tag1'}]}}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

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

        assert resp.status_code == 201
        assert 'tag' in resp.data

    def test_delete_tags_missing_ids(self):
        request = self.factory.delete(
            '/api/v2.1/projects/p1/ticket-tags/', data={}, format='json'
        )
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

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

        assert resp.status_code == 200
        assert resp.data['success'] is True


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

        assert resp.status_code == 404

    def test_delete_tag_success(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-tags/t1/', data={}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        tag_option = {'id': 't1', 'name': 'tag1'}
        column = {'key': 'k', 'data': {'options': [tag_option]}}
        table_meta = {'id': 'tbl', 'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert seadb.delete_column_option.call_count == 1

    def test_put_tag_success(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-tags/t1/', data={'name': 'tag2'}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        tag_option = {'id': 't1', 'name': 'tag1'}
        column = {'key': 'k', 'data': {'options': [tag_option]}}
        table_meta = {'id': 'tbl', 'columns': [column]}

        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column), \
                patch('seahub.tickets.ticket_tags.update_select_option'):
            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_get_tag_project_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-tags/t1/')
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=None):
            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        assert resp.status_code == 404

    def test_put_tag_argument_invalid(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-tags/t1/', data={}, format='json')
        request.user = self.user

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True):
            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        assert resp.status_code == 400

    def test_put_tag_not_found(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-tags/t1/', data={'name': 'n2'}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': []}}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        assert resp.status_code == 404

    def test_delete_tag_not_found(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-tags/t1/', data={}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        column = {'key': 'k', 'data': {'options': []}}
        table_meta = {'id': 'tbl', 'columns': [column]}
        seadb = Mock()
        seadb.get_base_metadata.return_value = {'tables': [table_meta]}

        with patch('seahub.tickets.ticket_tags.is_org_context', return_value=True), \
                patch('seahub.tickets.ticket_tags.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_tags.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_tags.SeaDBAPI', return_value=seadb), \
                patch('seahub.tickets.ticket_tags.get_current_table_metadata', return_value=table_meta), \
                patch('seahub.tickets.ticket_tags.get_column_from_columns_by_name', return_value=column):
            resp = self._view()(request, project_uuid='p1', tag_id='t1')

        assert resp.status_code == 404

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

        assert resp.status_code == 200
        assert 'tickets' in resp.data

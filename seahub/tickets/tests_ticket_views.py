# -*- coding: utf-8 -*-

from unittest.mock import Mock, patch

from seahub.tickets.tests import TicketAPITestBase
from seahub.tickets.ticket_views import (
    TicketFolders,
    TicketViewsAPI,
    TicketViewView,
    TicketViewsDuplicateView,
    TicketViewsMoveView,
)


class TicketFoldersAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketFolders.as_view()

    def test_post_folder_missing_name(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-folders/', data={})
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_post_folder_project_not_found(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-folders/', data={'name': 'folder1'})
        request.user = self.user

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_folder_permission_denied(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-folders/', data={'name': 'folder1'})
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_folder_record_not_exists(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-folders/', data={'name': 'folder1'})
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

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

        assert resp.status_code == 200
        assert 'folder' in resp.data

    def test_put_folder_missing_folder_id(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-folders/', data={'folder_data': {'name': 'n'}}, format='json')
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_put_folder_invalid_folder_data_reserved_keys(self):
        request = self.factory.put(
            '/api/v2.1/projects/p1/ticket-folders/',
            data={'folder_id': 'f1', 'folder_data': {'_id': 'x'}},
            format='json'
        )
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_put_folder_not_exists(self):
        request = self.factory.put(
            '/api/v2.1/projects/p1/ticket-folders/',
            data={'folder_id': 'f1', 'folder_data': {'name': 'n'}},
            format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_put_folder_success(self):
        request = self.factory.put(
            '/api/v2.1/projects/p1/ticket-folders/',
            data={'folder_id': 'f1', 'folder_data': {'name': 'n'}},
            format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.folders_ids = ['f1']

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.update_folder', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_delete_folder_missing_folder_id(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-folders/', data={}, format='json')
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_delete_folder_not_exists(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-folders/', data={'folder_id': 'f1'}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_delete_folder_success(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-folders/', data={'folder_id': 'f1'}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.folders_ids = ['f1']

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.delete_folder', return_value=True):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TicketViewsAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketViewsAPI.as_view()

    def test_get_views_project_not_found(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-views/')
        request.user = self.user

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid',
                   return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

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

        assert resp.status_code == 200
        assert isinstance(resp.data, list)

    def test_get_views_permission_denied(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-views/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_get_views_internal_server_error(self):
        request = self.factory.get('/api/v2.1/projects/p1/ticket-views/')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.list_views', side_effect=Exception('err')):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 500

    def test_post_view_missing_name(self):
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/', data={}, format='json'
        )
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_post_view_project_not_found(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json')
        request.user = self.user

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_view_permission_denied(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_view_record_not_exists(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_view_folder_not_exists(self):
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/',
            data={'name': 'view1', 'folder_id': 'f1'},
            format='json'
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_view_success(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.add_view', return_value={'id': 'v1'}):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert 'view' in resp.data


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

        assert resp.status_code == 404

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

        assert resp.status_code == 200
        assert 'view' in resp.data

    def test_put_view_missing_view_data(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-views/v1/', data={}, format='json')
        request.user = self.user

        resp = self._view()(request, project_uuid='p1', view_id='v1')
        assert resp.status_code == 400

    def test_put_view_id_not_exists(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-views/v1/', data={'view_data': {'name': 'n'}}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.views_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
            resp = self._view()(request, project_uuid='p1', view_id='v1')

        assert resp.status_code == 400

    def test_put_view_success(self):
        request = self.factory.put('/api/v2.1/projects/p1/ticket-views/v1/', data={'view_data': {'name': 'n'}}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.views_ids = ['v1']

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.update_view', return_value=True):
            resp = self._view()(request, project_uuid='p1', view_id='v1')

        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_delete_view_id_not_exists(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-views/v1/', data={}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.views_ids = []
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
            resp = self._view()(request, project_uuid='p1', view_id='v1')

        assert resp.status_code == 400

    def test_delete_view_success(self):
        request = self.factory.delete('/api/v2.1/projects/p1/ticket-views/v1/', data={}, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'
        record = Mock()
        record.views_ids = ['v1']
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.delete_view', return_value=True):
            resp = self._view()(request, project_uuid='p1', view_id='v1')

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TicketViewsDuplicateAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketViewsDuplicateView.as_view()

    def test_post_duplicate_missing_view_id(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/duplicate/', data={})
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

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

        assert resp.status_code == 200
        assert 'view' in resp.data

    def test_post_duplicate_view_id_not_exists(self):
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/duplicate/',
            data={'view_id': 'v9'},
            format='json',
        )
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()
        record.views_ids = ['v1']
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 404


class TicketViewsMoveAPIViewTest(TicketAPITestBase):

    def _view(self):
        return TicketViewsMoveView.as_view()

    def test_post_move_missing_source(self):
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/move/', data={})
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_post_move_missing_target(self):
        data = {'source_view_id': 'v1'}
        request = self.factory.post(
            '/api/v2.1/projects/p1/ticket-views/move/', data=data, format='json'
        )
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

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

        assert resp.status_code == 200
        assert resp.data['navigation'] == ['v1', 'v2']

    def test_post_move_not_allowed_drag_folder_into_folder(self):
        data = {
            'source_folder_id': 'f1',
            'target_view_id': 'v2',
            'target_folder_id': 'f2',
        }
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/move/', data=data, format='json')
        request.user = self.user

        resp = self._view()(request, project_uuid='p1')
        assert resp.status_code == 400

    def test_post_move_source_view_id_not_exists(self):
        data = {
            'source_view_id': 'v9',
            'target_view_id': 'v2',
        }
        request = self.factory.post('/api/v2.1/projects/p1/ticket-views/move/', data=data, format='json')
        request.user = self.user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        record = Mock()
        record.views_ids = ['v2']
        record.folders_ids = []

        with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
                patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
            resp = self._view()(request, project_uuid='p1')

        assert resp.status_code == 400

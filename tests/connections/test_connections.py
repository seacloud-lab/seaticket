import json
from unittest.mock import Mock, patch

from seahub.project.connections import (
    ProjectConnectionsView,
    ProjectConnectionView,
    ProjectConnectionSyncView,
    ProjectConnectionDetailsView,
    ProjectConnectionRowDetailView,
    ProjectConnectionLogView,
    ProjectConnectionsStatusView,
    ProjectConnectionRecordView,
    ProjectConnectionRecordsView,
    GithubWebhookView,
    DiscourseWebhookView,
    ConnectionFileView,
)
from seahub.utils.storage import FileNotFound


class TestProjectConnectionsView:

    def test_get_feature_not_enabled(self, factory, auth_user):
        request = factory.get('/api/v1/project/p1/connections/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_get_project_not_found(self, factory, auth_user):
        request = factory.get('/api/v1/project/p1/connections/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=None):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/")
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=False):
            resp = ProjectConnectionsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_get_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/")
        request.user = auth_user

        record = Mock()
        record.to_dict.return_value = {'id': 1, 'name': 'c1'}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.filter', return_value=[record]):
            resp = ProjectConnectionsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert 'records' in resp.data
        assert resp.data['records'][0]['id'] == 1

    def test_post_feature_not_enabled(self, factory, auth_user):
        request = factory.post('/api/v1/project/p1/connections/', data={})
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_role_permission_denied(self, factory, auth_user):
        auth_user.permissions = type(auth_user.permissions)(can_add_project=lambda: False)

        request = factory.post('/api/v1/project/p1/connections/', data={})
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_missing_name(self, factory, auth_user):
        request = factory.post('/api/v1/project/p1/connections/', data={'config': '{}', 'type': 'site'})
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_missing_config(self, factory, auth_user):
        request = factory.post('/api/v1/project/p1/connections/', data={'name': 'c1', 'type': 'site'})
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_type_not_support(self, factory, auth_user):
        request = factory.post(
            '/api/v1/project/p1/connections/',
            data={'name': 'c1', 'config': '{}', 'type': 'not_support'}
        )
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_project_not_found(self, factory, auth_user):
        request = factory.post('/api/v1/project/p1/connections/', data={'name': 'c1', 'config': '{}', 'type': 'site'})
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=None):
            resp = ProjectConnectionsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_admin_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/",
            data={'name': 'c1', 'config': '{}', 'type': 'site'}
        )
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=False):
            resp = ProjectConnectionsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_post_enable_create_false(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/",
            data={'name': 'c1', 'config': '{}', 'type': 'site'}
        )
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.enable_create', return_value=False):
            resp = ProjectConnectionsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 500

    def test_post_create_success_site(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/", data={'name': 'c1', 'config': '{}', 'type': 'site'})
        request.user = auth_user

        record = Mock()
        record.id = 11
        record.to_dict.return_value = {'id': 11, 'name': 'c1', 'type': 'site'}

        seadb_api = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.enable_create', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.create', return_value=record), \
                patch('seahub.project.connections.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.project.connections.init_site_seadb_table'), \
                patch('seahub.project.connections.add_connection_sync_task') as add_task_mock:
            resp = ProjectConnectionsView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 201
        assert 'record' in resp.data
        assert resp.data['record']['id'] == 11
        add_task_mock.assert_called_once()


class TestProjectConnectionView:

    def test_get_project_not_found(self, factory, auth_user):
        request = factory.get('/api/v1/project/p1/connections/1/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=None):
            resp = ProjectConnectionView.as_view()(request, project_uuid='p1', connection_id='1')

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/1/")
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=False):
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 403

    def test_get_connection_not_found(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/1/")
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=None):
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 404

    def test_get_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/1/")
        request.user = auth_user

        record = Mock()
        record.to_dict.return_value = {'id': 1, 'name': 'c1'}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=record):
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert resp.data['record']['id'] == 1

    def test_put_role_permission_denied(self, factory, auth_user):
        auth_user.permissions = type(auth_user.permissions)(can_add_project=lambda: False)

        request = factory.put('/api/v1/project/p1/connections/1/', data={'name': 'c2'}, format='json')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionView.as_view()(request, project_uuid='p1', connection_id='1')

        assert resp.status_code == 403

    def test_put_admin_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(f"/api/v1/project/{project.uuid}/connections/1/", data={'name': 'c2'}, format='json')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=False):
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 403

    def test_put_enable_modify_false(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/1/",
            data={'config': '{"a": 1}'},
            format='json'
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'
        connection.config = json.dumps({})

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.decrypt_config', return_value={}), \
                patch('seahub.project.connections.ProjectConnections.objects.enable_modify', return_value=False):
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 400

    def test_put_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(f"/api/v1/project/{project.uuid}/connections/1/", data={'name': 'c2'}, format='json')
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'
        connection.config = json.dumps({})

        record = Mock()
        record.to_dict.return_value = {'id': 1, 'name': 'c2'}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.ProjectConnections.objects.modify', return_value=record):
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert resp.data['record']['name'] == 'c2'

    def test_delete_admin_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/project/{project.uuid}/connections/1/", data={}, format='json')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=False):
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 403

    def test_delete_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/project/{project.uuid}/connections/1/", data={}, format='json')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_admin_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.filter') as filter_mock:
            filter_mock.return_value.update.return_value = 1
            resp = ProjectConnectionView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestProjectConnectionSyncView:

    def test_post_connection_syncing(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/1/sync/", data={})
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'
        connection.status = json.dumps({'last_sync_status': 'crawling'})
        connection.last_sync_time = None

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ProjectConnectionSyncView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 429

    def test_post_manual_sync_failed_returns_error(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/1/sync/", data={})
        request.user = auth_user

        connection = Mock()
        connection.id = 1
        connection.type = 'site'
        connection.status = json.dumps({'last_sync_status': 'pending'})
        connection.last_sync_time = None

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.manual_sync_connection', return_value=({'success': False, 'error_msg': 'bad'}, 400)):
            resp = ProjectConnectionSyncView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 400

    def test_post_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/1/sync/", data={})
        request.user = auth_user

        connection = Mock()
        connection.id = 1
        connection.type = 'site'
        connection.status = json.dumps({'last_sync_status': 'pending'})
        connection.last_sync_time = None

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.manual_sync_connection', return_value=({'success': True}, 200)):
            resp = ProjectConnectionSyncView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestProjectConnectionDetailsView:

    def test_get_missing_view_id(self, factory, auth_user):
        request = factory.get('/api/v1/project/p1/connections/1/details/')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionDetailsView.as_view()(request, project_uuid='p1', connection_id='1')

        assert resp.status_code == 400

    def test_get_view_not_found(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/1/details/", {'view_id': 'v1'})
        request.user = auth_user

        connection = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.ConnectionsViews.objects.get_view', return_value=None):
            resp = ProjectConnectionDetailsView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 404

    def test_get_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(
            f"/api/v1/project/{project.uuid}/connections/1/details/",
            {'view_id': 'v1', 'start': 'a', 'limit': 'b'}
        )
        request.user = auth_user

        connection = Mock()
        connection.name = 'c1'
        connection.type = 'site'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.ConnectionsViews.objects.get_view', return_value={'_id': 'v1'}), \
                patch('seahub.project.connections.SeaDBAPI', return_value=Mock()), \
                patch('seahub.project.connections.list_connection_view_records', return_value=([{'_pk': 1}], ['c'])) as list_mock:
            resp = ProjectConnectionDetailsView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert 'records' in resp.data
        list_mock.assert_called_once()


class TestProjectConnectionRowDetailView:

    def test_get_missing_pk(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/1/details/row-detail/")
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ProjectConnectionRowDetailView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 400

    def test_get_type_invalid(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(
            f"/api/v1/project/{project.uuid}/connections/1/details/row-detail/",
            {'_pk': '1'}
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'unknown'
        connection.name = 'c1'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ProjectConnectionRowDetailView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 400

    def test_get_site_success_no_file(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(
            f"/api/v1/project/{project.uuid}/connections/1/details/row-detail/",
            {'_pk': '1'}
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'
        connection.name = 'c1'

        seadb = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.connections.list_site_record_details', return_value={'url': ''}):
            resp = ProjectConnectionRowDetailView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert resp.data['connection_type'] == 'site'


class TestProjectConnectionLogView:

    def test_get_format_log(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/1/logs/")
        request.user = auth_user

        connection = Mock()
        connection.last_sync_log = '\nline1\nline2'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ProjectConnectionLogView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert resp.data['last_sync_log'] == 'line1<br>line2'


class TestProjectConnectionsStatusView:

    def test_get_missing_connection_ids(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/query-status/")
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True):
            resp = ProjectConnectionsStatusView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_get_success(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(
            f"/api/v1/project/{project.uuid}/connections/query-status/",
            {'connection_ids': '1,2'}
        )
        request.user = auth_user

        r1 = Mock()
        r1.id = 1
        r1.status = '{}'
        r1.last_sync_time = None

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.filter', return_value=[r1]):
            resp = ProjectConnectionsStatusView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert '1' in [str(k) for k in resp.data.keys()]


class TestProjectConnectionRecordView:

    def test_put_invalid_body(self, factory, auth_user):
        request = factory.put('/api/v1/project/p1/connections/1/records/1/', data=None, format='json')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid='p1', connection_id='1', record_id='1')

        assert resp.status_code == 400

    def test_put_type_not_supported(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/1/records/1/",
            data={'outdated': True},
            format='json'
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'unknown'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid=str(project.uuid), connection_id='1', record_id='1')

        assert resp.status_code == 400

    def test_put_success_no_fields(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/1/records/1/",
            data={'foo': 1},
            format='json'
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid=str(project.uuid), connection_id='1', record_id='1')

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestProjectConnectionRecordsView:

    def test_put_records_data_invalid(self, factory, auth_user):
        request = factory.put('/api/v1/project/p1/connections/1/records/', data={}, format='json')
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ProjectConnectionRecordsView.as_view()(request, project_uuid='p1', connection_id='1')

        assert resp.status_code == 400

    def test_put_success_skip_invalid_rows(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/1/records/",
            data={'records_data': [{'row_id': None, 'row': {}}, {'row_id': '1', 'row': {}}]},
            format='json'
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ProjectConnectionRecordsView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestConnectionFileView:

    def test_get_file_not_found(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/1/file/f.txt")
        request.user = auth_user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.get_file_from_s3_web_crawl', side_effect=FileNotFound()):
            resp = ConnectionFileView.as_view()(request, project_uuid=str(project.uuid), connection_id='1', file_path='f.txt')

        assert resp.status_code == 404


class TestGithubWebhookView:

    def test_post_missing_connection_id(self, factory):
        request = factory.post('/webhook/github', data={}, format='json')
        resp = GithubWebhookView.as_view()(request)
        assert resp.status_code == 400

    def test_post_signature_verification_failed(self, factory):
        request = factory.post('/webhook/github?connection_id=1', data={}, format='json', HTTP_X_HUB_SIGNATURE_256='sha256=bad', HTTP_X_GITHUB_EVENT='issues')
        request._body = b'{}'
        connection = Mock()
        connection.is_active = True
        connection.config = json.dumps({'webhook_secret': 's'})
        with patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.decrypt_config', return_value={'webhook_secret': 's'}), \
                patch.object(GithubWebhookView, 'verify_signature', return_value=False):
            resp = GithubWebhookView.as_view()(request)
        assert resp.status_code == 403

    def test_post_ignore_event(self, factory):
        request = factory.post('/webhook/github?connection_id=1', data={}, format='json', HTTP_X_GITHUB_EVENT='ping', HTTP_X_HUB_SIGNATURE_256='sha256=ok')
        request._body = b'{}'
        connection = Mock()
        connection.is_active = True
        connection.config = json.dumps({'webhook_secret': 's'})
        with patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.decrypt_config', return_value={'webhook_secret': 's'}), \
                patch.object(GithubWebhookView, 'verify_signature', return_value=True):
            resp = GithubWebhookView.as_view()(request)
        assert resp.status_code == 200

    def test_post_success_calls_update(self, factory):
        payload = {'action': 'opened', 'issue': {'id': 1}}
        request = factory.post('/webhook/github?connection_id=1', data=payload, format='json', HTTP_X_GITHUB_EVENT='issues', HTTP_X_HUB_SIGNATURE_256='sha256=ok')
        request._body = b'{}'
        connection = Mock()
        connection.is_active = True
        connection.config = json.dumps({'webhook_secret': 's'})
        with patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.decrypt_config', return_value={'webhook_secret': 's'}), \
                patch.object(GithubWebhookView, 'verify_signature', return_value=True), \
                patch('seahub.project.connections.update_github_issue_by_webhook') as update_mock:
            resp = GithubWebhookView.as_view()(request)
        assert resp.status_code == 200
        update_mock.assert_called_once()


class TestDiscourseWebhookView:

    def test_post_missing_event_header(self, factory):
        request = factory.post('/webhook/discourse?connection_id=1', data={}, format='json', HTTP_X_DISCOURSE_EVENT_SIGNATURE='sha256=ok')
        request._body = b'{}'
        connection = Mock()
        connection.is_active = True
        connection.config = json.dumps({'webhook_secret': 's'})
        with patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.decrypt_config', return_value={'webhook_secret': 's'}), \
                patch.object(DiscourseWebhookView, 'verify_signature', return_value=True):
            resp = DiscourseWebhookView.as_view()(request)
        assert resp.status_code == 400

    def test_post_success_calls_update(self, factory):
        request = factory.post('/webhook/discourse?connection_id=1', data={'x': 1}, format='json', HTTP_X_DISCOURSE_EVENT='post_created', HTTP_X_DISCOURSE_EVENT_SIGNATURE='sha256=ok')
        request._body = b'{}'
        connection = Mock()
        connection.is_active = True
        connection.config = json.dumps({'webhook_secret': 's'})
        with patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.decrypt_config', return_value={'webhook_secret': 's'}), \
                patch.object(DiscourseWebhookView, 'verify_signature', return_value=True), \
                patch('seahub.project.connections.update_discourse_topic_by_webhook') as update_mock:
            resp = DiscourseWebhookView.as_view()(request)
        assert resp.status_code == 200
        update_mock.assert_called_once()


class TestProjectConnectionRecordUpdate:

    def test_put_update_outdated_success_calls_update_rows(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/1/records/1/",
            data={'outdated': True},
            format='json'
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'

        seadb = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.connections.WebCrawlTable.gen_table_name', return_value='tbl'):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid=str(project.uuid), connection_id='1', record_id='1')

        assert resp.status_code == 200
        assert seadb.update_rows.call_count == 1

    def test_put_update_rows_exception(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/1/records/1/",
            data={'outdated': True},
            format='json'
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'

        seadb = Mock()
        seadb.update_rows.side_effect = Exception('err')

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.connections.WebCrawlTable.gen_table_name', return_value='tbl'):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid=str(project.uuid), connection_id='1', record_id='1')

        assert resp.status_code == 500

    def test_put_batch_update_success_calls_update_rows(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/1/records/",
            data={'records_data': [{'row_id': '1', 'row': {'outdated': True}}]},
            format='json'
        )
        request.user = auth_user

        connection = Mock()
        connection.type = 'site'

        seadb = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.connections.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.connections.check_project_permission', return_value=True), \
                patch('seahub.project.connections.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.connections.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.connections.WebCrawlTable.gen_table_name', return_value='tbl'):
            resp = ProjectConnectionRecordsView.as_view()(request, project_uuid=str(project.uuid), connection_id='1')

        assert resp.status_code == 200
        assert seadb.update_rows.call_count == 1

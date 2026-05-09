import json
import hmac
import hashlib
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError

from seahub.project.connections import (
    ProjectConnectionsView,
    ProjectConnectionView,
    ProjectConnectionSyncView,
    ProjectConnectionDetailsView,
    ProjectConnectionLogView,
    ProjectConnectionsStatusView,
    ProjectConnectionRecordView,
    ProjectConnectionRecordsView,
    GithubWebhookView,
    DiscourseWebhookView,
    ConnectionFileView,
)
from seahub.settings import GITHUB_WEBHOOK_SECRET



class TestProjectConnectionsView:

    def test_get_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/")
        request.user = no_org_user

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_project_not_found(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        request = factory.get(f"/api/v1/project/{project_uuid}/connections/")
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/")
        request.user = no_org_user

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/")
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert 'records' in resp.data
        assert site_connection.id in [r['id'] for r in resp.data['records']]

    def test_post_feature_not_enabled(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/", data={})
        request.user = no_org_user

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_post_role_permission_denied(self, factory, project_creator, real_project):
        project = real_project
        project_creator.permissions = type(project_creator.permissions)(can_add_project=lambda: False)

        request = factory.post(f"/api/v1/project/{project.uuid}/connections/", data={})
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_post_missing_name(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/", data={'config': '{}', 'type': 'site'})
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_missing_config(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/", data={'name': 'c1', 'type': 'site'})
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_post_type_not_support(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/",
            data={'name': 'c1', 'config': '{}', 'type': 'not_support'}
        )
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 404

    def test_post_project_not_found(self, factory, project_creator):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        request = factory.post(f"/api/v1/project/{project_uuid}/connections/", data={'name': 'c1', 'config': '{}', 'type': 'site'})
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project_uuid)

        assert resp.status_code == 404

    def test_post_admin_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/",
            data={'name': 'c1', 'config': '{}', 'type': 'site'}
        )
        request.user = auth_user

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_post_enable_create_false(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/",
            data={'name': 'c1', 'config': '{}', 'type': 'site'}
        )
        request.user = project_creator

        resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 500

    def test_post_create_success_site(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/", data={'name': 'c1', 'config': '{}', 'type': 'site'})
        request.user = project_creator

        record = Mock()
        record.id = 11
        record.to_dict.return_value = {'id': 11, 'name': 'c1', 'type': 'site'}

        seadb_api = Mock()

        with patch('seahub.project.connections.ProjectConnections.objects.create', return_value=record), \
                patch('seahub.project.connections.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.project.connections.init_site_seadb_table'), \
                patch('seahub.project.connections.add_connection_sync_task') as add_task_mock:
            resp = ProjectConnectionsView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 201
        assert 'record' in resp.data
        assert resp.data['record']['id'] == 11
        add_task_mock.assert_called_once()


class TestProjectConnectionView:

    def test_get_project_not_found(self, factory, project_creator, site_connection):
        project_uuid = '00000000-0000-0000-0000-000000000000'
        request = factory.get(f"/api/v1/project/{project_uuid}/connections/{site_connection.id}/")
        request.user = project_creator

        resp = ProjectConnectionView.as_view()(request, project_uuid=project_uuid, connection_id=site_connection.id)

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, no_org_user, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/")
        request.user = no_org_user

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=site_connection.id)

        assert resp.status_code == 403

    def test_get_connection_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/99999/")
        request.user = project_creator

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id='99999')

        assert resp.status_code == 404

    def test_get_success(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/")
        request.user = project_creator

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id))

        assert resp.status_code == 200
        assert resp.data['record']['id'] == site_connection.id

    def test_put_role_permission_denied(self, factory, project_creator, real_project, site_connection):
        project = real_project
        project_creator.permissions = type(project_creator.permissions)(can_add_project=lambda: False)

        request = factory.put(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/", data={'name': 'c2'}, format='json')
        request.user = project_creator

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=site_connection.id)

        assert resp.status_code == 403

    def test_put_admin_permission_denied(self, factory, auth_user, real_project, site_connection):
        project = real_project
        request = factory.put(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/", data={'name': 'c2'}, format='json')
        request.user = auth_user

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=site_connection.id)

        assert resp.status_code == 403

    def test_put_enable_modify_false(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/",
            data={'config': '{"a": 1}'},
            format='json'
        )
        request.user = project_creator

        with patch('seahub.project.connections.ProjectConnections.objects.enable_modify', return_value=False):
            resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id))

        assert resp.status_code == 400

    def test_put_success(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/",
            data={'name': 'c2'},
            format='json'
        )
        request.user = project_creator

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id))

        assert resp.status_code == 200
        assert resp.data['record']['name'] == 'c2'
        assert resp.data['record']['id'] == site_connection.id

        site_connection.refresh_from_db()
        assert site_connection.name == 'c2'

    def test_delete_admin_permission_denied(self, factory, auth_user, real_project, site_connection):
        project = real_project
        request = factory.delete(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/", data={}, format='json')
        request.user = auth_user

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=site_connection.id)

        assert resp.status_code == 403

    def test_delete_success(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.delete(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/",
            data={},
            format='json'
        )
        request.user = project_creator

        resp = ProjectConnectionView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id))

        assert resp.status_code == 200
        assert resp.data['success'] is True

        site_connection.refresh_from_db()
        assert site_connection.deleted is True


class TestProjectConnectionSyncView:

    def test_post_connection_syncing(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory(status=json.dumps({'last_sync_status': 'crawling'}))
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/{connection.id}/sync/", data={})
        request.user = project_creator

        resp = ProjectConnectionSyncView.as_view()(request, project_uuid=project.uuid, connection_id=str(connection.id))

        assert resp.status_code == 429

    def test_post_manual_sync_failed_returns_error(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory(status=json.dumps({'last_sync_status': 'pending'}))
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/{connection.id}/sync/", data={})
        request.user = project_creator

        with patch('seahub.project.connections.manual_sync_connection', return_value=({'success': False, 'error_msg': 'bad'}, 400)):
            resp = ProjectConnectionSyncView.as_view()(request, project_uuid=project.uuid, connection_id=str(connection.id))

        assert resp.status_code == 400

    def test_post_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory(status=json.dumps({'last_sync_status': 'pending'}))
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/{connection.id}/sync/", data={})
        request.user = project_creator

        with patch('seahub.project.connections.manual_sync_connection', return_value=({'success': True}, 200)):
            resp = ProjectConnectionSyncView.as_view()(request, project_uuid=project.uuid, connection_id=str(connection.id))

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestProjectConnectionDetailsView:

    def test_get_missing_view_id(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/details/")
        request.user = project_creator

        resp = ProjectConnectionDetailsView.as_view()(request, project_uuid=str(project.uuid), connection_id=site_connection.id)

        assert resp.status_code == 400

    def test_get_view_not_found(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/details/", {'view_id': 'v1'})
        request.user = project_creator

        resp = ProjectConnectionDetailsView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(site_connection.id))

        assert resp.status_code == 404

    def test_get_success(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/details/",
            {'view_id': '0000', 'start': 'a', 'limit': 'b'}
        )
        request.user = project_creator

        with patch('seahub.project.connections.SeaDBAPI', return_value=Mock()), \
                patch('seahub.project.connections.list_connection_view_records', return_value=([{'_pk': 1}], ['c'])) as list_mock:
            resp = ProjectConnectionDetailsView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(site_connection.id))

        assert resp.status_code == 200
        assert 'records' in resp.data
        assert resp.data['records'][0]['_pk'] == 1
        list_mock.assert_called_once()


class TestProjectConnectionLogView:

    def test_get_format_log(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory(last_sync_log='\nline1\nline2')
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{connection.id}/logs/")
        request.user = project_creator

        resp = ProjectConnectionLogView.as_view()(request, project_uuid=project.uuid, connection_id=str(connection.id))

        assert resp.status_code == 200
        assert resp.data['last_sync_log'] == 'line1<br>line2'


class TestProjectConnectionsStatusView:

    def test_get_missing_connection_ids(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/query-status/")
        request.user = project_creator

        resp = ProjectConnectionsStatusView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 400

    def test_get_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        c1 = connection_factory(status='{}')
        c2 = connection_factory(status='{}')
        request = factory.get(
            f"/api/v1/project/{project.uuid}/connections/query-status/",
            {'connection_ids': f'{c1.id},{c2.id}'}
        )
        request.user = project_creator

        resp = ProjectConnectionsStatusView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert str(c1.id) in [str(k) for k in resp.data.keys()]


class TestProjectConnectionRecordView:

    def test_get_type_invalid(self, factory, project_creator, real_project, connection_factory, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/1/")
        request.user = project_creator

        connection = connection_factory(connection_type='site')
        connection.type = 'unknown'
        connection.name = 'c1'
        connection.save(update_fields=['type', 'name'])

        resp = ProjectConnectionRecordView.as_view()(request, project_uuid=project.uuid, connection_id=str(connection.id), record_id='1')

        assert resp.status_code == 400

    def test_get_site_success_no_file(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/1/")
        request.user = project_creator

        seadb = Mock()

        with patch('seahub.project.connections.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.connections.list_site_record_details', return_value=({}, [], '')):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id), record_id='1')

        assert resp.status_code == 200


    def test_put_invalid_body(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/1/", data=None, format='json')
        request.user = project_creator

        resp = ProjectConnectionRecordView.as_view()(request, project_uuid=project.uuid, connection_id=site_connection.id, record_id='1')

        assert resp.status_code == 400

    def test_put_type_not_supported(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory(connection_type='site')
        connection.type = 'unknown'
        connection.save(update_fields=['type'])
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/records/1/",
            data={'outdated': True},
            format='json'
        )
        request.user = project_creator

        resp = ProjectConnectionRecordView.as_view()(request, project_uuid=project.uuid, connection_id=str(connection.id), record_id='1')

        assert resp.status_code == 400

    def test_put_success_no_fields(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/1/",
            data={'foo': 1},
            format='json'
        )
        request.user = project_creator

        resp = ProjectConnectionRecordView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id), record_id='1')

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestProjectConnectionRecordsView:

    def test_put_records_data_invalid(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/", data={}, format='json')
        request.user = project_creator

        resp = ProjectConnectionRecordsView.as_view()(request, project_uuid=project.uuid, connection_id=site_connection.id)

        assert resp.status_code == 400

    def test_put_success_skip_invalid_rows(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/",
            data={'records_data': [{'row_id': None, 'row': {}}, {'row_id': '1', 'row': {}}]},
            format='json'
        )
        request.user = project_creator

        resp = ProjectConnectionRecordsView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id))

        assert resp.status_code == 200
        assert resp.data['success'] is True


class TestConnectionFileView:

    def test_get_file_not_found(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/file/f.txt")
        request.user = project_creator

        s3_client_mock = Mock()
        s3_client_mock.get_object.side_effect = ClientError({'Error': {'Code': 'NoSuchKey'}}, 'GetObject')
        with patch('seahub.project.connections.s3_client', s3_client_mock):
            resp = ConnectionFileView.as_view()(request, project_uuid=str(project.uuid), connection_id=site_connection.id, file_path='f.txt')

        assert resp.status_code == 404


class TestGithubWebhookView:
    def _signature(self, secret, body):
        return 'sha256=' + hmac.new(secret.encode(), msg=body, digestmod=hashlib.sha256).hexdigest()

    def test_post_signature_verification_failed(self, factory, connection_factory):
        request = factory.post(
            f'/webhook/github/',
            data={},
            format='json',
            HTTP_X_HUB_SIGNATURE_256='sha256=bad',
            HTTP_X_GITHUB_EVENT='issues',
        )
        resp = GithubWebhookView.as_view()(request)
        assert resp.status_code == 403

    def test_post_ignore_event(self, factory, connection_factory):
        payload = {'installation': {'id': 12345}, 'repository': {'html_url': 'https://github.com/xxx/xxx'}}
        request = factory.post(
            f'/webhook/github/',
            data=payload,
            format='json',
            HTTP_X_GITHUB_EVENT='ping',
            HTTP_X_HUB_SIGNATURE_256='sha256=ok',
        )
        request.META['HTTP_X_HUB_SIGNATURE_256'] = self._signature(GITHUB_WEBHOOK_SECRET, request.body)
        resp = GithubWebhookView.as_view()(request)
        assert resp.status_code == 200

    def test_post_success_calls_update(self, factory, connection_factory):
        payload = {'action': 'opened', 'issue': {'id': 1}, 'installation': {'id': 12345}, 'repository': {'html_url': 'https://github.com/xxx/xxx'}}
        request = factory.post(
            f'/webhook/github/',
            data=payload,
            format='json',
            HTTP_X_GITHUB_EVENT='issues',
            HTTP_X_HUB_SIGNATURE_256='sha256=ok',
        )
        record = Mock()
        record.id = 11
        record.to_dict.return_value = {'id': 11, 'config': {"html_url": "https://github.com/xxx/xxx", "installation_id": "123456"}}

        request.META['HTTP_X_HUB_SIGNATURE_256'] = self._signature(GITHUB_WEBHOOK_SECRET, request.body)
        with patch('seahub.project.connections.ProjectGithubAppInstallation.objects.get_installation_by_installation_id', return_value=record),\
                patch('seahub.project.connections.update_github_issue_by_webhook') as update_mock:
            resp = GithubWebhookView.as_view()(request)
        assert resp.status_code == 200
        update_mock.assert_called_once()


class TestDiscourseWebhookView:
    def _signature(self, secret, body):
        return 'sha256=' + hmac.new(secret.encode(), msg=body, digestmod=hashlib.sha256).hexdigest()

    def test_post_missing_event_header(self, factory, connection_factory):
        connection = connection_factory(connection_type='discourse_forum', config={'webhook_secret': 's'})
        request = factory.post(
            f'/webhook/discourse?connection_id={connection.id}',
            data={},
            format='json',
            HTTP_X_DISCOURSE_EVENT_SIGNATURE='sha256=ok',
        )
        request.META['HTTP_X_DISCOURSE_EVENT_SIGNATURE'] = self._signature('s', request.body)
        resp = DiscourseWebhookView.as_view()(request)
        assert resp.status_code == 400

    def test_post_success_calls_update(self, factory, connection_factory):
        connection = connection_factory(connection_type='discourse_forum', config={'webhook_secret': 's'})
        request = factory.post(
            f'/webhook/discourse?connection_id={connection.id}',
            data={'x': 1},
            format='json',
            HTTP_X_DISCOURSE_EVENT='post_created',
            HTTP_X_DISCOURSE_EVENT_SIGNATURE='sha256=ok',
        )
        request.META['HTTP_X_DISCOURSE_EVENT_SIGNATURE'] = self._signature('s', request.body)
        with patch('seahub.project.connections.update_discourse_topic_by_webhook') as update_mock:
            resp = DiscourseWebhookView.as_view()(request)
        assert resp.status_code == 200
        update_mock.assert_called_once()


class TestProjectConnectionRecordUpdate:

    def test_put_update_outdated_success_calls_update_rows(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/1/",
            data={'outdated': True},
            format='json'
        )
        request.user = project_creator

        seadb = Mock()

        with patch('seahub.project.connections.SeaDBAPI', return_value=seadb):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id), record_id='1')

        assert resp.status_code == 200
        assert seadb.update_rows.call_count == 1

    def test_put_update_rows_exception(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/1/",
            data={'outdated': True},
            format='json'
        )
        request.user = project_creator

        seadb = Mock()
        seadb.update_rows.side_effect = Exception('err')

        with patch('seahub.project.connections.SeaDBAPI', return_value=seadb):
            resp = ProjectConnectionRecordView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id), record_id='1')

        assert resp.status_code == 500

    def test_put_batch_update_success_calls_update_rows(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/records/",
            data={'records_data': [{'row_id': '1', 'row': {'outdated': True}}]},
            format='json'
        )
        request.user = project_creator

        seadb = Mock()

        with patch('seahub.project.connections.SeaDBAPI', return_value=seadb):
            resp = ProjectConnectionRecordsView.as_view()(request, project_uuid=project.uuid, connection_id=str(site_connection.id))

        assert resp.status_code == 200
        assert seadb.update_rows.call_count == 1

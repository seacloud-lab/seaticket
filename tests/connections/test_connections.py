import json
import hmac
import hashlib
from types import SimpleNamespace
from unittest.mock import Mock, patch

from seahub.project.connections import (
    ProjectConnectionsView,
    ProjectConnectionView,
    ProjectConnectionSyncView,
    ProjectConnectionDetailsView,
    ProjectConnectionMetaView,
    ProjectConnectionLogView,
    ProjectConnectionsStatusView,
    ProjectConnectionRecordView,
    ProjectConnectionRecordsView,
    GithubWebhookView,
    DiscourseWebhookView,
    ConnectionFileView,
    ProjectEmailOAuthCallbackView,
)
from seahub.project.agent import AgentActionConfirmView
from seahub.utils.storage import FileNotFound
from seahub.settings import GITHUB_WEBHOOK_SECRET


class DummySession(dict):
    modified = False



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

        with patch('seahub.project.connections.ProjectConnections.objects.enable_create', return_value=False):
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
                patch('seahub.project.seadb_api.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.seadb_models.utils.init_seadb_tables_from_schema'), \
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


class TestProjectEmailOAuthCallbackView:

    def test_callback_fetches_sender_profile_for_microsoft(self, factory, project_creator, real_project):
        project = real_project
        session = DummySession({
            'oauth_email_connection': {
                'oauth_state': 'state-1',
                'status': 'in-progress',
                'name': 'mail-conn',
                'config': {
                    'server_provider': 'Microsoft',
                    'client_id': 'cid',
                    'client_secret': 'secret',
                    'token_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                    'scopes': ['User.Read', 'Mail.Read', 'Mail.Send', 'offline_access'],
                },
                'connection_id': None,
                'error_msg': '',
            }
        })
        request = factory.get(
            f"/api/v1/project/{project.uuid}/connections/email/oauth/callback/?state=state-1"
        )
        request.user = project_creator
        request.session = session
        request.is_mobile = False
        request.is_tablet = False

        oauth_session = Mock()
        oauth_session.fetch_token.return_value = {
            'refresh_token': 'refresh-1',
            'access_token': 'access-1',
            'expires_at': 123456,
        }
        record = SimpleNamespace(id=123)

        with patch('seahub.project.connections.OAuth2Session', return_value=oauth_session), \
                patch('seahub.project.connections.fetch_oauth_email_sender_info', return_value={
                    'sender_name': 'Adele Vance',
                    'sender_email': 'adele@example.com',
                    'username': 'adele@example.com',
                }) as fetch_sender_mock, \
                patch('seahub.project.connections.create_connection', return_value=(record, None)):
            resp = ProjectEmailOAuthCallbackView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        final_config = request.session['oauth_email_connection']['config']
        assert final_config['sender_name'] == 'Adele Vance'
        assert final_config['sender_email'] == 'adele@example.com'
        assert final_config['username'] == 'adele@example.com'
        assert request.session.modified is True
        fetch_sender_mock.assert_called_once()


class TestProjectConnectionReplyEmailView:

    def test_reply_email_persists_refreshed_oauth_tokens(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        config = {
            'server_provider': 'Microsoft',
            'sender_name': 'Sender',
            'sender_email': 'sender@example.com',
            'username': 'sender@example.com',
            'client_id': 'cid',
            'client_secret': 'secret',
            'refresh_token': 'old-refresh',
            'access_token': 'old-access',
            'expires_at': 100,
            'token_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            'scopes': ['User.Read', 'Mail.Read', 'Mail.Send', 'offline_access'],
        }
        connection = connection_factory(connection_type='email', config=config)
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/reply-email/",
            data={'content': 'reply', 'email_id': 1},
            format='json',
        )
        request.user = project_creator

        target_email = {
            '_pk': 1,
            'thread_id': 10,
            'email_from': 'customer@example.com',
            'title': 'Hello',
            'message_id': '<msg-1@example.com>',
            'origin_thread_id': 'thread-origin',
        }
        email_seadb_api = Mock()
        email_seadb_api.get_email_by_pk.return_value = target_email
        email_seadb_api.save_reply_email.return_value = 88

        def mutate_config(send_config, _send_info):
            send_config['access_token'] = 'new-access'
            send_config['refresh_token'] = 'new-refresh'
            send_config['expires_at'] = 999999
            return {'success': True, 'message_id': '<reply@example.com>', 'config_updated': True}

        with patch('seahub.project.connections.SeaDBAPI'), \
                patch('seahub.project.connections.EmailSeaDBAPI', return_value=email_seadb_api), \
                patch('seahub.project.connections.toggle_send_email', side_effect=mutate_config):
            from seahub.project.connections import ProjectConnectionReplyEmailView
            resp = ProjectConnectionReplyEmailView.as_view()(request, project_uuid=project.uuid, connection_id=connection.id)

        assert resp.status_code == 200
        connection.refresh_from_db()
        saved_config = json.loads(connection.config)
        assert saved_config['expires_at'] == 999999
        assert saved_config['access_token'] != 'old-access'
        assert saved_config['refresh_token'] != 'old-refresh'


class TestAgentActionConfirmView:

    def test_confirm_email_reply_persists_refreshed_oauth_tokens(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        config = {
            'server_provider': 'Microsoft',
            'sender_name': 'Sender',
            'sender_email': 'sender@example.com',
            'username': 'sender@example.com',
            'client_id': 'cid',
            'client_secret': 'secret',
            'refresh_token': 'old-refresh',
            'access_token': 'old-access',
            'expires_at': 100,
            'token_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            'scopes': ['User.Read', 'Mail.Read', 'Mail.Send', 'offline_access'],
        }
        connection = connection_factory(connection_type='email', config=config)
        request = factory.post(
            f"/api/v1/project/{project.uuid}/agent/runs/1/actions/2/confirm/",
            data={},
            format='json',
        )
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.return_value = {
            'results': [{
                'run_id': 1,
                'status': 'pending',
                'tool_name': 'suggest_reply',
                'source_type': 'email',
                'source_id': f'{connection.id}_10',
                'result': '',
                'suggestion_content': 'reply body',
            }]
        }

        email_thread = {'_pk': 10, 'title': 'Hello'}
        emails = [{
            '_pk': 1,
            'thread_id': 10,
            'email_from': 'customer@example.com',
            'title': 'Hello',
            'message_id': '<msg-1@example.com>',
            'origin_thread_id': 'thread-origin',
            'is_sender': False,
        }]
        email_seadb_api = Mock()
        email_seadb_api.get_thread_by_pk.return_value = email_thread
        email_seadb_api.get_emails_by_thread_id.return_value = emails
        email_seadb_api.save_reply_email.return_value = 77

        def mutate_config(send_config, _send_info):
            send_config['access_token'] = 'new-access'
            send_config['refresh_token'] = 'new-refresh'
            send_config['expires_at'] = 999999
            return {'success': True, 'message_id': '<reply@example.com>', 'config_updated': True}

        with patch('seahub.project.agent.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.project.agent.EmailSeaDBAPI', return_value=email_seadb_api), \
                patch('seahub.project.agent.toggle_send_email', side_effect=mutate_config):
            resp = AgentActionConfirmView.as_view()(request, project_uuid=project.uuid, run_id='1', action_id='2')

        assert resp.status_code == 200
        connection.refresh_from_db()
        saved_config = json.loads(connection.config)
        # assert saved_config['expires_at'] == 999999
        assert saved_config['access_token'] != 'old-access'
        assert saved_config['refresh_token'] != 'old-refresh'

    def test_confirm_move_email_to_spam_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        config = {
            'server_provider': 'general_email_provider',
            'username': 'sender@example.com',
            'password': 'secret',
            'imap_host': 'imap.example.com',
            'imap_port': 993,
        }
        connection = connection_factory(connection_type='email', config=config)
        request = factory.post(
            f"/api/v1/project/{project.uuid}/agent/runs/1/actions/2/confirm/",
            data={},
            format='json',
        )
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.return_value = {
            'results': [{
                'run_id': 1,
                'status': 'pending',
                'tool_name': 'suggest_move_to_spam',
                'source_type': 'email',
                'source_id': f'{connection.id}_10',
                'result': '',
                'suggestion_content': 'spam detection reason',
            }]
        }

        email_thread = {'_pk': 10, 'title': 'Sale 90% off', 'linked_ticket': None}
        emails = [{
            '_pk': 1,
            'thread_id': 10,
            'email_from': 'promo@example.com',
            'title': 'Sale 90% off',
            'message_id': '<spam-1@example.com>',
            'is_sender': False,
        }]
        email_seadb_api = Mock()
        email_seadb_api.get_thread_by_pk.return_value = email_thread
        email_seadb_api.get_emails_by_thread_id.return_value = emails

        with patch('seahub.project.agent.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.project.agent.EmailSeaDBAPI', return_value=email_seadb_api), \
                patch(
                    'seahub.project.agent.move_emails_to_junk',
                    return_value={'moved_count': 1, 'target_folder': 'Spam'},
                ) as move_mock:
            resp = AgentActionConfirmView.as_view()(request, project_uuid=project.uuid, run_id='1', action_id='2')

        assert resp.status_code == 200
        assert resp.data['status'] == 'executed'
        move_mock.assert_called_once_with(config, ['<spam-1@example.com>'])
        email_seadb_api.mark_thread_deleted.assert_called_once_with(connection.id, 10)

    def test_confirm_move_email_to_spam_fails_when_no_remote_message_matched(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        config = {
            'server_provider': 'general_email_provider',
            'username': 'sender@example.com',
            'password': 'secret',
            'imap_host': 'imap.example.com',
            'imap_port': 993,
        }
        connection = connection_factory(connection_type='email', config=config)
        request = factory.post(
            f"/api/v1/project/{project.uuid}/agent/runs/1/actions/2/confirm/",
            data={},
            format='json',
        )
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.return_value = {
            'results': [{
                'run_id': 1,
                'status': 'pending',
                'tool_name': 'suggest_move_to_spam',
                'source_type': 'email',
                'source_id': f'{connection.id}_10',
                'result': '',
                'suggestion_content': 'spam detection reason',
            }]
        }

        email_thread = {'_pk': 10, 'title': 'Sale 90% off', 'linked_ticket': None}
        emails = [{
            '_pk': 1,
            'thread_id': 10,
            'email_from': 'promo@example.com',
            'title': 'Sale 90% off',
            'message_id': '<spam-1@example.com>',
            'is_sender': False,
        }]
        email_seadb_api = Mock()
        email_seadb_api.get_thread_by_pk.return_value = email_thread
        email_seadb_api.get_emails_by_thread_id.return_value = emails

        with patch('seahub.project.agent.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.project.agent.EmailSeaDBAPI', return_value=email_seadb_api), \
                patch(
                    'seahub.project.agent.move_emails_to_junk',
                    return_value={'moved_count': 0, 'target_folder': 'Spam'},
                ) as move_mock:
            resp = AgentActionConfirmView.as_view()(request, project_uuid=project.uuid, run_id='1', action_id='2')

        assert resp.status_code == 200
        assert resp.data['status'] == 'failed'
        assert 'no matching remote message was moved' in resp.data['result']
        move_mock.assert_called_once_with(config, ['<spam-1@example.com>'])
        email_seadb_api.mark_thread_deleted.assert_not_called()


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

    def test_get_view_not_found(self, factory, project_creator, real_project, site_connection, mock_seadb_metadata):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/details/", {'view_id': 'v1'})
        request.user = project_creator

        resp = ProjectConnectionDetailsView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(site_connection.id))

        assert resp.status_code == 404

    def test_get_success(self, factory, project_creator, real_project, site_connection, mock_seadb_metadata):
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


class TestProjectConnectionMetaView:

    def test_get_permission_denied(self, factory, no_org_user, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/meta/")
        request.user = no_org_user

        resp = ProjectConnectionMetaView.as_view()(
            request, project_uuid=str(project.uuid), connection_id=str(site_connection.id)
        )

        assert resp.status_code == 403

    def test_get_invalid_connection_type(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{site_connection.id}/meta/")
        request.user = project_creator

        resp = ProjectConnectionMetaView.as_view()(
            request, project_uuid=str(project.uuid), connection_id=str(site_connection.id)
        )

        assert resp.status_code == 400

    def test_get_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory(connection_type='general_task')
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{connection.id}/meta/")
        request.user = project_creator

        with patch('seahub.project.connections.SeaDBAPI', return_value=Mock()), \
                patch('seahub.project.connections.get_connection_columns', return_value=[{'key': 'status'}]), \
                patch('seahub.project.connections.get_connection_general_task_related_users', return_value=[
                    {'email': 'dev@example.com', 'name': 'Dev User', 'avatar_url': '/avatar.png'}
                ]):
            resp = ProjectConnectionMetaView.as_view()(
                request, project_uuid=str(project.uuid), connection_id=str(connection.id)
            )

        assert resp.status_code == 200
        assert resp.data['related_users'][0]['email'] == 'dev@example.com'
        assert resp.data['columns'][0]['key'] == 'status'


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

        with patch('seahub.project.connections.get_connection_file_head_from_s3', side_effect=FileNotFound()):
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

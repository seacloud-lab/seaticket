import json
from unittest.mock import Mock, patch

from seahub.chats.view import ChatSessionsView, ChatSessionView, ChatMessagesView, ChatView


class TestChatSessionsView:

    def test_get_feature_not_enabled(self, factory, user):
        request = factory.get('/api/v1/chat/sessions/', {})
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 403

    def test_get_missing_project_uuid(self, factory, user):
        request = factory.get('/api/v1/chat/sessions/', {})
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 400

    def test_get_project_not_found(self, factory, user):
        request = factory.get('/api/v1/chat/sessions/', {'project_uuid': 'p1'})
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=None):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, user):
        request = factory.get('/api/v1/chat/sessions/', {'project_uuid': 'p1'})
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=False):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 403

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/chat/sessions/', {'project_uuid': 'p1'})
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        session = Mock()
        session.to_dict.return_value = {'session_uuid': 's1'}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.ChatSessions.objects.get_sessions_by_project', return_value=[session]):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['sessions'][0]['session_uuid'] == 's1'

    def test_post_missing_project_uuid(self, factory, user):
        request = factory.post('/api/v1/chat/sessions/', data={'session_name': 'n'})
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 400

    def test_post_missing_session_name(self, factory, user):
        request = factory.post('/api/v1/chat/sessions/', data={'project_uuid': 'p1'})
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 400

    def test_post_success(self, factory, user):
        request = factory.post('/api/v1/chat/sessions/', data={'project_uuid': 'p1', 'session_name': 'n'}, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        session = Mock()
        session.to_dict.return_value = {'session_uuid': 's1'}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.ChatSessions.objects.create_session', return_value=session):
            resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 201
        assert resp.data['session']['session_uuid'] == 's1'


class TestChatSessionView:

    def test_put_missing_project_uuid(self, factory, user):
        request = factory.put('/api/v1/chat/sessions/s1/', data={'session_name': 'n'}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ChatSessionView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 400

    def test_put_session_not_found(self, factory, user):
        request = factory.put('/api/v1/chat/sessions/s1/', data={'project_uuid': 'p1', 'session_name': 'n'}, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.ChatSessions.objects.get_session_by_uuid', return_value=None):
            resp = ChatSessionView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 404

    def test_delete_success(self, factory, user):
        request = factory.delete('/api/v1/chat/sessions/s1/', data={'project_uuid': 'p1'}, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.delete_sessions') as del_mock:
            resp = ChatSessionView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 200
        assert resp.data['success'] is True
        del_mock.assert_called_once()


class TestChatMessagesView:

    def test_get_session_not_found(self, factory, user):
        request = factory.get('/api/v1/chat/sessions/s1/messages/', {'project_uuid': 'p1'})
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.ChatSessions.objects.get_session_by_uuid', return_value=None):
            resp = ChatMessagesView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 404

    def test_get_success_thought_process(self, factory, user):
        request = factory.get('/api/v1/chat/sessions/s1/messages/', {'project_uuid': 'p1'})
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        session = Mock()

        msg_user = Mock()
        msg_user.role = 'user'
        msg_user.message_id = 'm1'
        msg_user.to_dict.return_value = {'message_id': 'm1', 'role': 'user', 'attachments': [{'content': 'x'}]}

        msg_assistant = Mock()
        msg_assistant.role = 'assistant'
        msg_assistant.message_id = 'm2'
        msg_assistant.is_agent_mode = False
        msg_assistant.to_dict.return_value = {'message_id': 'm2', 'role': 'assistant'}

        thought_process_map = {'m2': {'x': 1}}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.ChatSessions.objects.get_session_by_uuid', return_value=session), \
                patch('seahub.chats.view.ChatMessages.objects.get_messages_by_session', return_value=[msg_user, msg_assistant]), \
                patch('seahub.chats.view.remove_content_details_in_attachments', return_value=[]), \
                patch('seahub.chats.view.ChatMessageThoughtProcess.objects.get_thought_process_from_session_uuid_and_message_ids', return_value=thought_process_map):
            resp = ChatMessagesView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 200
        assert len(resp.data['messages']) == 2
        assert resp.data['messages'][1]['thought_process'] == {'x': 1}


class TestChatView:

    def test_post_missing_project_uuid(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'query': 'q'}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 400

    def test_post_missing_query(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': 'p1'}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 400

    def test_post_project_not_found(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': 'p1', 'query': 'q'}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=None):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 404

    def test_post_permission_denied(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': 'p1', 'query': 'q'}, format='json')
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=False):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 403

    def test_post_existing_session_not_found(self, factory, user):
        request = factory.post(
            '/api/v1/ai/chat/',
            data={'project_uuid': 'p1', 'query': 'q', 'session_uuid': 's1'},
            format='json'
        )
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.check_ai_limit', return_value=False), \
                patch('seahub.chats.view.get_attachments', return_value=[]), \
                patch('seahub.chats.view.ChatSessions.objects.get_session_by_uuid', return_value=None):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 404

    def test_post_gen_message_id_failure(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': 'p1', 'query': 'q'}, format='json')
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        session = Mock()
        session.session_uuid = 's1'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.check_ai_limit', return_value=False), \
                patch('seahub.chats.view.get_attachments', return_value=[]), \
                patch('seahub.chats.view.ChatSessions.objects.create_session', return_value=session), \
                patch('seahub.chats.view.gen_message_id', side_effect=Exception('bad')):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 500

    def test_post_ai_limit_exceed(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': 'p1', 'query': 'q'}, format='json')
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.check_ai_limit', return_value=True):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 402

    def test_post_get_ai_reply_exception_fallback(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': 'p1', 'query': 'q'}, format='json')
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        session = Mock()
        session.session_uuid = 's1'

        user_msg = Mock()
        user_msg.id = 1

        assistant_msg = Mock()
        assistant_msg.id = 2

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.check_ai_limit', return_value=False), \
                patch('seahub.chats.view.get_attachments', return_value=[]), \
                patch('seahub.chats.view.ChatSessions.objects.create_session', return_value=session), \
                patch('seahub.chats.view.gen_message_id', return_value='m1'), \
                patch('seahub.chats.view.ProjectConnections.objects.filter', return_value=[]), \
                patch('seahub.chats.view.get_ai_reply', side_effect=Exception('ai down')), \
                patch('seahub.chats.view.ChatMessages.objects.create_message', side_effect=[user_msg, assistant_msg]):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['ai_reply'].startswith('Sorry')
        assert resp.data['session_uuid'] == 's1'
        assert resp.data['user_message_id'] == 1
        assert resp.data['ai_reply_message_id'] == 2

    def test_post_success_maps_connection_name(self, factory, user):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': 'p1', 'query': 'q'}, format='json')
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        session = Mock()
        session.session_uuid = 's1'

        user_msg = Mock()
        user_msg.id = 1

        assistant_msg = Mock()
        assistant_msg.id = 2

        connection = Mock()
        connection.pk = 99
        connection.type = 'site'

        ai_response = {'ai_reply': 'ok', 'sources': [{'connection_id': 99}]}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.chats.view.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.chats.view.check_project_permission', return_value=True), \
                patch('seahub.chats.view.check_ai_limit', return_value=False), \
                patch('seahub.chats.view.get_attachments', return_value=[]), \
                patch('seahub.chats.view.ChatSessions.objects.create_session', return_value=session), \
                patch('seahub.chats.view.gen_message_id', return_value='m1'), \
                patch('seahub.chats.view.ProjectConnections.objects.filter', return_value=[connection]), \
                patch('seahub.chats.view.get_ai_reply', return_value=ai_response), \
                patch('seahub.chats.view.ChatMessages.objects.create_message', side_effect=[user_msg, assistant_msg]):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['sources'][0]['connection_id'] == 99

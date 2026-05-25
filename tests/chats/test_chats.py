from unittest.mock import patch
from seahub.chats.view import ChatSessionsView, ChatSessionView, ChatMessagesView, ChatView
from seahub.chats.models import ChatSessions, ChatMessages


class _FakeStreamResponse:
    def iter_lines(self):
        return iter([
            b'data: {"results": {"answer": "stream ok", "sources": []}}',
            b'data: [DONE]',
        ])


class TestChatSessionsView:

    def test_get_feature_not_enabled(self, factory, no_org_user):
        request = factory.get('/api/v1/chat/sessions/', {})
        request.user = no_org_user

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 403

    def test_get_missing_project_uuid(self, factory, project_creator):
        request = factory.get('/api/v1/chat/sessions/', {})
        request.user = project_creator

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 400

    def test_get_project_not_found(self, factory, project_creator, real_project):
        request = factory.get('/api/v1/chat/sessions/', {'project_uuid': '00000000-0000-0000-0000-000000000000'})
        request.user = project_creator

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get('/api/v1/chat/sessions/', {'project_uuid': project.uuid})
        request.user = no_org_user

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project, chat_session):
        project = real_project
        request = factory.get('/api/v1/chat/sessions/', {'project_uuid': str(project.uuid)})
        request.user = project_creator

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['sessions'][0]['session_uuid'] == chat_session.session_uuid

    def test_post_missing_project_uuid(self, factory, project_creator):
        request = factory.post('/api/v1/chat/sessions/', data={'session_name': 'n'})
        request.user = project_creator

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 400

    def test_post_missing_session_name(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post('/api/v1/chat/sessions/', data={'project_uuid': project.uuid})
        request.user = project_creator

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 400

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            '/api/v1/chat/sessions/',
            data={'project_uuid': str(project.uuid), 'session_name': 'n'},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionsView.as_view()(request)

        assert resp.status_code == 201
        assert 'session_uuid' in resp.data['session']


class TestChatSessionView:

    def test_put_missing_project_uuid(self, factory, project_creator):
        request = factory.put('/api/v1/chat/sessions/s1/', data={'session_name': 'n'}, format='json')
        request.user = project_creator

        resp = ChatSessionView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 400

    def test_put_session_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            '/api/v1/chat/sessions/s1/',
            data={'project_uuid': project.uuid, 'session_name': 'n'},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 404

    def test_delete_success(self, factory, project_creator, real_project, chat_session):
        project = real_project
        request = factory.delete(
            f"/api/v1/chat/sessions/{chat_session.session_uuid}/",
            data={'project_uuid': str(project.uuid)},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionView.as_view()(request, session_uuid=chat_session.session_uuid)

        assert resp.status_code == 200
        assert resp.data['success'] is True

        assert ChatSessions.objects.get_session_by_uuid(chat_session.session_uuid) is None


class TestChatMessagesView:

    def test_get_session_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get('/api/v1/chat/sessions/s1/messages/', {'project_uuid': str(project.uuid)})
        request.user = project_creator

        resp = ChatMessagesView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 404

    def test_get_success_thought_process(self, factory, project_creator, real_project, chat_session, chat_messages_with_thought_process):
        project = real_project
        request = factory.get(
            f"/api/v1/chat/sessions/{chat_session.session_uuid}/messages/",
            {'project_uuid': str(project.uuid)}
        )
        request.user = project_creator

        resp = ChatMessagesView.as_view()(request, session_uuid=chat_session.session_uuid)

        assert resp.status_code == 200
        assert len(resp.data['messages']) == 2
        user_msg = next(m for m in resp.data['messages'] if m['role'] == 'user')
        assert user_msg['attachments'][0]['content'] == 'x'
        assert user_msg['attachments'][0]['foo'] == 1

        assistant_msg = next(m for m in resp.data['messages'] if m['role'] == 'assistant')
        assert assistant_msg['thought_process'] == {'x': 1}


class TestChatView:

    def test_post_missing_project_uuid(self, factory, project_creator):
        request = factory.post('/api/v1/ai/chat/', data={'query': 'q'}, format='json')
        request.user = project_creator

        resp = ChatView.as_view()(request)

        assert resp.status_code == 400

    def test_post_missing_query(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': project.uuid}, format='json')
        request.user = project_creator

        resp = ChatView.as_view()(request)

        assert resp.status_code == 400

    def test_post_project_not_found(self, factory, project_creator):
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': '00000000-0000-0000-0000-000000000000', 'query': 'q'}, format='json')
        request.user = project_creator

        resp = ChatView.as_view()(request)

        assert resp.status_code == 404

    def test_post_permission_denied(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.post('/api/v1/ai/chat/', data={'project_uuid': project.uuid, 'query': 'q'}, format='json')
        request.user = no_org_user

        resp = ChatView.as_view()(request)

        assert resp.status_code == 403

    def test_post_existing_session_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            '/api/v1/ai/chat/',
            data={'project_uuid': str(project.uuid), 'query': 'q', 'session_uuid': 's1'},
            format='json'
        )
        request.user = project_creator

        resp = ChatView.as_view()(request)

        assert resp.status_code == 404

    def test_post_get_ai_reply_exception_fallback(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            '/api/v1/ai/chat/',
            data={'project_uuid': str(project.uuid), 'query': 'q', 'stream': False},
            format='json'
        )
        request.user = project_creator

        with patch('seahub.chats.view.get_ai_reply', side_effect=Exception('ai down')):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['ai_reply'].startswith('Sorry')
        assert 'session_uuid' in resp.data
        assert 'user_message_id' in resp.data
        assert 'ai_reply_message_id' in resp.data
        assert ChatMessages.objects.filter(id=resp.data['user_message_id']).exists()
        assert ChatMessages.objects.filter(id=resp.data['ai_reply_message_id']).exists()

    def test_post_success_maps_connection_name(self, factory, project_creator, real_project, site_connection):
        project = real_project
        request = factory.post(
            '/api/v1/ai/chat/',
            data={'project_uuid': str(project.uuid), 'query': 'q', 'stream': False},
            format='json'
        )
        request.user = project_creator

        ai_response = {'ai_reply': 'ok', 'sources': [{'connection_id': site_connection.id}]}

        with patch('seahub.chats.view.get_ai_reply', return_value=ai_response):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['sources'][0]['connection_id'] == site_connection.id

    def test_post_non_stream_generates_title_for_first_round(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            '/api/v1/ai/chat/',
            data={'project_uuid': str(project.uuid), 'query': 'how to fix sync error', 'stream': False},
            format='json'
        )
        request.user = project_creator

        ai_response = {'ai_reply': 'Try updating client config.', 'sources': []}
        with patch('seahub.chats.view.get_ai_reply', return_value=ai_response), \
             patch('seahub.chats.view.generate_session_title', return_value='Fix sync error') as mock_title:
            resp = ChatView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['session_name'] == 'Fix sync error'
        mock_title.assert_called_once()

    def test_post_non_stream_skips_title_generation_after_first_round(self, factory, project_creator, real_project):
        session = ChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='seed title',
            username=project_creator.username,
        )
        ChatMessages.objects.create_message(session.session_uuid, 'm1', 'user', 'hello')
        ChatMessages.objects.create_message(session.session_uuid, 'm1', 'assistant', 'hi', sources='[]')

        request = factory.post(
            '/api/v1/ai/chat/',
            data={
                'project_uuid': str(real_project.uuid),
                'session_uuid': session.session_uuid,
                'query': 'follow up question',
                'stream': False,
            },
            format='json'
        )
        request.user = project_creator

        ai_response = {'ai_reply': 'follow up answer', 'sources': []}
        with patch('seahub.chats.view.get_ai_reply', return_value=ai_response), \
             patch('seahub.chats.view.generate_session_title') as mock_title:
            resp = ChatView.as_view()(request)

        assert resp.status_code == 200
        assert 'session_name' not in resp.data
        mock_title.assert_not_called()

    def test_post_stream_result_contains_generated_session_name(self, factory, project_creator, real_project):
        request = factory.post(
            '/api/v1/ai/chat/',
            data={'project_uuid': str(real_project.uuid), 'query': 'stream test', 'stream': True},
            format='json'
        )
        request.user = project_creator

        with patch('seahub.chats.view.get_ai_reply', return_value=_FakeStreamResponse()), \
             patch('seahub.chats.utils.generate_session_title', return_value='Stream title'):
            resp = ChatView.as_view()(request)
            payload = b''.join(resp.streaming_content).decode('utf-8')

        assert resp.status_code == 200
        assert '"session_name": "Stream title"' in payload

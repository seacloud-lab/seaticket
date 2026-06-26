from unittest.mock import patch
from django.core.cache import cache
from seahub.chats.view import ChatSessionsView, ChatSessionView, ChatMessagesView, ChatView, ChatSessionTitleView, ChatSessionCopyView
from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess
from seahub.chats.utils import gen_chat_task_id


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


class TestChatSessionCopyView:

    def test_post_missing_project_uuid(self, factory, project_creator, chat_session):
        request = factory.post(
            f'/api/v1/chat/sessions/{chat_session.session_uuid}/copy/',
            data={},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionCopyView.as_view()(request, session_uuid=chat_session.session_uuid)

        assert resp.status_code == 400

    def test_post_shared_session_success_for_team_member(self, factory, group_project, group_project_owner, group_project_member):
        project = group_project.project
        session = ChatSessions.objects.create_session(
            project_uuid=str(project.uuid),
            session_name='shared chat',
            username=group_project_owner.username,
        )
        session.is_shared = True
        session.save(update_fields=['is_shared'])
        ChatMessages.objects.create_message(
            session.session_uuid,
            'm1',
            'user',
            'hello',
            attachments=[{'type': 'ticket', 'record_id': 1}],
        )
        ChatMessages.objects.create_message(
            session.session_uuid,
            'm2',
            'assistant',
            'hi',
            sources='[]',
        )
        ChatMessageThoughtProcess.objects.create_thought_process(
            session.session_uuid,
            'm2',
            {'tool': 'search'},
        )
        request = factory.post(
            f'/api/v1/chat/sessions/{session.session_uuid}/copy/',
            data={'project_uuid': str(project.uuid)},
            format='json'
        )
        request.user = group_project_member

        resp = ChatSessionCopyView.as_view()(request, session_uuid=session.session_uuid)

        assert resp.status_code == 201
        copied_session = ChatSessions.objects.get_session_by_uuid(resp.data['session']['session_uuid'])
        assert copied_session.username == group_project_member.username
        assert copied_session.session_uuid != session.session_uuid
        assert copied_session.session_name == session.session_name
        assert copied_session.is_shared is False

        copied_messages = list(ChatMessages.objects.get_messages_by_session(copied_session.session_uuid))
        assert len(copied_messages) == 2
        assert [message.role for message in copied_messages] == ['user', 'assistant']
        assert copied_messages[0].to_dict()['attachments'] == [{'type': 'ticket', 'record_id': 1}]
        assert ChatMessageThoughtProcess.objects.get_thought_process_from_session_uuid_and_message_id(
            copied_session.session_uuid,
            'm2'
        ) == {'tool': 'search'}

    def test_post_private_session_denied_for_team_member(self, factory, group_project, group_project_owner, group_project_member):
        project = group_project.project
        session = ChatSessions.objects.create_session(
            project_uuid=str(project.uuid),
            session_name='private chat',
            username=group_project_owner.username,
        )
        request = factory.post(
            f'/api/v1/chat/sessions/{session.session_uuid}/copy/',
            data={'project_uuid': str(project.uuid)},
            format='json'
        )
        request.user = group_project_member

        resp = ChatSessionCopyView.as_view()(request, session_uuid=session.session_uuid)

        assert resp.status_code == 403

    def test_post_running_session_denied(self, factory, group_project, group_project_owner, group_project_member):
        project = group_project.project
        session = ChatSessions.objects.create_session(
            project_uuid=str(project.uuid),
            session_name='shared chat',
            username=group_project_owner.username,
        )
        session.is_shared = True
        session.save(update_fields=['is_shared'])
        request = factory.post(
            f'/api/v1/chat/sessions/{session.session_uuid}/copy/',
            data={'project_uuid': str(project.uuid)},
            format='json'
        )
        request.user = group_project_member

        task_id = gen_chat_task_id(session.session_uuid)
        cache.set(task_id, {'user_input': {'message': 'hello', 'attachments': []}}, 60)
        try:
            resp = ChatSessionCopyView.as_view()(request, session_uuid=session.session_uuid)
        finally:
            cache.delete(task_id)

        assert resp.status_code == 409


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

    def test_post_shared_session_denied_for_non_owner(self, factory, group_project, group_project_owner, group_project_member):
        project = group_project.project
        session = ChatSessions.objects.create_session(
            project_uuid=str(project.uuid),
            session_name='shared chat',
            username=group_project_owner.username,
        )
        session.is_shared = True
        session.save(update_fields=['is_shared'])
        request = factory.post(
            '/api/v1/ai/chat/',
            data={
                'project_uuid': str(project.uuid),
                'query': 'q',
                'session_uuid': session.session_uuid,
                'stream': False,
            },
            format='json'
        )
        request.user = group_project_member

        resp = ChatView.as_view()(request)

        assert resp.status_code == 403
        assert ChatMessages.objects.filter(session_uuid=session.session_uuid).count() == 0

    def test_post_shared_session_owner_can_continue(self, factory, group_project, group_project_owner):
        project = group_project.project
        session = ChatSessions.objects.create_session(
            project_uuid=str(project.uuid),
            session_name='shared chat',
            username=group_project_owner.username,
        )
        session.is_shared = True
        session.save(update_fields=['is_shared'])
        request = factory.post(
            '/api/v1/ai/chat/',
            data={
                'project_uuid': str(project.uuid),
                'query': 'q',
                'session_uuid': session.session_uuid,
                'stream': False,
            },
            format='json'
        )
        request.user = group_project_owner

        with patch('seahub.chats.view.get_ai_reply', return_value={'ai_reply': 'ok', 'sources': []}):
            resp = ChatView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['session_uuid'] == session.session_uuid

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


class TestChatSessionTitleView:

    def test_post_success(self, factory, project_creator, real_project, chat_session):
        project = real_project
        request = factory.post(
            f'/api/v1/chat/sessions/{chat_session.session_uuid}/generate-title/',
            data={
                'project_uuid': str(project.uuid),
                'query': 'how to fix sync error',
                'ai_reply': 'Try updating client config.',
            },
            format='json'
        )
        request.user = project_creator

        with patch('seahub.chats.view.generate_session_title', return_value='Fix sync error') as mock_title:
            resp = ChatSessionTitleView.as_view()(request, session_uuid=chat_session.session_uuid)

        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert resp.data['session_name'] == 'Fix sync error'
        mock_title.assert_called_once()

    def test_post_missing_project_uuid(self, factory, project_creator, chat_session):
        request = factory.post(
            f'/api/v1/chat/sessions/{chat_session.session_uuid}/generate-title/',
            data={'query': 'q', 'ai_reply': 'a'},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionTitleView.as_view()(request, session_uuid=chat_session.session_uuid)

        assert resp.status_code == 400

    def test_post_missing_query(self, factory, project_creator, real_project, chat_session):
        request = factory.post(
            f'/api/v1/chat/sessions/{chat_session.session_uuid}/generate-title/',
            data={'project_uuid': str(real_project.uuid), 'ai_reply': 'a'},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionTitleView.as_view()(request, session_uuid=chat_session.session_uuid)

        assert resp.status_code == 400

    def test_post_missing_ai_reply(self, factory, project_creator, real_project, chat_session):
        request = factory.post(
            f'/api/v1/chat/sessions/{chat_session.session_uuid}/generate-title/',
            data={'project_uuid': str(real_project.uuid), 'query': 'q'},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionTitleView.as_view()(request, session_uuid=chat_session.session_uuid)

        assert resp.status_code == 400

    def test_post_session_not_found(self, factory, project_creator, real_project):
        request = factory.post(
            '/api/v1/chat/sessions/s1/generate-title/',
            data={'project_uuid': str(real_project.uuid), 'query': 'q', 'ai_reply': 'a'},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionTitleView.as_view()(request, session_uuid='s1')

        assert resp.status_code == 404

    def test_post_permission_denied_for_non_owner(self, factory, project_creator, real_project):
        session = ChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='seed',
            username='another-user',
        )
        request = factory.post(
            f'/api/v1/chat/sessions/{session.session_uuid}/generate-title/',
            data={'project_uuid': str(real_project.uuid), 'query': 'q', 'ai_reply': 'a'},
            format='json'
        )
        request.user = project_creator

        resp = ChatSessionTitleView.as_view()(request, session_uuid=session.session_uuid)

        assert resp.status_code == 403

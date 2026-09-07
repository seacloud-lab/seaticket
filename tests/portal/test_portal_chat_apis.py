import json
from io import BytesIO
from datetime import date, datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from django.utils import timezone

from seahub.portal.chat.apis import (
    PortalAdminChatMessagesView,
    PortalAdminChatSessionsView,
    PortalAdminChatStatisticsView,
    PortalChatImageView,
    PortalChatMessagesView,
    PortalChatSessionsView,
    PortalChatView,
    PortalChatSessionTitleView,
)
from seahub.portal.chat.utils import encode_portal_chat_image_token, rewrite_portal_chat_image_urls
from seahub.portal.visitor_session import create_visitor_session
from seahub.portal.models import PortalChatSessions, PortalChatMessages
from seahub.project.constants import AIScenario
from seahub.project.models import AIUsageStatistics
from seahub.utils import uuid_str_to_32_chars


def _set_portal_settings(project, **kwargs):
    settings_dict = json.loads(project.settings) if project.settings else {}
    portal = settings_dict.get('portal', {})
    portal.update(kwargs)
    settings_dict['portal'] = portal
    project.settings = json.dumps(settings_dict)
    project.save(update_fields=['settings'])


@pytest.fixture
def portal_mode_settings(settings):
    settings.IS_PORTAL_MODE = True


@pytest.mark.usefixtures('portal_mode_settings')
class TestPortalChatPermissionAnonymous:

    def test_anonymous_disabled_returns_403(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=False, enable_password_protection=False)
        request = factory.get(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/'
        )

        resp = PortalChatSessionsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 403

    def test_anonymous_enabled_no_password_returns_200(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        request = factory.get(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/'
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        resp = PortalChatSessionsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200

    def test_anonymous_enabled_with_password_not_verified_returns_403(self, factory, real_project):
        _set_portal_settings(
            real_project, allow_anonymous=True,
            enable_password_protection=True, password='secret'
        )
        visitor = create_visitor_session()
        request = factory.get(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/'
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        resp = PortalChatSessionsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 403

    def test_anonymous_enabled_with_password_verified_returns_200(self, factory, real_project):
        _set_portal_settings(
            real_project, allow_anonymous=True,
            enable_password_protection=True, password='secret'
        )
        visitor = create_visitor_session()
        request = factory.get(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/'
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])
        request.session[f'portal_verified_token_{real_project.uuid}'] = 'secret'

        resp = PortalChatSessionsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200


@pytest.mark.usefixtures('portal_mode_settings')
class TestPortalChatViewAnonymous:

    def test_visitor_session_expired_returns_401_with_error_code(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='test',
            username=visitor['visitor_uuid'],
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({
                'query': 'hello',
                'session_uuid': session.session_uuid,
            }),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid, _get_visitor_session_cache_key
        from django.core.cache import cache
        cache.delete(_get_visitor_session_cache_key(visitor['visitor_uuid']))
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 401
        assert resp.data.get('error_code') == 'visitor_session_expired'

    def test_anonymous_chat_response_has_message_ids(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='test',
            username=visitor['visitor_uuid'],
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({
                'query': 'hello',
                'session_uuid': session.session_uuid,
            }),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.validate_chat_input', return_value={'valid': True, 'reason': ''}), \
                patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply, \
                patch('seahub.portal.chat.apis.check_ai_limit', return_value=False):
            mock_get_ai_reply.return_value = Mock(
                iter_lines=lambda: [
                    b'data: {"results": {"ai_reply": "hello world", "sources": []}}',
                    b'data: [DONE]',
                ],
                status_code=200,
            )

            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        list(resp.streaming_content)

        messages = PortalChatMessages.objects.filter(
            session_uuid=session.session_uuid
        ).order_by('created_at')
        assert messages.count() == 2
        assert messages[0].role == 'user'
        assert messages[1].role == 'assistant'

    def test_non_stream_anonymous_chat_response_has_message_ids(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='test',
            username=visitor['visitor_uuid'],
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({
                'query': 'hello',
                'session_uuid': session.session_uuid,
                'stream': False,
            }),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.validate_chat_input', return_value={'valid': True, 'reason': ''}), \
                patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply, \
                patch('seahub.portal.chat.apis.check_ai_limit', return_value=False):
            mock_get_ai_reply.return_value = {
                'ai_reply': 'hello world',
                'sources': [],
            }

            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        assert 'user_message_id' in resp.data
        assert 'ai_reply_message_id' in resp.data
        assert resp.data['user_message_id'] is not None
        assert resp.data['ai_reply_message_id'] is not None

    def test_input_validation_rejected_records_mock_reply(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='test', username=visitor['visitor_uuid']
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({'query': 'disallowed request', 'session_uuid': session.session_uuid, 'stream': False}),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.check_ai_limit', return_value=False), \
                patch('seahub.portal.chat.apis.validate_chat_input', return_value={'valid': False, 'reason': 'Request is not allowed.'}) as mock_validate, \
                patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply:
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        assert resp.data['ai_reply'] == 'Request is not allowed.'
        assert PortalChatMessages.objects.filter(session_uuid=session.session_uuid).count() == 2
        mock_validate.assert_called_once()
        mock_get_ai_reply.assert_not_called()

    def test_duplicate_image_names_records_mock_reply(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='test', username=visitor['visitor_uuid']
        )
        image_url = f'/upload-file/portal/{real_project.uuid}/same-name.png'
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({
                'query': 'check these images',
                'session_uuid': session.session_uuid,
                'stream': False,
                'attachments': [
                    {'type': 'image', 'path': image_url},
                    {'type': 'image', 'path': image_url},
                ],
            }),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.check_ai_limit', return_value=False):
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        assert resp.data['ai_reply'] == 'Images with the same name are not allowed.'
        assert PortalChatMessages.objects.filter(session_uuid=session.session_uuid).count() == 2

    def test_input_validation_forwards_project_and_portal_prompts(self, factory, real_project):
        _set_portal_settings(
            real_project,
            allow_anonymous=True,
            enable_password_protection=False,
            chat_prompt='Answer only product support questions.',
        )
        settings = json.loads(real_project.settings)
        settings['prompt'] = 'The project is Seafile support.'
        real_project.settings = json.dumps(settings)
        real_project.save(update_fields=['settings'])
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='test', username=visitor['visitor_uuid']
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({'query': 'How do I fix sync?', 'session_uuid': session.session_uuid, 'stream': False}),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.check_ai_limit', return_value=False), \
                patch('seahub.portal.chat.apis.validate_chat_input', return_value={'valid': True, 'reason': ''}) as mock_validate, \
                patch('seahub.portal.chat.apis.get_ai_reply', return_value={'ai_reply': 'ok', 'sources': []}) as mock_get_ai_reply:
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        validation_params = mock_validate.call_args.args[0]
        assert validation_params['project_prompt'] == 'The project is Seafile support.'
        assert validation_params['portal_chat_prompt'] == 'Answer only product support questions.'
        assert validation_params['is_external_portal'] is True
        assert validation_params['scenario'] == AIScenario.PORTAL_CHAT.value
        chat_params = mock_get_ai_reply.call_args.args[0]
        assert chat_params['project_prompt'] == 'The project is Seafile support.'
        assert chat_params['portal_chat_prompt'] == 'Answer only product support questions.'
        assert chat_params['is_external_portal'] is True
        assert chat_params['scenario'] == AIScenario.PORTAL_CHAT.value

@pytest.mark.usefixtures('portal_mode_settings')
class TestPortalChatImageRewriteAnonymous:

    def test_rewrite_skips_unsupported_attachment_prefix(self, real_project):
        raw_image_url = f'/file/project/{real_project.uuid}/attachments/chat/12/a.png'

        content = rewrite_portal_chat_image_urls(
            real_project.uuid,
            f'![a]({raw_image_url})',
            'session-uuid',
            'abcd',
            'visitor-uuid',
        )

        assert raw_image_url in content
        assert f'/file/portal-chat-image/{real_project.uuid}/?token=' not in content

    def test_rewrite_supports_portal_issue_image(self, real_project):
        raw_image_url = f'/file/project/{real_project.uuid}/portal/portal-issues/12/a.png'

        content = rewrite_portal_chat_image_urls(
            real_project.uuid,
            f'![a]({raw_image_url})',
            'session-uuid',
            'abcd',
            'visitor-uuid',
        )

        assert raw_image_url not in content
        assert f'/file/portal-chat-image/{real_project.uuid}/?token=' in content

    def test_history_response_rewrites_internal_image_url(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='test',
            username=visitor['visitor_uuid'],
        )
        raw_image_url = f'/file/project/{real_project.uuid}/attachments/ticket/12/a.png'
        PortalChatMessages.objects.create_message(session.session_uuid, 'abcd', 'assistant', f'![a]({raw_image_url})')
        request = factory.get(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/{session.session_uuid}/messages/'
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        resp = PortalChatMessagesView.as_view()(
            request,
            project_uuid=str(real_project.uuid),
            session_uuid=session.session_uuid,
        )

        assert resp.status_code == 200
        assert raw_image_url not in resp.data['messages'][0]['content']
        assert f'/file/portal-chat-image/{real_project.uuid}/?token=' in resp.data['messages'][0]['content']


@pytest.mark.usefixtures('portal_mode_settings')
class TestPortalChatImageViewAnonymous:

    def test_portal_chat_image_proxy_serves_valid_token(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='test',
            username=visitor['visitor_uuid'],
        )
        file_path = 'attachments/ticket/12/a.png'
        token = encode_portal_chat_image_token(str(real_project.uuid), file_path, session.session_uuid, 'abcd', visitor['visitor_uuid'])
        request = factory.get(f'/file/portal-chat-image/{real_project.uuid}/?token={token}')
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.get_project_file_head_from_s3', return_value={'ContentType': 'image/png'}) as head_mock, \
                patch('seahub.portal.chat.apis.get_project_file_from_s3', return_value=BytesIO(b'png')) as file_mock:
            resp = PortalChatImageView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'image/png'
        head_mock.assert_called_once_with(str(real_project.uuid), file_path)
        file_mock.assert_called_once_with(str(real_project.uuid), file_path)

    def test_portal_chat_image_proxy_uses_extension_content_type(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='test',
            username=visitor['visitor_uuid'],
        )
        file_path = 'attachments/ticket/12/a.png'
        token = encode_portal_chat_image_token(str(real_project.uuid), file_path, session.session_uuid, 'abcd', visitor['visitor_uuid'])
        request = factory.get(f'/file/portal-chat-image/{real_project.uuid}/?token={token}')
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.get_project_file_head_from_s3', return_value={'ContentType': 'text/plain'}), \
                patch('seahub.portal.chat.apis.get_project_file_from_s3', return_value=BytesIO(b'png')):
            resp = PortalChatImageView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'image/png'

    def test_portal_chat_image_proxy_rejects_other_visitor(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor_a = create_visitor_session()
        visitor_b = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='test',
            username=visitor_a['visitor_uuid'],
        )
        token = encode_portal_chat_image_token(
            str(real_project.uuid),
            'attachments/ticket/12/a.png',
            session.session_uuid,
            'abcd',
            visitor_a['visitor_uuid'],
        )
        request = factory.get(f'/file/portal-chat-image/{real_project.uuid}/?token={token}')
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor_b['visitor_uuid'])

        resp = PortalChatImageView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 403


@pytest.mark.usefixtures('portal_mode_settings')
class TestPortalChatSessionsAnonymous:

    def test_anonymous_user_gets_own_sessions(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor_a = create_visitor_session()
        visitor_b = create_visitor_session()
        PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='session-a',
            username=visitor_a['visitor_uuid'],
        )
        PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='session-b',
            username=visitor_b['visitor_uuid'],
        )
        request = factory.get(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/'
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor_a['visitor_uuid'])

        resp = PortalChatSessionsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        session_names = [s['session_name'] for s in resp.data['sessions']]
        assert 'session-a' in session_names
        assert 'session-b' not in session_names


@pytest.mark.usefixtures('portal_mode_settings')
class TestPortalChatSessionTitleViewAnonymous:

    def test_generate_title_success(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='New chat',
            username=visitor['visitor_uuid'],
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/{session.session_uuid}/generate-title/',
            data=json.dumps({'query': 'how to fix sync error', 'ai_reply': 'Try updating client config.'}),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.generate_portal_session_title', return_value='Fix sync error') as mock_title:
            resp = PortalChatSessionTitleView.as_view()(
                request, project_uuid=str(real_project.uuid), session_uuid=session.session_uuid
            )

        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert resp.data['session_name'] == 'Fix sync error'
        mock_title.assert_called_once()

    def test_generate_title_permission_denied_for_other_visitor(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor_a = create_visitor_session()
        visitor_b = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='New chat',
            username=visitor_a['visitor_uuid'],
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/{session.session_uuid}/generate-title/',
            data=json.dumps({'query': 'q', 'ai_reply': 'a'}),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor_b['visitor_uuid'])

        resp = PortalChatSessionTitleView.as_view()(
            request, project_uuid=str(real_project.uuid), session_uuid=session.session_uuid
        )

        assert resp.status_code == 403

    def test_generate_title_missing_query_or_ai_reply(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='New chat',
            username=visitor['visitor_uuid'],
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid

        request_missing_query = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/{session.session_uuid}/generate-title/',
            data=json.dumps({'ai_reply': 'a'}),
            content_type='application/json',
        )
        request_missing_query.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])
        resp_missing_query = PortalChatSessionTitleView.as_view()(
            request_missing_query, project_uuid=str(real_project.uuid), session_uuid=session.session_uuid
        )

        request_missing_ai_reply = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/sessions/{session.session_uuid}/generate-title/',
            data=json.dumps({'query': 'q'}),
            content_type='application/json',
        )
        request_missing_ai_reply.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])
        resp_missing_ai_reply = PortalChatSessionTitleView.as_view()(
            request_missing_ai_reply, project_uuid=str(real_project.uuid), session_uuid=session.session_uuid
        )

        assert resp_missing_query.status_code == 400
        assert resp_missing_ai_reply.status_code == 400


@pytest.mark.usefixtures('portal_mode_settings')
class TestPortalAdminChatAPIs:

    def _admin_request(self, factory, project, user, path):
        request = factory.get(path)
        request.user = user
        return request

    def _admin_post_request(self, factory, project, user, path, data):
        request = factory.post(path, data=data)
        request.user = user
        return request

    def test_list_sessions_is_paginated(self, factory, real_project, project_creator):
        for index in range(3):
            PortalChatSessions.objects.create_session(
                project_uuid=str(real_project.uuid),
                session_name=f'session-{index}',
                username=f'user-{index}@example.com',
            )

        request = self._admin_post_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/sessions/',
            data={'start': 0, 'limit': 2},
        )
        response = PortalAdminChatSessionsView.as_view()(
            request,
            project_uuid=str(real_project.uuid),
        )

        assert response.status_code == 200
        assert len(response.data['sessions']) == 2

        request = self._admin_post_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/sessions/',
            data={'start': 2, 'limit': 2},
        )
        response = PortalAdminChatSessionsView.as_view()(
            request,
            project_uuid=str(real_project.uuid),
        )

        assert response.status_code == 200
        assert len(response.data['sessions']) == 1

    def test_get_session_messages(self, factory, real_project, project_creator):
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='customer question',
            username='customer@example.com',
        )
        PortalChatMessages.objects.create_message(
            session.session_uuid, 'abcd', 'user', 'How do I reset my password?'
        )
        PortalChatMessages.objects.create_message(
            session.session_uuid, 'abcd', 'assistant', 'Use the password reset page.'
        )

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/sessions/{session.session_uuid}/messages/',
        )
        response = PortalAdminChatMessagesView.as_view()(
            request,
            project_uuid=str(real_project.uuid),
            session_uuid=session.session_uuid,
        )

        assert response.status_code == 200
        assert response.data['session']['session_uuid'] == session.session_uuid
        assert [message['content'] for message in response.data['messages']] == [
            'How do I reset my password?',
            'Use the password reset page.',
        ]

    def test_statistics_only_include_portal_chat_usage(self, factory, real_project, project_creator):
        project_uuid = uuid_str_to_32_chars(str(real_project.uuid))
        common_data = {
            'date': date.today(),
            'project_uuid': project_uuid,
            'owner': 'customer@example.com',
            'org_id': real_project.workspace.org_id,
            'group_id': None,
            'model': 'gpt-4',
        }
        AIUsageStatistics.objects.create(
            **common_data,
            scenario=AIScenario.PORTAL_CHAT.value,
            input_tokens=100,
            output_tokens=40,
            cost=1.5,
        )
        AIUsageStatistics.objects.create(
            **common_data,
            scenario=AIScenario.CHAT.value,
            input_tokens=900,
            output_tokens=800,
            cost=9.0,
        )

        PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='customer question',
            username='customer@example.com',
        )

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        response = PortalAdminChatStatisticsView.as_view()(
            request,
            project_uuid=str(real_project.uuid),
        )

        assert response.status_code == 200
        assert response.data['user_count'] == 1
        assert response.data['input_tokens'] == 100
        assert response.data['output_tokens'] == 40
        assert response.data['total_credit_used'] == 150

    def test_statistics_include_daily_session_counts_for_last_month(self, factory, real_project, project_creator):
        today = date(2026, 3, 1)
        recent_session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='recent session',
            username='customer@example.com',
        )
        another_recent_session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='another recent session',
            username='another-customer@example.com',
        )
        old_session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='old session',
            username='old-customer@example.com',
        )
        other_project_session = PortalChatSessions.objects.create_session(
            project_uuid='other-project-uuid',
            session_name='other project session',
            username='other-customer@example.com',
        )
        PortalChatSessions.objects.filter(
            id__in=[recent_session.id, another_recent_session.id]
        ).update(created_at=timezone.make_aware(
            datetime.combine(date(2026, 2, 2), datetime.min.time())
        ))
        PortalChatSessions.objects.filter(id=old_session.id).update(created_at=timezone.make_aware(
            datetime.combine(date(2026, 2, 1), datetime.min.time())
        ))
        PortalChatSessions.objects.filter(id=other_project_session.id).update(created_at=timezone.make_aware(
            datetime.combine(today, datetime.min.time())
        ))

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.apis.timezone.localdate', return_value=today):
            response = PortalAdminChatStatisticsView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert len(response.data['daily_session_counts']) == 28
        assert response.data['daily_session_counts'][0] == {
            'date': '2026-02-02', 'count': 2,
        }
        assert response.data['daily_session_counts'][-1] == {
            'date': today.isoformat(), 'count': 0,
        }
        assert response.data['daily_session_counts'][-2] == {
            'date': (today - timedelta(days=1)).isoformat(), 'count': 0,
        }

    def test_statistics_daily_counts_do_not_use_database_timezone_conversion(self, factory, real_project, project_creator):
        today = date(2026, 3, 1)
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='recent session',
            username='customer@example.com',
        )
        PortalChatSessions.objects.filter(id=session.id).update(created_at=timezone.make_aware(
            datetime.combine(date(2026, 2, 2), datetime.min.time())
        ))

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.apis.timezone.localdate', return_value=today), \
                patch('django.db.models.query.QuerySet.annotate', side_effect=RuntimeError('timezone conversion unavailable')):
            response = PortalAdminChatStatisticsView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert response.data['daily_session_counts'][0] == {
            'date': '2026-02-02', 'count': 1,
        }

    def test_statistics_exclude_month_end_date_outside_last_month(self, factory, real_project, project_creator):
        today = date(2026, 3, 31)
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='old session',
            username='customer@example.com',
        )
        PortalChatSessions.objects.filter(id=session.id).update(created_at=timezone.make_aware(
            datetime.combine(date(2026, 2, 28), datetime.min.time())
        ))

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.apis.timezone.localdate', return_value=today):
            response = PortalAdminChatStatisticsView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert response.data['daily_session_counts'][0] == {
            'date': '2026-03-01', 'count': 0,
        }
        assert response.data['daily_session_counts'][-1] == {
            'date': '2026-03-31', 'count': 0,
        }

    def test_admin_chat_apis_reject_non_admin(self, factory, real_project, auth_user):
        request = self._admin_request(
            factory,
            real_project,
            auth_user,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/sessions/',
        )

        response = PortalAdminChatSessionsView.as_view()(
            request,
            project_uuid=str(real_project.uuid),
        )

        assert response.status_code == 403

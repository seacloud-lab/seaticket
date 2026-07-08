import json
from io import BytesIO
from unittest.mock import Mock, patch

import pytest

from seahub.portal.chat.apis import (
    PortalChatImageView,
    PortalChatMessagesView,
    PortalChatSessionsView,
    PortalChatView,
    PortalChatSessionTitleView,
)
from seahub.portal.chat.utils import encode_portal_chat_image_token, rewrite_portal_chat_image_urls
from seahub.portal.visitor_session import create_visitor_session
from seahub.portal.models import PortalChatSessions, PortalChatMessages


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

        with patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply, \
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

        with patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply, \
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

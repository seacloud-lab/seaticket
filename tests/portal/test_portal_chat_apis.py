import json
from unittest.mock import Mock, patch

from seahub.portal.chat.apis import (
    PortalChatSessionsView,
    PortalChatView,
)
from seahub.portal.visitor_session import create_visitor_session
from seahub.portal.models import PortalChatSessions, PortalChatMessages


def _set_portal_settings(project, **kwargs):
    settings_dict = json.loads(project.settings) if project.settings else {}
    portal = settings_dict.get('portal', {})
    portal.update(kwargs)
    settings_dict['portal'] = portal
    project.settings = json.dumps(settings_dict)
    project.save(update_fields=['settings'])


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

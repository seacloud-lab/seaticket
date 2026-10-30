import json
from io import BytesIO
from datetime import date, datetime, timedelta
from datetime import timezone as datetime_timezone
from unittest.mock import Mock, patch

import pytest
from django.db import connection
from django.utils import timezone

from seahub.portal.chat.apis import (
    PortalAdminChatMessagesView,
    PortalAdminChatSessionsView,
    PortalAdminChatStatisticsView,
    PortalAdminChatUserUsageView,
    PortalChatImageView,
    PortalChatMessagesView,
    PortalChatSessionsView,
    PortalChatView,
    PortalChatSessionTitleView,
)
from seahub.portal.chat.constants import PORTAL_ANON_CHAT_SESSION_DAILY_LIMIT
from seahub.portal.chat.utils import (
    encode_portal_chat_image_token,
    mark_anonymous_chat_rate_limit,
    rewrite_portal_chat_image_urls,
)
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


def _utc_midnight(day):
    return datetime.combine(day, datetime.min.time(), tzinfo=datetime_timezone.utc)


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

    def test_stream_input_validation_rejected_returns_sse_result(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='test', username=visitor['visitor_uuid']
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({'query': 'disallowed request', 'session_uuid': session.session_uuid, 'stream': True}),
            content_type='application/json',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(visitor['visitor_uuid'])

        with patch('seahub.portal.chat.apis.check_ai_limit', return_value=False), \
                patch('seahub.portal.chat.apis.validate_chat_input', return_value={'valid': False, 'reason': 'Request is not allowed.'}) as mock_validate, \
                patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply:
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        content = b''.join(resp.streaming_content).decode('utf-8')

        assert resp.status_code == 200
        assert resp['Content-Type'].startswith('text/event-stream')
        assert 'data: {"results": ' in content
        assert 'Request is not allowed.' in content
        assert 'data: [DONE]' in content
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

    def _post_anonymous_chat(self, factory, real_project, session, query, ip=None, stream=True):
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/chat/',
            data=json.dumps({
                'query': query,
                'session_uuid': session.session_uuid,
                'stream': stream,
            }),
            content_type='application/json',
            HTTP_X_FORWARDED_FOR=ip or '127.0.0.1',
        )
        from seahub.portal.visitor_session import _sign_visitor_uuid
        request.COOKIES['portal_visitor_session'] = _sign_visitor_uuid(session.username)
        return request

    def _assert_usage_limit_rejection(self, session, query, resp, status_code, error_msg, mock_get_ai_reply):
        assert resp.status_code == status_code
        assert resp.data['error_msg'] == error_msg
        messages = PortalChatMessages.objects.filter(
            session_uuid=session.session_uuid
        ).order_by('created_at')
        assert messages.count() == 2
        assert messages[0].role == 'user'
        assert messages[0].content == query
        assert messages[1].role == 'assistant'
        assert messages[1].content == error_msg
        mock_get_ai_reply.assert_not_called()

    @pytest.mark.parametrize('cost', [0.01, 0.02])
    @pytest.mark.parametrize('hour, minute', [(15, 59), (16, 0), (23, 59)])
    def test_daily_quota_exceeded_records_rejection(self, factory, real_project, cost, hour, minute):
        _set_portal_settings(
            real_project, allow_anonymous=True, enable_password_protection=False,
            daily_chat_credit_limit=1,
        )
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='quota', username=visitor['visitor_uuid']
        )
        AIUsageStatistics.objects.create(
            date=date(2026, 10, 25),
            project_uuid=uuid_str_to_32_chars(str(real_project.uuid)),
            owner='owner',
            model='test-model',
            scenario=AIScenario.PORTAL_CHAT.value,
            cost=cost,
        )
        query = 'what is the quota'
        request = self._post_anonymous_chat(factory, real_project, session, query)

        now = datetime(2026, 10, 25, hour, minute, tzinfo=datetime_timezone.utc)
        with timezone.override('Asia/Shanghai'), \
                patch('seahub.portal.chat.utils.timezone.now', return_value=now), \
                patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply:
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        self._assert_usage_limit_rejection(
            session, query, resp, 429, 'Portal chat daily quota exceeded.', mock_get_ai_reply,
        )

    @pytest.mark.parametrize('now, cost', [
        (datetime(2026, 10, 25, 23, 59, tzinfo=datetime_timezone.utc), 0.005),
        (datetime(2026, 10, 26, 0, 0, tzinfo=datetime_timezone.utc), 0.02),
    ])
    def test_daily_quota_allows_chat_below_limit_or_after_utc_midnight(self, factory, real_project, now, cost):
        _set_portal_settings(
            real_project, allow_anonymous=True, enable_password_protection=False,
            daily_chat_credit_limit=1,
        )
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='quota', username=visitor['visitor_uuid']
        )
        AIUsageStatistics.objects.create(
            date=date(2026, 10, 25),
            project_uuid=uuid_str_to_32_chars(str(real_project.uuid)),
            owner='owner',
            model='test-model',
            scenario=AIScenario.PORTAL_CHAT.value,
            cost=cost,
        )
        request = self._post_anonymous_chat(factory, real_project, session, 'hello', stream=False)

        with timezone.override('Asia/Shanghai'), \
                patch('seahub.portal.chat.utils.timezone.now', return_value=now), \
                patch('seahub.portal.chat.apis.check_ai_limit', return_value=False), \
                patch('seahub.portal.chat.apis.validate_chat_input', return_value={'valid': True, 'reason': ''}), \
                patch('seahub.portal.chat.apis.get_ai_reply', return_value={'ai_reply': 'ok', 'sources': []}) as mock_get_ai_reply:
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        assert resp.status_code == 200
        assert resp.data['ai_reply'] == 'ok'
        mock_get_ai_reply.assert_called_once()
        assert PortalChatMessages.objects.filter(session_uuid=session.session_uuid).count() == 2

    def test_anonymous_daily_limit_records_rejection(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='limit', username=visitor['visitor_uuid']
        )
        ip = f'anon-{visitor["visitor_uuid"]}'
        for _ in range(PORTAL_ANON_CHAT_SESSION_DAILY_LIMIT):
            mark_anonymous_chat_rate_limit(visitor['visitor_uuid'], ip)
        query = 'one more question'
        request = self._post_anonymous_chat(factory, real_project, session, query, ip=ip)

        with patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply:
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        self._assert_usage_limit_rejection(
            session, query, resp, 429,
            'Anonymous chat daily limit exceeded. Please try again tomorrow or log in.',
            mock_get_ai_reply,
        )

    def test_org_ai_credit_exhausted_records_rejection(self, factory, real_project):
        _set_portal_settings(real_project, allow_anonymous=True, enable_password_protection=False)
        visitor = create_visitor_session()
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid), session_name='credit', username=visitor['visitor_uuid']
        )
        query = 'need more credit'
        request = self._post_anonymous_chat(factory, real_project, session, query)

        with patch('seahub.portal.chat.apis.check_ai_limit', return_value=True), \
                patch('seahub.portal.chat.apis.get_ai_reply') as mock_get_ai_reply:
            resp = PortalChatView.as_view()(request, project_uuid=str(real_project.uuid))

        self._assert_usage_limit_rejection(
            session, query, resp, 402, 'AI credit not enough.', mock_get_ai_reply,
        )


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

        with patch('seahub.portal.chat.apis.get_project_file_metadata', return_value={'ContentType': 'image/png'}) as head_mock, \
                patch('seahub.portal.chat.apis.get_project_file', return_value=BytesIO(b'png')) as file_mock:
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

        with patch('seahub.portal.chat.apis.get_project_file_metadata', return_value={'ContentType': 'text/plain'}), \
                patch('seahub.portal.chat.apis.get_project_file', return_value=BytesIO(b'png')):
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

    def _create_usage_session(self, project_uuid, username, created_at):
        session = PortalChatSessions.objects.create_session(
            project_uuid=project_uuid, session_name='UTC boundary', username=username,
        )
        PortalChatSessions.objects.filter(id=session.id).update(
            created_at=created_at, input_tokens=10, output_tokens=5, credit_used=0.25,
        )
        return session

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

    def test_user_usage_aggregates_current_month_sessions(self, factory, real_project, project_creator):
        today = date(2026, 3, 21)
        project_uuid = str(real_project.uuid)

        def _create_session(username, created, input_tokens, output_tokens, credit_used):
            session = PortalChatSessions.objects.create_session(
                project_uuid=project_uuid, session_name='s', username=username,
            )
            PortalChatSessions.objects.filter(id=session.id).update(
                created_at=timezone.make_aware(created, datetime_timezone.utc),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                credit_used=credit_used,
            )
            return session

        # alice: two sessions this month, merged
        _create_session('alice@example.com', datetime(2026, 3, 1, 0, 0, 0), 100, 40, 1.0)
        _create_session('alice@example.com', datetime(2026, 3, 21, 12, 0, 0), 50, 10, 0.5)
        _create_session('bob@example.com', datetime(2026, 3, 10, 8, 0, 0), 10, 5, 0.1)
        # alice: one session in the previous month
        _create_session('alice@example.com', datetime(2026, 2, 10, 8, 0, 0), 20, 5, 0.2)
        # bob: one session in the month before that
        _create_session('bob@example.com', datetime(2026, 1, 10, 8, 0, 0), 10, 5, 0.1)
        # carol: session outside the three-month range, must be excluded
        _create_session('carol@example.com', datetime(2025, 12, 31, 23, 59, 59), 999, 999, 9.9)

        request = self._admin_post_request(
            factory, real_project, project_creator,
            f'/api/v1/portal/{project_uuid}/admin/chat/user-usage/',
            data={'start': 0, 'limit': 1000},
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
            response = PortalAdminChatUserUsageView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 200
        users = response.data['users']
        assert [(u['month'], u['username']) for u in users] == [
            ('2026-03', 'alice@example.com'),
            ('2026-03', 'bob@example.com'),
            ('2026-02', 'alice@example.com'),
            ('2026-01', 'bob@example.com'),
        ]
        alice, bob, alice_previous, bob_previous = users
        assert all('questions' not in user for user in users)
        assert alice['sessions'] == 2
        assert alice['input_tokens'] == 150
        assert alice['output_tokens'] == 50
        assert alice['credit_used'] == pytest.approx(1.5)
        assert bob['month'] == '2026-03'
        assert bob['sessions'] == 1
        assert alice_previous['sessions'] == 1
        assert alice_previous['credit_used'] == pytest.approx(0.2)
        assert bob_previous['sessions'] == 1
        assert bob_previous['month'] == '2026-01'

    def test_user_usage_supports_sorts_and_pagination(self, factory, real_project, project_creator):
        today = date(2026, 3, 21)
        project_uuid = str(real_project.uuid)
        for username, tokens in (('a@example.com', 10), ('b@example.com', 30), ('c@example.com', 20)):
            session = PortalChatSessions.objects.create_session(
                project_uuid=project_uuid, session_name='s', username=username,
            )
            PortalChatSessions.objects.filter(id=session.id).update(
                created_at=datetime(2026, 3, 5, tzinfo=datetime_timezone.utc), input_tokens=tokens,
            )

        def _post(start, limit):
            request = self._admin_post_request(
                factory, real_project, project_creator,
                f'/api/v1/portal/{project_uuid}/admin/chat/user-usage/',
                data={
                    'start': start,
                    'limit': limit,
                    'config': json.dumps({'sorts': [{'column_key': 'input_tokens', 'sort_type': 'up'}]}),
                },
            )
            with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
                return PortalAdminChatUserUsageView.as_view()(request, project_uuid=project_uuid)

        response = _post(0, 1000)
        assert response.status_code == 200
        assert [u['input_tokens'] for u in response.data['users']] == [10, 20, 30]

        response = _post(0, 2)
        assert [u['input_tokens'] for u in response.data['users']] == [10, 20]

        response = _post(2, 2)
        assert [u['input_tokens'] for u in response.data['users']] == [30]

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
        today = date(2026, 3, 21)
        project_uuid = uuid_str_to_32_chars(str(real_project.uuid))
        common_data = {
            'date': today,
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

        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='customer question',
            username='customer@example.com',
        )
        PortalChatSessions.objects.filter(id=session.id).update(
            created_at=datetime(2026, 3, 21, 23, 59, 59, 999999, tzinfo=datetime_timezone.utc)
        )

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
            response = PortalAdminChatStatisticsView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert response.data['current'] == {
            'users': 1,
            'input_tokens': 100,
            'output_tokens': 40,
            'credit_used': 150,
        }
        assert 'user_count' not in response.data
        assert 'total_credit_used' not in response.data

    def test_statistics_include_current_month_and_previous_same_period(self, factory, real_project, project_creator):
        today = date(2026, 3, 21)
        current_user = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='current session',
            username='current@example.com',
        )
        current_user_second_session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='current second session',
            username='current@example.com',
        )
        previous_user = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='previous session',
            username='previous@example.com',
        )
        PortalChatSessions.objects.filter(id=current_user.id).update(
            created_at=datetime(2026, 3, 5, tzinfo=datetime_timezone.utc)
        )
        PortalChatSessions.objects.filter(id=current_user_second_session.id).update(
            created_at=datetime(2026, 3, 21, 23, 59, 59, 999999, tzinfo=datetime_timezone.utc)
        )
        PortalChatSessions.objects.filter(id=previous_user.id).update(
            created_at=datetime(2026, 2, 10, tzinfo=datetime_timezone.utc)
        )

        common_data = {
            'project_uuid': uuid_str_to_32_chars(str(real_project.uuid)),
            'owner': 'project-owner@example.com',
            'org_id': real_project.workspace.org_id,
            'group_id': None,
            'model': 'gpt-4',
            'scenario': AIScenario.PORTAL_CHAT.value,
        }
        AIUsageStatistics.objects.create(
            **common_data,
            date=date(2026, 3, 5),
            input_tokens=300,
            output_tokens=100,
            cost=2.5,
        )
        AIUsageStatistics.objects.create(
            **common_data,
            date=date(2026, 2, 10),
            input_tokens=200,
            output_tokens=80,
            cost=1.5,
        )
        AIUsageStatistics.objects.create(
            **common_data,
            date=date(2026, 2, 25),
            input_tokens=900,
            output_tokens=400,
            cost=9.0,
        )

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
            response = PortalAdminChatStatisticsView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert response.data['current'] == {
            'users': 1,
            'input_tokens': 300,
            'output_tokens': 100,
            'credit_used': 250,
        }
        assert response.data['change_percent'] == {
            'users': 0,
            'input_tokens': 50.0,
            'output_tokens': 25.0,
            'credit_used': round((250 - 150) * 100 / 150, 2),
        }

    def test_statistics_monthly_change_returns_100_when_previous_is_zero(self, factory, real_project, project_creator):
        today = date(2026, 3, 1)
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='current session',
            username='current@example.com',
        )
        PortalChatSessions.objects.filter(id=session.id).update(
            created_at=datetime(2026, 3, 1, tzinfo=datetime_timezone.utc)
        )
        AIUsageStatistics.objects.create(
            date=today,
            project_uuid=uuid_str_to_32_chars(str(real_project.uuid)),
            owner='project-owner@example.com',
            org_id=real_project.workspace.org_id,
            group_id=None,
            model='gpt-4',
            scenario=AIScenario.PORTAL_CHAT.value,
            input_tokens=100,
            output_tokens=20,
            cost=1,
        )

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
            response = PortalAdminChatStatisticsView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert response.data['change_percent'] == {
            'users': 100,
            'input_tokens': 100,
            'output_tokens': 100,
            'credit_used': 100,
        }

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
        ).update(created_at=_utc_midnight(date(2026, 2, 2)))
        PortalChatSessions.objects.filter(id=old_session.id).update(created_at=_utc_midnight(date(2026, 2, 1)))
        PortalChatSessions.objects.filter(id=other_project_session.id).update(created_at=_utc_midnight(today))

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
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
        PortalChatSessions.objects.filter(id=session.id).update(created_at=_utc_midnight(date(2026, 2, 2)))
        AIUsageStatistics.objects.create(
            date=date(2026, 2, 2),
            project_uuid=uuid_str_to_32_chars(str(real_project.uuid)),
            owner='customer@example.com', model='test-model',
            scenario=AIScenario.PORTAL_CHAT.value, cost=0.25,
        )

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )

        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)), \
                patch.object(connection.ops, 'datetime_cast_date_sql', side_effect=RuntimeError('timezone conversion unavailable')), \
                patch.object(connection.ops, 'datetime_trunc_sql', side_effect=RuntimeError('timezone conversion unavailable')):
            response = PortalAdminChatStatisticsView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert response.data['daily_session_counts'][0] == {
            'date': '2026-02-02', 'count': 1,
        }
        assert response.data['daily_credit_used'][0] == {
            'date': '2026-02-02', 'credit_used': 25,
        }

    def test_statistics_exclude_month_end_date_outside_last_month(self, factory, real_project, project_creator):
        today = date(2026, 3, 31)
        session = PortalChatSessions.objects.create_session(
            project_uuid=str(real_project.uuid),
            session_name='old session',
            username='customer@example.com',
        )
        PortalChatSessions.objects.filter(id=session.id).update(created_at=_utc_midnight(date(2026, 2, 28)))

        request = self._admin_request(
            factory,
            real_project,
            project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
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

    @pytest.mark.parametrize('today, start_date', [
        (date(2026, 3, 1), date(2026, 2, 2)),
        (date(2026, 3, 31), date(2026, 3, 1)),
    ])
    def test_statistics_include_daily_credit_used_for_last_month(
            self, factory, real_project, project_creator, today, start_date):
        common_data = {
            'project_uuid': uuid_str_to_32_chars(str(real_project.uuid)),
            'owner': 'customer@example.com',
            'org_id': real_project.workspace.org_id,
            'model': 'gpt-4',
            'scenario': AIScenario.PORTAL_CHAT.value,
        }
        usage_data = [
            {'date': start_date, 'cost': 0.125},
            {'date': start_date, 'cost': 0.25, 'model': 'another-model', 'owner': 'another@example.com'},
            {'date': start_date + timedelta(days=1), 'cost': 0.012},
            {'date': start_date + timedelta(days=2), 'cost': 0.018},
            {'date': today, 'cost': 0.005},
            {'date': start_date - timedelta(days=1), 'cost': 9},
            {'date': today + timedelta(days=1), 'cost': 9},
            {'date': today, 'cost': 9, 'scenario': AIScenario.CHAT.value},
            {'date': today, 'cost': 9, 'project_uuid': 'other-project'},
        ]
        for usage in usage_data:
            AIUsageStatistics.objects.create(**{**common_data, **usage})

        request = self._admin_request(
            factory, real_project, project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
            response = PortalAdminChatStatisticsView.as_view()(
                request, project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        daily_credit_used = response.data['daily_credit_used']
        assert [item['date'] for item in daily_credit_used] == [
            item['date'] for item in response.data['daily_session_counts']
        ]
        assert len(daily_credit_used) == (today - start_date).days + 1
        assert daily_credit_used[0] == {
            'date': start_date.isoformat(), 'credit_used': 38,
        }
        assert daily_credit_used[1] == {
            'date': (start_date + timedelta(days=1)).isoformat(), 'credit_used': 1,
        }
        assert daily_credit_used[2] == {
            'date': (start_date + timedelta(days=2)).isoformat(), 'credit_used': 2,
        }
        assert daily_credit_used[-1] == {
            'date': today.isoformat(), 'credit_used': 0,
        }
        assert all(item['credit_used'] == 0 for item in daily_credit_used[3:-1])

    def test_statistics_daily_credit_used_is_zero_without_usage(self, factory, real_project, project_creator):
        today = date(2026, 3, 1)
        request = self._admin_request(
            factory, real_project, project_creator,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        with patch('seahub.portal.chat.utils.timezone.now', return_value=_utc_midnight(today)):
            response = PortalAdminChatStatisticsView.as_view()(
                request, project_uuid=str(real_project.uuid),
            )

        assert response.status_code == 200
        assert len(response.data['daily_credit_used']) == 28
        assert all(item['credit_used'] == 0 for item in response.data['daily_credit_used'])

    def test_statistics_reject_non_admin(self, factory, real_project, auth_user):
        request = self._admin_request(
            factory, real_project, auth_user,
            f'/api/v1/portal/{real_project.uuid}/admin/chat/statistics/',
        )
        response = PortalAdminChatStatisticsView.as_view()(
            request, project_uuid=str(real_project.uuid),
        )

        assert response.status_code == 403

    @pytest.mark.parametrize('active_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
    @pytest.mark.parametrize('now, expected_today, expected_users', [
        (datetime(2026, 10, 31, 15, 59, tzinfo=datetime_timezone.utc), date(2026, 10, 31), 1),
        (datetime(2026, 10, 31, 16, 0, tzinfo=datetime_timezone.utc), date(2026, 10, 31), 1),
        (datetime(2026, 10, 31, 23, 59, tzinfo=datetime_timezone.utc), date(2026, 10, 31), 1),
        (datetime(2026, 11, 1, 0, 0, tzinfo=datetime_timezone.utc), date(2026, 11, 1), 0),
        (datetime(2025, 12, 31, 16, 0, tzinfo=datetime_timezone.utc), date(2025, 12, 31), 1),
        (datetime(2026, 1, 1, 0, 0, tzinfo=datetime_timezone.utc), date(2026, 1, 1), 0),
    ])
    def test_statistics_change_month_only_at_utc_midnight(
        self, factory, real_project, project_creator, active_timezone, now, expected_today, expected_users,
    ):
        project_uuid = str(real_project.uuid)
        usage_day = expected_today if expected_users else expected_today - timedelta(days=1)
        self._create_usage_session(
            project_uuid, 'customer@example.com', _utc_midnight(usage_day) + timedelta(hours=15, minutes=30),
        )
        AIUsageStatistics.objects.create(
            date=usage_day, project_uuid=uuid_str_to_32_chars(project_uuid),
            owner='customer@example.com', model='test-model', scenario=AIScenario.PORTAL_CHAT.value,
            input_tokens=100, output_tokens=20, cost=1,
        )
        request = self._admin_request(
            factory, real_project, project_creator, f'/api/v1/portal/{project_uuid}/admin/chat/statistics/',
        )

        with timezone.override(active_timezone), patch('seahub.portal.chat.utils.timezone.now', return_value=now):
            response = PortalAdminChatStatisticsView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 200
        assert response.data['current'] == {
            'users': expected_users,
            'input_tokens': expected_users * 100,
            'output_tokens': expected_users * 20,
            'credit_used': expected_users * 100,
        }
        assert response.data['daily_session_counts'][-1]['date'] == expected_today.isoformat()
        counts = {item['date']: item['count'] for item in response.data['daily_session_counts']}
        assert counts[usage_day.isoformat()] == 1

    @pytest.mark.parametrize('active_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
    def test_statistics_use_utc_boundaries_for_users_and_daily_counts(
        self, factory, real_project, project_creator, active_timezone,
    ):
        project_uuid = str(real_project.uuid)
        for index, created_at in enumerate((
            datetime(2026, 2, 1, 23, 59, 59, 999999, tzinfo=datetime_timezone.utc),
            datetime(2026, 2, 2, tzinfo=datetime_timezone.utc),
            datetime(2026, 2, 28, 23, 59, 59, 999999, tzinfo=datetime_timezone.utc),
            datetime(2026, 3, 1, tzinfo=datetime_timezone.utc),
            datetime(2026, 3, 2, tzinfo=datetime_timezone.utc),
        )):
            self._create_usage_session(project_uuid, f'boundary-{index}@example.com', created_at)
        AIUsageStatistics.objects.create(
            date=date(2026, 3, 1), project_uuid=uuid_str_to_32_chars(project_uuid),
            owner='owner@example.com', model='test-model', scenario=AIScenario.PORTAL_CHAT.value, cost=1,
        )
        request = self._admin_request(
            factory, real_project, project_creator, f'/api/v1/portal/{project_uuid}/admin/chat/statistics/',
        )
        now = datetime(2026, 3, 1, 12, tzinfo=datetime_timezone.utc)

        with timezone.override(active_timezone), patch('seahub.portal.chat.utils.timezone.now', return_value=now):
            response = PortalAdminChatStatisticsView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 200
        assert response.data['current']['users'] == 1
        assert response.data['current']['credit_used'] == 100
        counts = response.data['daily_session_counts']
        assert counts[0] == {'date': '2026-02-02', 'count': 1}
        assert counts[-2] == {'date': '2026-02-28', 'count': 1}
        assert counts[-1] == {'date': '2026-03-01', 'count': 1}
        assert sum(item['count'] for item in counts) == 3

    @pytest.mark.parametrize('active_timezone', ['UTC', 'Asia/Shanghai', 'America/Los_Angeles'])
    @pytest.mark.parametrize('now, expected_months', [
        (datetime(2026, 3, 31, 15, 59, tzinfo=datetime_timezone.utc), ['2026-03', '2026-02', '2026-01']),
        (datetime(2026, 3, 31, 16, 0, tzinfo=datetime_timezone.utc), ['2026-03', '2026-02', '2026-01']),
        (datetime(2026, 3, 31, 23, 59, tzinfo=datetime_timezone.utc), ['2026-03', '2026-02', '2026-01']),
        (datetime(2026, 4, 1, 0, 0, tzinfo=datetime_timezone.utc), ['2026-04', '2026-03', '2026-02']),
    ])
    def test_user_usage_filters_and_groups_by_utc_month(
        self, factory, real_project, project_creator, active_timezone, now, expected_months,
    ):
        project_uuid = str(real_project.uuid)
        for created_at in (
            datetime(2025, 12, 31, 23, 59, 59, 999999, tzinfo=datetime_timezone.utc),
            datetime(2026, 1, 1, tzinfo=datetime_timezone.utc),
            datetime(2026, 1, 31, 16, 30, tzinfo=datetime_timezone.utc),
            datetime(2026, 2, 28, 16, 30, tzinfo=datetime_timezone.utc),
            datetime(2026, 3, 31, 23, 59, 59, 999999, tzinfo=datetime_timezone.utc),
            datetime(2026, 4, 1, tzinfo=datetime_timezone.utc),
        ):
            self._create_usage_session(project_uuid, 'customer@example.com', created_at)
        request = self._admin_post_request(
            factory, real_project, project_creator, f'/api/v1/portal/{project_uuid}/admin/chat/user-usage/',
            data={'start': 0, 'limit': 1000},
        )

        with timezone.override(active_timezone), patch('seahub.portal.chat.utils.timezone.now', return_value=now):
            response = PortalAdminChatUserUsageView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 200
        assert [user['month'] for user in response.data['users']] == expected_months
        for user in response.data['users']:
            expected_sessions = 2 if user['month'] == '2026-01' else 1
            assert user['sessions'] == expected_sessions
            assert user['input_tokens'] == expected_sessions * 10
            assert user['output_tokens'] == expected_sessions * 5
            assert user['credit_used'] == pytest.approx(expected_sessions * 0.25)

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

import logging
import time

from django.core.cache import cache
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from seahub.portal.permissions import PortalChatPermission
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import uuid_str_to_32_chars
from seahub.project.models import Projects
from seahub.project.constants import AIScenario
from seahub.project.utils import check_ai_limit, check_same_org_permission, delete_portal_sessions
from seahub.utils.ip import get_remote_ip
from seahub.portal.chat.utils import (
    build_portal_message_result,
    check_anonymous_chat_rate_limit,
    check_external_chat_rate_limit,
    gen_portal_chat_task_id,
    gen_portal_message_id,
    get_portal_chat_settings,
    get_portal_external_username,
    get_project_portal_chat_credit_used,
    mark_anonymous_chat_rate_limit,
    mark_external_chat_rate_limit,
    process_portal_stream_ai_reply,
)
from seahub.portal.models import PortalChatSessions, PortalChatMessages
from seahub.portal.visitor_session import (
    clear_visitor_cookie,
    load_visitor_session,
    set_visitor_cookie,
    touch_visitor_session,
)
from seahub.chats.utils import get_ai_reply
from seahub.chats.constants import AI_REPLY_TIMEOUT

logger = logging.getLogger(__name__)

def _get_project_or_error(project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
    return project, None


def _get_session_or_error(session_uuid, username):
    session = PortalChatSessions.objects.get_session_by_uuid(session_uuid)
    if not session:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Session not found.')
    if session.username != username:
        return None, api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
    return session, None

def _build_visitor_session_error():
    response = api_error(status.HTTP_401_UNAUTHORIZED, 'Visitor session expired. Please refresh the page.')
    response.data['error_code'] = 'visitor_session_expired'
    clear_visitor_cookie(response)
    return response

def _get_request_identity(request, project_uuid):
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        project = getattr(request, 'project', None) or Projects.objects.get_project_by_uuid(project_uuid)
        workspace = getattr(project, 'workspace', None)
        if workspace and check_same_org_permission(user, workspace):
            return {
                'username': user.username,
                'is_external_user': False,
                'is_anonymous': False,
            }, None

    external_username = get_portal_external_username(request, project_uuid)
    if external_username:
        return {
            'username': external_username,
            'is_external_user': True,
            'is_anonymous': False,
        }, None

    visitor_session = load_visitor_session(request)
    if visitor_session.get('status') != 'active':
        return None, _build_visitor_session_error()

    visitor_id = visitor_session['visitor_id']
    touched_session = touch_visitor_session(
        visitor_id,
        visitor_session['session_data'],
        refresh_cookie=visitor_session['should_refresh_cookie'],
    )
    if not touched_session:
        return None, _build_visitor_session_error()

    return {
        'username': visitor_id,
        'visitor_id': visitor_id,
        'is_external_user': False,
        'is_anonymous': True,
        'should_refresh_cookie': visitor_session['should_refresh_cookie'],
        'visitor_session': touched_session,
    }, None

def _finalize_visitor_session_response(response, identity):
    if not identity or not identity.get('is_anonymous'):
        return response

    if identity.get('should_refresh_cookie'):
        set_visitor_cookie(response, identity['visitor_id'])
    return response

def _portal_chat_view(func):
    def wrapper(self, request, *args, **kwargs):
        project_uuid = kwargs.get('project_uuid')

        project, error = _get_project_or_error(project_uuid)
        if error:
            return error

        identity, error = _get_request_identity(request, project_uuid)
        if error:
            return error

        request.project = project
        request.identity = identity

        response = func(self, request, *args, **kwargs)
        return _finalize_visitor_session_response(response, identity)
    return wrapper


class PortalChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @_portal_chat_view
    def get(self, request, project_uuid):
        try:
            sessions = PortalChatSessions.objects.get_sessions_by_project(project_uuid, request.identity['username'])
            sessions_data = [session.to_dict() for session in sessions]
            return Response({'sessions': sessions_data})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @_portal_chat_view
    def post(self, request, project_uuid):
        """Create a new portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        try:
            session = PortalChatSessions.objects.create_session(
                project_uuid=project_uuid,
                session_name=session_name,
                username=request.identity['username'],
            )
            return Response({'session': session.to_dict()}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @_portal_chat_view
    def put(self, request, project_uuid, session_uuid):
        """Modify portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        session, error = _get_session_or_error(session_uuid, request.identity['username'])
        if error:
            return _finalize_visitor_session_response(error, request.identity)

        try:
            session.session_name = session_name
            session.save()
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @_portal_chat_view
    def delete(self, request, project_uuid, session_uuid):
        """Delete portal chat session"""
        _, error = _get_session_or_error(session_uuid, request.identity['username'])
        if error:
            return _finalize_visitor_session_response(error, request.identity)

        try:
            delete_portal_sessions([session_uuid])
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatMessagesView(APIView):
    """Portal Chat Messages API - Get message history"""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @_portal_chat_view
    def get(self, request, project_uuid, session_uuid):
        """Retrieve the message list of the portal chat session"""
        _, error = _get_session_or_error(session_uuid, request.identity['username'])
        if error:
            return _finalize_visitor_session_response(error, request.identity)

        try:
            messages = PortalChatMessages.objects.get_messages_by_session(session_uuid)
            messages_data = [message.to_dict() for message in messages]
            chat_task_info = cache.get(gen_portal_chat_task_id(session_uuid))
            results = {
                'messages': messages_data,
                'running_task': chat_task_info is not None,
            }
            if results['running_task']:
                results['user_input'] = chat_task_info['user_input']
            return Response(results)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatView(APIView):
    """Portal Chat API - Send message and get AI reply"""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @_portal_chat_view
    def get(self, request, project_uuid):
        session_uuid = request.GET.get('session_uuid')
        if not session_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_uuid parameter is required.')

        try:
            _, error = _get_session_or_error(session_uuid, request.identity['username'])
            if error:
                return _finalize_visitor_session_response(error, request.identity)

            chat_task_id_info = gen_portal_chat_task_id(session_uuid)
            while cache.get(chat_task_id_info) is not None:
                time.sleep(0.1)

            last_message = PortalChatMessages.objects.get_last_message_by_session(session_uuid)
            if not last_message:
                return api_error(status.HTTP_404_NOT_FOUND, 'No messages found.')

            result = {
                'ai_reply': last_message.content,
                'ai_reply_message_id': last_message.id,
                'session_uuid': session_uuid,
            }

            return Response(result)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @_portal_chat_view
    def post(self, request, project_uuid):
        """Send message and get AI reply"""
        query = request.data.get('query')
        if not query:
            return api_error(status.HTTP_400_BAD_REQUEST, 'query invalid.')

        session_uuid = request.data.get('session_uuid')
        if not session_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_uuid parameter is required.')

        clear_context = request.data.get('clear_context', False)
        if isinstance(clear_context, str):
            clear_context = clear_context.lower() == 'true'
        if not isinstance(clear_context, bool):
            return api_error(status.HTTP_400_BAD_REQUEST, 'clear_context invalid.')

        stream = request.project.to_dict()['settings'].get('streaming_response', True)
        stream_from_request = request.data.get('stream')
        if stream_from_request is not None:
            if isinstance(stream_from_request, str):
                stream_from_request = stream_from_request.lower() == 'true'
            if not isinstance(stream_from_request, bool):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid stream')
            stream = stream_from_request

        portal_settings = get_portal_chat_settings(request.project)
        if request.identity['is_external_user']:
            rate_limit_error = check_external_chat_rate_limit(project_uuid, request.identity['username'])
            if rate_limit_error:
                return _finalize_visitor_session_response(rate_limit_error, request.identity)

        visitor_session = request.identity.get('visitor_id', '')
        ip = ''
        if request.identity['is_anonymous']:
            ip = get_remote_ip(request)
            rate_limit_error = check_anonymous_chat_rate_limit(visitor_session, ip)
            if rate_limit_error:
                return _finalize_visitor_session_response(rate_limit_error, request.identity)

        project_credit_used = get_project_portal_chat_credit_used(project_uuid)
        if project_credit_used >= portal_settings['daily_chat_credit_limit']:
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Portal chat daily quota exceeded.')

        username = request.identity['username']

        session, error = _get_session_or_error(session_uuid, username)
        if error:
            return _finalize_visitor_session_response(error, request.identity)

        current_session_uuid = session.session_uuid
        if clear_context:
            PortalChatMessages.objects.clear_context(current_session_uuid)

        # Check AI quota of org
        org_id = getattr(getattr(request.project, 'workspace', None), 'org_id', -1) or -1
        if check_ai_limit(username, org_id):
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, 'AI credit not enough.')

        try:
            message_id = gen_portal_message_id(current_session_uuid)
        except Exception as e:
            logger.exception(f'Failure to generate message id: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

        chat_sources = portal_settings['chat_allowed_sources']

        chat_task_id_info = gen_portal_chat_task_id(current_session_uuid)
        if cache.get(chat_task_id_info) is not None:
            return api_error(status.HTTP_409_CONFLICT, 'There are unfinished tasks in the current session, please try again later.')

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'session_uuid': current_session_uuid,
            'message_id': message_id,
            'query': query,
            'attachments': [],
            'username': username,
            'org_id': org_id,
            'connection_ids': chat_sources['connection_ids'],
            'extra_sources': chat_sources['extra_sources'],
            'is_external_portal': True,
            'stream': stream,
            'scenario': AIScenario.PORTAL_CHAT.value,
        }

        if request.identity['is_external_user']:
            mark_external_chat_rate_limit(project_uuid, request.identity['username'])
        elif request.identity['is_anonymous']:
            mark_anonymous_chat_rate_limit(visitor_session, ip)

        task_info = {
            'user_input': {
                'message': query,
            }
        }
        cache.set(chat_task_id_info, task_info, AI_REPLY_TIMEOUT)

        if stream:
            try:
                return StreamingHttpResponse(
                    process_portal_stream_ai_reply(
                        chat_task_id_info,
                        get_ai_reply(params),
                        current_session_uuid,
                        message_id,
                        query,
                    ),
                    content_type='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no'
                    }
                )
            except Exception as e:
                logger.exception(f'Failure to make portal stream: {e}')
                cache.delete(chat_task_id_info)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

        try:
            ai_response = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_response = {
                'ai_reply': 'Sorry, the AI service is temporarily unavailable, please try again later.',
            }

        cache.delete(chat_task_id_info)

        return Response(build_portal_message_result(ai_response, current_session_uuid, message_id, query))

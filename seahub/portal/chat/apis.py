import uuid
import logging
import json
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
from seahub.project.utils import check_ai_limit, delete_portal_sessions
from seahub.portal.models import PortalChatSessions, PortalChatMessages
from seahub.chats.utils import get_ai_reply
from seahub.chats.constants import AI_REPLY_TIMEOUT

logger = logging.getLogger(__name__)


# Default chat allowed source types for portal
DEFAULT_CHAT_ALLOWED_SOURCES = ['site', 'seafile', 'github_issue', 'discourse_forum']


def get_portal_settings(project):
    settings = project.settings or '{}'
    if isinstance(settings, str):
        try:
            settings = json.loads(settings)
        except:
            settings = {}
    portal_settings = settings.get('portal', {})
    return {
        'chat_allowed_sources': portal_settings.get('chat_allowed_sources', DEFAULT_CHAT_ALLOWED_SOURCES),
    }


def get_project_or_error(project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
    return project, None


def get_session_or_error(session_uuid, username):
    session = PortalChatSessions.objects.get_session_by_uuid(session_uuid)
    if not session:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Session not found.')
    if session.username != username:
        return None, api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
    return session, None


def gen_portal_message_id(session_uuid, max_try=5):
    trying = 0
    new_message_id = ''
    while not new_message_id and trying < max_try:
        try_message_id = uuid.uuid4().hex[:4]
        if not PortalChatMessages.objects.filter(session_uuid=session_uuid, message_id=try_message_id).exists():
            new_message_id = try_message_id
        trying += 1

    if trying == max_try:
        raise Exception('Failure to generate message_id')

    return new_message_id


def gen_portal_chat_task_id(session_uuid):
    return f"portal_chat_{session_uuid.replace('-', '')}"


def record_portal_message_to_db(ai_result, session_uuid, message_id, query):
    if 'ai_reply' not in ai_result:
        ai_result['ai_reply'] = ai_result.get('answer', '')

    ai_result.pop('answer', None)
    ai_result.update({
        'session_uuid': session_uuid,
    })

    try:
        user_message = PortalChatMessages.objects.create_message(
            session_uuid, message_id, 'user', query
        )
        ai_reply_message = PortalChatMessages.objects.create_message(
            session_uuid, message_id, 'assistant', ai_result['ai_reply']
        )
        ai_result.update({
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id
        })
    except Exception as e:
        logger.warning(f'Failure to record portal messages to db: {e}')

    return ai_result


def process_portal_stream_ai_reply(chat_task_id_info, ai_response, session_uuid, message_id, query):
    has_recorded_result = False
    error_msg = None
    try:
        for line in ai_response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if not line_str.startswith('data:'):
                    line_str = f"data: {line_str}"
                content = line_str[len('data: '):]
                # use if - else instead of json.loads() to avoid performance issues
                if content.startswith('{"results": ') and content.endswith('}'):
                    results = json.loads(content)['results']
                    item = f'data: {json.dumps({"results": record_portal_message_to_db(results, session_uuid, message_id, query)})}\n\n'
                    has_recorded_result = True
                elif content.startswith('[ERROR: ') and content.endswith(']'):
                    error_msg = content[1:-1]
                    item = f'data: {json.dumps({"results": record_portal_message_to_db({"ai_reply": error_msg, "sources": []}, session_uuid, message_id, query)})}\n\n'
                    has_recorded_result = True
                else:
                    if not line_str.endswith('\n\n'):
                        line_str += '\n\n'
                    item = line_str
                try:
                    yield item
                except:  # continues to receive data even client interrupts the stream
                    continue
                if error_msg:
                    raise ConnectionError(error_msg)
    except Exception as e:
        logger.exception(f'Portal streaming response is interrupted: {e}')
        if not has_recorded_result:
            item = f'data: {json.dumps({"results": record_portal_message_to_db({"ai_reply": "There is an issue with the AI server or web server (LLM or internal server error), please try again later", "sources": []}, session_uuid, message_id, query)})}\n\n'
            try:
                yield item
            except:
                pass
        try:
            yield 'data: [DONE]\n\n'
        except:
            pass
    cache.delete(chat_task_id_info)


class PortalChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        try:
            sessions = PortalChatSessions.objects.get_sessions_by_project(project_uuid, request.user.username)
            sessions_data = [session.to_dict() for session in sessions]
            return Response({'sessions': sessions_data})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def post(self, request, project_uuid):
        """Create a new portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        try:
            session = PortalChatSessions.objects.create_session(
                project_uuid=project_uuid,
                session_name=session_name,
                username=request.user.username,
            )
            return Response({'session': session.to_dict()}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, project_uuid, session_uuid):
        """Modify portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        session, error = get_session_or_error(session_uuid, request.user.username)
        if error:
            return error

        try:
            session.session_name = session_name
            session.save()
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def delete(self, request, project_uuid, session_uuid):
        """Delete portal chat session"""
        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        session, error = get_session_or_error(session_uuid, request.user.username)
        if error:
            return error

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

    def get(self, request, project_uuid, session_uuid):
        """Retrieve the message list of the portal chat session"""
        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        session, error = get_session_or_error(session_uuid, request.user.username)
        if error:
            return error

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

    def get(self, request, project_uuid):
        session_uuid = request.GET.get('session_uuid')
        if not session_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_uuid parameter is required.')

        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        try:
            session, error = get_session_or_error(session_uuid, request.user.username)
            if error:
                return error

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

        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        stream = project.to_dict()['settings'].get('streaming_response', True)
        stream_from_request = request.data.get('stream')
        if stream_from_request is not None:
            if isinstance(stream_from_request, str):
                stream_from_request = stream_from_request.lower() == 'true'
            if not isinstance(stream_from_request, bool):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid stream')
            stream = stream_from_request

        username = request.user.username
        session, error = get_session_or_error(session_uuid, username)
        if error:
            return error

        if clear_context:
            PortalChatMessages.objects.clear_context(session_uuid)

        # Check AI quota
        org_id = request.user.org.org_id if hasattr(request.user, 'org') and request.user.org else -1
        if check_ai_limit(username, org_id):
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, 'AI credit not enough.')

        try:
            message_id = gen_portal_message_id(session.session_uuid)
        except Exception as e:
            logger.exception(f'Failure to generate message id: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

        portal_settings = get_portal_settings(project)
        allowed_sources = portal_settings['chat_allowed_sources']

        chat_task_id_info = gen_portal_chat_task_id(session.session_uuid)
        if cache.get(chat_task_id_info) is not None:
            return api_error(status.HTTP_409_CONFLICT, 'There are unfinished tasks in the current session, please try again later.')

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'session_uuid': session.session_uuid,
            'message_id': message_id,
            'query': query,
            'attachments': [],
            'username': username,
            'org_id': org_id,
            'allowed_sources': allowed_sources,
            'is_external_portal': True,
            'stream': stream,
        }

        task_info = {
            'user_input': {
                'message': query,
            }
        }
        cache.set(chat_task_id_info, task_info, AI_REPLY_TIMEOUT)

        if stream:
            try:
                return StreamingHttpResponse(
                    process_portal_stream_ai_reply(chat_task_id_info, get_ai_reply(params), session.session_uuid, message_id, query),
                    content_type='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no'
                    }
                )
            except Exception as e:
                logger.exception(f'Failure to make portal stream: {e}')
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

        try:
            ai_response = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_response = {
                'ai_reply': 'Sorry, the AI service is temporarily unavailable, please try again later.',
            }

        # Save messages
        user_message = PortalChatMessages.objects.create_message(
            session.session_uuid, message_id, 'user', query
        )
        ai_reply_message = PortalChatMessages.objects.create_message(
            session.session_uuid, message_id, 'assistant',
            ai_response['ai_reply']
        )

        cache.delete(chat_task_id_info)

        return Response({
            'ai_reply': ai_response['ai_reply'],
            'session_uuid': session_uuid,
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id,
        })



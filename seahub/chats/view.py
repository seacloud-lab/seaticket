# -*- coding: utf-8 -*-
import logging
import time
import json
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django.core.cache import cache
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import uuid_str_to_32_chars
from seahub.project.models import Projects, ProjectConnections
from seahub.project.utils import check_project_permission, check_ai_limit, delete_sessions
from seahub.project.seadb_api import SeaDBAPI
from seahub.chats.constants import AI_REPLY_TIMEOUT
from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess
from seahub.chats.utils import get_ai_reply, gen_message_id, gen_chat_task_id, get_attachments, \
    record_message_to_db, process_stream_ai_reply, remove_content_details_in_attachments
from django.utils.translation import gettext as _
from seahub.utils.decorators import require_org_context

logger = logging.getLogger(__name__)

class ChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request):
        """Retrieve the user's chat session list"""
        # argument check
        project_uuid = request.GET.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session_type = request.GET.get('type', 'mine')
            
            if session_type == 'team':
                sessions = ChatSessions.objects.get_shared_sessions_by_project(project_uuid)
            else:
                sessions = ChatSessions.objects.get_sessions_by_project(project_uuid, username)
            
            sessions_data = [session.to_dict() for session in sessions]

            return Response({'sessions': sessions_data})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    @require_org_context
    def post(self, request):
        """Create a new chat session"""
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        session_name = request.data.get('session_name', '')
        if not session_name:
            error_msg = 'session_name parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.create_session(
                project_uuid=project_uuid,
                session_name=session_name,
                username=request.user.username
            )

            return Response({ 'session': session.to_dict() }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def put(self, request, session_uuid):
        """Modify chat session"""
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        session_name = request.data.get('session_name')
        is_shared = request.data.get('is_shared')

        if session_name is None and is_shared is None:
            error_msg = 'At least one of session_name or is_shared parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if session.username != username:
                error_msg = 'Permission denied. Only the session owner can modify this session.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if session_name is not None:
                session.session_name = session_name

            if is_shared is not None:
                session.is_shared = is_shared

            session.save()

            return Response({'success': True, 'session': session.to_dict()})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    @require_org_context
    def delete(self, request, session_uuid):
        """Delete chat session"""
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            delete_sessions([session_uuid])
            return Response({'success': True})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatMessagesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, session_uuid):
        """Retrieve the message list of the chat session"""
        # argument check
        project_uuid = request.GET.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            messages = ChatMessages.objects.get_messages_by_session(session_uuid)

            message_ids = set([message.message_id for message in messages])

            message_id_thought_process_map = ChatMessageThoughtProcess.objects.get_thought_process_from_session_uuid_and_message_ids(session_uuid, message_ids)

            messages_data = []
            for message in messages:
                data = message.to_dict()
                if message.role == 'assistant':
                    if thought_process := message_id_thought_process_map.get(message.message_id, {}):
                        data['thought_process'] = thought_process
                messages_data.append(data)
            chat_task_info = cache.get(gen_chat_task_id(session_uuid))
            results = {
                'messages': messages_data,
                'running_task': chat_task_info is not None
            }
            if results['running_task']:
                 results['user_input'] = chat_task_info['user_input']
            return Response(results)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request):
        session_uuid = request.GET.get('session_uuid')
        if not session_uuid:
            error_msg = 'session_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            chat_task_id_info = gen_chat_task_id(session_uuid)
            while cache.get(chat_task_id_info) is not None:
                time.sleep(0.1)

            ai_reply = ChatMessages.objects.get_last_message_by_session(session_uuid).to_dict()
            result = {
                'ai_reply': ai_reply['content'],
                'ai_reply_message_id': ai_reply['id'],
                'sources': ai_reply['sources'],
                'thought_process': ChatMessageThoughtProcess.objects.get_thought_process_from_session_uuid_and_message_id(session_uuid, ai_reply['message_id']),
                'session_uuid': session_uuid
            }

            return Response(result)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


    @require_org_context
    def post(self, request):
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        query = request.data.get('query')
        if not query:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        clear_context = request.data.get('clear_context', False)
        if isinstance(clear_context, str):
            clear_context = clear_context.lower() == 'true'
        if not isinstance(clear_context, bool):
            error_msg = 'clear_context invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        stream = project.to_dict()['settings'].get('streaming_response', True)
        stream_from_request = request.data.get('stream')
        if stream_from_request is not None:
            if isinstance(stream_from_request, str):
                stream_from_request = stream_from_request.lower() == 'true'
            if not isinstance(stream_from_request, bool):
                error_msg = 'Invalid stream'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            stream = stream_from_request

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # Check AI quota
        org_id = request.user.org.org_id if hasattr(request.user, 'org') else -1
        is_exceed = check_ai_limit(username, org_id)
        if is_exceed:
            error_msg = 'AI credit not enough.'
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, error_msg)

        # Extra contents
        try:
            attachments = get_attachments(SeaDBAPI(username), project_uuid, request.data.get('attachments', []))
        except Exception as e:
            attachments = []
            logger.warning(f'Failure to get extra contents: {e}')

        session_uuid = request.data.get('session_uuid')
        if not session_uuid:
            session = ChatSessions.objects.create_session(project_uuid, _('New chat'), request.user.username)
            session_uuid = session.session_uuid
        else:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = f'Chat session {session_uuid} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            # permission check: current user must be the session owner or the session is shared
            if session.username != username:
                if clear_context:
                    error_msg = 'Permission denied. You can only clear the context in your own sessions'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
                elif not session.is_shared:
                    error_msg = 'Permission denied. You can only access your own sessions or shared team sessions.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            elif clear_context:
                ChatMessages.objects.clear_context(session_uuid, username)
        
        chat_task_id_info = gen_chat_task_id(session_uuid)
        if cache.get(chat_task_id_info) is not None:
            error_msg = 'There are unfinished tasks in the current session, please try again later.'
            return api_error(status.HTTP_409_CONFLICT, error_msg)

        try:
            message_id = gen_message_id(session.session_uuid)
        except Exception as e:
            logger.exception(f'Failure to generate message id: {e}')
            error_msg = 'Internal server error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        connections = ProjectConnections.objects.filter(project=project, deleted=False, is_active=True)
        document_connections = []
        issue_connections = []
        for connection in connections:
            if connection.type in ('seafile', 'site'):
                document_connections.append({
                    'type': connection.type,
                    'id': connection.pk
                })

            else:
                issue_connections.append({
                    'type': connection.type,
                    'id': connection.pk
                })

        # Read project-level custom prompt from settings
        project_prompt = ''
        if project.settings:
            try:
                project_settings = json.loads(project.settings)
                project_prompt = project_settings.get('prompt', '')
            except json.JSONDecodeError:
                pass

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'session_uuid': session.session_uuid,
            'query': query,
            'attachments': attachments,
            'username': username,
            'org_id': org_id,
            'llm_model': request.data.get('model'),
            'stream': stream,
            'document_connections': document_connections,
            'issue_connections': issue_connections,
            'project_prompt': project_prompt
        }

        task_info = {
            'user_input': {
                'message': query,
                'attachments': remove_content_details_in_attachments(attachments)
            }
        }

        cache.set(chat_task_id_info, task_info, AI_REPLY_TIMEOUT)

        if stream:
            try:
                return StreamingHttpResponse(
                    process_stream_ai_reply(chat_task_id_info, get_ai_reply(params), request.user.username, session_uuid, message_id, query, attachments),
                    content_type='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no'
                    }
                )
            except Exception as e:
                # the exceptions in process_stream_ai_reply will not be catched in here, so it should be a 500 error
                logger.exception(f'Failure to make stream: {e}')
                error_msg = 'Internal server error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # non-stream response
        try:
            ai_response = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_response = {
                'ai_reply': 'Sorry, the AI service is temporarily unavailable, please try again later.',
                'sources': []
            }

        response = record_message_to_db(ai_response, request.user.username, session_uuid, message_id, query, attachments)
        cache.delete(chat_task_id_info)
        return Response(response)

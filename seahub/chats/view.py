# -*- coding: utf-8 -*-
import logging
import json
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.project.models import Projects, ProjectConnections
from seahub.project.utils import check_project_permission, ticket_to_json, TicketNotFound, github_issue_to_json, IssueNotFound, check_ai_limit
from seahub.chats.models import ChatSessions, ChatMessages, ChatToolCalls
from seahub.chats.utils import delete_session, format_ask_thought_process, format_agent_thought_process, get_ai_reply, gen_message_id
from seahub.project.constants import AI_CHAT_TICKET_PREFIX_PROMPT, AI_CHAT_GITHUB_ISSUE_PREFIX_PROMPT
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)


class ChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """Retrieve the user's chat session list"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            sessions = ChatSessions.objects.get_sessions_by_project(project_uuid, request.user.username)
            sessions_data = [session.to_dict() for session in sessions]

            return Response({'sessions': sessions_data})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    def post(self, request):
        """Create a new chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

    def put(self, request, session_uuid):
        """Modify chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            session.session_name = session_name
            session.save()

            return Response({'success': True})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    def delete(self, request, session_uuid):
        """Delete chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            if delete_session(session_uuid):
                return Response({'success': True})
            else:
                error_msg = 'Failed to delete session.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatMessagesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, session_uuid):
        """Retrieve the message list of the chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

            tool_calls_history = ChatToolCalls.objects.get_tool_calls_from_session_uuid_and_message_ids(session_uuid, message_ids)

            messages_data = []
            for message in messages:
                data = message.to_dict()
                if message.role == 'assistant':
                    if message.is_agent_mode:
                        if agent_thought_process := format_agent_thought_process(tool_calls_history.get(message.message_id, {})):
                            data['thought_process'] = agent_thought_process
                    elif ask_thought_process := format_ask_thought_process(tool_calls_history.get(message.message_id, {})):
                        data['thought_process'] = ask_thought_process
                messages_data.append(data)

            return Response({'messages': messages_data})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        query = request.data.get('query')
        if not query:
            error_msg = 'query invalid.'
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

        # Check AI quota
        org_id = request.user.org.org_id if hasattr(request.user, 'org') else -1
        is_exceed = check_ai_limit(username, org_id)
        if is_exceed:
            error_msg = 'AI credit not enough.'
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, error_msg)

        ticket_id = request.data.get('ticket_id')
        issue_id = request.data.get('issue_id')
        if ticket_id and issue_id:
            error_msg = 'can only provide a ticket or an issue.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if ticket_id:
            try:
                ticket_id = int(ticket_id)
            except:
                error_msg = 'ticket_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                ticket_json_data = ticket_to_json(project_uuid, ticket_id)
            except TicketNotFound:
                error_msg = 'ticket not found'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            query = AI_CHAT_TICKET_PREFIX_PROMPT + f'```json\n{ticket_json_data}\n```\n\n' + query
        connection_id = request.data.get('connection_id')
        # only support github issue for now
        if issue_id:
            try:
                issue_id = int(issue_id)
            except:
                error_msg = 'issue_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not connection_id:
                error_msg = 'connection_id is required when issue_id is provided.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                issue_json_data = github_issue_to_json(project_uuid, issue_id, connection_id)
            except IssueNotFound:
                error_msg = 'issue not found'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            query = AI_CHAT_GITHUB_ISSUE_PREFIX_PROMPT + f'```json\n{issue_json_data}\n```\n\n' + query

        resolve_type = request.data.get('resolve_type', 'ask')
        model = request.data.get('model')
        session_uuid = request.data.get('session_uuid')
        if not session_uuid:
            session = ChatSessions.objects.create_session(project_uuid, _('New chat'), request.user.username)
            session_uuid = session.session_uuid
        else:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = f'Chat session {session_uuid} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        try:
            message_id = gen_message_id(session.session_uuid)
        except Exception as e:
            logger.exception(f'Failure to generate message id: {e}')
            error_msg = 'Internal server error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'session_uuid': session.session_uuid,
            'message_id': message_id,
            'query': query,
            'resolve_type': resolve_type,
            'username': username,
            'org_id': org_id,
            'model': model
        }

        try:
            ai_response = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_response = {
                'ai_reply': 'Sorry, the AI service is temporarily unavailable, please try again later.',
                'sources': []
            }

        try:
            connection_ids = set([
                source['connection_id']
                for source in ai_response['sources']
            ])

            connections = ProjectConnections.objects.filter(id__in=connection_ids)
            connection_id_name_map = {}
            for connection in connections:
                connection_dict = connection.to_dict()
                connection_id_name_map[connection_dict['id']] = connection_dict['name']

            for source in ai_response['sources']:
                source['connection_name'] = connection_id_name_map[source['connection_id']]
        except Exception as e:
            logger.warning(f'Failure to query connection info: {e}')

        user_message = ChatMessages.objects.create_message(session.session_uuid, message_id, request.user.username, 'user', query, resolve_type == 'agent')
        ai_reply_message = ChatMessages.objects.create_message(session.session_uuid, message_id, request.user.username, 'assistant', ai_response['ai_reply'], resolve_type == 'agent', json.dumps(ai_response['sources']))

        ai_response.update({
            'session_uuid': session_uuid,
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id
        })

        return Response(ai_response)

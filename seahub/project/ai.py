# -*- coding: utf-8 -*-
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.project.models import Projects, ChatSessions, \
    ChatMessages, ProjectConnections
from seahub.project.utils import check_project_permission, ask_ai_question, \
    convert_record_to_ticket, ticket_to_json, TicketNotFound
from seahub.project.constants import ConnectionType, AI_CHAT_TICKET_PREFIX_PROMPT
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI



logger = logging.getLogger(__name__)


class QAView(APIView):
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
        
        ticket_id = request.data.get('ticket_id')
        if ticket_id:
            try:
                ticket_id = int(ticket_id)
            except:
                error_msg = 'ticket_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                ticket_json_data = ticket_to_json(ticket_id)
            except TicketNotFound:
                error_msg = 'ticket not found'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            query = AI_CHAT_TICKET_PREFIX_PROMPT + f'```json\n{ticket_json_data}\n```\n\n' + query
            
        resolve_type = request.data.get('resolve_type', 'ask')
        session_uuid = request.data.get('session_uuid')
        if not session_uuid:
            session = ChatSessions.objects.create_session(project_uuid, _('New chat'), request.user.username)
            session_uuid = session.session_uuid
        else:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = f'Chat session {session_uuid} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        user_message = ChatMessages.objects.create_message(session.id, request.user.username, 'user', query)

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'query': query,
            'username': username,
            'resolve_type': resolve_type,
        }

        try:
            ai_answer, agent_memory, sources = ask_ai_question(params)
        except Exception as e:
            logger.error(f'AI service error: {e}')
            ai_answer = 'Sorry, the AI service is temporarily unavailable, please try again later.'
            sources = []
            agent_memory = {}

        ai_reply_message = ChatMessages.objects.create_message(session.id, request.user.username, 'assistant', ai_answer, sources)

        return Response({
            'answer': ai_answer,
            'sources': sources,
            'session_uuid': session_uuid,
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id,
            'agent_memory': agent_memory[1:],
        })


class ConvertRecordToTicket(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(
            project_uuid, include_deleted=False)
        workspace = project.workspace
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        connection_id = request.data.get('connection_id')
        if not connection_id:
            error_msg = 'connection_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        record_id = request.data.get('record_id')
        if not record_id:
            error_msg = 'record_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection:
            error_msg = f'Connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        record_detail = ''
        default_title = ''
        match connection.type:
            case ConnectionType.DISCOURSE_FORUM.value:
                discourse_db_api = DiscourseSeaDBAPI(project_uuid)
                topics = discourse_db_api.get_topics_by_connection_id(
                    connection_id, record_id
                )
                title = topics[0].get('title', '') if topics else ''
                default_title = title
                replies = discourse_db_api.get_replies_by_topic(
                    connection_id, record_id
                )
                body_content = ''
                for reply in replies:
                    if not reply.get('content'):
                        continue

                    content_to_add = reply.get('content')
                    if body_content:
                        content_to_add = '\n\n' + content_to_add
                    if len(body_content) + len(content_to_add) > 600:
                        break
                    body_content += content_to_add

                record_detail = f"""
                    **Ticket Information:**
                    Title: {title}
                    Body: {body_content}
                """
        if not record_detail:
            error_msg = 'Record detail not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        params = {
            'username': username,
            'record_detail': record_detail
        }
        try:
            ai_title, ai_description = convert_record_to_ticket(params)
            if not ai_title:
                ai_title = default_title
        except Exception as e:
            logger.error(f'AI service error: {e}')
            error_msg = 'AI service error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({
            'title': ai_title,
            'description': ai_description,
        })

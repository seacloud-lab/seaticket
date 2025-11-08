# -*- coding: utf-8 -*-
import logging
import json
import uuid

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.utils import get_connection_columns
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.project.models import Projects, ChatSessions, \
    ChatMessages, ProjectConnections
from seahub.project.utils import check_project_permission, get_ai_reply, \
    convert_record_to_ticket, ticket_to_json, TicketNotFound, generate_ai_title
from seahub.project.constants import ConnectionType, AI_CHAT_TICKET_PREFIX_PROMPT
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import GithubIssuesTable

logger = logging.getLogger(__name__)
MAX_LENGTH = 10000


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
        
        ticket_id = request.data.get('ticket_id')
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

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        chat_uuid = str(uuid.uuid4())

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'chat_uuid': chat_uuid,
            'query': query,
            'resolve_type': resolve_type,
            'username': username,
            'session_id': session.id
        }

        try:
            ai_reply, agent_memory, sources = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_reply = 'Sorry, the AI service is temporarily unavailable, please try again later.'
            sources = []
            agent_memory = {}

        try:
            connection_ids = set([
                source['connection_id']
                for source in sources
            ])

            connections = ProjectConnections.objects.filter(id__in=connection_ids)
            connection_id_name_map = {}
            for connection in connections:
                connection_dict = connection.to_dict()
                connection_id_name_map[connection_dict['id']] = connection_dict['name']

            for source in sources:
                source['connection_name'] = connection_id_name_map[source['connection_id']]
        except Exception as e:
            logger.warning(f'Failure to query connection info: {e}')

        user_message = ChatMessages.objects.create_message(session.id, chat_uuid, request.user.username, 'user', query, resolve_type == 'agent')
        ai_reply_message = ChatMessages.objects.create_message(session.id, chat_uuid, request.user.username, 'assistant', ai_reply, resolve_type == 'agent', json.dumps(sources))

        return Response({
            'ai_reply': ai_reply,
            'sources': sources,
            'session_uuid': session_uuid,
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id,
            'agent_memory': agent_memory,
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
                topics = discourse_db_api.get_topic_by_pk(
                    connection_id, record_id
                )
                title = topics[0].get('title', '') if topics else ''
                topic_id = topics[0].get('topic_id') if topics else ''
                default_title = title
                replies = discourse_db_api.get_replies_by_topic_id(
                    connection_id, topic_id
                )
                body_content = ''
                for reply in replies:
                    if not reply.get('content'):
                        continue

                    content_to_add = reply.get('content')
                    if body_content:
                        content_to_add = '\n\n' + content_to_add
                    if len(body_content) + len(content_to_add) > MAX_LENGTH:
                        break
                    body_content += content_to_add

                record_detail = f"""
                    **Ticket Information:**
                    Title: {title}
                    Body: {body_content}
                """

            case ConnectionType.GITHUB_ISSUE.value:
                github_db_api = GitHubSeaDBAPI(project_uuid)
                issue = github_db_api.get_issue_by_pk(
                    connection_id, record_id
                )
                title = issue[0].get('title', '') if issue else ''
                default_title = title
                body_content = issue[0].get('content', '') if issue else ''
                issue_id = issue[0].get('issue_id') if issue else ''
                comments = github_db_api.get_comments_by_issue_id(
                    connection_id, issue_id
                )
                for comment in comments:
                    if not comment.get('content'):
                        continue

                    content_to_add = comment.get('content')
                    if body_content:
                        content_to_add = '\n\n' + content_to_add
                    if len(body_content) + len(content_to_add) > MAX_LENGTH:
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


class GenerateAITitleView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        connection_id = request.data.get('connection_id')
        if not connection_id:
            error_msg = 'connection_id is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        record_id = request.data.get('record_id')
        try:
            record_id = int(record_id)
        except:
            error_msg ='record_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection:
            error_msg = f'Connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if connection.type != ConnectionType.GITHUB_ISSUE.value:
            error_msg = 'Currently only GitHub Issue connections are supported for AI title generation.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            table_name = GithubIssuesTable.gen_table_name(connection_id)   
            sql = f"SELECT title, body FROM `{table_name}` WHERE _pk = {record_id}"
            result = seadb_api.query_rows(project_uuid, sql)
            row = result['results'][0]
            title = row.get('title')
            body = row.get('body')

            if not title or not body:
                error_msg = 'Title and body are required to generate AI title.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            params = {
                'title': title,
                'body': body,
                'username': username
            }
            try:
                ai_title = generate_ai_title(params)
            except Exception as e:
                logger.error(f'AI service error: {e}')
                error_msg = 'AI service error.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            columns = get_connection_columns(seadb_api, project_uuid, connection)
            base_info = seadb_api.get_base_info(project_uuid)
            tables = base_info.get('tables', [])

            table_metadata = None
            for table in tables:
                if table.get('name') == table_name:
                    table_metadata = table
                    break

            if table_metadata:
                has_ai_title_column = False
                for col in columns:
                    if col.get('name') == 'ai_title':
                        has_ai_title_column = True
                        break

                if not has_ai_title_column:
                    column = {
                        'column_name': 'ai_title',
                        'column_type': 'text',
                    }
                    table_id = table_metadata.get('id')
                    seadb_api.add_column(project_uuid, table_id, column)

            updates = [{
                'pk': record_id,
                'row': {
                    'ai_title': ai_title
                }
            }]
            seadb_api.update_rows(project_uuid, table_name, updates)


        except Exception as e:
            logger.error(f'AI title generation error: {e}')
            error_msg = 'Failed to generate AI title.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'ai_title': ai_title,
            'success': True
        })

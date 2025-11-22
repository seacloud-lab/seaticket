# -*- coding: utf-8 -*-
import datetime
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
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.utils import get_connection_columns
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.project.models import Projects, ProjectConnections, ConnectionsViews
from seahub.project.utils import check_project_permission, \
    convert_record_to_ticket, generate_ai_summary, check_ai_limit, url_to_filename, \
    get_file_from_s3_web_crawl, submit_embedding_analysis_task, get_embedding_analysis_task_status
from seahub.project.constants import ConnectionType
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import GithubIssuesTable, DiscourseTopicsTable, SeafileTable, \
    DiscourseRepliesTable, WebCrawlTable

logger = logging.getLogger(__name__)
MAX_LENGTH = 10000


class ConvertRecordToTicket(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        connection_id = request.data.get('connection_id')
        if not connection_id:
            error_msg = 'connection_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        record_id = request.data.get('record_id')
        if not record_id:
            error_msg = 'record_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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
            'record_detail': record_detail,
            'project_uuid': project_uuid,
            'org_id': org_id
        }
        try:
            ai_title, ai_content = convert_record_to_ticket(params)
            if not ai_title:
                ai_title = default_title
        except Exception as e:
            logger.error(f'AI service error: {e}')
            error_msg = 'AI service error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({
            'title': ai_title,
            'content': ai_content,
        })


class GenerateAISummaryView(APIView):
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

        # Check AI quota
        org_id = request.user.org.org_id if hasattr(request.user, 'org') else -1
        is_exceed = check_ai_limit(username, org_id)
        if is_exceed:
            error_msg = 'AI credit not enough.'
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, error_msg)

        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection:
            error_msg = f'Connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            if connection.type == ConnectionType.GITHUB_ISSUE.value:
                table_name = GithubIssuesTable.gen_table_name(connection_id)
                sql = f"SELECT title, content FROM `{table_name}` WHERE _pk = {record_id}"
                result = seadb_api.query_rows(project_uuid, sql)
                row = result['results'][0]
                title = row.get('title')
                content = row.get('content')

                if not title or not content:
                    error_msg = 'Title and content are required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                content = f"Title: {title}\n\nContent: {content}"
            elif connection.type == ConnectionType.DISCOURSE_FORUM.value:
                table_name = DiscourseTopicsTable.gen_table_name(connection_id)
                sql = f"SELECT topic_id, title FROM `{table_name}` WHERE _pk = {record_id}"
                result = seadb_api.query_rows(project_uuid, sql)
                row = result['results'][0]
                topic_id = row.get('topic_id')
                title = row.get('title')

                if not topic_id or not title:
                    error_msg = 'Topic ID and title are required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                discourse_replies_table_name = DiscourseRepliesTable.gen_table_name(connection_id)
                sql = f"SELECT content FROM `{discourse_replies_table_name}` WHERE topic_id = {topic_id} ORDER BY post_number ASC LIMIT 1"
                result = seadb_api.query_rows(project_uuid, sql)
                rows = result['results']
                if not rows:
                    error_msg = 'Content is required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                row = rows[0]
                content = row.get('content')
                if not content:
                    error_msg = 'Content is required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                content = f"Title: {title}\n\nContent: {content}"
            elif connection.type == ConnectionType.SEAFILE.value:
                table_name = SeafileTable.gen_table_name(connection_id)
                sql = f"SELECT title, content FROM `{table_name}` WHERE _pk = {record_id}"
                result = seadb_api.query_rows(project_uuid, sql)
                rows = result['results']
                if not rows:
                    error_msg = 'Content is required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                row = rows[0]
                title = row.get('title')
                content = row.get('content')
                if not content:
                    error_msg = 'Content is required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                content = f"Filename: {title}\n\nContent: {content}"
            elif connection.type == ConnectionType.SITE.value:
                table_name = WebCrawlTable.gen_table_name(connection_id)
                sql = f"SELECT url FROM `{table_name}` WHERE _pk = {record_id}"
                result = seadb_api.query_rows(project_uuid, sql)
                rows = result['results']
                if not rows:
                    error_msg = 'URL is required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                row = rows[0]
                url = row.get('url')
                if not url:
                    error_msg = 'URL is required to generate AI title.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                filename = url_to_filename(url)
                uuid_32_chars = uuid_str_to_32_chars(project_uuid)
                file = get_file_from_s3_web_crawl(uuid_32_chars, connection_id, filename)
                file_json = json.loads(file.read())
                content = file_json.get('content', '')
            else:
                error_msg = 'Currently only GitHub Issue connections are supported for AI title generation.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(f'AI service error: {e}')
            error_msg = 'AI service error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            ai_summary, ai_summary_vector = generate_ai_summary(content, username, connection.type, project_uuid, org_id)
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

        # Compatibility handling
        if table_metadata:
            has_ai_summary_column = False
            for col in columns:
                if col.get('name') == 'ai_summary':
                    has_ai_summary_column = True
                    break

            if not has_ai_summary_column:
                add_columns = [
                    {
                        'column_name': 'ai_summary',
                        'column_type': 'text',
                    },
                    {
                        'column_name': 'ai_summary_vector',
                        'column_type': 'list',
                        'list_type': 'float64',
                    },
                    {
                        'column_name': 'ai_processed_time',
                        'column_type': 'datetime',
                    },
                ]
                table_id = table_metadata.get('id')
                for column in add_columns:
                    seadb_api.add_column(project_uuid, table_id, column)

        ai_processed_time = datetime.datetime.now(datetime.UTC).isoformat()
        updates = [{
            'pk': record_id,
            'row': {
                'ai_summary': ai_summary,
                'ai_summary_vector': ai_summary_vector,
                'ai_processed_time': ai_processed_time,
            }
        }]
        seadb_api.update_rows(project_uuid, table_name, updates)

        return Response({
            'ai_summary': ai_summary,
            'ai_processed_time': ai_processed_time,
            'success': True
        })


class EmbeddingAnalysisView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

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

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'Connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        params = {
            'project_uuid': project_uuid,
            'connection_id': connection_id,
            'username': username,
            'connection_type': project_connection.type,
        }
        
        try:
            task_id = submit_embedding_analysis_task(params)
        except Exception as e:
            logger.error(f'Failed to submit embedding analysis task: {e}')
            error_msg = 'Failed to submit analysis task.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        return Response({
            'task_id': task_id,
        })


class EmbeddingAnalysisTaskStatusView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, task_id):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        try:
            result = get_embedding_analysis_task_status(task_id)
        except Exception as e:
            logger.error(f'Failed to get task status: {e}')
            error_msg = 'Failed to get task status.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        return Response(result)

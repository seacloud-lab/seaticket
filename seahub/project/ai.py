# -*- coding: utf-8 -*-
import logging
import json
from urllib.parse import urlparse

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.project.models import Projects, ProjectConnections
from seahub.project.utils import check_project_permission, \
    convert_record_to_ticket, check_ai_limit, \
    submit_embedding_analysis_task, get_embedding_analysis_task_status, \
    find_related_records
from seahub.project.constants import ConnectionType, ConnectionCategory
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import GithubIssuesTable, DiscourseTopicsTable, EmailTable


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
            case ConnectionType.EMAIL.value:
                email_db_api = EmailSeaDBAPI(project_uuid)
                body_content = ''
                emails = email_db_api.get_emails_by_thread_id(
                    connection_id, record_id
                )
                title = ''
                for email in emails:
                    if not title:
                        title = email.get('title')
                    if not email.get('content'):
                        continue

                    content_to_add = email.get('content')
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


class RelatedRecordsView(APIView):
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
        if not record_id:
            error_msg = 'record_id is required.'
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

        current_category = ConnectionCategory.from_type(connection.type)

        table_name = None
        if current_category == ConnectionCategory.ISSUE:
            if connection.type == ConnectionType.GITHUB_ISSUE.value:
                table_name = GithubIssuesTable.gen_table_name(connection_id)
            elif connection.type == ConnectionType.DISCOURSE_FORUM.value:
                table_name = DiscourseTopicsTable.gen_table_name(connection_id)
            elif connection.type == ConnectionType.EMAIL.value:
                table_name = EmailTable.gen_table_name(connection_id)

        if not table_name:
            error_msg = 'Unsupported connection type for similarity search.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        seadb_api = SeaDBAPI(username)
        project_uuid_32 = uuid_str_to_32_chars(project_uuid)
        sql = f"SELECT ai_summary_vector FROM `{table_name}` WHERE _pk = {int(record_id)} LIMIT 1"
        result = seadb_api.query_rows(project_uuid_32, sql)
        if not result['results'] or not result['results'][0].get('ai_summary_vector'):
            error_msg = 'NO AI summary vector.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        target_vector = result['results'][0]['ai_summary_vector']

        project_connections = ProjectConnections.objects.filter(
            project=project,
            deleted=False
        ).select_related('project')

        connection_ids = []
        for proj_conn in project_connections:
            if ConnectionCategory.from_type(proj_conn.type) == current_category:
                connection_ids.append(proj_conn.id)

        search_data = {
            'query_vector': target_vector,
            'project_uuid': project_uuid,
            'count': 100,
            'connection_ids': connection_ids
        }

        try:
            search_results = find_related_records(search_data)
            if not search_results:
                return Response({
                    'related_records': [],
                    'success': True
                })

            processed_results = []
            connection_objects = {int(connection_id): connection}

            connection_pks_map = {}

            for result in search_results:
                result_connection_id = int(result.get('connection_id', connection_id))
                pk = result.get('pk')

                if result_connection_id == int(connection_id) and pk == int(record_id):
                    continue

                if result_connection_id not in connection_pks_map:
                    connection_pks_map[result_connection_id] = {'pks': [], 'results': []}

                connection_pks_map[result_connection_id]['pks'].append(pk)
                connection_pks_map[result_connection_id]['results'].append(result)

            unique_connection_ids = list(connection_pks_map.keys())
            additional_connections = ProjectConnections.objects.filter(id__in=unique_connection_ids, deleted=False)
            for conn in additional_connections:
                connection_objects[conn.id] = conn

            records_map = {}

            for result_connection_id, data in connection_pks_map.items():
                if result_connection_id not in connection_objects:
                    logger.warning(f'Connection {result_connection_id} not found or deleted')
                    continue

                connection = connection_objects[result_connection_id]
                connection_type = connection.type

                if ConnectionCategory.from_type(connection_type) != current_category:
                    continue

                table_name = None
                if connection_type == ConnectionType.GITHUB_ISSUE.value:
                    table_name = GithubIssuesTable.gen_table_name(result_connection_id)
                elif connection_type == ConnectionType.DISCOURSE_FORUM.value:
                    table_name = DiscourseTopicsTable.gen_table_name(result_connection_id)
                elif connection_type == ConnectionType.EMAIL.value:
                    table_name = EmailTable.gen_table_name(result_connection_id)
                else:
                    logger.warning(f'Unsupported issue connection type: {connection_type}')
                    continue

                pks = data['pks']
                if not pks:
                    continue

                try:
                    pks_str = ','.join(map(str, pks))
                    sql = f"SELECT * FROM `{table_name}` WHERE _pk IN ({pks_str})"
                    res = seadb_api.query_rows(project_uuid_32, sql)
                    records = res.get('results', [])

                    records_map[result_connection_id] = {}
                    for record in records:
                        record_pk = record.get('_pk')
                        records_map[result_connection_id][record_pk] = record
                except Exception as e:
                    logger.error(f'Error batch querying records for connection {result_connection_id}: {e}')
                    records_map[result_connection_id] = {}

            for result in search_results:
                result_connection_id = int(result.get('connection_id', connection_id))
                pk = result.get('pk')
                score = result.get('score', 0.0)
                ai_summary = result.get('ai_summary', '')

                if result_connection_id not in connection_objects:
                    continue

                connection = connection_objects[result_connection_id]
                connection_type = connection.type

                record = records_map.get(result_connection_id, {}).get(pk)
                if not record:
                    logger.warning(f'Record not found for connection {result_connection_id}, pk {pk}')
                    continue

                processed_result = {
                    '_id': pk,
                    'connection_id': result_connection_id,
                    'score': score,
                    'type': connection_type,
                    'ai_summary': ai_summary,
                }

                if connection_type == ConnectionType.DISCOURSE_FORUM.value:
                    connection_config = json.loads(connection.config)
                    discourse_forum_url = connection_config.get('url', '')
                    slug = record.get('slug', '')
                    topic_id = record.get('topic_id', '')
                    if discourse_forum_url and slug and topic_id:
                        topic_url = f"{discourse_forum_url.rstrip('/')}/t/{slug}/{topic_id}"
                        processed_result['url'] = topic_url
                    processed_result['content'] = result.get('content', '') or result.get('ai_summary', '')
                    processed_result['title'] = record.get('title', '')
                    processed_result['slug'] = slug
                    processed_result['topic_id'] = topic_id
                    processed_result['modified_time'] = record.get('modified_time', '')

                elif connection_type == ConnectionType.GITHUB_ISSUE.value:
                    connection_config = json.loads(connection.config)
                    server_url = connection_config.get('repository', '')
                    issue_number = record.get('issue_number', '')
                    if server_url and issue_number:
                        url_parsed = urlparse(server_url)
                        base_url = f"{url_parsed.scheme}://{url_parsed.netloc}"
                        parts = url_parsed.path.strip("/").split("/")
                        repo_owner, repo_name = parts[0], parts[1]
                        url = f'{base_url}/{repo_owner}/{repo_name}/issues/{issue_number}'
                        processed_result['url'] = url
                        processed_result['repo_name'] = repo_name
                        processed_result['repo_owner'] = repo_owner
                    processed_result['content'] = record.get('content', '')
                    processed_result['title'] = record.get('title', '')
                    processed_result['issue_number'] = issue_number
                    processed_result['state'] = record.get('state', '')
                    processed_result['labels'] = record.get('labels')

                elif connection_type == ConnectionType.EMAIL.value:
                    processed_result['content'] = record.get('content', '')
                    processed_result['title'] = record.get('title', '')
                    processed_result['email_from'] = record.get('email_from', '')
                    processed_result['email_to'] = record.get('email_to', '')
                    processed_result['modified_time'] = record.get('modified_time', '')

                else:
                    logger.warning(f'Unsupported connection type: {connection_type}')
                    continue

                processed_results.append(processed_result)

        except Exception as e:
            logger.error(f"Error calling vector search indexer: {e}")
            error_msg = 'Error calling vector search indexer.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({
            'related_records': processed_results,
        })

# -*- coding: utf-8 -*-
import json
import logging
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
from seahub.project.utils import check_project_permission, check_ai_limit
from seahub.utils.ai_client import (
    convert_record_to_ticket,
    convert_ticket_to_kb_record,
    rank_related_issues,
)
from seahub.utils.events import submit_embedding_analysis_task, get_embedding_analysis_task_status, TaskConflictError
from seahub.utils.indexer import find_related_records
from seahub.project.constants import ConnectionType, ConnectionCategory, ExtraSourceType, AIScenario
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import GithubIssuesTable, DiscourseTopicsTable, ThreadTable
from seahub.project.ai_utils import get_search_connection_ids, prepare_candidates_for_rerank, perform_reranking, \
    collect_reranked_pks, fetch_connection_objects, fetch_reranked_records, build_final_results
from seahub.utils.decorators import require_org_context


logger = logging.getLogger(__name__)
MAX_LENGTH = 10000


class ConvertRecordToTicket(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context    
    def post(self, request):

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
                slug = topics[0].get('slug') if topics else ''
                config = json.loads(connection.config)
                discourse_forum_url = config.get('url')
                related_url = discourse_forum_url.rstrip('/') + '/t/' + slug + '/' + str(topic_id)
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
                config = json.loads(connection.config)
                server_url = config.get('repository')
                url_parsed = urlparse(server_url)
                base_url = url_parsed.scheme + "://" + url_parsed.netloc
                parts = url_parsed.path.strip("/").split("/")
                repo_owner, repo_name = parts[0], parts[1]
                issue_number = issue[0].get('issue_number') if issue else ''
                related_url = f'{base_url}/{repo_owner}/{repo_name}/issues/' + str(issue_number) if issue_number else ''
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
                email_id = emails[0].get('email_id') if emails else ''
                origin_thread_id = emails[0].get('origin_thread_id') if emails else ''
                related_url = f'https://app.fastmail.com/mail/all/{origin_thread_id}.{email_id}' if origin_thread_id and email_id else ''
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
            'org_id': org_id,
            'scenario': AIScenario.RECORD_GENERATION.value,
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
            'related_url': related_url,
            'linked_connection_records': [f'{connection_id}_{record_id}'],
        })


class ConvertTicketToKnowledgeBaseRecord(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request):
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        ticket_title = request.data.get('ticket_title')
        ticket_content = request.data.get('ticket_content')
        ticket_comments = request.data.get('ticket_comments', [])

        if not ticket_title and not ticket_content:
            error_msg = 'ticket data invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if ticket_comments and not isinstance(ticket_comments, list):
            error_msg = 'ticket_comments invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid, include_deleted=False)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = request.user.org.org_id
        is_exceed = check_ai_limit(username, org_id)
        if is_exceed:
            error_msg = 'AI credit not enough.'
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, error_msg)

        ticket_title = (ticket_title or '')[:MAX_LENGTH]
        ticket_content = (ticket_content or '')[:MAX_LENGTH]

        sanitized_comments = []
        for c in (ticket_comments or [])[:50]:
            content = c.get('content', '')[:2000]
            author = c.get('creator')
            created_time = c.get('created_time')

            if not content.strip():
                continue
            sanitized_comments.append({
                'author': author,
                'created_time': created_time,
                'content': content,
            })

        params = {
            'username': username,
            'ticket_title': ticket_title,
            'ticket_content': ticket_content,
            'ticket_comments': sanitized_comments,
            'project_uuid': project_uuid,
            'org_id': org_id,
            'scenario': AIScenario.RECORD_GENERATION.value,
        }

        try:
            kb_title, kb_content = convert_ticket_to_kb_record(params)
        except Exception as e:
            logger.error(f'AI service error: {e}')
            error_msg = 'AI service error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'kb_title': kb_title, 'kb_content': kb_content})


class EmbeddingAnalysisView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request):
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        connection_ids = request.data.get('connection_ids')
        if not connection_ids:
            error_msg = 'connection_ids is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)


        params = {
            'project_uuid': project_uuid,
            'connection_ids': connection_ids,
            'username': username,
            'start_date': start_date,
            'end_date': end_date
        }

        try:
            task_id = submit_embedding_analysis_task(params)
        except TaskConflictError as e:
            return api_error(status.HTTP_409_CONFLICT, str(e))
        except Exception as e:
            logger.error(f'Failed to submit embedding analysis task: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to submit analysis task.')

        return Response({
            'task_id': task_id,
        })


class EmbeddingAnalysisTaskStatusView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, task_id):
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

    @require_org_context
    def post(self, request):
        # validate and get project info
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid is required.'
            return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return None, api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        workspace = project.workspace
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # parse request params
        ticket_id = request.data.get('ticket_id')
        connection_id = request.data.get('connection_id')
        record_id = request.data.get('record_id')

        ticket_provided = bool(ticket_id)
        connection_provided = bool(connection_id)
        if connection_provided and not record_id:
            error_msg = 'record_id is required when connection_id is provided.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if ticket_provided == connection_provided:
            error_msg = 'Either ticket_id or (connection_id and record_id) is required, but not both.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # init SeaDB API
        seadb_api = SeaDBAPI(username)
        project_uuid_32 = uuid_str_to_32_chars(project_uuid)

        # get query vector
        table_name = 'tickets' if ticket_provided else None
        connection = None
        current_category = ConnectionCategory.ISSUE if ticket_provided else None
        source_connection_id = None
        source_record_id = int(ticket_id) if ticket_provided else None

        if connection_provided:
            connection = ProjectConnections.objects.get_connection_by_id(connection_id)
            if not connection:
                error_msg = f'Connection {connection_id} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            current_category = ConnectionCategory.from_type(connection.type)
            if current_category == ConnectionCategory.ISSUE:
                if connection.type == ConnectionType.GITHUB_ISSUE.value:
                    table_name = GithubIssuesTable.gen_table_name(connection_id)
                elif connection.type == ConnectionType.DISCOURSE_FORUM.value:
                    table_name = DiscourseTopicsTable.gen_table_name(connection_id)
                elif connection.type == ConnectionType.EMAIL.value:
                    table_name = ThreadTable.gen_table_name(connection_id)

            if not table_name:
                error_msg = 'Unsupported connection type for similarity search.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            source_connection_id = int(connection_id)
            source_record_id = int(record_id)

        if not table_name or source_record_id is None:
            error_msg = 'Unable to determine source record for similarity search.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        sql = f"SELECT ai_summary_vector, title, ai_summary FROM `{table_name}` \
                WHERE _pk = {source_record_id} AND (`deleted` = False OR `deleted` IS NULL) \
                LIMIT 1"
        result = seadb_api.query_rows(project_uuid_32, sql)

        if not result['results'] or not result['results'][0].get('ai_summary_vector'):
            error_msg = 'NO AI summary vector.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        query_record = result['results'][0]
        target_vector = query_record['ai_summary_vector']
        if ticket_provided and current_category is None:
            current_category = ConnectionCategory.ISSUE

        # get search connection ids
        search_connection_ids = get_search_connection_ids(project, current_category)

        # build search params and execute search
        search_data = {
            'query_vector': target_vector,
            'project_uuid': project_uuid,
            'count': 51,
            'connection_ids': search_connection_ids,
            'extra_sources': [ExtraSourceType.TICKET.value] if ticket_provided or current_category == ConnectionCategory.ISSUE else [],
        }

        try:
            search_results = find_related_records(search_data)
            if not search_results:
                return Response({'related_records': [], 'success': True})

            # prepare candidates for reranking and build key to result map
            candidate_for_rerank, key_to_result = prepare_candidates_for_rerank(
                search_results, ticket_provided, ticket_id, source_connection_id, source_record_id
            )

            # rerank results
            reranked_keys = perform_reranking(candidate_for_rerank, query_record, request, username, project_uuid)
            reranked_results = []
            if reranked_keys:
                reranked_candidates = [(key, key_to_result[key]) for key in reranked_keys if key in key_to_result]

                # collect pks to fetch
                ticket_pks, connection_pks_map = collect_reranked_pks(reranked_candidates, source_connection_id)

                # fetch connection objects
                connection_objects = fetch_connection_objects(
                    connection, connection_id, set(connection_pks_map.keys())
                )

                # fetch records
                records_map = fetch_reranked_records(
                    seadb_api, project_uuid_32, ticket_pks,
                    connection_pks_map, connection_objects, current_category
                )

                # build final results
                reranked_results = build_final_results(
                    reranked_candidates, records_map, connection_objects, source_connection_id
                )

        except Exception as e:
            logger.error(f"Error calling vector search indexer: {e}")
            error_msg = 'Error calling vector search indexer.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'related_records': reranked_results,
        })

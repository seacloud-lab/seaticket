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
    find_related_records, rank_related_issues, TaskConflictError
from seahub.project.constants import ConnectionType, ConnectionCategory
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import GithubIssuesTable, DiscourseTopicsTable, ThreadTable


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

        connection_ids = request.data.get('connection_ids')
        if not connection_ids:
            error_msg = 'connection_ids is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        start_year = request.data.get('start_year')
        end_year = request.data.get('end_year')

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
            'start_year': start_year,
            'end_year': end_year
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

    def _validate_and_get_project_info(self, request):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

        return (project, username, project_uuid), None

    def _get_search_connection_ids(self, project, current_category):
        project_connections = ProjectConnections.objects.filter(
            project=project,
            deleted=False
        ).select_related('project')

        search_connection_ids = []
        for proj_conn in project_connections:
            if ConnectionCategory.from_type(proj_conn.type) == current_category:
                search_connection_ids.append(proj_conn.id)

        return search_connection_ids

    def _fetch_tickets_batch(self, seadb_api, project_uuid_32, ticket_pks):
        if not ticket_pks:
            return {}
        
        try:
            pks_str = ','.join(map(str, ticket_pks))
            sql = f"SELECT * FROM `tickets` WHERE _pk IN ({pks_str}) AND (`deleted` = False OR `deleted` IS NULL)"
            res = seadb_api.query_rows(project_uuid_32, sql)
            tickets = res.get('results', [])
            return {ticket.get('_pk'): ticket for ticket in tickets}
        except Exception as e:
            logger.error(f'Error batch querying tickets: {e}')
            return {}

    def _fetch_connection_records_batch(self, seadb_api, project_uuid_32, connection_id, connection_type, pks):
        table_name = None
        if connection_type == ConnectionType.GITHUB_ISSUE.value:
            table_name = GithubIssuesTable.gen_table_name(connection_id)
        elif connection_type == ConnectionType.DISCOURSE_FORUM.value:
            table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        elif connection_type == ConnectionType.EMAIL.value:
            table_name = ThreadTable.gen_table_name(connection_id)
        else:
            logger.warning(f'Unsupported issue connection type: {connection_type}')
            return {}

        if not pks:
            return {}

        try:
            pks_str = ','.join(map(str, pks))
            sql = f"SELECT * FROM `{table_name}` WHERE _pk IN ({pks_str}) AND (`deleted` = False OR `deleted` IS NULL)"
            res = seadb_api.query_rows(project_uuid_32, sql)
            records = res.get('results', [])
            return {record.get('_pk'): record for record in records}
        except Exception as e:
            logger.error(f'Error batch querying records for connection {connection_id}: {e}')
            return {}

    def _process_ticket_result(self, result, ticket, ai_summary):
        """process ticket search results"""
        return {
            '_id': result.get('_id'),
            'score': result.get('score', 0.0),
            'type': 'ticket',
            'ai_summary': ai_summary,
            'title': ticket.get('title', ''),
            'content': ticket.get('content', ''),
            'modified_time': ticket.get('modified_time', ''),
            'state': ticket.get('state', ''),
        }

    def _process_connection_result(self, result, conn, record, ai_summary):
        """process connection record search results"""
        connection_type = conn.type
        pk = result.get('_id')
        result_connection_id = int(result.get('connection_id'))

        processed_result = {
            '_id': pk,
            'connection_id': result_connection_id,
            'score': result.get('score', 0.0),
            'type': connection_type,
            'ai_summary': ai_summary,
        }

        if connection_type == ConnectionType.DISCOURSE_FORUM.value:
            connection_config = json.loads(conn.config)
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
            connection_config = json.loads(conn.config)
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
            processed_result['modified_time'] = record.get('modified_time', '')

        elif connection_type == ConnectionType.EMAIL.value:
            processed_result['title'] = record.get('title', '')
            processed_result['modified_time'] = record.get('modified_time', '')

        else:
            logger.warning(f'Unsupported connection type: {connection_type}')
            return None

        return processed_result

    def _perform_reranking(self, candidates_for_rerank, query_record, request, username, project_uuid):
        if not candidates_for_rerank:
            return []

        query_record_info = {
            'title': query_record.get('title', ''),
            'ai_summary': query_record.get('ai_summary', '')
        }

        candidate_records = []
        for candidate in candidates_for_rerank:
            candidate_records.append({
                '_id': candidate['_id'],
                'connection_id': candidate.get('connection_id'),
                'type': candidate.get('type', 'connection'),
                'title': candidate.get('title', ''),
                'ai_summary': candidate.get('ai_summary', '')
            })

        org_id = request.user.org.org_id if hasattr(request.user, 'org') else -1

        rerank_params = {
            'query_record': query_record_info,
            'candidate_records': candidate_records,
            'username': username,
            'org_id': org_id,
            'project_uuid': project_uuid,
        }

        reranked_keys = rank_related_issues(rerank_params)
        if not reranked_keys:
            return []

        return reranked_keys

    def _prepare_candidates_for_rerank(self, search_results, is_ticket_source, ticket_id,
                                        source_connection_id, source_record_id):
        """Prepare candidates for reranking from search results.
        
        Returns:
            tuple: (candidate_for_rerank, key_to_result)
        """
        candidate_for_rerank = []
        key_to_result = {}

        for result in search_results:
            result_type = result.get('source_type', 'connection')
            pk = result.get('_id')

            if result_type == 'ticket_summary':
                if is_ticket_source and pk == int(ticket_id):
                    # skip if the result is the same as the query ticket
                    continue
                candidate_type = 'ticket'
                connection_id_for_key = None
            else:
                result_connection_id = int(result.get('connection_id', source_connection_id or 0))
                if not is_ticket_source and result_connection_id == source_connection_id and pk == source_record_id:
                    # skip if the result is the same as the query connection
                    continue
                candidate_type = 'connection'
                connection_id_for_key = result_connection_id

            key = f"{pk}:None" if candidate_type == 'ticket' else f"{pk}:{connection_id_for_key}"
            key_to_result[key] = result
            candidate_for_rerank.append({
                '_id': pk,
                'connection_id': connection_id_for_key,
                'type': candidate_type,
                'title': result.get('title', ''),
                'ai_summary': result.get('ai_summary', '')
            })

        return candidate_for_rerank, key_to_result

    def _collect_reranked_pks(self, reranked_candidates, source_connection_id):
        """Collect ticket pks and connection pks from reranked candidates."""
        ticket_pks = []
        connection_pks_map = {}

        for _, result in reranked_candidates:
            result_type = result.get('source_type', 'connection')
            pk = result.get('_id')
            if result_type == 'ticket_summary':
                ticket_pks.append(pk)
            else:
                result_connection_id = int(result.get('connection_id', source_connection_id or 0))
                if result_connection_id not in connection_pks_map:
                    connection_pks_map[result_connection_id] = []
                connection_pks_map[result_connection_id].append(pk)

        return ticket_pks, connection_pks_map

    def _fetch_connection_objects(self, connection, connection_id, needed_connection_ids):
        """Fetch connection objects for the given connection ids. Return a map of connection id to connection object."""
        connection_objects = {}
        if connection:
            connection_objects[int(connection_id)] = connection

        missing_connection_ids = needed_connection_ids - set(connection_objects.keys())
        if missing_connection_ids:
            additional_connections = ProjectConnections.objects.filter(
                id__in=missing_connection_ids, deleted=False
            )
            for conn in additional_connections:
                connection_objects[conn.id] = conn

        return connection_objects

    def _fetch_reranked_records(self, seadb_api, project_uuid_32, ticket_pks,
                                 connection_pks_map, connection_objects, current_category):
        """Fetch all records (tickets and connections) for reranked candidates."""
        records_map = {'tickets': {}}

        if ticket_pks:
            records_map['tickets'] = self._fetch_tickets_batch(seadb_api, project_uuid_32, ticket_pks)

        for result_connection_id, pks in connection_pks_map.items():
            conn = connection_objects.get(result_connection_id)
            if not conn:
                logger.warning(f'Connection {result_connection_id} not found or deleted')
                continue

            connection_type = conn.type
            if ConnectionCategory.from_type(connection_type) != current_category:
                continue

            records_map[result_connection_id] = self._fetch_connection_records_batch(
                seadb_api, project_uuid_32, result_connection_id, connection_type, pks
            )

        return records_map

    def _build_final_results(self, reranked_candidates, records_map, connection_objects, source_connection_id):
        """Build final results from reranked candidates and fetched records."""
        results = []

        for _, result in reranked_candidates:
            result_type = result.get('source_type', 'connection')
            pk = result.get('_id')
            ai_summary = result.get('ai_summary', '')

            if result_type == 'ticket_summary':
                ticket = records_map.get('tickets', {}).get(pk)
                if not ticket:
                    logger.warning(f'Ticket not found for pk {pk}')
                    continue
                processed_result = self._process_ticket_result(result, ticket, ai_summary)
            else:
                result_connection_id = int(result.get('connection_id', source_connection_id or 0))
                conn = connection_objects.get(result_connection_id)
                if not conn:
                    logger.warning(f'Connection {result_connection_id} not found or deleted')
                    continue

                record = records_map.get(result_connection_id, {}).get(pk)
                if not record:
                    logger.warning(f'Record not found for connection {result_connection_id}, pk {pk}')
                    continue

                processed_result = self._process_connection_result(result, conn, record, ai_summary)

            if processed_result:
                results.append(processed_result)

        return results

    def post(self, request):
        # validate and get project info
        project_info, error = self._validate_and_get_project_info(request)
        if error:
            return error
        project, username, project_uuid = project_info

        # parse request params
        ticket_id = request.data.get('ticket_id')
        connection_id = request.data.get('connection_id')
        record_id = request.data.get('record_id')

        ticket_provided = bool(ticket_id)
        connection_provided = bool(connection_id)
        is_ticket_source = ticket_provided
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
        search_connection_ids = self._get_search_connection_ids(project, current_category)

        # build search params and execute search
        search_data = {
            'query_vector': target_vector,
            'project_uuid': project_uuid,
            'count': 51,
            'connection_ids': search_connection_ids,
            'extra_sources': ['ticket'] if is_ticket_source or current_category == ConnectionCategory.ISSUE else [],
        }

        try:
            search_results = find_related_records(search_data)
            if not search_results:
                return Response({'related_records': [], 'success': True})

            # prepare candidates for reranking and build key to result map
            candidate_for_rerank, key_to_result = self._prepare_candidates_for_rerank(
                search_results, is_ticket_source, ticket_id, source_connection_id, source_record_id
            )

            # rerank results
            reranked_keys = self._perform_reranking(candidate_for_rerank, query_record, request, username, project_uuid)
            reranked_results = []
            if reranked_keys:
                reranked_candidates = [(key, key_to_result[key]) for key in reranked_keys if key in key_to_result]

                # collect pks to fetch
                ticket_pks, connection_pks_map = self._collect_reranked_pks(reranked_candidates, source_connection_id)

                # fetch connection objects
                connection_objects = self._fetch_connection_objects(
                    connection, connection_id, set(connection_pks_map.keys())
                )

                # fetch records
                records_map = self._fetch_reranked_records(
                    seadb_api, project_uuid_32, ticket_pks,
                    connection_pks_map, connection_objects, current_category
                )

                # build final results
                reranked_results = self._build_final_results(
                    reranked_candidates, records_map, connection_objects, source_connection_id
                )

        except Exception as e:
            logger.error(f"Error calling vector search indexer: {e}")
            error_msg = 'Error calling vector search indexer.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'related_records': reranked_results,
        })

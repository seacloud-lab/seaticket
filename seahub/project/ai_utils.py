import json
import logging
from urllib.parse import urlparse

from seahub.project.constants import ConnectionType, ConnectionCategory
from seahub.project.models import ProjectConnections
from seahub.utils.ai_client import rank_related_issues
from seahub.seadb_models.utils import fetch_tickets_batch, fetch_issue_type_connection_records_batch


logger = logging.getLogger(__name__)


def get_search_connection_ids(project, current_category):
    project_connections = ProjectConnections.objects.filter(
        project=project,
        is_active=True,
        deleted=False
    ).select_related('project')

    search_connection_ids = []
    for proj_conn in project_connections:
        if ConnectionCategory.from_type(proj_conn.type) == current_category:
            search_connection_ids.append(proj_conn.id)

    return search_connection_ids


def process_ticket_result(result, ticket, ai_summary):
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


def process_connection_result(result, conn, record, ai_summary):
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


def perform_reranking(candidates_for_rerank, query_record, request, username, project_uuid):
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


def prepare_candidates_for_rerank(search_results, is_ticket_source, ticket_id,
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


def collect_reranked_pks(reranked_candidates, source_connection_id):
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


def fetch_connection_objects(connection, connection_id, needed_connection_ids):
    """Fetch connection objects for the given connection ids.

    Return a map of connection id to connection object.
    """
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


def fetch_reranked_records(seadb_api, project_uuid_32, ticket_pks,
                          connection_pks_map, connection_objects, current_category):
    """Fetch all records (tickets and connections) for reranked candidates."""
    records_map = {'tickets': {}}

    if ticket_pks:
        records_map['tickets'] = fetch_tickets_batch(seadb_api, project_uuid_32, ticket_pks)

    for result_connection_id, pks in connection_pks_map.items():
        conn = connection_objects.get(result_connection_id)
        if not conn:
            logger.warning(f'Connection {result_connection_id} not found or deleted')
            continue

        connection_type = conn.type
        if ConnectionCategory.from_type(connection_type) != current_category:
            continue

        records_map[result_connection_id] = fetch_issue_type_connection_records_batch(
            seadb_api, project_uuid_32, result_connection_id, connection_type, pks
        )

    return records_map


def build_final_results(reranked_candidates, records_map, connection_objects, source_connection_id):
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
            processed_result = process_ticket_result(result, ticket, ai_summary)
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

            processed_result = process_connection_result(result, conn, record, ai_summary)

        if processed_result:
            results.append(processed_result)

    return results


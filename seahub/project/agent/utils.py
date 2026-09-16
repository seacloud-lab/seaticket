import logging
import json

from django.core import signing
from django.core.signing import BadSignature

from seahub.project.utils import get_current_table_metadata
from seahub.seadb_models.models import SchemaTables


logger = logging.getLogger(__name__)


def _update_action_status(seadb_api, project_uuid, action_id, row):
    """Update action status in SeaDB - shared helper for agent action views."""
    update_data = [{
        'pk': int(action_id),
        'row': row,
    }]
    seadb_api.update_rows(project_uuid, SchemaTables.AGENT_ACTIONS.table_name(), update_data)


def update_action_status_and_refresh_run(seadb_api, project_uuid, run_id, action_id, row):
    if run_id is None:
        return ''
    _update_action_status(seadb_api, project_uuid, action_id, row)
    return refresh_run_suggestions_status_safely(seadb_api, project_uuid, int(run_id))


def _parse_action_references(raw_references):
    if isinstance(raw_references, list):
        return raw_references
    if not raw_references:
        return []
    if not isinstance(raw_references, str):
        return []
    try:
        references = json.loads(raw_references)
    except Exception:
        return []
    return references if isinstance(references, list) else []

def _reformat_actions(actions):
    """Group tool calls and phase output by phase."""
    phases = {}
    for action in actions:
        phase = action.get('phase')
        if not phase:
            continue

        phase_actions = phases.setdefault(phase, {'actions': []})
        if action.get('tool_name') is not None:
            phase_actions['actions'].append(action)
        elif action.get('type') == phase:
            phase_actions.update({
                'prompt': action.get('prompt'),
                'input': action.get('input'),
                'result': action.get('result'),
            })

    return phases

def _serialize_action(action, with_trace=False):
    """Serialize one agent_actions row for API responses."""
    data = {
        'id': action['_pk'],
        'type': action.get('action_type', ''),
        'tool_name': action.get('tool_name', ''),
        'result': action.get('result', ''),
        'status': action.get('status', ''),
        'suggestion_reason': action.get('suggestion_reason', ''),
        'suggestion_content': action.get('suggestion_content', ''),
        'suggestion_payload': action.get('suggestion_payload', ''),
        'references': _parse_action_references(action.get('references')),
        'statistics': action.get('statistics', ''),
        'created_at': action.get('created_at', ''),
        'executed_at': action.get('executed_at', ''),
        'target_item_type': action.get('target_item_type', ''),
        'target_item_id': action.get('target_item_id', ''),
        'target_item_title': action.get('target_item_title', ''),
    }
    if with_trace:
        data.update({
            'phase': action.get('phase', ''),
            'prompt': action.get('prompt', ''),
            'input': action.get('input', ''),
            'step': action.get('step'),
            'tool_arguments': action.get('tool_arguments', ''),
            'observation': action.get('observation', ''),
        })
    return data


def _build_items_map_from_actions(actions, owner_source=None):
    """Build grouped items by owner (non-suggestion) or target (suggestion)."""
    owner_source = owner_source or {}
    items_map = {}
    for action in actions:
        source = owner_source
        if _is_suggestion_action(action) and action.get('target_item_type') and action.get('target_item_id'):
            source = {
                'source_type': action.get('target_item_type', ''),
                'source_id': action.get('target_item_id', ''),
                'source_title': action.get('target_item_title', ''),
            }
        key = (source.get('source_type', ''), source.get('source_id', ''))
        if key not in items_map:
            items_map[key] = {
                'source_type': key[0],
                'source_id': key[1],
                'source_title': source.get('source_title', ''),
                'actions': [],
            }
        items_map[key]['actions'].append(_serialize_action(action, with_trace=True))

    for item in items_map.values():
        item['actions'] = _reformat_actions(item['actions'])

    return items_map

def get_agent_run_detail(seadb_api, project_uuid, run_id):
    try:
        run_sql = "SELECT `_pk`, `status`, `owner_source_type`, `owner_source_id`, `owner_source_title`, " \
            "`suggestions_status`, `started_at`, `finished_at`, " \
            f"`error_message`, `event` FROM `{SchemaTables.AGENT_RUNS.table_name()}` WHERE `_pk` = {run_id}"
        run_result = seadb_api.query_rows(project_uuid, run_sql)
        runs = run_result.get('results', [])
        if not runs:
            raise ValueError('Run not found.')
        run = runs[0]

        actions_sql = "SELECT `_pk`, `run_id`, `target_item_type`, `target_item_id`, `target_item_title`, " \
            f"`action_type`, `tool_name`, `result`, `status`, `suggestion_reason`, `suggestion_content`, `suggestion_payload`, " \
            f"`phase`, `prompt`, `input`, `statistics`, `created_at`, `executed_at`, `references`, `step`, `tool_arguments`, `observation` FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` " \
            f"WHERE `run_id` = {run_id} ORDER BY `created_at` ASC"
        actions_result = seadb_api.query_rows(project_uuid, actions_sql)
        actions = actions_result.get('results', [])
        owner_source = {
            'source_type': run.get('owner_source_type', ''),
            'source_id': run.get('owner_source_id', ''),
            'source_title': run.get('owner_source_title', ''),
        }
        items_map = _build_items_map_from_actions(actions, owner_source=owner_source)

        return {
            'id': run['_pk'],
            'status': run.get('status', ''),
            'owner_source_type': run.get('owner_source_type', ''),
            'owner_source_id': run.get('owner_source_id', ''),
            'owner_source_title': run.get('owner_source_title', ''),
            'suggestions_status': run.get('suggestions_status', ''),
            'started_at': run.get('started_at', ''),
            'finished_at': run.get('finished_at', ''),
            'error_message': run.get('error_message', ''),
            'items': list(items_map.values()),
            'event': _parse_run_event(run.get('event')),
        }
    except Exception as e:
        logger.exception(e)
        raise

def _parse_run_event(raw_event):
    if not raw_event:
        return None
    if isinstance(raw_event, str):
        try:
            raw_event = json.loads(raw_event)
        except Exception:
            return None
    return raw_event if isinstance(raw_event, dict) else None


VISIBLE_LOG_ACTION_TYPES = ('prelude', 'analysis', 'suggestion')
SUGGESTION_ACTION_TYPE = 'suggestion'

RUN_STATUS_COMPLETED = 'completed'

ACTION_STATUS_PENDING = 'pending'
ACTION_STATUS_EXECUTING = 'executing'
ACTION_STATUS_FAILED = 'failed'
ACTION_STATUS_CANCELLED = 'cancelled'

SUGGESTIONS_STATUS_NONE = 'none'
SUGGESTIONS_STATUS_PENDING = 'pending'
SUGGESTIONS_STATUS_RESOLVED = 'resolved'
SUGGESTIONS_STATUS_FAILED = 'failed'

LOG_STATUS_PROCESSED = 'processed'
LOG_STATUS_UNPROCESSED = 'unprocessed'
LOG_STATUS = (LOG_STATUS_PROCESSED, LOG_STATUS_UNPROCESSED)
AGENT_LOG_CURSOR_SALT = 'seahub.project.agent.logs'


def _is_suggestion_action(action):
    return action.get('action_type', '') == SUGGESTION_ACTION_TYPE


def _query_owned_runs(seadb_api, project_uuid, owner_source_id, owner_source_type):
    runs_table = SchemaTables.AGENT_RUNS.table_name()
    sql = (
        "SELECT `_pk`, `status`, `suggestions_status`, `started_at`, "
        "`finished_at`, `error_message`, `event`, "
        "`owner_source_type`, `owner_source_id`, `owner_source_title` "
        f"FROM `{runs_table}` "
        "WHERE `owner_source_id` = ? AND `owner_source_type` = ? "
        "ORDER BY `_pk` ASC"
    )
    result = seadb_api.query_rows(project_uuid, sql, params=[owner_source_id, owner_source_type])
    return result.get('results', [])


def _query_log_summary_rows(seadb_api, project_uuid, page, per_page, offset=None):
    if offset is None:
        offset = (page - 1) * per_page
    runs_table = SchemaTables.AGENT_RUNS.table_name()
    sql = (
        "SELECT `owner_source_id`, `owner_source_type`, "
        "MAX(`owner_source_title`) AS `owner_source_title`, "
        "COUNT(*) AS `num_of_runs`, "
        "MAX(`started_at`) AS `last_active_at` "
        f"FROM `{runs_table}` "
        "WHERE `owner_source_id` IS NOT NULL "
        "GROUP BY `owner_source_id`, `owner_source_type` "
        "ORDER BY `last_active_at` DESC, `owner_source_type` DESC "
        f"LIMIT {offset}, {per_page + 1}"
    )
    result = seadb_api.query_rows(project_uuid, sql)
    return result.get('results', [])


def _query_run_status_counts(seadb_api, project_uuid, summary_rows):
    """Count runs of the given owners bucketed by (status, suggestions_status).

    SeaDB does not support conditional aggregation (SUM(CASE WHEN ...)), so the
    counting is done here over one GROUP BY bucket query. Bucketing keeps the
    returned row count independent of how many runs an owner has.

    Example - two owners on the current page, five runs in total. Issue 1_9
    has three runs (2 completed without suggestions, 1 completed with resolved
    suggestions) and ticket 42 has two runs (1 still running with a pending
    suggestion, 1 completed with a pending suggestion):

        summary_rows = [
            {'owner_source_id': '1_9', 'owner_source_type': 'github_issue'},
            {'owner_source_id': '42',  'owner_source_type': 'ticket'},
        ]

    Bucket rows returned by SeaDB:

        ('1_9', 'github_issue', 'completed', 'none',     bucket_size=2)
        ('1_9', 'github_issue', 'completed', 'resolved', bucket_size=1)
        ('42',  'ticket',       'running',   'pending',  bucket_size=1)
        ('42',  'ticket',       'completed', 'pending',  bucket_size=1)

    Aggregated result:

        {
            ('1_9', 'github_issue'): {'incomplete_runs': 0, 'open_suggestion_runs': 0, 'resolved_runs': 1},
            ('42',  'ticket'):       {'incomplete_runs': 1, 'open_suggestion_runs': 1, 'resolved_runs': 0},
        }

    A run that is not completed counts only towards incomplete_runs: its
    suggestions_status is not final yet, so it must not also count as an open
    suggestion. The explicit LIMIT 0, 10000 is required because SeaDB silently
    caps queries without LIMIT at 100 rows, and truncated buckets would corrupt
    the log badge status.
    """
    counts = {}
    owner_filters = []
    params = []
    for row in summary_rows:
        key = (row.get('owner_source_id', ''), row.get('owner_source_type', ''))
        counts[key] = {'incomplete_runs': 0, 'open_suggestion_runs': 0, 'resolved_runs': 0}
        owner_filters.append("(`owner_source_id` = ? AND `owner_source_type` = ?)")
        params.extend([key[0], key[1]])
    if not owner_filters:
        return counts

    runs_table = SchemaTables.AGENT_RUNS.table_name()
    sql = (
        "SELECT `owner_source_id`, `owner_source_type`, `status`, `suggestions_status`, "
        "COUNT(*) AS `bucket_size` "
        f"FROM `{runs_table}` "
        f"WHERE {' OR '.join(owner_filters)} "
        "GROUP BY `owner_source_id`, `owner_source_type`, `status`, `suggestions_status` "
        "LIMIT 0, 10000"
    )
    result = seadb_api.query_rows(project_uuid, sql, params=params)
    for row in result.get('results', []):
        key = (row.get('owner_source_id', ''), row.get('owner_source_type', ''))
        if key not in counts:
            continue
        bucket_size = int(row.get('bucket_size') or 0)
        run_status = str(row.get('status') or '').strip()
        if run_status != RUN_STATUS_COMPLETED:
            counts[key]['incomplete_runs'] += bucket_size
            continue
        suggestions_status = str(row.get('suggestions_status') or '').strip()
        if suggestions_status in ('', SUGGESTIONS_STATUS_PENDING, SUGGESTIONS_STATUS_FAILED):
            counts[key]['open_suggestion_runs'] += bucket_size
        elif suggestions_status == SUGGESTIONS_STATUS_RESOLVED:
            counts[key]['resolved_runs'] += bucket_size
    return counts


def _calculate_suggestions_status(suggestion_statuses):
    normalized_statuses = [
        str(action_status or '').strip()
        for action_status in suggestion_statuses
        if action_status is not None
    ]
    if not normalized_statuses:
        return SUGGESTIONS_STATUS_NONE
    if any(action_status in (ACTION_STATUS_PENDING, ACTION_STATUS_EXECUTING) for action_status in normalized_statuses):
        return SUGGESTIONS_STATUS_PENDING
    if any(action_status == ACTION_STATUS_FAILED for action_status in normalized_statuses):
        return SUGGESTIONS_STATUS_FAILED
    return SUGGESTIONS_STATUS_RESOLVED


def _refresh_run_suggestions_status(seadb_api, project_uuid, run_id):
    actions_table = SchemaTables.AGENT_ACTIONS.table_name()
    runs_table = SchemaTables.AGENT_RUNS.table_name()
    suggestion_sql = (
        "SELECT `status` "
        f"FROM `{actions_table}` "
        f"WHERE `run_id` = {int(run_id)} AND `action_type` = '{SUGGESTION_ACTION_TYPE}' "
    )
    suggestion_rows = seadb_api.query_rows(project_uuid, suggestion_sql).get('results', [])
    suggestions_status = _calculate_suggestions_status([
        row.get('status', '')
        for row in suggestion_rows
    ])
    seadb_api.update_rows(
        project_uuid,
        runs_table,
        [{'pk': int(run_id), 'row': {'suggestions_status': suggestions_status}}],
    )
    return suggestions_status


def refresh_run_suggestions_status_safely(seadb_api, project_uuid, run_id):
    try:
        return _refresh_run_suggestions_status(seadb_api, project_uuid, run_id)
    except Exception:
        logger.exception(
            'Failed to refresh suggestions_status for project %s run %s.',
            project_uuid,
            run_id,
        )
        return ''


def _calculate_log_status(summary_row):
    """Derive the log badge status from the aggregate counters of one summary row.

    Returns '' (no badge) while any run is incomplete or still has open
    suggestions, 'done' once all runs completed and at least one resolved its
    suggestions, and 'done' once all runs completed without open suggestions.
    """
    if not summary_row.get('num_of_runs'):
        return ''
    if summary_row.get('incomplete_runs'):
        return ''
    if summary_row.get('open_suggestion_runs'):
        return ''
    return LOG_STATUS_PROCESSED


def _build_agent_logs(summary_rows, status_counts):
    logs = []
    for row in summary_rows:
        key = (row.get('owner_source_id', ''), row.get('owner_source_type', ''))
        logs.append({
            'owner_source_id': row.get('owner_source_id', ''),
            'owner_source_type': row.get('owner_source_type', ''),
            'owner_source_title': row.get('owner_source_title', ''),
            'num_of_runs': row.get('num_of_runs', 0),
            'last_active_at': row.get('last_active_at'),
            'status': _calculate_log_status({
                'num_of_runs': row.get('num_of_runs', 0),
                **status_counts.get(key, {}),
            }),
        })
    return logs


def _is_matched_log_status(log, log_status):
    if log_status == LOG_STATUS_PROCESSED:
        return log['status'] == LOG_STATUS_PROCESSED
    if log_status == LOG_STATUS_UNPROCESSED:
        return log['status'] != LOG_STATUS_PROCESSED
    return False


def _load_agent_logs_cursor(cursor, project_uuid, status_filter):
    if not cursor:
        return 0, []
    try:
        payload = signing.loads(cursor, salt=AGENT_LOG_CURSOR_SALT)
    except (BadSignature, TypeError, ValueError):
        raise ValueError('Cursor is invalid.')

    source_offset = payload.get('source_offset')
    pending_logs = payload.get('pending_logs')
    if (
        payload.get('project_uuid') != project_uuid
        or payload.get('status_filter') != status_filter
        or not isinstance(source_offset, int)
        or source_offset < 0
        or not isinstance(pending_logs, list)
        or not all(isinstance(log, dict) for log in pending_logs)
    ):
        raise ValueError('Cursor is invalid.')
    return source_offset, pending_logs


def _dump_agent_logs_cursor(project_uuid, status_filter, source_offset, pending_logs):
    return signing.dumps({
        'project_uuid': project_uuid,
        'status_filter': status_filter,
        'source_offset': source_offset,
        'pending_logs': pending_logs,
    }, salt=AGENT_LOG_CURSOR_SALT)


def list_agent_logs(seadb_api, project_uuid, page=1, per_page=20, log_status='', cursor=None):
    if log_status in LOG_STATUS:
        return _list_agent_logs_by_status(seadb_api, project_uuid, per_page, log_status, cursor)

    summary_rows = _query_log_summary_rows(seadb_api, project_uuid, page, per_page)
    has_more = len(summary_rows) > per_page
    if has_more:
        summary_rows = summary_rows[:per_page]

    status_counts = _query_run_status_counts(seadb_api, project_uuid, summary_rows)
    logs = _build_agent_logs(summary_rows, status_counts)

    return {
        'logs': logs,
        'has_more': has_more,
        'next_cursor': None,
    }


def _list_agent_logs_by_status(seadb_api, project_uuid, per_page, status_filter, cursor):
    """Paginate the derived log status after loading source log batches.

    A log's status depends on the aggregate state of its runs, so it cannot be
    filtered in the source summary query. The signed cursor stores the next
    unscanned source offset and the lookahead matches used to calculate
    has_more, so those source logs are not scanned twice.
    """
    matched_logs = []
    source_offset, pending_logs = _load_agent_logs_cursor(cursor, project_uuid, status_filter)
    matched_logs.extend(pending_logs)

    while len(matched_logs) <= per_page:
        summary_rows = _query_log_summary_rows(seadb_api, project_uuid, 1, per_page, source_offset)
        has_more_source_rows = len(summary_rows) > per_page
        if has_more_source_rows:
            summary_rows = summary_rows[:per_page]

        status_counts = _query_run_status_counts(seadb_api, project_uuid, summary_rows)
        logs = _build_agent_logs(summary_rows, status_counts)
        for index, log in enumerate(logs):
            if not _is_matched_log_status(log, status_filter):
                continue
            matched_logs.append(log)
            if len(matched_logs) > per_page:
                source_offset += index + 1
                break
        else:
            source_offset += len(summary_rows)

        if len(matched_logs) > per_page or not has_more_source_rows:
            break

    has_more = len(matched_logs) > per_page
    logs = matched_logs[:per_page]
    next_cursor = None
    if has_more:
        next_cursor = _dump_agent_logs_cursor(
            project_uuid,
            status_filter,
            source_offset,
            matched_logs[per_page:],
        )

    return {
        'logs': logs,
        'has_more': has_more,
        'next_cursor': next_cursor,
    }


def _query_log_actions_by_runs(seadb_api, project_uuid, run_ids):
    """Fetch all visible actions of the given runs.

    Runs are strictly owned by the queried item, so every suggestion inside
    them belongs to this log.
    """
    if not run_ids:
        return []
    actions_table = SchemaTables.AGENT_ACTIONS.table_name()
    run_ids_str = ','.join(map(str, run_ids))
    action_types_str = ','.join(f"'{action_type}'" for action_type in VISIBLE_LOG_ACTION_TYPES)

    sql = (
        "SELECT `_pk`, `run_id`, `action_type`, `tool_name`, `result`, `status`, "
        "`suggestion_reason`, `suggestion_content`, `suggestion_payload`, `references`, "
        "`target_item_type`, `target_item_id`, `target_item_title`, "
        "`created_at`, `executed_at` "
        f"FROM `{actions_table}` "
        f"WHERE `run_id` IN ({run_ids_str}) "
        f"AND `action_type` IN ({action_types_str}) "
        "ORDER BY `run_id` ASC, `_pk` ASC"
    )
    result = seadb_api.query_rows(project_uuid, sql)
    return result.get('results', [])


def get_agent_log_runs(seadb_api, project_uuid, owner_source_id, owner_source_type):
    runs = _query_owned_runs(seadb_api, project_uuid, owner_source_id, owner_source_type)
    if not runs:
        raise ValueError('Item not found.')

    run_ids = [int(run['_pk']) for run in runs if run.get('_pk') is not None]
    actions = _query_log_actions_by_runs(seadb_api, project_uuid, run_ids)

    actions_by_run = {}
    for action in actions:
        run_id = action.get('run_id')
        if run_id is None:
            continue
        run_id = int(run_id)
        actions_by_run.setdefault(run_id, []).append(_serialize_action(action))

    return {
        'runs': [{
            'id': run['_pk'],
            'status': run.get('status', ''),
            'suggestions_status': run.get('suggestions_status', ''),
            'owner_source_type': run.get('owner_source_type', ''),
            'owner_source_id': run.get('owner_source_id', ''),
            'owner_source_title': run.get('owner_source_title', ''),
            'started_at': run.get('started_at'),
            'finished_at': run.get('finished_at'),
            'error_message': run.get('error_message'),
            'event': _parse_run_event(run.get('event')),
            'actions': actions_by_run.get(int(run['_pk']), []),
        } for run in runs],
    }


def cancel_agent_log_pending_actions(seadb_api, project_uuid, owner_source_id, owner_source_type, result_message, executed_at):
    """Cancel pending actions for every run owned by one log item."""
    runs = _query_owned_runs(seadb_api, project_uuid, owner_source_id, owner_source_type)
    if not runs:
        raise ValueError('Item not found.')

    run_ids = [int(run['_pk']) for run in runs if run.get('_pk') is not None]
    if not run_ids:
        return get_agent_log_runs(seadb_api, project_uuid, owner_source_id, owner_source_type)

    actions_table = SchemaTables.AGENT_ACTIONS.table_name()
    run_ids_str = ','.join(map(str, run_ids))
    sql = (
        "SELECT `_pk`, `run_id` "
        f"FROM `{actions_table}` "
        f"WHERE `run_id` IN ({run_ids_str}) AND `status` = '{ACTION_STATUS_PENDING}'"
    )
    pending_actions = seadb_api.query_rows(project_uuid, sql).get('results', [])
    if pending_actions:
        seadb_api.update_rows(
            project_uuid,
            actions_table,
            [{
                'pk': int(action['_pk']),
                'row': {
                    'status': ACTION_STATUS_CANCELLED,
                    'result': result_message,
                    'executed_at': executed_at,
                },
            } for action in pending_actions],
        )
        for run_id in {int(action['run_id']) for action in pending_actions}:
            refresh_run_suggestions_status_safely(seadb_api, project_uuid, run_id)

    return get_agent_log_runs(seadb_api, project_uuid, owner_source_id, owner_source_type)


_GITHUB_ISSUE_TYPE_COLOR_MAP = {
    'gray': '#5A5F66',
    'blue': '#E0F0FF',
    'green': '#E0F9E5',
    'yellow': '#FFF9D0',
    'orange': '#FFE8D6',
    'red': '#FFE8E8',
    'pink': '#FADADD',
    'purple': '#F3E5F5',
}

def sync_issue_type_column_options(seadb_api, project_uuid, connection_id, github_api, owner, repo):
    """Mirror the seaqa-indexer's `add_or_update_issue_type_column_options`."""
    github_issue_types = github_api.get_all_issue_types(owner, repo)

    base_metadata = seadb_api.get_base_metadata(project_uuid)
    tables = (base_metadata or {}).get('tables') or []
    table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
    table_meta = get_current_table_metadata(tables, table_name)
    if not table_meta:
        return 0, [], 0, 0

    issue_type_column = None
    for column in table_meta.get('columns') or []:
        if column.get('name') == SchemaTables.GITHUB_ISSUES.column.issue_type.name:
            issue_type_column = column
            break
    if not issue_type_column:
        return 0, [], 0, 0

    table_id = table_meta.get('id')
    column_key = issue_type_column.get('key')
    existing_options = ((issue_type_column.get('data') or {}).get('options')) or []
    old_type_id_to_option = {}
    old_type_names = set()
    for opt in existing_options:
        type_id = opt.get('type_id')
        type_name = opt.get('name')
        if type_name:
            old_type_names.add(type_name)
        if type_id:
            old_type_id_to_option[type_id] = opt

    new_type_ids = set()
    need_added_options = []
    # Each entry: (option_id, new_name_or_None, update_option_data_or_None, old_name)
    need_updated_options = []
    for gh_type in github_issue_types or []:
        gh_type_id = gh_type.get('id')
        gh_type_name = (gh_type.get('name') or '').strip()
        if not gh_type_id or not gh_type_name:
            continue
        gh_color_name = (gh_type.get('color') or '').lower()
        new_type_ids.add(gh_type_id)

        old_option = old_type_id_to_option.get(gh_type_id)
        if not old_option:
            need_added_options.append({
                'table_id': table_id,
                'column_key': column_key,
                'option_name': gh_type_name,
                'option_data': {
                    'color': _GITHUB_ISSUE_TYPE_COLOR_MAP.get(gh_color_name),
                    'type_id': gh_type_id,
                },
            })
            continue

        old_name = old_option.get('name')
        old_color = old_option.get('color')
        option_id = old_option.get('id')
        new_color = _GITHUB_ISSUE_TYPE_COLOR_MAP.get(gh_color_name)
        name_changed = gh_type_name != old_name
        color_changed = new_color != old_color
        if not name_changed and not color_changed:
            continue
        update_option_data = {
            'color': new_color,
            'type_id': gh_type_id,
        } if color_changed else None
        new_name = gh_type_name if name_changed else None
        need_updated_options.append(
            (option_id, new_name, update_option_data, old_name)
        )

    # Delete options whose type_id no longer exists on GitHub. Done first so
    # their names free up for any renames that would otherwise collide.
    deleted = 0
    need_deleted_type_ids = set(old_type_id_to_option.keys()) - new_type_ids
    if need_deleted_type_ids:
        deleted_option_ids = [
            old_type_id_to_option[tid].get('id') for tid in need_deleted_type_ids
        ]
        deleted_option_names = {
            old_type_id_to_option[tid].get('name') for tid in need_deleted_type_ids
        }
        old_type_names = old_type_names - deleted_option_names
        try:
            seadb_api.delete_column_option(project_uuid, {
                'table_id': table_id,
                'column_key': column_key,
                'option_ids': deleted_option_ids,
            })
            deleted = len(deleted_option_ids)
        except Exception as e:
            logger.warning(
                f'Failed to delete stale GitHub issue type options '
                f'(connection {connection_id}): {e}'
            )

    # Straight-forward updates first; rename collisions deferred.
    updated = 0
    conflict_updates = []
    for updated_option in need_updated_options:
        option_id, new_name, update_option_data, old_name = updated_option
        if new_name and new_name in old_type_names:
            conflict_updates.append(updated_option)
            continue
        try:
            seadb_api.update_column_option(project_uuid, {
                'table_id': table_id,
                'column_key': column_key,
                'option_id': option_id,
                'new_option_name': new_name,
                'update_option_data': update_option_data,
            })
            updated += 1
        except Exception as e:
            logger.warning(
                f'Failed to update GitHub issue type option "{old_name}" '
                f'(connection {connection_id}): {e}'
            )

    # Handle rename cycles (e.g. A->B, B->A) via a temporary name pass,
    # mirroring the indexer. For each conflicting rename, first rename the
    # option to a unique temp name, then to its final name in a second pass.
    temp_prefix = 'tmp'
    already_renamed = set()
    pending_final_renames = []
    for updated_option in conflict_updates:
        option_id, new_name, update_option_data, old_name = updated_option
        if new_name in already_renamed or old_name in already_renamed:
            # The other side of the cycle already went through the temp-name
            # dance; its final rename will reuse this slot.
            pending_final_renames.append(updated_option)
            continue
        temp_name = f'{temp_prefix}{option_id}'
        try:
            seadb_api.update_column_option(project_uuid, {
                'table_id': table_id,
                'column_key': column_key,
                'option_name': new_name,
                'new_option_name': temp_name,
                'update_option_data': update_option_data,
            })
            already_renamed.add(new_name)
            pending_final_renames.append(updated_option)
        except Exception as e:
            logger.warning(
                f'Failed to stage rename for GitHub issue type option '
                f'"{new_name}" (connection {connection_id}): {e}'
            )

    for updated_option in pending_final_renames:
        option_id, new_name, _update_option_data, old_name = updated_option
        try:
            seadb_api.update_column_option(project_uuid, {
                'table_id': table_id,
                'column_key': column_key,
                'option_id': option_id,
                'new_option_name': new_name,
            })
            updated += 1
        except Exception as e:
            logger.warning(
                f'Failed to finalize rename for GitHub issue type option '
                f'"{old_name}" -> "{new_name}" (connection {connection_id}): {e}'
            )

    added = 0
    added_names = []
    for option_payload in need_added_options:
        try:
            seadb_api.add_column_option(project_uuid, option_payload)
            added += 1
            added_names.append(option_payload['option_name'])
        except Exception as e:
            logger.warning(
                f'Failed to add GitHub issue type "{option_payload["option_name"]}" '
                f'to SeaDB (connection {connection_id}): {e}'
            )

    return added, added_names, updated, deleted

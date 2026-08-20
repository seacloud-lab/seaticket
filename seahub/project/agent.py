import logging
import json
import requests
from urllib.parse import urlparse

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication

from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.authentication import JWTAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.models import Projects, ProjectConnections, decrypt_config
from seahub.project.github_issues_api import GitHubAPI, GitHubAppNotInstalled
from seahub.utils.decorators import require_org_context
from seahub.project.utils import (
    check_project_permission,
    collect_github_issue_type_options,
    get_current_table_metadata,
)
from seahub.project.agent_action_executor import (
    AgentActionExecutor,
    AUTO_EXECUTION_USER,
    MappingRequiredError,
)
from seahub.project.constants import ConnectionType, ExtraSourceType

from seahub.seadb_models.models import SchemaTables


logger = logging.getLogger(__name__)


def _update_action_status(seadb_api, project_uuid, action_id, row):
    """Update action status in SeaDB - shared helper for agent action views."""
    update_data = [{
        'pk': int(action_id),
        'row': row,
    }]
    seadb_api.update_rows(project_uuid, SchemaTables.AGENT_ACTIONS.table_name(), update_data)


def _update_action_status_and_refresh_run(seadb_api, project_uuid, run_id, action_id, row):
    _update_action_status(seadb_api, project_uuid, action_id, row)
    if run_id is None:
        return ''
    return _refresh_run_suggestions_status_safely(seadb_api, project_uuid, int(run_id))


def _parse_action_sources(raw_sources):
    if isinstance(raw_sources, list):
        return raw_sources
    if not raw_sources:
        return []
    if not isinstance(raw_sources, str):
        return []
    try:
        sources = json.loads(raw_sources)
    except Exception:
        return []
    return sources if isinstance(sources, list) else []

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

def _build_items_map_from_actions(actions, owner_source=None):
    """Build grouped items by owner (non-suggestion) or target (suggestion)."""
    owner_source = owner_source or {}
    items_map = {}
    for action in actions:
        if _is_suggestion_action(action):
            source_type = action.get('target_source_type', '')
            source_id = action.get('target_source_id', '')
            source_title = action.get('target_source_title', '')
            if not source_type or not source_id:
                source_type = owner_source.get('source_type', '')
                source_id = owner_source.get('source_id', '')
                source_title = owner_source.get('source_title', '')
        else:
            source_type = owner_source.get('source_type', '')
            source_id = owner_source.get('source_id', '')
            source_title = owner_source.get('source_title', '')
        key = (source_type, source_id)
        if key not in items_map:
            items_map[key] = {
                'source_type': source_type,
                'source_id': source_id,
                'source_title': source_title,
                'actions': [],
            }
        action_data = {
            'id': action['_pk'],
            'type': action.get('action_type', ''),
            'tool_name': action.get('tool_name', ''),
            'phase': action.get('phase', ''),
            'prompt': action.get('prompt', ''),
            'input': action.get('input', ''),
            'result': action.get('result', ''),
            'status': action.get('status', ''),
            'suggestion_reason': action.get('suggestion_reason', ''),
            'suggestion_title': action.get('suggestion_title', ''),
            'suggestion_content': action.get('suggestion_content', ''),
            'sources': _parse_action_sources(action.get('sources')),
            'statistics': action.get('statistics', ''),
            'created_at': action.get('created_at', ''),
            'executed_at': action.get('executed_at', ''),
        }
        action_data.update({
            'step': action.get('step'),
            'tool_arguments': action.get('tool_arguments', ''),
            'observation': action.get('observation', ''),
        })
        items_map[key]['actions'].append(action_data)

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

        actions_sql = "SELECT `_pk`, `run_id`, `target_source_type`, `target_source_id`, `target_source_title`, " \
            f"`action_type`, `tool_name`, `result`, `status`, `suggestion_reason`, `suggestion_title`, `suggestion_content`, " \
            f"`phase`, `prompt`, `input`, `statistics`, `created_at`, `executed_at`, `sources`, `step`, `tool_arguments`, `observation` FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` " \
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
    if isinstance(raw_event, list):
        return raw_event[0] if raw_event else None
    return raw_event if isinstance(raw_event, dict) else None

def _build_item_action(action):
    return {
        'id': action['_pk'],
        'type': action.get('action_type', ''),
        'tool_name': action.get('tool_name', ''),
        'result': action.get('result'),
        'status': action.get('status', ''),
        'suggestion_reason': action.get('suggestion_reason'),
        'suggestion_title': action.get('suggestion_title'),
        'suggestion_content': action.get('suggestion_content'),
        'sources': _parse_action_sources(action.get('sources')),
        'statistics': action.get('statistics'),
        'created_at': action.get('created_at'),
        'executed_at': action.get('executed_at'),
        'target_source_type': action.get('target_source_type', ''),
        'target_source_id': action.get('target_source_id', ''),
        'target_source_title': action.get('target_source_title', ''),
    }


VISIBLE_LOG_ACTION_TYPES = ('event', 'prelude', 'analysis', 'suggestion')
SUGGESTION_ACTION_TYPE = 'suggestion'
RUN_STATUS_COMPLETED = 'completed'
LOG_STATUS_DONE = 'done'
LOG_STATUS_NO_ACTION_NEEDED = 'no_action_needed'


def _identity_key(source_id='', source_type='', source_title=''):
    normalized_title = '' if source_title in (None, '') else str(source_title)
    return (
        '' if source_id is None else str(source_id),
        '' if source_type is None else str(source_type),
        normalized_title,
    )


def _log_group_key(row):
    return _identity_key(
        row.get('owner_source_id', ''),
        row.get('owner_source_type', ''),
        row.get('owner_source_title', ''),
    )


def _is_suggestion_action(action):
    return action.get('action_type', '') == SUGGESTION_ACTION_TYPE


def _is_ticket_source(source_type):
    return source_type == ExtraSourceType.TICKET.value


def _build_owner_identity_predicate(owner_source_id, owner_source_type, owner_source_title=None, with_title=False):
    if not with_title:
        return "`owner_source_id` = ? AND `owner_source_type` = ?", [owner_source_id, owner_source_type]
    if owner_source_title not in (None, ''):
        return (
            "(`owner_source_id` = ? AND `owner_source_type` = ? AND `owner_source_title` = ?)",
            [owner_source_id, owner_source_type, owner_source_title],
        )
    return (
        "(`owner_source_id` = ? AND `owner_source_type` = ? "
        "AND (`owner_source_title` IS NULL OR `owner_source_title` = ''))",
        [owner_source_id, owner_source_type],
    )


def _query_owned_runs(seadb_api, project_uuid, owner_source_id, owner_source_type):
    runs_table = SchemaTables.AGENT_RUNS.table_name()
    source_filter, source_params = _build_owner_identity_predicate(owner_source_id, owner_source_type)
    sql = (
        "SELECT `_pk`, `status`, `suggestions_status`, `started_at`, "
        "`finished_at`, `error_message`, `event`, "
        "`owner_source_type`, `owner_source_id`, `owner_source_title` "
        f"FROM `{runs_table}` "
        f"WHERE {source_filter} "
        "ORDER BY `_pk` ASC"
    )
    result = seadb_api.query_rows(project_uuid, sql, params=source_params)
    return result.get('results', [])


def _query_runs_by_log_owners(seadb_api, project_uuid, logs):
    if not logs:
        return {}

    runs_table = SchemaTables.AGENT_RUNS.table_name()
    source_filters = []
    source_params = []
    runs_by_log = {
        _log_group_key(log): []
        for log in logs
    }

    for log in logs:
        source_filter, params = _build_owner_identity_predicate(
            log.get('owner_source_id', ''),
            log.get('owner_source_type', ''),
            log.get('owner_source_title', ''),
            with_title=True,
        )
        source_filters.append(source_filter)
        source_params.extend(params)

    if not source_filters:
        return runs_by_log

    sql = (
        "SELECT `_pk`, `status`, `suggestions_status`, "
        "`owner_source_id`, `owner_source_type`, `owner_source_title` "
        f"FROM `{runs_table}` "
        f"WHERE {' OR '.join(source_filters)} "
        "LIMIT 0, 10000"
    )
    result = seadb_api.query_rows(project_uuid, sql, params=source_params)
    for row in result.get('results', []):
        key = _log_group_key(row)
        if key in runs_by_log:
            runs_by_log[key].append(row)
    return runs_by_log


def _query_log_summary_rows(seadb_api, project_uuid, page, per_page):
    offset = (page - 1) * per_page
    runs_table = SchemaTables.AGENT_RUNS.table_name()
    sql = (
        "SELECT `owner_source_id`, `owner_source_type`, `owner_source_title`, "
        "COUNT(*) AS `num_of_runs`, "
        "MAX(`started_at`) AS `last_active_at` "
        f"FROM `{runs_table}` "
        "GROUP BY `owner_source_id`, `owner_source_type`, `owner_source_title` "
        "ORDER BY `last_active_at` DESC, `owner_source_type` DESC "
        f"LIMIT {offset}, {per_page + 1}"
    )
    result = seadb_api.query_rows(project_uuid, sql)
    return result.get('results', [])


def _calculate_suggestions_status(suggestion_statuses):
    normalized_statuses = [
        str(action_status or '').strip()
        for action_status in suggestion_statuses
        if action_status is not None
    ]
    if not normalized_statuses:
        return 'none'
    if any(action_status in ('pending', 'executing') for action_status in normalized_statuses):
        return 'pending'
    if any(action_status == 'failed' for action_status in normalized_statuses):
        return 'failed'
    return 'resolved'


def _refresh_run_suggestions_status(seadb_api, project_uuid, run_id):
    actions_table = SchemaTables.AGENT_ACTIONS.table_name()
    runs_table = SchemaTables.AGENT_RUNS.table_name()
    suggestion_sql = (
        "SELECT `status` "
        f"FROM `{actions_table}` "
        f"WHERE `run_id` = {int(run_id)} AND `action_type` = '{SUGGESTION_ACTION_TYPE}' "
        "LIMIT 0, 10000"
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


def _refresh_run_suggestions_status_safely(seadb_api, project_uuid, run_id):
    try:
        return _refresh_run_suggestions_status(seadb_api, project_uuid, run_id)
    except Exception:
        logger.exception(
            'Failed to refresh suggestions_status for project %s run %s.',
            project_uuid,
            run_id,
        )
        return ''


def _calculate_log_status(runs):
    if not runs:
        return ''
    if any(run.get('status') != RUN_STATUS_COMPLETED for run in runs):
        return ''

    suggestions_statuses = [str(run.get('suggestions_status', '') or '').strip() for run in runs]
    if any(suggestions_status in ('', 'pending', 'failed') for suggestions_status in suggestions_statuses):
        return ''
    if any(suggestions_status == 'resolved' for suggestions_status in suggestions_statuses):
        return LOG_STATUS_DONE
    if all(suggestions_status == 'none' for suggestions_status in suggestions_statuses):
        return LOG_STATUS_NO_ACTION_NEEDED
    return ''


def list_agent_logs(seadb_api, project_uuid, page=1, per_page=20):
    summary_rows = _query_log_summary_rows(seadb_api, project_uuid, page, per_page)
    has_more = len(summary_rows) > per_page
    if has_more:
        summary_rows = summary_rows[:per_page]

    logs = [{
        'owner_source_id': log.get('owner_source_id', ''),
        'owner_source_type': log.get('owner_source_type', ''),
        'owner_source_title': log.get('owner_source_title', ''),
        'num_of_runs': log.get('num_of_runs', 0),
        'last_active_at': log.get('last_active_at'),
        'status': '',
    } for log in summary_rows]

    _populate_agent_log_statuses(seadb_api, project_uuid, logs)

    return {
        'logs': logs,
        'has_more': has_more,
    }


def _populate_agent_log_statuses(seadb_api, project_uuid, logs):
    if not logs:
        return
    runs_by_log = _query_runs_by_log_owners(seadb_api, project_uuid, logs)
    for log in logs:
        log['status'] = _calculate_log_status(runs_by_log.get(_log_group_key(log), []))


def _query_log_actions_by_runs(
    seadb_api,
    project_uuid,
    run_ids,
    owner_source_id,
    owner_source_type,
    include_all_suggestions,
):
    if not run_ids:
        return []
    actions_table = SchemaTables.AGENT_ACTIONS.table_name()
    run_ids_str = ','.join(map(str, run_ids))
    action_types_str = ','.join(f"'{action_type}'" for action_type in VISIBLE_LOG_ACTION_TYPES)
    action_params = None
    visibility_filter = "`action_type` != 'suggestion'"
    if include_all_suggestions:
        visibility_filter = '1 = 1'
    else:
        visibility_filter = (
            "`action_type` != 'suggestion' "
            "OR (`target_source_id` = ? AND `target_source_type` = ?)"
        )
        action_params = [str(owner_source_id), owner_source_type]

    sql = (
        "SELECT `_pk`, `run_id`, `action_type`, `tool_name`, `result`, `status`, "
        "`suggestion_reason`, `suggestion_title`, `suggestion_content`, `sources`, "
        "`target_source_type`, `target_source_id`, `target_source_title`, "
        "`created_at`, `executed_at` "
        f"FROM `{actions_table}` "
        f"WHERE `run_id` IN ({run_ids_str}) "
        f"AND `action_type` IN ({action_types_str}) "
        f"AND ({visibility_filter}) "
        "ORDER BY `run_id` ASC, `_pk` ASC"
    )
    result = seadb_api.query_rows(project_uuid, sql, params=action_params)
    return result.get('results', [])


def get_agent_log_runs(seadb_api, project_uuid, owner_source_id, owner_source_type):
    runs = _query_owned_runs(seadb_api, project_uuid, owner_source_id, owner_source_type)
    if not runs:
        raise ValueError('Item not found.')

    run_ids = [int(run['_pk']) for run in runs if run.get('_pk') is not None]
    actions = _query_log_actions_by_runs(
        seadb_api,
        project_uuid,
        run_ids,
        owner_source_id,
        owner_source_type,
        include_all_suggestions=_is_ticket_source(owner_source_type),
    )

    actions_by_run = {}
    for action in actions:
        run_id = action.get('run_id')
        if run_id is None:
            continue
        run_id = int(run_id)
        actions_by_run.setdefault(run_id, []).append(_build_item_action(action))

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


class AgentLogsView(APIView):
    """
    List logs processed by the agent.
    GET /api/v1/project/<project_uuid>/agent/logs/
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
        except ValueError:
            page = 1
            per_page = 20
        if page < 1:
            page = 1
        if per_page < 1:
            per_page = 20

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            result = list_agent_logs(SeaDBAPI(), project_uuid, page, per_page)
        except Exception as e:
            logger.error(f'Error listing agent items: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(result, status=status.HTTP_200_OK)


class AgentLogRunsView(APIView):
    """
    List all runs and actions for a log.
    GET /api/v1/project/<project_uuid>/agent/log/runs/?owner_source_id=<id>&owner_source_type=<type>
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        owner_source_id = request.GET.get('owner_source_id')
        if not owner_source_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'owner_source_id is required.')
        owner_source_type = request.GET.get('owner_source_type')
        if not owner_source_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'owner_source_type is required.')
        valid_source_types = (
            {item.value for item in ConnectionType}
            | {item.value for item in ExtraSourceType}
        )
        if owner_source_type not in valid_source_types:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid owner_source_type.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            result = get_agent_log_runs(SeaDBAPI(), project_uuid, owner_source_id, owner_source_type)
        except ValueError as e:
            logger.error(f'Error getting agent log runs: {e}')
            return api_error(status.HTTP_404_NOT_FOUND, str(e))
        except Exception as e:
            logger.error(f'Error getting agent log runs: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(result, status=status.HTTP_200_OK)


class AgentRunDetailView(APIView):
    """
    Get agent run detail with actions.
    GET /api/v1/project/<project_uuid>/agent/runs/<run_id>/
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, run_id):
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI()
            result = get_agent_run_detail(seadb_api, project_uuid, run_id)
        except ValueError as e:
            logger.error(f'Error getting agent run detail: {e}')
            return api_error(status.HTTP_404_NOT_FOUND, str(e))
        except Exception as e:
            logger.error(f'Error getting agent run detail: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(result, status=status.HTTP_200_OK)

class AgentActionConfirmView(APIView):
    """
    Confirm an agent action.

    When user confirms a pending action:
    1. Read action details from SeaDB
    2. Move the action to executing before side effects
    3. Execute the actual operation based on tool_name
    4. Update action status directly in SeaDB

    POST /api/v1/project/<project_uuid>/agent/runs/<run_id>/actions/<action_id>/confirm/
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request, project_uuid, run_id, action_id):
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        linked_github_issues_to_close = request.data.get('linked_github_issues_to_close') or []
        if isinstance(linked_github_issues_to_close, str):
            try:
                linked_github_issues_to_close = json.loads(linked_github_issues_to_close)
            except Exception:
                linked_github_issues_to_close = []
        try:
            seadb_api = SeaDBAPI()

            # 1. Get action details from SeaDB
            sql = "SELECT `_pk`, `run_id`, `status`, `tool_name`, `target_source_type`, `target_source_id`, `suggestion_title`, `suggestion_content` " \
                f"FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` WHERE `_pk` = {action_id}"
            result = seadb_api.query_rows(project_uuid, sql)
            actions = result.get('results', [])

            if not actions:
                return api_error(status.HTTP_404_NOT_FOUND, 'Action not found.')

            action = actions[0]
            action_run_id = int(action['run_id'])

            # 2. Verify the action belongs to the specific run
            if action_run_id != int(run_id):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action does not belong to the specified run.')

            if action['status'] == 'executing':
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is already executing.')

            if action['status'] != 'pending':
                return api_error(status.HTTP_400_BAD_REQUEST, f'Action is not pending: {action["status"]}')

            _update_action_status_and_refresh_run(
                seadb_api,
                project_uuid,
                action_run_id,
                action_id,
                {'status': 'executing'},
            )

            # 3. Dispatch to the appropriate handler based on source_type and tool_name
            try:
                execution = AgentActionExecutor().execute_action(
                    seadb_api=seadb_api,
                    project=project,
                    project_uuid=project_uuid,
                    action=action,
                    operator=username,
                    linked_github_issues_to_close=linked_github_issues_to_close,
                    request=request,
                )
            except MappingRequiredError as mapping_error:
                suggestions_status = _update_action_status_and_refresh_run(
                    seadb_api,
                    project_uuid,
                    action_run_id,
                    action_id,
                    {'status': 'pending'},
                )
                return self._mapping_required_response(
                    seadb_api,
                    project_uuid,
                    mapping_error,
                    suggestions_status=suggestions_status,
                )
            except Exception as e:
                logger.exception(
                    'Failed to execute confirm action %s for project %s run %s: %s',
                    action_id,
                    project_uuid,
                    run_id,
                    e,
                )
                execution = AgentActionExecutor._failed_execution(str(e) or 'Action execution failed.')

            # 4. Update action status in SeaDB
            now = timezone.now().isoformat()
            suggestions_status = _update_action_status_and_refresh_run(
                seadb_api,
                project_uuid,
                action_run_id,
                action_id,
                {
                    'status': execution['status'],
                    'result': execution['result'],
                    'executed_at': now,
                },
            )

            return Response({
                'success': execution['success'],
                'action_id': action_id,
                'status': execution['status'],
                'result': execution['result'],
                'suggestions_status': suggestions_status,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def _mapping_required_response(self, seadb_api, project_uuid, error, suggestions_status=''):
        issue_types = collect_github_issue_type_options(
            seadb_api, project_uuid, [error.connection_id]
        )
        return Response({
            'error_code': 'mapping_required',
            'agent_type': error.agent_type,
            'github_issue_types': issue_types,
            'suggestions_status': suggestions_status,
        }, status=status.HTTP_400_BAD_REQUEST)


class AgentActionAutoExecuteView(APIView):
    """
    Auto-execute one or more agent actions triggered by seaqa-ai.

    POST /api/v1/internal/agent/auto-action/execute/
    body: {project_uuid, action_ids: [...]}

    This endpoint is for internal service-to-service calls only.
    It uses request-level JWT authentication. Actions are executed
    independently; a failure on one does not affect the others.
    """
    authentication_classes = (JWTAuthentication, )

    def post(self, request):
        project_uuid = (request.data.get('project_uuid') or '').strip()
        action_ids = request.data.get('action_ids')

        if not project_uuid or not action_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, 'project_uuid and action_ids are required.')

        if not isinstance(action_ids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'action_ids must be a list.')

        normalized_ids = []
        for raw_id in action_ids:
            try:
                normalized_ids.append(int(raw_id))
            except (ValueError, TypeError):
                return api_error(status.HTTP_400_BAD_REQUEST, f'Invalid action_id: {raw_id!r}')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        seadb_api = SeaDBAPI()
        auto_confirm_map = AgentActionExecutor.get_effective_auto_confirm_map(project)

        results = []
        for action_id in normalized_ids:
            results.append(
                self._execute_one(
                    seadb_api, project, project_uuid, action_id,
                    auto_confirm_map,
                )
            )

        return Response({
            'success': True,
            'results': results,
        }, status=status.HTTP_200_OK)

    def _execute_one(self, seadb_api, project, project_uuid, action_id, auto_confirm_map):
        """Execute a single auto action. Returns a per-action result dict.

        Never raises; any error is captured into the returned dict so the
        batch loop can continue with the remaining actions.
        """
        # 1. Get action details
        sql = (
            "SELECT `_pk`, `run_id`, `status`, `tool_name`, `target_source_type`, `target_source_id`, "
            "`suggestion_title`, `suggestion_content` "
            f"FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` WHERE `_pk` = {action_id} LIMIT 1"
        )
        result = seadb_api.query_rows(project_uuid, sql)
        rows = result.get('results', [])
        if not rows:
            return {
                'action_id': action_id,
                'success': False,
                'status': 'not_found',
                'result': 'Action not found.',
            }

        action = rows[0]
        run_id = int(action.get('run_id'))

        # 2. Idempotency check: only process pending actions
        action_status = (action.get('status') or '').strip()
        if action_status != 'pending':
            return {
                'action_id': action_id,
                'success': True,
                'status': action_status,
                'result': 'Skipped: action is not pending.',
                'suggestions_status': _refresh_run_suggestions_status_safely(
                    seadb_api, project_uuid, run_id
                ),
            }

        tool_name = (action.get('tool_name') or '').strip()

        # 3. Verify auto_confirm is still enabled for this tool
        if not auto_confirm_map.get(tool_name, False):
            return {
                'action_id': action_id,
                'success': False,
                'status': 'pending',
                'result': 'Skipped: tool is not enabled for auto-confirm.',
                'suggestions_status': _refresh_run_suggestions_status_safely(
                    seadb_api, project_uuid, run_id
                ),
            }

        # 4. Move to executing (concurrency guard)
        _update_action_status_and_refresh_run(
            seadb_api,
            project_uuid,
            run_id,
            action_id,
            {'status': 'executing'},
        )

        # 5. Execute action
        try:
            execution = AgentActionExecutor().execute_action(
                seadb_api=seadb_api,
                project=project,
                project_uuid=project_uuid,
                action=action,
                operator=AUTO_EXECUTION_USER,
                auto_executed=True,
                request=None,
            )
        except MappingRequiredError as e:
            # Auto-execution cannot prompt for mapping; keep pending for manual handling
            suggestions_status = _update_action_status_and_refresh_run(
                seadb_api,
                project_uuid,
                run_id,
                action_id,
                {
                    'status': 'pending',
                    'result': f'Mapping required for agent type: {e.agent_type}',
                    'executed_at': timezone.now().isoformat(),
                },
            )
            return {
                'action_id': action_id,
                'success': False,
                'status': 'pending',
                'result': f'Mapping required for agent type: {e.agent_type}',
                'suggestions_status': suggestions_status,
            }
        except Exception as e:
            logger.exception(
                'Auto action execution failed for action %s project %s: %s',
                action_id,
                project_uuid,
                e,
            )
            execution = AgentActionExecutor._failed_execution(str(e) or 'Action execution failed.')

        # 7. Update action status
        now = timezone.now().isoformat()
        suggestions_status = _update_action_status_and_refresh_run(
            seadb_api,
            project_uuid,
            run_id,
            action_id,
            {
                'status': execution['status'],
                'result': execution['result'],
                'executed_at': now,
            },
        )

        return {
            'action_id': action_id,
            'success': execution['success'],
            'status': execution['status'],
            'result': execution['result'],
            'suggestions_status': suggestions_status,
        }


class AgentActionUpdateView(APIView):
    """
    Update a pending agent action's content.
    PATCH /api/v1/project/<project_uuid>/agent/runs/<run_id>/actions/<action_id>/
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def patch(self, request, project_uuid, run_id, action_id):
        suggestion_content = request.data.get('suggestion_content')
        if suggestion_content is None:
            return api_error(status.HTTP_400_BAD_REQUEST, 'suggestion_content is required.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            seadb_api = SeaDBAPI()
            sql = "SELECT `run_id`, `status` " \
                f"FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` WHERE `_pk` = {action_id}"
            result = seadb_api.query_rows(project_uuid, sql)
            actions = result.get('results', [])

            if not actions:
                return api_error(status.HTTP_404_NOT_FOUND, 'Action not found.')

            action = actions[0]
            if action.get('run_id') != int(run_id):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action does not belong to the specified run.')

            if action.get('status') != 'pending':
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is not pending.')

            update_data = [{
                'pk': int(action_id),
                'row': {'suggestion_content': str(suggestion_content)}
            }]
            seadb_api.update_rows(project_uuid, SchemaTables.AGENT_ACTIONS.table_name(), update_data)

            return Response({
                'success': True,
                'action_id': action_id,
                'suggestion_content': suggestion_content,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class AgentActionCancelView(APIView):
    """
    Cancel a pending agent action.

    POST /api/v1/project/<project_uuid>/agent/runs/<run_id>/actions/<action_id>/cancel/
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid, run_id, action_id):
        username = request.user.username

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            seadb_api = SeaDBAPI()

            # Get action details
            action_sql = "SELECT `run_id`, `status` " \
                f"FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` WHERE `_pk` = {action_id}"
            result = seadb_api.query_rows(project_uuid, action_sql)
            actions = result.get('results', [])

            if not actions:
                return api_error(status.HTTP_404_NOT_FOUND, 'Action not found.')

            action = actions[0]
            action_run_id = int(action.get('run_id'))

            if action_run_id != int(run_id):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action does not belong to this run.')

            if action.get('status') != 'pending':
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is not pending.')

            # Update action status to cancelled
            now = timezone.now().isoformat()
            nickname = email2nickname(username)
            result_message = f'Cancelled by {nickname}'
            suggestions_status = _update_action_status_and_refresh_run(
                seadb_api,
                project_uuid,
                action_run_id,
                action_id,
                {
                    'status': 'cancelled',
                    'result': result_message,
                    'executed_at': now,
                }
            )
            return Response({
                'success': True,
                'action_id': action_id,
                'status': 'cancelled',
                'result': result_message,
                'suggestions_status': suggestions_status,
            })

        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class GithubIssueTypesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        try:
            project = Projects.objects.get_project_by_uuid(project_uuid)
            if not project:
                return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

            username = request.user.username
            if not check_project_permission(username, project.workspace.owner):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

            connections = list(ProjectConnections.objects.filter(
                project_uuid=project_uuid,
                type='github_issue',
                deleted=False,
                is_active=True
            ).order_by('id'))
            if not connections:
                return Response({
                    'issue_types': [],
                    'warning': 'no_github_connection',
                }, status=status.HTTP_200_OK)

            seadb_api = SeaDBAPI()
            issue_types = collect_github_issue_type_options(
                seadb_api, project_uuid, [c.id for c in connections]
            )
            return Response({'issue_types': issue_types}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @require_org_context
    def post(self, request, project_uuid):
        """Pull the latest issue types from GitHub for the first active GitHub connection."""
        try:
            project = Projects.objects.get_project_by_uuid(project_uuid)
            if not project:
                return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

            username = request.user.username
            if not check_project_permission(username, project.workspace.owner):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

            connections = list(ProjectConnections.objects.filter(
                project_uuid=project_uuid,
                type='github_issue',
                deleted=False,
                is_active=True
            ).order_by('id'))
            if not connections:
                return api_error(
                    status.HTTP_400_BAD_REQUEST,
                    'No active GitHub connection found for this project.'
                )

            connection = connections[0]
            try:
                config = decrypt_config(json.loads(connection.config))
            except Exception as e:
                logger.warning(f'Invalid config for connection {connection.id}: {e}')
                return api_error(
                    status.HTTP_400_BAD_REQUEST,
                    'Invalid GitHub connection config.'
                )
            installation_id = config.get('installation_id')
            repository = config.get('repository')
            if not installation_id or not repository:
                return api_error(
                    status.HTTP_400_BAD_REQUEST,
                    'Invalid GitHub connection config.'
                )
            try:
                path = urlparse(repository).path
                parts = path.strip('/').split('/')
                owner, repo = parts[0], parts[1]
            except Exception as e:
                logger.warning(
                    f'Invalid GitHub repository URL for connection {connection.id}: {e}'
                )
                return api_error(
                    status.HTTP_400_BAD_REQUEST,
                    'Invalid GitHub repository URL.'
                )

            seadb_api = SeaDBAPI()
            try:
                github_api = GitHubAPI(installation_id=installation_id)
            except GitHubAppNotInstalled:
                logger.warning(
                    f'GitHub App is not installed for connection {connection.id}.'
                )
                return api_error(
                    status.HTTP_400_BAD_REQUEST,
                    'GitHub App is not installed.'
                )
            try:
                added, added_names, updated, deleted = _sync_issue_type_column_options(
                    seadb_api, project_uuid, connection.id, github_api, owner, repo
                )
            except requests.HTTPError as e:
                logger.warning(
                    f'Failed to fetch issue types from GitHub for connection '
                    f'{connection.id}: {e}'
                )
                return api_error(
                    status.HTTP_502_BAD_GATEWAY,
                    f'Failed to fetch issue types from GitHub: {e}'
                )

            issue_types = collect_github_issue_type_options(
                seadb_api, project_uuid, [c.id for c in connections]
            )
            return Response({
                'added': added,
                'added_names': added_names,
                'updated': updated,
                'deleted': deleted,
                'issue_types': issue_types,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

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

def _sync_issue_type_column_options(seadb_api, project_uuid, connection_id, github_api, owner, repo):
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

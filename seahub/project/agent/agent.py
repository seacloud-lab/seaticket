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
)
from seahub.project.agent.action_executor import (
    AgentActionExecutor,
    AUTO_EXECUTION_USER,
    MappingRequiredError,
)
from seahub.project.constants import ConnectionType, ExtraSourceType
from seahub.seadb_models.models import SchemaTables
from seahub.project.agent.utils import (
    ACTION_STATUS_PENDING,
    ACTION_STATUS_EXECUTING,
    ACTION_STATUS_CANCELLED,
    update_action_status_and_refresh_run,
    refresh_run_suggestions_status_safely,
    sync_issue_type_column_options,
    get_agent_run_detail,
    get_agent_log_runs,
    list_agent_logs,
    LOG_STATUS,
    cancel_agent_log_pending_actions,
)


logger = logging.getLogger(__name__)


class AgentLogsView(APIView):
    """
    List logs processed by the agent.
    GET /api/v1/project/<project_uuid>/agent/logs/?status=<processed|unprocessed>
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
        log_status = request.GET.get('status', '')
        if log_status and log_status not in LOG_STATUS:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Status is invalid.')
        cursor = request.GET.get('cursor')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            result = list_agent_logs(SeaDBAPI(), project_uuid, page, per_page, log_status, cursor)
        except ValueError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, str(e))
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


class AgentLogCancelAllActionsView(APIView):
    """Cancel all pending actions for the runs owned by one log item."""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request, project_uuid, owner_source_type, owner_source_id):
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
            result = cancel_agent_log_pending_actions(
                SeaDBAPI(),
                project_uuid,
                owner_source_id,
                owner_source_type,
                f'Cancelled by {email2nickname(username)}',
                timezone.now().isoformat(),
            )
        except ValueError as e:
            return api_error(status.HTTP_404_NOT_FOUND, str(e))
        except Exception as e:
            logger.exception('Error cancelling agent log actions: %s', e)
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
            sql = "SELECT `_pk`, `run_id`, `status`, `tool_name`, `target_item_type`, `target_item_id`, `suggestion_content`, `suggestion_payload` " \
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

            if action['status'] == ACTION_STATUS_EXECUTING:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is already executing.')

            if action['status'] != ACTION_STATUS_PENDING:
                return api_error(status.HTTP_400_BAD_REQUEST, f'Action is not pending: {action["status"]}')

            update_action_status_and_refresh_run(
                seadb_api,
                project_uuid,
                action_run_id,
                action_id,
                {'status': ACTION_STATUS_EXECUTING},
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
                suggestions_status = update_action_status_and_refresh_run(
                    seadb_api,
                    project_uuid,
                    action_run_id,
                    action_id,
                    {'status': ACTION_STATUS_PENDING},
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
            suggestions_status = update_action_status_and_refresh_run(
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
            "SELECT `_pk`, `run_id`, `status`, `tool_name`, `target_item_type`, `target_item_id`, "
            "`suggestion_content`, `suggestion_payload` "
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
        if action_status != ACTION_STATUS_PENDING:
            return {
                'action_id': action_id,
                'success': True,
                'status': action_status,
                'result': 'Skipped: action is not pending.',
                'suggestions_status': refresh_run_suggestions_status_safely(
                    seadb_api, project_uuid, run_id
                ),
            }

        tool_name = (action.get('tool_name') or '').strip()

        # 3. Verify auto_confirm is still enabled for this tool
        if not auto_confirm_map.get(tool_name, False):
            return {
                'action_id': action_id,
                'success': False,
                'status': ACTION_STATUS_PENDING,
                'result': 'Skipped: tool is not enabled for auto-confirm.',
                'suggestions_status': refresh_run_suggestions_status_safely(
                    seadb_api, project_uuid, run_id
                ),
            }

        # 4. Move to executing (concurrency guard)
        update_action_status_and_refresh_run(
            seadb_api,
            project_uuid,
            run_id,
            action_id,
            {'status': ACTION_STATUS_EXECUTING},
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
            suggestions_status = update_action_status_and_refresh_run(
                seadb_api,
                project_uuid,
                run_id,
                action_id,
                {
                    'status': ACTION_STATUS_PENDING,
                    'result': f'Mapping required for agent type: {e.agent_type}',
                    'executed_at': timezone.now().isoformat(),
                },
            )
            return {
                'action_id': action_id,
                'success': False,
                'status': ACTION_STATUS_PENDING,
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
        suggestions_status = update_action_status_and_refresh_run(
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

            if action.get('status') != ACTION_STATUS_PENDING:
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

            if action.get('status') != ACTION_STATUS_PENDING:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is not pending.')

            # Update action status to cancelled
            now = timezone.now().isoformat()
            nickname = email2nickname(username)
            result_message = f'Cancelled by {nickname}'
            suggestions_status = update_action_status_and_refresh_run(
                seadb_api,
                project_uuid,
                action_run_id,
                action_id,
                {
                    'status': ACTION_STATUS_CANCELLED,
                    'result': result_message,
                    'executed_at': now,
                }
            )
            return Response({
                'success': True,
                'action_id': action_id,
                'status': ACTION_STATUS_CANCELLED,
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
                added, added_names, updated, deleted = sync_issue_type_column_options(
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

import logging
import json
from datetime import datetime, timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils.ai_client import (
    get_agent_run_detail,
    list_agent_runs,
    trigger_agent,
)
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.models import Projects
from seahub.tickets.ticket_utils import get_ticket
from seahub.seadb_models.models import AgentActionsTable, TicketCommentsTable, TicketsTable
from seahub.utils.decorators import require_org_context
from seahub.project.utils import check_project_permission
from seahub.notifications.signal_handler import (
    MSG_TYPE_AGENT_NOTIFY_ASSIGNEE,
    MSG_TYPE_TICKET_COMMENTED,
)
from seahub.tickets.signals import agent_notify_assignees, ticket_commented

logger = logging.getLogger(__name__)


class AgentExecuteView(APIView):
    """
    Trigger agent execution manually for a project.
    POST /api/v1/project/<project_uuid>/agent/execute/
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        username = request.user.username

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            result = trigger_agent(project_uuid)
            return Response(result)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

class AgentRunsView(APIView):
    """
    List agent runs for a project.
    GET /api/v1/project/<project_uuid>/agent/runs/
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        # argument check
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 50))
        except ValueError:
            page = 1
            per_page = 50

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
            result = list_agent_runs(project_uuid, page, per_page)
        except Exception as e:
            logger.error(f'Error listing agent runs: {e}')
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
            result = get_agent_run_detail(project_uuid, run_id)
        except Exception as e:
            logger.error(f'Error getting agent run detail: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(result, status=status.HTTP_200_OK)

class AgentActionConfirmView(APIView):
    """
    Confirm an agent action.

    When user confirms a pending action:
    1. Read action details from SeaDB
    2. Execute the actual operation based on tool_name
    3. Update action status directly in SeaDB

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
        try:
            seadb_api = SeaDBAPI(username)
            
            # 1. Get action details from SeaDB
            sql = f"SELECT * FROM `{AgentActionsTable.gen_table_name()}` WHERE `_pk` = {action_id}"
            result = seadb_api.query_rows(project_uuid, sql)
            actions = result.get('results', [])

            if not actions:
                return api_error(status.HTTP_404_NOT_FOUND, 'Action not found.')

            action = actions[0]

            # 2. Verify the action belongs to the specific run
            if action['run_id'] != int(run_id):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action does not belong to the specified run.')
            
            if action['status'] != 'pending':
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is not pending.')

            tool_name = action['tool_name']
            ticket_id = action['ticket_id']
            content = action['content']

            # 3. Execute the actual operation based on tool_name
            if tool_name == 'notify_assignee':
                execution_result = self._execute_notify_assignee(
                    seadb_api, project,project_uuid, ticket_id, content, username
                )
            elif tool_name == 'add_comment':
                execution_result = self._execute_add_comment(
                    seadb_api, project, project_uuid, ticket_id, content, username
                )
            elif tool_name == 'final_answer':
                # final_answer doesn't need actual execution, just mark as confirmed
                execution_result = 'Analysis completed.'
            else:
                logger.error(f'Unknown tool name: {tool_name}')
                execution_result = 'Unknown tool name.'

            # 4. Update action status in SeaDB
            now = datetime.now(timezone.utc).isoformat()
            update_data = [{
                'pk': int(action_id),
                'row': {
                    'status': 'executed',
                    'result': execution_result or 'Success',
                    'executed_at': now,
                }
            }]
            seadb_api.update_rows(project_uuid, AgentActionsTable.gen_table_name(), update_data)

            return Response({
                'success': True,
                'action_id': action_id,
                'status': 'executed',
                'result': execution_result,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def _execute_notify_assignee(self, seadb_api, project, project_uuid, ticket_id, message, operator):
        """
        Send notification to ticket assignees via ProjectNotification system.
        """
        ticket, _ = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            logger.warning(f'Ticket {ticket_id} not found in project {project_uuid}')
            return f'Ticket #{ticket_id} not found'

        assignees = ticket.get(TicketsTable.assignees.name) or []
        if not assignees:
            logger.info(f'Ticket #{ticket_id} has no assignees, skip notify.')
            return f'Ticket #{ticket_id} has no assignees'

        agent_notify_assignees.send(
            sender=None,
            project_uuid=project_uuid,
            assignees=assignees,
            msg_type=MSG_TYPE_AGENT_NOTIFY_ASSIGNEE,
            from_user_id=operator,
            ticket_id=ticket_id,
            ticket_title=ticket.get(TicketsTable.title.name),
            message=message,
            workspace_id=project.workspace_id,
            project_name=project.project_name,
        )

        logger.info(f'Agent notified assignees for ticket #{ticket_id}')
        return f'Notification sent to {len(assignees)} assignee(s).'

    def _execute_add_comment(self, seadb_api, project, project_uuid, ticket_id, content, creator):
        """
        Add a comment to the ticket.
        """
        ticket, _ = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            logger.warning(f'Ticket {ticket_id} not found in project {project_uuid}')
            return f'Ticket #{ticket_id} not found'

        now = datetime.now(timezone.utc).isoformat()

        row = {
            TicketCommentsTable.ticket_id.name: ticket_id,
            TicketCommentsTable.content.name: content,
            TicketCommentsTable.creator.name: creator,
            TicketCommentsTable.created_time.name: now,
            TicketCommentsTable.modified_time.name: now,
            TicketCommentsTable.deleted.name: False,
        }

        try:
            result = seadb_api.insert_rows(project_uuid, TicketCommentsTable.gen_table_name(), [row])
            pks = result.get('pks', [])
            if len(pks) != 1:
                raise RuntimeError('Failed to create ticket comment')
            comment_id = pks[0]

            # Keep ticket counters/participants in sync, same as tickets.py.
            count_sql = (
                f"SELECT COUNT(*) as count FROM `{TicketCommentsTable.gen_table_name()}` "
                f"WHERE `ticket_id` = {ticket_id} AND `deleted` = False"
            )
            ticket_comments_count = seadb_api.query_rows(project_uuid, count_sql).get('results')[0].get('count')
            participants = ticket.get(TicketsTable.participants.name) or []
            if creator not in participants:
                participants.append(creator)

            ticket_update = {
                'pk': ticket_id,
                'row': {
                    TicketsTable.comment_count.name: ticket_comments_count,
                    TicketsTable.modified_time.name: now,
                    TicketsTable.participants.name: participants,
                }
            }
            seadb_api.update_rows(project_uuid, TicketsTable.gen_table_name(), [ticket_update])

            # Notify related users (assignees + participants), same as tickets.py.
            assignees = ticket.get(TicketsTable.assignees.name) or []
            related_users = set(assignees) | set(participants)
            if related_users:
                ticket_commented.send(
                    sender=None,
                    project_uuid=project_uuid,
                    related_users=list(related_users),
                    msg_type=MSG_TYPE_TICKET_COMMENTED,
                    from_user_id=creator,
                    ticket_id=ticket_id,
                    comment_id=comment_id,
                    comment_content=(content or '')[:100],
                    ticket_title=ticket.get(TicketsTable.title.name),
                    workspace_id=project.workspace_id,
                    project_name=project.project_name,
                )

            logger.info(f'Added agent comment #{comment_id} to ticket #{ticket_id}')
            return f'Comment added (ID: {comment_id})'
        except Exception as e:
            logger.error(f'Failed to add comment to ticket #{ticket_id}: {e}')
            raise

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
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        content = request.data.get('content')
        if content is None:
            return api_error(status.HTTP_400_BAD_REQUEST, 'content is required.')

        try:
            seadb_api = SeaDBAPI(username)
            sql = f"SELECT * FROM `{AgentActionsTable.gen_table_name()}` WHERE `_pk` = {action_id}"
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
                'row': {'content': str(content)}
            }]
            seadb_api.update_rows(project_uuid, AgentActionsTable.gen_table_name(), update_data)

            return Response({
                'success': True,
                'action_id': action_id,
                'content': content,
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

        # Verify project exists
        try:
            project = Projects.objects.get(uuid=project_uuid, deleted=False)
        except Projects.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        try:
            seadb_api = SeaDBAPI(username)

            # Get action details
            action_sql = f"SELECT * FROM `{AgentActionsTable.gen_table_name()}` WHERE `_pk` = {action_id}"
            result = seadb_api.query_rows(project_uuid, action_sql)
            actions = result.get('results', [])

            if not actions:
                return api_error(status.HTTP_404_NOT_FOUND, 'Action not found.')

            action = actions[0]

            if action.get('run_id') != int(run_id):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action does not belong to this run.')

            if action.get('status') != 'pending':
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is not pending.')

            # Update action status to cancelled
            now = datetime.now(timezone.utc).isoformat()
            update_data = [{
                'pk': int(action_id),
                'row': {
                    'status': 'cancelled',
                    'result': f'Cancelled by {username}',
                    'executed_at': now,
                }
            }]
            seadb_api.update_rows(project_uuid, AgentActionsTable.gen_table_name(), update_data)
            return Response({
                'success': True,
                'action_id': action_id,
                'status': 'cancelled',
            })

        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class AgentSettingsView(APIView):
    """
    Get/update agent settings for a project.
    GET /api/v1/project/<project_uuid>/agent/settings/
    PUT /api/v1/project/<project_uuid>/agent/settings/
    
    Settings are stored in the project's settings JSON field as:
    {
      "agent": {
        "enabled": false,
        "model": "gemini-2.5-flash",
        "notify_before_due_hours": 48
      }
    }
    """
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

            try:
                settings = json.loads(project.settings) if project.settings else {}
            except (json.JSONDecodeError, ValueError):
                settings = {}

            agent_settings = settings.get('agent', {
                'enabled': False,
                'model': 'gemini-2.5-flash',
                'notify_before_due_hours': 48,
                'run_interval_hours': 1,
            })

            return Response({
                'enabled': agent_settings.get('enabled', False),
                'model': agent_settings.get('model', 'gemini-2.5-flash'),
                'notify_before_due_hours': agent_settings.get('notify_before_due_hours', 48),
                'run_interval_hours': agent_settings.get('run_interval_hours', 1),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @require_org_context
    def put(self, request, project_uuid):
        try:
            project = Projects.objects.get_project_by_uuid(project_uuid)
            if not project:
                return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

            username = request.user.username
            if not check_project_permission(username, project.workspace.owner):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

            try:
                settings = json.loads(project.settings) if project.settings else {}
            except (json.JSONDecodeError, ValueError):
                settings = {}

            enabled = request.data.get('enabled')
            model = request.data.get('model')
            notify_before_due_hours = request.data.get('notify_before_due_hours')
            run_interval_hours = request.data.get('run_interval_hours')

            agent_settings = settings.get('agent', {})

            if enabled is not None:
                agent_settings['enabled'] = bool(enabled)
            if model is not None:
                agent_settings['model'] = str(model)
            if notify_before_due_hours is not None:
                agent_settings['notify_before_due_hours'] = int(notify_before_due_hours)
            if run_interval_hours is not None:
                agent_settings['run_interval_hours'] = float(run_interval_hours)

            settings['agent'] = agent_settings
            project.settings = json.dumps(settings)
            project.save()

            return Response({
                'enabled': agent_settings.get('enabled', False),
                'model': agent_settings.get('model', 'gemini-2.5-flash'),
                'notify_before_due_hours': agent_settings.get('notify_before_due_hours', 48),
                'run_interval_hours': agent_settings.get('run_interval_hours', 1),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

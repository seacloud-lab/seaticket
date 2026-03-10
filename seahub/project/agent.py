import logging
import json

from django.utils import timezone
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
    convert_record_to_ticket as ai_convert_record_to_ticket,
)
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.models import Projects, ProjectConnections
from seahub.tickets.ticket_utils import get_ticket
from seahub.seadb_models.models import (
    AgentActionsTable,
    GithubIssuesTable,
    TicketCommentsTable,
    TicketsTable,
)
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
            source_type = action.get('source_type', 'ticket')
            source_id = action.get('source_id', '')
            content = action['content']

            # 3. Dispatch to the appropriate handler based on source_type and tool_name
            if source_type == 'ticket':
                execution_result = self._execute_ticket_action(
                    seadb_api, project, project_uuid, source_id, tool_name, content, username
                )
            elif source_type == 'github_issue':
                execution_result = self._execute_github_issue_action(
                    seadb_api, project, project_uuid, source_id, tool_name, content, username
                )
            else:
                logger.warning(f'Unknown source_type {source_type!r} for action {action_id}')
                execution_result = f'Unsupported source_type: {source_type}'

            # 4. Update action status in SeaDB
            now = timezone.now().isoformat()
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

    def _execute_ticket_action(self, seadb_api, project, project_uuid, source_id, tool_name, content, username):
        """Dispatch ticket-source actions to the appropriate handler."""
        try:
            ticket_id = int(source_id)
        except (ValueError, TypeError):
            logger.error(f'Invalid ticket source_id: {source_id!r}')
            return f'Invalid ticket source_id: {source_id}'

        if tool_name == 'notify_assignee':
            return self._execute_notify_assignee(seadb_api, project, project_uuid, ticket_id, content, username)
        elif tool_name == 'add_comment':
            return self._execute_add_comment(seadb_api, project, project_uuid, ticket_id, content, username)
        elif tool_name == 'final_answer':
            return 'Final answer acknowledged.'
        else:
            logger.warning(f'Unknown ticket tool_name: {tool_name!r}')
            return f'Unknown tool_name: {tool_name}'

    def _execute_github_issue_action(self, seadb_api, project, project_uuid, source_id, tool_name, content, username):
        """Dispatch GitHub issue actions to the appropriate handler."""
        if tool_name == 'suggest_resolution':
            return self._execute_github_suggest_resolution(source_id, content)
        elif tool_name == 'suggest_create_ticket':
            return self._execute_github_create_ticket(seadb_api, project, project_uuid, source_id, username)
        elif tool_name == 'final_answer':
            return 'Final answer acknowledged.'
        else:
            logger.warning(f'Unknown github_issue tool_name: {tool_name!r}')
            return f'Unknown tool_name: {tool_name}'

    def _execute_github_suggest_resolution(self, source_id, resolution_content):
        """Confirm a resolution suggestion for a GitHub issue.

        Currently records the confirmation. Future enhancement: post as a GitHub comment
        via the GitHub API.
        """
        return f'Resolution for GitHub issue {source_id} confirmed. Content: {(resolution_content or "")[:500]}'

    def _execute_github_create_ticket(self, seadb_api, project, project_uuid, source_id, username):
        """Create an internal ticket from a GitHub issue.

        Steps:
        1. Parse connection_id and record_id from source_id.
        2. Fetch the GitHub issue from SeaDB to build record_detail.
        3. Call the AI service to generate ticket title and content.
        4. Insert the ticket into SeaDB.
        5. Update the GitHub issue's linked_ticket field.
        """
        try:
            connection_id_str, record_id_str = source_id.split('_', 1)
            connection_id = int(connection_id_str)
            record_id = int(record_id_str)
        except (ValueError, AttributeError) as e:
            logger.error(f'Cannot parse github_issue source_id {source_id!r}: {e}')
            return f'Invalid source_id format: {source_id}'

        # Fetch issue from SeaDB
        issues_table = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{issues_table}` WHERE `_pk` = {record_id} LIMIT 1"
        result = seadb_api.query_rows(project_uuid, sql)
        issues = result.get('results', [])
        if not issues:
            return f'GitHub issue {source_id} not found in SeaDB.'
        issue = issues[0]

        title = issue.get('title', '')
        body_content = (issue.get('content') or '').strip()

        record_detail = (
            f"**GitHub Issue Information:**\n"
            f"Title: {title}\n"
            f"Body: {body_content[:3000]}"
        )

        # Call AI service to generate ticket title and content
        org_id = getattr(getattr(project, 'workspace', None), 'org_id', -1) or -1
        params = {
            'username': 'agent',
            'record_detail': record_detail,
            'project_uuid': project_uuid,
            'org_id': org_id,
        }
        try:
            ai_title, ai_content = ai_convert_record_to_ticket(params)
        except Exception as e:
            logger.error(f'AI service error when creating ticket from github issue {source_id}: {e}')
            return f'AI service error: {e}'

        ticket_title = ai_title or title
        ticket_content = ai_content or ''

        # Insert ticket into SeaDB
        now = timezone.now().isoformat()
        ticket_row = {
            TicketsTable.title.name: ticket_title,
            TicketsTable.content.name: ticket_content,
            TicketsTable.state.name: 'open',
            TicketsTable.priority.name: 0,
            TicketsTable.creator.name: username,
            TicketsTable.created_time.name: now,
            TicketsTable.modified_time.name: now,
            TicketsTable.deleted.name: False,
            TicketsTable.linked_connection_records.name: [source_id],
        }
        try:
            insert_result = seadb_api.insert_rows(project_uuid, TicketsTable.gen_table_name(), [ticket_row])
            pks = insert_result.get('pks', [])
            if not pks:
                raise RuntimeError('insert_rows returned no PKs')
            ticket_pk = pks[0]
        except Exception as e:
            logger.error(f'Failed to insert ticket for github issue {source_id}: {e}')
            return f'Failed to create ticket: {e}'

        # Update linked_ticket on the GitHub issue
        try:
            seadb_api.update_rows(
                project_uuid,
                issues_table,
                [{'pk': record_id, 'row': {'linked_ticket': ticket_pk}}],
            )
        except Exception as e:
            logger.warning(
                f'Ticket {ticket_pk} created but failed to update linked_ticket on issue {source_id}: {e}'
            )

        logger.info(f'Created ticket #{ticket_pk} from GitHub issue {source_id}')
        return f'Ticket #{ticket_pk} created from GitHub issue {source_id}.'

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

        now = timezone.now().isoformat()

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
        content = request.data.get('content')
        if content is None:
            return api_error(status.HTTP_400_BAD_REQUEST, 'content is required.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

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

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        if not check_project_permission(username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

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
            now = timezone.now().isoformat()
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
        enabled = request.data.get('enabled')
        model = request.data.get('model')
        notify_before_due_hours = request.data.get('notify_before_due_hours')
        run_interval_hours = request.data.get('run_interval_hours')

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

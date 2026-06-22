import logging
import json
from email.utils import make_msgid
import re
import requests

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication

from urllib.parse import urlparse

from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils.ai_client import (
    convert_record_to_ticket as ai_convert_record_to_ticket,
)
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.models import Projects, ProjectConnections, decrypt_config
from seahub.project.github_issues_api import GitHubAPI, GitHubAppNotInstalled
from seahub.project.discourse_api import DiscourseForumAPI, DiscourseForumAPIException
from seahub.tickets.ticket_utils import get_ticket
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.utils.decorators import require_org_context
from seahub.project.utils import (
    check_project_permission,
    extract_email_addresses,
    collect_github_issue_type_options,
    collect_github_issue_label_options,
    get_current_table_metadata,
    persist_project_connection_config,
)
from seahub.notifications.signal_handler import (
    MSG_TYPE_AGENT_NOTIFY_ASSIGNEE
)
from seahub.tickets.signals import agent_notify_assignees
from seahub.project.constants import AIScenario, ConnectionType
from seahub.utils.email_sender import toggle_send_email, EmailSendError, EmailConfigError

from seahub.seadb_models.models import SchemaTables


logger = logging.getLogger(__name__)

AGENT_ISSUE_TYPES = ('Bug', 'Feature', 'Question')
# Agent issue types that can auto-match to a GitHub issue type with the same
# (case-insensitive) name when no explicit mapping is configured. "Question"
# is intentionally excluded because GitHub's default types (Bug / Feature /
# Task) don't include it, so users should always pick a target explicitly.
AUTO_MATCH_AGENT_ISSUE_TYPES = ('Bug', 'Feature')


class MappingRequiredError(Exception):
    def __init__(self, agent_type, connection_id):
        self.agent_type = agent_type
        self.connection_id = connection_id
        super().__init__(f'Mapping required for agent type: {agent_type}')


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

def _build_items_map_from_actions(actions, include_details=False):
    """build the items map from actions"""
    items_map = {}
    for action in actions:
        source_type = action.get('source_type', '')
        source_id = action.get('source_id', '')
        key = (source_type, source_id)
        if key not in items_map:
            items_map[key] = {
                'source_type': source_type,
                'source_id': source_id,
                'source_title': action.get('source_title', ''),
                'actions': [],
            }
        action_data = {
            'id': action['_pk'],
            'type': action.get('action_type', ''),
            'tool_name': action.get('tool_name', ''),
            'result': action.get('result', ''),
            'status': action.get('status', ''),
            'suggestion_text': action.get('suggestion_text', ''),
            'suggestion_content': action.get('suggestion_content', ''),
            'sources': _parse_action_sources(action.get('sources')),
            'statistics': action.get('statistics', ''),
            'created_at': action.get('created_at', ''),
            'executed_at': action.get('executed_at', ''),
        }
        if include_details:
            action_data.update({
                'phase': action.get('phase', ''),
                'prompt': action.get('prompt', ''),
                'input': action.get('input', ''),
                'step': action.get('step'),
                'tool_arguments': action.get('tool_arguments', ''),
                'observation': action.get('observation', ''),
            })
        items_map[key]['actions'].append(action_data)
    return items_map


def list_agent_runs(seadb_api, project_uuid, page=1, per_page=50, include_details=False):
    offset = (page - 1) * per_page
    
    try:
        runs_sql = "SELECT `_pk`, `status`, `started_at`, `finished_at`, `items_processed`, " \
            f"`error_message`, `events` FROM `{SchemaTables.AGENT_RUNS.table_name()}` " \
            f"ORDER BY `started_at` DESC LIMIT {offset}, {per_page + 1}"
        runs_result = seadb_api.query_rows(project_uuid, runs_sql)
        runs = runs_result.get('results', [])
        
        has_more = len(runs) > per_page
        if has_more:
            runs = runs[:per_page]
        
        # batch fetch all actions
        run_ids = [r['_pk'] for r in runs]
        actions_by_run = {}
        if run_ids:
            run_ids_str = ','.join(str(r) for r in run_ids)
            actions_limit = per_page * 30
            details_field = ''
            if include_details:
                details_field = ', `phase`, `prompt`, `input`, `step`, `tool_arguments`, `observation`'
            actions_sql = "SELECT `_pk`, `run_id`, `source_type`, `source_id`, `source_title`, " \
                f"`action_type`, `tool_name`, `result`, `status`, `suggestion_text`, `suggestion_content`, " \
                f"`statistics`, `created_at`, `executed_at`, `sources`{details_field} FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` " \
                f"WHERE `run_id` IN ({run_ids_str}) ORDER BY `run_id` DESC, `created_at` ASC " \
                f"LIMIT 0, {actions_limit}"
            actions_result = seadb_api.query_rows(project_uuid, actions_sql)
            all_actions = actions_result.get('results', [])
            
            # group actions by run_id
            for action in all_actions:
                run_id = action.get('run_id')
                if run_id not in actions_by_run:
                    actions_by_run[run_id] = []
                actions_by_run[run_id].append(action)
        
        # build the return runs list
        enriched_runs = []
        for run in runs:
            run_pk = run['_pk']
            actions = actions_by_run.get(run_pk, [])
            items_map = _build_items_map_from_actions(actions, include_details=include_details)
            
            enriched_runs.append({
                'id': run_pk,
                'status': run.get('status', ''),
                'started_at': run.get('started_at', ''),
                'finished_at': run.get('finished_at', ''),
                'items_processed': run.get('items_processed', 0),
                'error_message': run.get('error_message', ''),
                'items': list(items_map.values()),
                'events': json.loads(run.get('events') or '[]'),
            })
        
        return {'runs': enriched_runs, 'has_more': has_more}
    except Exception as e:
        logger.exception(e)
        raise


def get_agent_run_detail(seadb_api, project_uuid, run_id, include_details=False):
    try:
        run_sql = "SELECT `_pk`, `status`, `started_at`, `finished_at`, `items_processed`, " \
            f"`error_message`, `events` FROM `{SchemaTables.AGENT_RUNS.table_name()}` WHERE `_pk` = {run_id}"
        run_result = seadb_api.query_rows(project_uuid, run_sql)
        runs = run_result.get('results', [])
        if not runs:
            raise ValueError('Run not found.')
        run = runs[0]
        
        details_field = ''
        if include_details:
            details_field = ', `phase`, `prompt`, `input`, `step`, `tool_arguments`, `observation`'
        actions_sql = "SELECT `_pk`, `run_id`, `source_type`, `source_id`, `source_title`, " \
            f"`action_type`, `tool_name`, `result`, `status`, `suggestion_text`, `suggestion_content`, " \
            f"`statistics`, `created_at`, `executed_at`, `sources`{details_field} FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` " \
            f"WHERE `run_id` = {run_id} ORDER BY `created_at` ASC"
        actions_result = seadb_api.query_rows(project_uuid, actions_sql)
        actions = actions_result.get('results', [])
        items_map = _build_items_map_from_actions(actions, include_details=include_details)
        
        return {
            'id': run['_pk'],
            'status': run.get('status', ''),
            'started_at': run.get('started_at', ''),
            'finished_at': run.get('finished_at', ''),
            'items_processed': run.get('items_processed', 0),
            'error_message': run.get('error_message', ''),
            'items': list(items_map.values()),
            'events': json.loads(run.get('events') or '[]'),
        }
    except Exception as e:
        logger.exception(e)
        raise

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
            seadb_api = SeaDBAPI()
            result = list_agent_runs(seadb_api, project_uuid, page, per_page, include_details=False)
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
            seadb_api = SeaDBAPI(username)
            include_details = request.GET.get('include_details') == 'true'
            result = get_agent_run_detail(seadb_api, project_uuid, run_id, include_details=include_details)
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
            seadb_api = SeaDBAPI()

            # 1. Get action details from SeaDB
            sql = "SELECT `run_id`, `status`, `tool_name`, `source_type`, `source_id`, `suggestion_text`, `suggestion_content` " \
                f"FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` WHERE `_pk` = {action_id}"
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
            suggestion_text = action.get('suggestion_text', '')
            suggestion_content = action.get('suggestion_content', '')

            # 3. Dispatch to the appropriate handler based on source_type and tool_name
            try:
                if source_type == 'ticket':
                    execution = self._execute_ticket_action(
                        seadb_api, project, project_uuid, source_id, tool_name, suggestion_content, username
                    )
                elif source_type == ConnectionType.GITHUB_ISSUE.value:
                    execution = self._execute_github_issue_action(
                        seadb_api, project, project_uuid, source_id, tool_name, suggestion_text, suggestion_content, username
                    )
                elif source_type == ConnectionType.DISCOURSE_FORUM.value:
                    execution = self._execute_discourse_topic_action(
                        seadb_api, project, project_uuid, source_id, tool_name, suggestion_content, username
                    )
                elif source_type == ConnectionType.EMAIL.value:
                    execution = self._execute_email_action(
                        seadb_api, project, project_uuid, source_id, tool_name, suggestion_content, username
                    )
                else:
                    logger.warning(f'Unknown source_type {source_type!r} for action {action_id}')
                    execution = self._failed_execution(f'Unsupported source_type: {source_type}')
            except MappingRequiredError:
                raise
            except Exception as e:
                logger.exception(
                    'Failed to execute confirm action %s for project %s run %s: %s',
                    action_id,
                    project_uuid,
                    run_id,
                    e,
                )
                execution = self._failed_execution(str(e) or 'Action execution failed.')

            execution = self._normalize_execution_result(execution)

            # 4. Update action status in SeaDB
            now = timezone.now().isoformat()
            update_data = [{
                'pk': int(action_id),
                'row': {
                    'status': execution['status'],
                    'result': execution['result'],
                    'executed_at': now,
                }
            }]
            seadb_api.update_rows(project_uuid, SchemaTables.AGENT_ACTIONS.table_name(), update_data)

            return Response({
                'success': execution['success'],
                'action_id': action_id,
                'status': execution['status'],
                'result': execution['result'],
            }, status=status.HTTP_200_OK)

        except MappingRequiredError as e:
            return self._mapping_required_response(seadb_api, project_uuid, e)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def _mapping_required_response(self, seadb_api, project_uuid, error):
        issue_types = collect_github_issue_type_options(
            seadb_api, project_uuid, [error.connection_id]
        )
        return Response({
            'error_code': 'mapping_required',
            'agent_type': error.agent_type,
            'github_issue_types': issue_types,
        }, status=status.HTTP_400_BAD_REQUEST)

    @staticmethod
    def _successful_execution(result):
        return {
            'success': True,
            'status': 'executed',
            'result': result or 'Success',
        }

    @staticmethod
    def _failed_execution(result):
        return {
            'success': False,
            'status': 'failed',
            'result': result or 'Action execution failed.',
        }

    def _normalize_execution_result(self, execution):
        if isinstance(execution, dict):
            success = bool(execution.get('success'))
            result = execution.get('result') or ('Success' if success else 'Action execution failed.')
            return {
                'success': success,
                'status': 'executed' if success else 'failed',
                'result': result,
            }
        if isinstance(execution, str):
            return self._successful_execution(execution)
        return self._successful_execution('Success')

    def _execute_ticket_action(self, seadb_api, project, project_uuid, source_id, tool_name, suggestion_content, username):
        """Dispatch ticket-source actions to the appropriate handler."""
        try:
            ticket_id = int(source_id)
        except (ValueError, TypeError):
            logger.error(f'Invalid ticket source_id: {source_id!r}')
            return self._failed_execution(f'Invalid ticket source_id: {source_id}')

        if tool_name == 'suggest_notify_assignee':
            return self._execute_notify_assignee(seadb_api, project, project_uuid, ticket_id, suggestion_content, username)
        else:
            logger.warning(f'Unknown ticket tool_name: {tool_name!r}')
            return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_github_issue_action(self, seadb_api, project, project_uuid, source_id, tool_name, suggestion_text, suggestion_content, username):
        """Dispatch GitHub issue actions to the appropriate handler."""
        if tool_name == 'suggest_reply':
            return self._execute_github_suggest_reply(seadb_api, project_uuid, source_id, suggestion_content)
        elif tool_name == 'suggest_modify_type':
            return self._execute_github_suggest_modify_type(seadb_api, project, project_uuid, source_id, suggestion_text)
        elif tool_name == 'suggest_assign_labels':
            return self._execute_github_suggest_assign_labels(seadb_api, project_uuid, source_id, suggestion_text)
        elif tool_name == 'suggest_create_ticket':
            return self._execute_github_create_ticket(seadb_api, project, project_uuid, source_id, username)
        else:
            logger.warning(f'Unknown github_issue tool_name: {tool_name!r}')
            return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_discourse_topic_action(self, seadb_api, project, project_uuid, source_id, tool_name, suggestion_content, username):
        if tool_name == 'suggest_reply':
            return self._execute_discourse_suggest_reply(seadb_api, project, project_uuid, source_id, suggestion_content, username)
        elif tool_name == 'suggest_create_ticket':
            return self._execute_discourse_create_ticket(seadb_api, project, project_uuid, source_id, username)
        else:
            logger.warning(f'Unknown discourse_topic tool_name: {tool_name!r}')
            return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_email_action(self, seadb_api, project, project_uuid, source_id, tool_name, suggestion_content, username):
        """Dispatch email-thread actions to the appropriate handler."""
        if tool_name == 'suggest_reply':
            return self._execute_email_suggest_reply(seadb_api, project_uuid, source_id, suggestion_content)
        elif tool_name == 'suggest_create_ticket':
            return self._execute_email_create_ticket(seadb_api, project, project_uuid, source_id, username)
        else:
            logger.warning(f'Unknown email tool_name: {tool_name!r}')
            return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_discourse_suggest_reply(self, seadb_api, project, project_uuid, source_id, reply_content, username):
        reply_content = (reply_content or '').strip()
        if not reply_content:
            return self._failed_execution('Cannot create Discourse reply: empty content.')

        connection_id, topic_pk = self._parse_connection_source_id(source_id, ConnectionType.DISCOURSE_FORUM.value)
        if connection_id is None or topic_pk is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

        project_connection, topic, _replies, error = self._get_discourse_topic_context(
            seadb_api, project_uuid, connection_id, topic_pk
        )
        if error:
            return self._failed_execution(error)

        topic_id = topic.get('topic_id')
        if not topic_id:
            return self._failed_execution(f'Discourse topic {source_id} has no topic_id.')

        try:
            config = decrypt_config(json.loads(project_connection.config))
        except Exception as e:
            logger.error(f'Invalid discourse connection config for {project_connection.id}: {e}')
            return self._failed_execution('Discourse connection config is invalid.')

        discourse_url = config.get('url', '').rstrip('/')
        api_key = config.get('api_key', '')
        api_username = config.get('api_username', '')

        if not discourse_url or not api_key:
            return self._failed_execution('Discourse connection config is missing required fields (url, api_key).')

        try:
            discourse_api = DiscourseForumAPI(discourse_url, api_key, api_username)
            result = discourse_api.create_post(topic_id, reply_content)
            post_number = result.get('post_number', 0)
        except DiscourseForumAPIException as e:
            logger.error(f'Failed to create Discourse reply for topic #{topic_id}: {e}')
            return self._failed_execution(f'Failed to post reply to Discourse: {e}')

        discourse_seadb_api = DiscourseSeaDBAPI(project_uuid, seadb_api=seadb_api)
        reply_data = {
            'post_number': post_number,
            'content': reply_content,
            'author': api_username,
            'topic_pk': topic_pk,
        }
        try:
            discourse_seadb_api.add_reply(project_uuid, connection_id, topic_id, reply_data)
        except Exception as e:
            logger.error(f'Failed to save Discourse reply to SeaDB for topic #{topic_id}: {e}')

        return self._successful_execution(f'Reply #{post_number} posted to Discourse topic #{topic_id}.')

    def _get_github_issue_context(self, seadb_api, project_uuid, source_id):
        try:
            connection_id_str, record_id_str = source_id.split('_', 1)
            connection_id = int(connection_id_str)
            record_id = int(record_id_str)
        except (ValueError, AttributeError) as e:
            logger.error(f'Cannot parse github_issue source_id {source_id!r}: {e}')
            return None

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            logger.error(f'GitHub connection {connection_id} not found.')
            return None

        config = decrypt_config(json.loads(project_connection.config))
        installation_id = config.get('installation_id')
        if not installation_id:
            logger.error(f'GitHub connection {connection_id} missing installation_id.')
            return None

        server_url = config.get('repository')
        try:
            path = urlparse(server_url).path
            parts = path.strip("/").split("/")
            owner, repo = parts[0], parts[1]
        except Exception as e:
            logger.error(f'Invalid GitHub repository URL in connection {connection_id}: {e}')
            return None

        issues_table = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        sql = (
            f"SELECT issue_number, author, issue_id, comment_count, labels "
            f"FROM `{issues_table}` WHERE `_pk` = {record_id} LIMIT 1"
        )
        result = seadb_api.query_rows(project_uuid, sql)
        issues = result.get('results', [])
        if not issues:
            logger.error(f'GitHub issue {source_id} not found in SeaDB.')
            return None
        issue = issues[0]
        issue_number = issue.get('issue_number')
        if not issue_number:
            logger.error(f'GitHub issue {source_id} missing issue_number.')
            return None

        github_api = GitHubAPI(installation_id=installation_id)
        return {
            'connection_id': connection_id,
            'record_id': record_id,
            'github_api': github_api,
            'owner': owner,
            'repo': repo,
            'author': issue.get('author'),
            'issue_number': issue_number,
            'issue_id': issue.get('issue_id'),
            'comment_count': issue.get('comment_count') or 0,
            'labels': issue.get('labels') or [],
        }

    def _execute_github_suggest_reply(self, seadb_api, project_uuid, source_id, reply_content):
        """Post a reply suggestion as a GitHub comment."""
        ctx = self._get_github_issue_context(seadb_api, project_uuid, source_id)
        if not ctx:
            return self._failed_execution(f'Failed to get GitHub issue context for {source_id}.')

        if not reply_content:
            return self._failed_execution(f'Reply content is empty for GitHub issue {ctx["record_id"]}.')

        try:
            result = ctx['github_api'].add_comment(
                ctx['owner'],
                ctx['repo'],
                ctx['issue_number'],
                reply_content,
            )
            comment_id = result.get('id')
            comment_author = result.get('author', '')
            comment_created_at = result.get('created_at', '')
            logger.info(f'Added reply comment #{comment_id} to GitHub issue {ctx["record_id"]}')
        except Exception as e:
            logger.error(f'Failed to add comment to GitHub issue {ctx["record_id"]}: {e}')
            return self._failed_execution(f'Failed to add comment to GitHub issue {ctx["record_id"]}: {e}')

        now_datetime = timezone.now().isoformat()

        try:
            issues_table = SchemaTables.GITHUB_ISSUES.table_name(ctx['connection_id'])
            new_comment_count = ctx['comment_count'] + 1
            update_row = {
                'pk': ctx['record_id'],
                'row': {
                    SchemaTables.GITHUB_ISSUES.column.comment_count.name: new_comment_count,
                    SchemaTables.GITHUB_ISSUES.column.record_modified_time.name: now_datetime,
                }
            }
            seadb_api.update_rows(project_uuid, issues_table, [update_row])
        except Exception as e:
            logger.warning(f'Failed to update SeaDB GithubIssuesTable for issue {ctx["record_id"]}: {e}')

        try:
            comments_table = SchemaTables.GITHUB_ISSUE_COMMENTS.table_name(ctx['connection_id'])
            comment_row = {
                SchemaTables.GITHUB_ISSUE_COMMENTS.column.comment_id.name: comment_id,
                SchemaTables.GITHUB_ISSUE_COMMENTS.column.issue_id.name: ctx['issue_id'],
                SchemaTables.GITHUB_ISSUE_COMMENTS.column.author.name: comment_author,
                SchemaTables.GITHUB_ISSUE_COMMENTS.column.content.name: reply_content,
                SchemaTables.GITHUB_ISSUE_COMMENTS.column.created_time.name: comment_created_at,
                SchemaTables.GITHUB_ISSUE_COMMENTS.column.modified_time.name: comment_created_at,
            }
            seadb_api.insert_rows(project_uuid, comments_table, [comment_row])
        except Exception as e:
            logger.warning(f'Failed to insert comment into SeaDB GithubIssueCommentsTable: {e}')

        return self._successful_execution(
            f'Comment added to GitHub issue {ctx["record_id"]} (comment ID: {comment_id}).'
        )

    @staticmethod
    def _parse_suggested_type(result_text):
        if not result_text:
            return ''
        match = re.search(r'to "(.+?)" for this GitHub issue\.', result_text)
        if match:
            return match.group(1).strip()
        return ''

    @staticmethod
    def _parse_suggested_labels(result_text):
        if not result_text:
            return []
        suggest_assign_labels_re = re.compile(r'Suggest assigning labels (\[.*?\]) to this GitHub issue\.$')
        match = suggest_assign_labels_re.search(result_text.strip())
        if not match:
            return []
        try:
            labels = json.loads(match.group(1))
        except Exception:
            return []
        if not isinstance(labels, list):
            return []
        normalized = []
        seen = set()
        for label in labels:
            name = str(label).strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(name)
        return normalized

    @staticmethod
    def _normalize_issue_labels(raw_labels):
        if isinstance(raw_labels, list):
            labels = raw_labels
        elif isinstance(raw_labels, str):
            value = raw_labels.strip()
            if not value:
                labels = []
            else:
                try:
                    parsed = json.loads(value)
                    labels = parsed if isinstance(parsed, list) else [value]
                except Exception:
                    labels = [part.strip() for part in value.split(',') if part.strip()]
        else:
            labels = []

        normalized = []
        seen = set()
        for label in labels:
            name = str(label).strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(name)
        return normalized

    @staticmethod
    def _filter_labels_by_options(labels, available_options):
        option_map = {
            (opt.get('name') or '').strip().lower(): (opt.get('name') or '').strip()
            for opt in (available_options or [])
            if (opt.get('name') or '').strip()
        }
        if not option_map:
            return labels

        filtered = []
        for label in labels:
            canonical = option_map.get((label or '').strip().lower())
            if canonical:
                filtered.append(canonical)
        return filtered

    def _execute_github_suggest_assign_labels(self, seadb_api, project_uuid, source_id, suggestion_text=''):
        ctx = self._get_github_issue_context(seadb_api, project_uuid, source_id)
        if not ctx:
            return self._failed_execution(f'Failed to get GitHub issue context for {source_id}.')

        labels = self._parse_suggested_labels(suggestion_text)
        if not labels:
            logger.error(
                'Cannot parse suggested labels from suggestion_text for GitHub issue %s: %r',
                ctx['record_id'],
                suggestion_text,
            )
            return self._failed_execution(f'Cannot determine suggested labels for GitHub issue {ctx["record_id"]}.')

        available = collect_github_issue_label_options(
            seadb_api, project_uuid, [ctx['connection_id']]
        )
        final_labels = self._filter_labels_by_options(labels, available)
        if not final_labels:
            return self._failed_execution(
                'No valid labels were found in this suggestion. Please refresh repository labels and try again.'
            )

        try:
            issue_data = ctx['github_api'].update_issue(
                ctx['owner'],
                ctx['repo'],
                ctx['issue_number'],
                labels=final_labels,
            )
            applied_labels = issue_data.get('labels') or final_labels
        except requests.HTTPError as e:
            status_code = getattr(e.response, 'status_code', None)
            if status_code == 422:
                logger.error(
                    'GitHub rejected labels %r for issue %s (422).', final_labels, ctx['record_id']
                )
                return self._failed_execution(
                    f'GitHub rejected labels {final_labels} (422). Some labels may not exist in the repository. Please sync labels and try again.'
                )
            logger.error(f'Failed to update labels for GitHub issue {ctx["record_id"]}: {e}')
            return self._failed_execution(f'Failed to update labels for GitHub issue {ctx["record_id"]}: {e}')
        except Exception as e:
            logger.error(f'Failed to update labels for GitHub issue {ctx["record_id"]}: {e}')
            return self._failed_execution(f'Failed to update labels for GitHub issue {ctx["record_id"]}: {e}')

        try:
            github_seadb_api = GitHubSeaDBAPI(project_uuid, seadb_api=seadb_api)
            github_seadb_api.update_issue_record(
                project_uuid,
                ctx['connection_id'],
                ctx['record_id'],
                issue_data,
            )
        except Exception as e:
            logger.warning(f'Failed to update SeaDB for GitHub issue {ctx["record_id"]}: {e}')

        return self._successful_execution(
            f'Labels updated for GitHub issue {ctx["record_id"]}: {json.dumps(applied_labels, ensure_ascii=False)}.'
        )

    def _execute_github_suggest_modify_type(self, seadb_api, project, project_uuid, source_id, suggestion_text=''):
        ctx = self._get_github_issue_context(seadb_api, project_uuid, source_id)
        if not ctx:
            return self._failed_execution(f'Failed to get GitHub issue context for {source_id}.')

        suggested_type = self._parse_suggested_type(suggestion_text)
        if not suggested_type:
            logger.error(
                f'Cannot parse suggested_type from suggestion_text for GitHub issue {ctx["record_id"]}: '
                f'{suggestion_text!r}'
            )
            return self._failed_execution(
                f'Cannot determine suggested issue type for GitHub issue {ctx["record_id"]}.'
            )

        # Normalize to the canonical enum spelling (Bug / Feature / Question).
        suggested_type = suggested_type.capitalize()
        if suggested_type not in AGENT_ISSUE_TYPES:
            logger.error(
                f'Unsupported suggested_type "{suggested_type}" for GitHub issue {ctx["record_id"]}'
            )
            return self._failed_execution(
                f'Cannot determine suggested issue type for GitHub issue {ctx["record_id"]}.'
            )

        try:
            settings = json.loads(project.settings) if project.settings else {}
        except (TypeError, ValueError, json.JSONDecodeError):
            settings = {}

        mapping = (settings.get('agent') or {}).get('github_issue_type_mapping') or {}
        github_issue_type = (mapping.get(suggested_type) or '').strip()

        # Fallback: for Bug/Feature, if no explicit mapping is configured,
        # auto-match to a same-named GitHub issue type (case-insensitive) that
        # already exists in SeaDB metadata. Question always requires an
        # explicit mapping.
        if not github_issue_type and suggested_type in AUTO_MATCH_AGENT_ISSUE_TYPES:
            available = collect_github_issue_type_options(
                seadb_api, project_uuid, [ctx['connection_id']]
            )
            for opt in available:
                name = (opt.get('name') or '').strip()
                if name.lower() == suggested_type.lower():
                    github_issue_type = name
                    break

        if not github_issue_type:
            raise MappingRequiredError(
                agent_type=suggested_type,
                connection_id=ctx['connection_id'],
            )

        try:
            issue_data = ctx['github_api'].update_issue(
                ctx['owner'],
                ctx['repo'],
                ctx['issue_number'],
                issue_type=github_issue_type,
            )
            new_type = issue_data.get('issue_type', github_issue_type)
        except requests.HTTPError as e:
            status_code = getattr(e.response, 'status_code', None)
            if status_code == 422:
                logger.error(
                    f'GitHub rejected issue_type "{github_issue_type}" for issue {ctx["record_id"]} (422). '
                    f'The type may not exist in the organization.'
                )
                return self._failed_execution(
                    f'GitHub rejected issue type "{github_issue_type}" (422). '
                    f'The type may not be defined in the organization. '
                    f'Please configure issue types in GitHub or choose an existing one.'
                )
            logger.error(f'Failed to update issue_type for GitHub issue {ctx["record_id"]}: {e}')
            return self._failed_execution(f'Failed to update issue_type for GitHub issue {ctx["record_id"]}: {e}')
        except Exception as e:
            logger.error(f'Failed to update issue_type for GitHub issue {ctx["record_id"]}: {e}')
            return self._failed_execution(f'Failed to update issue_type for GitHub issue {ctx["record_id"]}: {e}')

        try:
            github_seadb_api = GitHubSeaDBAPI(project_uuid, seadb_api=seadb_api)
            github_seadb_api.update_issue_record(
                project_uuid,
                ctx['connection_id'],
                ctx['record_id'],
                issue_data,
            )
        except Exception as e:
            logger.warning(f'Failed to update SeaDB for GitHub issue {ctx["record_id"]}: {e}')

        return self._successful_execution(
            f'Issue type updated to "{new_type}" for GitHub issue {ctx["record_id"]}.'
        )

    def _create_ticket_from_record_detail(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        username,
        record_detail,
        title,
        source_label,
    ):
        org_id = getattr(getattr(project, 'workspace', None), 'org_id', -1) or -1
        params = {
            'username': 'agent',
            'record_detail': record_detail,
            'project_uuid': project_uuid,
            'org_id': org_id,
            'scenario': AIScenario.RECORD_GENERATION.value,
        }
        try:
            ai_title, ai_content = ai_convert_record_to_ticket(params)
        except Exception as e:
            logger.error(f'AI service error when creating ticket from {source_label} {source_id}: {e}')
            return None, f'AI service error: {e}'

        ticket_title = ai_title or title
        ticket_content = ai_content or ''

        now = timezone.now().isoformat()
        ticket_row = {
            SchemaTables.TICKETS.column.title.name: ticket_title,
            SchemaTables.TICKETS.column.content.name: ticket_content,
            SchemaTables.TICKETS.column.state.name: 'open',
            SchemaTables.TICKETS.column.substate.name: 'New',
            SchemaTables.TICKETS.column.priority.name: 0,
            SchemaTables.TICKETS.column.creator.name: username,
            SchemaTables.TICKETS.column.created_time.name: now,
            SchemaTables.TICKETS.column.modified_time.name: now,
            SchemaTables.TICKETS.column.deleted.name: False,
            SchemaTables.TICKETS.column.linked_connection_records.name: [source_id],
        }
        try:
            insert_result = seadb_api.insert_rows(project_uuid, SchemaTables.TICKETS.table_name(), [ticket_row])
            pks = insert_result.get('pks', [])
            if not pks:
                raise RuntimeError('insert_rows returned no PKs')
            ticket_pk = pks[0]
        except Exception as e:
            logger.error(f'Failed to insert ticket for {source_label} {source_id}: {e}')
            return None, f'Failed to create ticket: {e}'

        return ticket_pk, None

    def _execute_github_create_ticket(self, seadb_api, project, project_uuid, source_id, username):
        """Create an internal ticket from a GitHub issue.

        Steps:
        1. Parse connection_id and record_id from source_id.
        2. Fetch the GitHub issue from SeaDB to build record_detail.
        3. Call the AI service to generate ticket title and content.
        4. Insert the ticket into SeaDB.
        5. Update the GitHub issue's linked_ticket field.
        """
        connection_id, record_id = self._parse_connection_source_id(source_id, ConnectionType.GITHUB_ISSUE.value)
        if connection_id is None or record_id is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

        # Fetch issue from SeaDB
        issues_table = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        sql = "SELECT `_pk`, `title`, `content`, `linked_ticket` " \
            f"FROM `{issues_table}` WHERE `_pk` = {record_id} LIMIT 1"
        result = seadb_api.query_rows(project_uuid, sql)
        issues = result.get('results', [])
        if not issues:
            return self._failed_execution(f'GitHub issue {source_id} not found in SeaDB.')
        issue = issues[0]

        linked_ticket = issue.get('linked_ticket')
        if linked_ticket:
            return self._failed_execution(f'GitHub issue #{record_id} is already linked to ticket #{linked_ticket}.')

        title = issue.get('title', '')
        body_content = (issue.get('content') or '').strip()

        record_detail = (
            f"**GitHub Issue Information:**\n"
            f"Title: {title}\n"
            f"Body: {body_content[:3000]}..."
        )

        ticket_pk, error = self._create_ticket_from_record_detail(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            record_detail=record_detail,
            title=title,
            source_label=ConnectionType.GITHUB_ISSUE.value,
        )
        if error:
            return self._failed_execution(error)

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
        return self._successful_execution(f'Ticket #{ticket_pk} created from GitHub issue #{record_id}.')

    def _parse_connection_source_id(self, source_id, source_type):
        try:
            connection_id_str, record_id_str = str(source_id).split('_', 1)
            connection_id = int(connection_id_str)
            record_id = int(record_id_str)
        except (ValueError, TypeError, AttributeError) as e:
            logger.error(f'Cannot parse {source_type} source_id {source_id!r}: {e}')
            return None, None
        return connection_id, record_id

    def _get_email_thread_context(self, seadb_api, project_uuid, connection_id, thread_id):
        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection or project_connection.type != ConnectionType.EMAIL.value:
            return None, None, None, f'Email connection {connection_id} not found.'

        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        thread = email_seadb_api.get_thread_by_pk(connection_id, thread_id)
        if not thread:
            return None, None, None, f'Email thread #{thread_id} not found in SeaDB.'

        emails = email_seadb_api.get_emails_by_thread_id(connection_id, thread_id)
        if not emails:
            return None, None, None, f'No emails found for thread #{thread_id}.'

        return project_connection, thread, emails, None

    def _get_discourse_topic_context(self, seadb_api, project_uuid, connection_id, topic_pk):
        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection or project_connection.type != ConnectionType.DISCOURSE_FORUM.value:
            return None, None, None, f'Discourse connection {connection_id} not found.'

        discourse_seadb_api = DiscourseSeaDBAPI(project_uuid, seadb_api=seadb_api)
        topic = discourse_seadb_api.get_topic_by_pk(connection_id, topic_pk)
        if not topic:
            return None, None, None, f'Discourse topic #{topic_pk} not found in SeaDB.'

        topic_id = topic.get('topic_id')
        replies = discourse_seadb_api.get_replies_by_topic_id(connection_id, topic_id) if topic_id else []

        return project_connection, topic, replies, None

    def _execute_email_suggest_reply(self, seadb_api, project_uuid, source_id, reply_content):
        reply_content = (reply_content or '').strip()
        if not reply_content:
            return self._failed_execution('Cannot send reply email: empty content.')

        connection_id, thread_id = self._parse_connection_source_id(source_id, ConnectionType.EMAIL.value)
        if connection_id is None or thread_id is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

        project_connection, _thread, emails, error = self._get_email_thread_context(
            seadb_api, project_uuid, connection_id, thread_id
        )
        if error:
            return self._failed_execution(error)

        try:
            config = decrypt_config(json.loads(project_connection.config))
        except Exception as e:
            logger.error(f'Invalid email connection config for {project_connection.id}: {e}')
            return self._failed_execution('Email connection config is invalid.')

        target_email = next((email for email in reversed(emails) if not email.get('is_sender')), None)
        if not target_email:
            return self._failed_execution(f'No inbound email found for thread {source_id}.')

        to_text = target_email.get('email_from') or ''
        to_emails = extract_email_addresses(to_text)
        if not to_emails:
            logger.warning(
              'Failed to resolve recipient for thread %s: email_from=%r (email pk=%s)',source_id, to_text, target_email.get('_pk'),
      )
            return self._failed_execution(f'Failed to resolve recipient for thread {source_id}.')

        subject = target_email.get('title') or ''
        if not subject:
            return self._failed_execution(f'Cannot determine subject for thread {source_id}.')
        if not subject.lower().startswith('re:'):
            subject = f'Re: {subject}'

        target_message_id = target_email.get('message_id')
        if not target_message_id:
            return self._failed_execution(f'Cannot determine reply target for thread {source_id}.')

        sender_email = config.get('sender_email') or config.get('username')
        if not sender_email:
            return self._failed_execution('Email connection config is invalid.')

        domain = sender_email.split('@')[1] if '@' in sender_email else None
        message_id = make_msgid(domain=domain)

        send_info = {
            'message': reply_content,
            'html_message': None,
            'send_to': to_emails,
            'copy_to': [],
            'subject': subject,
            'in_reply_to': target_message_id,
            'message_id': message_id,
        }

        try:
            send_res = toggle_send_email(config, send_info)
        except EmailConfigError as e:
            logger.error('Email config error for connection %s: %s', project_connection.id, e)
            return self._failed_execution('Email connection config is invalid.')
        except EmailSendError as e:
            logger.error('Reply email failed for connection %s thread %s: %s', project_connection.id, source_id, e)
            return self._failed_execution('Failed to send email.')

        if send_res.get('config_updated'):
            persist_project_connection_config(project_connection, config)

        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        email_data = {
            'sender_name': config.get('sender_name', ''),
            'sender_email': sender_email,
            'email_to': to_text,
            'cc': '',
            'subject': subject,
            'content': reply_content,
            'html_content': None,
            'reply_to_message_id': target_message_id,
            'origin_thread_id': send_res.get('origin_thread_id') or target_email.get('origin_thread_id'),
            'message_id': message_id,
            'email_id': send_res.get('email_id'),
        }

        thread_id = target_email.get('thread_id')
        try:
            reply_pk = email_seadb_api.save_reply_email(project_uuid, project_connection.id, thread_id, email_data)
        except Exception as e:
            logger.error('Save reply email failed for connection %s thread %s: %s', project_connection.id, source_id, e)
            return self._failed_execution('Failed to save reply email.')

        return self._successful_execution(f'Reply email sent for thread #{thread_id} (email record ID: {reply_pk}).')

    def _build_email_thread_record_detail(self, thread, emails):
        lines = [
            '**Email Thread Information:**',
            f"Subject: {thread.get('title', '')}",
            '',
        ]

        for index, email in enumerate(emails[-10:], start=1):
            lines.extend([
                f'Email #{index}:',
                f"From: {email.get('email_from', '')}",
                f"To: {email.get('email_to', '')}",
                f"CC: {email.get('cc', '')}",
                f"Time: {email.get('modified_time', '')}",
                f"Is Sender: {bool(email.get('is_sender'))}",
                f"Content: {(email.get('content') or '')[:2000]}",
                '',
            ])

        return '\n'.join(lines).strip()

    def _build_discourse_topic_record_detail(self, project_connection, topic, replies):
        topic_id = topic.get('topic_id')
        slug = topic.get('slug', '')
        topic_url = ''
        try:
            config = decrypt_config(json.loads(project_connection.config))
            discourse_forum_url = config.get('url', '').rstrip('/')
            if discourse_forum_url and topic_id:
                topic_url = f'{discourse_forum_url}/t/{slug}/{topic_id}'
        except Exception as e:
            logger.warning(
                'Failed to parse discourse connection config for %s when building record detail: %s',
                project_connection.id, e
            )

        ordered_replies = sorted(
            replies or [],
            key=lambda reply: (reply.get('post_number') is None, reply.get('post_number', 0))
        )

        lines = [
            '**Discourse Topic Information:**',
            f"Title: {topic.get('title', '')}",
            f"Topic ID: {topic_id or ''}",
            f"Slug: {slug}",
            f"Created Time: {topic.get('created_time', '')}",
            f"Resolved: {bool(topic.get('resolved'))}",
        ]
        if topic_url:
            lines.append(f'Topic URL: {topic_url}')
        lines.append('')

        # The first reply is the topic's original post and serves
        # as the topic content, so always include it separately from later replies.
        original_post = ordered_replies[0] if ordered_replies else None
        subsequent_replies = ordered_replies[1:] if ordered_replies else []

        if original_post:
            lines.extend([
                'Original Post:',
                f"Author: {original_post.get('author', '')}",
                f"Post Number: {original_post.get('post_number', '')}",
                f"Time: {original_post.get('modified_time', '')}",
                f"Accepted Answer: {bool(original_post.get('accepted_answer'))}",
                f"Content: {(original_post.get('content') or '')[:2000]}",
                '',
            ])

        for index, reply in enumerate(subsequent_replies[-10:], start=1):
            lines.extend([
                f'Reply #{index}:',
                f"Author: {reply.get('author', '')}",
                f"Post Number: {reply.get('post_number', '')}",
                f"Time: {reply.get('modified_time', '')}",
                f"Accepted Answer: {bool(reply.get('accepted_answer'))}",
                f"Content: {(reply.get('content') or '')[:2000]}",
                '',
            ])

        return '\n'.join(lines).strip()

    def _execute_email_create_ticket(self, seadb_api, project, project_uuid, source_id, username):
        connection_id, thread_id = self._parse_connection_source_id(source_id, ConnectionType.EMAIL.value)
        if connection_id is None or thread_id is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

        project_connection, thread, emails, error = self._get_email_thread_context(
            seadb_api, project_uuid, connection_id, thread_id
        )
        if error:
            return self._failed_execution(error)

        linked_ticket = thread.get('linked_ticket')
        if linked_ticket:
            return self._failed_execution(f'Email thread #{thread_id} is already linked to ticket #{linked_ticket}.')

        record_detail = self._build_email_thread_record_detail(thread, emails)
        thread_table = SchemaTables.THREAD.table_name(project_connection.id)
        thread_id = thread.get('_pk')

        ticket_pk, error = self._create_ticket_from_record_detail(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            record_detail=record_detail,
            title=thread.get('title', ''),
            source_label=ConnectionType.EMAIL.value,
        )
        if error:
            return self._failed_execution(error)

        try:
            seadb_api.update_rows(
                project_uuid,
                thread_table,
                [{'pk': thread_id, 'row': {'linked_ticket': ticket_pk, 'unread': False}}],
            )
        except Exception as e:
            logger.warning(
                f'Ticket {ticket_pk} created but failed to update linked_ticket on email thread {source_id}: {e}'
            )

        logger.info(f'Created ticket #{ticket_pk} from email thread {source_id}')
        return self._successful_execution(f'Ticket #{ticket_pk} created from email thread #{thread_id}.')

    def _execute_discourse_create_ticket(self, seadb_api, project, project_uuid, source_id, username):
        connection_id, topic_pk = self._parse_connection_source_id(source_id, ConnectionType.DISCOURSE_FORUM.value)
        if connection_id is None or topic_pk is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

        project_connection, topic, replies, error = self._get_discourse_topic_context(
            seadb_api, project_uuid, connection_id, topic_pk
        )
        if error:
            return self._failed_execution(error)

        linked_ticket = topic.get('linked_ticket')
        if linked_ticket:
            return self._failed_execution(f'Discourse topic #{topic_pk} is already linked to ticket #{linked_ticket}.')

        record_detail = self._build_discourse_topic_record_detail(project_connection, topic, replies)
        topic_table = SchemaTables.DISCOURSE_TOPICS.table_name(project_connection.id)
        topic_pk = topic.get('_pk')

        ticket_pk, error = self._create_ticket_from_record_detail(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            record_detail=record_detail,
            title=topic.get('title', ''),
            source_label=ConnectionType.DISCOURSE_FORUM.value,
        )
        if error:
            return self._failed_execution(error)

        try:
            seadb_api.update_rows(
                project_uuid,
                topic_table,
                [{'pk': topic_pk, 'row': {'linked_ticket': ticket_pk}}],
            )
        except Exception as e:
            logger.warning(
                f'Ticket {ticket_pk} created but failed to update linked_ticket on discourse topic {source_id}: {e}'
            )

        logger.info(f'Created ticket #{ticket_pk} from discourse topic {source_id}')
        return self._successful_execution(f'Ticket #{ticket_pk} created from discourse topic #{topic_pk}.')

    def _execute_notify_assignee(self, seadb_api, project, project_uuid, ticket_id, message, operator):
        """
        Send notification to ticket assignees via ProjectNotification system.
        """
        ticket, _ = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            logger.warning(f'Ticket {ticket_id} not found in project {project_uuid}')
            return self._failed_execution(f'Ticket #{ticket_id} not found')

        assignees = ticket.get(SchemaTables.TICKETS.column.assignees.name) or []
        if not assignees:
            logger.info(f'Ticket #{ticket_id} has no assignees, skip notify.')
            return self._failed_execution(f'Ticket #{ticket_id} has no assignees')

        agent_notify_assignees.send(
            sender=None,
            project_uuid=project_uuid,
            assignees=assignees,
            msg_type=MSG_TYPE_AGENT_NOTIFY_ASSIGNEE,
            from_user_id=operator,
            ticket_id=ticket_id,
            ticket_title=ticket.get(SchemaTables.TICKETS.column.title.name),
            message=message,
            workspace_id=project.workspace_id,
            project_name=project.project_name,
        )

        logger.info(f'Agent notified assignees for ticket #{ticket_id}')
        return self._successful_execution(f'Notification sent to {len(assignees)} assignee(s).')


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

            if action.get('run_id') != int(run_id):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action does not belong to this run.')

            if action.get('status') != 'pending':
                return api_error(status.HTTP_400_BAD_REQUEST, 'Action is not pending.')

            # Update action status to cancelled
            now = timezone.now().isoformat()
            nickname = email2nickname(username)
            update_data = [{
                'pk': int(action_id),
                'row': {
                    'status': 'cancelled',
                    'result': f'Cancelled by {nickname}',
                    'executed_at': now,
                }
            }]
            seadb_api.update_rows(project_uuid, SchemaTables.AGENT_ACTIONS.table_name(), update_data)
            return Response({
                'success': True,
                'action_id': action_id,
                'status': 'cancelled',
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
        if column.get('name') == SchemaTables.GITHUB_ISSUES.issue_type.name:
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

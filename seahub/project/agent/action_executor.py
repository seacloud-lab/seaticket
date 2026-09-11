import logging
import json
import requests
from email.utils import make_msgid
from urllib.parse import urlparse

from django.utils import timezone
from django.utils.translation import gettext as _

from seahub.utils import uuid_str_to_36_chars
from seahub.utils.ai_client import (
    convert_record_to_ticket as ai_convert_record_to_ticket,
)
from seahub.project.models import ProjectConnections, ProjectConnectionOauth, decrypt_config
from seahub.project.github_issues_api import GitHubAPI
from seahub.project.discourse_api import DiscourseForumAPI, DiscourseForumAPIException
from seahub.project.discord_api import DiscordAPI
from seahub.tickets.ticket_utils import (
    get_ticket,
    collect_open_linked_github_issues_for_tickets,
    close_linked_github_issues,
    get_ticket_table_columns,
    get_column_from_columns_by_name,
    map_ticket_substate_to_github_state_reason,
    record_ticket_activities,
    build_ticket_close_payloads_from_client,
    convert_select_field_option_ids_to_names,
    check_ticket_link_changes,
    sync_links_in_connection,
    TicketLinkValidationError,
)
from seahub.portal.portal_utils import get_portal_issue
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.seadb_models.discord_seadb_api import DiscordSeaDBAPI
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.project.utils import (
    extract_email_addresses,
    collect_github_issue_type_options,
    collect_github_issue_label_options,
    build_ticket_related_url,
    build_connection_record_related_url,
    build_portal_issue_related_url,
)
from seahub.notifications.signal_handler import (
    MSG_TYPE_AGENT_NOTIFY_ASSIGNEE
)
from seahub.tickets.signals import agent_notify_assignees
from seahub.project.constants import ConnectionType, EMAIL_ACCOUNT_TYPE_PERSONAL, \
    merge_project_settings_defaults, ExtraSourceType
from seahub.project.oauth_utils import EmailOAuthUtils
from seahub.utils.email_sender import toggle_send_email, EmailSendError, EmailConfigError
from seahub.seadb_models.models import SchemaTables
from seahub.utils.mailbox_manager import (
    move_emails_to_junk,
    MailboxConfigError,
    MailboxOperationError,
)
from seahub.utils.auth import is_user_virtual_id
from seahub.base.templatetags.seahub_tags import email2contact_email
from seahub.settings import DISCORD_BOT_TOKEN

logger = logging.getLogger(__name__)

AGENT_ISSUE_TYPES = ('Bug', 'Feature', 'Question')
# Agent issue types that can auto-match to a GitHub issue type with the same
# (case-insensitive) name when no explicit mapping is configured. "Question"
# is intentionally excluded because GitHub's default types (Bug / Feature /
# Task) don't include it, so users should always pick a target explicitly.
AUTO_MATCH_AGENT_ISSUE_TYPES = ('Bug', 'Feature')

# Identity used for all agent-triggered actions during auto execution.
AUTO_EXECUTION_USER = 'Agent'
# Sender identity used for agent-triggered assignee reminders during auto execution.
AUTO_NOTIFY_SENDER = AUTO_EXECUTION_USER
# Creator identity used for agent-triggered ticket creation during auto execution.
AUTO_TICKET_CREATOR = AUTO_EXECUTION_USER


class MappingRequiredError(Exception):
    def __init__(self, agent_type, connection_id):
        self.agent_type = agent_type
        self.connection_id = connection_id
        super().__init__(f'Mapping required for agent type: {agent_type}')


class AgentActionExecutor:
    """Shared action executor used by API view and background command."""

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

    @staticmethod
    def normalize_execution_result(execution):
        if isinstance(execution, dict):
            success = bool(execution.get('success'))
            result = execution.get('result') or ('Success' if success else 'Action execution failed.')
            return {
                'success': success,
                'status': 'executed' if success else 'failed',
                'result': result,
            }
        if isinstance(execution, str):
            return {
                'success': True,
                'status': 'executed',
                'result': execution,
            }
        return {
            'success': True,
            'status': 'executed',
            'result': 'Success',
        }

    @staticmethod
    def _parse_suggestion_payload(suggestion_payload):
        if isinstance(suggestion_payload, dict):
            return suggestion_payload
        if isinstance(suggestion_payload, str):
            try:
                parsed = json.loads(suggestion_payload)
            except (TypeError, ValueError):
                return {}
            return parsed if isinstance(parsed, dict) else {}
        return {}

    @staticmethod
    def get_effective_auto_confirm_map(project):
        settings = getattr(project, 'settings', None) or {}
        if isinstance(settings, str):
            try:
                settings = json.loads(settings)
            except Exception:
                settings = {}
        if not isinstance(settings, dict):
            settings = {}
        merged_settings = merge_project_settings_defaults(settings)
        auto_confirm = ((merged_settings.get('agent') or {}).get('auto_confirm') or {})
        if not isinstance(auto_confirm, dict):
            return {}
        return {
            key: value for key, value in auto_confirm.items()
            if isinstance(key, str) and isinstance(value, bool)
        }

    def _execute_ticket_action(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        tool_name,
        suggestion_content,
        operator,
        *,
        linked_github_issues_to_close=None,
        auto_executed=False,
    ):
        try:
            ticket_id = int(source_id)
        except (ValueError, TypeError):
            logger.error('Invalid ticket source_id: %r', source_id)
            return self._failed_execution(f'Invalid ticket source_id: {source_id}')

        if tool_name == 'suggest_notify_assignee':
            return self._execute_notify_assignee(
                seadb_api, 
                project, 
                project_uuid, 
                ticket_id, 
                suggestion_content, 
                operator, 
                auto_executed=auto_executed,
            )
        if tool_name == 'suggest_close_ticket':
            return self._execute_close_ticket(
                seadb_api,
                project_uuid,
                ticket_id,
                operator,
                linked_github_issues_to_close=linked_github_issues_to_close,
            )
        logger.warning('Unknown ticket tool_name: %r', tool_name)
        return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_github_issue_action(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        tool_name,
        suggestion_content,
        suggestion_payload,
        operator,
        request=None,
        auto_executed=False,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_github_suggest_reply(
                seadb_api, project_uuid, source_id, suggestion_content
            )
        if tool_name == 'suggest_modify_type':
            return self._execute_github_suggest_modify_type(
                seadb_api, project, project_uuid, source_id, suggestion_payload
            )
        if tool_name == 'suggest_assign_labels':
            return self._execute_github_suggest_assign_labels(
                seadb_api, project_uuid, source_id, suggestion_payload
            )
        if tool_name == 'suggest_create_ticket':
            return self._execute_github_create_ticket(seadb_api, project, project_uuid, source_id, suggestion_content, operator, request=request, auto_executed=auto_executed)
        if tool_name == 'suggest_link_existing_ticket':
            return self._execute_link_existing_ticket(seadb_api, project, project_uuid, ConnectionType.GITHUB_ISSUE.value, source_id, suggestion_payload, request=request)
        logger.warning('Unknown github_issue tool_name: %r', tool_name)
        return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_discourse_topic_action(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        tool_name,
        suggestion_content,
        suggestion_payload,
        operator,
        request=None,
        auto_executed=False,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_discourse_suggest_reply(
                seadb_api, project, project_uuid, source_id, suggestion_content, operator
            )
        if tool_name == 'suggest_create_ticket':
            return self._execute_discourse_create_ticket(seadb_api, project, project_uuid, source_id, suggestion_content, operator, request=request, auto_executed=auto_executed)
        if tool_name == 'suggest_link_existing_ticket':
            return self._execute_link_existing_ticket(seadb_api, project, project_uuid, ConnectionType.DISCOURSE_FORUM.value, source_id, suggestion_payload, request=request)
        logger.warning('Unknown discourse_topic tool_name: %r', tool_name)
        return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_portal_issue_action(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        tool_name,
        suggestion_content,
        suggestion_payload,
        operator,
        request=None,
        auto_executed=False,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_portal_issue_suggest_reply(
                seadb_api, project_uuid, source_id, suggestion_content, operator
            )
        if tool_name == 'suggest_create_ticket':
            return self._execute_portal_issue_create_ticket(
                seadb_api,
                project,
                project_uuid,
                source_id,
                suggestion_content,
                operator,
                request=request,
                auto_executed=auto_executed,
            )
        if tool_name == 'suggest_link_existing_ticket':
            return self._execute_link_existing_ticket(
                seadb_api,
                project,
                project_uuid,
                ExtraSourceType.PORTAL_ISSUE.value,
                source_id,
                suggestion_payload,
                request=request,
            )
        logger.warning('Unknown portal_issue tool_name: %r', tool_name)
        return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_email_action(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        tool_name,
        suggestion_content,
        suggestion_payload,
        operator,
        request=None,
        auto_executed=False,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_email_suggest_reply(seadb_api, project_uuid, source_id, suggestion_content)
        if tool_name == 'suggest_create_ticket':
            return self._execute_email_create_ticket(seadb_api, project, project_uuid, source_id, suggestion_content, operator, request=request, auto_executed=auto_executed)
        if tool_name == 'suggest_move_to_spam':
            return self._execute_email_move_to_spam(seadb_api, project_uuid, source_id)
        if tool_name == 'suggest_link_existing_ticket':
            return self._execute_link_existing_ticket(seadb_api, project, project_uuid, ConnectionType.EMAIL.value, source_id, suggestion_payload, request=request)
        logger.warning('Unknown email tool_name: %r', tool_name)
        return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_discord_action(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        tool_name,
        suggestion_content,
        suggestion_payload,
        operator,
        request=None,
        auto_executed=False,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_discord_suggest_reply(seadb_api, project_uuid, source_id, suggestion_content)
        if tool_name == 'suggest_create_ticket':
            return self._execute_discord_create_ticket(
                seadb_api,
                project,
                project_uuid,
                source_id,
                suggestion_content,
                operator,
                request=request,
                auto_executed=auto_executed,
            )
        if tool_name == 'suggest_link_existing_ticket':
            return self._execute_link_existing_ticket(seadb_api, project, project_uuid, ConnectionType.DISCORD.value, source_id, suggestion_payload, request=request)
        logger.warning('Unknown discord tool_name: %r', tool_name)
        return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def execute_action(
        self,
        seadb_api,
        project,
        project_uuid,
        action,
        operator,
        *,
        linked_github_issues_to_close=None,
        request=None,
        auto_executed=False,
    ):
        effective_operator = AUTO_EXECUTION_USER if auto_executed else operator
        tool_name = action.get('tool_name')
        source_type = action.get('target_item_type', 'ticket')
        source_id = action.get('target_item_id', '')
        suggestion_content = action.get('suggestion_content', '')
        suggestion_payload = self._parse_suggestion_payload(action.get('suggestion_payload'))
        action_id = action.get('_pk') or action.get('id') or ''

        if source_type == 'ticket':
            execution = self._execute_ticket_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                effective_operator,
                linked_github_issues_to_close=linked_github_issues_to_close,
                auto_executed=auto_executed,
            )
        elif source_type == ConnectionType.GITHUB_ISSUE.value:
            execution = self._execute_github_issue_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                suggestion_payload,
                effective_operator,
                request=request,
                auto_executed=auto_executed,
            )
        elif source_type == ConnectionType.DISCOURSE_FORUM.value:
            execution = self._execute_discourse_topic_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                suggestion_payload,
                effective_operator,
                request=request,
                auto_executed=auto_executed,
            )
        elif source_type == ExtraSourceType.PORTAL_ISSUE.value:
            execution = self._execute_portal_issue_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                suggestion_payload,
                effective_operator,
                request=request,
                auto_executed=auto_executed,
            )
        elif source_type == ConnectionType.EMAIL.value:
            execution = self._execute_email_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                suggestion_payload,
                effective_operator,
                request=request,
                auto_executed=auto_executed,
            )
        elif source_type == ConnectionType.DISCORD.value:
            execution = self._execute_discord_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                suggestion_payload,
                effective_operator,
                request=request,
                auto_executed=auto_executed,
            )
        else:
            logger.warning('Unknown source_type %r for action %s', source_type, action_id)
            execution = self._failed_execution(f'Unsupported source_type: {source_type}')

        return self.normalize_execution_result(execution)

    @staticmethod
    def _parse_portal_issue_id(source_id):
        try:
            issue_id = int(source_id)
        except (TypeError, ValueError):
            return None
        return issue_id if issue_id > 0 else None

    def _execute_portal_issue_suggest_reply(
        self, seadb_api, project_uuid, source_id, reply_content, username,
    ):
        reply_content = (reply_content or '').strip()
        if not reply_content:
            return self._failed_execution('Cannot create Portal issue reply: empty content.')

        issue_id = self._parse_portal_issue_id(source_id)
        if issue_id is None:
            return self._failed_execution(f'Invalid Portal issue source_id: {source_id}')

        issue, _ = get_portal_issue(seadb_api, project_uuid, issue_id)
        if not issue:
            return self._failed_execution(f'Portal issue #{issue_id} not found.')

        now = timezone.now().isoformat()
        comment_row = {
            SchemaTables.PORTAL_ISSUE_COMMENTS.column.issue_id.name: issue_id,
            SchemaTables.PORTAL_ISSUE_COMMENTS.column.creator.name: username,
            SchemaTables.PORTAL_ISSUE_COMMENTS.column.content.name: reply_content,
            SchemaTables.PORTAL_ISSUE_COMMENTS.column.created_time.name: now,
            SchemaTables.PORTAL_ISSUE_COMMENTS.column.modified_time.name: now,
            SchemaTables.PORTAL_ISSUE_COMMENTS.column.deleted.name: False,
            SchemaTables.PORTAL_ISSUE_COMMENTS.column.via_agent.name: True,
        }
        comments_table = SchemaTables.PORTAL_ISSUE_COMMENTS.table_name()
        try:
            result = seadb_api.insert_rows(project_uuid, comments_table, [comment_row])
            comment_pks = result.get('pks', [])
            if len(comment_pks) != 1:
                raise RuntimeError('insert_rows returned an unexpected number of comment PKs')
            count_result = seadb_api.query_rows(
                project_uuid,
                f"SELECT COUNT(*) AS count FROM `{comments_table}` "
                f"WHERE `issue_id` = {issue_id} AND `deleted` = False",
            )
            comment_count = (count_result.get('results') or [{}])[0].get('count', 0)
            seadb_api.update_rows(
                project_uuid,
                SchemaTables.PORTAL_ISSUES.table_name(),
                [{'pk': issue_id, 'row': {
                    SchemaTables.PORTAL_ISSUES.column.comment_count.name: comment_count,
                    SchemaTables.PORTAL_ISSUES.column.modified_time.name: now,
                }}],
            )
        except Exception as e:
            logger.error('Failed to create reply for Portal issue #%s: %s', issue_id, e)
            return self._failed_execution(f'Failed to create reply for Portal issue #{issue_id}: {e}')

        return self._successful_execution(
            f'Reply #{comment_pks[0]} added to Portal issue #{issue_id}.'
        )

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
            logger.error(f'Failed to create Discourse reply for topic #{topic_pk}: {e}')
            return self._failed_execution(f'Failed to post reply to Discourse #{topic_pk}: {e}')

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
            logger.error(f'Failed to save Discourse reply to SeaDB for topic #{topic_pk}: {e}')

        return self._successful_execution(f'Reply #{post_number} posted to Discourse topic #{topic_pk}.')

    def _get_github_issue_context(self, seadb_api, project_uuid, source_id):
        try:
            connection_id_str, record_id_str = source_id.split('_', 1)
            connection_id = int(connection_id_str)
            record_id = int(record_id_str)
        except (ValueError, AttributeError) as e:
            logger.error(f'Cannot parse github_issue source_id {source_id!r}: {e}')
            return None

        project_connection = ProjectConnections.objects.get_connection_in_project_by_id(project_uuid, connection_id)
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
            parts = path.strip('/').split('/')
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

    def _execute_github_suggest_assign_labels(
        self, seadb_api, project_uuid, source_id, suggestion_payload=None
    ):
        ctx = self._get_github_issue_context(seadb_api, project_uuid, source_id)
        if not ctx:
            return self._failed_execution(f'Failed to get GitHub issue context for {source_id}.')

        suggestion_payload = self._parse_suggestion_payload(suggestion_payload)
        raw_labels = suggestion_payload.get('suggested_labels')
        labels = self._normalize_issue_labels(raw_labels) if isinstance(raw_labels, list) else []
        if not labels:
            logger.error(
                'Cannot parse suggested_labels from suggestion_payload for GitHub issue %s: %r',
                ctx['record_id'],
                suggestion_payload,
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
            f'Labels updated for GitHub issue #{ctx["record_id"]}: {json.dumps(applied_labels, ensure_ascii=False)}.'
        )

    def _execute_github_suggest_modify_type(self, seadb_api, project, project_uuid, source_id, suggestion_payload=None):
        ctx = self._get_github_issue_context(seadb_api, project_uuid, source_id)
        if not ctx:
            return self._failed_execution(f'Failed to get GitHub issue context for {source_id}.')

        suggestion_payload = self._parse_suggestion_payload(suggestion_payload)
        raw_suggested_type = suggestion_payload.get('suggested_type')
        suggested_type = raw_suggested_type.strip() if isinstance(raw_suggested_type, str) else ''
        if not suggested_type:
            logger.error(
                'Cannot parse suggested_type from suggestion_payload for GitHub issue %s: %r',
                ctx['record_id'],
                suggestion_payload,
            )
            return self._failed_execution(
                f'Cannot determine suggested issue type for GitHub issue {ctx["record_id"]}.'
            )

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
            f'Issue type updated to "{new_type}" for GitHub issue #{ctx["record_id"]}.'
        )

    @staticmethod
    def _parse_ticket_suggestion_content(suggestion_content):
        if not isinstance(suggestion_content, str):
            return None

        normalized = suggestion_content.replace('\r\n', '\n').strip()
        if not normalized:
            return None

        try:
            parsed = json.loads(normalized)
        except Exception:
            parsed = None
        if isinstance(parsed, dict):
            return {
                'title': str(parsed.get('title') or '').strip(),
                'content': str(parsed.get('content') or '').strip(),
                'assignees': parsed.get('assignees') if isinstance(parsed.get('assignees'), list) else [],
                'participants': parsed.get('participants') if isinstance(parsed.get('participants'), list) else [],
                'type': str(parsed.get('type') or '').strip(),
                'tags': parsed.get('tags') if isinstance(parsed.get('tags'), list) else [],
                'priority': parsed.get('priority'),
                'state': str(parsed.get('state') or '').strip(),
                'substate': str(parsed.get('substate') or '').strip(),
                'due_date': str(parsed.get('due_date') or '').strip(),
            }
        return None

    def _create_ticket(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        username,
        backup_title,
        suggestion_content,
        request=None,
        auto_executed=False,
        related_url=None,
    ):
        draft = self._parse_ticket_suggestion_content(suggestion_content)
        if draft:
            ticket_title = draft['title'] or backup_title
            ticket_content = draft['content']
            ticket_assignees = draft.get('assignees') or []
            ticket_participants = draft.get('participants') or []
            ticket_type = draft.get('type') or ''
            ticket_tags = draft.get('tags') or []
            ticket_priority = draft.get('priority')
            ticket_state = (draft.get('state') or '').strip().lower()
            ticket_substate = draft.get('substate') or ''
            ticket_due_date = draft.get('due_date') or ''
        else:
            ticket_title = backup_title
            ticket_content = suggestion_content
            ticket_assignees = []
            ticket_participants = []
            ticket_type = ''
            ticket_tags = []
            ticket_priority = None
            ticket_state = ''
            ticket_substate = ''
            ticket_due_date = ''

        ticket_title = (ticket_title or '').strip()
        ticket_content = (ticket_content or '').strip()
        if not ticket_title:
            ticket_title = 'Untitled'
        try:
            ticket_priority = int(ticket_priority)
        except (TypeError, ValueError):
            ticket_priority = 0
        ticket_priority = max(0, ticket_priority)

        if related_url is None:
            connection_id, record_id = self._parse_connection_source_id(source_id, 'connection record')
            if connection_id is not None and record_id is not None:
                related_url = build_connection_record_related_url(
                    request, project, connection_id, record_id
                )
        if related_url and related_url not in ticket_content:
            linked_record_suffix = f'{_('Linked record')}: {related_url}'
            ticket_content = (
                f'{ticket_content}\n\n{linked_record_suffix}'
                if ticket_content else linked_record_suffix
            )

        try:
            ticket_columns = get_ticket_table_columns(seadb_api, project_uuid)
            select_fields = {
                SchemaTables.TICKETS.column.state.name: ticket_state,
                SchemaTables.TICKETS.column.substate.name: ticket_substate,
                SchemaTables.TICKETS.column.type.name: ticket_type,
            }
            convert_select_field_option_ids_to_names(ticket_columns, select_fields)

            ticket_type = select_fields[SchemaTables.TICKETS.column.type.name] or ''
            ticket_state = select_fields[SchemaTables.TICKETS.column.state.name] or 'open'
            ticket_substate = select_fields[SchemaTables.TICKETS.column.substate.name] or ''
            if not ticket_substate:
                substate_column = get_column_from_columns_by_name(
                    ticket_columns, SchemaTables.TICKETS.column.substate.name
                ) or {}
                substate_options = ((substate_column.get('data') or {}).get('options') or [])
                if substate_options:
                    ticket_substate = substate_options[0].get('name') or ''
        except Exception as e:
            logger.error(f'Failed to resolve ticket select options for source_id {source_id}: {e}')
            return None, f'Failed to create ticket: {e}'

        now = timezone.now().isoformat()

        ticket_creator = AUTO_TICKET_CREATOR if auto_executed else username
        ticket_row = {
            SchemaTables.TICKETS.column.title.name: ticket_title,
            SchemaTables.TICKETS.column.content.name: ticket_content,
            SchemaTables.TICKETS.column.state.name: ticket_state,
            SchemaTables.TICKETS.column.substate.name: ticket_substate,
            SchemaTables.TICKETS.column.type.name: ticket_type,
            SchemaTables.TICKETS.column.priority.name: ticket_priority,
            SchemaTables.TICKETS.column.assignees.name: ticket_assignees,
            SchemaTables.TICKETS.column.participants.name: ticket_participants,
            SchemaTables.TICKETS.column.tags.name: ticket_tags,
            SchemaTables.TICKETS.column.creator.name: ticket_creator,
            SchemaTables.TICKETS.column.created_time.name: now,
            SchemaTables.TICKETS.column.modified_time.name: now,
            SchemaTables.TICKETS.column.due_date.name: ticket_due_date,
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
            logger.error(f'Failed to insert ticket for source_id {source_id}: {e}')
            return None, f'Failed to create ticket: {e}'

        ticket = {
            'ticket_pk': ticket_pk,
            'ticket_title': ticket_title,
            'ticket_url': build_ticket_related_url(request, project, ticket_pk),
        }
        return ticket, None

    def _ticket_created_execution(self, message, ticket):
        return self._successful_execution(json.dumps({
            'message': message,
            'ticket': ticket,
        }, ensure_ascii=False))

    def _execute_link_existing_ticket(
        self,
        seadb_api,
        project,
        project_uuid,
        source_type,
        source_id,
        suggestion_payload=None,
        request=None,
    ):
        suggestion_payload = self._parse_suggestion_payload(suggestion_payload)
        raw_related_ticket = suggestion_payload.get('related_ticket')
        try:
            related_ticket = int(raw_related_ticket)
        except (TypeError, ValueError):
            return self._failed_execution('related_ticket must be a positive integer.')
        if related_ticket <= 0:
            return self._failed_execution('related_ticket must be a positive integer.')

        ticket, _ = get_ticket(seadb_api, project_uuid, related_ticket)
        if not ticket:
            return self._failed_execution(f'Ticket #{related_ticket} not found.')

        normalized_source_id = str(source_id)
        if source_type == ExtraSourceType.PORTAL_ISSUE.value:
            record_id = self._parse_portal_issue_id(source_id)
            if record_id is None:
                return self._failed_execution(f'Invalid Portal issue source_id: {source_id}')
            normalized_source_id = f'portal_{record_id}'
        else:
            connection_id, record_id = self._parse_connection_source_id(source_id, source_type)
            if connection_id is None or record_id is None:
                return self._failed_execution(f'Invalid source_id format: {source_id}')

        try:
            sync_plan, connections = check_ticket_link_changes(
                seadb_api,
                project_uuid,
                {related_ticket: ([normalized_source_id], [])},
            )
        except TicketLinkValidationError as e:
            return self._failed_execution(str(e))

        try:
            sync_links_in_connection(seadb_api, project_uuid, sync_plan, connections)
        except Exception as e:
            logger.error('Failed to link record %s to ticket #%s: %s', normalized_source_id, related_ticket, e)
            return self._failed_execution(f'Failed to link this record to ticket #{related_ticket}: {e}')

        linked_source_ids = ticket.get(SchemaTables.TICKETS.column.linked_connection_records.name) or []
        linked_source_ids = [
            item for item in linked_source_ids
            if isinstance(item, str) and item.strip()
        ]
        if normalized_source_id not in linked_source_ids:
            linked_source_ids.append(normalized_source_id)
            try:
                seadb_api.update_rows(
                    project_uuid,
                    SchemaTables.TICKETS.table_name(),
                    [{
                        'pk': related_ticket,
                        'row': {
                            SchemaTables.TICKETS.column.linked_connection_records.name: linked_source_ids,
                        },
                    }],
                )
            except Exception as e:
                logger.warning(
                    'Linked record %s to ticket #%s but failed to update linked_connection_records: %s',
                    normalized_source_id, related_ticket, e
                )
                return self._failed_execution(f'Linked record {normalized_source_id} to ticket #{related_ticket} but failed to update linked_connection_records: {e}')

        ticket_info = {
            'ticket_pk': related_ticket,
            'ticket_title': ticket.get(SchemaTables.TICKETS.column.title.name) or f'Ticket #{related_ticket}',
            'ticket_url': build_ticket_related_url(request, project, related_ticket),
        }
        return self._successful_execution(json.dumps({
            'message': f'Record linked to ticket #{related_ticket}.',
            'ticket': ticket_info,
        }, ensure_ascii=False))

    def _execute_portal_issue_create_ticket(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        suggestion_content,
        username,
        request=None,
        auto_executed=False,
    ):
        issue_id = self._parse_portal_issue_id(source_id)
        if issue_id is None:
            return self._failed_execution(f'Invalid Portal issue source_id: {source_id}')

        issue, _ = get_portal_issue(seadb_api, project_uuid, issue_id)
        if not issue:
            return self._failed_execution(f'Portal issue #{issue_id} not found.')
        if issue.get('linked_ticket'):
            return self._failed_execution(
                f'Portal issue #{issue_id} is already linked to ticket #{issue["linked_ticket"]}.'
            )

        portal_link_key = f'portal_{issue_id}'
        ticket, error = self._create_ticket(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=portal_link_key,
            username=username,
            backup_title=issue.get('title', ''),
            suggestion_content=suggestion_content,
            request=request,
            auto_executed=auto_executed,
            related_url=build_portal_issue_related_url(request, project, issue_id),
        )
        if error:
            return self._failed_execution(error)
        ticket_pk = ticket['ticket_pk']

        try:
            seadb_api.update_rows(
                project_uuid,
                SchemaTables.PORTAL_ISSUES.table_name(),
                [{'pk': issue_id, 'row': {'linked_ticket': ticket_pk}}],
            )
        except Exception as e:
            logger.warning(
                'Ticket %s created but failed to update linked_ticket on Portal issue %s: %s',
                ticket_pk,
                issue_id,
                e,
            )

        logger.info('Created ticket #%s from Portal issue #%s', ticket_pk, issue_id)
        return self._ticket_created_execution(
            f'Ticket #{ticket_pk} created from Portal issue #{issue_id}.',
            ticket,
        )

    def _execute_github_create_ticket(
        self, seadb_api, project, project_uuid, source_id, suggestion_content, username, request=None, auto_executed=False
    ):
        connection_id, record_id = self._parse_connection_source_id(source_id, ConnectionType.GITHUB_ISSUE.value)
        if connection_id is None or record_id is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

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

        ticket, error = self._create_ticket(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            backup_title=title,
            suggestion_content=suggestion_content,
            request=request,
            auto_executed=auto_executed,
        )
        if error:
            return self._failed_execution(error)
        ticket_pk = ticket['ticket_pk']

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
        return self._ticket_created_execution(
            f'Ticket #{ticket_pk} created from GitHub issue #{record_id}.',
            ticket,
        )

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
        project_connection = ProjectConnections.objects.get_connection_in_project_by_id(project_uuid, connection_id)
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
        project_connection = ProjectConnections.objects.get_connection_in_project_by_id(project_uuid, connection_id)
        if not project_connection or project_connection.type != ConnectionType.DISCOURSE_FORUM.value:
            return None, None, None, f'Discourse connection {connection_id} not found.'

        discourse_seadb_api = DiscourseSeaDBAPI(project_uuid, seadb_api=seadb_api)
        topic = discourse_seadb_api.get_topic_by_pk(connection_id, topic_pk)
        if not topic:
            return None, None, None, f'Discourse topic #{topic_pk} not found in SeaDB.'

        topic_id = topic.get('topic_id')
        replies = discourse_seadb_api.get_replies_by_topic_id(connection_id, topic_id) if topic_id else []

        return project_connection, topic, replies, None

    def _get_discord_thread_context(self, seadb_api, project_uuid, connection_id, thread_pk):
        project_connection = ProjectConnections.objects.get_connection_in_project_by_id(project_uuid, connection_id)
        if not project_connection or project_connection.type != ConnectionType.DISCORD.value:
            return None, None, f'Discord connection {connection_id} not found.'

        discord_seadb_api = DiscordSeaDBAPI(project_uuid, seadb_api=seadb_api)
        thread = discord_seadb_api.get_thread_by_pk(connection_id, thread_pk)
        if not thread:
            return None, None, f'Discord thread #{thread_pk} not found in SeaDB.'

        return project_connection, thread, None

    def _execute_discord_suggest_reply(self, seadb_api, project_uuid, source_id, reply_content):
        reply_content = (reply_content or '').strip()
        if not reply_content:
            return self._failed_execution('Cannot create Discord reply: empty content.')

        connection_id, record_id = self._parse_connection_source_id(source_id, ConnectionType.DISCORD.value)
        if connection_id is None or record_id is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

        project_connection, thread, error = self._get_discord_thread_context(
            seadb_api, project_uuid, connection_id, record_id
        )
        if error:
            return self._failed_execution(error)

        thread_id = (thread.get('thread_id') or '').strip()
        if not thread_id:
            return self._failed_execution(f'Discord thread {source_id} has no thread_id.')

        try:
            discord_api = DiscordAPI(DISCORD_BOT_TOKEN)
            message = discord_api.create_message(thread_id, reply_content)
        except requests.exceptions.RequestException as e:
            logger.error('Failed to create Discord reply for thread %s: %s', source_id, e)
            return self._failed_execution(f'Failed to post reply to Discord thread #{record_id}: {e}')

        message_id = str(message.get('id') or '').strip()
        if not message_id:
            return self._failed_execution('Failed to save Discord reply: response has no message id.')

        author = ((message.get('author') or {}).get('username') or '').strip()
        created_time = message.get('timestamp') or timezone.now().isoformat()
        modified_time = message.get('edited_timestamp') or created_time
        message_table = SchemaTables.DISCORD_THREAD_MESSAGES.table_name(project_connection.id)
        row = {
            'thread_id': thread_id,
            'message_id': message_id,
            'author': author,
            'content': reply_content,
            'created_time': created_time,
            'modified_time': modified_time,
        }
        try:
            result = seadb_api.insert_rows(project_uuid, message_table, [row])
            message_pk = (result.get('pks') or [None])[0]
        except Exception as e:
            logger.error(
                'Discord reply posted remotely but failed to save in SeaDB for source %s: %s',
                source_id,
                e,
            )
            return self._failed_execution(
                f'Discord reply was posted, but failed to save local record for thread #{record_id}.'
            )

        return self._successful_execution(
            f'Reply posted to Discord thread #{record_id}.'
        )

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
                'Failed to resolve recipient for thread %s: email_from=%r (email pk=%s)', source_id, to_text, target_email.get('_pk'),
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
            oauth_token = None
            oauth_config = None
            if config.get('server_provider') in ('Gmail', 'Microsoft'):
                oauth_record = ProjectConnectionOauth.objects.get_by_connection_id(project_uuid, project_connection.id)
                if not oauth_record:
                    return self._failed_execution('Email OAuth authorization is required.')
                oauth_token = {
                    'access_token': oauth_record.access_token,
                    'refresh_token': oauth_record.refresh_token,
                    'expires_at': oauth_record.expires_at.timestamp(),
                }
                oauth_config = EmailOAuthUtils._get_oauth_config(
                    config.get('server_provider'),
                    config.get('account_type', EMAIL_ACCOUNT_TYPE_PERSONAL),
                    config,
                )
            send_res = toggle_send_email(config, send_info, oauth_token, oauth_config)
        except EmailConfigError as e:
            logger.error('Email config error for connection %s: %s', project_connection.id, e)
            return self._failed_execution('Email connection config is invalid.')
        except EmailSendError as e:
            logger.error('Reply email failed for connection %s thread %s: %s', project_connection.id, source_id, e)
            return self._failed_execution('Failed to send email.')

        if send_res.get('oauth_updated'):
            oauth_token = send_res['oauth_token']
            ProjectConnectionOauth.objects.upsert_connection_token(
                project_uuid, project_connection.id, oauth_token['access_token'], oauth_token['expires_at'],
                oauth_token['refresh_token']
            )

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
            reply_pk = email_seadb_api.save_reply_email(
                project_uuid, project_connection.id, thread_id, email_data,
            )
        except Exception as e:
            logger.error('Save reply email failed for connection %s thread %s: %s', project_connection.id, source_id, e)
            return self._failed_execution('Failed to save reply email.')

        return self._successful_execution(f'Reply email sent for thread #{thread_id} (email record ID: {reply_pk}).')

    def _execute_email_move_to_spam(self, seadb_api, project_uuid, source_id):
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
            return self._failed_execution(
                f'Email thread #{thread_id} is already linked to ticket #{linked_ticket}.'
            )

        try:
            config = decrypt_config(json.loads(project_connection.config))
        except Exception as e:
            logger.error(f'Invalid email connection config for {project_connection.id}: {e}')
            return self._failed_execution('Email connection config is invalid.')

        oauth_token = None
        oauth_config = None
        if config.get('server_provider') in ('Gmail', 'Microsoft'):
            oauth_record = ProjectConnectionOauth.objects.get_by_connection_id(project_uuid, project_connection.id)
            if not oauth_record:
                return self._failed_execution('Email OAuth authorization is required.')
            oauth_token = {
                'access_token': oauth_record.access_token,
                'refresh_token': oauth_record.refresh_token,
                'expires_at': oauth_record.expires_at.timestamp(),
            }
            oauth_config = EmailOAuthUtils._get_oauth_config(
                config.get('server_provider'),
                config.get('account_type', EMAIL_ACCOUNT_TYPE_PERSONAL),
                config,
            )

        inbound_message_ids = []
        for email in emails:
            if email.get('is_sender'):
                continue
            message_id = str(email.get('message_id') or '').strip()
            if message_id:
                inbound_message_ids.append(message_id)
        inbound_message_ids = list(dict.fromkeys(inbound_message_ids))
        if not inbound_message_ids:
            return self._failed_execution(f'No inbound message id found for thread {source_id}.')

        try:
            move_result = move_emails_to_junk(config, inbound_message_ids, oauth_token, oauth_config)
        except MailboxConfigError as e:
            logger.error('Mailbox config error for connection %s: %s', project_connection.id, e)
            return self._failed_execution('Email connection config is invalid.')
        except MailboxOperationError as e:
            logger.error(
                'Move to spam failed for connection %s thread %s: %s',
                project_connection.id, source_id, e
            )
            return self._failed_execution('Failed to move the email to the spam folder.')

        moved_count = int((move_result or {}).get('moved_count') or 0)
        if moved_count <= 0:
            logger.warning(
                'Move to spam matched no remote message for connection %s thread %s (message_ids=%s)',
                project_connection.id, source_id, inbound_message_ids
            )
            return self._failed_execution(
                'Failed to move the email to the spam folder: no matching remote message was moved.'
            )

        if (move_result or {}).get('oauth_updated'):
            oauth_token = move_result['oauth_token']
            ProjectConnectionOauth.objects.upsert_connection_token(
                project_uuid, project_connection.id, oauth_token['access_token'], oauth_token['expires_at'],
                oauth_token['refresh_token']
            )

        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        try:
            email_pks = [email.get('_pk') for email in emails if email.get('_pk') is not None]
            if email_pks:
                email_seadb_api.mark_emails_deleted(connection_id, email_pks)
            email_seadb_api.mark_thread_deleted(connection_id, thread_id)
        except Exception as e:
            logger.error(
                'Moved email to spam but failed to soft-delete thread %s for connection %s: %s',
                source_id, project_connection.id, e
            )
            return self._failed_execution('Email moved to spam but failed to update local records.')

        return self._successful_execution(
            f'Email thread #{thread_id} moved to the spam folder.'
        )

    def _execute_email_create_ticket(self, seadb_api, project, project_uuid, source_id, suggestion_content, username, request=None, auto_executed=False):
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

        thread_table = SchemaTables.THREAD.table_name(project_connection.id)
        thread_id = thread.get('_pk')

        ticket, error = self._create_ticket(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            backup_title=thread.get('title', ''),
            suggestion_content=suggestion_content,
            request=request,
            auto_executed=auto_executed,
        )
        if error:
            return self._failed_execution(error)
        ticket_pk = ticket['ticket_pk']

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
        return self._ticket_created_execution(
            f'Ticket #{ticket_pk} created from email thread #{thread_id}.',
            ticket,
        )

    def _execute_discourse_create_ticket(self, seadb_api, project, project_uuid, source_id, suggestion_content, username, request=None, auto_executed=False):
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

        topic_table = SchemaTables.DISCOURSE_TOPICS.table_name(project_connection.id)
        topic_pk = topic.get('_pk')

        ticket, error = self._create_ticket(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            backup_title=topic.get('title', ''),
            suggestion_content=suggestion_content,
            request=request,
            auto_executed=auto_executed,
        )
        if error:
            return self._failed_execution(error)
        ticket_pk = ticket['ticket_pk']

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
        return self._ticket_created_execution(
            f'Ticket #{ticket_pk} created from discourse topic #{topic_pk}.',
            ticket,
        )

    def _execute_discord_create_ticket(self, seadb_api, project, project_uuid, source_id, suggestion_content, username, request=None, auto_executed=False):
        connection_id, thread_pk = self._parse_connection_source_id(source_id, ConnectionType.DISCORD.value)
        if connection_id is None or thread_pk is None:
            return self._failed_execution(f'Invalid source_id format: {source_id}')

        project_connection, thread, error = self._get_discord_thread_context(
            seadb_api, project_uuid, connection_id, thread_pk
        )
        if error:
            return self._failed_execution(error)

        linked_ticket = thread.get('linked_ticket')
        if linked_ticket:
            return self._failed_execution(f'Discord thread #{thread_pk} is already linked to ticket #{linked_ticket}.')

        thread_table = SchemaTables.DISCORD_THREADS.table_name(project_connection.id)
        thread_pk = thread.get('_pk')

        ticket, error = self._create_ticket(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            backup_title=thread.get('title', ''),
            suggestion_content=suggestion_content,
            request=request,
            auto_executed=auto_executed,
        )
        if error:
            return self._failed_execution(error)
        ticket_pk = ticket['ticket_pk']

        try:
            seadb_api.update_rows(
                project_uuid,
                thread_table,
                [{'pk': thread_pk, 'row': {'linked_ticket': ticket_pk}}],
            )
        except Exception as e:
            logger.warning(
                f'Ticket {ticket_pk} created but failed to update linked_ticket on discord thread {source_id}: {e}'
            )

        logger.info(f'Created ticket #{ticket_pk} from discord thread {source_id}')
        return self._ticket_created_execution(
            f'Ticket #{ticket_pk} created from discord thread #{thread_pk}.',
            ticket,
        )

    def _execute_notify_assignee(self, seadb_api, project, project_uuid, ticket_id, message, operator, *, auto_executed=False):
        ticket, _ = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            logger.warning(f'Ticket {ticket_id} not found in project {project_uuid}')
            return self._failed_execution(f'Ticket #{ticket_id} not found')

        assignees = ticket.get(SchemaTables.TICKETS.column.assignees.name) or []
        if not assignees:
            logger.info(f'Ticket #{ticket_id} has no assignees, skip notify.')
            return self._failed_execution(f'Ticket #{ticket_id} has no assignees')

        notify_from_user = AUTO_NOTIFY_SENDER if auto_executed else operator

        agent_notify_assignees.send(
            sender=None,
            project_uuid=uuid_str_to_36_chars(project_uuid),
            assignees=assignees,
            msg_type=MSG_TYPE_AGENT_NOTIFY_ASSIGNEE,
            from_user_id=notify_from_user,
            ticket_id=ticket_id,
            ticket_title=ticket.get(SchemaTables.TICKETS.column.title.name),
            message=message,
            workspace_id=project.workspace_id,
            project_name=project.project_name,
            project_color=project.color,
            project_icon=project.icon,
        )

        logger.info(f'Agent notified assignees for ticket #{ticket_id}')
        return self._successful_execution(f'Notification sent to {len(assignees)} assignee(s).')

    def _execute_close_ticket(
        self,
        seadb_api,
        project_uuid,
        ticket_id,
        operator,
        *,
        linked_github_issues_to_close=None,
    ):
        ticket, _ = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            return self._failed_execution(f'Ticket #{ticket_id} not found')

        state_name = (ticket.get(SchemaTables.TICKETS.column.state.name) or '').lower()
        if state_name == 'closed':
            return self._failed_execution(f'Ticket #{ticket_id} is already closed')

        substate = ticket.get(SchemaTables.TICKETS.column.substate.name)
        close_candidates = [{'ticket_id': int(ticket_id), 'substate': substate}]
        try:
            ticket_close_payloads = build_ticket_close_payloads_from_client(
                seadb_api,
                project_uuid,
                close_candidates,
                linked_github_issues_to_close or [],
            )
            close_linked_github_issues(seadb_api, project_uuid, ticket_close_payloads)
        except Exception as e:
            logger.exception('Failed to close linked GitHub issues for ticket #%s: %s', ticket_id, e)
            return self._failed_execution(f'Failed to close linked GitHub issues: {e}')

        now = timezone.now().isoformat()
        participants = ticket.get(SchemaTables.TICKETS.column.participants.name) or []
        if operator not in participants:
            participants.append(operator)
        update_row = {
            SchemaTables.TICKETS.column.state.name: 'closed',
            SchemaTables.TICKETS.column.closed_time.name: now,
            SchemaTables.TICKETS.column.modified_time.name: now,
            SchemaTables.TICKETS.column.participants.name: participants,
        }
        seadb_api.update_rows(
            project_uuid,
            SchemaTables.TICKETS.table_name(),
            [{
                'pk': ticket_id,
                'row': update_row,
            }],
        )
        changes = [('state_changed', 'state', ticket.get(SchemaTables.TICKETS.column.state.name), 'closed')]
        record_ticket_activities(
            seadb_api,
            project_uuid,
            ticket_id,
            operator,
            changes,
        )
        return self._successful_execution(f'Ticket #{ticket_id} closed.')

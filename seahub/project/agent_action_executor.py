import logging
import json
import re
import requests
from email.utils import make_msgid
from urllib.parse import urlparse

from django.utils import timezone

from seahub.utils import uuid_str_to_36_chars
from seahub.utils.ai_client import (
    convert_record_to_ticket as ai_convert_record_to_ticket,
)
from seahub.project.models import ProjectConnections, decrypt_config
from seahub.project.github_issues_api import GitHubAPI
from seahub.project.discourse_api import DiscourseForumAPI, DiscourseForumAPIException
from seahub.tickets.ticket_utils import (
    get_ticket,
    collect_open_linked_github_issues_for_tickets,
    close_linked_github_issues,
    get_ticket_table_columns,
    map_ticket_substate_to_github_state_reason,
    record_ticket_activities,
    build_ticket_close_payloads_from_client,
)
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.project.utils import (
    extract_email_addresses,
    collect_github_issue_type_options,
    collect_github_issue_label_options,
    persist_project_connection_config,
    build_ticket_related_url,
)
from seahub.notifications.signal_handler import (
    MSG_TYPE_AGENT_NOTIFY_ASSIGNEE
)
from seahub.tickets.signals import agent_notify_assignees
from seahub.project.constants import AIScenario, ConnectionType, merge_project_settings_defaults
from seahub.utils.email_sender import toggle_send_email, EmailSendError, EmailConfigError
from seahub.seadb_models.models import SchemaTables
from seahub.utils.mailbox_manager import (
    move_emails_to_junk,
    MailboxConfigError,
    MailboxOperationError,
)
from seahub.utils.auth import is_user_virtual_id
from seahub.base.templatetags.seahub_tags import email2contact_email

logger = logging.getLogger(__name__)

AGENT_ISSUE_TYPES = ('Bug', 'Feature', 'Question')
# Agent issue types that can auto-match to a GitHub issue type with the same
# (case-insensitive) name when no explicit mapping is configured. "Question"
# is intentionally excluded because GitHub's default types (Bug / Feature /
# Task) don't include it, so users should always pick a target explicitly.
AUTO_MATCH_AGENT_ISSUE_TYPES = ('Bug', 'Feature')

# Sender identity used for agent-triggered assignee reminders during auto execution. 
AGENT_AUTO_NOTIFY_SENDER = 'Agent'


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

    @staticmethod
    def resolve_auto_action_operator(project):
        return getattr(project, 'creator', None)

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
        suggestion_text,
        suggestion_content,
        operator,
        request=None,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_github_suggest_reply(
                seadb_api, project_uuid, source_id, suggestion_content
            )
        if tool_name == 'suggest_modify_type':
            return self._execute_github_suggest_modify_type(
                seadb_api, project, project_uuid, source_id, suggestion_text
            )
        if tool_name == 'suggest_assign_labels':
            return self._execute_github_suggest_assign_labels(
                seadb_api, project_uuid, source_id, suggestion_text
            )
        if tool_name == 'suggest_create_ticket':
            return self._execute_github_create_ticket(
                seadb_api, project, project_uuid, source_id, operator, request=request
            )
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
        operator,
        request=None,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_discourse_suggest_reply(
                seadb_api, project, project_uuid, source_id, suggestion_content, operator
            )
        if tool_name == 'suggest_create_ticket':
            return self._execute_discourse_create_ticket(
                seadb_api, project, project_uuid, source_id, operator, request=request
            )
        logger.warning('Unknown discourse_topic tool_name: %r', tool_name)
        return self._failed_execution(f'Unknown tool_name: {tool_name}')

    def _execute_email_action(
        self,
        seadb_api,
        project,
        project_uuid,
        source_id,
        tool_name,
        suggestion_content,
        operator,
        request=None,
    ):
        if tool_name == 'suggest_reply':
            return self._execute_email_suggest_reply(seadb_api, project_uuid, source_id, suggestion_content)
        if tool_name == 'suggest_create_ticket':
            return self._execute_email_create_ticket(seadb_api, project, project_uuid, source_id, operator, request=request)
        if tool_name == 'suggest_move_to_spam':
            return self._execute_email_move_to_spam(seadb_api, project_uuid, source_id)
        logger.warning('Unknown email tool_name: %r', tool_name)
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
        tool_name = action.get('tool_name')
        source_type = action.get('source_type', 'ticket')
        source_id = action.get('source_id', '')
        suggestion_text = action.get('suggestion_text', '')
        suggestion_content = action.get('suggestion_content', '')
        action_id = action.get('_pk') or action.get('id') or ''

        if source_type == 'ticket':
            execution = self._execute_ticket_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                operator,
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
                suggestion_text,
                suggestion_content,
                operator,
                request=request,
            )
        elif source_type == ConnectionType.DISCOURSE_FORUM.value:
            execution = self._execute_discourse_topic_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                operator,
                request=request,
            )
        elif source_type == ConnectionType.EMAIL.value:
            execution = self._execute_email_action(
                seadb_api,
                project,
                project_uuid,
                source_id,
                tool_name,
                suggestion_content,
                operator,
                request=request,
            )
        else:
            logger.warning('Unknown source_type %r for action %s', source_type, action_id)
            execution = self._failed_execution(f'Unsupported source_type: {source_type}')

        return self.normalize_execution_result(execution)

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
        request=None,
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

    def _execute_github_create_ticket(
        self, seadb_api, project, project_uuid, source_id, username, request=None
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
        body_content = (issue.get('content') or '').strip()

        record_detail = (
            f"**GitHub Issue Information:**\n"
            f"Title: {title}\n"
            f"Body: {body_content[:3000]}..."
        )

        ticket, error = self._create_ticket_from_record_detail(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            record_detail=record_detail,
            title=title,
            source_label=ConnectionType.GITHUB_ISSUE.value,
            request=request,
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
            move_result = move_emails_to_junk(config, inbound_message_ids)
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

        # OAuth providers may have refreshed their access token during the move.
        if (move_result or {}).get('config_updated'):
            persist_project_connection_config(project_connection, config)

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

    def _execute_email_create_ticket(
        self, seadb_api, project, project_uuid, source_id, username, request=None
    ):
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

        ticket, error = self._create_ticket_from_record_detail(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            record_detail=record_detail,
            title=thread.get('title', ''),
            source_label=ConnectionType.EMAIL.value,
            request=request,
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

    def _execute_discourse_create_ticket(
        self, seadb_api, project, project_uuid, source_id, username, request=None
    ):
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

        ticket, error = self._create_ticket_from_record_detail(
            seadb_api=seadb_api,
            project=project,
            project_uuid=project_uuid,
            source_id=source_id,
            username=username,
            record_detail=record_detail,
            title=topic.get('title', ''),
            source_label=ConnectionType.DISCOURSE_FORUM.value,
            request=request,
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

    def _execute_notify_assignee(self, seadb_api, project, project_uuid, ticket_id, message, operator, *, auto_executed=False):
        ticket, _ = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            logger.warning(f'Ticket {ticket_id} not found in project {project_uuid}')
            return self._failed_execution(f'Ticket #{ticket_id} not found')

        assignees = ticket.get(SchemaTables.TICKETS.column.assignees.name) or []
        if not assignees:
            logger.info(f'Ticket #{ticket_id} has no assignees, skip notify.')
            return self._failed_execution(f'Ticket #{ticket_id} has no assignees')

        notify_from_user = AGENT_AUTO_NOTIFY_SENDER if auto_executed else operator

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



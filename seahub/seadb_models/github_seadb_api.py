import logging
import datetime

from seahub.project.seadb_api import SeaDBAPI
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE, ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.project.constants import ConnectionType
from seahub.seadb_models.models import SchemaTables

logger = logging.getLogger(__name__)

_COMMENTS_OMITTED_NOTICE = '[comments omitted due to content limit]'
_MORE_COMMENTS_OMITTED_NOTICE = '[more comments omitted due to content limit]'


def _truncate_content_with_ellipsis(content, max_length):
    content = content or ''
    if max_length <= 0:
        return ''
    if len(content) <= max_length:
        return content
    if max_length <= 3:
        return '.' * max_length
    return content[:max_length - 3] + '...'


def _build_comment_notice(content):
    return {
        'author': None,
        'content': content,
        'created_time': None,
    }


class GitHubSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_issues_by_connection_id(self, connection_id, start, limit):
        """Retrieve all issue for the specified connection_id."""
        table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        sql = "SELECT `_pk`, `issue_id`, `issue_number`, `title`, `content`, `state`, `state_reason`, " \
            f"`labels`, `issue_type`, `author`, `url`, `created_time`, `modified_time`, `comment_count` FROM `{table_name}` LIMIT {limit} OFFSET {start}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_issue_by_pk(self, connection_id, _pk):
        """Retrieve issue for the specified _pk."""
        table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        sql = "SELECT `_pk`, `issue_id`, `issue_number`, `title`, `content` " \
            f"FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_comments_by_issue_id(self, connection_id, issue_id, limit=None):
        table_name = SchemaTables.GITHUB_ISSUE_COMMENTS.table_name(connection_id)
        sql = "SELECT `issue_id`, `content` " \
            f"FROM `{table_name}` WHERE `issue_id` = {issue_id}"
        if limit is not None:
            sql += f" LIMIT {limit}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def update_issue_record(self, project_uuid, connection_id, record_pk, issue_data):
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        update_row = {
            'pk': int(record_pk),
            'row': {
                SchemaTables.GITHUB_ISSUES.column.title.name: issue_data.get('title', ''),
                SchemaTables.GITHUB_ISSUES.column.labels.name: issue_data.get('labels', []),
                SchemaTables.GITHUB_ISSUES.column.issue_type.name: issue_data.get('issue_type', ''),
                SchemaTables.GITHUB_ISSUES.column.state.name: issue_data.get('state', ''),
                SchemaTables.GITHUB_ISSUES.column.state_reason.name: issue_data.get('state_reason', ''),
                SchemaTables.GITHUB_ISSUES.column.record_modified_time.name: now_datetime,
            }
        }

        self.seadb_api.update_rows(project_uuid, table_name, [update_row])
        return True
    
    def get_issues_by_pks(self, connection_id, _pks):
        _pks_str = ', '.join([
            str(_pk)
            for _pk in _pks
        ])
        table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        sql = "SELECT `_pk`, `issue_id`, `title`, `content`, `state`, `url`, `created_time` " \
            f"FROM `{table_name}` WHERE `_pk` in ({_pks_str})"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])
    
    def get_comments_by_issue_ids(self, connection_id, issue_ids):
        if not issue_ids:
            return {}

        table_name = SchemaTables.GITHUB_ISSUE_COMMENTS.table_name(connection_id)
        issue_ids_str = ', '.join(str(issue_id) for issue_id in issue_ids)
        sql = "SELECT `comment_id`, `issue_id`, `author`, `content`, `created_time` " \
            f"FROM `{table_name}` WHERE `issue_id` in ({issue_ids_str}) ORDER BY `issue_id` ASC, `comment_id` ASC"
        comments = self.seadb_api.query_rows(self.base_id, sql).get('results', [])
        result = {}
        for comment in comments:
            issue_id = comment['issue_id']
            if issue_id not in result:
                result[issue_id] = [comment]
            else:
                result[issue_id].append(comment)
        return result

    def _get_selected_issue_comments_for_attachment(self, issue_comments, body_content_length, limit_for_each_id):
        if body_content_length >= ATTACHMENT_CONTENT_MAX_SIZE:
            return [_build_comment_notice(_COMMENTS_OMITTED_NOTICE)]

        if not issue_comments:
            return []

        first_comment = issue_comments[0]
        remaining_size = ATTACHMENT_CONTENT_MAX_SIZE - body_content_length
        first_content = first_comment.get('content', '') or ''
        if len(first_content) > remaining_size:
            selected_comments = []
            truncated_content = _truncate_content_with_ellipsis(first_content, remaining_size)
            if truncated_content:
                selected_comments.append({
                    **first_comment,
                    'content': truncated_content,
                })
            selected_comments.append(_build_comment_notice(_MORE_COMMENTS_OMITTED_NOTICE))
            return selected_comments

        latest_comments = issue_comments[-limit_for_each_id:] if limit_for_each_id > 0 else []
        comments_by_id = {
            comment['comment_id']: comment
            for comment in latest_comments
        }
        comments_by_id[first_comment['comment_id']] = first_comment
        comments = [comments_by_id[comment_id] for comment_id in sorted(comments_by_id)]

        selected_comments = []
        total_content_size = body_content_length
        for comment in comments:
            content = comment.get('content', '') or ''
            remaining_size = ATTACHMENT_CONTENT_MAX_SIZE - total_content_size
            if remaining_size <= 0:
                break

            if len(content) > remaining_size:
                truncated_content = _truncate_content_with_ellipsis(content, remaining_size)
                if truncated_content:
                    selected_comments.append({
                        **comment,
                        'content': truncated_content,
                    })
                selected_comments.append(_build_comment_notice(_MORE_COMMENTS_OMITTED_NOTICE))
                break

            selected_comments.append(comment)
            total_content_size += len(content)

        return selected_comments
    
    def get_whole_github_issue_data(self, connection_ids_pks):
        """
        Build a dict object from a github issue and its comments.

        Args:
        - pconnection_ids_pks: [{"connection_id", "record_id"}]

        Returns:
        [
            {
                "type": github_issue,
                "connection_id": ...,
                "record_id": ...,
                "state": ...,
                "title": ...,
                "content": ...,
                "created_at": ...,
                "comments": [
                    {
                        "author": ...,
                        "content": ...,
                        "created_time": ...,
                    },
                    ...
                ]
            },
            # {...}
        ]
        """
        connection_ids_pks_map = {}
        for connection_id_pk in connection_ids_pks:
            if connection_id_pk['connection_id'] not in connection_ids_pks_map:
                connection_ids_pks_map[connection_id_pk['connection_id']] = [connection_id_pk['record_id']]
            else:
                connection_ids_pks_map[connection_id_pk['connection_id']].append(connection_id_pk['record_id'])
        
        result = []
        for connection_id, _pks in connection_ids_pks_map.items():
            issues = self.get_issues_by_pks(connection_id, _pks)
            issues_comments_map = self.get_comments_by_issue_ids(
                connection_id, [issue['issue_id'] for issue in issues]
            )
            for issue_data in issues:
                full_content = issue_data.get('content', '') or ''
                whole_issue_data = {
                    'type': ConnectionType.GITHUB_ISSUE.value,
                    'connection_id': int(connection_id),
                    'record_id': int(issue_data['_pk']),
                    'state': issue_data.get('state'),
                    'title': issue_data.get('title'),
                    'content': full_content[:ATTACHMENT_CONTENT_MAX_SIZE],
                    'url': issue_data.get('url'),
                    'created_at': issue_data.get('created_time'),
                    'comments': []
                }

                comments = self._get_selected_issue_comments_for_attachment(
                    issues_comments_map.get(issue_data['issue_id'], []), len(full_content), ATTACHMENT_ISSUE_MAX_COMMENTS,
                )
                for comment in comments:
                    whole_issue_data['comments'].append({
                        'author': comment.get('author'),
                        'content': comment.get('content', ''),
                        'created_time': comment.get('created_time')
                    })
                result.append(whole_issue_data)
        return result

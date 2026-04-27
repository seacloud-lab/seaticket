import logging
import datetime

from seahub.project.seadb_api import SeaDBAPI
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE, ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.seadb_models.models import GithubIssuesTable, GithubIssueCommentsTable
from seahub.project.constants import ConnectionType

logger = logging.getLogger(__name__)

GITHUB_ISSUE_LIST_QUERY_COLUMNS = ', '.join([
    '`_pk`',
    f'`{GithubIssuesTable.issue_id.name}`',
    f'`{GithubIssuesTable.issue_number.name}`',
    f'`{GithubIssuesTable.title.name}`',
    f'`{GithubIssuesTable.content.name}`',
    f'`{GithubIssuesTable.state.name}`',
    f'`{GithubIssuesTable.state_reason.name}`',
    f'`{GithubIssuesTable.labels.name}`',
    f'`{GithubIssuesTable.issue_type.name}`',
    f'`{GithubIssuesTable.author.name}`',
    f'`{GithubIssuesTable.url.name}`',
    f'`{GithubIssuesTable.created_time.name}`',
    f'`{GithubIssuesTable.modified_time.name}`',
    f'`{GithubIssuesTable.comment_count.name}`',
    f'`{GithubIssuesTable.linked_ticket.name}`',
    f'`{GithubIssuesTable.deleted.name}`',
])
GITHUB_ISSUE_DETAIL_QUERY_COLUMNS = ', '.join([
    '`_pk`',
    f'`{GithubIssuesTable.issue_id.name}`',
    f'`{GithubIssuesTable.issue_number.name}`',
    f'`{GithubIssuesTable.title.name}`',
    f'`{GithubIssuesTable.content.name}`',
    f'`{GithubIssuesTable.linked_ticket.name}`',
])
GITHUB_ISSUE_ATTACHMENT_QUERY_COLUMNS = ', '.join([
    '`_pk`',
    f'`{GithubIssuesTable.issue_id.name}`',
    f'`{GithubIssuesTable.title.name}`',
    f'`{GithubIssuesTable.content.name}`',
    f'`{GithubIssuesTable.state.name}`',
    f'`{GithubIssuesTable.url.name}`',
    f'`{GithubIssuesTable.created_time.name}`',
])
GITHUB_COMMENT_QUERY_COLUMNS = ', '.join([
    f'`{GithubIssueCommentsTable.issue_id.name}`',
    f'`{GithubIssueCommentsTable.author.name}`',
    f'`{GithubIssueCommentsTable.content.name}`',
    f'`{GithubIssueCommentsTable.created_time.name}`',
])


class GitHubSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_issues_by_connection_id(self, connection_id, start, limit):
        """Retrieve all issue for the specified connection_id."""
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT {GITHUB_ISSUE_LIST_QUERY_COLUMNS} FROM `{table_name}` LIMIT {limit} OFFSET {start}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_issue_by_pk(self, connection_id, _pk):
        """Retrieve issue for the specified _pk."""
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT {GITHUB_ISSUE_DETAIL_QUERY_COLUMNS} FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_comments_by_issue_id(self, connection_id, issue_id, limit=None):
        table_name = GithubIssueCommentsTable.gen_table_name(connection_id)
        sql = f"SELECT {GITHUB_COMMENT_QUERY_COLUMNS} FROM `{table_name}` WHERE `issue_id` = {issue_id}"
        if limit is not None:
            sql += f" LIMIT {limit}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def update_issue_record(self, project_uuid, connection_id, record_pk, issue_data):
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        update_row = {
            'pk': int(record_pk),
            'row': {
                GithubIssuesTable.title.name: issue_data.get('title', ''),
                GithubIssuesTable.labels.name: issue_data.get('labels', []),
                GithubIssuesTable.issue_type.name: issue_data.get('issue_type', ''),
                GithubIssuesTable.state.name: issue_data.get('state', ''),
                GithubIssuesTable.state_reason.name: issue_data.get('state_reason', ''),
                GithubIssuesTable.record_modified_time.name: now_datetime,
            }
        }

        self.seadb_api.update_rows(project_uuid, table_name, [update_row])
        return True
    
    def get_issues_by_pks(self, connection_id, _pks):
        _pks_str = ', '.join([
            str(_pk)
            for _pk in _pks
        ])
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT {GITHUB_ISSUE_ATTACHMENT_QUERY_COLUMNS} FROM `{table_name}` WHERE `_pk` in ({_pks_str})"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])
    
    def get_comments_by_issue_ids(self, connection_id, issue_ids, limit_for_each_id):
        table_name = GithubIssueCommentsTable.gen_table_name(connection_id)
        sql = (
            f"SELECT {GITHUB_COMMENT_QUERY_COLUMNS} FROM `{table_name}` "
            f"WHERE `issue_id` in ({', '.join(issue_ids)}) LIMIT 0, {len(issue_ids) * limit_for_each_id}"
        )
        response = self.seadb_api.query_rows(self.base_id, sql)
        comments = response.get('results', [])
        result = {}
        for comment in comments:
            if comment['issue_id'] not in result:
                result[comment['issue_id']] = [comment]
            elif len(result[comment['issue_id']]) < limit_for_each_id:
                result[comment['issue_id']].append(comment)
        return result
    
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
            issue_ids = [str(issue['issue_id']) for issue in issues]
            issues_comments_map = self.get_comments_by_issue_ids(connection_id, issue_ids, ATTACHMENT_ISSUE_MAX_COMMENTS)
            for issue_data in issues:
                whole_issue_data = {
                    'type': ConnectionType.GITHUB_ISSUE.value,
                    'connection_id': int(connection_id),
                    'record_id': int(issue_data['_pk']),
                    'state': issue_data.get('state'),
                    'title': issue_data.get('title'),
                    'content': issue_data.get('content', '')[:ATTACHMENT_CONTENT_MAX_SIZE],
                    'url': issue_data.get('url'),
                    'created_at': issue_data.get('created_time'),
                    'comments': []
                }

                total_content_size = len(whole_issue_data['content'])
                for comment in issues_comments_map.get(issue_data['issue_id'], []):
                    content = comment.get('content', '')
                    total_content_size += len(content)

                    # break if exceed maximum content size
                    if total_content_size > ATTACHMENT_CONTENT_MAX_SIZE:
                        break

                    whole_issue_data['comments'].append({
                        'author': comment.get('author'),
                        'content': content,
                        'created_time': comment.get('created_time')
                    })
                result.append(whole_issue_data)
        return result

import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.settings import AI_CHAT_GITHUB_ISSUE_MAX_COMMENTS_NUM
from seahub.seadb_models.models import GithubIssuesTable, GithubIssueCommentsTable

logger = logging.getLogger(__name__)


class GitHubSeaDBAPI:
    def __init__(self, base_id, username='', timeout=30):
        self.base_id = base_id
        self.seadb_api = SeaDBAPI(username=username, timeout=timeout)

    def get_issues_by_connection_id(self, connection_id, start, limit):
        """Retrieve all issue for the specified connection_id."""
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` LIMIT {limit} OFFSET {start}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_issue_by_pk(self, connection_id, _pk):
        """Retrieve issue for the specified _pk."""
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_comments_by_issue_id(self, connection_id, issue_id, limit=None):
        table_name = GithubIssueCommentsTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `issue_id` = {issue_id}"
        if limit is not None:
            sql += f" LIMIT {limit}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []
    
    def get_issues_by_pks(self, connection_id, _pks):
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` in ({', '.join(_pks)})"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])
    
    def get_comments_by_issue_ids(self, connection_id, issue_ids, limit_for_each_id):
        table_name = GithubIssueCommentsTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `issue_id` in ({', '.join(issue_ids)}) LIMIT 0, {len(issue_ids) * limit_for_each_id}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        comments = response.get('results', [])
        result = {}
        for comment in comments:
            if comment['issue_id'] not in result:
                result[comment['issue_id']] = [comment]
            elif len(result[comment['issue_id']]) < limit_for_each_id:
                result[comment['issue_id']].append(comment)
        return result
    
    def get_whole_issues_data(self, connection_ids_pks):
        """
        Build a dict object from a github issue and its comments.

        Args:
        - pconnection_ids_pks: [{"connection_id", "_pk"}]

        Returns:
        [
            {
                "type": issue,
                "connection_id": ...,
                "issue_id": ...,
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
                connection_ids_pks_map[connection_id_pk['connection_id']] = [connection_id_pk['issue_id']]
            else:
                connection_ids_pks_map[connection_id_pk['connection_id']].append(connection_id_pk['issue_id'])
        
        result = []
        for connection_id, _pks in connection_ids_pks_map.items():
            _pks_str = [str(_pk) for _pk in _pks]
            issues = self.get_issues_by_pks(connection_id, _pks_str)
            issue_ids = [str(issue['issue_id']) for issue in issues]
            issues_comments_map = self.get_comments_by_issue_ids(connection_id, issue_ids, AI_CHAT_GITHUB_ISSUE_MAX_COMMENTS_NUM)
            for issue_data in issues:
                whole_issue_data = {
                    'type': 'issue',
                    'connection_id': int(connection_id),
                    'issue_id': int(issue_data['_pk']),
                    'state': issue_data.get('state'),
                    'title': issue_data.get('title'),
                    'content': issue_data.get('content'),
                    'url': issue_data.get('url'),
                    'created_at': issue_data.get('created_time'),
                    'comments': []
                }

                for comment in issues_comments_map.get(issue_data['issue_id'], []):
                    whole_issue_data['comments'].append({
                        'author': comment.get('author'),
                        'content': comment.get('content'),
                        'created_time': comment.get('created_time')
                    })

                result.append(whole_issue_data)
        return result

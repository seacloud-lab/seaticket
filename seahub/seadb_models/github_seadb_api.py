import logging

from seahub.project.seadb_api import SeaDBAPI
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

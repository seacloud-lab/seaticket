import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import EmailTable

logger = logging.getLogger(__name__)


class EmailSeaDBAPI:
    def __init__(self, base_id, username='', timeout=30):
        self.base_id = base_id
        self.seadb_api = SeaDBAPI(username=username, timeout=timeout)

    def get_issue_by_pk(self, connection_id, _pk):
        """Retrieve issue for the specified _pk."""
        table_name = EmailTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_emails_by_thread_id(self, connection_id, thread_id, limit=None):
        table_name = EmailTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `thread_id` = {thread_id} ORDER BY {EmailTable.modified_time.name} ASC "
        if limit is not None:
            sql += f" LIMIT {limit}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

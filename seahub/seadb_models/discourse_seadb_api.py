import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import DiscourseTopicsTable, DiscourseRepliesTable


logger = logging.getLogger(__name__)


class DiscourseSeaDBAPI:
    def __init__(self, base_id, username='', timeout=30):
        self.base_id = base_id
        self.seadb_api = SeaDBAPI(username=username, timeout=timeout)

    def get_topics_by_connection_id(self, connection_id, start, limit):
        """Retrieve all topics for the specified connection_id."""
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` LIMIT {limit} OFFSET {start}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_topic_by_pk(self, connection_id, _pk):
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_replies_by_topic_id(self, connection_id, topic_id):
        """Retrieve all replies for the specified topic_id."""
        table_name = DiscourseRepliesTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `topic_id` = {topic_id}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

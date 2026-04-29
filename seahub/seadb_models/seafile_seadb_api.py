import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import SeafileTable
from seahub.project.constants import ConnectionType
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE

logger = logging.getLogger(__name__)


class SeafileSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_seafiles_by_pks(self, connection_id, pks):
        """Retrieve issue for the specified _pk."""
        table_name = SeafileTable.gen_table_name(connection_id)
        pks_str = ', '.join([
            str(pk)
            for pk in pks
        ])
        sql = "SELECT `_pk`, `title`, `content` " \
            f"FROM `{table_name}` WHERE `_pk` in ({pks_str}) AND (`deleted` = False OR `deleted` IS NULL)"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_whole_seafiles_data(self, connection_ids_pks):
        """
        Build a dict object from an email thread and its emails.

        Args:
        - connection_ids_pks: [{"connection_id": ..., "record_id": ...}]

        Returns:
        [
            {
                "type": "seafile",
                "connection_id": ...,
                "record_id": ...,
                "title": ...,
                "content": ...
            },
            # {...}
        ]
        """
        connection_ids_pks_map = {}
        for connection_id_pk in connection_ids_pks:
            connection_id = connection_id_pk['connection_id']
            document_id = connection_id_pk['record_id']
            if connection_id not in connection_ids_pks_map:
                connection_ids_pks_map[connection_id] = [document_id]
            else:
                connection_ids_pks_map[connection_id].append(document_id)

        result = []
        for connection_id, document_ids in connection_ids_pks_map.items():
            current_seafiles = self.get_seafiles_by_pks(connection_id, document_ids)
            result += [
                {
                    'type': ConnectionType.SEAFILE.value,
                    'connection_id': connection_id,
                    'record_id': seafile['_pk'],
                    'title': seafile['title'],
                    'content': seafile['content'][:ATTACHMENT_CONTENT_MAX_SIZE]
                }
                for seafile in current_seafiles
            ]
        return result

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import SchemaTables


class DiscordSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_thread_by_pk(self, connection_id, _pk):
        table_name = SchemaTables.DISCORD_THREADS.table_name(connection_id)
        sql = (
            "SELECT `_pk`, `thread_id`, `title`, `linked_ticket` "
            f"FROM `{table_name}` WHERE `_pk` = {_pk} AND (`deleted` = False OR `deleted` IS NULL)"
        )
        response = self.seadb_api.query_rows(self.base_id, sql)
        result = response.get('results', [])
        return result[0] if result else {}

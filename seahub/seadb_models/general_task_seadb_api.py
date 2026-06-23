import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.project.constants import ConnectionType
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE

from seahub.seadb_models.models import SchemaTables


logger = logging.getLogger(__name__)


class GeneralTaskSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_general_task_record(self, project_uuid, connection_id, record_id):
        table_name = SchemaTables.GENERAL_TASK.table_name(connection_id)
        sql = (
            f"SELECT `_pk`, `source_task_id`, `url`, `title`, `status`, `size`, `priority`, `assignees`, `participants`, "
            f"`others`, `version`, `content`, `due_date`, `modified_time`, `created_time`, `linked_ticket`, `outdated` "
            f"FROM `{table_name}` WHERE _pk = {int(record_id)} LIMIT 1"
        )
        results = self.seadb_api.query_rows(project_uuid, sql).get('results', [])
        return results[0] if results else {}
    
    def get_tasks_by_pks(self, connection_id, pks):
        """Retrieve task for the specified _pk."""
        table_name = SchemaTables.GENERAL_TASK.table_name(connection_id)
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
    
    def get_whole_general_tasks_data(self, connection_ids_pks):
        """
        Build a dict object from a task.

        Args:
        - connection_ids_pks: [{"connection_id": "", "record_id": ""}]

        Returns:
        [
            {
                "type": "task",
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
            task_id = connection_id_pk['record_id']
            if connection_id not in connection_ids_pks_map:
                connection_ids_pks_map[connection_id] = [task_id]
            else:
                connection_ids_pks_map[connection_id].append(task_id)

        result = []
        for connection_id, task_ids in connection_ids_pks_map.items():
            tasks = self.get_tasks_by_pks(connection_id, task_ids)
            result += [
                {
                    'type': ConnectionType.GENERAL_TASK.value,
                    'connection_id': connection_id,
                    'record_id': task['_pk'],
                    'title': task['title'],
                    'content': task['content'][:ATTACHMENT_CONTENT_MAX_SIZE] if task['content'] else ''
                }
                for task in tasks
            ]
        return result


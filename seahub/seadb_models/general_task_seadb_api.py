import logging
import datetime

from email.utils import formataddr

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import GeneralTaskTable, GeneralTaskUserTable
from seahub.project.constants import ConnectionType

logger = logging.getLogger(__name__)


class GeneralTaskSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_general_task_record(self, project_uuid, connection_id, record_id):
        table_name = GeneralTaskTable.gen_table_name(connection_id)
        sql = (
            f"SELECT `_pk`, `source_task_id`, `title`, `status`, `size`, `priority`, `assignees`, `participants`, "
            f"`others`, `version`, `content`, `due_date`, `modified_time`, `created_time`, `linked_ticket`, `outdated` "
            f"FROM `{table_name}` WHERE _pk = {int(record_id)} LIMIT 1"
        )
        results = self.seadb_api.query_rows(project_uuid, sql).get('results', [])
        return results[0] if results else {}

import os
import sys
import logging
sys.path.append('/opt/seaticket/seaqa-web')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()
from seahub.project.models import Projects
from seahub.project.seadb_api import SeaDBAPI
from seahub.utils import uuid_str_to_36_chars

logger = logging.getLogger(__name__)


class ColumnManager:

    def __init__(self):
        self.seadb_api = SeaDBAPI()
    
    def get_projects_by_page(self, limit, start):
        return Projects.objects.order_by('id').values_list('uuid', flat=True)[start:start + limit]
    
    def is_this_table(self, seadb_table_name):
        if 'tickets' in seadb_table_name or 'portal_issues' in seadb_table_name:
            return True
        return False
    
    def rename_casecade_columns(self):
        limit = 1000
        start = 0
        while True:
            projects = self.get_projects_by_page(limit, start)

            for project_uuid in projects:
                base_id = uuid_str_to_36_chars(project_uuid)
                logger.info('start add column for project %s', project_uuid)
                try:
                    base_info = self.seadb_api.get_base_metadata(project_uuid)
                    
                    tables = base_info['tables'] # type: ignore
                    for table in tables:
                        seadb_table_name = table['name']
                        table_id = table.get('id')
                        if self.is_this_table(seadb_table_name):

                            columns = table.get('columns')
                            state_column_key = None
                            substate_column_key = None
                            substate_column_data = None
                            for column in columns:
                                column_name = column.get('name')
                                if column_name == 'substate':
                                    substate_column_key = column.get('key')
                                    substate_column_data = column.get('data')
                                if column_name == 'state':
                                    state_column_key = column.get('key')

                            if substate_column_key and state_column_key:
                                substate_column_data['cascade_column_key'] = state_column_key # type: ignore

                                column_data = {
                                    'table_id': table_id,
                                    'column_key': substate_column_key,
                                    'update_column_data': substate_column_data,
                                }
                                self.seadb_api.update_column(base_id, column_data)

                            logger.info('Successfully rename casecade column for project %s table %s', project_uuid, seadb_table_name)
                except Exception as e:
                    logger.error("project_uuid:%s fail to rename casecade column , error: %s", project_uuid, str(e))
            
            start += limit

            if len(projects) < limit:
                break


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        stream=sys.stdout,
        force=True,
    )
    try:
        manager = ColumnManager()
        manager.rename_casecade_columns()
    except Exception as e:
        logger.exception(f"Command execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

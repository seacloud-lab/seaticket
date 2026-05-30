import sys
import logging
import argparse

sys.path.append('/opt/seaticket/seaqa-indexer/')

from sqlalchemy import text

from seaqa_indexer.utils.seaqa_db import SeaqaDB
from seaqa_indexer.db import init_db_session_class
from seaqa_indexer.index.utils import init_logging

from seaqa_indexer.utils.seadb_api import SeaDBAPI
from seaqa_indexer.seadb_models.models import PropertyTypes

logger = logging.getLogger(__name__)


class ColumnManager:

    def __init__(self):
        self.db_session_class = init_db_session_class()
        self.seaqa_db = SeaqaDB(self.db_session_class)
        self.seadb_api = SeaDBAPI()
    
    def update_agent_actions_table(self, project_uuid):
        base_info = self.seadb_api.get_base_metadata(project_uuid)
        table = next((t for t in base_info['tables'] if t['name'] == 'agent_actions'), None)
        if not table:
            return
        actions_table_id = table['id']
        self.seadb_api.delete_table(project_uuid, actions_table_id)

        res = self.seadb_api.create_table(project_uuid, 'agent_actions')
        actions_table_id = res['table_id']

        # add columns
        for column in [
            {'column_name': 'run_id', 'column_type': PropertyTypes.INT},
            {'column_name': 'source_type', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'source_id', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'source_title', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'phase', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'prompt', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'result', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'action_type', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'status', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'step', 'column_type': PropertyTypes.INT},
            {'column_name': 'tool_name', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'tool_arguments', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'observation', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'suggestion_content', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'sources', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'statistics', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'created_at', 'column_type': PropertyTypes.DATETIME},
            {'column_name': 'executed_at', 'column_type': PropertyTypes.DATETIME},
        ]:
            self.seadb_api.add_column(project_uuid, actions_table_id, column)
        
        self.seadb_api.create_column_index(
        project_uuid,
        actions_table_id,
        ['run_id', 'created_at'],
    )

    
    def get_projects_by_page(self, limit, start):
        with self.db_session_class() as session:
            sql = """SELECT uuid FROM projects ORDER BY id LIMIT :limit offset :start"""
            projects = session.execute(text(sql), {'limit':limit, 'start': start}).fetchall()
            return projects
    
    def update(self):
        limit = 1000
        start = 0
        while True:
            projects = self.get_projects_by_page(limit, start)

            for project in projects:
                project_uuid = project.uuid
                logger.info('start to update agent_actions for project %s', project_uuid)
                try:
                    self.update_agent_actions_table(project_uuid)
                except Exception as e:
                    logger.exception("project_uuid:%s fail to update agent_actions table error: %s", project_uuid, e)
            
            start += limit

            if len(projects) < limit:
                break



def create_parser():
    parser = argparse.ArgumentParser(description='SeaQA upgrade agent_actions Management Tool')

    parser.add_argument(
        '--logfile',
        default=sys.stdout,
        type=argparse.FileType('a'),
        help='Log file path (default: stdout)'
    )

    parser.add_argument(
        '--loglevel',
        default='info',
        choices=['debug', 'info', 'warning', 'error'],
        help='Logging level (default: info)'
    )

    return parser


def main():
    parser = create_parser()

    args = parser.parse_args()

    init_logging(args)

    try:
        column_manager = ColumnManager()
        column_manager.update()
    except Exception as e:
        logger.exception(f"upgrade agent_actions table failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

import os
import sys
import logging
import argparse
sys.path.append('/opt/seaticket/seaqa-web')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()
from seahub.project.models import Projects
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import PropertyTypes

logger = logging.getLogger(__name__)


def init_logging(args):
    level = {
        'debug': logging.DEBUG,
        'info': logging.INFO,
        'warning': logging.WARNING,
        'error': logging.ERROR,
    }.get(args.loglevel, logging.INFO)
    format = '[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s'
    logging.basicConfig(
        format=format,
        datefmt='%Y-%m-%d %H:%M:%S',
        level=level,
        stream=args.logfile,
        force=True
    )


class TableManager:
    def __init__(self):
        self.seadb_api = SeaDBAPI()
    
    def update_agent_actions_table(self, project_uuid):
        base_info = self.seadb_api.get_base_metadata(project_uuid)
        table = next((t for t in base_info['tables'] if t['name'] == 'agent_actions'), None)
        if table:
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
        logger.info('finish update project_uuid: %s agent_actions table', project_uuid)
    
    
    def get_projects_by_page(self, limit, start):
        return Projects.objects.order_by('id').values_list('uuid', flat=True)[start:start + limit]
    
    def update(self):
        limit = 1000
        start = 0
        while True:
            project_uuids = self.get_projects_by_page(limit, start)
            for project_uuid in project_uuids:
                logger.info('start to update agent_actions for project %s', project_uuid)
                try:
                    self.update_agent_actions_table(str(project_uuid))
                except Exception as e:
                    logger.exception("project_uuid:%s fail to update agent_actions table error: %s", project_uuid, e)
            start += limit
            if len(project_uuids) < limit:
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
        table_manager = TableManager()
        table_manager.update()
    except Exception as e:
        logger.exception(f"upgrade agent_actions table failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

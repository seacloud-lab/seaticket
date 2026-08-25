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

    def _find_table_id(self, project_uuid, table_name):
        base_info = self.seadb_api.get_base_metadata(project_uuid)
        table = next((t for t in base_info['tables'] if t['name'] == table_name), None)
        return table['id'] if table else None

    def _recreate_agent_runs_table(self, project_uuid):
        table_name = 'agent_runs'
        table_id = self._find_table_id(project_uuid, table_name)
        if table_id:
            self.seadb_api.delete_table(project_uuid, table_id)

        created = self.seadb_api.create_table(project_uuid, table_name)
        table_id = created['table_id']
        for column in [
            {'column_name': 'status', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'owner_source_type', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'owner_source_id', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'owner_source_title', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'suggestions_status', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'started_at', 'column_type': PropertyTypes.DATETIME},
            {'column_name': 'finished_at', 'column_type': PropertyTypes.DATETIME},
            {'column_name': 'error_message', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'event', 'column_type': PropertyTypes.TEXT},
        ]:
            self.seadb_api.add_column(project_uuid, table_id, column)

        for index_columns in [['started_at'], ['owner_source_type', 'owner_source_id']]:
            self.seadb_api.create_column_index(project_uuid, table_id, index_columns)

    def _recreate_agent_actions_table(self, project_uuid):
        table_name = 'agent_actions'
        table_id = self._find_table_id(project_uuid, table_name)
        if table_id:
            self.seadb_api.delete_table(project_uuid, table_id)

        created = self.seadb_api.create_table(project_uuid, table_name)
        table_id = created['table_id']
        for column in [
            {'column_name': 'run_id', 'column_type': PropertyTypes.INT},
            {'column_name': 'phase', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'prompt', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'input', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'result', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'action_type', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'status', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'step', 'column_type': PropertyTypes.INT},
            {'column_name': 'tool_name', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'tool_arguments', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'observation', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'suggestion_reason', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'suggestion_content', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'suggestion_payload', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'target_item_type', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'target_item_id', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'target_item_title', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'references', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'statistics', 'column_type': PropertyTypes.TEXT},
            {'column_name': 'created_at', 'column_type': PropertyTypes.DATETIME},
            {'column_name': 'executed_at', 'column_type': PropertyTypes.DATETIME},
        ]:
            self.seadb_api.add_column(project_uuid, table_id, column)

        self.seadb_api.create_column_index(project_uuid, table_id, ['run_id', 'created_at'])

    def rebuild_agent_tables(self, project_uuid):
        self._recreate_agent_runs_table(project_uuid)
        self._recreate_agent_actions_table(project_uuid)
        logger.info(
            'finish rebuild project_uuid: %s agent_runs/agent_actions tables',
            project_uuid,
        )

    def get_projects_by_page(self, limit, start):
        return Projects.objects.order_by('id').values_list('uuid', flat=True)[start:start + limit]

    def update(self):
        limit = 1000
        start = 0
        while True:
            project_uuids = self.get_projects_by_page(limit, start)
            for project_uuid in project_uuids:
                logger.info(
                    'start to rebuild agent tables for project %s, this will clear old logs',
                    project_uuid,
                )
                try:
                    self.rebuild_agent_tables(str(project_uuid))
                except Exception as error:
                    logger.exception(
                        'project_uuid:%s fail to rebuild agent tables error: %s',
                        project_uuid,
                        error,
                    )
            start += limit
            if len(project_uuids) < limit:
                break


def create_parser():
    parser = argparse.ArgumentParser(
        description='SeaQA destructive upgrade for agent_runs and agent_actions'
    )
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
    except Exception as error:
        logger.exception('upgrade agent tables failed: %s', error)
        sys.exit(1)


if __name__ == "__main__":
    main()

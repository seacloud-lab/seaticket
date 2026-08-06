import os
import sys
import logging
import argparse
sys.path.append('/opt/seaticket/seaqa-web')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()

from django.db import connection
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import PropertyTypes
from seahub.seadb_models.models import SchemaTables

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
    
    def get_project_connections_by_page(self, limit, start):
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT pc.id, pc.project_uuid
                FROM project_connection pc 
                INNER JOIN projects p 
                ON p.uuid=pc.project_uuid 
                WHERE p.deleted=false AND pc.deleted=false AND pc.type='email' LIMIT %s OFFSET %s
            """, [limit, start])
            return cursor.fetchall()

    def add_unread_column(self, project_connection):
        connection_id, project_uuid = project_connection
        base_info = self.seadb_api.get_base_metadata(project_uuid)
        email_table_name = SchemaTables.EMAIL.table_name(connection_id)
        
        table = next((t for t in base_info['tables'] if t['name'] == email_table_name), None)
        if not table:
            return
        email_table_id = table['id']

        email_unread_column = {'column_name': 'unread', 'column_type': PropertyTypes.BOOL}

        self.seadb_api.add_column(project_uuid, email_table_id, email_unread_column)
        
        self.seadb_api.create_column_index(
            project_uuid,
            email_table_id,
            ['thread_id'],
        )
    
    def add_unread_columns(self):
        logger.info('start add unread column')
        limit = 1000
        start = 0
        while True:
            project_connections = self.get_project_connections_by_page(limit, start)
            for project_connection in project_connections:
                connection_id, project_uuid = project_connection
                logger.info('project %s connection_id %s start to add unread column', project_uuid, connection_id)
                try:
                    self.add_unread_column(project_connection)
                    logger.info('project %s connection_id %s finish to add unread column', project_uuid, connection_id)
                except Exception as e:
                    logger.exception("project_uuid %s connection_id %s fail to add unread column error: %s", project_uuid, connection_id, e)
            start += limit
            if len(project_connections) < limit:
                break
        logger.info('finish add unread column')
    

    def mark_email_as_read(self, project_connection):
        connection_id, project_uuid = project_connection
        email_table_name = SchemaTables.EMAIL.table_name(connection_id)

        try:
            page_size = 100
            offset = 0
            while True:
                sql = f"""SELECT _pk FROM `{email_table_name}` LIMIT {page_size} OFFSET {offset}"""
                result = self.seadb_api.query_rows(project_uuid, sql)
                rows = result.get('results', [])

                if not rows:
                    break

                update_rows = []
                for row in rows:
                    _pk = row.get('_pk')
                    update_row = {
                        "pk": _pk,
                        "row": {
                            'unread': False
                        }
                    }
                    update_rows.append(update_row)
                if update_rows:
                    self.seadb_api.update_rows(project_uuid, email_table_name, update_rows)

                offset += page_size
        except Exception as e:
            logger.error('fail to mark read email project_uuid: %s, table_name: %s, error: %s', project_uuid, email_table_name, e)

    def mark_old_emails_as_read(self):
        logger.info('start mark old emails as read')
        limit = 1000
        start = 0
        while True:
            project_connections = self.get_project_connections_by_page(limit, start)
            for project_connection in project_connections:
                connection_id, project_uuid = project_connection
                logger.info('project %s connection_id %s start to mark old emails as read', project_uuid, connection_id)
                try:
                    self.mark_email_as_read(project_connection)
                except Exception as e:
                    logger.exception("project_uuid %s connection_id %s fail to mark old emails error: %s", project_uuid, connection_id, e)
            start += limit
            if len(project_connections) < limit:
                break
        logger.info('finish mark old emails as read')


def create_parser():
    parser = argparse.ArgumentParser(description='SeaQA migrate email Management Tool')

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
        table_manager.add_unread_columns()
        table_manager.mark_old_emails_as_read()
    except Exception as e:
        logger.exception(f"migrate email table failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

# encoding: utf-8

import logging
from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'count rows of users or orgs from table dtable_info'
    label = 'count_user_org_rows'

    def handle(self, *args, **options):
        logger.debug('Start counting rows of users or orgs')
        self.stdout.write('[%s] Start counting rows of users or orgs...\n' % datetime.now())
        self.do_action()
        self.stdout.write('[%s] Finish counting rows of users or orgs...\n' % datetime.now())
        logger.debug('Finish counting rows of users or orgs')

    def do_action(self):
        # user sql
        user_sql = '''
            INSERT INTO user_rows_count(username, rows_count, rows_count_update_at)
            SELECT w.owner AS username, SUM(drc.rows_count) AS rows_count, %s FROM dtable_rows_count drc
            JOIN dtables d ON drc.dtable_uuid=d.uuid
            JOIN workspaces w ON d.workspace_id=w.id
            WHERE w.org_id=-1 AND d.deleted=0 AND w.owner NOT LIKE '%%seafile_group'
            GROUP BY w.owner
            ON DUPLICATE KEY UPDATE username=VALUES(username), rows_count=VALUES(rows_count), rows_count_update_at=VALUES(rows_count_update_at);
        '''
        # org sql
        org_sql = '''
            INSERT INTO org_rows_count(org_id, rows_count, rows_count_update_at)
            SELECT w.org_id AS org_id, SUM(drc.rows_count) AS rows_count, %s FROM dtable_rows_count drc
            JOIN dtables d ON drc.dtable_uuid=d.uuid
            JOIN workspaces w ON d.workspace_id=w.id
            WHERE w.org_id!=-1 AND d.deleted=0
            GROUP BY w.org_id
            ON DUPLICATE KEY UPDATE org_id=VALUES(org_id), rows_count=VALUES(rows_count), rows_count_update_at=VALUES(rows_count_update_at);
        '''
        with connection.cursor() as cursor:
            try:
                cursor.execute(user_sql, [datetime.utcnow()])
                cursor.execute(org_sql, [datetime.utcnow()])
            except Exception as e:
                self.log_error(e)

    def log_debug(self, msg):
        logger.debug(msg)
        self.print_log(msg)

    def log_info(self, msg):
        logger.info(msg)
        self.print_log(msg)

    def log_error(self, msg):
        logger.error(msg)
        self.print_log(msg)

    def print_log(self, msg):
        self.stdout.write('[%s] %s\n' % (str(datetime.now()), msg))

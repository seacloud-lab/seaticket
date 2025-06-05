# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from django.db import connection, connections
from django.conf import settings
from django.core.management.base import BaseCommand


ENABLE_OPERATION_LOG_DB = getattr(settings, 'ENABLE_OPERATION_LOG_DB', False)
KEY_OPERATION_LOG = 'operation_log'

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean db op log'
    label = "clean_db_op_log"

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30,
                            help='Must be an integer greater than zero')

    # Clean up the records of the previous few days in the dtable_db_op_log table
    def handle(self, *args, **options):
        logger.info('Start clean dtable_db_op_log records.')
        self.stdout.write('[%s] Start clean dtable_db_op_log records.' % datetime.now())

        days = options['days']
        if days < 0:
            logger.error('days: %s invalid.', days)
            self.stdout.write('[%s] days: %s invalid.' % (datetime.now(), days))
            return
        logger.info('Clean days: %s.', days)
        self.stdout.write('[%s] Clean days: %s.' % (datetime.now(), days))

        sql = f"SELECT COUNT(1) FROM dtable_db_op_log WHERE op_time < UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL {days} DAY))*1000"
        if not ENABLE_OPERATION_LOG_DB:
            with connection.cursor() as cursor:
                cursor.execute(sql)
                count = cursor.fetchone()[0]
        else:
            with connections[KEY_OPERATION_LOG].cursor() as operation_log_cursor:
                operation_log_cursor.execute(sql)
                count = operation_log_cursor.fetchone()[0]
        logger.info('Clean days: %s count: %s.', days, count)
        self.stdout.write('[%s] Clean days: %s count: %s.' % (datetime.now(), days, count))

        # clean operation_log records
        logger.info('Cleaning up dtable_db_op_log records...')
        self.stdout.write('[%s] Cleaning up dtable_db_op_log records...' % datetime.now())
        for i in range(0, count, 10000):
            clean_sql = f"""DELETE FROM `dtable_db_op_log` WHERE 
                           op_time < UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL {days} DAY))*1000 LIMIT 10000"""
            try:
                if not ENABLE_OPERATION_LOG_DB:
                    with connection.cursor() as cursor:
                        cursor.execute(clean_sql)
                        row_count = cursor.rowcount
                else:
                    with connections[KEY_OPERATION_LOG].cursor() as operation_log_cursor:
                        operation_log_cursor.execute(clean_sql)
                        row_count = operation_log_cursor.rowcount
                logger.info('Successfully step cleaned dtable_db_op_log records: %s.' % row_count)
                self.stderr.write('[%s] Successfully step cleaned dtable_db_op_log records: %s.' % (datetime.now(), row_count))
            except Exception as e:
                logger.error('Failed to clean dtable_db_op_log records, error: %s.' % e)
                self.stderr.write('[%s] Failed to clean dtable_db_op_log records, error: %s.' % (datetime.now(), e))
                return

        logger.info('Successfully cleaned dtable_db_op_log records.')
        self.stdout.write('[%s] Successfully cleaned dtable_db_op_log records.' % datetime.now())

# -*- coding: utf-8 -*-
import logging
from datetime import datetime
from importlib import import_module

from django.db import connection, connections
from django.conf import settings
from django.core.management.base import BaseCommand

ENABLE_OPERATION_LOG_DB = getattr(settings, 'ENABLE_OPERATION_LOG_DB', False)
KEY_OPERATION_LOG = 'operation_log'

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean database records.'
    label = "clean_db_records"

    clean_sql1 = "DELETE FROM `dtable_snapshot` WHERE `ctime` < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 365 DAY))*1000"
    clean_sql2 = "DELETE FROM `activities` WHERE `op_time` < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    clean_sql3 = "DELETE FROM `operation_log` WHERE `op_time` < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 14 DAY))*1000"
    clean_sql4 = "DELETE FROM `notifications_usernotification` WHERE `timestamp` < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    clean_sql5 = "DELETE FROM `dtable_notifications` WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    clean_sql6 = "DELETE FROM `session_log` WHERE `op_time` < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    clean_sql7 = "DELETE FROM `delete_operation_log` WHERE `op_time`" \
                 "< UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 30 DAY))*1000"
    clean_sql8 = "DELETE FROM `dtable_notifications` WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    clean_sql9 = "DELETE FROM `auto_rules_task_log` WHERE `trigger_time` < DATE_SUB(NOW(), INTERVAL 14 DAY)"
    clean_sql10 = "DELETE FROM `dtable_db_op_log` WHERE `op_time` < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 14 DAY))*1000"

    def handle(self, *args, **options):
        logger.debug('Start clean database records.')
        self.stdout.write('[%s] Start clean database records.' % datetime.now())
        self.clean_records()
        self.clean_sessions()
        self.stdout.write('[%s] Finish clean database records.\n' % datetime.now())
        logger.debug('Finish clean database records.\n')

    def clean_records(self):
        with connection.cursor() as cursor:
            try:
                cursor.execute(self.clean_sql1)
                cursor.execute(self.clean_sql2)
                if not ENABLE_OPERATION_LOG_DB:
                    cursor.execute(self.clean_sql3)
                cursor.execute(self.clean_sql4)
                cursor.execute(self.clean_sql5)
                cursor.execute(self.clean_sql6)
                cursor.execute(self.clean_sql7)
                cursor.execute(self.clean_sql8)
                cursor.execute(self.clean_sql9)
                if not ENABLE_OPERATION_LOG_DB:
                    cursor.execute(self.clean_sql10)
            except Exception as e:
                logger.error('Failed to clean database records, error: %s.' % e)
                self.stderr.write('[%s] Failed to clean database records, error: %s.' % (datetime.now(), e))
                return
        # # operation_log_db
        if ENABLE_OPERATION_LOG_DB:
            with connections[KEY_OPERATION_LOG].cursor() as operation_log_cursor:
                try:
                    operation_log_cursor.execute(self.clean_sql3)
                except Exception as e:
                    logger.error('Failed to clean database records from operation_log_db, error: %s.' % e)
                    self.stderr.write('[%s] Failed to clean database records from operation_log_db, error: %s.' % (datetime.now(), e))
                    return

        logger.debug('Successful clean database records.')
        self.stdout.write('[%s] Successful clean database records.' % datetime.now())

    def clean_sessions(self):
        engine = import_module(settings.SESSION_ENGINE)
        try:
            engine.SessionStore.clear_expired()
        except NotImplementedError:
            logger.error(
                "Session engine '%s' doesn't support clearing expired "
                "sessions." % settings.SESSION_ENGINE)
            self.stderr.write(
                "[%s] Session engine '%s' doesn't support clearing expired "
                "sessions." % (datetime.now(), settings.SESSION_ENGINE))
            return

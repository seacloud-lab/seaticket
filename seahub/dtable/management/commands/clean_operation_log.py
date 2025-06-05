# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from django.db import connection, connections
from django.conf import settings
from django.core.management.base import BaseCommand

from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.utils import get_inner_dtable_server_url


ENABLE_OPERATION_LOG_DB = getattr(settings, 'ENABLE_OPERATION_LOG_DB', False)
KEY_OPERATION_LOG = 'operation_log'

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean operation_log'
    label = "clean_operation_log"

    # Clean up the records of the previous few days in the operation_log table
    def handle(self, *args, **options):
        logger.info('Start clean operation_log records.')
        self.stdout.write('[%s] Start clean operation_log records.' % datetime.now())

        # get dtable_uuid and max op_id from operation_log
        sql1 = """SELECT DISTINCT(dtable_uuid), MAX(op_id) FROM operation_log WHERE
                  op_time < UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY))*1000 group by dtable_uuid"""
        try:
            logger.info('Start query dtable_uuid and max op_id from operation_log table.')
            self.stdout.write('[%s] Start query dtable_uuid and max op_id from operation_log table.' % datetime.now())
            if not ENABLE_OPERATION_LOG_DB:
                with connection.cursor() as cursor:
                    cursor.execute(sql1)
                    res1 = cursor.fetchall()
            else:
                with connections[KEY_OPERATION_LOG].cursor() as operation_log_cursor:
                    operation_log_cursor.execute(sql1)
                    res1 = operation_log_cursor.fetchall()
            logger.info('Successfully queried dtable_uuid and max op_id, result length: %s.' % len(res1))
            self.stdout.write('[%s] Successfully queried dtable_uuid and max op_id, result length: %s.' %
                              (datetime.now(), len(res1)))
        except Exception as e:
            logger.error('Failed to query operation_log records, error: %s.' % e)
            self.stderr.write('[%s] Failed to query operation_log records, error: %s.' % (datetime.now(), e))
            return

        dtable_uuid_list = list()
        for dtable_uuid, op_id in res1:
            dtable_uuid_list.append(dtable_uuid)

        # get dtable_uuid and latest version from operation_checkpoint that have been updated recently
        logger.info('Start query latest version from operation_checkpoint table.')
        self.stdout.write('[%s] Start query latest version from operation_checkpoint table.' % datetime.now())
        operation_checkpoint_map = dict()
        for i in range(0, len(dtable_uuid_list), 1000):
            sql2 = """SELECT `dtable_uuid`, `op_id` as latest_version FROM `operation_checkpoint`
                      WHERE dtable_uuid IN %s"""
            try:
                with connection.cursor() as cursor:
                    cursor.execute(sql2, [dtable_uuid_list[i: i+1000]])
                    res2 = cursor.fetchall()
            except Exception as e:
                logger.error('Failed to query operation_checkpoint records, error: %s.' % e)
                self.stderr.write('[%s] Failed to query operation_checkpoint records, error: %s.' % (datetime.now(), e))
                return

            for dtable_uuid, latest_version in res2:
                operation_checkpoint_map[dtable_uuid] = latest_version
        logger.info('Successfully queried latest version, result length: %s.' % len(operation_checkpoint_map))
        self.stdout.write('[%s] Successfully queried latest version, result length: %s.' %
                          (datetime.now(), len(operation_checkpoint_map)))

        need_save_uuids = list()
        for dtable_uuid, op_id in res1:
            if dtable_uuid not in operation_checkpoint_map or op_id > operation_checkpoint_map[dtable_uuid]:
                need_save_uuids.append(dtable_uuid)
        logger.info('Successfully queried need to be saved bases, count: %s.' % len(need_save_uuids))
        self.stdout.write('[%s] Successfully queried need to be saved bases, count: %s.' %
                          (datetime.now(), len(need_save_uuids)))

        if need_save_uuids:
            # check if these bases have been deleted
            dtables_map = dict()
            for i in range(0, len(need_save_uuids), 1000):
                sql3 = """SELECT `uuid`, `deleted` FROM dtables WHERE uuid IN %s"""
                try:
                    logger.info('Start query the deletion status of bases.')
                    self.stdout.write('[%s] Start query the deletion status of bases.' % datetime.now())
                    with connection.cursor() as cursor:
                        cursor.execute(sql3, [need_save_uuids[i: i + 1000]])
                        res3 = cursor.fetchall()
                    logger.info('Successfully queried the deletion status of bases, result length: %s.' % len(res3))
                    self.stdout.write('[%s] Successfully queried the deletion status of bases, result length: %s.' %
                                      (datetime.now(), len(res3)))
                except Exception as e:
                    logger.error('Failed to query dtables records, error: %s.' % e)
                    self.stderr.write('[%s] Failed to query dtables records, error: %s.' % (datetime.now(), e))
                    return

                for uuid, deleted in res3:
                    dtables_map[uuid] = int(deleted)

            # apply pending operation_log for few bases
            dtable_server_url = get_inner_dtable_server_url()
            for uuid in need_save_uuids:
                logger.info('Apply pending operation_log for base: %s' % uuid)
                self.stdout.write('[%s] Apply pending operation_log for base: %s.' % (datetime.now(), uuid))
                if uuid not in dtables_map or dtables_map[uuid] == 1:
                    logger.info('Base %s has been deleted, skip.' % uuid)
                    self.stdout.write('[%s] Base %s has been deleted, skip.' % (datetime.now(), uuid))
                    continue

                kwargs = {
                    'op': 'apply pending operation_log'
                }
                dtable_server_api = DTableServerAPI('dtable-web', uuid, dtable_server_url, kwargs=kwargs)
                try:
                    dtable_server_api.apply_pending_operations()
                except Exception as e:
                    logger.error('Failed to apply pending operation_log, error: %s.' % e)
                    self.stderr.write('[%s] Failed to apply pending operation_log, error: %s.' % (datetime.now(), e))
                    return

                logger.info('Successfully applied pending operation_log for base: %s' % uuid)
                self.stdout.write('[%s] Successfully applied pending operation_log for base: %s.' %
                                  (datetime.now(), uuid))

            logger.info('Successfully applied all pending operation_log.')
            self.stdout.write('[%s] Successfully applied all pending operation_log.' % datetime.now())

        # count need clean records
        count_sql = """SELECT COUNT(1) FROM `operation_log` WHERE 
                       op_time < UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY))*1000"""
        try:
            logger.info('Start count need to be cleaned up records.')
            self.stdout.write('[%s] Start count need to be cleaned up records.' % datetime.now())
            if not ENABLE_OPERATION_LOG_DB:
                with connection.cursor() as cursor:
                    cursor.execute(count_sql)
                    count = int(cursor.fetchone()[0])
            else:
                with connections[KEY_OPERATION_LOG].cursor() as operation_log_cursor:
                    operation_log_cursor.execute(count_sql)
                    count = int(operation_log_cursor.fetchone()[0])
            logger.info('The number of that need to be cleaned up records: %s' % count)
            self.stdout.write('[%s] The number of that need to be cleaned up records: %s' % (datetime.now(), count))
        except Exception as e:
            logger.error('Failed to count operation_log records, error: %s.' % e)
            self.stderr.write('[%s] Failed to count operation_log records, error: %s.' % (datetime.now(), e))
            return

        # clean operation_log records
        logger.info('Cleaning up operation_log records...')
        self.stdout.write('[%s] Cleaning up operation_log records...' % datetime.now())
        for i in range(0, count, 10000):
            clean_sql = """DELETE FROM `operation_log` WHERE 
                           op_time < UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY))*1000 LIMIT 10000"""
            try:
                if not ENABLE_OPERATION_LOG_DB:
                    with connection.cursor() as cursor:
                        cursor.execute(clean_sql)
                else:
                    with connections[KEY_OPERATION_LOG].cursor() as operation_log_cursor:
                        operation_log_cursor.execute(clean_sql)
            except Exception as e:
                logger.error('Failed to clean operation_log records, error: %s.' % e)
                self.stderr.write('[%s] Failed to clean operation_log records, error: %s.' % (datetime.now(), e))
                return

        logger.info('Successfully cleaned operation_log records.')
        self.stdout.write('[%s] Successfully cleaned operation_log records.' % datetime.now())

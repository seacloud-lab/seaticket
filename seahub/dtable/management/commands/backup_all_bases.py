# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand

from seahub.dtable_apps.dtable_db_api import DTableDBAPI

logger = logging.getLogger(__name__)
TIMEOUT = 300


class Command(BaseCommand):
    help = 'Backup all bases.'
    label = "backup_all_bases"

    def handle(self, *args, **options):
        logger.debug('Start backup all bases.')
        self.stdout.write('[%s] Start backup all bases.' % datetime.now())
        self.backup_all()
        self.stdout.write('[%s] Finish backup all bases.\n' % datetime.now())
        logger.debug('Finish backup all bases.\n')

    def backup_all(self):
        dtable_db_api = DTableDBAPI('dtable-web', None, settings.INNER_DTABLE_DB_URL)
        start_time = datetime.now()
        try:
            resp_json = dtable_db_api.backup_all()
        except Exception as e:
            finished_time = datetime.now()
            time_delta = finished_time - start_time
            error_msg = '[%s] Backup all bases error: %s, cost %s.' % (
                datetime.now(), e, time_delta)
            logger.exception(error_msg)
            self.stdout.write(error_msg)
        else:
            finished_time = datetime.now()
            time_delta = finished_time - start_time
            msg = '[%s] Backup all bases success, response: %s, cost %s.' % (
                datetime.now(), resp_json, time_delta)
            self.stdout.write(msg)
            logger.debug(msg)

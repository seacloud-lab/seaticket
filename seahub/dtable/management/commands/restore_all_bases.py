# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand

from seahub.dtable_apps.dtable_db_api import DTableDBAPI

logger = logging.getLogger(__name__)
TIMEOUT = 300


class Command(BaseCommand):
    help = 'Restore all bases.'
    label = "restore_all_bases"

    def handle(self, *args, **options):
        logger.debug('Start restore all bases.')
        self.stdout.write('[%s] Start restore all bases.' % datetime.now())
        self.restore_all()
        self.stdout.write('[%s] Finish restore all bases.\n' % datetime.now())
        logger.debug('Finish restore all bases.\n')

    def restore_all(self):
        dtable_db_api = DTableDBAPI('dtable-web', None, settings.INNER_DTABLE_DB_URL)
        start_time = datetime.now()
        try:
            resp_json = dtable_db_api.restore_all()
        except Exception as e:
            finished_time = datetime.now()
            time_delta = finished_time - start_time
            error_msg = '[%s] Restore all bases error: %s, cost %s.' % (
                datetime.now(), e, time_delta)
            self.stdout.write(error_msg)
            logger.exception(error_msg)
        else:
            finished_time = datetime.now()
            time_delta = finished_time - start_time
            msg = '[%s] Restore all bases success, response: %s, cost %s.' % (
                datetime.now(), resp_json, time_delta)
            self.stdout.write(msg)
            logger.debug(msg)

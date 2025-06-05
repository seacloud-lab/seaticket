# encoding: utf-8

import logging
from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import connection

from seahub.dtable.models import DTables, Workspaces
from seahub.dtable.utils import copy_dtable

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'copy dtable to another workspace'
    label = 'copy_dtable'

    def add_arguments(self, parser):
        parser.add_argument('dtable_id', type=int, help='ID of table to transter')
        parser.add_argument('workspace_id', type=int, help='ID of target workspace')

    def handle(self, *args, **options):
        logger.debug('Start transterring dtable')
        self.stdout.write('[%s] Start copying dtable...\n' % datetime.now())
        self.do_action(*args, **options)
        self.stdout.write('[%s] Finish copying dtable...\n' % datetime.now())
        logger.debug('Finish copying dtable')

    def do_action(self, *args, **options):
        dtable_id = options['dtable_id']
        dst_workspace_id = options['workspace_id']
        dtable = DTables.objects.filter(id=dtable_id, deleted=False).first()
        if not dtable:
            self.log_error('dtable: %s not found.' % (dtable_id,))
        dst_workspace = Workspaces.objects.get_workspace_by_id(dst_workspace_id)
        if not dst_workspace:
            self.log_error('workspace: %s not found.' % (dst_workspace_id,))
        dst_dtable_name = DTables.objects.get_non_duplicated_name(dtable.name, dst_workspace_id)
        dst_dtable, _ = copy_dtable(dtable.workspace, dtable, dst_workspace, dst_dtable_name, '', None)
        if not dst_dtable:
            self.log_error('copy dtable error, please check dtable-web log to find error')
        else:
            self.log_info('dtable copy done.')

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

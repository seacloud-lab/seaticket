# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from django.core.management.base import BaseCommand
from seaserv import seafile_api

from seahub.dtable.models import Workspaces

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'clean workspaces whose deleted is True and delete time is out'
    label = 'clean_deleted_workspaces'

    def handle(self, *args, **options):
        logger.debug('Start cleaning workspaces.')
        self.stdout.write('[%s] Start cleaning workspaces.\n' % datetime.now())
        self.do_action()
        self.stdout.write('[%s] Finish cleaning workspaces.\n' % datetime.now())
        logger.debug('Finish cleaning workspaces')

    def do_action(self):
        workspaces = Workspaces.objects.get_deleted_workspaces_by_expire_seconds(expire_seconds=60*60*24*60)
        for workspace in workspaces:
            self.stdout.write('[%s] Start cleaning workspace: %s.' % (datetime.now(), workspace.id))
            try:
                Workspaces.objects.delete_workspace(workspace.id)
                seafile_api.remove_repo(workspace.repo_id)
            except Exception as e:
                logger.error('Failed to clean workspace %s, repo %s, error: %s' % (workspace.id, workspace.repo_id, e))
                self.stderr.write('[%s] Failed to clean workspace %s, repo %s, error: %s' % (
                    datetime.now(), workspace.id, workspace.repo_id, e))
                continue
            self.stdout.write('[%s] Successfully clean workspace: %s.' % (datetime.now(), workspace.id))

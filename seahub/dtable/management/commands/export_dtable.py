# encoding: utf-8
import json
import logging
import shutil
import time
from datetime import datetime
import os
import stat
import threading

from django.conf import settings
from django.core.management.base import BaseCommand

from seahub.dtable.utils import add_dtable_io_task, query_dtable_io_status
from seahub.dtable.models import DTables, Workspaces
from seahub.utils import uuid_str_to_36_chars

logger = logging.getLogger(__name__)


class LogTailer:
    def __init__(self, filename):
        self.filename = filename
        self._file = None
        self._inode = None
        self._size = 0
        self.open_file()

    def open_file(self):
        if self._file:
            self._file.close()
        
        self._file = open(self.filename, 'r')
        st = os.stat(self.filename)
        self._inode = st.st_ino
        self._size = st.st_size

        try:
            lines = self._file.readlines()
            start_line = max(0, len(lines) - 50)
            self._file.seek(0)
            for _ in range(start_line):
                self._file.readline()
        except:
            self._file.seek(0, os.SEEK_END)


    def check_rotation(self):
        try:
            st = os.stat(self.filename)
            if st.st_ino != self._inode:  # inode changed means file rotated
                print("\nFile rotated, reopen file...")
                self.open_file()
                return True
        except FileNotFoundError:
            time.sleep(1)
            return False
        return False
    
    def tail(self):
        while True:
            self.check_rotation()

            line = self._file.readline()
            if line:
                yield line
            else:
                time.sleep(0.1)
        self.close()

    def close(self):
        if self._file:
            self._file.close()


class Command(BaseCommand):
    help = 'export dtable to current dir'
    label = "export_dtable"

    def add_arguments(self, parser):
        parser.add_argument('dtable_uuid', type=str, help='uuid of dtable')
        parser.add_argument('--ignore-asset', type=str, choices=['true', 'false'], default='false',
                            help='Whether ignore base asset; true=ignore, false=not ignore')

    def handle(self, *args, **options):
        logger.debug('Start exporting dtable...')
        self.stdout.write('[%s] Start exporting dtable...\n' % datetime.now())
        success = self.do_action(*args, **options)
        if success:
            self.stdout.write('[%s] Successfully export dtable.\n' % datetime.now())
        else:
            self.stdout.write('[%s] Export dtable failed\n' % datetime.now())
        logger.debug('Finish exporting dtable')

    def trace_log(self, task_id):
        self.log_file = os.path.join(settings.LOG_DIR, 'dtable_events_io.log')
        for line in LogTailer(self.log_file).tail():
            if f'[{task_id}] - ' not in line:
                continue
            self.stdout.write(line)

    def export_table(self, dtable_uuid, ignore_asset):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            logger.error('base: %s not found.', dtable_uuid)
            self.stdout.write('[%s] base: %s not found.' % (datetime.now(), dtable_uuid))
            return False
        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            logger.error('Workspace not found.')
            self.stdout.write('[%s] Workspace not found.' % (datetime.now()))
            return False

        repo_id = workspace.repo_id
        params = {'username': 'export_dtable_command', 'table_name': dtable.name, 'repo_id': repo_id,
                  'workspace_id': dtable.workspace_id, 'dtable_uuid': dtable_uuid, 'ignore_asset': ignore_asset}

        try:
            task_id = add_dtable_io_task(type='export', params=params)
        except Exception as e:
            logger.error('create export %s task error: %s', dtable.id, e)
            self.stdout.write('[%s] create export %s task: error: %s' % (datetime.now(), dtable.name, e))
            return False

        threading.Thread(target=self.trace_log, args=(task_id,), daemon=True).start()

        is_finished = False
        while not is_finished:
            time.sleep(0.5)
            try:
                resp = query_dtable_io_status(task_id)
                if not resp.ok:
                    logger.error('query export %s task error: %s', dtable.name, resp.content)
                    self.stdout.write('[%s] query export %s task: error: %s' % (
                        datetime.now(), dtable.name, resp.content))
                    return False
                resp_json = resp.json()
                is_finished = resp_json['is_finished']
                warnings = resp_json.get('warnings') or []
                if is_finished:
                    for warning in warnings:
                        if isinstance(warning, dict) and warning['type'] == 'asset_size_too_large':
                            self.stdout.write('[%s] export %s size of asset too large!' % (
                                datetime.now(), dtable.name
                            ))
            except Exception as e:
                logger.error('query export %s task error: %s', dtable.name, e)
                self.stdout.write('[%s] query export %s task: error: %s' % (datetime.now(), dtable.name, e))
                return False

        tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'zip_file') + '.zip'
        if not os.path.exists(tmp_zip_path):
            logger.error('file path: %s does not exist', tmp_zip_path)
            self.stdout.write('[%s] file path: %s does not exist' % (datetime.now(), tmp_zip_path,))
            return False

        dst_path = './'+dtable.dtable_name + '.dtable'
        shutil.copyfile(tmp_zip_path, dst_path)
        return True

    def do_action(self, *args, **options):
        dtable_uuid = options['dtable_uuid']
        ignore_asset = options['ignore_asset']
        success = self.export_table(dtable_uuid, ignore_asset)
        return success

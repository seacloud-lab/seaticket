# -*- coding: utf-8 -*-
import os
import json
import time
import logging
import requests
from datetime import datetime

from django.core.management.base import BaseCommand

from seaserv import seafile_api
from seahub.dtable.models import DTables, DTableSnapshot
from seahub.utils.dtable_storage_server_api import storage_api
from seahub.utils import gen_inner_file_get_url, normalize_file_path
from seahub.dtable.utils import get_snapshot_days_by_workspace
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.settings import FILESERVER_TOKEN_ONCE_ONLY


logger = logging.getLogger(__name__)
BACKUP_FOLDER = '/shared/migrate-backup/'
JSON_FILE_TYPE = '.json'
FILE_TYPE = '.dtable'
SNAPSHOT_OFFSET = 0
SNAPSHOT_LIMIT = 10


class Command(BaseCommand):
    help = 'Migrate bases to storage-server.'

    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('-l', '--list', action='store_true')
        parser.add_argument('-m', '--migrate', type=int, nargs='?')
        parser.add_argument('-b', '--backup-folder', type=str, nargs='?')

    def handle(self, *args, **options):
        list_option = options['list']
        migrate_option = options['migrate']
        folder_option = options['backup_folder'] or BACKUP_FOLDER
        folder_option = folder_option.rstrip('/') + '/'

        if list_option is True:
            logger.debug(
                'Start listing bases in seaf-server.')
            self.stdout.write(
                '[%s] Start listing bases in seaf-server.\n\n' % datetime.now())
            self.list_bases()
            self.stdout.write(
                '\n[%s] Finish listing bases in seaf-server.\n\n' % datetime.now())
            logger.debug(
                'Finish listing bases in seaf-server.')
            return

        if migrate_option is not None and 0 < migrate_option < 1000000:
            logger.debug(
                'Start migrating bases.')
            self.stdout.write(
                '[%s] Start migrating bases.\n\n' % datetime.now())
            self.migrate_bases(migrate_option, folder_option)
            self.stdout.write(
                '\n[%s] Finish migrating bases.\n\n' % datetime.now())
            logger.debug(
                'Finish migrating bases.')
            return

        logger.debug(
            'Please use < /templates/migrate_bases.sh --list | --migrate [number] | --backup-folder [path] >')
        self.stdout.write(
            '\nPlease use < /templates/migrate_bases.sh --list | --migrate [number] | --backup-folder [path] >\n\n')
        return

    def list_bases(self):
        # count
        dtable_count = DTables.objects.filter(in_storage=False, deleted=False).count()
        logger.debug(
            'Found %s bases in seaf-server.' % (dtable_count))
        self.stdout.write(
            '[%s] Found %s bases in seaf-server.\n\n' % (datetime.now(), dtable_count))
        if dtable_count < 1:
            return

        # info
        ten_dtables = DTables.objects.filter(
            in_storage=False, deleted=False).select_related('workspace')[:10]
        ten_dtables_count = ten_dtables.count()

        logger.debug(
            'List %s bases info:' % (ten_dtables_count))
        self.stdout.write(
            '[%s] List %s bases info:\n' % (datetime.now(), ten_dtables_count))

        for dtable in ten_dtables:
            file_size = self._get_file_size(dtable) // 1024
            logger.debug(
                'Base: %s, UUID: %s, size: %s KB' % (dtable.name, dtable.uuid, file_size))
            self.stdout.write(
                'Base: %s, UUID: %s, size: %s KB' % (dtable.name, dtable.uuid, file_size))
        return

    def _get_file_size(self, dtable):
        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        file_path = '/' + dtable.name + FILE_TYPE
        file_id = seafile_api.get_file_id_by_path(repo_id, file_path)
        if not file_id:
            return 0
        file_size = seafile_api.get_file_size(
            repo.store_id, repo.version, file_id)
        return file_size

    def _delete_file(self, dtable):
        repo_id = dtable.workspace.repo_id
        dtable_file_id = seafile_api.get_file_id_by_path(
            repo_id, '/' + dtable.name + FILE_TYPE)
        if dtable_file_id:
            return seafile_api.del_file(
                repo_id, '/', json.dumps([dtable.name + FILE_TYPE]), '')
        else:
            return None

    def _get_dtable(self, dtable):
        obj_id = seafile_api.get_file_id_by_path(
            dtable.workspace.repo_id, '/' + dtable.name + FILE_TYPE)
        if not obj_id:
            return None
        token = seafile_api.get_fileserver_access_token(
            dtable.workspace.repo_id, obj_id, 'view', '', use_onetime=False)
        if not token:
            return None
        dtable_url = gen_inner_file_get_url(token, dtable.name + FILE_TYPE)
        resp = requests.get(dtable_url)
        if resp.status_code != 200:
            return None
        if not resp.content:
            return None
        return json.dumps(resp.json())

    def _list_snapshots(self, dtable, snapshot_days):
        snapshot_list = []
        snapshot_queryset = DTableSnapshot.objects.list_by_dtable_uuid(
            str(dtable.uuid.hex), snapshot_days=snapshot_days)
        for snapshot in snapshot_queryset[SNAPSHOT_OFFSET:SNAPSHOT_OFFSET + SNAPSHOT_LIMIT]:
            data = {
                'dtable_name': snapshot.dtable_name,
                'commit_id': snapshot.commit_id,
                'ctime': timestamp_to_isoformat_timestr(snapshot.ctime // 1000),
                'ctime_number': snapshot.ctime // 1000,
            }
            snapshot_list.append(data)
        return snapshot_list

    def _get_snapshot(self, dtable, snapshot_id, snapshot_days):
        snapshot = DTableSnapshot.objects.get_by_commit_id(
            snapshot_id, dtable.uuid.hex)
        if not snapshot or not snapshot.is_allowed_view_by_days(snapshot_days):
            return None
        snapshot_table_path = normalize_file_path(snapshot.dtable_name)
        obj_id = seafile_api.get_file_id_by_commit_and_path(
            dtable.workspace.repo_id, snapshot_id, snapshot_table_path)
        if not obj_id:
            return None
        token = seafile_api.get_fileserver_access_token(
            dtable.workspace.repo_id, obj_id, 'view', '', FILESERVER_TOKEN_ONCE_ONLY)
        if not token:
            return None
        snapshot_link = gen_inner_file_get_url(token, snapshot.dtable_name)
        resp = requests.get(snapshot_link)
        if resp.status_code != 200:
            return None
        if not resp.content:
            return None
        return json.dumps(resp.json())

    def migrate_bases(self, migrate_option, folder_option):
        # create backup folder
        os.makedirs(folder_option, exist_ok=True)
        MIGRATE_INFO_FILE = folder_option + 'info.txt'

        # count
        dtables = DTables.objects.filter(
            in_storage=False, deleted=False).select_related('workspace')[:migrate_option]
        dtable_count = dtables.count()
        logger.debug('Load %s bases in seaf-server.' % (dtable_count))
        self.stdout.write(
            '[%s] Load %s bases in seaf-server.\n\n' % (datetime.now(), dtable_count))

        for dtable in dtables:
            time.sleep(0.1)
            try:
                start_time = time.time()
                # size
                file_size = self._get_file_size(dtable) // 1024
                logger.debug(
                    'Base %s, UUID: %s, size: %s KB.' % (dtable.name, dtable.uuid, file_size))
                self.stdout.write(
                    '\n[%s] Base %s, UUID: %s, size: %s KB.\n' % (datetime.now(), dtable.name, dtable.uuid, file_size))

                # get file from seaf-server
                json_string = self._get_dtable(dtable) or ''

                # backup base
                # path: /shared/migrate-backup/dtable_uuid/dtable.json
                os.makedirs(
                    folder_option + str(dtable.uuid) + '/', exist_ok=True)
                backup_file_path = folder_option + \
                    str(dtable.uuid) + '/dtable' + JSON_FILE_TYPE
                with open(backup_file_path, 'w') as f:
                    f.write(json_string)
                logger.debug(
                    'Backup base %s success.' % (dtable.name))
                self.stdout.write(
                    '[%s] Backup base %s success.\n' % (datetime.now(), dtable.name))

                # upload base to storage-server
                storage_api.save_dtable(str(dtable.uuid), json_string)
                logger.debug(
                    'Upload base %s success.' % (dtable.name))
                self.stdout.write(
                    '[%s] Upload base %s success.\n' % (datetime.now(), dtable.name))

                # list snapshots
                snapshot_days = get_snapshot_days_by_workspace(
                    dtable.workspace)
                snapshot_list = self._list_snapshots(dtable, snapshot_days)
                logger.debug(
                    'Found %s snapshots.' % (len(snapshot_list)))
                self.stdout.write(
                    '[%s] Found %s snapshots.\n' % (datetime.now(), len(snapshot_list)))

                # upload snapshots
                for snapshot in snapshot_list:
                    time.sleep(0.01)
                    snapshot_id = snapshot['commit_id']
                    ctime_number = snapshot['ctime_number']
                    ctime = snapshot['ctime'][:-6].replace(':', '.')
                    # get snapshot
                    snapshot_json_string = self._get_snapshot(
                        dtable, snapshot_id, snapshot_days) or ''
                    # backup snapshot
                    # path: /shared/migrate-backup/dtable_uuid/snapshot-ctime.json
                    snapshot_file_path = folder_option + \
                        str(dtable.uuid) + '/snapshot-' + \
                        ctime + JSON_FILE_TYPE
                    with open(snapshot_file_path, 'w') as f:
                        f.write(snapshot_json_string)
                    # upload snapshot
                    storage_api.migrate_snapshot(
                        str(dtable.uuid), snapshot_json_string, ctime_number)
                    logger.debug(
                        'Upload snapshot %s success.' % (ctime))
                    self.stdout.write(
                        '[%s] Upload snapshot %s success.\n' % (datetime.now(), ctime))

                logger.debug(
                    'Backup and upload snapshots success.')
                self.stdout.write(
                    '[%s] Backup and upload snapshots success.' % (datetime.now()))

                # in_storage
                dtable.in_storage = True
                dtable.save(update_fields=['in_storage'])
                logger.debug(
                    'Update base %s in_storage=True success.' % (dtable.name))
                self.stdout.write(
                    '[%s] Update base %s in_storage=True success.\n' % (datetime.now(), dtable.name))

                # delete dtable file in seaf-server
                try:
                    self._delete_file(dtable)
                    logger.debug(
                        'Delete base %s file in seaf-server success.' % (dtable.name))
                    self.stdout.write(
                        '[%s] Delete base %s file in seaf-server success.\n' % (datetime.now(), dtable.name))
                except Exception as e:
                    logger.exception(e)
                    logger.debug(
                        'Delete base %s file in seaf-server failed, error: %s' % (dtable.name, e))
                    self.stdout.write(
                        '[%s] Delete base %s file in seaf-server failed, error: %s\n' % (datetime.now(), dtable.name, e))

                # write info
                with open(MIGRATE_INFO_FILE, 'a') as f:
                    info = '[%s] Base: %s, UUID: %s, size: %s KB, migrate success.\n' % (
                        datetime.now(), dtable.name, dtable.uuid, file_size)
                    f.write(info)
                end_time = time.time()
                logger.debug(
                    'Migrate base %s success, cost %.2f s.' % (dtable.name, (end_time - start_time)))
                self.stdout.write(
                    '[%s] Migrate base %s success, cost %.2f s.\n' % (datetime.now(), dtable.name, (end_time - start_time)))

            except Exception as e:
                logger.exception(e)
                with open(MIGRATE_INFO_FILE, 'a') as f:
                    info = '[%s] Base: %s, UUID: %s, migrate failed, error: %s\n' % (
                        datetime.now(), dtable.name, dtable.uuid, e)
                    f.write(info)
                logger.error(
                    'Migrate base %s failed, UUID: %s, error: %s' % (dtable.name, dtable.uuid, e))
                self.stdout.write(
                    '[%s] Migrate base %s failed, UUID: %s, error: %s\n' % (datetime.now(), dtable.name, dtable.uuid, e))

        return

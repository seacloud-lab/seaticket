import os
import json
import datetime
from django.urls import reverse
from seahub.utils.dtable_storage_server_api import storage_api
from seahub.utils.default_dtable import DefaultDTable

FILE_TYPE = '.dtable'
TMP_PATH = '/tmp/storage-backend/'
NOT_IN_STORAGE_ERROR_MSG = 'This Base needs to be migrated to storage-server. Please use "/templates/migrate_bases.sh" to migrate Bases to storage-server.'


class StorageBackend(object):
    """Storage Backend
    """

    def __init__(self):
        pass

    def _get_local_file_path(self):
        if not os.path.exists(TMP_PATH):
            os.makedirs(TMP_PATH)
        return TMP_PATH

    def get_dtable(self, dtable):
        if dtable.in_storage:
            data = storage_api.get_dtable(str(dtable.uuid))
            if not data:
                return None
            if isinstance(data, str):
                # compatible with old data
                return json.loads(data)
            return data
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

    def create_empty_dtable(self, dtable, username):
        if dtable.in_storage:
            json_string = DefaultDTable(username).generate()
            return storage_api.save_dtable(str(dtable.uuid), json_string)
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

    def save_dtable(self, dtable, json_string, username):
        if dtable.in_storage:
            return storage_api.save_dtable(str(dtable.uuid), json_string)
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

    def rename_dtable(self, dtable, old_dtable_file_name, new_dtable_file_name, username):
        if dtable.in_storage:
            return None  # do nothing
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

    def delete_dtable(self, dtable):
        if dtable.in_storage:
            return storage_api.delete_dtable(str(dtable.uuid))
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

    def list_snapshots(self, dtable, offset, limit, snapshot_days):
        from seahub.utils.timeutils import timestamp_to_isoformat_timestr
        if dtable.in_storage:
            start_timestamp = (datetime.datetime.now() - datetime.timedelta(days=snapshot_days)).timestamp()
            snapshot_list = []
            s_list = storage_api.list_snapshots(str(dtable.uuid), offset, limit)
            if s_list:
                for snapshot in s_list:
                    if snapshot.get('ctime', 0) < start_timestamp:
                        continue
                    data = {
                        'dtable_name': dtable.name,
                        'commit_id': snapshot.get('id'),
                        'ctime': timestamp_to_isoformat_timestr(snapshot.get('ctime')),
                    }
                    snapshot_list.append(data)
            return snapshot_list
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

    def get_snapshot(self, dtable, snapshot_id, snapshot_days, username):
        if dtable.in_storage:
            data = storage_api.get_snapshot(str(dtable.uuid), snapshot_id)
            if not data:
                return None
            if isinstance(data, str):
                # compatible with old data
                return json.loads(data)
            return data
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

    def get_snapshot_link(self, dtable, snapshot_id, snapshot_days, username):
        if dtable.in_storage:
            snapshot_link = reverse('api-v2.1-dtable-snapshot-content',
                args=[dtable.workspace.id, dtable.name, snapshot_id])
            return snapshot_link
        else:
            raise RuntimeError(NOT_IN_STORAGE_ERROR_MSG)

storage_backend = StorageBackend()

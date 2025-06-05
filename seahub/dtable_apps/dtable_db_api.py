import json
import jwt
import time
import requests
from seahub.settings import DTABLE_PRIVATE_KEY
from seahub.utils import uuid_str_to_36_chars


class ExecutionCostExceededError(Exception):
    pass


def get_custom_access_token(username, dtable_uuid):
    payload = {
        'exp': int(time.time()) + 3600,
        'dtable_uuid': dtable_uuid,
        'username': username,
        'permission': 'rw',
        'from': 'dtable_web'  # dtable-db ignore rate limit from dtable_web
    }
    access_token = jwt.encode(
        payload, DTABLE_PRIVATE_KEY, algorithm='HS256'
    )
    return access_token

def get_admin_access_token(dtable_uuid):
    payload = {
        'is_db_admin': True,
        'exp': int(time.time()) + 3600,
        'permission': 'rw',
        'from': 'dtable_web'  # dtable-db ignore rate limit from dtable_web
    }
    if dtable_uuid:
        payload['dtable_uuid'] = dtable_uuid
    access_token = jwt.encode(payload, DTABLE_PRIVATE_KEY, 'HS256')

    return access_token


def parse_response(response):
    if response.status_code >= 400:
        try:
            info = response.json()
        except Exception:
            pass
        else:
            if info.get('error_message') == 'execution cost exceeded':
                raise ExecutionCostExceededError()
        raise ConnectionError(response.status_code, response.text)
    else:
        try:
            data = json.loads(response.text)
            return data
        except:
            pass


class DTableDBAPI(object):

    def __init__(self, username, dtable_uuid, dtable_db_url):
        self.username = username
        self.dtable_uuid = uuid_str_to_36_chars(dtable_uuid) if dtable_uuid else None
        self.headers = None
        self.admin_headers = None
        self.dtable_db_url = dtable_db_url.rstrip('/')
        self.timeout = 30
        self._init()

    def _init(self):
        db_custom_access_token = get_custom_access_token(self.username, self.dtable_uuid)
        db_admin_access_token = get_admin_access_token(self.dtable_uuid)
        self.headers = {'Authorization': 'Token ' + db_custom_access_token}
        self.admin_headers = {'Authorization': 'Token ' + db_admin_access_token}

    def query(self, sql, convert=False, server_only=None):
        url = '%s/api/v1/query/%s/?from=dtable_web' % (
            self.dtable_db_url,
            self.dtable_uuid
        )
        data = {
            'sql': sql,
            'convert_keys': convert
        }
        if server_only is not None:
            data['server_only'] = server_only
        response = requests.post(url, json=data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def batch_append_links(self, link_info):
        '''

        :param link_info:
        including a dict such as
        {
            "link_id": "61xy",
            "table_id": "0000",
            "other_table_id": "Y2g1",
            "other_rows_ids_map": {
            "OfJdsDIaSvyqOACnm7edhA": ["OS55FMTMSZWIn3SMw7hUjw"],
            "bzPJT5Z0TL6TA-_QkzLfVw": ["I6TNJm-TTginPzASF1xv0w"]
            }
        }
        :return:
        '''
        url = '%s/api/v1/base/%s/links/?from=dtable_web' % (
            self.dtable_db_url,
            self.dtable_uuid
        )

        response = requests.post(url, json=link_info, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def batch_delete_links(self, link_info):
        '''

        :param link_info: save as batch_update_links
        :return:
        '''
        url = '%s/api/v1/base/%s/links/?from=dtable_web' % (
            self.dtable_db_url,
            self.dtable_uuid
        )

        response = requests.delete(url, json=link_info, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def batch_append_rows(self, table_name, rows_data):
        url = "%s/api/v1/insert-rows/%s/?from=dtable_web" % (
            self.dtable_db_url,
            self.dtable_uuid
        )

        json_data = {
            'table_name': table_name,
            'rows': rows_data,
        }
        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def batch_update_rows(self, table_name, updates):
        url = "%s/api/v1/update-rows/%s/?from=dtable_web" % (
            self.dtable_db_url,
            self.dtable_uuid
        )

        json_data = {
            'table_name': table_name,
            'updates': updates,
        }
        response = requests.put(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def batch_delete_rows(self, table_name, row_ids):
        url = "%s/api/v1/delete-rows/%s/?from=dtable_web" % (
            self.dtable_db_url,
            self.dtable_uuid
        )

        json_data = {
            'table_name': table_name,
            'row_ids': row_ids,
        }
        response = requests.delete(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def query_linked_records(self, data):
        url = '%s/api/v1/linked-records/%s/' % (self.dtable_db_url, self.dtable_uuid)
        response = requests.post(url, json=data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def get_stats(self):
        url = '%s/api/v1/stats/?from=dtable_web' % (self.dtable_db_url,)
        response = requests.get(url, headers=self.admin_headers)
        return parse_response(response)

    def get_bases(self, offset=0, limit=100):
        url = '%s/api/v1/bases?from=dtable_web' % (self.dtable_db_url,)
        params = {
            'offset': offset,
            'limit': limit
        }
        response = requests.get(url, params=params, headers=self.admin_headers)
        return parse_response(response)

    def delete_base(self):
        url = '%s/api/v1/base/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        response = requests.delete(url, headers=self.admin_headers)
        return parse_response(response)

    def get_backups(self):
        url = '%s/api/v1/backup/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        response = requests.get(url, headers=self.admin_headers)
        return parse_response(response)

    def backup_all(self):
        url = '%s/api/v1/backup-all?from=dtable_web' % (self.dtable_db_url,)
        response = requests.post(url, headers=self.admin_headers)
        return parse_response(response)

    def restore_all(self):
        url = '%s/api/v1/restore-all?from=dtable_web' % (self.dtable_db_url,)
        response = requests.post(url, headers=self.admin_headers)
        return parse_response(response)

    def archive_view(self, table_name, where=None):
        url = '%s/api/v1/import/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        json_data = {
            'method': 'select',
            'table_name': table_name
        }
        if where:
            json_data['where'] = where

        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def get_metadata(self):
        url = '%s/api/v1/metadata/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        response = requests.get(url, headers=self.headers, timeout=self.timeout)
        return parse_response(response)


    def add_index(self, table_id, columns):
        url = '%s/api/v1/index/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        json_data = {
            'table_id': table_id,
            'columns': columns
        }
        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def query_index_task(self, task_id):
        url = '%s/api/v1/index/%s/task?task_id=%s&from=dtable_web' % (self.dtable_db_url, self.dtable_uuid, task_id)
        response = requests.get(url, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def delete_index(self, table_id, index_id):
        url = '%s/api/v1/index/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        json_data = {
            'table_id': table_id,
            'index_id': index_id
        }
        response = requests.delete(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def open_big_data_feature(self):
        url = '%s/api/v1/base/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        response = requests.post(url, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def backups(self):
        url = '%s/api/v1/backup/%s/?from=dtable_web' % (self.dtable_db_url, self.dtable_uuid)
        response = requests.get(url, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def restore_backup(self, version, new_dtable_uuid):
        url = '%s/api/v1/restore/%s/%s?new-dtable-uuid=%s' % (self.dtable_db_url, self.dtable_uuid, version, new_dtable_uuid)
        response = requests.post(url, headers=self.headers, timeout=self.timeout)
        return parse_response(response)
    
    def query_operation_logs(self, page=1, per_page=100):
        url = '%s/api/v2/dtables/%s/db-operations?page=%s&per_page=%s&from=dtable_web' % (self.dtable_db_url, self.dtable_uuid, page, per_page)
        response = requests.get(url, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

import io
import json
import os
import time
from copy import deepcopy
from datetime import datetime
from urllib import parse
from uuid import UUID

import jwt
import requests

from seaserv import seafile_api

from seahub.department_v2.utils import get_departments_map_by_username_dtable
from seahub.dtable.constants import ColumnTypes
from seahub.dtable.models import IdInOrgTuple, DTables
from seahub.settings import DTABLE_PRIVATE_KEY
from seahub.utils import gen_file_upload_url, uuid_str_to_36_chars, is_valid_email

def get_payload(username, dtable_uuid, signal_name=None, app_name=None, permission=None, kwargs=None):
    if dtable_uuid:
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
    else:
        dtable = None
    payload = {
        'exp': int(time.time()) + 3600,
        'dtable_uuid': dtable_uuid,
        'permission': permission if permission else 'rw',
    }

    if dtable:
        # provide org_id and personal_id for statistical purpose of api-gateway
        org_id = dtable.workspace.org_id
        workspace_owner = dtable.workspace.owner
        payload['org_id'] = org_id
        payload['owner_id'] = workspace_owner

    if username:
        payload['username'] = username
        if is_valid_email(username):
            if not (isinstance(kwargs, dict) and 'id_in_org' in kwargs):
                id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username).first()
                if id_in_org_tuple:
                    payload['id_in_org'] = id_in_org_tuple.id_in_org
            if not (isinstance(kwargs, dict) and 'user_department_ids_map' in kwargs) and dtable:
                user_department_ids_map = get_departments_map_by_username_dtable(username, dtable)
                payload['user_department_ids_map'] = user_department_ids_map
    if app_name:
        payload['app_name'] = app_name
    if signal_name:
        payload['signal_name'] = signal_name
    if isinstance(kwargs, dict):
        payload.update(kwargs)

    # fix some defaults
    if not payload.get('username'):
        payload['username'] = ''  # username must be a string even no username
    if not payload.get('id_in_org'):
        payload['id_in_org'] = ''
    if not payload.get('user_department_ids_map'):
        payload['user_department_ids_map'] = {
            'current_user_department_ids': [],
            'current_user_department_and_sub_ids': []
        }

    return payload

def parse_response(response):
    if response.status_code >= 400:
        raise ConnectionError(response.status_code, response.text)
    else:
        try:
            data = json.loads(response.text)
            return data
        except:
            pass


class DTableServerAPI(object):
    # simple version of python sdk without authorization for base or table manipulation

    def __init__(self, username, dtable_uuid, dtable_server_url, server_url=None, workspace_id=None, repo_id=None, app_name=None, permission=None, kwargs=None):
        self.username = username
        self.app_name = app_name
        self.dtable_uuid = uuid_str_to_36_chars(dtable_uuid) if dtable_uuid else None
        self.headers = None
        self.internal_headers = None
        self.dtable_server_url = dtable_server_url.rstrip('/')
        self.workspace_id = workspace_id
        self.timeout = 30
        self.server_url = server_url.strip('/') if server_url else None
        self.repo_id = repo_id
        self.permission = permission
        self.kwargs = kwargs
        self._init()

    def _init(self):
        payload = get_payload(self.username, self.dtable_uuid, app_name=self.app_name, permission=self.permission, kwargs=self.kwargs)
        self.payload = payload
        self.dtable_server_access_token = jwt.encode(self.payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
        self.headers = {'Authorization': 'Token ' + self.dtable_server_access_token}

        self.internal_payload = deepcopy(payload)
        self.internal_payload['is_internal'] = True
        self.internal_dtable_server_access_token = jwt.encode(self.internal_payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
        self.internal_headers = {'Authorization': 'Token ' + self.internal_dtable_server_access_token}

        self.view_payload = deepcopy(payload)
        self.view_payload['exp'] = int(time.time()) + 86400 * 3
        self.view_access_token = jwt.encode(self.view_payload, DTABLE_PRIVATE_KEY, algorithm='HS256')

    def get_metadata(self):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/metadata/?from=dtable_web'
        response = requests.get(url, headers=self.headers, timeout=self.timeout)
        data = parse_response(response)
        return data.get('metadata')

    def get_metadata_with_plugin(self, plugin_type=None):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/metadata/plugin/?from=dtable_web'
        params = {}
        if plugin_type:
            params = {'plugin_type': plugin_type}
        respone = requests.get(url, params=params, headers=self.headers, timeout=self.timeout)
        data = parse_response(respone)
        return data.get('metadata')

    def get_base(self, parse_json=True):
        url = self.dtable_server_url + f'/dtables/{self.dtable_uuid}/?from=dtable_web'
        response = requests.get(url, headers=self.headers)
        if parse_json:
            return parse_response(response)
        return response.content

    def get_row(self, table_name, row_id, timeout=None):
        """
        :param table_name: str
        :param row_id: str
        :return: dict
        """
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/rows/' + row_id + '/?from=dtable_web'
        params = {
            'table_name': table_name,
        }
        response = requests.get(url, params=params, headers=self.headers, timeout=timeout)
        data = parse_response(response)
        return data

    def get_row_by_table_id(self, table_id, row_id, timeout=None):
        """
        :param table_name: str
        :param row_id: str
        :return: dict
        """
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/rows/' + row_id + '/?from=dtable_web'
        params = {
            'table_id': table_id,
        }
        response = requests.get(url, params=params, headers=self.headers, timeout=timeout)
        data = parse_response(response)
        return data

    def list_rows(self, table_name, view_name=None, convert_link_id=False):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/rows/?from=dtable_web'
        params = {
            'table_name': table_name,
        }
        if view_name:
            params['view_name'] = view_name
        if convert_link_id is not None:
            params['convert_link_id'] = convert_link_id
        response = requests.get(url, params=params, headers=self.headers)
        data = parse_response(response)
        return data.get('rows')

    def append_row(self, table_name, row_data, apply_default=False):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/rows/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'row': row_data,
            'apply_default': apply_default
        }
        response = requests.post(url, json=json_data, headers=self.headers)
        return parse_response(response)

    def batch_append_rows(self, table_name, rows_data, return_rows=False, apply_default=False):
        """
        :param table_name: str
        :param rows_data: dict
        """
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/batch-append-rows/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'rows': rows_data,
            'return_rows': return_rows,
            'apply_default': apply_default
        }
        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def update_row(self, table_name, row_id, row_data):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/rows/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'row_id': row_id,
            'row': row_data,
        }
        response = requests.put(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def batch_update_rows(self, table_name, updates, need_convert_back=True):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/batch-update-rows/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'updates': updates,
            'need_convert_back': need_convert_back
        }
        return parse_response(requests.put(url, headers=self.headers, json=json_data))

    def delete_row(self, table_name, row_id):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/rows/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'row_id': row_id
        }
        return parse_response(requests.delete(url, headers=self.headers, json=json_data))

    def lock_rows(self, table_name, row_ids):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/lock-rows/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'row_ids': row_ids
        }
        response = requests.put(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def list_columns(self, table_name, view_name=None):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/columns/?from=dtable_web'
        params = {
            'table_name': table_name,
        }
        if view_name:
            params['view_name'] = view_name
        response = requests.get(url, params=params, headers=self.headers)
        data = parse_response(response)
        return data.get('columns')

    def insert_column(self, table_name, column_name, column_type, column_key=None, column_data=None):
        """
        :param table_name: str
        :param column_name: str
        :param column_type: ColumnType enum
        :param column_key: str, which you want to insert after
        :param column_data: dict, config information of column
        :return: dict
        """
        if not ColumnTypes.is_valid(column_type):
            raise ValueError("type %s invalid!" % (column_type,))
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/columns/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'column_name': column_name,
            'column_type': column_type
        }
        if column_key:
            json_data['anchor_column'] = column_key
        if column_data:
            json_data['column_data'] = column_data
        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        data = parse_response(response)
        return data

    def rename_column(self, table_name, column_key, new_column_name):
        """
        :param table_name: str
        :param column_key: str
        :param new_column_name: str
        :return: dict
        """
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/columns/?from=dtable_web'
        json_data = {
            'op_type': 'rename_column',
            'table_name': table_name,
            'column': column_key,
            'new_column_name': new_column_name
        }
        response = requests.put(url, json=json_data, headers=self.headers, timeout=self.timeout)
        data = parse_response(response)
        return data

    def update_column(self, data):
        url = self.dtable_server_url + '/api/v1/dtables/%s/columns/?from=dtable_web' % self.dtable_uuid
        return parse_response(requests.put(url, headers=self.headers, json=data))

    def update_link(self, link_id, table_id, other_table_id, row_id, other_rows_ids):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/links/?from=dtable_web'
        json_data = {
            'link_id': link_id,
            'table_id': table_id,
            'other_table_id': other_table_id,
            'row_id': row_id,
            'other_rows_ids': other_rows_ids,
        }
        response = requests.put(url, json=json_data, headers=self.headers)
        return parse_response(response)

    def batch_update_links(self, link_id, table_id, other_table_id, row_id_list, other_rows_ids_map):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/batch-update-links/?from=dtable_web'
        json_dict = {
            'link_id': link_id,
            'table_id': table_id,
            'other_table_id': other_table_id,
            'row_id_list': row_id_list,
            'other_rows_ids_map': other_rows_ids_map
        }
        response = requests.put(url, json=json_dict, headers=self.headers)
        return parse_response(response)

    def add_table(self, table_name, lang='en', columns=None):
        """
        :param table_name: str
        :param lang: str, currently 'en' for English, and 'zh-cn' for Chinese
        :param columns: list
        """
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/tables/?from=dtable_web'
        json_data = {
            'table_name': table_name,
            'lang': lang,
        }
        if columns:
            json_data['columns'] = columns
        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)

    def get_file_upload_link(self):
        """
        :return: dict
        """
        from seahub.dtable.utils import UPLOAD_FILE_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH

        repo_id = self.repo_id
        asset_dir_path = '/asset/' + self.dtable_uuid
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        if not asset_dir_id:
            seafile_api.mkdir_with_parents(repo_id, '/', asset_dir_path[1:], self.username)

        # get token
        obj_id = json.dumps({'parent_dir': asset_dir_path})
        token = seafile_api.get_fileserver_access_token(repo_id, obj_id, 'upload', '', use_onetime=False)

        upload_link = gen_file_upload_url(token, 'upload-api')

        res = dict()
        res['upload_link'] = upload_link
        res['parent_path'] = asset_dir_path
        res['img_relative_path'] = os.path.join(UPLOAD_IMG_RELATIVE_PATH, str(datetime.today())[:7])
        res['file_relative_path'] = os.path.join(UPLOAD_FILE_RELATIVE_PATH, str(datetime.today())[:7])
        return res

    def upload_bytes_file(self, name, content: bytes, relative_path=None, file_type=None, replace=False):
        """
        relative_path: relative path for upload, if None, default {file_type}s/{date of this month} eg: files/2020-09
        file_type: if relative is None, file type must in ['image', 'file'], default 'file'
        return: info dict of uploaded file
        """
        upload_link_dict = self.get_file_upload_link()
        parent_dir = upload_link_dict['parent_path']
        upload_link = upload_link_dict['upload_link'] + '?ret-json=1'
        if not relative_path:
            if file_type and file_type not in ['image', 'file']:
                raise Exception('relative or file_type invalid.')
            if not file_type:
                file_type = 'file'
            relative_path = '%ss/%s' % (file_type, str(datetime.today())[:7])
        else:
            relative_path = relative_path.strip('/')
        response = requests.post(upload_link, data={
            'parent_dir': parent_dir,
            'relative_path': relative_path,
            'replace': 1 if replace else 0
        }, files={
            'file': (name, io.BytesIO(content))
        }, timeout=120)

        d = response.json()[0]
        url = '%(server)s/workspace/%(workspace_id)s/asset/%(dtable_uuid)s/%(relative_path)s/%(filename)s' % {
            'server': self.server_url.strip('/'),
            'workspace_id': self.workspace_id,
            'dtable_uuid': str(UUID(self.dtable_uuid)),
            'relative_path': parse.quote(relative_path.strip('/')),
            'filename': parse.quote(d.get('name', name))
        }
        return {
            'type': file_type,
            'size': d.get('size'),
            'name': d.get('name'),
            'url': url
        }

    def upload_local_file(self, file_path, name=None, relative_path=None, file_type=None, replace=False):
        """
        relative_path: relative path for upload, if None, default {file_type}s/{date of today}, eg: files/2020-09
        file_type: if relative is None, file type must in ['image', 'file'], default 'file'
        return: info dict of uploaded file
        """
        if not name:
            name = os.path.basename(file_path.strip('/'))
        if not relative_path:
            if file_type and file_type not in ['image', 'file']:
                raise Exception('relative or file_type invalid.')
            if not file_type:
                file_type = 'file'
            relative_path = '%ss/%s' % (file_type, str(datetime.today())[:7])
        else:
            relative_path = relative_path.strip('/')
        upload_link_dict = self.get_file_upload_link()
        parent_dir = upload_link_dict['parent_path']
        upload_link = upload_link_dict['upload_link'] + '?ret-json=1'
        response = requests.post(upload_link, data={
            'parent_dir': parent_dir,
            'relative_path': relative_path,
            'replace': 1 if replace else 0
        }, files={
            'file': (name, open(file_path, 'rb'))
        }, timeout=self.timeout)
        d = response.json()[0]
        url = '%(server)s/workspace/%(workspace_id)s/asset/%(dtable_uuid)s/%(relative_path)s/%(filename)s' % {
            'server': self.server_url.strip('/'),
            'workspace_id': self.workspace_id,
            'dtable_uuid': str(UUID(self.dtable_uuid)),
            'relative_path': parse.quote(relative_path.strip('/')),
            'filename': parse.quote(d.get('name', name))
        }
        return {
            'type': file_type,
            'size': d.get('size'),
            'name': d.get('name'),
            'url': url
        }

    def create_column_options(self, table_name, column_name, options, return_options=True):
        url = self.dtable_server_url + '/api/v1/dtables/%s/column-options/?from=dtable_web' % self.dtable_uuid
        data = {
            'table_name': table_name,
            'column': column_name,
            'options': options
        }
        if return_options:
            data['return_options'] = True
        return parse_response(requests.post(url, headers=self.headers, json=data))

    def update_column_options(self, table_name, column_name, options, return_options=True):
        url = self.dtable_server_url + '/api/v1/dtables/%s/column-options/?from=dtable_web' % self.dtable_uuid
        data = {
            'options': options,
            'column': column_name,
            'table_name': table_name
        }
        if return_options:
            data['return_options'] = True
        return parse_response(requests.put(url, headers=self.headers, json=data))

    def remove_column_options(self, table_name, column_name, option_ids):
        url = self.dtable_server_url + '/api/v1/dtables/%s/column-options/?from=dtable_web' % self.dtable_uuid
        data = {
            'table_name': table_name,
            'column': column_name,
            'option_ids': option_ids
        }
        return parse_response(requests.delete(url, headers=self.headers))

    def create_snapshot(self, dtable_name):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/snapshot/?from=dtable_web'
        json_data = {
            'dtable_name': dtable_name,
        }
        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        data = parse_response(response)

        return data

    def repair_base(self):
        url = self.dtable_server_url + f'/api/v1/internal/dtables/{self.dtable_uuid}/repair-base/?from=dtable_web'
        response = requests.post(url, headers=self.internal_headers)
        return parse_response(response)

    def send_signal(self, signal_name):
        url = self.dtable_server_url + f'/api/v1/internal/dtables/{self.dtable_uuid}/signals/?from=dtable_web'
        payload = get_payload('dtable-web', self.dtable_uuid, signal_name=signal_name)
        payload['is_internal'] = True
        access_token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
        signal_headers = {'Authorization': f"Token {access_token}"}
        response = requests.post(url, headers=signal_headers)
        return parse_response(response)

    def get_sys_info(self):
        url = self.dtable_server_url + f'/api/v1/admin/sys-info/?from=dtable_web'
        payload = get_payload(None, None, kwargs={'admin': self.username})
        access_token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
        admin_headers = {'Authorization': f"Token {access_token}"}
        response = requests.get(url, headers=admin_headers)
        return parse_response(response)

    def apply_pending_operations(self):
        url = self.dtable_server_url + f'/api/v1/internal/dtables/{self.dtable_uuid}/apply-pending-operations/?from=dtable_web'
        response = requests.post(url, headers=self.internal_headers)
        return parse_response(response)

    def add_row_comment(self, table_id, row_id, comment):
        url = self.dtable_server_url + f'/api/v1/dtables/{self.dtable_uuid}/comments/?table_id={table_id}&row_id={row_id}&from=dtable_web'
        json_data = {
            'comment': comment,
        }
        response = requests.post(url, json=json_data, headers=self.headers, timeout=self.timeout)
        data = parse_response(response)

        return data

    def update_enable_archive(self, enable_archive):
        url = self.dtable_server_url + '/api/v1/internal/dtables/' + self.dtable_uuid + '/archive/?from=dtable_web'
        json_data = {
            'enable_archive': enable_archive,
        }
        response = requests.put(url, json=json_data, headers=self.internal_headers, timeout=self.timeout)
        data = parse_response(response)

        return data

    def list_connected_collaborators(self):
        url = self.dtable_server_url + '/api/v1/dtables/' + self.dtable_uuid + '/connected-collaborators/?from=dtable_web'
        response = requests.get(url, headers=self.internal_headers, timeout=self.timeout)
        data = parse_response(response)
        return data


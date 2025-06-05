# -*- coding: utf-8 -*-
import json
import logging
import os
import random
import shutil
from urllib.parse import quote
from zipfile import is_zipfile, ZipFile

import jwt
import requests
from django.conf import settings
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from django.http import FileResponse
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from seaserv import seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables
from seahub.dtable_apps.dtable_db_api import DTableDBAPI, get_custom_access_token
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable.utils import check_dtable_admin_permission, add_dtable_io_task
from seahub.settings import INNER_DTABLE_DB_URL
from seahub.utils import CsrfExemptSessionAuthentication, gen_file_upload_url, get_inner_dtable_server_url, uuid_str_to_36_chars

logger = logging.getLogger(__name__)


class PageDesignRowLinkRecordView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    permission_classes = ()

    def post(self, request, dtable_uuid):
        # arguments check
        table_id = request.data.get('table_id', '')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        row_id = request.data.get('row_id')
        if not row_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_id invalid')
        try:
            link_columns = json.loads(request.data.get('link_columns'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'link_columns invalid')

        # permission check
        access_token = request.COOKIES.get('access-token')
        try:
            payload = jwt.decode(access_token, settings.DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        except Exception as e:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        if not payload.get('is_internal'):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        payload_dtable_uuid = payload.get('dtable_uuid')
        if uuid_str_to_36_chars(payload_dtable_uuid) != uuid_str_to_36_chars(dtable_uuid):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        dtable_db_api = DTableDBAPI('dtable-web', dtable_uuid, INNER_DTABLE_DB_URL)
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, get_inner_dtable_server_url())

        try:
            metadata = dtable_server_api.get_metadata()
        except Exception as e:
            logger.error('get uuid: %s metadata error: %s', dtable_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        tables = metadata.get('tables')
        table = None
        for tmp_table in tables:
            if tmp_table.get('_id') == table_id:
                table = tmp_table
                break
        if not table:
            return api_error(status.HTTP_404_NOT_FOUND, 'table %s not found.' % table_id)

        if not link_columns:
            table_columns = table.get('columns', [])
            link_columns = [col for col in table_columns if col['type'] == 'link']

        column_key_record_map = {}
        for link_column in link_columns:
            data = {
                'table_id': table_id,
                'link_column': link_column.get('key', ''),
                'rows': [
                    {
                        "row_id": row_id,
                        "offset": 0,
                        "limit": 10000,
                    }
                ]
            }
            try:
                res_data = dtable_db_api.query_linked_records(data)
                link_records = res_data.get(row_id) or []
                link_record_ids = [row['row_id'] for row in link_records]
            except Exception as e:
                logger.error('get link-records error: %s', e)
                link_record_ids = []
            if not link_record_ids:
                column_key_record_map[link_column['key']] = []
            else:
                link_record = []
                try:
                    import dtable_events
                    sql = dtable_events.linkRecords2sql(table, link_column, link_record_ids, tables)
                    res_data = dtable_db_api.query(sql, False)
                    link_record = res_data.get('results', [])
                except Exception as e:
                    link_record = []
                column_key_record_map[link_column['key']] = link_record

        return Response({'link_records': column_key_record_map})


class PageDesignRowsLinkRecordView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    permission_classes = ()

    def post(self, request, dtable_uuid):
        # arguments check
        table_id = request.data.get('table_id', '')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        try:
            row_ids = json.loads(request.data.get('row_ids'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_ids invalid')
        try:
            link_columns = json.loads(request.data.get('link_columns'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'link_columns invalid')

        dtable_db_api = DTableDBAPI('dtable-web', dtable_uuid, INNER_DTABLE_DB_URL)
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, get_inner_dtable_server_url())

        # permission check
        access_token = request.COOKIES.get('access-token')
        try:
            payload = jwt.decode(access_token, settings.DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        except Exception as e:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        if not payload.get('is_internal'):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        payload_dtable_uuid = payload.get('dtable_uuid')
        if uuid_str_to_36_chars(payload_dtable_uuid) != uuid_str_to_36_chars(dtable_uuid):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        try:
            metadata = dtable_server_api.get_metadata()
        except Exception as e:
            logger.error('get uuid: %s metadata error: %s', dtable_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        tables = metadata.get('tables')
        table = None
        for tmp_table in tables:
            if tmp_table.get('_id') == table_id:
                table = tmp_table
                break
        if not table:
            return api_error(status.HTTP_404_NOT_FOUND, 'table %s not found.' % table_id)

        if not link_columns:
            table_columns = table.get('columns', [])
            link_columns = [col for col in table_columns if col['type'] == 'link']

        rows_link_records = {row_id: {} for row_id in row_ids}  # {row_id: {column_key: [rows]}}, default empty dict
        for link_column in link_columns:
            link_column_key = link_column.get('key')
            data = {
                'table_id': table_id,
                'link_column': link_column_key,
                'rows': [{
                    'row_id': row_id,
                    'offset': 0,
                    'limit': 100
                } for row_id in row_ids]
            }
            try:
                res_data = dtable_db_api.query_linked_records(data)
            except Exception as e:
                logger.error('query dtable-db linked-records error: %s', e)
                continue
            if not res_data:
                continue
            for row_id in row_ids:
                label_linked_records = res_data.get(row_id)
                if not label_linked_records:
                    rows_link_records[row_id][link_column_key] = []  # default empty list
                    continue
                linked_row_ids = [record['row_id'] for record in label_linked_records]
                try:
                    import dtable_events
                    sql = dtable_events.linkRecords2sql(table, link_column, linked_row_ids, tables)
                    query_data = dtable_db_api.query(sql, False)
                    link_records = query_data.get('results', [])
                except Exception as e:
                    link_records = []
                rows_link_records[row_id][link_column_key] = link_records

        return Response({'link_records': rows_link_records})  # {'link_records': {row_id: {column_key: [rows]}}}


class PageDesignExportView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id, name):
        # arguments check
        page_id = request.data.get('page_id')
        if not page_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page_id invalid')

        # resource check
        dtable = DTables.objects.get_dtable(workspace_id, name)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), get_inner_dtable_server_url())
        metadata = dtable_server_api.get_metadata_with_plugin('page-design')
        plugin_settings = metadata.get('plugin_settings') or {}
        pages = plugin_settings.get('page-design') or []
        page = next(filter(lambda page: page['page_id'] == page_id, pages), None)
        if not page:
            return api_error(status.HTTP_404_NOT_FOUND, 'Page not found')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # add a background task
        params = {
            'repo_id': dtable.workspace.repo_id,
            'dtable_uuid': str(dtable.uuid),
            'page_id': page_id,
            'username': username
        }
        try:
            task_id = add_dtable_io_task('export-page-design', params)
        except Exception as e:
            logger.exception('add export-page-design task error: %s params: %s', e, params)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class PageDesignExportContentView(APIView):

    def get(self, request, workspace_id, name):
        # arguments check
        page_id = request.GET.get('page_id')
        if not page_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page_id invalid')
        task_id = request.GET.get('task_id')
        if not task_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_id invalid')

        # resource check
        dtable = DTables.objects.get_dtable(workspace_id, name)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        tmp_zip_file = os.path.join('/tmp/dtable-io', 'page-design', f'{str(dtable.uuid)}-{page_id}.zip')
        if not os.path.exists(tmp_zip_file):
            return api_error(status.HTTP_404_NOT_FOUND, 'Page file not found')

        response = FileResponse(open(tmp_zip_file, 'rb'), content_type="application/x-zip-compressed", as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(page_id) + '.zip'

        try:
            os.remove(tmp_zip_file)
        except Exception as e:
            logger.warning('remove %s error', tmp_zip_file)

        return response


class PageDesignImportView(APIView):
    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789'

    @classmethod
    def generate_page_id(cls, page_ids, length=4):
        while True:
            new_id = ''
            for i in range(length):
                new_id += cls.possible[random.randint(0, len(cls.possible)-1)]
            if new_id not in page_ids:
                return new_id

    def post(self, request, workspace_id, name):
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]
        # arguments check
        page_design_file = request.FILES.get('page_design_file', None)
        if not page_design_file:
            error_msg = 'page_design_file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        ext = os.path.splitext(page_design_file.name)[1]
        if ext not in ['.json', '.zip']:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page_deisgn_file invalid')

        # resource check
        dtable = DTables.objects.get_dtable(workspace_id, name)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), get_inner_dtable_server_url())
        metadata = dtable_server_api.get_metadata_with_plugin('page-design')
        plugin_settings = metadata.get('plugin_settings') or {}
        pages = plugin_settings.get('page-design') or []
        page_id = self.generate_page_id([page['page_id'] for page in pages])

        # extract zip file
        tmp_page_design_path = os.path.join('/tmp/dtable-io', 'page-design')
        os.makedirs(tmp_page_design_path, exist_ok=True)
        uploaded_file_path = page_design_file.temporary_file_path()
        if ext == '.zip':
            if not is_zipfile(uploaded_file_path):
                return api_error(status.HTTP_400_BAD_REQUEST, 'A *.zip is required')
            tmp_page_path = os.path.join(tmp_page_design_path, f'{str(dtable.uuid)}-{page_id}')
            if os.path.isdir(tmp_page_path):
                shutil.rmtree(tmp_page_path)
            else:
                os.makedirs(tmp_page_path, exist_ok=True)
            try:
                with ZipFile(uploaded_file_path, 'r') as zip_file:
                    zip_file.extractall(tmp_page_path)
            except Exception as e:
                logger.error(e)
                shutil.rmtree(tmp_page_path)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            unzip_dirs = os.listdir(tmp_page_path)
            if not unzip_dirs or len(unzip_dirs) > 1:
                shutil.rmtree(tmp_page_path)
                return api_error(status.HTTP_400_BAD_REQUEST, 'Page zip invalid')
            unzip_dir = unzip_dirs[0]
            if not os.path.isdir(os.path.join(tmp_page_path, unzip_dir)):
                shutil.rmtree(tmp_page_path)
                return api_error(status.HTTP_400_BAD_REQUEST, 'Page zip dir invalid')
            for item in os.listdir(os.path.join(tmp_page_path, unzip_dir)):
                shutil.move(os.path.join(tmp_page_path, unzip_dir, item), tmp_page_path)
            shutil.rmtree(os.path.join(tmp_page_path, unzip_dir))
            content_file_name = None
            for item in os.listdir(tmp_page_path):
                if not content_file_name and item.endswith('.json'):
                    content_file_name = item
                if not item.endswith('.json') and item not in ['static_image']:
                    useless_item_path = os.path.join(tmp_page_path, item)
                    if os.path.isfile(useless_item_path):
                        os.remove(useless_item_path)
                    if os.path.isdir(useless_item_path):
                        shutil.rmtree(useless_item_path)
            if not content_file_name:
                shutil.rmtree(tmp_page_path)
                return api_error(status.HTTP_400_BAD_REQUEST, 'No page content in zip')
            try:
                with open(os.path.join(tmp_page_path, content_file_name), 'r') as f:
                    page_content = json.load(f)
            except:
                shutil.rmtree(tmp_page_path)
                return api_error(status.HTTP_400_BAD_REQUEST, 'Page content invalid')
            page_id_in_file = page_content.get('page_id')
            if page_id_in_file != os.path.splitext(content_file_name)[0]:
                logger.warning('page_id: %s and page_id: %s inside page file different', page_id, page_id_in_file)
            shutil.rmtree(tmp_page_path)
        # save .json file
        else:
            content_bytes = page_design_file.read()
            try:
                page_content = json.loads(content_bytes)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Page content invalid')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # uplaod
        parent_dir = f'/asset/{str(dtable.uuid)}/page-design'
        dir_id = seafile_api.get_dir_id_by_path(dtable.workspace.repo_id, parent_dir)
        if not dir_id:
            seafile_api.mkdir_with_parents(dtable.workspace.repo_id, os.path.dirname(parent_dir), os.path.basename(parent_dir))
        file_name = f'{str(dtable.uuid)}-{page_id}.zip' if ext == '.zip' else f'{str(dtable.uuid)}-{page_id}.json'
        obj_id = json.dumps({'parent_dir': parent_dir})
        try:
            token = seafile_api.get_fileserver_access_token(
                dtable.workspace.repo_id, obj_id, 'upload', '', use_onetime=True)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        upload_link = gen_file_upload_url(token, 'upload-api', replace=True)
        try:
            response = requests.post(upload_link,
                data = {'parent_dir': parent_dir, 'relative_path': '', 'replace': 1},
                files = {'file': (file_name, open(uploaded_file_path, 'rb'))}
            )
            if response.status_code != 200:
                logger.error('upload: %s status code: %s response: %s', upload_link, response.status_code, response.content)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        except Exception as e:
            logger.error('upload excel error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        content_url = f"{settings.DTABLE_WEB_SERVICE_URL.strip('/')}/workspace/{dtable.workspace.id}/asset/{str(dtable.uuid)}/page-design/{page_id}/{page_id}.json"

        # add a background task
        params = {
            'repo_id': dtable.workspace.repo_id,
            'dtable_uuid': str(dtable.uuid),
            'page_id': page_id,
            'is_dir': ext == '.zip',
            'username': username,
            'workspace_id': workspace_id
        }
        try:
            task_id = add_dtable_io_task('import-page-design', params)
        except Exception as e:
            logger.exception('add import-page-design task error: %s params: %s', e, params)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({
            'task_id': task_id,
            'page_id': page_id,
            'page_name': page_content.get('page_name'),
            'content_url': content_url
        })

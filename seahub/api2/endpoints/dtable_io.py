# -*- coding: utf-8 -*-
import json
import logging
import time
import jwt
import os
import shutil
import requests
import csv
from io import BytesIO, StringIO
from zipfile import is_zipfile, ZipFile
from copy import deepcopy

from django.contrib.auth.hashers import check_password
from openpyxl import load_workbook

from constance import config
from django.utils.translation import gettext as _
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.db.utils import OperationalError
from django.http import FileResponse
from urllib.parse import quote

from seaserv import seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle, ImportRateThrottle, ExportRateThrottle
from seahub.api2.utils import api_error, to_python_boolean, clear_tmp_file
from seahub.constants import PERMISSION_READ_WRITE
from seahub.dtable.models import Workspaces, DTables, Folders, FolderItems
from seahub.dtable.utils import check_dtable_permission, add_dtable_io_task, add_dtable_io_big_data_screen_task, convert_page_design_to_pdf, query_dtable_io_status, \
    cancel_dtable_io_task, check_dtable_operation_permission, check_base_limit, \
    can_use_automation_rules_by_dtable, check_dtable_admin_permission, can_use_workflows_by_dtable, \
    can_use_external_apps_by_dtable, add_import_table_from_base_task, add_import_excel_csv_task, \
    import_excel_csv_add_table_task, check_table_operate_permission, convert_document_to_pdf
from seahub.dtable.constants import FOLDER_ITEM_DTABLE
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import DTABLE_PRIVATE_KEY, DTABLE_EXPORT_MAX_SIZE, INNER_DTABLE_DB_URL
from seahub.utils import get_insert_update_rows, get_inner_dtable_server_url, convert_db_rows, CsrfExemptSessionAuthentication, \
    uuid_str_to_36_chars
from seahub.utils.storage_backend import storage_backend
from seahub.seadoc.utils import get_documents_config

logger = logging.getLogger(__name__)

EXCEL_IMPORT_DIR = '/tmp/dtable-io/'


class DTableExportDTable(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def _password_check(self, request, dtable):
        if not dtable.is_encrypted():
            return True

        password = request.data.get('password')
        if check_password(password, dtable.password):
            return True

        return False

    def post(self, request, workspace_id, name):
        """ download dtable zip

        :param request:
        :param workspace_id:
        :param name: dtable name
        :return:
        """

        # resource check
        try:
            ignore_asset = to_python_boolean(request.data.get('ignore_asset', 'f'))
        except:
            ignore_asset = False

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        password_check = self._password_check(request, dtable)
        if not password_check:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        op_permission, error = check_dtable_operation_permission(request.user.username, workspace, dtable)
        if error:
            error_msg = error
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not op_permission.get('can_export'):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            if not ignore_asset:
                dtable_asset_path = '/asset/' + str(dtable.uuid)
                dtable_export_max_size = getattr(config, 'DTABLE_EXPORT_MAX_SIZE', DTABLE_EXPORT_MAX_SIZE)
                file_info = seafile_api.get_file_count_info_by_path(repo_id, dtable_asset_path)
                if dtable_export_max_size < (file_info.size >> 20):
                    error_msg = _('Export failed. Base size is larger than %s mb.') % dtable_export_max_size
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception:
            pass

        params = {}
        params['username'] = request.user.username
        params['table_name'] = name
        params['repo_id'] = repo_id
        params['workspace_id'] = workspace.id
        params['dtable_uuid'] = str(dtable.uuid)
        params['ignore_asset'] = ignore_asset

        try:
            task_id = add_dtable_io_task(type='export', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, "table": dtable.to_dict()})



class DTableImportDTable(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id):
        """ import dtable from xxx.dtable zip | xxx.csv | xxx.xlsx

        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username

        imported_zip = request.FILES.get('dtable', None)
        if not imported_zip:
            error_msg = 'dtable invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in imported_zip.name:
            error_msg = 'dtable %s invalid.' % imported_zip.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = imported_zip.name.split('.')[-1].lower()
        if extension not in ['dtable', 'csv', 'xlsx']:
            error_msg = 'dtable %s invalid.' % imported_zip.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        folder_id = request.data.get('folder_id')

        # .csv .xlsx file max size limit is 10mb
        if extension in ['csv', 'xlsx'] and imported_zip.size >> 20 > 10:
            error_msg = _('File %s is too large.') % imported_zip.name
            return  api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_file_name = imported_zip.name   # xxx.dtable
        file_name = os.path.splitext(dtable_file_name)[0]

        if DTables.objects.filter(workspace_id=workspace_id, name=file_name).exists():
            error_msg = _('Base %s already exists.') % file_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        folder = None
        if folder_id:
            folder = Folders.objects.filter(id=folder_id).first()
            if not folder:
                error_msg = 'Folder not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_base_limit(workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # create dtable from .dtable
        if extension == 'dtable':
            # post json file after dtable record is created
            # because we need to get dtable uuid
            try:
                dtable = DTables.objects.create_dtable(username, workspace, file_name)
                if folder:
                    FolderItems.objects.create(folder_id=folder.id, item_type=FOLDER_ITEM_DTABLE, item_id=dtable.uuid.hex)
            except OperationalError:
                error_msg = _('File name contains illegal characters')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            uploaded_temp_path = imported_zip.temporary_file_path()
            if not is_zipfile(uploaded_temp_path):
                error_msg = _('A *.dtable file is required.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            params = {}
            params['username'] = request.user.username
            params['repo_id'] = repo_id
            params['workspace_id'] = workspace_id
            params['dtable_uuid'] = str(dtable.uuid)
            params['dtable_file_name'] = dtable_file_name
            params['in_storage'] = dtable.in_storage
            params['can_use_automation_rules'] = can_use_automation_rules_by_dtable(dtable)
            params['can_use_workflows'] = can_use_workflows_by_dtable(dtable)
            params['can_use_external_apps'] = can_use_external_apps_by_dtable(dtable)
            params['owner'] = workspace.owner

            org_id = request.user.org and request.user.org.org_id or -1
            params['org_id'] = org_id

            tmp_extracted_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'dtable_zip_extracted/')
            try:
                with ZipFile(uploaded_temp_path, 'r') as zip_file:
                    zip_file.extractall(tmp_extracted_path)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            try:
                task_id = add_dtable_io_task(type='import', params=params)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            return Response({'task_id': task_id, "table": dtable.to_dict()})

        # parse excel file
        elif extension in ['xlsx', 'csv']:
            # do not create dtable first

            # all rows max limit is 50000
            file = imported_zip.read()
            if extension == 'xlsx':
                try:
                    wb = load_workbook(BytesIO(file), read_only=True)
                except Exception as e:
                    error_msg = _('File content invalid')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                rows_count = 0
                for sheet in wb:
                    # the sheet has some rows, but sheet.max_row maybe get None
                    max_row = sheet.max_row if isinstance(sheet.max_row, int) else len(list(sheet.rows))
                    if max_row:
                        columns_count = sheet.max_column if isinstance(sheet.max_column, int) else len(list(sheet.rows)[0])
                        if columns_count > 500:
                            wb.close()
                            error_msg = _('The number of columns exceeds the limit of 500. Please check if your file contains empty columns.')
                            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                    rows_count += max_row
                wb.close()
                if rows_count > 50000:
                    error_msg = _('The number of rows exceeds the limit of 50000. Please check if your file contains empty rows.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            elif extension == 'csv':
                # parse csv file
                valid, err_msg = validate_csv(file)
                if not valid:
                    return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

            target_dir = os.path.join(EXCEL_IMPORT_DIR, repo_id)
            os.makedirs(target_dir, exist_ok=True)
            tmp_file_path = os.path.join(target_dir, file_name + '.' + extension)
            with open(tmp_file_path, 'wb') as f:
                f.write(file)

            # parse excel
            params = {
                'username': username,
                'repo_id': repo_id,
                'file_name': file_name,
                'file_type': extension,
                'parse_type': 'dtable',
            }

            try:
                task_id = add_dtable_io_task(type='parse-excel-csv', params=params)
            except Exception as e:
                clear_tmp_file(tmp_file_path)
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            return Response({'task_id': task_id, 'dtable_name': file_name})


class DTableImportExcelCSV(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id):
        """ preview excel by json

        :param request:
        :param workspace_id:
        :return:
        """
        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username

        dtable_name = request.GET.get('dtable_name')
        if not dtable_name:
            error_msg = 'dtable_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if DTables.objects.filter(workspace_id=workspace_id, name=dtable_name).exists():
            error_msg = _('Base %s already exists.') % dtable_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        permission = check_dtable_permission(username, workspace, None)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tmp_file_path = os.path.join(EXCEL_IMPORT_DIR, workspace.repo_id, dtable_name + '.json')
        if not os.path.exists(tmp_file_path):
            error_msg = 'File %s.json not found.' % dtable_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            with open(tmp_file_path, 'r') as f:
                json_file = f.read()

            tables = json.loads(json_file)
            for table in tables:
                # preview 200 rows
                table['rows'] = table['rows'][:200]
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'tables': tables})

    def post(self, request, workspace_id):
        """ import excel or csv by json

        :param request:
        :param workspace_id:
        :return:
        """
        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username

        dtable_name = request.data.get('dtable_name')
        if not dtable_name:
            error_msg = 'dtable_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        folder_id = request.data.get('folder_id')

        included_tables = request.data.get('included_tables')
        if not included_tables or not isinstance(included_tables, dict):
            error_msg = 'included_tables invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        for columns in included_tables.values():
            if len(columns) == 0:
                error_msg = 'included_tables invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if DTables.objects.filter(workspace_id=workspace_id, name=dtable_name).exists():
            error_msg = _('Base %s already exists.') % dtable_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        repo_id = workspace.repo_id

        tmp_file_path = os.path.join(EXCEL_IMPORT_DIR, repo_id, dtable_name + '.json')
        if not os.path.exists(tmp_file_path):
            error_msg = 'File %s.json not found.' % dtable_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        folder = None
        if folder_id:
            folder = Folders.objects.filter(id=folder_id).first()
            if not folder:
                error_msg = 'Folder not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_base_limit(workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        permission = check_dtable_permission(username, workspace, None)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # create
        try:
            dtable = DTables.objects.create_dtable(username, workspace, dtable_name)
            if folder:
                FolderItems.objects.create(folder_id=folder.id, item_type=FOLDER_ITEM_DTABLE, item_id=dtable.uuid.hex)
        except OperationalError:
            error_msg = _('File name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            storage_backend.create_empty_dtable(dtable, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        params = {
            'username': username,
            'repo_id': repo_id,
            'dtable_uuid': str(dtable.uuid),
            'dtable_name': dtable_name,
            'lang': request.LANGUAGE_CODE,
            'included_tables': included_tables,
        }
        try:
            task_id = add_import_excel_csv_task(params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'table': dtable.to_dict()})

    def delete(self, request, workspace_id):
        """
        Cancel import excel or and delete json files
        :param request: workspace_id
        :return:
        """
        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username

        dtable_name = request.GET.get('dtable_name')
        if not dtable_name:
            error_msg = 'dtable_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_type = request.GET.get('file_type')

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id

        # permission check
        permission = check_dtable_permission(username, workspace, None)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tmp_json_path = os.path.join(EXCEL_IMPORT_DIR, repo_id, dtable_name + '.json')
        clear_tmp_file(tmp_json_path)

        return Response({'success': True})


class DTableIOStatus(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """
        Get task status by task id
        :param request:
        :return:
        """

        task_id = request.GET.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        resp = query_dtable_io_status(task_id)

        resp_json = resp.json()
        error_msg = resp_json.get('error_msg')

        if resp.status_code == 500 and error_msg == 'Number of cells returned exceeds the limit of 1 million':
            return api_error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, _('Number of cells returned exceeds the limit of 1 million'))

        if resp.status_code == 500 and error_msg == 'Excel format error':
            return api_error(status.HTTP_400_BAD_REQUEST, _('Excel format error'))

        if resp.status_code == 500 and error_msg == 'Import excel or csv error':
            return api_error(status.HTTP_400_BAD_REQUEST, _('Import excel or csv error'))

        if resp.status_code == 500 and error_msg == 'The base size exceeds the limit of 200MB, the operation cannot be performed.':
            return api_error(status.HTTP_400_BAD_REQUEST, _('The base size exceeds the limit of 200MB, the operation cannot be performed.'))

        if resp.status_code == 500 and error_msg == 'Update excel or csv error':
            return api_error(status.HTTP_400_BAD_REQUEST, _('Update excel or csv error'))

        # handle errors about import table from other base
        if resp.status_code == 500 and error_msg.startswith('import_table_from_base:'):
            try:
                error_info = json.loads(error_msg[error_msg.find('import_table_from_base: ') + len('import_table_from_base:'):])
            except:
                logger.error('dtable io query status import table from base error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            if error_info.get('error_type') == 'parameter_error':
                return api_error(status.HTTP_400_BAD_REQUEST,
                                 _('The column data in the source table is invalid and cannot be imported.'))
            elif error_info.get('error_type') == 'table_exist':
                return api_error(status.HTTP_400_BAD_REQUEST,
                                 _('Table exists.'))
            elif error_info.get('error_type') == 'exceed_rows_limit':
                return api_error(status.HTTP_400_BAD_REQUEST,
                                 _('Exceed the rows limit.'))
            elif error_info.get('error_type') == 'exceed_tables_limit':
                return api_error(status.HTTP_400_BAD_REQUEST,
                                 _('Number of tables exceeds 200 limit'))
            else:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # handle errors about import/sync common dataset
        if resp.status_code == 500 and error_msg.startswith('import_sync_common_dataset:'):
            try:
                error_info = json.loads(error_msg[len('import_sync_common_dataset:'):])
            except:
                logger.error('dtable io query status import/sync common dataset error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            if error_info.get('task_status_code') == 500:
                logger.error('dtable io query status import/sync common dataset error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            if error_info.get('task_status_code') == 400:
                logger.warning('dtable io query status import/sync common dataset client bad request: %s, %s' % (task_id, resp.text))
                error_type = error_info.get('error_type')
                # if has pre-defineded error_type, return the corresponding error
                if error_type == 'wrong_filter_in_filters':
                    return api_error(status.HTTP_400_BAD_REQUEST, _('The filters of the corresponding view are invalid. Please reset filters in the view.'))
                elif error_type == 'contains_unsupported_filters':
                    return api_error(status.HTTP_400_BAD_REQUEST, _('The corresponding view contains unsupported filters. Please update the filter in the view.'))
                elif error_type == 'exceed_rows_limit':
                    return api_error(status.HTTP_400_BAD_REQUEST, _('Exceed the rows limit.'))
                elif error_type == 'exceed_columns_limit':
                    return api_error(status.HTTP_400_BAD_REQUEST, _('Exceed the columns limit.'))
                elif error_type == 'base_exceeds_limit':
                    return api_error(status.HTTP_400_BAD_REQUEST, _('The base size exceeds the limit of 200MB, the operation cannot be performed.'))
                elif error_type == 'generate_synced_columns_error':
                    error_msg = error_info.get('error_msg')
                    column_name = error_msg[7:][:-7]
                    error_msg = _('The column %s exists in the selected common dataset, but its column ID is not identical to the column '
                                  'of the same name in this table. Please rename the column %s.') % (column_name, column_name)
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                else:
                    error_msg = error_info.get('error_msg')
                    if error_msg:
                        return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                    else:
                        return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if resp.status_code == 500:
            logger.error('dtable io query status error: %s, %s' % (task_id, resp.text))
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not resp.ok:
            return api_error(resp.status_code, error_msg)

        is_finished = resp_json['is_finished']
        return Response({'is_finished': is_finished})

    def delete(self, request):
        """
        Delete task by task_id
        :param request:
        :return:
        """

        task_id = request.query_params.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        task_type = request.query_params.get('task_type', '')
        if task_type not in ['export', 'import', 'export-page-design']:
            error_msg = 'task_type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.query_params.get('dtable_uuid', '')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        resp = cancel_dtable_io_task(task_id)

        if resp.status_code == 400:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not resp.ok:
            logger.error(resp.content)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        tmp_dir = os.path.join('/tmp/dtable-io', dtable_uuid)
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)

        return Response({'success': True})


class DTablePageDesignConvertToPdfView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):
        page_id = request.GET.get('page_id')
        row_id = request.GET.get('row_id')
        if not page_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page_id invalid.')

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), get_inner_dtable_server_url())
        plugin_settings = dtable_server_api.get_metadata_with_plugin().get('plugin_settings').get('page-design') or []

        page = next(filter(lambda cur_page: cur_page.get('page_id') == page_id, plugin_settings), None)
        if not page:
            return api_error(status.HTTP_404_NOT_FOUND, 'Page not found')

        # permission check
        if not check_dtable_permission(request.user.username, dtable.workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            task_id = convert_page_design_to_pdf({
                'dtable_uuid': str(dtable.uuid),
                'page_id': page_id,
                'row_id': row_id,
                'username': request.user.username
            })
        except Exception as e:
            logger.error('generate convert page design to pdf task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'task_id': task_id})


class DTableDocumentConvertToPdfView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):
        doc_uuid = request.GET.get('doc_uuid')
        row_id = request.GET.get('row_id')

        if not doc_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'doc_uuid invalid.')

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        plugin_settings = get_documents_config(workspace.repo_id, str(dtable.uuid), request.user.username)
        doc = next(filter(lambda cur_doc: cur_doc.get('doc_uuid') == doc_uuid, plugin_settings), None)
        if not doc:
            return api_error(status.HTTP_404_NOT_FOUND, 'Page not found')

        # permission check
        if not check_dtable_permission(request.user.username, dtable.workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            task_id = convert_document_to_pdf({
                'dtable_uuid': str(dtable.uuid),
                'doc_uuid': doc_uuid,
                'row_id': row_id,
                'username': request.user.username
            })
        except Exception as e:
            logger.error('generate convert page to pdf task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'task_id': task_id})


class DTableAppendExcelCSVUploadFile(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id):
        """ append new rows from xxx.xlsx or xxx.csv

        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username

        dtable_uuid = request.data.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name', None)
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in file.name:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = file.name.split('.')[-1].lower()
        if extension not in ['xlsx', 'csv']:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # .xlsx file max size limit is 10mb
        if file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name = file.name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file = file.read()
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if extension == 'xlsx':
            # parse excel file
            # all rows max limit is 50000
            valid, err_msg = validate_excel(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        elif extension == 'csv':
            # parse csv file
            valid, err_msg = validate_csv(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        file_name = os.path.splitext(file_name)[0]
        target_dir = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, file_name + '.' + extension)

        with open(tmp_file_path, 'wb') as f:
            f.write(file)

        # parse excel
        params = {
            'username': username,
            'file_name': file_name,
            'dtable_uuid': dtable_uuid,
            'table_name': table_name,
            'file_type': extension
        }

        try:
            task_id = add_dtable_io_task(type='append-excel-csv-upload-file', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'file_name': os.path.splitext(file_name)[0]})


class DTableExcelCommonGetParsedFile(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id):
        """ preview excel or csv by json

        :param request:
        :param workspace_id:
        :return:
        """

        username = request.user.username

        file_name = request.GET.get('file_name')
        if not file_name:
            error_msg = 'file_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.GET.get('dtable_uuid')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tmp_json_path = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid, file_name + '.json')

        if not os.path.exists(tmp_json_path):
            error_msg = 'File %s.json not found.' % file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            with open(tmp_json_path, 'r') as f:
                json_file = f.read()

            tables = json.loads(json_file)
            # preview 200 rows
            if tables:
                tables[0]['rows'] = tables[0]['rows'][:200]
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'tables': tables})


class DTableAppendExcelCSVAppendParsedFile(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        """ append excel or csv by json

        :param request:
        :param workspace_id:
        :return:
        """
        username = request.user.username

        file_name = request.data.get('file_name')
        if not file_name:
            error_msg = 'file_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.data.get('dtable_uuid')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        tmp_file_path = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid, file_name + '.json')
        if not os.path.exists(tmp_file_path):
            error_msg = 'File %s.json not found.' % file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        can_add_row, can_update_row = check_table_operate_permission(workspace, dtable, username, table_name)
        if not can_add_row:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'username': username,
            'dtable_uuid': str(dtable_uuid),
            'file_name': file_name,
            'table_name': table_name,
        }
        try:
            task_id = add_dtable_io_task(type='append-excel-csv-append-parsed-file', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class DTableImportExcelCSVUploadFile(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id):
        """ import new data from  xxx.xlsx or xxx.csv
        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username
        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in file.name:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = file.name.split('.')[-1].lower()
        if extension not in ['xlsx', 'csv']:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.data.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # .xlsx file max size limit is 10mb
        if file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name = file.name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file = file.read()
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if extension == 'xlsx':
            # parse excel file
            # all rows max limit is 50000
            try:
                wb = load_workbook(BytesIO(file), read_only=True)
            except Exception as e:
                error_msg = _('File content invalid')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            rows_count = 0
            for sheet in wb:
                # the sheet has some rows, but sheet.max_row maybe get None
                max_row = sheet.max_row if isinstance(sheet.max_row, int) else len(list(sheet.rows))
                if max_row:
                    columns_count = sheet.max_column if isinstance(sheet.max_column, int) else len(list(sheet.rows)[0])
                    if columns_count > 500:
                        wb.close()
                        error_msg = _('The number of columns exceeds the limit of 500. Please check if your file contains empty columns.')
                        return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                rows_count += max_row
            wb.close()
            if rows_count > 50000:
                error_msg = _('The number of rows exceeds the limit of 50000. Please check if your file contains empty rows.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        elif extension == 'csv':
            # parse csv file
            valid, err_msg = validate_csv(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        file_name = os.path.splitext(file_name)[0]
        target_dir = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, file_name + '.' + extension)

        with open(tmp_file_path, 'wb') as f:
            f.write(file)

        # parse excel
        params = {
            'username': username,
            'repo_id': workspace.repo_id,
            'file_name': file_name,
            'file_type': extension,
            'dtable_uuid': dtable_uuid,
            'parse_type': 'table',
        }

        try:
            task_id = add_dtable_io_task(type='parse-excel-csv', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'file_name': file_name})


class DTableImportExcelCSVImportParsedFile(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        """ import excel by json
        :param request:
        :param workspace_id:
        :return:
        """
        username = request.user.username

        file_name = request.data.get('file_name')
        if not file_name:
            error_msg = 'file_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.data.get('dtable_uuid')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        included_tables = request.data.get('included_tables')
        if not included_tables or not isinstance(included_tables, dict):
            error_msg = 'included_tables invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        for columns in included_tables.values():
            if len(columns) == 0:
                error_msg = 'included_tables invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        file_path = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid, file_name + '.json')
        if not os.path.exists(file_path):
            error_msg = 'File %s.json not found.' % file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'username': username,
            'dtable_uuid': str(dtable_uuid),
            'dtable_name': file_name,
            'table_name': table_name,
            'lang': request.LANGUAGE_CODE,
            'included_tables': included_tables,
        }
        try:
            task_id = import_excel_csv_add_table_task(params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class DTableExcelCommonDeleteExcel(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, workspace_id):
        """
        delete xlsx and json files
        """

        username = request.user.username
        file_name = request.GET.get('file_name')
        if not file_name:
            error_msg = 'file_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.GET.get('dtable_uuid')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tmp_json_path = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid, file_name + '.json')
        clear_tmp_file(tmp_json_path)

        return Response({'success': True})


class DTableUpdateExcelUploadExcel(APIView):
    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        """ update rows from xxx.xlsx
        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username

        dtable_uuid = request.data.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name', None)
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        excel_file = request.FILES.get('file', None)
        if not excel_file:
            error_msg = 'excel invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in excel_file.name:
            error_msg = 'excel %s invalid.' % excel_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = excel_file.name.split('.')[-1].lower()
        if extension != 'xlsx':
            error_msg = 'excel %s invalid.' % excel_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # .xlsx file max size limit is 10mb
        if excel_file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % excel_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        excel_file_name = excel_file.name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # parse excel file
        # all rows max limit is 50000
        excel_file = excel_file.read()
        valid, err_msg = validate_excel(excel_file)
        if not valid:
            return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        target_dir = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, excel_file_name)

        with open(tmp_file_path, 'wb') as f:
            f.write(excel_file)

        # parse excel
        params = {
            'username': username,
            'file_name': excel_file_name[:-5],
            'dtable_uuid': dtable_uuid,
            'table_name': table_name,
        }

        try:
            task_id = add_dtable_io_task(type='update-excel-upload-excel', params=params)
        except Exception as e:
            clear_tmp_file(tmp_file_path)
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'file_name': excel_file_name[:-5]})


class DTableUpdateExcelCSVUpdateParsedFile(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        """ update excel、csv by json
        :param request:
        :param workspace_id:
        :return:
        """
        username = request.user.username

        file_name = request.data.get('file_name')
        if not file_name:
            error_msg = 'file_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        selected_columns = request.data.get('selected_columns')

        if not selected_columns:
            error_msg = 'selected_columns invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.data.get('dtable_uuid')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        tmp_file_path = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid, file_name + '.json')
        if not os.path.exists(tmp_file_path):
            error_msg = 'File %s.json not found.' % file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        can_add_row, can_update_row = check_table_operate_permission(workspace, dtable, username, table_name)
        if not can_add_row and not can_update_row:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'username': username,
            'workspace_id': workspace_id,
            'dtable_uuid': str(dtable_uuid),
            'file_name': file_name,
            'table_name': table_name,
            'selected_columns': selected_columns,
            'can_add_row': can_add_row,
            'can_update_row': can_update_row,
        }
        try:
            task_id = add_dtable_io_task(type='update-excel-csv-update-parsed-file', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class DTableUpdateExcelCSVGetCheckedResult(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get_rows_from_dtable_db(self, dtable_uuid, table_name, limit=50000):

        dtable_db_api = DTableDBAPI('dtable-web', dtable_uuid, INNER_DTABLE_DB_URL)

        offset = 10000
        start = 0
        dtable_rows = []
        while True:
            # exported row number should less than limit
            if (start + offset) > limit:
                offset = limit - start

            sql = f"SELECT * FROM `{table_name}` LIMIT {start}, {offset}"

            resp_dict = dtable_db_api.query(sql, server_only=True)

            response_rows = resp_dict.get('results', [])
            metadata = resp_dict.get('metadata', [])
            converted_rows = convert_db_rows(metadata, response_rows)
            dtable_rows.extend(converted_rows)

            start += offset
            if start >= limit or len(response_rows) < offset:
                break

        return dtable_rows

    def get_columns_from_dtable_server(self, dtable_uuid, table_name):
        dtable_server_url = get_inner_dtable_server_url()
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, dtable_server_url)
        columns = dtable_server_api.list_columns(table_name)
        return columns

    def get(self, request, workspace_id):
        """ get update result
        :param request:
        :param workspace_id:
        :return:
        """

        username = request.user.username
        file_name = request.GET.get('file_name')
        if not file_name:
            error_msg = 'file_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.GET.get('dtable_uuid')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.GET.get('table_name')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        selected_columns = request.GET.get('selected_columns')
        if not selected_columns:
            error_msg = 'selected_columns invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        tmp_file_path = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid, file_name + '.json')
        if not os.path.exists(tmp_file_path):
            error_msg = 'File %s.json not found.' % file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        with open(tmp_file_path, 'r') as f:
            json_file = f.read()
        tables = json.loads(json_file)

        try:
            dtable_columns = self.get_columns_from_dtable_server(dtable_uuid, table_name)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        excel_rows = tables[0].get('rows', [])
        dtable_col_name_to_column = {col['name']: col for col in dtable_columns}

        key_columns = selected_columns.split(',')

        try:
            dtable_rows = self.get_rows_from_dtable_db(dtable_uuid, table_name)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            insert_rows, update_rows, _ = get_insert_update_rows(dtable_col_name_to_column, excel_rows, dtable_rows, key_columns)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'update_result_info': {'update_num': len(update_rows), 'insert_num': len(insert_rows)}})


class DTableUpdateCSVUploadCSV(APIView):
    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        """ update new rows from xxx.csv
        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username

        dtable_uuid = request.data.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name', None)
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        csv_file = request.FILES.get('file', None)
        if not csv_file:
            error_msg = 'csv invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in csv_file.name:
            error_msg = 'csv %s invalid.' % csv_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = csv_file.name.split('.')[-1].lower()
        if extension != 'csv':
            error_msg = 'excel %s invalid.' % csv_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # .csv file max size limit is 10mb
        if csv_file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % csv_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        csv_file_name = csv_file.name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # parse csv file
        csv_file = csv_file.read()
        valid, err_msg = validate_csv(csv_file)
        if not valid:
            return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        target_dir = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, csv_file_name)
        with open(tmp_file_path, 'wb') as f:
            f.write(csv_file)

        # parse csv
        params = {
            'username': username,
            'file_name': csv_file_name[:-4],
            'dtable_uuid': dtable_uuid,
            'table_name': table_name,
        }

        try:
            task_id = add_dtable_io_task(type='update-csv-upload-csv', params=params)
        except Exception as e:
            clear_tmp_file(tmp_file_path)
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'file_name': csv_file_name[:-4]})


class DTableCSVCommonDeleteCSV(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, workspace_id):
        """
        Cancel update csv and delete json files
        """

        username = request.user.username

        file_name = request.GET.get('file_name')
        if not file_name:
            error_msg = 'file_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.GET.get('dtable_uuid')
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tmp_json_path = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid, file_name + '.json')
        clear_tmp_file(tmp_json_path)

        return Response({'success': True})


class DTableSynchronousImportExcelCSVToBase(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id):
        """ import data from xxx.xlsx or xxx.csv to dtable

        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username

        file = request.FILES.get('dtable', None)
        if not file:
            error_msg = 'dtable invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in file.name:
            error_msg = 'dtable %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = file.name.split('.')[-1].lower()
        if extension not in ['xlsx', 'csv']:
            error_msg = 'dtable %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        folder_id = request.data.get('folder_id')

        # .csv .xlsx file max size limit is 10mb
        if file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_file_name = file.name   # xxx.xlsx
        dtable_name = os.path.splitext(dtable_file_name)[0]

        if DTables.objects.filter(workspace_id=workspace_id, name=dtable_name).exists():
            error_msg = _('Base %s already exists.') % dtable_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        folder = None
        if folder_id:
            folder = Folders.objects.filter(id=folder_id).first()
            if not folder:
                error_msg = 'Folder not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_base_limit(workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file = file.read()
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if extension == 'xlsx':
            # parse excel file
            # all rows max limit is 50000
            try:
                wb = load_workbook(BytesIO(file), read_only=True)
            except Exception as e:
                error_msg = _('File content invalid')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            rows_count = 0
            for sheet in wb:
                # the sheet has some rows, but sheet.max_row maybe get None
                max_row = sheet.max_row if isinstance(sheet.max_row, int) else len(list(sheet.rows))
                if max_row:
                    columns_count = sheet.max_column if isinstance(sheet.max_column, int) else len(list(sheet.rows)[0])
                    if columns_count > 500:
                        wb.close()
                        error_msg = _('The number of columns exceeds the limit of 500. Please check if your file contains empty columns.')
                        return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                rows_count += max_row
            wb.close()
            if rows_count > 50000:
                error_msg = _('The number of rows exceeds the limit of 50000. Please check if your file contains empty rows.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        elif extension == 'csv':
            # parse csv file
            valid, err_msg = validate_csv(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        try:
            dtable = DTables.objects.create_dtable(username, workspace, dtable_name)
            if folder:
                FolderItems.objects.create(folder_id=folder.id, item_type=FOLDER_ITEM_DTABLE, item_id=dtable.uuid.hex)
        except OperationalError:
            error_msg = _('File name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            storage_backend.create_empty_dtable(dtable, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        target_dir = os.path.join(EXCEL_IMPORT_DIR, repo_id)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, dtable_name + '.' + extension)

        with open(tmp_file_path, 'wb') as f:
            f.write(file)

        params = {
            'username': username,
            'repo_id': repo_id,
            'dtable_name': dtable_name,
            'dtable_uuid': str(dtable.uuid),
            'file_type': extension,
            'lang': request.LANGUAGE_CODE,
        }

        try:
            task_id = add_dtable_io_task(type='import-excel-csv-to-dtable', params=params)
        except Exception as e:
            clear_tmp_file(tmp_file_path)
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        start_time = time.time()
        while True:
            time.sleep(1)
            resp = query_dtable_io_status(task_id)

            resp_json = resp.json()
            error_msg = resp_json.get('error_msg')

            if resp.status_code == 500 and error_msg == 'Excel format error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Import excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Update excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500:
                logger.error('dtable io query status error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            if not resp.ok:
                return api_error(resp.status_code, error_msg)

            is_finished = resp_json['is_finished']
            if is_finished:
                return Response({'success': True})
            if time.time() - start_time > 60:
                return api_error(status.HTTP_504_GATEWAY_TIMEOUT, 'Timeout Error.')


class DTableSynchronousImportExcelCSVToTable(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id):
        """ import new data from xxx.xlsx or xxx.csv to table
        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username
        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in file.name:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = file.name.split('.')[-1].lower()
        if extension not in ['xlsx', 'csv']:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = request.data.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # .xlsx .csv file max size limit is 10mb
        if file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name = file.name

        # # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file = file.read()
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if extension == 'xlsx':
            # parse excel file
            # all rows max limit is 50000
            valid, err_msg = validate_excel(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        elif extension == 'csv':
            # parse csv file
            valid, err_msg = validate_csv(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        file_name = os.path.splitext(file_name)[0]
        target_dir = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, file_name + '.' + extension)
        with open(tmp_file_path, 'wb') as f:
            f.write(file)

        # parse and import excel
        params = {
            'username': username,
            'file_name': file_name,
            'dtable_uuid': str(dtable.uuid),
            'file_type': extension,
            'lang': request.LANGUAGE_CODE,
        }

        try:
            task_id = add_dtable_io_task(type='import-excel-csv-to-table', params=params)
        except Exception as e:
            clear_tmp_file(tmp_file_path)
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        start_time = time.time()
        while True:
            time.sleep(1)
            resp = query_dtable_io_status(task_id)

            resp_json = resp.json()
            error_msg = resp_json.get('error_msg')

            if resp.status_code == 500 and error_msg == 'Excel format error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Import excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Update excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500:
                logger.error('dtable io query status error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            if not resp.ok:
                return api_error(resp.status_code, error_msg)

            is_finished = resp_json['is_finished']
            if is_finished:
                return Response({'success': True})
            if time.time() - start_time > 60:
                return api_error(status.HTTP_504_GATEWAY_TIMEOUT, 'Timeout Error.')


class DTableImportTableFromBase(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request):
        """ import table from base
        """
        username = request.user.username
        # arguments check
        src_dtable_uuid = request.data.get('src_dtable_uuid', None)
        src_table_id = request.data.get('src_table_id', None)
        src_table_name = request.data.get('src_table_name', None)
        dst_dtable_uuid = request.data.get('dst_dtable_uuid', None)

        if not src_dtable_uuid:
            error_msg = 'src_dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not src_table_id:
            error_msg = 'src_table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not src_table_name:
            error_msg = 'src_table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not dst_dtable_uuid:
            error_msg = 'dst_dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        src_dtable = DTables.objects.get_dtable_by_uuid(src_dtable_uuid)
        if not src_dtable:
            error_msg = 'Base %s not found.' % src_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        src_workspace_id = src_dtable.workspace_id
        src_workspace = Workspaces.objects.get_workspace_by_id(src_workspace_id)
        if not src_workspace:
            error_msg = 'Workspace %s not found.' % src_workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid)
        if not dst_dtable:
            error_msg = 'Base %s not found.' % dst_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dst_workspace_id = dst_dtable.workspace_id
        dst_workspace = Workspaces.objects.get_workspace_by_id(dst_workspace_id)
        if not dst_workspace:
            error_msg = 'Workspace %s not found.' % dst_workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        op_permission, error = check_dtable_operation_permission(username, src_workspace, src_dtable)
        if error:
            error_msg = error
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not op_permission.get('can_copy'):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # must has dst_dtable's rw permission
        if not check_dtable_permission(username, src_workspace, src_dtable) \
                or check_dtable_permission(username, dst_workspace, dst_dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_server_url = get_inner_dtable_server_url().rstrip('/')
        dtable_server_api = DTableServerAPI(username, str(src_dtable.uuid), dtable_server_url)
        src_metadata = dtable_server_api.get_metadata()

        # check src_table
        src_table = None
        for table in src_metadata.get('tables', []):
            if table.get('_id') == src_table_id:
                src_table = table
                break

        if not src_table:
            error_msg = 'Table %s not found.' % src_table_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # generate request context
        context = {
            'username': username,
            'src_repo_id': src_workspace.repo_id,
            'src_dtable_uuid': str(src_dtable.uuid),
            'src_table_id': src_table_id,
            'dst_workspace_id': str(dst_workspace_id),
            'dst_repo_id': dst_workspace.repo_id,
            'dst_dtable_uuid': str(dst_dtable.uuid),
            'dst_table_name': src_dtable.name + '_' + src_table_name,
            'lang': request.LANGUAGE_CODE,
        }

        try:
            task_id = add_import_table_from_base_task(context)
        except Exception as e:
            logger.error('add import table from base task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'task_id': task_id})


class DTableSynchronousUpdateTableViaExcelCSV(APIView):
    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        """ update rows from xxx.xlsx | xxx.csv
        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username

        dtable_uuid = request.data.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name', None)
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        selected_columns = request.data.get('selected_columns')
        if not selected_columns:
            error_msg = 'selected_columns invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in file.name:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = file.name.split('.')[-1].lower()
        if extension not in ['xlsx', 'csv']:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # .xlsx file max size limit is 10mb
        if file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name = file.name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        can_add_row, can_update_row = check_table_operate_permission(workspace, dtable, username, table_name)
        if not can_add_row and not can_update_row:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file_content = file.read()
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if extension == 'xlsx':
            # parse excel file
            # all rows max limit is 50000
            valid, err_msg = validate_excel(file_content)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)
        elif extension == 'csv':
            # parse csv file
            valid, err_msg = validate_csv(file_content)

            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        file_name = os.path.splitext(file_name)[0]
        target_dir = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, file_name + '.' + extension)

        with open(tmp_file_path, 'wb') as f:
            f.write(file_content)

        params = {
            'username': username,
            'dtable_uuid': str(dtable_uuid),
            'file_name': file_name,
            'table_name': table_name,
            'selected_columns': selected_columns,
            'file_type': extension,
            'can_add_row': can_add_row,
            'can_update_row': can_update_row,
        }

        try:
            task_id = add_dtable_io_task(type='update-table-via-excel-csv', params=params)
        except Exception as e:
            clear_tmp_file(tmp_file_path)
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        start_time = time.time()
        while True:
            time.sleep(1)
            resp = query_dtable_io_status(task_id)

            resp_json = resp.json()
            error_msg = resp_json.get('error_msg')

            if resp.status_code == 500 and error_msg == 'Excel format error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Import excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Update excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500:
                logger.error('dtable io query status error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            if not resp.ok:
                return api_error(resp.status_code, error_msg)

            is_finished = resp_json['is_finished']
            if is_finished:
                return Response({'success': True})
            if time.time() - start_time > 60:
                return api_error(status.HTTP_504_GATEWAY_TIMEOUT, 'Timeout Error.')


class DTableSynchronousAppendExcelCSV(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (ImportRateThrottle, )

    def post(self, request, workspace_id):
        """ append new rows from xxx.xlsx or xxx.csv

        :param request:
        :param workspace_id:
        :return:
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username

        dtable_uuid = request.data.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name', None)
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in file.name:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = file.name.split('.')[-1].lower()
        if extension not in ['xlsx', 'csv']:
            error_msg = 'file %s invalid.' % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # .xlsx file max size limit is 10mb
        if file.size >> 20 > 10:
            error_msg = _('File %s is too large.') % file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name = file.name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if permission != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        can_add_row, can_update_row = check_table_operate_permission(workspace, dtable, username, table_name)
        if not can_add_row:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file = file.read()
        if not file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if extension == 'xlsx':
            # parse excel file
            # all rows max limit is 50000
            valid, err_msg = validate_excel(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        elif extension == 'csv':
            # parse csv file
            valid, err_msg = validate_csv(file)
            if not valid:
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        file_name = os.path.splitext(file_name)[0]
        target_dir = os.path.join(EXCEL_IMPORT_DIR, dtable_uuid)
        os.makedirs(target_dir, exist_ok=True)
        tmp_file_path = os.path.join(target_dir, file_name + '.' + extension)
        with open(tmp_file_path, 'wb') as f:
            f.write(file)

        params = {
            'username': username,
            'file_name': os.path.splitext(file_name)[0],
            'dtable_uuid': dtable_uuid,
            'table_name': table_name,
            'file_type': extension
        }

        try:
            task_id = add_dtable_io_task(type='append-excel-csv-to-table', params=params)
        except Exception as e:
            clear_tmp_file(tmp_file_path)
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        start_time = time.time()
        while True:
            time.sleep(1)
            resp = query_dtable_io_status(task_id)

            resp_json = resp.json()
            error_msg = resp_json.get('error_msg')

            if resp.status_code == 500 and error_msg == 'Excel format error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Import excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500 and error_msg == 'Update excel or csv error':
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if resp.status_code == 500:
                logger.error('dtable io query status error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            if not resp.ok:
                return api_error(resp.status_code, error_msg)

            is_finished = resp_json['is_finished']
            if is_finished:
                return Response({'success': True})
            if time.time() - start_time > 60:
                return api_error(status.HTTP_504_GATEWAY_TIMEOUT, 'Timeout Error.')


class DTableSynchronousExportDTable(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (ExportRateThrottle, )

    def _password_check(self, request, dtable):
        if not dtable.is_encrypted():
            return True

        password = request.GET.get('password', '')
        if check_password(password, dtable.password):
            return True

        return False

    def get(self, request, workspace_id):
        """ download dtable zip

        :param request:
        :param workspace_id:
        :param name: dtable name
        :return:
        """

        # resource check
        dtable_name = request.GET.get('dtable_name', '')
        try:
            ignore_asset = to_python_boolean(request.GET.get('ignore_asset', 'f'))
        except:
            ignore_asset = False

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, dtable_name)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        password_check = self._password_check(request, dtable)
        if not password_check:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        permission = check_dtable_permission(request.user.username, workspace, dtable)

        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        op_permission, error = check_dtable_operation_permission(request.user.username, workspace, dtable)
        if error:
            error_msg = error
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not op_permission.get('can_export'):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)


        try:
            if not ignore_asset:
                dtable_asset_path = '/asset/' + str(dtable.uuid)
                dtable_export_max_size = getattr(config, 'DTABLE_EXPORT_MAX_SIZE', DTABLE_EXPORT_MAX_SIZE)
                file_info = seafile_api.get_file_count_info_by_path(repo_id, dtable_asset_path)
                if dtable_export_max_size < (file_info.size >> 20):
                    error_msg = _('Export failed. Base size is larger than %s mb.') % dtable_export_max_size
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception:
            pass

        params = {}
        params['username'] = request.user.username
        params['table_name'] = dtable_name
        params['repo_id'] = repo_id
        params['workspace_id'] = workspace.id
        params['dtable_uuid'] = str(dtable.uuid)
        params['ignore_asset'] = ignore_asset

        try:
            task_id = add_dtable_io_task(type='export', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        start_time = time.time()
        while True:
            time.sleep(1)
            resp = query_dtable_io_status(task_id)

            resp_json = resp.json()
            error_msg = resp_json.get('error_msg')

            if resp.status_code == 500:
                logger.error('dtable io query status error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            if not resp.ok:
                return api_error(resp.status_code, error_msg)

            if time.time() - start_time > 60:
                return api_error(status.HTTP_504_GATEWAY_TIMEOUT, 'Timeout Error.')

            is_finished = resp_json['is_finished']
            if is_finished:
                break

        tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'zip_file') + '.zip'
        if not os.path.exists(tmp_zip_path):
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(open(tmp_zip_path, 'rb'), content_type="application/x-zip-compressed", as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(dtable.dtable_name) + '.dtable'

        tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid))
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)

        return response


def validate_excel(file_content):
    try:
        wb = load_workbook(BytesIO(file_content), read_only=True)
    except Exception as e:
        return False, _('File content invalid')

    # sheet names may be empty list
    sheet_names = wb.sheetnames
    if not sheet_names:
        return False, _('File content invalid')

    sheet = wb.get_sheet_by_name(sheet_names[0])

    # the sheet has some rows, but sheet.max_row maybe get None
    rows_count = sheet.max_row if isinstance(sheet.max_row, int) else len(list(sheet.rows))
    if not rows_count:
        wb.close()
        return False, _('Sheet is empty.')

    columns_count = sheet.max_column if isinstance(sheet.max_column, int) else len(list(sheet.rows)[0])
    wb.close()
    if rows_count > 50000:
        return False, _('The number of rows exceeds the limit of 50000. Please check if your file contains empty rows.')

    if columns_count > 500:
        return False, _('The number of columns exceeds the limit of 500. Please check if your file contains empty columns.')

    return True, None


def validate_csv(file_content):
    try:
        csv_file = StringIO(file_content.decode())
        delimiter = guess_delimiter(deepcopy(csv_file))
        csv_rows = [row for row in csv.reader(csv_file, delimiter=delimiter)]
    except UnicodeDecodeError:
        error_msg = _('File content invalid')
        return False, error_msg
    rows_count = len(csv_rows)

    if not rows_count:
        return False, _('Sheet is empty.')

    columns_count = len(csv_rows[0])
    if rows_count > 50000:
        return False, _('The number of rows exceeds the limit of 50000. Please check if your file contains empty rows.')

    if columns_count > 500:
        return False, _('The number of columns exceeds the limit of 500. Please check if your file contains empty columns.')

    return True, None


def guess_delimiter(csv_file):
    line = csv_file.readline()

    if not line:
        return ','
    comma_count = line.count(',')
    semicolon_count = line.count(';')
    delimiter = comma_count >= semicolon_count and ',' or ';'

    return delimiter


class DTablePluginBigDataScreenExport(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):
        """ download dtable zip

        :param request:
        :param workspace_id:
        :param name: dtable name
        :return:
        """

        # resource check

        page_id = request.GET.get('page_id')
        if not page_id:
            error_msg = 'page id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {}
        params['username'] = request.user.username
        params['repo_id'] = repo_id
        params['workspace_id'] = workspace.id
        params['dtable_uuid'] = str(dtable.uuid)
        params['page_id'] = page_id

        try:
            task_id = add_dtable_io_big_data_screen_task(type='export', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})

class DTablePluginBigDataScreenImport(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id, name):
        """

        :param request:
        :param workspace_id:
        :param name: dtable name
        :return:
        """

        # resource check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        is_file = to_python_boolean(request.data.get('is_file'))

        page_id = request.data.get('page_id')
        if not page_id:
            error_msg = 'page id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_file:
            imported_zip = request.FILES.get('zip_file', None)
            if not imported_zip:
                error_msg = 'zip invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            uploaded_temp_path = BytesIO(imported_zip.read())
            if not is_zipfile(uploaded_temp_path):
                error_msg = _('A *.zip file is required.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        else:
            uploaded_temp_path = request.data.get('file_url')
            resp = requests.get(uploaded_temp_path)
            uploaded_temp_path = BytesIO(resp.content)
            if not is_zipfile(uploaded_temp_path):
                error_msg = _('A *.zip file is required.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {}
        params['username'] = request.user.username
        params['repo_id'] = repo_id
        params['dtable_uuid'] = str(dtable.uuid)
        params['page_id'] = page_id

        tmp_extracted_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'big_data_screen_zip_extracted/')
        try:
            with ZipFile(uploaded_temp_path, 'r') as zip_file:
                zip_file.extractall(tmp_extracted_path)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


        content_json_file_path = os.path.join(tmp_extracted_path, 'content.json')
        with open(content_json_file_path, 'r') as f:
            content_json = f.read()

        try:
            content = json.loads(content_json)
        except:
            content = {}

        page_images = content.get('page_images', [])

        try:
            task_id = add_dtable_io_big_data_screen_task(type='import', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'page_images': page_images})




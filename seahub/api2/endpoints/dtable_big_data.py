import logging
import json
import time
import datetime
import os
from django.utils.translation import gettext as _
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from seahub.utils import CsrfExemptSessionAuthentication
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.utils import check_dtable_permission, add_dtable_big_data_task, \
    query_dtable_big_data_status, check_table_operate_permission

logger = logging.getLogger(__name__)

TEMP_PATH = "/tmp/big_data/"
TEMP_PATH_UPDATE = "/tmp/big_data_update/"


VALID_BIG_DATA_FILE_TYPES = {
    "excel": ['xlsx', ]
}


def _check_file(file_type, extension):
    if file_type in VALID_BIG_DATA_FILE_TYPES.keys():
        valid_extensions = VALID_BIG_DATA_FILE_TYPES.get(file_type)
        if extension in valid_extensions:
            return True
    return False


class DTableImportBigDataView(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        """ import big data from  xxx.xlsx
        :param request:
        :param workspace_id:
        :return:
        """
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]
        username = request.user.username
        data_file = request.FILES.get('file', None)
        file_type = request.data.get('file_type') # excel, csv, or other types
        table_name = request.data.get('table_name') # the table which the data imported

        if not data_file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in data_file.name:
            error_msg = 'file %s invalid.' % data_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = data_file.name.split('.')[-1].lower()

        if not _check_file(file_type, extension):
            error_msg = 'file %s invalid.' % data_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        # .xlsx file max size limit is 40mb. Base on the space of excel 100000 X 61 datas
        if data_file.size >> 20 > 40:
            error_msg = _('File %s is too large.') % data_file.name
            return  api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name = data_file.name

        # resource check

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, dtable.workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        can_add_row, can_update_row = check_table_operate_permission(dtable.workspace, dtable, username, table_name)
        if not can_add_row:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tmp_path = os.path.join(TEMP_PATH, file_type)
        if not os.path.exists(tmp_path):
            os.makedirs(tmp_path)

        file_path = "%(tmp_path)s/%(timestamp)s_%(file_name)s" % ({
            'tmp_path' : tmp_path.rstrip('/'),
            'timestamp': int(time.time() * 100000),
            'file_name': file_name
        })

        data_file = data_file.read()

        with open(file_path, 'wb') as f:
            f.write(data_file)

        params = {
            'username': username,
            'dtable_uuid': dtable_uuid,
            'table_name': table_name,
            'file_path': file_path,
            'file_name': file_name,
        }

        task_type, log_type = '', ''
        if file_type == 'excel':
            task_type = 'import-big-excel'

        try:
            task_id = add_dtable_big_data_task(type=task_type, params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'file_name': file_name[:-5]})



class DTableUpdateBigDataView(APIView):

    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        """ update big data from  xxx.xlsx
        :param request:
        :param workspace_id:
        :return:
        """
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]
        username = request.user.username
        data_file = request.FILES.get('file', None)
        file_type = request.data.get('file_type') # excel, csv, or other types
        table_name = request.data.get('table_name') # the table which the data imported

        ref_columns = request.data.get('ref_columns', [])
        is_insert_new_data = request.data.get('is_insert_new_data')


        if not data_file:
            error_msg = 'file invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if '.' not in data_file.name:
            error_msg = 'file %s invalid.' % data_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        extension = data_file.name.split('.')[-1].lower()

        if not _check_file(file_type, extension):
            error_msg = 'file %s invalid.' % data_file.name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        # .xlsx file max size limit is 40mb.
        if data_file.size >> 20 > 40:
            error_msg = _('File %s is too large.') % data_file.name
            return  api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        try:
            is_insert_new_data = to_python_boolean(is_insert_new_data)
        except ValueError:
            error_msg = 'is_insert_new_data invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not ref_columns:
            error_msg = 'ref_columns invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_name = data_file.name

        # resource check

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        permission = check_dtable_permission(request.user.username, dtable.workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        can_add_row, can_update_row = check_table_operate_permission(dtable.workspace, dtable, username, table_name)
        if not can_add_row and not can_update_row:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tmp_path = os.path.join(TEMP_PATH_UPDATE, file_type)
        if not os.path.exists(tmp_path):
            os.makedirs(tmp_path)

        file_path = "%(tmp_path)s/%(timestamp)s_%(file_name)s" % ({
            'tmp_path' : tmp_path.rstrip('/'),
            'timestamp': int(time.time() * 100000),
            'file_name': file_name
        })

        data_file = data_file.read()

        with open(file_path, 'wb') as f:
            f.write(data_file)

        params = {
            'username': username,
            'dtable_uuid': dtable_uuid,
            'table_name': table_name,
            'file_path': file_path,
            'file_name': file_name,
            'ref_columns': ref_columns,
            'is_insert_new_data': is_insert_new_data,
            'can_add_row': can_add_row,
            'can_update_row': can_update_row,
        }

        task_type, log_type = '', ''
        if file_type == 'excel':
            task_type = 'update-big-excel'


        try:
            task_id = add_dtable_big_data_task(type=task_type, params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'file_name': file_name[:-5]})


class DTableBigDataStatusView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        task_id = request.query_params.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:

            resp = query_dtable_big_data_status(task_id)
            if resp.status_code == 400:
                error_msg = 'task_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not resp.ok:
                logger.error(resp.content)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            resp_info = json.loads(resp.content)
            is_finished = resp_info['is_finished']
            result = resp_info['result']

            resp_dict =  {
                'is_finished': is_finished,
                'result': result,
            }

        except Exception as e:
            logger.error(e)
            error_msg = "Internal Server Error"
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(resp_dict)

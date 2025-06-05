# -*- coding: utf-8 -*-

import logging
import os
import time
import json
import shutil

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from urllib.parse import quote
from django.http import FileResponse

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle, ExportRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces, DTables, IdInOrgTuple
from seahub.dtable.utils import check_dtable_permission, get_view_share_permission_by_view, convert_view_to_excel, \
    convert_table_to_excel, query_dtable_io_status, check_dtable_operation_permission, add_dtable_big_data_task
from seahub.department_v2.utils import get_departments_map_by_request_dtable

logger = logging.getLogger(__name__)

TEMP_EXPORT_VIEW_DIR = '/tmp/dtable-io/export-view-to-excel/'

class DTableConvertViewToExcel(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):

        # argument check
        table_id = request.GET.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_id = request.GET.get('view_id', '')
        if not view_id:
            error_msg = 'view_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_support_image = request.GET.get('is_support_image', 'false')
        if is_support_image not in ('true', 'false'):
            error_msg = 'is_support_image invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable) \
                     or get_view_share_permission_by_view(request.user.username, dtable, table_id, view_id)
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

        username = request.user.username
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
        user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)

        try:
            task_id = convert_view_to_excel({
                'dtable_uuid': str(dtable.uuid),
                'table_id': table_id,
                'view_id': view_id,
                'username': username,
                'id_in_org': id_in_org,
                'user_department_ids_map': user_department_ids_map,
                'permission': permission,
                'name': name,
                'repo_id': workspace.repo_id,
                'is_support_image': is_support_image,
            })
        except Exception as e:
            logger.error('convert view to excel task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'task_id': task_id})


class DTableConvertBigDataViewToExcel(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):

        # argument check
        table_id = request.GET.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_id = request.GET.get('view_id', '')
        if not view_id:
            error_msg = 'view_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username

        # permission check
        permission = check_dtable_permission(username, workspace, dtable) \
                     or get_view_share_permission_by_view(username, dtable, table_id, view_id)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        op_permission, error = check_dtable_operation_permission(username, workspace, dtable)
        if error:
            error_msg = error
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not op_permission.get('can_export'):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        is_support_image = request.GET.get('is_support_image', 'false')
        if is_support_image not in ('true', 'false'):
            error_msg = 'is_support_image invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        params = {
                'dtable_uuid': str(dtable.uuid),
                'table_id': table_id,
                'view_id': view_id,
                'username': username,
                'name': name,
                'repo_id': workspace.repo_id,
                'is_support_image': is_support_image,
            }

        try:
            task_id = add_dtable_big_data_task(type='convert-big-data-view-to-excel', params=params)
        except Exception as e:
            logger.error('convert big data view to excel task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'task_id': task_id})


class DTableExportExcel(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):

        task_id = request.GET.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.GET.get('table_name', '')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_name = request.GET.get('view_name', '')
        if not view_name:
            error_msg = 'view_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_id = request.GET.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_id = request.GET.get('view_id', '')
        if not view_id:
            error_msg = 'view_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable) \
                     or get_view_share_permission_by_view(request.user.username, dtable, table_id, view_id)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        excel_name = name + '_' + table_name + ('_' + view_name if view_name else '') + '.xlsx'
        target_dir = TEMP_EXPORT_VIEW_DIR + str(dtable.uuid)
        tmp_excel_path = os.path.join(target_dir, excel_name)
        if not os.path.isfile(tmp_excel_path):
            return api_error(status.HTTP_404_NOT_FOUND, excel_name + ' not found.')

        # tmp-excel-file is in container, for download multiple times do not delete it
        response = FileResponse(open(tmp_excel_path, 'rb'), content_type='application/ms-excel', as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(excel_name)
        return response


class DTableConvertTableToExcel(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):

        # argument check
        table_id = request.GET.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_support_image = request.GET.get('is_support_image', 'false')

        if is_support_image not in ('true', 'false'):
            error_msg = 'is_support_image invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username

        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
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
            task_id = convert_table_to_excel({
                'dtable_uuid': str(dtable.uuid),
                'table_id': table_id,
                'username': username,
                'permission': permission,
                'name': name,
                'repo_id': workspace.repo_id,
                'is_support_image': is_support_image,
            })
        except Exception as e:
            logger.error('convert table to excel task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'task_id': task_id})


class DTableExportTableToExcel(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):

        task_id = request.GET.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.GET.get('table_name', '')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_permission(request.user.username, workspace, dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        excel_name = name + '_' + table_name + '.xlsx'
        target_dir = '/tmp/dtable-io/export-table-to-excel/' + str(dtable.uuid)
        tmp_excel_path = os.path.join(target_dir, excel_name)

        if not os.path.isfile(tmp_excel_path):
            return api_error(status.HTTP_404_NOT_FOUND, excel_name + ' not found.')

        # tmp-excel-file is in container, for download multiple times do not delete it
        response = FileResponse(open(tmp_excel_path, 'rb'), content_type='application/ms-excel', as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(excel_name)
        return response


class DTableSynchronousConvertTableToExcel(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (ExportRateThrottle, )

    def get(self, request, workspace_id):

        # argument check
        table_id = request.GET.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.GET.get('table_name', '')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_name = request.GET.get('dtable_name', '')
        if not dtable_name:
            error_msg = 'dtable_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_support_image = request.GET.get('is_support_image', 'false')
        if is_support_image not in ('true', 'false'):
            error_msg = 'is_support_image invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, dtable_name)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username

        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
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
            task_id = convert_table_to_excel({
                'dtable_uuid': str(dtable.uuid),
                'table_id': table_id,
                'username': username,
                'permission': permission,
                'name': dtable_name,
                'repo_id': workspace.repo_id,
                'is_support_image': is_support_image,
            })
        except Exception as e:
            logger.error('convert table to excel task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

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

        excel_name = dtable_name + '_' + table_name + '.xlsx'
        target_dir = '/tmp/dtable-io/export-table-to-excel/' + str(dtable.uuid)
        tmp_excel_path = os.path.join(target_dir, excel_name)

        if not os.path.isfile(tmp_excel_path):
            return api_error(status.HTTP_404_NOT_FOUND, excel_name + ' not found.')

        response = FileResponse(open(tmp_excel_path, 'rb'), content_type='application/ms-excel', as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(excel_name)

        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)

        return response


class DTableSynchronousConvertViewToExcel(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (ExportRateThrottle, )

    def get(self, request, workspace_id):

        # argument check
        table_id = request.GET.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_id = request.GET.get('view_id', '')
        if not view_id:
            error_msg = 'view_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.GET.get('table_name', '')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_name = request.GET.get('view_name', '')
        if not view_name:
            error_msg = 'view_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_name = request.GET.get('dtable_name', '')
        if not dtable_name:
            error_msg = 'dtable_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_support_image = request.GET.get('is_support_image', 'false')
        if is_support_image not in ('true', 'false'):
            error_msg = 'is_support_image invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, dtable_name)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(request.user.username, workspace, dtable) \
                     or get_view_share_permission_by_view(request.user.username, dtable, table_id, view_id)
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

        username = request.user.username
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

        try:
            task_id = convert_view_to_excel({
                'dtable_uuid': str(dtable.uuid),
                'table_id': table_id,
                'view_id': view_id,
                'username': username,
                'id_in_org': id_in_org,
                'permission': permission,
                'name': dtable_name,
                'repo_id': workspace.repo_id,
                'is_support_image': is_support_image,
            })
        except Exception as e:
            logger.error('convert view to excel task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

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

            is_finished = json.loads(resp.content)['is_finished']
            if is_finished:
                break

        excel_name = dtable_name + '_' + table_name + ('_' + view_name if view_name else '') + '.xlsx'
        target_dir = TEMP_EXPORT_VIEW_DIR + str(dtable.uuid)
        tmp_excel_path = os.path.join(target_dir, excel_name)

        if not os.path.isfile(tmp_excel_path):
            return api_error(status.HTTP_404_NOT_FOUND, excel_name + ' not found.')

        response = FileResponse(open(tmp_excel_path, 'rb'), content_type='application/ms-excel', as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(excel_name)

        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)

        return response

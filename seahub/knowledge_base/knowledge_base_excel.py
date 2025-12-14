# -*- coding: utf-8 -*-
import os
import logging
from urllib.parse import quote

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.http import FileResponse

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle, ExportRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.project.utils import check_project_permission
from seahub.knowledge_base.models import KnowledgeBaseViews
from seahub.settings import TEMP_EXPORT_VIEW_DIR
from seahub.knowledge_base.utils import convert_kb_view_to_excel, query_kb_task_status, import_kb_from_excel


logger = logging.getLogger(__name__)


class KnowledgeBaseConvertViewToExcel(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        view_id = request.GET.get('view_id', '')
        if not view_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'view_id invalid.')


        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        params = {
            'project_uuid': str(project_uuid),
            'view_id': view_id,
            'username': username,
        }
        try:
            task_id = convert_kb_view_to_excel(params)
        except Exception as e:
            logger.error('convert kb view to excel task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class KnowledgeBaseIOStatus(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        task_id = request.GET.get('task_id', '')
        if not task_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_id invalid.')

        resp = query_kb_task_status(task_id)
        try:
            resp_json = resp.json()
        except Exception:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        error_msg = resp_json.get('error_msg')
        if resp.status_code == 500 and error_msg:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not resp.ok:
            return api_error(resp.status_code, error_msg)
        return Response(resp_json)


class KnowledgeBaseExportExcel(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (ExportRateThrottle,)

    def get(self, request, project_uuid):
        task_id = request.GET.get('task_id', '')
        if not task_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_id invalid.')

        view_id = request.GET.get('view_id', '')
        if not view_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'view_id invalid.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        view = KnowledgeBaseViews.objects.get_view(project_uuid, view_id)
        if not view:
            return api_error(status.HTTP_404_NOT_FOUND, 'View not found.')

        view_name = view.get('name')
        project_name = project.name
        excel_name = f'{project_name}_knowledge_base_{view_name}.xlsx'
        target_dir = os.path.join(TEMP_EXPORT_VIEW_DIR, str(project_uuid))
        tmp_excel_path = os.path.join(target_dir, excel_name)
        if not os.path.isfile(tmp_excel_path):
            return api_error(status.HTTP_404_NOT_FOUND, excel_name + ' not found.')

        resp = FileResponse(open(tmp_excel_path, 'rb'), content_type='application/ms-excel', as_attachment=True)
        resp['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(excel_name)
        return resp


class KnowledgeBaseImportExcel(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        preview_only = request.data.get('preview_only')
        preview_only = str(preview_only).lower() in ('true', '1', 'yes') if preview_only is not None else False

        file_obj = request.FILES.get('file')
        file_name = request.data.get('file_name') or (file_obj.name if file_obj else None)
        if not file_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'File not found.')
        if not file_name.endswith('.xlsx'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'File type invalid.')

        if file_obj:
            temp_dir = os.path.join(TEMP_EXPORT_VIEW_DIR, str(project_uuid))
            os.makedirs(temp_dir, exist_ok=True)
            file_path = os.path.join(temp_dir, file_obj.name)
            with open(file_path, 'wb+') as destination:
                for chunk in file_obj.chunks():
                    destination.write(chunk)

        params = {
            'project_uuid': str(project_uuid),
            'username': username,
            'file_name': file_name,
            'preview_only': preview_only,
        }
        try:
            task_id = import_kb_from_excel(params)
        except Exception as e:
            logger.error('import kb task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})

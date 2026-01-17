# -*- coding: utf-8 -*-
import os
import sys
import logging
from email.utils import formatdate

from django.utils import timezone
from django.utils.translation import gettext as _
from django.http import FileResponse

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils.decorators import require_org_context
from seahub.project.models import Projects
from seahub.project.utils import check_project_admin_permission, check_project_permission, \
    upload_file_to_tmp_dir, get_file_from_s3, delete_file_from_s3, gen_tmp_upload_file_path
from seahub.project.constants import IMAGE_EXTS


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)

class ProjectUploadFileAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request, project_uuid):
        """
        Upload a file to /tmp.
        TicketsAPIView and TicketCommentsAPIView upload files to S3.

        Permission:
        1. group member
        """
        # argument check
        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file not found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if file.name.split('.')[-1] in IMAGE_EXTS and file.size > 1024 * 1024 * settings.PROJECT_IMAGE_MAX_SIZE:
            error_msg = 'Image size cannot exceed %s Mb.' % settings.PROJECT_IMAGE_MAX_SIZE
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if file.size > 1024 * 1024 * settings.PROJECT_FILE_MAX_SIZE:
            error_msg = 'File size cannot exceed %s Mb.' % settings.PROJECT_FILE_MAX_SIZE
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            tmp_upload_file_path = upload_file_to_tmp_dir(project_uuid, file)
            file_url = tmp_upload_file_path.replace("/tmp/projects/", "/upload-file/project/")
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'url': file_url}, status=status.HTTP_201_CREATED)


class GetProjectUploadFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, file_path):
        """
        Get a file from /tmp.

        Permission:
        1. group member
        """
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(open(tmp_upload_file_path, 'rb'))
        response['Cache-Control'] = 'max-age=604800, public'
        response['ETag'] = '"' + str(os.path.getsize(tmp_upload_file_path)) + '"'
        response['Last-Modified'] = formatdate(int(os.path.getmtime(tmp_upload_file_path)), usegmt=True)
        return response


class ProjectFileAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def delete(self, request, project_uuid, file_path):
        """
        Permission:
        1. group admin
        """
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            delete_file_from_s3(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class GetProjectFileView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, file_path):
        """
        Permission:
        1. group member
        """
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            file = get_file_from_s3(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(file)
        response['Cache-Control'] = 'max-age=604800, public'
        response['ETag'] = '"' + str(sys.getsizeof(file)) + '"'
        response['Last-Modified'] = formatdate(int(timezone.now().timestamp()), usegmt=True)
        return response


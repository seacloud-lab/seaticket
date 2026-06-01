# -*- coding: utf-8 -*-
import os
import logging
from email.utils import formatdate

from django.utils import timezone
from django.http import FileResponse, HttpResponseNotModified

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.portal.permissions import PortalFilePermission, PortalUploadPermission
from seahub.portal.utils import portal_endpoint
from seahub.utils.storage import (
    FileNotFound,
    gen_tmp_upload_file_path,
    get_project_file_from_s3,
    get_project_file_head_from_s3,
    if_none_match_hit,
    upload_file_to_tmp_dir,
)
from seahub.project.constants import IMAGE_EXTS
from seahub.utils import gen_file_etag_and_modified_time


logger = logging.getLogger(__name__)

PORTAL_VISIBLE_ATTACHMENT_PREFIXES = (
    'attachments/portal-chat/',
    'attachments/portal-issue/',
    'attachments/knowledgebase/',
)


class PortalUploadFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalUploadPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def post(self, request, project_uuid):
        file = request.FILES.get('file', None)
        if not file:
            return api_error(status.HTTP_400_BAD_REQUEST, 'file not found.')

        if file.name.split('.')[-1] in IMAGE_EXTS and file.size > 1024 * 1024 * settings.PROJECT_IMAGE_MAX_SIZE:
            return api_error(
                status.HTTP_400_BAD_REQUEST,
                'Image size cannot exceed %s Mb.' % settings.PROJECT_IMAGE_MAX_SIZE,
            )
        if file.size > 1024 * 1024 * settings.PROJECT_FILE_MAX_SIZE:
            return api_error(
                status.HTTP_400_BAD_REQUEST,
                'File size cannot exceed %s Mb.' % settings.PROJECT_FILE_MAX_SIZE,
            )

        try:
            tmp_upload_file_path = upload_file_to_tmp_dir(project_uuid, file, subdir='portal')
            rel = tmp_upload_file_path.split(f'/tmp/projects/{project_uuid}/portal/', 1)[1]
            file_url = f'/upload-file/portal/{project_uuid}/{rel}'
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'url': file_url}, status=status.HTTP_201_CREATED)


class GetPortalUploadFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalUploadPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid, file_path):
        tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, f'portal/{file_path}')
        if not os.path.exists(tmp_upload_file_path):
            return api_error(status.HTTP_404_NOT_FOUND, 'File not exist.')

        etag, last_modified_time = gen_file_etag_and_modified_time(tmp_upload_file_path)
        if if_none_match_hit(request, etag):
            not_modified = HttpResponseNotModified()
            not_modified['Cache-Control'] = 'max-age=604800, private'
            return not_modified

        response = FileResponse(open(tmp_upload_file_path, 'rb'))
        response['Cache-Control'] = 'max-age=604800, private'
        response['ETag'] = etag
        response['Last-Modified'] = formatdate(int(last_modified_time), usegmt=True)
        return response


class PortalFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalFilePermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid, file_path):
        if not any(file_path.startswith(prefix) for prefix in PORTAL_VISIBLE_ATTACHMENT_PREFIXES):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            s3_meta = get_project_file_head_from_s3(project_uuid, file_path)
        except FileNotFound:
            return api_error(status.HTTP_404_NOT_FOUND, 'File not exist')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        etag = s3_meta.get('ETag')
        if etag and if_none_match_hit(request, etag):
            not_modified = HttpResponseNotModified()
            not_modified['Cache-Control'] = 'max-age=604800, private'
            return not_modified

        try:
            file = get_project_file_from_s3(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        response = FileResponse(file)
        response['Cache-Control'] = 'max-age=604800, private'
        if etag:
            response['ETag'] = etag
        if s3_meta.get('LastModified'):
            response['Last-Modified'] = formatdate(int(s3_meta['LastModified'].timestamp()), usegmt=True)
        else:
            response['Last-Modified'] = formatdate(int(timezone.now().timestamp()), usegmt=True)
        return response

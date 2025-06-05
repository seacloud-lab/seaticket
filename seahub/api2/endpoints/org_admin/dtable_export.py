# -*- coding: utf-8 -*-
import logging

from django.utils.translation import gettext as _
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seaserv import seafile_api, ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.utils import check_dtable_permission, add_dtable_io_task
from seahub.settings import DTABLE_EXPORT_MAX_SIZE
from constance import config


logger = logging.getLogger(__name__)


class OrgAdminExportDTable(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id, dtable_uuid):
        """ download dtable zip

        :param request:
        :param workspace_id:
        :param name: dtable name
        :return:
        """

        # resource check
        org_id = int(org_id)
        try:
            ignore_asset = to_python_boolean(request.GET.get('ignore_asset', 'f'))
        except:
            ignore_asset = False
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if dtable.is_encrypted():
            error_msg = 'Base is password protected, cannot be exported.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if dtable.workspace.org_id != org_id:
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
        params['table_name'] = dtable.name
        params['repo_id'] = repo_id
        params['workspace_id'] = dtable.workspace_id
        params['dtable_uuid'] = str(dtable.uuid)
        params['ignore_asset'] = ignore_asset
        try:
            task_id = add_dtable_io_task(type='export', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, "table": dtable.to_dict()})

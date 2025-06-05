# Copyright (c) 2012-2016 Seafile Ltd.
import logging
import json
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import seafile_api, ccnet_api

from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.group.utils import is_group_admin_or_owner
from seahub.dtable.models import DTables
from seahub.dtable.signals import restore_dtable_from_trash
from seahub.dtable.utils import restore_trash_dtable_names
from seahub.utils.storage_backend import storage_backend
from seahub.audit_log.models import GROUP_BASE_RESTORE
from seahub.audit_log.signals import audit_operation

from .utils import api_check_group

logger = logging.getLogger(__name__)


class GroupTrashDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    @api_check_group
    def get(self, request, group_id):
        # only group owner/admin can get info of group trash dtables
        if not is_group_admin_or_owner(group_id, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        owner = str(group_id) + '@seafile_group'
        try:
            dtables = DTables.objects.filter(deleted=True, workspace__owner=owner).select_related('workspace').order_by('-delete_time')
        except Exception as e:
            logger.error('get deleted dtables error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        results = [dtable.to_dict(include_deleted=True) for dtable in dtables]

        return Response({'trash_dtable_list': results})


class GroupTrashDTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    @api_check_group
    def put(self, request, group_id, dtable_uuid):
        # argument check
        username = request.user.username

        # only group owner/admin can restore group trash dtable
        if not is_group_admin_or_owner(group_id, username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        owner = str(group_id) + '@seafile_group'

        # resource check
        dtable = DTables.objects.filter(uuid=dtable_uuid, workspace__owner=owner, deleted=True).select_related('workspace').first()
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_dtable_name, old_dtable_file_name, new_dtable_file_name = restore_trash_dtable_names(dtable)
        # check existed dtable
        if DTables.objects.get_dtable(dtable.workspace, new_dtable_name):
            error_msg = 'Table with name "%s" exists.' % new_dtable_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # rename table
        try:
            storage_backend.rename_dtable(dtable, old_dtable_file_name, new_dtable_file_name, username)
        except Exception as e:
            logger.error('restore dtable file: %s name: %s error: %s', dtable.id, dtable.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # restore dtable
        try:
            DTables.objects.filter(uuid=dtable_uuid, deleted=True).update(deleted=False, delete_time=None,
                                                                      name=new_dtable_name)
            restore_dtable_from_trash.send(None, dtable_uuid=dtable.uuid.hex)
            group = ccnet_api.get_group(group_id)
            audit_operation.send(None, username=username, operation=GROUP_BASE_RESTORE, detail={
                'id': group_id,
                'name': group.group_name,
                'dtable_name': new_dtable_name,
                'dtable_uuid': str(dtable.uuid)
            }, org_id=dtable.workspace.org_id)

        except Exception as e:
            logger.error('restore dtable: %s name: %s error: %s', dtable.id, dtable.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

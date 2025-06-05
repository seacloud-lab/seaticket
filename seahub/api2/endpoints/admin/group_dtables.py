import logging
from datetime import datetime

from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seaserv import ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.signals import move_dtable_to_trash
from seahub.dtable.utils import get_dtable_owner, get_dtables_rows_count, convert_dtable_trash_names
from seahub.utils.storage_backend import storage_backend
from seahub.api2.endpoints.admin.utils import get_dtable_size
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import BASE_DELETE


logger = logging.getLogger(__name__)
FILE_TYPE = '.dtable'


def get_dtable_info(dtable, include_deleted=False, rows_count_dict=None):
    dtable_info = dtable.to_dict(include_deleted=include_deleted)
    creator, modifier = dtable.creator, dtable.modifier
    owner_name, owner_deleted = get_dtable_owner(dtable)
    file_size = get_dtable_size(dtable)
    dtable_info['file_size'] = file_size or None
    dtable_info.update({
        'owner': owner_name,
        'owner_deleted': owner_deleted,
        'creator': email2nickname(creator),
        'modifier': email2nickname(modifier),
        'creator_email': creator
    })
    if rows_count_dict:
        dtable_info['rows_count'] = rows_count_dict.get(dtable.uuid.hex, 0)
    return dtable_info


class AdminGroupDTables(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, group_id):
        """
        get workspace by group id
        get dtables from workspace
        :param request:
        :param group_id:
        :return:
        """
        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        if not group:
            error_msg = _('Group not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        table_list = []
        dtables = DTables.objects.filter(workspace=workspace, deleted=False)
        rows_count_dict = get_dtables_rows_count([d.uuid.hex for d in dtables])

        for dtable in dtables:
            dtable_info = get_dtable_info(dtable, rows_count_dict=rows_count_dict)
            table_list.append(dtable_info)
        return Response({
            'tables': table_list,
            'group_name': group.group_name,
        })


class AdminGroupDTable(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, group_id, dtable_uuid):
        """
        delete a dtable from a group
        :param request:
        :param group_id:
        :param dtable_uuid:
        :return:
        """
        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        if not group:
            error_msg = _('Group not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.filter(workspace=workspace, uuid=dtable_uuid).first()
        if not dtable:
            error_msg = _('Base not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        # rename .dtable file
        new_dtable_name, old_dtable_file_name, new_dtable_file_name = convert_dtable_trash_names(dtable)

        # if has .dtable file, then rename, else skip
        try:
            storage_backend.rename_dtable(dtable, old_dtable_file_name, new_dtable_file_name, username)
        except Exception as e:
            logger.error('delete base file: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            DTables.objects.filter(id=dtable.id).update(
                deleted=True, delete_time=datetime.now(), name=new_dtable_name)
            move_dtable_to_trash.send(None, dtable_uuid=dtable.uuid.hex)
        except Exception as e:
            logger.error('delete base: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # send admin operation log signal
        admin_op_detail = {
            'name': dtable.name,
            'dtable_uuid': str(dtable.uuid),
            'group_id': group_id,
            'group_name': group.group_name
        }

        if workspace.org_id != -1:
            org = ccnet_api.get_org_by_id(workspace.org_id)
            if org:
                admin_op_detail['org_name'] = org.org_name
                admin_op_detail['org_id'] = org.org_id

        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=BASE_DELETE, detail=admin_op_detail)

        return Response({'success': True}, status=status.HTTP_200_OK)

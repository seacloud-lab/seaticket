# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from django.utils.translation import gettext as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import seafile_api, ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import normalize_file_path
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.organizations.views import get_org_id_by_group
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.signals import move_dtable_to_trash
from seahub.dtable.utils import convert_dtable_trash_names, get_dtable_owner, get_dtables_rows_count
from seahub.utils.storage_backend import storage_backend
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import BASE_DELETE

logger = logging.getLogger(__name__)
FILE_TYPE = '.dtable'

class OrgAdminGroupDTables(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id, group_id):
        """
        list org group bases
        """
        # resource check
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        table_list = []
        dtables = DTables.objects.filter(workspace=workspace, deleted=False)
        dtable_rows_count_dict = get_dtables_rows_count([d.uuid.hex for d in dtables])
        for dtable in dtables:
            owner_name, _ = get_dtable_owner(dtable)
            dtable_dict = dict()
            dtable_dict['id'] = dtable.pk
            dtable_dict['workspace_id'] = dtable.workspace_id
            dtable_dict['uuid'] = dtable.uuid
            dtable_dict['name'] = dtable.name
            dtable_dict['creator'] = email2nickname(dtable.creator)
            dtable_dict['owner'] = owner_name
            dtable_dict['creator_email'] = dtable.creator
            dtable_dict['modifier'] = email2nickname(dtable.modifier)
            dtable_dict['created_at'] = datetime_to_isoformat_timestr(dtable.created_at)
            dtable_dict['updated_at'] = datetime_to_isoformat_timestr(dtable.updated_at)
            dtable_dict['rows_count'] = dtable_rows_count_dict.get(dtable.uuid.hex, 0)
            table_list.append(dtable_dict)
        return Response({'tables': table_list})


class OrgAdminGroupDTable(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)

    def delete(self, request, org_id, group_id, dtable_uuid):
        """
        delete a dtable from a group
        """
        # resource check
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.filter(workspace=workspace, uuid=dtable_uuid).first()
        if not dtable:
            error_msg = _('Base not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        table_file_name = dtable.name + '.dtable'
        repo_id = workspace.repo_id
        # rename .dtable file
        new_dtable_name, old_dtable_file_name, new_dtable_file_name = convert_dtable_trash_names(dtable)

        # if has .dtable file, then rename, else skip
        try:
            storage_backend.rename_dtable(dtable, old_dtable_file_name, new_dtable_file_name, username)
        except Exception as e:
            logger.error('delete dtable file: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            DTables.objects.filter(id=dtable.id).update(
                deleted=True, delete_time=datetime.now(), name=new_dtable_name)
            move_dtable_to_trash.send(None, dtable_uuid=dtable.uuid.hex)
        except Exception as e:
            logger.error('delete dtable: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        detail = {
            'name': dtable.name,
            'dtable_uuid': str(dtable.uuid),
            'group_id': group_id,
            'group_name': ccnet_api.get_group(group_id).group_name
        }

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=BASE_DELETE, detail=detail, org_id=org_id)

        return Response({'success': True}, status=status.HTTP_200_OK)

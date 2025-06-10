# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils.translation import gettext as _

from seahub.api2.utils import api_error
from seahub.signals import group_deleted
from seahub.organizations.views import get_org_id_by_group
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.permissions import IsProVersion
from seahub.api2.authentication import TokenAuthentication
from seahub.dtable.models import Workspaces, DTables


logger = logging.getLogger(__name__)


class AdminOrgAddressBookGroup(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def delete(self, request, org_id, group_id):
        """ Delete an org address book group.
        """
        # arguments check
        org_id = int(org_id)
        if org_id <= 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        if not request.user.admin_permissions.can_manage_organization():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            child_groups = ccnet_api.get_child_groups(group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if len(child_groups) > 0:
            error_msg = 'There are sub-departments in this department.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # dtables check
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if workspace:
            if DTables.objects.filter(workspace=workspace, deleted=False).exists():
                error_msg = _('Cannot delete group with bases')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # mark group's workspace as deleted
            try:
                Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now())
            except Exception as e:
                logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            ccnet_api.remove_org_group(org_id, group_id)
            ret_code = ccnet_api.remove_group(group_id)
            group_deleted.send(sender=None, group_id=group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if ret_code == -1:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

# -*- coding: utf-8 -*-
import logging

from django.utils import timezone

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.api2.permissions import IsProVersion
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.signals import group_deleted
from seahub.project.models import Workspaces, Projects
from seahub.organizations.views import get_org_id_by_group
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import GROUP_DELETE
from seahub.organizations.models import Organization, OrgGroup
from seahub.group.models import Group

try:
    from seahub.settings import ORG_MEMBER_QUOTA_ENABLED
except ImportError:
    ORG_MEMBER_QUOTA_ENABLED = False

logger = logging.getLogger(__name__)


def get_org_group_info(group):
    group_info = dict()
    group_info['name'] = group.group_name
    group_info['creator_name'] = email2nickname(group.creator_name)
    group_info['creator_email'] = group.creator_name
    group_info['created_at'] = timestamp_to_isoformat_timestr(group.timestamp)
    group_info['id'] = group.group_id

    return group_info


class AdminOrgGroups(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request, org_id):
        """ Get all groups in an org.
        Permission checking:
        1. only admin can perform this action.
        """
        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            groups = OrgGroup.objects.get_org_groups(org_id)
        except Exception as e:
            logger.error(e)
            error_msg = "Internal Server Error"
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        groups_info = []
        for group in groups:
            groups_info.append(get_org_group_info(group))

        return Response({'groups': groups_info})


class AdminOrgGroup(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def delete(self, request, org_id, group_id):
        """ Remove an organization group
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
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group or get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_owner = group.creator_name
        group_name = group.group_name

        # projects check
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.filter(owner=owner).first()
        if workspace and Projects.objects.filter(workspace=workspace, deleted=False).exists():
            return api_error(status.HTTP_400_BAD_REQUEST, _('Cannot delete group with bases'))

        # mark group's workspace as deleted
        try:
            Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=timezone.now())
        except Exception as e:
            logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            OrgGroup.objects.remove_org_group(org_id, group_id)
            group_deleted.send(sender=None, group_id=group_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        admin_op_detail = {
            "id": group_id,
            "name": group_name,
            "owner": group_owner,
            "org_id": org_id,
            "org_name": org.org_name
        }
        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=GROUP_DELETE, detail=admin_op_detail)

        return Response({'success': True})

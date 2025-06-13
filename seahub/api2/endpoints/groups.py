# Copyright (c) 2012-2016 Seafile Ltd.
import logging
import json
from datetime import datetime

from django.conf import settings
from django.utils.translation import gettext as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.utils import api_error, to_python_boolean
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.group.utils import refresh_group_name_cache
from seahub.signals import group_deleted
from seahub.utils import is_org_context, is_valid_username
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.group.utils import validate_group_name, check_group_name_conflict, \
    is_group_member, is_group_admin, is_group_owner, is_group_admin_or_owner_by_group
from seahub.project.models import Workspaces
from seahub.organizations.settings import ORG_GROUP_QUOTA, FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT, \
    ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT
from seahub.settings import PERSONAL_GROUP_LIMIT
from seahub.organizations.models import OrgGroup
from seahub.group.models import GroupUser

from .utils import api_check_group

logger = logging.getLogger(__name__)


def get_group_admins(group_id):
    admin_members = GroupUser.objects.filter(group_id=group_id, is_staff=True)

    admins = []
    for u in admin_members:
        admins.append(u.user_name)

    return admins


def get_group_info(request, group):
    isoformat_timestr = timestamp_to_isoformat_timestr(group.timestamp)
    group_info = {
        "id": group.group_id,
        "parent_group_id": group.parent_group_id,
        "name": group.group_name,
        "owner": group.creator_name,
        "created_at": isoformat_timestr,
        "admins": get_group_admins(group.group_id),
    }

    return group_info


class Groups(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def _can_add_group(self, request):
        return request.user.permissions.can_add_group()

    def get(self, request):
        """ List all groups.
        """

        including_all_deps = request.GET.get('including_all_deps', 'false')
        can_admin = request.GET.get('can_admin', 'false')
        try:
            including_all_deps = to_python_boolean(including_all_deps)
            can_admin = to_python_boolean(can_admin)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'including_all_deps or can_admin invalid')

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        groups = []

        username = request.user.username
        org_id = request.user.org.org_id
        user_groups = OrgGroup.objects.get_org_groups_by_user(org_id, username)

        for group in user_groups:
            group_info = get_group_info(request, group)
            if can_admin and not is_group_admin_or_owner_by_group(group, username):
                continue
            groups.append(group_info)

        return Response(groups)

    def post(self, request):
        """ Create a group
        """
        if not self._can_add_group(request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        group_name = request.data.get('name', '')
        group_name = group_name.strip()

        # Check whether group name is validate.
        if not validate_group_name(group_name):
            error_msg = _(
                'Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # Check whether group name is duplicated.
        if check_group_name_conflict(request, group_name):
            error_msg = _('There is already a group with that name.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # quota
        org_id = request.user.org.org_id
        group_count = OrgGroup.objects.filter(org_id=org_id).count()
        error_msg = ''

        if not request.user.permissions.can_use_advanced_permissions() and group_count >= FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT
        elif request.user.permissions.can_use_advanced_permissions() and group_count >= ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT
        elif group_count >= ORG_GROUP_QUOTA:
            error_msg = _('Number of groups exceeds the %s limit.') % ORG_GROUP_QUOTA
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # personal group limit
        org_id = request.user.org.org_id
        sql = """SELECT a.id, count(*) as user_group_count FROM group_user a 
        INNER JOIN org_group b ON a.group_id=b.group_id WHERE a.user_name=%s AND b.org_id=%s"""
        user_group_count = OrgGroup.objects.raw(sql, (username, org_id))[0].user_group_count

        if user_group_count >= PERSONAL_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % PERSONAL_GROUP_LIMIT
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # create group.
        try:
            org_id = request.user.org.org_id
            org_group = OrgGroup.objects.create_org_group(org_id, group_name, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # if the group has no workspace, create a workspace
        owner = '%s@seafile_group' % org_group.group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            try:
                org_id = -1
                if is_org_context(request):
                    org_id = request.user.org.org_id
                Workspaces.objects.create_workspace(owner, org_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # get info of new group
        group_info = get_group_info(request, org_group)

        return Response(group_info, status=status.HTTP_201_CREATED)


class Group(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @api_check_group
    def get(self, request, group_id):
        """ Get info of a group.
        """

        try:
            # only group member can get info of a group
            if not is_group_member(group_id, request.user.username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except SearpcError as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        group_info = get_group_info(request, group_id)

        return Response(group_info)

    @api_check_group
    def put(self, request, group_id):
        """ Rename, transfer a specific group
        """

        username = request.user.username
        new_group_name = request.data.get('name', None)

        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        # rename a group
        # only group owner can rename a group
        if new_group_name:
            try:
                if not is_group_owner(group_id, username):
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)

                # Check whether group name is validate.
                if not validate_group_name(new_group_name):
                    error_msg = _(
                        'Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                # Check whether group name is duplicated.
                if check_group_name_conflict(request, new_group_name):
                    error_msg = _('There is already a group with that name.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                group = ccnet_api.get_group(int(group_id))
                old_group_name = group.group_name
                seaserv.ccnet_threaded_rpc.set_group_name(group_id, new_group_name)

            except SearpcError as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            refresh_group_name_cache(group_id, new_group_name)

        new_owner = request.data.get('owner', None)
        # transfer a group
        if new_owner:
            try:
                # only group owner can transfer a group
                if not is_group_owner(group_id, username):
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)

                # augument check
                if not is_valid_username(new_owner):
                    error_msg = 'Email %s invalid.' % new_owner
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                if is_group_owner(group_id, new_owner):
                    error_msg = _('User %s is already group owner.') % new_owner
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                # transfer a group
                if not is_group_member(group_id, new_owner):
                    ccnet_api.group_add_member(group_id, username, new_owner)

                if not is_group_admin(group_id, new_owner):
                    ccnet_api.group_set_admin(group_id, new_owner)

                ccnet_api.set_group_creator(group_id, new_owner)
                ccnet_api.group_unset_admin(group_id, username)

            except SearpcError as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        wiki_enabled = request.data.get('wiki_enabled', None)
        # turn on/off group wiki
        if wiki_enabled:
            try:
                # only group owner/admin can turn on a group wiki
                if not is_group_admin_or_owner(group_id, username):
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)

                # augument check
                if wiki_enabled != 'true' and wiki_enabled != 'false':
                    error_msg = 'wiki_enabled invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                # turn on/off group wiki
                if wiki_enabled == 'true':
                    enable_mod_for_group(group_id, MOD_GROUP_WIKI)
                else:
                    disable_mod_for_group(group_id, MOD_GROUP_WIKI)

            except SearpcError as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        group_info = get_group_info(request, group_id)

        return Response(group_info)

    @api_check_group
    def delete(self, request, group_id):
        """ Dismiss a specific group

        Permission:
        1. group owner
        """
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        username = request.user.username

        try:
            # only group owner can dismiss a group
            if not is_group_owner(group_id, username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except SearpcError as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # if there are dtables in this group, prohibit deletion of groups
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
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
            group = ccnet_api.get_group(int(group_id))
            group_name = group.group_name
            if org_id and org_id > 0:
                ccnet_api.remove_org_group(org_id, group_id)
            ccnet_api.remove_group(group_id)
            group_deleted.send(sender=None, group_id=group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class GroupMoveView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request):
        """ change the orders of users group
        """
        try:
            to_last = to_python_boolean(request.data.get('to_last', 'false'))
        except Exception:
            err_msg = 'to_last invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        try:
            group_id = int(request.data.get('group_id'))
            if not to_last:
                anchor_group_id = int(request.data.get('anchor_group_id'))
            else:
                anchor_group_id = None
        except Exception:
            err_msg = "group_id or anchor_group_id invalid"
            return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        username = request.user.username
        group_order = DTableGroupOrders.objects.get_group_order_by_username(username)
        if not group_order:
            err_msg = "group orders info does not exists"
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        try:
            new_ordered_group_ids, error = group_order.move(group_id, anchor_group_id=anchor_group_id,
                                                            append_to_last=to_last)
            if error:
                err_msg = "group_id or anchor_group_id invalid"
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)
        except Exception as e:
            logger.error(e)
            err_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, err_msg)

        return Response({'success': True})

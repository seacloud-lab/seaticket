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

import seaserv
from seaserv import ccnet_api
from pysearpc import SearpcError

from seahub.api2.utils import api_error, to_python_boolean
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.group.utils import refresh_group_name_cache
from seahub.signals import group_deleted
from seahub.utils import is_org_context, is_valid_username
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.group.utils import validate_group_name, check_group_name_conflict, \
    is_group_member, is_group_admin, is_group_owner, is_group_admin_or_owner
from seahub.dtable.utils import create_repo_and_workspace
from seahub.dtable.models import Workspaces, DTables, DTableGroupOrders
from seahub.ccnet_db.ccnet.groups import get_non_org_all_dep_ids, get_org_all_dep_ids
from seahub.organizations.settings import ORG_GROUP_QUOTA, FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT, ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT
from seahub.settings import PERSONAL_GROUP_LIMIT
from seahub.department_v2.utils import get_department_v2_groups_by_user
from seahub.audit_log.models import GROUP_TRANSFER, GROUP_DELETE, GROUP_RENAME
from seahub.audit_log.signals import audit_operation

from .utils import api_check_group

logger = logging.getLogger(__name__)

def get_group_admins(group_id):
    members = seaserv.get_group_members(group_id)
    admin_members = [m for m in members if m.is_staff]

    admins = []
    for u in admin_members:
        admins.append(u.user_name)

    return admins

def get_group_info(request, group_id):
    group = seaserv.get_group(group_id)

    isoformat_timestr = timestamp_to_isoformat_timestr(group.timestamp)
    group_info = {
        "id": group.id,
        "parent_group_id": group.parent_group_id,
        "name": group.group_name,
        "owner": group.creator_name,
        "created_at": isoformat_timestr,
        "admins": get_group_admins(group.id),
    }

    return group_info


class Groups(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

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

        groups = []

        org_id = None
        username = request.user.username
        if is_org_context(request):
            org_id = request.user.org.org_id
            user_groups = seaserv.get_org_groups_by_user(org_id, username)
        else:
            user_groups = ccnet_api.get_groups(username, return_ancestors=True)

        group_ids = [g.id for g in user_groups]

        if including_all_deps:
            if org_id:
                g_ids = get_org_all_dep_ids(org_id)
            else:
                g_ids = get_non_org_all_dep_ids()
            for g_id in g_ids:
                if g_id not in group_ids:
                    group_ids.append(g_id)

        for group_id in group_ids:
            group_info = get_group_info(request, group_id)
            if can_admin and not is_group_admin_or_owner(group_id, username):
                continue
            groups.append(group_info)

        if settings.ENABLE_ADDRESSBOOK_V2:
            department_v2_groups = get_department_v2_groups_by_user(username)
            for item in department_v2_groups:
                if can_admin and not is_group_admin_or_owner(item.group_id, username):
                    continue
                group_info = get_group_info(request, item.group_id)
                groups.append(group_info)

        return Response(groups)

    def post(self, request):
        """ Create a group
        """
        if not self._can_add_group(request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        group_name = request.data.get('name', '')
        group_name = group_name.strip()

        # Check whether group name is validate.
        if not validate_group_name(group_name):
            error_msg = _('Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # Check whether group name is duplicated.
        if check_group_name_conflict(request, group_name):
            error_msg = _('There is already a group with that name.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # quota
        if is_org_context(request):
            org_id = request.user.org.org_id
            org_groups = ccnet_api.get_org_groups(org_id, -1, -1)
            group_count = len(org_groups)
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
        if is_org_context(request):
            org_id = request.user.org.org_id
            user_groups = ccnet_api.get_org_groups_by_user(org_id, username)
        else:
            user_groups = ccnet_api.get_groups(username)

        if len(user_groups) >= PERSONAL_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % PERSONAL_GROUP_LIMIT
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # create group.
        try:
            if is_org_context(request):
                org_id = request.user.org.org_id
                group_id = seaserv.ccnet_threaded_rpc.create_org_group(org_id,
                                                                       group_name,
                                                                       username)
            else:
                group_id = seaserv.ccnet_threaded_rpc.create_group(group_name,
                                                                   username)
        except SearpcError as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # if the group has no workspace, create a workspace
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            try:
                org_id = -1
                if is_org_context(request):
                    org_id = request.user.org.org_id
                create_repo_and_workspace(owner, org_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # get info of new group
        group_info = get_group_info(request, group_id)

        return Response(group_info, status=status.HTTP_201_CREATED)


class Group(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

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
                    error_msg = _('Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                # Check whether group name is duplicated.
                if check_group_name_conflict(request, new_group_name):
                    error_msg = _('There is already a group with that name.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                group = ccnet_api.get_group(int(group_id))
                old_group_name = group.group_name
                seaserv.ccnet_threaded_rpc.set_group_name(group_id, new_group_name)
                audit_operation.send(None, username=username, operation=GROUP_RENAME, detail={
                    'id': group_id,
                    'name': new_group_name,
                    'old_name': old_group_name
                }, org_id=org_id)

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

                group = ccnet_api.get_group(int(group_id))
                ccnet_api.set_group_creator(group_id, new_owner)
                ccnet_api.group_unset_admin(group_id, username)
                audit_operation.send(None, username=username, operation=GROUP_TRANSFER, detail={
                    'id': group_id,
                    'name': group.group_name,
                    'from': username,
                    'to': new_owner
                }, org_id=org_id)

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
            audit_operation.send(None, username=username, operation=GROUP_DELETE, detail={
                'id': group_id,
                'name': group_name
            }, org_id=org_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class GroupMoveView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

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
            new_ordered_group_ids, error = group_order.move(group_id, anchor_group_id=anchor_group_id, append_to_last=to_last)
            if error:
                err_msg = "group_id or anchor_group_id invalid"
                return api_error(status.HTTP_400_BAD_REQUEST, err_msg)
        except Exception as e:
            logger.error(e)
            err_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, err_msg)

        return Response({'success': True})

# -*- coding: utf-8 -*-

import logging

from django.utils.translation import gettext as _

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
import seaserv
from seaserv import seafile_api, ccnet_api

from seahub.base.accounts import User
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info, send_signal_to_dtable_server
from seahub.dtable.models import Workspaces, DTables, DTableShare, DTableGroupShare, \
    UserStarredDTables, DTableSharePermission, FolderItems
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.signals import share_dtable_to_user
from seahub.utils import is_valid_username, is_org_context
from seahub.api2.endpoints.utils import is_org_user
from seahub.utils import normalize_file_path
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_PREFIX
from seahub.api2.endpoints.dtable import FILE_TYPE
from seahub.group.utils import get_user_groups, group_id_to_name, is_group_member, is_group_admin_or_owner
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.dtable.utils import check_dtable_admin_permission, check_dtable_permission, \
    get_share_permission, clean_related_users_cache
from seahub.dtable.constants import FOLDER_ITEM_DTABLE_GROUP_SHARE
from seahub.dtable.settings import DTABLE_SHARE_QUOTA

logger = logging.getLogger(__name__)
permission_tuple = (PERMISSION_READ, PERMISSION_READ_WRITE)
GROUP_DOMAIN = '@seafile_group'


class SharedDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """list dtables from shared
        """
        to_user = request.user.username

        try:
            share_queryset = DTableShare.objects.list_by_to_user(to_user)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        table_list = list()

        for item in share_queryset:
            from_user = item.from_user
            permission = item.permission
            dtable = item.dtable

            dtable_info = dict()
            dtable_info['id'] = dtable.pk
            dtable_info['workspace_id'] = dtable.workspace_id
            dtable_info['uuid'] = dtable.uuid
            dtable_info['name'] = dtable.name
            dtable_info['creator'] = email2nickname(dtable.creator)
            dtable_info['modifier'] = email2nickname(dtable.modifier)
            dtable_info['created_at'] = datetime_to_isoformat_timestr(dtable.created_at)
            dtable_info['updated_at'] = datetime_to_isoformat_timestr(dtable.updated_at)
            dtable_info['permission'] = permission
            dtable_info['from_user'] = from_user

            if '@seafile_group' in from_user:
                group_id = from_user.split('@')[0]
                dtable_info['from_user_name'] = group_id_to_name(group_id)
            else:
                dtable_info['from_user_name'] = email2nickname(from_user)

            table_list.append(dtable_info)

        return Response({'table_list': table_list})


class DTableShareView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id, name):
        """share dtable to user
        """
        from_user = request.user.username
        table_name = name
        table_file_name = table_name + FILE_TYPE

        # argument check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        to_user = request.data.get('email')
        if not to_user or not is_valid_username(to_user):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        try:
            user = User.objects.get(email=to_user)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % to_user
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = ''
        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        share_limit = request.user.permissions.share_limit()
        if DTableShare.objects.get_count_by_dtable(dtable) >= share_limit:
            error_msg = _('Base sharing exceeds the limit of %(share_limit)s') % {'share_limit': share_limit}
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        if group_id:
            if not is_group_admin_or_owner(group_id, username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if is_group_member(group_id, to_user):
                error_msg = _('Base %s cannot be shared to group member.') % (table_name)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            from_user = group_id + GROUP_DOMAIN
        else:
            if not check_dtable_admin_permission(username, workspace.owner):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if from_user == to_user:
                error_msg = _('Base %s cannot be shared with its owner.') % (table_name)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # org check
        if is_org_context(request):
            org_id = request.user.org.org_id
            org_name = request.user.org.org_name
            if not is_org_user(to_user, org_id):
                error_msg = 'User %s is not member of organization %s.' % (to_user, org_name)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        else:
            if is_org_user(to_user):
                error_msg = 'User %s is a member of organization.' % to_user
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, to_user)
            if obj:
                error_msg = _('Base %s already shared to %s.') % (table_name, to_user)
                return api_error(status.HTTP_409_CONFLICT, error_msg)

            share_count = DTableShare.objects.get_count_by_dtable(dtable)
            if share_count >= DTABLE_SHARE_QUOTA:
                error_msg = _('Base cannot be shared to more than %s users.') % (DTABLE_SHARE_QUOTA)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            DTableShare.objects.add(dtable, from_user, to_user, permission)
            share_dtable_to_user.send(sender=None,
                                      table_id=dtable.id,
                                      share_user=username,
                                      to_user=to_user)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True}, status=status.HTTP_201_CREATED)

    def get(self, request, workspace_id, name):
        """list share users in dtable share
        """
        username = request.user.username
        table_name = name
        table_file_name = table_name + FILE_TYPE

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = ''
        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if group_id:
            if not is_group_member(group_id, username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        else:
            if not check_dtable_admin_permission(username, workspace.owner):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            share_queryset = DTableShare.objects.list_by_dtable(dtable)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        user_list = list()
        for item in share_queryset:
            user_info = get_user_common_info(item.to_user)
            user_info['permission'] = item.permission
            user_list.append(user_info)

        return Response({"user_list": user_list})

    def put(self, request, workspace_id, name):
        """modify dtable share permission
        """
        username = request.user.username
        table_name = name
        table_file_name = table_name + FILE_TYPE

        # argument check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        to_user = request.data.get('email')
        if not to_user or not is_valid_username(to_user):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if is_org_context(request):
            org_id = request.user.org.org_id
            if PERMISSION_PREFIX in permission and not is_org_user(to_user, org_id):
                error_msg = _('Can not set custom share permission to non-team members')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        try:
            user = User.objects.get(email=to_user)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % to_user
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = ''
        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if group_id:
            if not is_group_member(group_id, username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if is_group_member(group_id, to_user):
                error_msg = _('Base %s cannot be shared to group member.') % (table_name)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        else:
            if not check_dtable_admin_permission(username, workspace.owner):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if username == to_user:
                error_msg = _('Base %s cannot be shared with its owner.') % (table_name)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, to_user)
            if not obj:
                error_msg = 'table %s not shared to %s.' % (table_name, to_user)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            if permission == obj.permission:
                error_msg = 'table %s already has %s share permission.' % (table_name, permission)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            obj.permission = permission
            obj.save(update_fields=['permission'])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True})

    def delete(self, request, workspace_id, name):
        """unshare dtable
        """
        username = request.user.username
        table_name = name
        table_file_name = table_name + FILE_TYPE

        # argument check
        to_user = request.data.get('email')
        if not to_user or not is_valid_username(to_user):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = ''
        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, to_user)
            if not obj:
                error_msg = 'table %s not shared to %s.' % (table_name, to_user)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            # permission check
            if group_id:
                if not is_group_member(group_id, username) and username != obj.to_user:
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            else:
                if username not in (obj.to_user, obj.from_user):
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            obj.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True})


def _get_dtable_group_share_info(dtable_group_share):
    group_id = dtable_group_share.group_id
    return {
        'group_id': group_id,
        'group_name': group_id_to_name(group_id),
        'permission': dtable_group_share.permission,
        'dtable_share_id': dtable_group_share.id
    }


class DTableGroupSharesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        user = request.user
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dgses = DTableGroupShare.objects.filter(dtable=dtable).order_by('created_at')
        dtable_group_shares = [_get_dtable_group_share_info(dgs) for dgs in dgses]
        return Response({'dtable_group_share_list': dtable_group_shares})

    def post(self, request, workspace_id, name):
        # arguments check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        group_id = request.data.get('group_id')
        group_ids = request.data.get('group_ids') or []
        if not (group_ids or group_id):
            error_msg = 'group_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        user = request.user
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
    
        # permission check
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
        if group_id:
            if is_org_context(request):
                org_id = request.user.org.org_id
                org_name = request.user.org.org_name
                if ccnet_api.get_org_id_by_group(int(group_id)) != org_id:
                    error_msg = 'Group %s is not an organization %s group.' % (group_id, org_name)
                    return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            # resource check
            if not Workspaces.objects.get_workspace_by_owner('%s@seafile_group' % (group_id,)):
                error_msg = 'Group %s workspace not found.' % (group_id,)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if '@seafile_group' in workspace.owner and group_id == workspace.owner.split('@')[0]:
                error_msg = 'Disable to share table to the group which table belongs to.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            # main
            try:
                if DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
                    error_msg = _('Base %s already shared to the group.') % dtable.name
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                dgs = DTableGroupShare.objects.create(dtable=dtable, group_id=group_id, permission=permission, created_by=user.username)
                send_signal_to_dtable_server('dtable-share-changed', dtable)
                clean_related_users_cache(dtable.uuid.hex)
                return Response({'dtable_group_share': _get_dtable_group_share_info(dgs)})
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        else:
            result = {
                'success': [],
                'failed': []
            }
            for group_id in group_ids:
            # org check
                if is_org_context(request):
                    org_id = request.user.org.org_id
                    org_name = request.user.org.org_name
                    if ccnet_api.get_org_id_by_group(int(group_id)) != org_id:
                        error_msg = 'Group %s is not an organization %s group.' % (group_id, org_name)
                        result['failed'].append({
                            'error_msg': error_msg
                        })
                        continue
                # resource check
                if not Workspaces.objects.get_workspace_by_owner('%s@seafile_group' % (group_id,)):
                    error_msg = 'Group %s workspace not found.' % (group_id,)
                    result['failed'].append({
                            'error_msg': error_msg
                        })
                    continue

                if '@seafile_group' in workspace.owner and group_id == workspace.owner.split('@')[0]:
                    error_msg = 'Disable to share table to the group which table belongs to.'
                    result['failed'].append({
                            'error_msg': error_msg
                        })
                    continue
                # main
                try:
                    if DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
                        error_msg = _('Base %s already shared to the group.') % dtable.name
                        result['failed'].append({
                            'error_msg': error_msg
                        })
                        continue
                    dgs = DTableGroupShare.objects.create(dtable=dtable, group_id=group_id, permission=permission, created_by=user.username)
                    group_info = _get_dtable_group_share_info(dgs)
                    result['success'].append(group_info)
                except Exception as e:
                    logger.error(e)
                    error_msg = 'Internal Server Error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
            return Response(result)


class DTableGroupShareView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def _resource_check(self, workspace_id, name, group_id):
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return None, None, api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return None, None, api_error(status.HTTP_404_NOT_FOUND, error_msg)
        if not DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
            error_msg = 'There isn\'t share to group %s' % (group_id,)
            return None, None, api_error(status.HTTP_404_NOT_FOUND, error_msg)
        return workspace, dtable, None

    def put(self, request, workspace_id, name, group_id):
        # argument check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        # resource check
        workspace, dtable, error = self._resource_check(workspace_id, name, group_id)
        if error:
            return error

        user = request.user
        # permission check
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            updates = {'permission': permission}
            DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).update(**updates)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def delete(self, request, workspace_id, name, group_id):
        # resource check
        workspace, dtable, error = self._resource_check(workspace_id, name, group_id)
        if error:
            return error

        user = request.user
        # permission check
        # check user' permission to dtable/workspace if not permitted then check group permission
        if not check_dtable_admin_permission(user.username, workspace.owner):                    # if not the workspace/group admin
            if not check_dtable_admin_permission(user.username, group_id+'@seafile_group'):      # if not the admin of the group which dtable was shared to
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dgs = DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).first()
            FolderItems.objects.filter(item_type=FOLDER_ITEM_DTABLE_GROUP_SHARE, item_id=dgs.id).delete()
            dgs.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class GroupSharedDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        user = request.user
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        groups = get_user_groups(user.username, return_ancestors=True)

        starred_dtable_uuids = set(UserStarredDTables.objects.get_dtable_uuids_by_email(user.username))

        group_ids = [group.id for group in groups]
        dgses = DTableGroupShare.objects.filter(group_id__in=group_ids, dtable__deleted=False).order_by('created_at').select_related('dtable')
        results = {group_id: [] for group_id in dgses.values_list('group_id', flat=True)}
        for dgs in dgses:
            dtable_info = dgs.dtable.to_dict()
            dtable_info['starred'] = dgs.dtable.uuid.hex in starred_dtable_uuids
            dtable_info['permission'] = dgs.permission
            results[dgs.group_id].append(dtable_info)

        return Response({'group_shared_dtables': results})

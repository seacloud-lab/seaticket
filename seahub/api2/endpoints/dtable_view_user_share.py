# -*- coding: utf-8 -*-

import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _
import seaserv
from seaserv import seafile_api

from seahub.base.accounts import User
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, send_signal_to_dtable_server
from seahub.api2.permissions import CanUseAdvancedPerms
from seahub.dtable.models import Workspaces, DTables, DTableViewUserShare
from seahub.constants import PERMISSION_ADMIN, PERMISSION_PREVIEW, PERMISSION_PREVIEW_EDIT, \
    PERMISSION_READ, PERMISSION_READ_WRITE
from seahub.dtable.utils import check_dtable_admin_permission, clean_related_users_cache
from seahub.base.templatetags.seahub_tags import email2nickname

logger = logging.getLogger(__name__)
PERMISSION_TUPLE = (PERMISSION_ADMIN, PERMISSION_PREVIEW, PERMISSION_PREVIEW_EDIT,
                    PERMISSION_READ, PERMISSION_READ_WRITE)
GROUP_DOMAIN = '@seafile_group'


class DTableUserViewSharesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedPerms)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """list view shares in a dtable, from from_user
        if table_id is given, filter by table_id
        if view_id is given, filter by view_id
        if both are given, filter by both
        """
        table_name = name

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if '@seafile_group' in workspace.owner:
            group_id = int(workspace.owner.split('@')[0])
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        table_id = request.query_params.get('table_id', '')
        view_id = request.query_params.get('view_id', '')

        query_set = []
        if not table_id and not view_id:
            query_set = DTableViewUserShare.objects.filter(dtable=dtable)
        elif table_id and not view_id:
            query_set = DTableViewUserShare.objects.filter(dtable=dtable, table_id=table_id)
        elif not table_id and view_id:
            query_set = DTableViewUserShare.objects.filter(dtable=dtable, view_id=view_id)
        elif table_id and view_id:
            query_set = DTableViewUserShare.objects.filter(dtable=dtable, table_id=table_id, view_id=view_id)

        view_share_list = []
        for item in query_set:
            data = item.to_dict()
            data['from_user_name'] = email2nickname(item.from_user)
            data['to_user_name'] = email2nickname(item.to_user)
            view_share_list.append(data)

        return Response({'user_view_share_list': view_share_list})

    def post(self, request, workspace_id, name):
        from_user = request.user.username
        table_name = name

        # argument check
        permission = request.data.get('permission', '')
        if not permission or permission not in PERMISSION_TUPLE:
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_id = request.data.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_id = request.data.get('view_id', '')
        if not view_id:
            error_msg = 'view_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        to_user = request.data.get('to_user', '')
        if not to_user:
            error_msg = 'user invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        shared_name = request.data.get('shared_name', None)

        try:
            User.objects.get(email=to_user)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % to_user
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

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
        if DTableViewUserShare.objects.get_count_by_dtable(dtable) >= share_limit:
            error_msg = _('View sharing exceeds the limit of %(share_limit)s') % {'share_limit': share_limit}
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not check_dtable_admin_permission(from_user, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if from_user == to_user:
            error_msg = 'View %s cannot be shared with its owner.' % shared_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if DTableViewUserShare.objects.filter(dtable=dtable, to_user=to_user, table_id=table_id, view_id=view_id).exists():
            error_msg = _('View is already shared to this user.')
            return api_error(status.HTTP_409_CONFLICT, error_msg)

        dtable_view_user_share = DTableViewUserShare.objects.create(
            from_user=from_user,
            to_user=to_user,
            dtable=dtable,
            permission=permission,
            table_id=table_id,
            view_id=view_id,
            shared_name=shared_name
        )
        send_signal_to_dtable_server('dtable-share-changed', dtable)
        clean_related_users_cache(dtable.uuid.hex)
        data = dtable_view_user_share.to_dict()
        data['from_user_name'] = email2nickname(dtable_view_user_share.from_user)
        data['to_user_name'] = email2nickname(dtable_view_user_share.to_user)

        return Response(data)

    def delete(self, request, workspace_id, name):
        base_name = name

        table_id = request.query_params.get('table_id', '')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_id = request.query_params.get('view_id', '')
        if not view_id:
            error_msg = 'view_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, base_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % base_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            DTableViewUserShare.objects.filter(dtable=dtable, table_id=table_id, view_id=view_id).delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class DTableUserViewShareView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedPerms)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, workspace_id, name, user_view_share_id):
        """
        update share permission
        """
        from_user = request.user.username
        table_name = name

        # argument check
        new_permission = request.data.get('permission', '')
        new_shared_name = request.data.get('shared_name', '')
        if not new_permission or new_permission not in PERMISSION_TUPLE:
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

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

        if not check_dtable_admin_permission(from_user, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            view_share = DTableViewUserShare.objects.get(id=user_view_share_id, dtable=dtable)
            view_share.permission = new_permission
            if new_shared_name:
                view_share.shared_name = new_shared_name
            view_share.save()

        except DTableViewUserShare.DoesNotExist:
            error_msg = 'view share not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        data = view_share.to_dict()
        data['from_user_name'] = email2nickname(view_share.from_user)
        data['to_user_name'] = email2nickname(view_share.to_user)
        return Response(data)

    def delete(self, request, workspace_id, name, user_view_share_id):
        """
        delete a view share
        """
        user = request.user.username
        table_name = name

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

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

        if not check_dtable_admin_permission(user, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            view_share = DTableViewUserShare.objects.get(id=user_view_share_id, dtable=dtable)
            view_share.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)

        except DTableViewUserShare.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class ViewSharesUserSharedView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """list view shares in a dtable, from from_user
        """
        to_user = request.user.username

        try:
            share_queryset = DTableViewUserShare.objects.filter(to_user=to_user, dtable__deleted=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        view_share_list = []
        for view_share in share_queryset:
            data = view_share.to_dict()
            data['from_user_name'] = email2nickname(view_share.from_user)
            data['to_user_name'] = email2nickname(view_share.to_user)
            data['workspace_id'] = view_share.dtable.workspace.id
            data['color'] = view_share.dtable.color
            data['text_color'] = view_share.dtable.text_color
            data['icon'] = view_share.dtable.icon
            view_share_list.append(data)

        return Response({'view_share_list': view_share_list})


class ViewShareUserSharedView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, user_view_share_id):
        """ to_user leave share
        """
        to_user = request.user.username

        try:
            view_share = DTableViewUserShare.objects.get(id=user_view_share_id)
            send_signal_to_dtable_server('dtable-share-changed', view_share.dtable)
        except DTableViewUserShare.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')

        if view_share.to_user != to_user:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            clean_related_users_cache(view_share.dtable.uuid.hex)
            view_share.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

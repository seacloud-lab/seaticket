# -*- coding: utf-8 -*-

import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _
import seaserv
from seaserv import seafile_api, ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, send_signal_to_dtable_server
from seahub.api2.permissions import CanUseAdvancedPerms
from seahub.utils import is_org_context
from seahub.dtable.models import Workspaces, DTables, DTableViewGroupShare, FolderItems
from seahub.constants import PERMISSION_ADMIN, PERMISSION_PREVIEW, PERMISSION_PREVIEW_EDIT, \
    PERMISSION_READ, PERMISSION_READ_WRITE
from seahub.dtable.constants import FOLDER_ITEM_VIEW_GROUP_SHARE
from seahub.dtable.utils import check_dtable_admin_permission, clean_related_users_cache
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.group.utils import get_user_groups, group_id_to_name

logger = logging.getLogger(__name__)
PERMISSION_TUPLE = (PERMISSION_ADMIN, PERMISSION_PREVIEW, PERMISSION_PREVIEW_EDIT,
                    PERMISSION_READ, PERMISSION_READ_WRITE)
GROUP_DOMAIN = '@seafile_group'


class DTableGroupViewSharesView(APIView):
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
            query_set = DTableViewGroupShare.objects.filter(dtable=dtable)
        elif table_id and not view_id:
            query_set = DTableViewGroupShare.objects.filter(dtable=dtable, table_id=table_id)
        elif not table_id and view_id:
            query_set = DTableViewGroupShare.objects.filter(dtable=dtable, view_id=view_id)
        elif table_id and view_id:
            query_set = DTableViewGroupShare.objects.filter(dtable=dtable, table_id=table_id, view_id=view_id)

        view_share_list = []
        for item in query_set:
            data = item.to_dict()
            data['from_user_name'] = email2nickname(item.from_user)
            data['to_group_name'] = group_id_to_name(item.to_group_id)
            view_share_list.append(data)

        return Response({'group_view_share_list': view_share_list})

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
        
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
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
        
        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        to_group_id = request.data.get('to_group_id', '')
        to_group_ids = request.data.get('to_group_ids') or []
        if not (to_group_ids or to_group_id):
            error_msg = 'group_ids invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        

        shared_name = request.data.get('shared_name', None)
        if to_group_id:
            group = seaserv.get_group(to_group_id)
            if not group:
                error_msg = 'Group %s not found.' % to_group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if DTableViewGroupShare.objects.filter(dtable=dtable, to_group_id=to_group_id, table_id=table_id, view_id=view_id).exists():
                error_msg = 'View is already shared to the group.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            dtable_view_group_share = DTableViewGroupShare.objects.create(
                from_user=from_user,
                to_group_id=to_group_id,
                dtable=dtable,
                permission=permission,
                table_id=table_id,
                view_id=view_id,
                shared_name=shared_name,
            )
            data = dtable_view_group_share.to_dict()
            data['from_user_name'] = email2nickname(dtable_view_group_share.from_user)
            data['to_group_name'] = group_id_to_name(dtable_view_group_share.to_group_id)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
            
            return Response(data)
        
        else:
            result = {
                "success": [],
                "failed": []

            }
            for to_group_id in to_group_ids:
                group = seaserv.get_group(to_group_id)
                if not group:
                    error_msg = 'Group %s not found.' % to_group_id
                    result['failed'].append({
                        'error_msg': error_msg
                    })
                    continue

                if DTableViewGroupShare.objects.filter(dtable=dtable, to_group_id=to_group_id, table_id=table_id, view_id=view_id).exists():
                    error_msg = 'View is already shared to the group.'
                    result['failed'].append({
                        'error_msg': error_msg
                    })
                    continue

                dtable_view_group_share = DTableViewGroupShare.objects.create(
                    from_user=from_user,
                    to_group_id=to_group_id,
                    dtable=dtable,
                    permission=permission,
                    table_id=table_id,
                    view_id=view_id,
                    shared_name=shared_name,
                )
                data = dtable_view_group_share.to_dict()
                data['from_user_name'] = email2nickname(dtable_view_group_share.from_user)
                data['to_group_name'] = group_id_to_name(dtable_view_group_share.to_group_id)
                result['success'].append(data)

            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
            return Response(result)

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
            DTableViewGroupShare.objects.filter(dtable=dtable, table_id=table_id, view_id=view_id).delete()
            clean_related_users_cache(dtable.uuid.hex)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class DTableGroupViewShareView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedPerms)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, workspace_id, name, group_view_share_id):
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
            view_share = DTableViewGroupShare.objects.get(id=group_view_share_id, dtable=dtable)
            view_share.permission = new_permission
            if new_shared_name:
                view_share.shared_name = new_shared_name
            view_share.save()

        except DTableViewGroupShare.DoesNotExist:
            error_msg = 'view share not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        data = view_share.to_dict()
        data['from_user_name'] = email2nickname(view_share.from_user)
        data['to_group_name'] = group_id_to_name(view_share.to_group_id)

        return Response(data)

    def delete(self, request, workspace_id, name, group_view_share_id):
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
            view_share = DTableViewGroupShare.objects.get(id=group_view_share_id, dtable=dtable)
            view_share.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)

        except DTableViewGroupShare.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class ViewSharesGroupSharedView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """list view shares in a dtable, from from_user
        """
        user = request.user
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        groups = get_user_groups(user.username, return_ancestors=True)

        group_id_list = [group.id for group in groups]
        try:
            share_queryset = DTableViewGroupShare.objects.filter(to_group_id__in=group_id_list).select_related()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        results = {group.id: [] for group in groups}
        res = {}
        for k, v in results.items():
            for view_share in share_queryset:
                if k == view_share.to_group_id:
                    data = view_share.dtable.to_dict()
                    data['view_share_id'] = view_share.id
                    res.setdefault(k, []).append(data)

        return Response({'group_shared_views': res})


class ViewShareGroupSharedView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, group_view_share_id):
        """ to_group_id leave share
        """
        try:
            view_share = DTableViewGroupShare.objects.get(id=group_view_share_id)
        except DTableViewGroupShare.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')

        user = request.user
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        groups = get_user_groups(user.username, return_ancestors=True)

        group_id_list = [group.id for group in groups]

        if view_share.to_group_id not in group_id_list:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            clean_related_users_cache(view_share.dtable.uuid.hex)
            view_share.delete()
            send_signal_to_dtable_server('dtable-share-changed', view_share.dtable)
            FolderItems.objects.filter(item_type=FOLDER_ITEM_VIEW_GROUP_SHARE, item_id=group_view_share_id).delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

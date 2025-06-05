# -*- coding: utf-8 -*-
import logging
import time
import json
from datetime import datetime

import jwt
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils.translation import gettext as _

from seaserv import ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.status import HTTP_443_ABOVE_QUOTA
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.group.utils import get_user_groups, group_id_to_name
from seahub.dtable.utils import check_dtable_permission, check_quota_by_workspace, \
     check_row_limit_by_workspace
from seahub.dtable.models import Workspaces, DTables, DTableCollectionTables
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import DTABLE_PRIVATE_KEY, DTABLE_SERVER_URL, DTABLE_SOCKET_URL
from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_COLLECTION_TABLE
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster

logger = logging.getLogger(__name__)


def _resource_check(workspace_id, table_name=None, dtable_uuid=None):
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        error_msg = 'Workspace %s not found.' % workspace_id
        return None, None, error_msg

    if table_name:
        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return None, None, error_msg
    else:
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_uuid
            return None, None, error_msg

    return workspace, dtable, None


class DTableCollectionTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """get collection_tables
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        username = request.user.username
        workspace_id = request.GET.get('workspace_id', None)
        table_name = request.GET.get('name', None)

        # get collection_tables by user
        if not workspace_id and not table_name:
            groups = get_user_groups(username, return_ancestors=True)

            owner_list = list()
            owner_list.append(username)
            for group in groups:
                group_user = '%s@seafile_group' % group.id
                owner_list.append(group_user)

            try:
                workspaces = Workspaces.objects.filter(owner__in=owner_list)
                workspace_id_map = {workspace.id: workspace for workspace in workspaces}
                workspace_ids = [workspace.id for workspace in workspaces]
                collection_tables = DTableCollectionTables.objects.filter(workspace_id__in=workspace_ids)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            group_name_map = {group.id: group.group_name for group in groups}

            collection_table_list = list()
            for collection_table in collection_tables:
                obj_dict = collection_table.to_dict()
                workspace_id = collection_table.workspace_id
                workspace = workspace_id_map.get(workspace_id)
                if not workspace:
                    continue
                owner = workspace.owner
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    obj_dict["group_name"] = group_name_map.get(group_id)
                    obj_dict["group_id"] = group_id
                collection_table_list.append(obj_dict)

            return Response({"collection_table_list": collection_table_list}, status=status.HTTP_200_OK)

        # get collection_tables by dtable
        else:
            # argument check
            if not workspace_id:
                error_msg = 'workspace_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not table_name:
                error_msg = 'name invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # resource check
            workspace, dtable, error_msg = _resource_check(workspace_id, table_name=table_name)
            if error_msg:
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            # permission check
            if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            dtable_uuid = dtable.uuid.hex
            try:
                collection_tables = DTableCollectionTables.objects.\
                    get_collection_tables_by_dtable_uuid(dtable_uuid)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            collection_table_list = [collection_table.to_dict() for collection_table in collection_tables]

            return Response({"collection_table_list": collection_table_list}, status=status.HTTP_200_OK)

    def post(self, request):
        """create a collection_table
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # argument check
        workspace_id = request.POST.get('workspace_id', None)
        if not workspace_id:
            error_msg = 'workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.POST.get('name', None)
        if not table_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        config = request.POST.get('config', None)

        # resource check
        workspace, dtable, error_msg = _resource_check(workspace_id, table_name=table_name)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_uuid = dtable.uuid.hex
        collection_table = DTableCollectionTables.objects.get_collection_table_by_config(dtable_uuid, config)
        if collection_table:
            error_msg = 'collection table already exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            collection_table = DTableCollectionTables.objects.add_collection_table(
                username, workspace_id, dtable_uuid, config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        collection_table = collection_table.to_dict()

        return Response({"collection_table": collection_table}, status=status.HTTP_201_CREATED)


class DTableCollectionTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, token):
        """update a collection_table's config
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # argument check
        config = request.POST.get('config', None)

        try:
            config_dict = json.loads(config)
        except Exception as e:
            logger.error('config: %s, invalid error: %s', config, e)
            return api_error(status.HTTP_400_BAD_REQUEST, 'config invalid.')
        
        # deadline check 
        submit_deadline_option = config_dict.get('submit_deadline_option', {})
        is_submit_deadline_show = submit_deadline_option.get('is_submit_deadline_show', False)
        submit_deadline_str = submit_deadline_option.get('submit_deadline')
        if is_submit_deadline_show and submit_deadline_str:
            try:
                datetime.strptime(submit_deadline_str, '%Y-%m-%d %H:%M:%S')
            except Exception as e:
                logger.error('submit_deadline: %s error: %s', submit_deadline_str, e)
                return api_error(status.HTTP_400_BAD_REQUEST, _('Submission deadline invalid'))

        # resource check
        collection_table = DTableCollectionTables.objects.get_collection_table_by_token(token)
        if not collection_table:
            error_msg = 'collection_table %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace_id = collection_table.workspace_id
        dtable_uuid = collection_table.dtable_uuid
        workspace, dtable, error_msg = _resource_check(workspace_id, dtable_uuid=dtable_uuid)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            collection_table.config = config
            collection_table.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        collection_table = collection_table.to_dict()

        return Response({"collection_table": collection_table}, status=status.HTTP_200_OK)

    def delete(self, request, token):
        """ delete a collection_table.
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # resource check
        collection_table = DTableCollectionTables.objects.get_collection_table_by_token(token)
        if not collection_table:
            return Response({'success': True}, status=status.HTTP_200_OK)

        workspace_id = collection_table.workspace_id
        dtable_uuid = collection_table.dtable_uuid
        workspace, dtable, error_msg = _resource_check(workspace_id, dtable_uuid=dtable_uuid)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            DTableCollectionTables.objects.delete_collection_table(token)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


class DTableCollectionTableAccessToken(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """get access token by collection_table's token
        """
        # argument check
        token = request.GET.get('token', None)
        if not token:
            error_msg = 'token invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        collection_table = DTableCollectionTables.objects.get_collection_table_by_token(token)
        if not collection_table:
            error_msg = 'collection table %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace_id = collection_table.workspace_id
        dtable_uuid = collection_table.dtable_uuid
        workspace, dtable, error_msg = _resource_check(workspace_id, dtable_uuid=dtable_uuid)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # quota check
        if not check_quota_by_workspace(workspace):
            error_msg = 'Asset quota exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        # rows check
        if not check_row_limit_by_workspace(workspace):
            error_msg = 'Rows exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        # generate json web token
        username = request.user.username
        if enable_dtable_server_cluster:
            dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
            dtable_socket_url = dtable_server_url
        else:
            dtable_server_url = DTABLE_SERVER_URL
            dtable_socket_url = DTABLE_SOCKET_URL
        dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url, permission=PERMISSION_COLLECTION_TABLE, kwargs={'collection_table_token': token})
        return Response({
            'access_token': dtable_server_api.view_access_token,
            'dtable_uuid': str(dtable.uuid),
            'dtable_server': dtable_server_url,
            'dtable_socket': dtable_socket_url,
        })


class DTableCollectionTableDuplicateView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, token):
        """duplicate a collection_table
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # resource check
        collection_table = DTableCollectionTables.objects.get_collection_table_by_token(token)
        if not collection_table:
            error_msg = 'collection_table %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace_id = collection_table.workspace_id
        dtable_uuid = collection_table.dtable_uuid
        workspace, dtable, error_msg = _resource_check(workspace_id, dtable_uuid=dtable_uuid)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        config = json.loads(collection_table.config)
        config['name'] = config.get('name') + ' (1)'
        config = json.dumps(config)

        try:
            collection_table = DTableCollectionTables.objects.add_collection_table(
                username, workspace_id, dtable_uuid, config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        collection_table = collection_table.to_dict()

        return Response({"collection_table": collection_table}, status=status.HTTP_200_OK)

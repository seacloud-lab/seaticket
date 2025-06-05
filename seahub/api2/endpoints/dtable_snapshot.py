# -*- coding: utf-8 -*-

import os
import json
import logging
import requests
from datetime import datetime, timedelta

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seaserv import seafile_api, ccnet_api
from django.contrib.auth.hashers import check_password

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info
from seahub.constants import PERMISSION_READ_WRITE
from seahub.dtable.models import Workspaces, DTables, DTableSnapshot
from seahub.dtable.utils import check_dtable_permission, is_valid_jwt, rebuild_content_asset, copy_asset, \
    get_snapshot_days_by_workspace, check_base_limit, check_dtable_admin_permission, is_big_data_row_limit_exceeded, \
    is_big_data_storage_limit_exceeded
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.utils import normalize_file_path, gen_file_get_url, gen_inner_file_get_url, get_inner_dtable_server_url
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.api2.endpoints.dtable import FILE_TYPE
from seahub.settings import INNER_DTABLE_DB_URL
from seahub.utils.storage_backend import storage_backend

logger = logging.getLogger(__name__)


class DTableLatestCommitIdView(APIView):

    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """get dtable latest commit id
        Permission:
        1. use dtable_uuid verify jwt from dtable-server
        """
        # argument check
        dtable_uuid = request.GET.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth, dtable_uuid):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            current_commit = seafile_api.get_commit_list(repo_id, 0, 1)[0]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'latest_commit_id': current_commit.id})


class DTableSnapshotsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """List dtable snapshots
        """
        # argument check
        table_name = name
        table_file_name = table_name + FILE_TYPE

        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '50'))
        except ValueError:
            current_page = 1
            per_page = 20

        start = per_page * (current_page - 1)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = ccnet_api.get_group(int(group_id))
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, workspace, dtable) == PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            snapshot_days = get_snapshot_days_by_workspace(workspace)
            snapshot_list = storage_backend.list_snapshots(dtable, start, per_page, snapshot_days)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        count = len(snapshot_list)
        has_next_page = True if count == per_page else False
        page_info = {
            'has_next_page': has_next_page,
            'current_page': current_page
        }

        return Response({'snapshot_list': snapshot_list, "page_info": page_info})

    def post(self, request, workspace_id, name):
        """create dtable snapshots
        """
        # argument check
        table_name = name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = ccnet_api.get_group(int(group_id))
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            dtable_server_url = get_inner_dtable_server_url()
            dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url)
            res = dtable_server_api.create_snapshot(dtable.name)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(res)


class DTableSnapshotView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name, commit_id):
        """Get dtable snapshot by commit_id
        """
        table_name = name
        table_file_name = table_name + FILE_TYPE

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = ccnet_api.get_group(int(group_id))
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
        username = request.user.username
        if not check_dtable_permission(username, workspace, dtable) == PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            snapshot_days = get_snapshot_days_by_workspace(workspace)
            snapshot_link = storage_backend.get_snapshot_link(dtable, commit_id, snapshot_days, username)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # check
        if not snapshot_link:
            error_msg = 'commit_id not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return Response(snapshot_link)


class DTableSnapshotContentView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name, commit_id):
        """Get dtable snapshot content
        """
        table_name = name

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = ccnet_api.get_group(int(group_id))
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
        username = request.user.username
        if not check_dtable_permission(username, workspace, dtable) == PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
 
        try:
            snapshot_days = get_snapshot_days_by_workspace(workspace)
            snapshot = storage_backend.get_snapshot(dtable, commit_id, snapshot_days, username)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not snapshot:
            error_msg = 'commit_id not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return Response(snapshot)


class DTableSnapshotRestoreView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)
    TMP_PATH = '/tmp/snapshot-restore/'

    def _get_local_file_path(self):
        if not os.path.exists(self.TMP_PATH):
            os.makedirs(self.TMP_PATH)
        return self.TMP_PATH

    def _clear_tmp_files_and_dirs(self, uuid):
        # delete tmp files/dirs
        path = os.path.join(self.TMP_PATH, uuid)
        if os.path.exists(path):
            os.remove(path)

    def _password_check(self, request, dtable):
        if not dtable.is_encrypted():
            return True

        password = request.data.get('password')
        if check_password(password, dtable.password):
            return True

        return False

    def _restore_file_and_asset(self, src_dtable, new_dtable, snapshot_content, table_file_name, username):
        if snapshot_content:  # maybe empty str or real content dict
            try:
                # rebuild .dtable file
                rebuild_content_asset(snapshot_content, src_dtable, new_dtable)
                dtable_file_path = os.path.join(self._get_local_file_path(), str(new_dtable.uuid))
                with open(dtable_file_path, 'w') as f:
                    json.dump(snapshot_content, f)
                seafile_api.post_file(new_dtable.workspace.repo_id, dtable_file_path, '/', table_file_name, username)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            finally:
                self._clear_tmp_files_and_dirs(str(new_dtable.uuid))

            try:
                # copy asset
                copy_asset(src_dtable.workspace.repo_id, src_dtable.uuid, new_dtable.workspace.repo_id, new_dtable.uuid, username)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        else:
            try:
                seafile_api.post_empty_file(new_dtable.workspace.repo_id, '/', table_file_name, username)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def post(self, request, workspace_id, name, commit_id):

        table_name = name
        table_file_name = table_name + FILE_TYPE

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if '@seafile_group' in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = ccnet_api.get_group(int(group_id))
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

        password_check = self._password_check(request, dtable)
        if not password_check:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        snapshot_name = request.data.get('snapshot_name')
        # non-name check
        if not snapshot_name:
            snapshot_name = dtable.name + '(restored)'

        if not check_base_limit(workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            snapshot_days = get_snapshot_days_by_workspace(workspace)
            snapshot = storage_backend.get_snapshot(dtable, commit_id, snapshot_days, username)
            if not snapshot:
                error_msg = 'commit_id not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            new_dtable_name = DTables.objects.get_non_duplicated_name(snapshot_name, workspace_id)
            new_password = None
            if dtable.is_encrypted():
                new_password = dtable.password
            new_dtable = DTables.objects.create_dtable(username, workspace, new_dtable_name, password=new_password)

            content = rebuild_content_asset(snapshot, dtable, new_dtable)
            storage_backend.save_dtable(new_dtable, json.dumps(content), username)
            # copy asset
            copy_asset(dtable.workspace.repo_id, dtable.uuid, new_dtable.workspace.repo_id, new_dtable.uuid, username)

            # restore big data backup
            backup_version = request.data.get('backup_version')
            if backup_version:
                new_dtable_uuid = str(new_dtable.uuid)
                dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
                dtable_db_api.restore_backup(backup_version, new_dtable_uuid)
                dtable_server_url = get_inner_dtable_server_url()
                dtable_server_api = DTableServerAPI(username, new_dtable_uuid, dtable_server_url)
                dtable_server_api.update_enable_archive(True)
        except Exception as e:
            logger.error('create snapshot dtable: %s error: %s', snapshot_name, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'dtable': new_dtable.to_dict()})


class DTableArchiveBackupsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """List dtable archived backups
        """
        table_name = name
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, workspace, dtable) == PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
            backups = dtable_db_api.backups()
            backup_list = []
            for backup in backups:
                data = {
                    'dtable_name': dtable.name,
                    'version': backup.get('version'),
                    'ctime': timestamp_to_isoformat_timestr(backup.get('ctime')),
                }
                backup_list.append(data)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'backup_list': backup_list})


class DTableBigDataStateView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        table_name = name
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, workspace, dtable) == PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dtable_server_url = get_inner_dtable_server_url()
            dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url)
            metadata = dtable_server_api.get_metadata()
            enable_archive = metadata.get('settings', {}).get('enable_archive')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        org_id = workspace.org_id

        big_data_row_limit_exceeded = is_big_data_row_limit_exceeded(org_id)
        big_data_storage_limit_exceeded = is_big_data_storage_limit_exceeded(org_id)
        disable_big_data_feature = big_data_row_limit_exceeded or big_data_storage_limit_exceeded
        big_data_enabled = not disable_big_data_feature and enable_archive

        return Response({'big_data_enabled': big_data_enabled})

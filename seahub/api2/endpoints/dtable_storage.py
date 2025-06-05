import os
import json
import logging
import stat
import posixpath
from datetime import timedelta, datetime
from urllib import parse

import requests
from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.api2.status import HTTP_443_ABOVE_QUOTA, HTTP_520_OPERATION_FAILED
from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_READ
from seahub.dtable.models import DTables, Workspaces, CustomAssetUUID, DTableAssetTrash
from seahub.dtable.utils import check_dtable_permission, export_dtable_asset_files, get_view_share_permision, \
    clean_org_storage_size_cache, get_group_view_share_permission, get_user_view_share_permission, \
    CUSTOM_RELATIVE_PATH, has_dtable_asset_upload_permission, check_quota_by_workspace, check_dtable_admin_permission,\
    send_file_access_msg
from seahub.utils import gen_inner_file_upload_url, is_org_context, gen_file_upload_url, is_valid_dirent_name, \
    check_filename_with_rename, normalize_file_path, uuid_str_to_32_chars, get_no_duplicate_obj_name, uuid_str_to_36_chars
from seahub.utils.timeutils import timestamp_to_isoformat_timestr, lines_monthly
from seahub.settings import MAX_UPLOAD_FILE_NAME_LEN, OFFICE_TEMPLATE_ROOT, DTABLE_EXPORT_MAX_SIZE

from seaserv import seafile_api
from constance import config


logger = logging.getLogger(__name__)

SYSTEM_DIRS = ['files', 'images', 'public', 'external-apps', 'emails', 'digital-signs', 'restore']
VALID_DIRS = SYSTEM_DIRS + ['custom']


def get_dirent_info(dirent):

    if stat.S_ISDIR(dirent.mode):
        is_file = False
    else:
        is_file = True

    result = {}
    result['is_file'] = is_file
    result['obj_name'] = dirent.obj_name
    result['file_size'] = dirent.size if is_file else ''
    result['last_update'] = timestamp_to_isoformat_timestr(dirent.mtime)

    return result


def _get_dir_list_by_path(repo_id, parent_dir):
    dirs = seafile_api.list_dir_by_path(repo_id, parent_dir)
    if not dirs:
        return []
    else:
        return [get_dirent_info(dir) for dir in dirs if '.dtable' not in dir.obj_name]


class DTableStorageView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        base_dir = '/asset/' + dtable_uuid
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        repo_owner = dtable.workspace.owner
        parent_dir = request.GET.get('parent_dir')

        if not parent_dir or parent_dir == '/':
            parent_dir = base_dir
            parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
            if not parent_dir_id:
                return Response({'dirent_list': []})
            dirent_list = _get_dir_list_by_path(repo_id, parent_dir)
            dirent_list = [dirent for dirent in dirent_list if dirent['obj_name'] in SYSTEM_DIRS]
            return Response({'dirent_list': dirent_list})

        parent_dir = base_dir + parent_dir
        parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        if not parent_dir_id and request.GET.get('parent_dir', '').lstrip('/') in VALID_DIRS:
            return Response({'dirent_list': []})
        if not parent_dir_id:
            error_msg = 'parent_dir is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dirent_list = _get_dir_list_by_path(repo_id, parent_dir)
        return Response({'dirent_list': dirent_list})

    def delete(self, request, dtable_uuid):
        # argument check
        parent_path = request.GET.get('parent_path', '')
        parent_path = parent_path.lstrip('/')
        name = request.GET.get('name', '').lstrip('/')
        path = request.GET.get('path')
        if not path and not (parent_path and name):
            return api_error(status.HTTP_400_BAD_REQUEST, 'path, parent_path or name invalid')

        # dtable check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # delete resource
        if path:
            basedir = parent_path.strip('/')
            parent_path = os.path.join('/asset', str(dtable.uuid), os.path.dirname(path).strip('/'))
            name = os.path.basename(path)
        else:
            basedir = ''
            parent_path = os.path.join('/asset', str(dtable.uuid), parent_path.strip('/'))
        try:
            dirent = seafile_api.get_dirent_by_path(repo_id, os.path.join(parent_path, name))
            if not dirent:
                return Response({'success': True})
            seafile_api.del_file(repo_id, parent_path, json.dumps([name]), username)
            DTableAssetTrash.objects.create(
                dtable_uuid=dtable.uuid.hex,
                name=name,
                delete_from=DTableAssetTrash.SYSTEM,
                item_type=DTableAssetTrash.DIR if stat.S_ISDIR(dirent.mode) else DTableAssetTrash.FILE,
                basedir=basedir,
                commit_id=repo.head_cmmt_id,
                size=None if stat.S_ISDIR(dirent.mode) else dirent.size,
                deleted_at=timezone.now()
            )
        except Exception as e:
            logger.error('del parent_path: %s, name: %s, error: %s', parent_path, name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if is_org_context(request):
            org_id = request.user.org.org_id
            clean_org_storage_size_cache(org_id)

        return Response({'success': True})


class DTableAssetExistsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """
        check whether an asset exists by path
        """

        table_name = name

        path = request.query_params.get('path', '').lstrip('/')
        if not path:
            error_msg = 'path invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
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

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable=dtable)\
                and not get_view_share_permision(username, dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        asset_path = os.path.join('/asset', str(dtable.uuid), path)
        try:
            dir = seafile_api.get_dirent_by_path(repo_id, asset_path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        res = {}
        res['is_exist'] = True if dir else False
        return Response(res)


class DTableAssetZipTask(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid):
        """
        Parameter:
        {
            "files_map": {"file1": "filename1", "file2": "filename2"}
        }
        """
        # arguments check
        files_map = request.data.get('files_map', None)
        if not files_map or not isinstance(files_map, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'files_map is invalid.')

        files = list(files_map.keys())
        if len(files) > 200:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Download up to 200 files at a time')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        repo_id = dtable.workspace.repo_id
        if not seafile_api.get_repo(repo_id):
            return api_error(status.HTTP_404_NOT_FOUND, 'Library not found.')
        asset_dir = os.path.join('/asset', str(dtable.uuid))
        if not seafile_api.get_dirent_by_path(repo_id, asset_dir):
            return api_error(status.HTTP_404_NOT_FOUND, 'Files not found.')

        # permission check
        if not check_dtable_permission(request.user.username, dtable.workspace, dtable=dtable):
            if get_view_share_permision(request.user.username, dtable) not in [PERMISSION_READ, PERMISSION_READ_WRITE]:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        params = {
            'username': request.user.username,
            'repo_id': repo_id,
            'dtable_uuid': str(dtable.uuid),
            'files': files,
            'files_map': json.dumps(files_map),
        }
        try:
            task_id = export_dtable_asset_files(params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'task_id': task_id})



def _list_custom_disk_assets(dtable_uuid, repo_id, ym, parent_dir='/', file_list=[]):
    base_dir = '/asset/' + dtable_uuid + '/custom'
    path = os.path.join(base_dir, parent_dir.strip('/'))
    dirents = seafile_api.list_dir_by_path(repo_id, path)
    if not dirents:
        return file_list

    for dirent in dirents:
        last_update_time = timestamp_to_isoformat_timestr(dirent.mtime)
        if datetime.fromisoformat(last_update_time).strftime('%Y-%m') != ym:
            continue
        if stat.S_ISDIR(dirent.mode):
            inner_parent_dir = os.path.join(parent_dir, dirent.obj_name)
            _list_custom_disk_assets(dtable_uuid, repo_id, ym, inner_parent_dir, file_list)
        else:
            file_info = get_dirent_info(dirent)
            file_info['source'] = 'custom'
            file_info['parent_dir'] = parent_dir
            file_list.append(file_info)
    return file_list

def _list_custom_disk_assets_sorted(dtable_uuid, repo_id, ym):
    all_assets = _list_custom_disk_assets(dtable_uuid, repo_id, ym, '/', [])
    sorted_assets = sorted(all_assets, key=lambda x: x['last_update'], reverse=True)
    return sorted_assets


def _list_email_assets(dtable_uuid, repo_id, ym):
    base_dir = '/asset/' + dtable_uuid
    asset_dir = os.path.join(base_dir, 'emails', ym)
    dirent_list = seafile_api.list_dir_by_path(repo_id, asset_dir)
    file_list = []
    if not dirent_list:
        return []
    for dirent in dirent_list:
        file_dir = os.path.join(asset_dir, dirent.obj_name)
        asset_list = seafile_api.list_dir_by_path(repo_id, file_dir)
        for asset in asset_list:
            file_info = get_dirent_info(asset)
            file_info['source'] = 'email'
            file_info['parent_dir_id'] = dirent.obj_name
            file_list.append(file_info)

    return file_list


class DTableListRecentFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        base_dir = '/asset/' + dtable_uuid
        try:
            months = int(request.GET.get('months', 2))
        except ValueError:
            months = 2


        file_type = request.GET.get('file_type', 'files')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id


        file_list = []
        try:
            if file_type == 'files':
                for recent_date in lines_monthly(months):
                    files_info = {'date': recent_date}
                    asset_dir = os.path.join(base_dir, 'files', recent_date)
                    dirent_list = _get_dir_list_by_path(repo_id, asset_dir)
                    files_info['file_items'] = dirent_list
                    file_list.append(files_info)

            elif file_type == 'images':
                for recent_date in lines_monthly(months):
                    files_info = {'date': recent_date}
                    asset_dir = os.path.join(base_dir, 'images', recent_date)
                    dirent_list = _get_dir_list_by_path(repo_id, asset_dir)
                    files_info['file_items'] = dirent_list
                    file_list.append(files_info)

            elif file_type == 'email':
                for recent_date in lines_monthly(months):
                    files_info = {'date': recent_date}
                    dirent_list = []
                    dirent_list.extend(_list_email_assets(dtable_uuid, repo_id, recent_date))
                    files_info['file_items'] = dirent_list
                    file_list.append(files_info)

            elif file_type == 'custom':
                for recent_date in lines_monthly(months):
                    files_info = {'date': recent_date}
                    dirent_list = []
                    dirent_list.extend(_list_custom_disk_assets_sorted(dtable_uuid, repo_id, recent_date))
                    files_info['file_items'] = dirent_list
                    file_list.append(files_info)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'file_list': file_list})


class DTableStorageBatchDeleteAssets(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, dtable_uuid):
        # argument check
        parent_path = request.data.get('parent_path', '')
        if not parent_path:
            error_msg = 'parent_path is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        parent_path = parent_path.lstrip('/')
        asset_names = request.data.get('asset_names', '')
        if not asset_names:
            error_msg = 'asset_names is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # dtable check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # delete resource
        basedir = parent_path.strip('/')
        parent_path = os.path.join('/asset', dtable_uuid, parent_path)
        try:
            for name in asset_names:
                dirent = seafile_api.get_dirent_by_path(repo_id, os.path.join(parent_path, name))
                if not dirent:
                    continue
                seafile_api.del_file(repo_id, parent_path, json.dumps([name]), username)
                DTableAssetTrash.objects.create(
                    dtable_uuid=dtable.uuid.hex,
                    name=name,
                    delete_from=DTableAssetTrash.SYSTEM,
                    item_type=DTableAssetTrash.DIR if stat.S_ISDIR(dirent.mode) else DTableAssetTrash.FILE,
                    basedir=basedir,
                    commit_id=repo.head_cmmt_id,
                    size=None if stat.S_ISDIR(dirent.mode) else dirent.size,
                    deleted_at=timezone.now()
                )
        except Exception as e:
            logger.error('del parent_path: %s, name: %s, error: %s', parent_path, ','.join(asset_names), e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if is_org_context(request):
            org_id = request.user.org.org_id
            clean_org_storage_size_cache(org_id)

        return Response({'success': True})


class DTableStorageRenameView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def can_rename(self, username, dtable):
        """
        1. has permission, which is not read-only, to base
        2. has permission to view of table of base
        """
        dtable_permission = check_dtable_permission(username, dtable.workspace, dtable)
        if dtable_permission and dtable_permission != PERMISSION_READ:
            return True
        user_view_share_perm = get_user_view_share_permission(username, dtable)
        if user_view_share_perm == PERMISSION_READ_WRITE:
            return True
        group_view_share_perm = get_group_view_share_permission(username, dtable)
        if group_view_share_perm == PERMISSION_READ_WRITE:
            return True
        return False

    def post(self, request, dtable_uuid):
        # argument check
        path = request.data.get('path')
        if not path:
            return api_error(status.HTTP_400_BAD_REQUEST, 'path invalid')
        path = parse.unquote(path)

        new_name = request.data.get('new_name')
        if not new_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'new_name invalid')
        new_name = parse.unquote(new_name)

        name = os.path.basename(path)
        if name == new_name:
            return Response({'success': True})

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        parent_path = os.path.join('/asset', str(dtable.uuid), os.path.dirname(path).strip('/'))
        full_path = '/asset/%s/%s' % (str(dtable.uuid), path.lstrip('/'))
        existed_file_full_path = '%s/%s' % (parent_path, new_name)
        try:
            file_id = seafile_api.get_file_id_by_path(repo_id, full_path)
            if not file_id:
                return api_error(status.HTTP_404_NOT_FOUND, 'File not found')
            existed_file_id = seafile_api.get_file_id_by_path(repo_id, existed_file_full_path)
            if existed_file_id:
                return api_error(status.HTTP_409_CONFLICT, 'File %s exists' % new_name)
        except Exception as e:
            logger.error('check repo: %s file: %s existed file: %s exist error: %s', repo_id, path, existed_file_full_path, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # permission check
        username = request.user.username
        if not self.can_rename(username, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # rename file
        try:
            seafile_api.rename_file(repo_id, parent_path, name, new_name, username)
        except Exception as e:
            logger.error('rename repo: %s file: %s new file: %s error: %s', repo_id, path, existed_file_full_path, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class DTableStorageZipTaskView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid):
        """ Get file server token for download-dir and download-multi.
        """

        # argument check
        parent_dir = request.data.get('parent_dir') or '/'
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        parent_dir = parent_dir.strip('/')
        if parent_dir and parent_dir.split('/')[0] not in SYSTEM_DIRS:
            return api_error(status.HTTP_400_BAD_REQUEST, 'parent_dir invalid')
        parent_dir = os.path.join('/asset', dtable_uuid, parent_dir)

        dirent_name_list = request.data.getlist('dirents', None)
        if not dirent_name_list:
            error_msg = 'dirents invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(dirent_name_list) == 1:
            download_type = 'download-dir'
        elif len(dirent_name_list) > 1:
            download_type = 'download-multi'
        else:
            error_msg = 'dirents invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # recourse check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        workspace = dtable.workspace
        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not seafile_api.get_dir_id_by_path(repo_id, parent_dir):
            error_msg = 'Folder %s not found.' % parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # get file server access token
        repo_folder_permission = PERMISSION_READ

        if download_type == 'download-dir':
            dir_name = dirent_name_list[0].strip('/')
            full_dir_path = posixpath.join(parent_dir, dir_name)

            dir_id = seafile_api.get_dir_id_by_path(repo_id, full_dir_path)
            if not dir_id:
                error_msg = 'Folder %s not found.' % full_dir_path
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if not json.loads(seafile_api.is_dir_downloadable(repo_id, json.dumps([full_dir_path]), \
                    request.user.username, repo_folder_permission))['is_downloadable']:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            fake_obj_id = {
                'obj_id': dir_id,
                'dir_name': dir_name
            }

        if download_type == 'download-multi':
            dirent_list = []
            full_dirent_path_list = []
            for dirent_name in dirent_name_list:
                dirent_name = dirent_name.strip('/')
                dirent_list.append(dirent_name)

                full_dirent_path = posixpath.join(parent_dir, dirent_name)
                current_dirent = seafile_api.get_dirent_by_path(repo_id, full_dirent_path)
                if not current_dirent:
                    continue

                full_dirent_path_list.append(full_dirent_path)

            if not json.loads(seafile_api.is_dir_downloadable(repo_id, json.dumps(full_dirent_path_list), \
                    request.user.username, repo_folder_permission))['is_downloadable']:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            fake_obj_id = {
                'parent_dir': parent_dir,
                'file_list': dirent_list
            }

        username = request.user.username
        try:
            zip_token = seafile_api.get_fileserver_access_token(
                repo_id, json.dumps(fake_obj_id), download_type, username,
                use_onetime=True
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not zip_token:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if len(dirent_name_list) > 10:
            send_file_access_msg(request, dtable, parent_dir, 'download')
        else:
            for dirent_name in dirent_name_list:
                full_dirent_path = posixpath.join(parent_dir, dirent_name)
                send_file_access_msg(request, dtable, full_dirent_path, 'download')

        return Response({'zip_token': zip_token})


# ----- ---- ----- ----- CustomAsset ----- ----- ----- ----- #


def _move_asset_dir(dtable_uuid, repo_id, src_parent_dir, dst_parent_dir):
    base_dir = '/asset/' + dtable_uuid + '/custom'
    path = os.path.join(base_dir, src_parent_dir.strip('/'))
    dirents = seafile_api.list_dir_by_path(repo_id, path)
    if not dirents:
        return

    # batch move
    CustomAssetUUID.objects.batch_move_by_dtable_uuid_parent_path(
        dtable_uuid, src_parent_dir, dst_parent_dir)

    for dirent in dirents:
        if stat.S_ISDIR(dirent.mode):
            inner_src_parent_dir = os.path.join(src_parent_dir, dirent.obj_name)
            inner_dst_parent_dir = os.path.join(dst_parent_dir, dirent.obj_name)
            _move_asset_dir(dtable_uuid, repo_id, inner_src_parent_dir, inner_dst_parent_dir)
    return


def _copy_asset_dir(dtable_uuid, repo_id, src_parent_dir, dst_parent_dir):
    base_dir = '/asset/' + dtable_uuid + '/custom'
    path = os.path.join(base_dir, src_parent_dir.strip('/'))
    dirents = seafile_api.list_dir_by_path(repo_id, path)
    if not dirents:
        return

    # batch copy
    CustomAssetUUID.objects.batch_copy_by_dtable_uuid_parent_path(
        dtable_uuid, src_parent_dir, dst_parent_dir)

    for dirent in dirents:
        if stat.S_ISDIR(dirent.mode):
            inner_src_parent_dir = os.path.join(src_parent_dir, dirent.obj_name)
            inner_dst_parent_dir = os.path.join(dst_parent_dir, dirent.obj_name)
            _copy_asset_dir(dtable_uuid, repo_id, inner_src_parent_dir, inner_dst_parent_dir)
    return


def _delete_asset_dir(dtable_uuid, repo_id, parent_dir):
    base_dir = '/asset/' + dtable_uuid + '/custom'
    path = os.path.join(base_dir, parent_dir.strip('/'))
    dirents = seafile_api.list_dir_by_path(repo_id, path)
    if not dirents:
        return

    # batch delete
    CustomAssetUUID.objects.batch_delete_by_dtable_uuid_parent_path(
        dtable_uuid, parent_dir)

    for dirent in dirents:
        if stat.S_ISDIR(dirent.mode):
            inner_parent_dir = os.path.join(parent_dir, dirent.obj_name)
            _delete_asset_dir(dtable_uuid, repo_id, inner_parent_dir)
    return


def _calc_files_in_dir_recursively(dtable_uuid, repo_id, parent_dir):
    """calcs trash custom dir item details

    Return: {
        "dirs": [
            {
                "name": "",
                "dirs": [],
                "files": []
            }
        ],
        "files": [
            {
                "parent_path": "",
                "file_name": "",
                "uuid": ""
            }
        ]
    }
    """
    dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
    base_dir = os.path.join('/asset', dtable_uuid, 'custom')
    path = os.path.join(base_dir, parent_dir.strip('/'))
    dir_name = os.path.basename(parent_dir)
    dirents = seafile_api.list_dir_by_path(repo_id, path)
    if not dirents:
        return {'dirs': [], 'files': []}
    dirs, files = [], []
    file_names = []
    for dirent in dirents:
        if stat.S_ISDIR(dirent.mode):
            inner_parent_dir = os.path.join(parent_dir, dirent.obj_name)
            detail = _calc_files_in_dir_recursively(dtable_uuid, repo_id, inner_parent_dir)
            dirs.append(detail)
        else:
            file_names.append(dirent.obj_name)
    for asset in CustomAssetUUID.objects.batch_get_by_path(dtable_uuid, parent_dir, file_names):
        files.append({
            'parent_path': asset.parent_path,
            'file_name': asset.file_name,
            'uuid': asset.uuid.hex
        })

    return {'dirs': dirs, 'files': files, 'name': dir_name}

class DTableCustomAssetUploadLinkView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        """get custom asset file upload link

        Permission:
        1. owner
        2. group member
        3. shared user with `rw` or `admin` permission
        """
        # argument check
        parent_dir = request.GET.get('parent_dir', '')
        relative_path = parent_dir.lstrip('/')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        workspace = dtable.workspace
        if not has_dtable_asset_upload_permission(request, workspace, dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # quota check
        if not check_quota_by_workspace(workspace):
            error_msg = 'Asset quota exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        # create custom dir
        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        base_dir_id = seafile_api.get_dir_id_by_path(repo_id, base_dir)
        if not base_dir_id:
            seafile_api.mkdir_with_parents(repo_id, '/', base_dir[1:], username)

        # check parent dir
        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))
        parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        if not parent_dir_id:
            error_msg = 'parent_dir not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # get token
        obj_id = json.dumps({'parent_dir': base_dir})
        try:
            token = seafile_api.get_fileserver_access_token(
                repo_id, obj_id, 'upload', '', use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        upload_link = gen_file_upload_url(token, 'upload-api')

        res = dict()
        res['upload_link'] = upload_link
        res['parent_path'] = base_dir
        res['relative_path'] = relative_path

        return Response(res)


class DTableCustomAssetDirView(APIView):
    """
    Support uniform interface for directory operations, including
    create/delete/rename/list, etc.
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def _list_custom_asset(self, dtable_uuid, relative_path, repo_id, parent_dir):
        dirent_list = []
        custom_assets_dict = {asset.file_name: asset for asset in CustomAssetUUID.objects.list_by_path(
            dtable_uuid, relative_path)}
        dirs = seafile_api.list_dir_by_path(repo_id, parent_dir)
        for obj in dirs:
            info = get_dirent_info(obj)
            if info.get('is_file'):
                asset = custom_assets_dict.get(info.get('obj_name'))
                if asset:
                    info['uuid'] = asset.uuid
                else:
                    info['uuid'] = ''
            dirent_list.append(info)
        return dirent_list

    def get(self, request, dtable_uuid):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable=dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        parent_dir = request.GET.get('parent_dir', '')
        relative_path = parent_dir.strip('/')

        if not parent_dir or parent_dir == '/':
            parent_dir = base_dir
            parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
            if not parent_dir_id:
                return Response({'dirent_list': []})
            dirent_list = self._list_custom_asset(
                dtable_uuid, relative_path, repo_id, parent_dir)
            return Response({'dirent_list': dirent_list})

        parent_dir = base_dir + parent_dir
        parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        if not parent_dir_id:
            error_msg = 'parent_dir not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dirent_list = self._list_custom_asset(
            dtable_uuid, relative_path, repo_id, parent_dir)
        return Response({'dirent_list': dirent_list})


    def post(self, request, dtable_uuid):
        """ Create dir.
        """
        # argument check
        parent_dir = request.data.get('parent_dir', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_dir_name = request.data.get('name', None)
        if not new_dir_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # create custom dir
        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        base_dir_id = seafile_api.get_dir_id_by_path(repo_id, base_dir)
        if not base_dir_id:
            seafile_api.mkdir_with_parents(repo_id, '/', base_dir[1:], username)

        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))

        # resource check
        parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        if not parent_dir_id:
            error_msg = 'parent_dir %s not found.' % parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not is_valid_dirent_name(new_dir_name):
            return api_error(status.HTTP_400_BAD_REQUEST, 'new_name invalid.')

        retry_count = 0
        while retry_count < 10:
            new_dir_name = check_filename_with_rename(repo_id,
                    parent_dir, new_dir_name)
            try:
                seafile_api.post_dir(
                    repo_id, parent_dir, new_dir_name, username)
                break
            except Exception as e:
                if str(e) == 'file already exists':
                    retry_count += 1
                else:
                    logger.error(e)
                    error_msg = 'Internal Server Error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        new_dir_path = posixpath.join(parent_dir, new_dir_name)
        new_dir_obj = seafile_api.get_dirent_by_path(repo_id, new_dir_path)
        new_dir_info = get_dirent_info(new_dir_obj)

        return Response({'dirent': new_dir_info})

    def put(self, request, dtable_uuid):
        """ Rename dir.
        """
        # argument check
        parent_dir = request.data.get('parent_dir', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        relative_path = parent_dir.strip('/')

        old_dir_name = request.data.get('name', None)
        if not old_dir_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_dir_name = request.data.get('new_name', None)
        if not new_dir_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # create custom dir
        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        base_dir_id = seafile_api.get_dir_id_by_path(repo_id, base_dir)
        if not base_dir_id:
            seafile_api.mkdir_with_parents(repo_id, '/', base_dir[1:], username)

        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))
        path = os.path.join(parent_dir, old_dir_name)

        # resource check
        dir_id = seafile_api.get_dir_id_by_path(repo_id, path)
        if not dir_id:
            error_msg = 'dir %s not found.' % old_dir_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        obj = seafile_api.get_dirent_by_path(repo_id, path)
        if not stat.S_ISDIR(obj.mode):
            error_msg = 'dir %s not found.' % old_dir_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not is_valid_dirent_name(new_dir_name):
            return api_error(status.HTTP_400_BAD_REQUEST, 'name invalid.')

        if new_dir_name == old_dir_name:
            return api_error(status.HTTP_409_CONFLICT, 'The new name is the same to the old')
        # rename duplicate name
        new_dir_name = check_filename_with_rename(
            repo_id, parent_dir, new_dir_name)
        try:
            #
            src_dir = os.path.join(relative_path, old_dir_name)
            dst_dir = os.path.join(relative_path, new_dir_name)
            _move_asset_dir(dtable_uuid, repo_id, src_dir, dst_dir)
            # rename dir
            seafile_api.rename_file(
                repo_id, parent_dir, old_dir_name, new_dir_name, username)
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    def delete(self, request, dtable_uuid):
        """ Delete dir.

        Permission checking:
        1. user with 'rw' permission.
        """
        # argument check
        parent_dir = request.GET.get('parent_dir', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        relative_path = parent_dir.strip('/')

        dir_name = request.GET.get('name', None)
        if not dir_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        base_dir = '/asset/' + dtable_uuid + '/custom'
        trash_basedir = parent_dir.strip('/')
        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))

        try:
            src_dir = os.path.join(relative_path, dir_name)
            #
            ## calc files in dir recursively
            detail = _calc_files_in_dir_recursively(dtable_uuid, repo_id, src_dir)
            DTableAssetTrash.objects.create(
                name=dir_name,
                dtable_uuid=dtable.uuid.hex,
                delete_from=DTableAssetTrash.CUSTOM,
                item_type=DTableAssetTrash.DIR,
                size=None,
                deleted_at=timezone.now(),
                basedir=trash_basedir,
                commit_id=repo.head_cmmt_id,
                detail=json.dumps(detail)
            )
            #
            _delete_asset_dir(dtable_uuid, repo_id, src_dir)
            seafile_api.del_file(
                repo_id, parent_dir, json.dumps([dir_name]), username)
        except Exception as e:
            logger.exception(e)
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if is_org_context(request):
            org_id = request.user.org.org_id
            clean_org_storage_size_cache(org_id)

        return Response({'success': True})


class DTableCustomAssetFileView(APIView):
    """
    Support uniform interface for file related operations,
    including create/delete/rename/view, etc.
    """

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, dtable_uuid):
        """ Get asset uuid.

        Permission checking:
        1. user with either 'r' or 'rw' permission.
        """

        # argument check
        parent_dir = request.GET.get('parent_dir', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        relative_path = parent_dir.strip('/')

        file_name = request.GET.get('name', None)
        if not file_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))
        path = os.path.join(parent_dir, file_name)

        obj = seafile_api.get_dirent_by_path(repo_id, path)
        if not obj or stat.S_ISDIR(obj.mode):
            error_msg = 'File %s not found.' % file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dirent_info = get_dirent_info(obj)

        # uuid
        asset = CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, relative_path, file_name)
        dirent_info['uuid'] = asset.uuid

        return Response({'dirent': dirent_info})

    def post(self, request, dtable_uuid):
        """ create file
        """
        parent_dir = request.data.get('parent_dir', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        new_file_name = request.data.get('new_file_name')
        if not new_file_name:
            error_msg = 'new_file_name invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username
        parent_dir = normalize_file_path(parent_dir)
        relative_path = parent_dir.strip('/')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        workspace = dtable.workspace
        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        base_dir = posixpath.join('/asset', dtable_uuid, 'custom')
        try:
            base_dir_id = seafile_api.get_dir_id_by_path(repo_id, base_dir)
            if not base_dir_id:
                seafile_api.mkdir_with_parents(repo_id, '/', base_dir[1:], username)
        except Exception as e:
            logger.error('check base dir: %s error: %s', base_dir, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        parent_dir = posixpath.join(base_dir, parent_dir.strip('/'))
        try:
            dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        except Exception as e:
            logger.error('get dir id error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        if not dir_id:
            return api_error(status.HTTP_404_NOT_FOUND, 'Folder %s not found' % parent_dir)

        # permission check
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # main
        new_file_name = check_filename_with_rename(repo_id, parent_dir, new_file_name)
        try:
            seafile_api.post_empty_file(repo_id, parent_dir, new_file_name, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update office file by template
        if new_file_name.endswith('.xlsx'):
            empty_file_path = os.path.join(OFFICE_TEMPLATE_ROOT, 'empty.xlsx')
        elif new_file_name.endswith('.pptx'):
            empty_file_path = os.path.join(OFFICE_TEMPLATE_ROOT, 'empty.pptx')
        elif new_file_name.endswith('.docx'):
            empty_file_path = os.path.join(OFFICE_TEMPLATE_ROOT, 'empty.docx')
        else:
            empty_file_path = ''

        if empty_file_path:
            # get file server update url
            update_token = seafile_api.get_fileserver_access_token(
                    repo_id, 'dummy', 'update', username)

            if not update_token:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            update_url = gen_inner_file_upload_url('update-api', update_token)
            # update file
            new_file_path = posixpath.join(parent_dir, new_file_name)
            try:
                requests.post(
                    update_url,
                    data={'filename': new_file_name, 'target_file': new_file_path},
                    files={'file': open(empty_file_path, 'rb')}
                )
            except Exception as e:
                logger.error(e)

        new_file_path = posixpath.join(parent_dir, new_file_name)
        obj = seafile_api.get_dirent_by_path(repo_id, new_file_path)
        if not obj or stat.S_ISDIR(obj.mode):
            error_msg = 'File %s not found' % new_file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dirent_info = get_dirent_info(obj)

        # uuid
        asset = CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, relative_path, new_file_name)
        dirent_info['uuid'] = asset.uuid

        return Response({'dirent': dirent_info})

    def put(self, request, dtable_uuid):
        """ Rename file
        """
        # argument check
        asset_uuid = request.data.get('asset_uuid', None)
        if asset_uuid:
            asset = CustomAssetUUID.objects.get_by_uuid(asset_uuid)
            if not asset:
                error_msg = 'asset_uuid invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if asset.dtable_uuid != dtable_uuid:
                error_msg = 'asset_uuid invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            parent_dir = asset.parent_path
            old_file_name = asset.file_name
            relative_path = parent_dir.strip('/')
        else:
            parent_dir = request.data.get('parent_dir', '')
            if not parent_dir:
                error_msg = 'parent_dir invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            relative_path = parent_dir.strip('/')

            old_file_name = request.data.get('name', None)
            if not old_file_name:
                error_msg = 'name invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_file_name = request.data.get('new_name', None)
        if not new_file_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))
        path = os.path.join(parent_dir, old_file_name)

        obj = seafile_api.get_dirent_by_path(repo_id, path)
        if stat.S_ISDIR(obj.mode):
            error_msg = 'File %s not found.' % old_file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if len(new_file_name) > MAX_UPLOAD_FILE_NAME_LEN:
            return api_error(status.HTTP_400_BAD_REQUEST, 'New name is too long')

        if not is_valid_dirent_name(new_file_name):
            error_msg = 'File name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if new_file_name == old_file_name:
            return api_error(status.HTTP_409_CONFLICT, 'The new name is the same to the old')

        new_file_name = check_filename_with_rename(repo_id, parent_dir, new_file_name)
        try:
            seafile_api.rename_file(
                repo_id, parent_dir, old_file_name, new_file_name, username)
            asset = CustomAssetUUID.objects.rename_by_path(dtable_uuid, relative_path, old_file_name, new_file_name)
        except Exception as e:
            return api_error(
                HTTP_520_OPERATION_FAILED, "Failed to rename file: %s" % e)

        return Response({'success': True})

    def delete(self, request, dtable_uuid):
        """ Delete file
        """
        # argument check
        parent_dir = request.GET.get('parent_dir', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        relative_path = parent_dir.strip('/')

        file_name = request.GET.get('name', None)
        if not file_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        base_dir = '/asset/' + dtable_uuid + '/custom'
        trash_basedir = parent_dir.strip('/')
        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))

        try:
            dirent_info = seafile_api.get_dirent_by_path(repo_id, os.path.join(parent_dir, file_name))
            if stat.S_ISDIR(dirent_info.mode):
                return api_error(status.HTTP_400_BAD_REQUEST, '%s is not a file' % file_name)
            detail = {
                'parent_path': trash_basedir,
                'file_name': file_name
            }
            custom_asset = CustomAssetUUID.objects.get_by_path(dtable_uuid, trash_basedir, file_name)
            if custom_asset:
                detail['uuid'] = custom_asset.uuid.hex
            DTableAssetTrash.objects.create(
                name=file_name,
                dtable_uuid=dtable.uuid.hex,
                delete_from=DTableAssetTrash.CUSTOM,
                item_type=DTableAssetTrash.FILE,
                size=dirent_info.size,
                deleted_at=timezone.now(),
                basedir=trash_basedir,
                commit_id=repo.head_cmmt_id,
                detail=json.dumps(detail)
            )
            seafile_api.del_file(repo_id, parent_dir,
                                 json.dumps([file_name]),
                                 request.user.username)
            CustomAssetUUID.objects.delete_by_path(dtable_uuid, relative_path, file_name)
        except Exception as e:
            logger.exception(e)
            logger.error(e)
            return api_error(
                HTTP_520_OPERATION_FAILED, "Failed to delete file.")

        if is_org_context(request):
            org_id = request.user.org.org_id
            clean_org_storage_size_cache(org_id)

        return Response({'success': True})


class DTableCustomAssetBatchMoveItemView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        """ Synchronous multi move files/folders.
        Permission checking:
        1. User must has `rw` permission for src folder.
        2. User must has `rw` permission for dst folder.

        Parameter:
        {
            "src_repo_id":"7460f7ac-a0ff-4585-8906-bb5a57d2e118",
            "src_parent_dir":"/a/b/c/",
            "src_dirents":["1.md", "2.md"],

            "dst_repo_id":"a3fa768d-0f00-4343-8b8d-07b4077881db",
            "dst_parent_dir":"/x/y/",
        }
        """

        # argument check
        src_parent_dir = request.data.get('src_parent_dir', None)
        if not src_parent_dir:
            error_msg = 'src_parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        src_parent_dir_relative_path = src_parent_dir.strip('/')

        src_dirents = request.data.get('src_dirents', None)
        if not src_dirents:
            error_msg = 'src_dirents invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dst_parent_dir = request.data.get('dst_parent_dir', None)
        if not dst_parent_dir:
            error_msg = 'dst_parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        dst_parent_dir_relative_path = dst_parent_dir.strip('/')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        src_repo_id = repo_id
        dst_repo_id = repo_id
        src_parent_dir = os.path.join(base_dir, src_parent_dir.strip('/'))
        dst_parent_dir = os.path.join(base_dir, dst_parent_dir.strip('/'))

        src_parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, src_parent_dir)
        if not src_parent_dir_id:
            error_msg = 'src_parent_dir %s not found.' % src_parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dst_parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, dst_parent_dir)
        if not dst_parent_dir_id:
            error_msg = 'dst_parent_dir %s not found.' % dst_parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # move file
        try:
            #
            for dirent in src_dirents:
                path = os.path.join(src_parent_dir, dirent)
                dirent_info = seafile_api.get_dirent_by_path(repo_id, path)
                if not dirent_info:
                    continue
                if stat.S_ISDIR(dirent_info.mode):
                    src_dir = os.path.join(src_parent_dir_relative_path, dirent)
                    dst_dir = os.path.join(dst_parent_dir_relative_path, dirent)
                    _move_asset_dir(dtable_uuid, repo_id, src_dir, dst_dir)
                else:
                    CustomAssetUUID.objects.move_by_path(
                        dtable_uuid, src_parent_dir_relative_path, dst_parent_dir_relative_path, dirent)
            #
            seafile_api.move_file(src_repo_id, src_parent_dir,
                                  json.dumps(src_dirents),
                                  dst_repo_id, dst_parent_dir,
                                  json.dumps(src_dirents),
                                  replace=False, username=username,
                                  need_progress=0, synchronous=1)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableCustomAssetBatchCopyItemView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dtable_uuid):
        """ Synchronous multi copy files/folders.
        Permission checking:
        1. User must has `rw` permission for src folder.
        2. User must has `rw` permission for dst folder.

        Parameter:
        {
            "src_repo_id":"7460f7ac-a0ff-4585-8906-bb5a57d2e118",
            "src_parent_dir":"/a/b/c/",
            "src_dirents":["1.md", "2.md"],

            "dst_repo_id":"a3fa768d-0f00-4343-8b8d-07b4077881db",
            "dst_parent_dir":"/x/y/",
        }
        """

        # argument check
        src_parent_dir = request.data.get('src_parent_dir', None)
        if not src_parent_dir:
            error_msg = 'src_parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        src_parent_dir_relative_path = src_parent_dir.strip('/')

        src_dirents = request.data.get('src_dirents', None)
        if not src_dirents:
            error_msg = 'src_dirents invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dst_parent_dir = request.data.get('dst_parent_dir', None)
        if not dst_parent_dir:
            error_msg = 'dst_parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        dst_parent_dir_relative_path = dst_parent_dir.strip('/')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        src_repo_id = repo_id
        dst_repo_id = repo_id
        src_parent_dir = os.path.join(base_dir, src_parent_dir.strip('/'))
        dst_parent_dir = os.path.join(base_dir, dst_parent_dir.strip('/'))

        src_parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, src_parent_dir)
        if not src_parent_dir_id:
            error_msg = 'src_parent_dir %s not found.' % src_parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dst_parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, dst_parent_dir)
        if not dst_parent_dir_id:
            error_msg = 'dst_parent_dir %s not found.' % dst_parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # copy file
        try:
            #
            for dirent in src_dirents:
                path = os.path.join(src_parent_dir, dirent)
                dirent_info = seafile_api.get_dirent_by_path(repo_id, path)
                if not dirent_info:
                    continue
                if stat.S_ISDIR(dirent_info.mode):
                    src_dir = os.path.join(src_parent_dir_relative_path, dirent)
                    dst_dir = os.path.join(dst_parent_dir_relative_path, dirent)
                    _copy_asset_dir(dtable_uuid, repo_id, src_dir, dst_dir)
                else:
                    CustomAssetUUID.objects.copy_by_path(
                        dtable_uuid, src_parent_dir_relative_path, dst_parent_dir_relative_path, dirent)
            #
            seafile_api.copy_file(src_repo_id, src_parent_dir,
                                  json.dumps(src_dirents),
                                  dst_repo_id, dst_parent_dir,
                                  json.dumps(src_dirents),
                                  username=username,
                                  need_progress=0, synchronous=1)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableCustomAssetBatchDeleteItemView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, dtable_uuid):
        # argument check
        parent_dir = request.data.get('parent_dir', '')
        if not parent_dir:
            error_msg = 'parent_dir is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        relative_path = parent_dir.strip('/')

        dirents = request.data.get('dirents', '')
        if not dirents:
            error_msg = 'dirents is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # dtable check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        base_dir = '/asset/' + dtable_uuid + '/custom'
        trash_basedir = parent_dir.strip('/')
        parent_dir = os.path.join(base_dir, parent_dir.strip('/'))

        trash_items_objs = []

        # delete resource
        try:
            #
            for dirent in dirents:
                path = os.path.join(parent_dir, dirent)
                dirent_info = seafile_api.get_dirent_by_path(repo_id, path)
                if not dirent_info:
                    continue
                trash_item_info = {
                    'dtable_uuid': dtable.uuid.hex,
                    'name': dirent,
                    'delete_from': DTableAssetTrash.CUSTOM,
                    'basedir': trash_basedir,
                    'commit_id': repo.head_cmmt_id,
                    'deleted_at': timezone.now()
                }
                if stat.S_ISDIR(dirent_info.mode):
                    src_dir = os.path.join(relative_path, dirent)
                    detail = _calc_files_in_dir_recursively(dtable_uuid, repo_id, src_dir)
                    trash_item_info['item_type'] = DTableAssetTrash.DIR
                    trash_item_info['size'] = None
                    trash_item_info['detail'] = json.dumps(detail)
                    _delete_asset_dir(dtable_uuid, repo_id, src_dir)
                else:
                    trash_item_info['item_type'] = DTableAssetTrash.FILE
                    trash_item_info['size'] = dirent_info.size
                    asset = CustomAssetUUID.objects.get_by_path(dtable_uuid, relative_path, dirent)
                    trash_item_detail = {
                        'parent_path': trash_basedir,
                        'file_name': dirent
                    }
                    if asset:
                        trash_item_detail['uuid'] = asset.uuid.hex
                    trash_item_info['detail'] = json.dumps(trash_item_detail)
                    CustomAssetUUID.objects.delete_by_path(
                        dtable_uuid, relative_path, dirent)
                trash_items_objs.append(DTableAssetTrash(**trash_item_info))
            #
            DTableAssetTrash.objects.bulk_create(trash_items_objs)
            seafile_api.del_file(repo_id, parent_dir, json.dumps(dirents), username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if is_org_context(request):
            org_id = request.user.org.org_id
            clean_org_storage_size_cache(org_id)

        return Response({'success': True})


class DTableCustomAssetZipTaskView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid, format=None):
        """ Get file server token for download-dir and download-multi.
        """

        # argument check
        parent_dir = request.data.get('parent_dir', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        parent_dir = posixpath.join('/asset', dtable_uuid, 'custom', parent_dir.strip('/'))

        dirent_name_list = request.data.getlist('dirents', None)
        if not dirent_name_list:
            error_msg = 'dirents invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(dirent_name_list) == 1:
            download_type = 'download-dir'
        elif len(dirent_name_list) > 1:
            download_type = 'download-multi'
        else:
            error_msg = 'dirents invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # recourse check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        workspace = dtable.workspace
        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not seafile_api.get_dir_id_by_path(repo_id, parent_dir):
            error_msg = 'Folder %s not found.' % parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # get file server access token
        repo_folder_permission = PERMISSION_READ

        if download_type == 'download-dir':
            dir_name = dirent_name_list[0].strip('/')
            full_dir_path = posixpath.join(parent_dir, dir_name)

            dir_id = seafile_api.get_dir_id_by_path(repo_id, full_dir_path)
            if not dir_id:
                error_msg = 'Folder %s not found.' % full_dir_path
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if not json.loads(seafile_api.is_dir_downloadable(repo_id, json.dumps([full_dir_path]), \
                    request.user.username, repo_folder_permission))['is_downloadable']:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            fake_obj_id = {
                'obj_id': dir_id,
                'dir_name': dir_name
            }

        if download_type == 'download-multi':
            dirent_list = []
            full_dirent_path_list = []
            for dirent_name in dirent_name_list:
                dirent_name = dirent_name.strip('/')
                dirent_list.append(dirent_name)

                full_dirent_path = posixpath.join(parent_dir, dirent_name)
                current_dirent = seafile_api.get_dirent_by_path(repo_id, full_dirent_path)
                if not current_dirent:
                    continue

                full_dirent_path_list.append(full_dirent_path)

            if not json.loads(seafile_api.is_dir_downloadable(repo_id, json.dumps(full_dirent_path_list), \
                    request.user.username, repo_folder_permission))['is_downloadable']:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            fake_obj_id = {
                'parent_dir': parent_dir,
                'file_list': dirent_list
            }

        username = request.user.username
        try:
            zip_token = seafile_api.get_fileserver_access_token(
                repo_id, json.dumps(fake_obj_id), download_type, username,
                use_onetime=True
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not zip_token:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if len(dirent_name_list) > 10:
            send_file_access_msg(request, dtable, parent_dir, 'download')
        else:
            for dirent_name in dirent_name_list:
                full_dirent_path = posixpath.join(parent_dir, dirent_name)
                send_file_access_msg(request, dtable, full_dirent_path, 'download')

        return Response({'zip_token': zip_token})


class DTableCustomAssetQueryZipProgressView(APIView):
    throttle_classes = (UserRateThrottle, )

    def get(self, request, format=None):
        """ check progress when download dir/multi.

        Permission checking:
        """

        token = request.GET.get('token', None)
        if not token:
            error_msg = 'token invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            progress = seafile_api.query_zip_progress(token)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not progress:
            error_msg = 'progress not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return Response(json.loads(progress))


class DTableCustomAssetCancelZipTaskView(APIView):

    throttle_classes = (UserRateThrottle, )

    def post(self, request, format=None):
        """ stop progress when download dir/multi.
        Permission checking:
        """
        token = request.POST.get('token', None)
        if not token:
            error_msg = 'token invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            process = seafile_api.cancel_zip_task(token)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableAssetFileSearchView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):

        parent_dir = request.GET.get('parent_dir', '/')
        query_str = request.GET.get('query', '')
        from_custom = to_python_boolean(request.GET.get('from_custom', '0'))

        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable=dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid
        if from_custom:
            base_dir = '/asset/' + dtable_uuid + '/custom'


        if not parent_dir or parent_dir == '/':
            parent_dir = base_dir
        else:
            parent_dir = base_dir + '/' + parent_dir.lstrip('/')

        search_result = seafile_api.search_files_by_path(repo_id, parent_dir, query_str)
        # search_file_result = [r for r in search_result if not r.is_dir]
        result_list = []
        for s in search_result:
            path, obj_name = os.path.split(s.path)
            relative_path = path[len(base_dir):].strip("/")
            result_list.append({
                'is_file': not s.is_dir,
                'file_size': s.size,
                'last_update': timestamp_to_isoformat_timestr(s.mtime),
                'obj_name': obj_name,
                'full_path': path,
                'path': relative_path and '/%s' % relative_path or '/'
            })

        return Response({'search_results': result_list})


class DTableAssetTrashView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        # arguments check
        delete_from = request.GET.get('delete_from')
        if not delete_from or delete_from not in [DTableAssetTrash.SYSTEM, DTableAssetTrash.CUSTOM]:
            return api_error(status.HTTP_400_BAD_REQUEST, 'delete_from invalid')
        parent_dir = request.GET.get('parent_dir', '').strip('/')
        if delete_from == DTableAssetTrash.SYSTEM and parent_dir:
            if parent_dir.split('/')[0] not in SYSTEM_DIRS:
                return api_error(status.HTTP_400_BAD_REQUEST, 'parent_dir invalid')
        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except:
            page, per_page = 1, 25

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if delete_from == DTableAssetTrash.CUSTOM:
            if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        elif delete_from == DTableAssetTrash.SYSTEM:
            if not check_dtable_admin_permission(username, dtable.workspace.owner):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        else:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        dtable_q = Q(
            dtable_uuid=dtable.uuid.hex,
            delete_from=delete_from,
            deleted_at__gte=timezone.now() - timedelta(days=59)
        )
        if not parent_dir:
            trash_items = DTableAssetTrash.objects.filter(dtable_q)
        else:
            basedir_q = Q(basedir=parent_dir)
            sub_basedir_q = Q(basedir__startswith=parent_dir+'/')
            trash_items = DTableAssetTrash.objects.filter(dtable_q & (basedir_q | sub_basedir_q))

        start = (page - 1) * per_page
        try:
            trash_item_list = [item.to_dict() for item in trash_items[start: start+per_page]]
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'trash_item_list': trash_item_list})

    def delete(self, request, dtable_uuid):
        # arguments check
        delete_from = request.GET.get('delete_from')
        if not delete_from or delete_from not in [DTableAssetTrash.SYSTEM, DTableAssetTrash.CUSTOM]:
            return api_error(status.HTTP_400_BAD_REQUEST, 'delete_from invalid')
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        # permission check
        username = request.user.username
        if delete_from == DTableAssetTrash.CUSTOM:
            if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        elif delete_from == DTableAssetTrash.SYSTEM:
            if not check_dtable_admin_permission(username, dtable.workspace.owner):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        else:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        try:
            DTableAssetTrash.objects.filter(dtable_uuid=uuid_str_to_32_chars(dtable_uuid), delete_from=delete_from).delete()
        except Exception as e:
            logger.error('clean dtable: %s delete from: %s error: %s', dtable_uuid, delete_from, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'success': True})


class DTableAssetRevertView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def revert_file_or_dir(self, revert_func, repo_id, commit_id, dirent_path, username):
        """revert file or dir

        seafile_api revert_file/revert_dir will overwrite exsiting duplicated-name file
        For example, name of trash item is 'demo', but a file named 'demo' existing also, after revert trash item 'demo' will overwrite existing 'demo'
        We need to do something to make trash item and existing item exist together

        If name of trash item is 'demo', there is an existing file(original path or root path /) named 'demo' also
        1. rename existing file, such as 'demo (1)'
        2. revert
        3. rename 'demo (1)' -> 'demo (2)', rename 'demo' -> 'demo (1)', rename 'demo (2)' -> 'demo'

        In a word, keep existing file name, and rename reverted trash item

        Return: {revert_code -> 1/0/-1, reverted_dirent_name -> str}
        """
        dirent_name = os.path.basename(dirent_path)
        parent_path = os.path.dirname(dirent_path)
        parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_path)
        target_names = None
        target_path = None

        if parent_dir_id:  # if parent path exists, will revert to this path
            original_existed_dirents_names = [dirent.obj_name for dirent in seafile_api.list_dir_by_path(repo_id, parent_path)]
            target_names = original_existed_dirents_names
            target_path = parent_path
        else:  # else revert to / root path
            root_existed_dirents_names = [dirent.obj_name for dirent in seafile_api.list_dir_by_path(repo_id, '/')]
            target_names = root_existed_dirents_names
            target_path = '/'

        dirent_name_1 = dirent_name
        if dirent_name in target_names:
            dirent_name_1 = get_no_duplicate_obj_name(dirent_name, target_names)

        seafile_api.rename_file(repo_id, target_path, dirent_name, dirent_name_1, username)

        revert_code = revert_func(repo_id, commit_id, dirent_path, username)
        revert_name = dirent_name_1

        if revert_code in [0, 1]:
            if dirent_name != dirent_name_1:
                dirent_name_2 = get_no_duplicate_obj_name(dirent_name, target_names + [dirent_name_1])
                seafile_api.rename_file(repo_id, target_path, dirent_name_1, dirent_name_2, username)
                seafile_api.rename_file(repo_id, target_path, dirent_name, dirent_name_1, username)
                seafile_api.rename_file(repo_id, target_path, dirent_name_2, dirent_name, username)
            return {'revert_code': revert_code, 'revert_name': revert_name}
        else:
            seafile_api.rename_file(repo_id, target_path, dirent_name_1, dirent_name, username)
            return {'revert_code': revert_code, 'revert_name': ''}

    def move_dirent_from_root(self, repo_id, target_path, dirent_name, username):
        """move dirent named dirent_name from / to target_path

        Return: name after move
        """

        seafile_api.mkdir_with_parents(repo_id, '/', target_path.strip('/'), username)
        existing_names = [dirent.obj_name for dirent in seafile_api.list_dir_by_path(repo_id, target_path)]
        new_dirent_name = get_no_duplicate_obj_name(dirent_name, existing_names)
        seafile_api.move_file(repo_id, '/',
                              json.dumps([dirent_name]),
                              repo_id, target_path,
                              json.dumps([new_dirent_name]),
                              replace=False, username=username,
                              need_progress=0, synchronous=1)
        return new_dirent_name

    def create_custom_assets_recursively(self, dtable_uuid, detail, parent_path, dir_name):
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)

        dirs, files = detail.get('dirs', []), detail.get('files', [])
        cur_dir_path = os.path.join(parent_path, dir_name)

        for file in files:
            uuid = file.get('uuid')
            file_name = file.get('file_name')
            if uuid:
                CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, cur_dir_path, file_name, uuid=uuid)

        for inner_detail in dirs:
            inner_dir_name = inner_detail.get('name', '')
            self.create_custom_assets_recursively(dtable_uuid, inner_detail, cur_dir_path, inner_dir_name)

    def put(self, request, dtable_uuid, trash_item_id):
        # resource check
        trash_item = DTableAssetTrash.objects.filter(
            pk=trash_item_id,
            deleted_at__gte=timezone.now() - timedelta(days=59)
        ).first()
        if not trash_item:
            return api_error(status.HTTP_404_NOT_FOUND, 'Trash item not found')
        if uuid_str_to_32_chars(dtable_uuid) != trash_item.dtable_uuid:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        dtable = DTables.objects.get_dtable_by_uuid(trash_item.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if trash_item.delete_from == DTableAssetTrash.CUSTOM:
            if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        elif trash_item.delete_from == DTableAssetTrash.SYSTEM:
            if not check_dtable_admin_permission(username, dtable.workspace.owner):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        else:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        repo_id = dtable.workspace.repo_id
        revert_custom_asset = None

        # revert system item
        if trash_item.delete_from == DTableAssetTrash.SYSTEM:
            revert_dirent_path = original_path = os.path.join('/asset', dtable_uuid, trash_item.basedir, trash_item.name)
            moved_dirent_name = trash_item.name
            try:
                revert_func = seafile_api.revert_dir if trash_item.item_type == DTableAssetTrash.DIR else seafile_api.revert_file
                revert_info = self.revert_file_or_dir(revert_func, repo_id, trash_item.commit_id, original_path, username)
                revert_code = revert_info.get('revert_code')
                moved_dirent_name = revert_name = revert_info.get('revert_name')
                if revert_code == 0:  # revert to original path
                    trash_item.delete()
                    revert_dirent_path = os.path.join(os.path.dirname(original_path), revert_name)
                elif revert_code == 1:
                    repo_revert_parent_path = os.path.join('/asset', dtable_uuid, 'restore')
                    moved_dirent_name = self.move_dirent_from_root(repo_id, repo_revert_parent_path, revert_name, username)
                    trash_item.delete()
                    revert_dirent_path = os.path.join(repo_revert_parent_path, moved_dirent_name)
                else:
                    logger.error('revert dtable dirent: %s from %s basedir %s name %s failed', dtable_uuid, trash_item.delete_from, trash_item.basedir, trash_item.name)
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            except Exception as e:
                logger.exception(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            revert_path = revert_dirent_path[revert_dirent_path.find(dtable_uuid)+len(dtable_uuid)+1:]

        # revert custom item
        else:
            revert_dirent_path = original_path = os.path.join('/asset', dtable_uuid, 'custom', trash_item.basedir, trash_item.name)
            try:
                revert_func = seafile_api.revert_dir if trash_item.item_type == DTableAssetTrash.DIR else seafile_api.revert_file
                revert_info = self.revert_file_or_dir(revert_func, repo_id, trash_item.commit_id, original_path, username)
                revert_code = revert_info.get('revert_code')
                moved_dirent_name = revert_name = revert_info.get('revert_name')
                try:
                    detail = json.loads(trash_item.detail)
                except:
                    detail = {}
                if revert_code == 0:  # reverted to original path
                    if trash_item.item_type == DTableAssetTrash.FILE:
                        uuid = detail.get('uuid')
                        if uuid:
                            revert_custom_asset = CustomAssetUUID.objects.get_or_create_by_path(uuid_str_to_36_chars(dtable_uuid), trash_item.basedir, revert_name, uuid=uuid)
                    else:
                        self.create_custom_assets_recursively(dtable_uuid, detail, trash_item.basedir, revert_name)
                    trash_item.delete()
                    revert_dirent_path = os.path.join(os.path.dirname(original_path), revert_name)
                elif revert_code == 1:  # reverted to / of repo
                    repo_revert_parent_path = os.path.join('/asset', dtable_uuid, 'custom')
                    moved_dirent_name = self.move_dirent_from_root(repo_id, repo_revert_parent_path, revert_name, username)
                    if trash_item.item_type == DTableAssetTrash.FILE:
                        uuid = detail.get('uuid')
                        if uuid:
                            revert_custom_asset = CustomAssetUUID.objects.get_or_create_by_path(uuid_str_to_36_chars(dtable_uuid), '', moved_dirent_name, uuid=uuid)
                    else:
                        self.create_custom_assets_recursively(dtable_uuid, detail, '', moved_dirent_name)
                    trash_item.delete()
                    revert_dirent_path = os.path.join(repo_revert_parent_path, moved_dirent_name)
                else:
                    logger.error('revert dtable dirent: %s from %s basedir %s name %s failed revert code: %s', dtable_uuid, trash_item.delete_from, trash_item.basedir, trash_item.name, revert_code)
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            except Exception as e:
                logger.exception(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            revert_path = revert_dirent_path[revert_dirent_path.find('custom')+len('custom')+1:]

        if is_org_context(request):
            org_id = request.user.org.org_id
            clean_org_storage_size_cache(org_id)

        dirent = seafile_api.get_dirent_by_path(repo_id, revert_dirent_path)
        dirent_info = get_dirent_info(dirent)
        if revert_custom_asset:
            dirent_info['uuid'] = revert_custom_asset.uuid

        return Response({
            'revert_path': revert_path,
            'dirent': dirent_info
        })


class DTableAssetSizeView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        workspace = dtable.workspace
        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        permission = check_dtable_permission(request.user.username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dtable_asset_path = '/asset/' + str(dtable.uuid)
            dir_id = seafile_api.get_dir_id_by_path(repo_id, dtable_asset_path)
            asset_size = 0
            dtable_export_max_size = getattr(config, 'DTABLE_EXPORT_MAX_SIZE', DTABLE_EXPORT_MAX_SIZE)
            if dir_id:
                file_info = seafile_api.get_file_count_info_by_path(repo_id, dtable_asset_path)
                asset_size = file_info.size >> 20
            return Response({
                'asset_size':  asset_size,
                'max_size_of_export': dtable_export_max_size,
                'unit': 'mb',
                'can_export_asset': asset_size < dtable_export_max_size
            })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


import os
import stat
import logging

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces
from seahub.utils import normalize_dir_path, normalize_file_path
from seahub.utils.repo import get_repo_owner
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seaserv import seafile_api, ccnet_api

logger = logging.getLogger(__name__)


def _rename_file(request, owner, path, new_name):
    workspace = Workspaces.objects.get_workspace_by_owner(owner)
    if not workspace:
        return api_error(status.HTTP_404_NOT_FOUND, 'Workspace not found.')
    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        return api_error(status.HTTP_404_NOT_FOUND, 'Library not found.')
    dirent_path = normalize_file_path(path)
    parent_dir = os.path.dirname(dirent_path)
    old_name = os.path.basename(dirent_path)
    file_id = seafile_api.get_file_id_by_path(repo_id, path)
    if not file_id:
        return api_error(status.HTTP_404_NOT_FOUND, 'File not found.')
    try:
        seafile_api.rename_file(repo_id, parent_dir, old_name, new_name, request.user.username)
    except Exception as e:
        logger.error(e)
        return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

    return Response({'success': True})


def get_dirent_info(dirent):

    if stat.S_ISDIR(dirent.mode):
        is_file = False
    else:
        is_file = True

    result = {}
    result['obj_id'] = dirent.obj_id
    result['is_file'] = is_file
    result['obj_name'] = dirent.obj_name
    result['file_size'] = dirent.size if is_file else ''
    result['last_update'] = timestamp_to_isoformat_timestr(dirent.mtime)

    return result


class AdminGroupStorages(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, group_id):
        """ List group repo contents
            currently one group -> one workspace -> one repo
        """
        group_id = int(group_id)

        try:
            group = ccnet_api.get_group(group_id)
        except Exception as e:
            logging.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not group:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        parent_dir = request.GET.get('parent_dir', '/')
        dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        if not dir_id:
            error_msg = 'Folder %s not found.' % parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # dtable's repo_owner if always 'dtable@seafile', not same as workspace and group owner
        try:
            repo_owner = get_repo_owner(request, repo_id)
            dirs = seafile_api.list_dir_with_perm(repo_id, parent_dir, dir_id, repo_owner, -1, -1)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # convert dirent obj to dict and exclude '*.dtable' files.
        dirent_list = [get_dirent_info(dir) for dir in dirs]
        return Response({
            'dirent_list': dirent_list,
            'group_name': group.group_name,
            'repo_id': repo_id
        })


class AdminUserStorage(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, email):
        workspace = Workspaces.objects.get_workspace_by_owner(email)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        parent_dir = request.GET.get('parent_dir', '/')
        dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        if not dir_id:
            error_msg = 'Folder %s not found.' % parent_dir
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # dtable's repo_owner if always 'dtable@seafile', not same as workspace and group owner
        try:
            repo_owner = get_repo_owner(request, repo_id)
            dirs = seafile_api.list_dir_with_perm(repo_id, parent_dir, dir_id, repo_owner, -1, -1)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # convert dirent obj to dict and exclude '*.dtable' files.
        dirent_list = [get_dirent_info(dir) for dir in dirs]
        return Response({
            'dirent_list': dirent_list,
            'email': email,
            'repo_id': repo_id,
        })


class AdminUserStorageFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, email, path):
        # arguments check
        new_name = request.data.get('new_name')
        if not new_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'new_name not invalid.')

        return _rename_file(request, email, path, new_name)


class AdminGroupStorageFileView(APIView):

    def put(self, request, group_id, path):
        new_name = request.data.get('new_name')
        if not new_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'new_name not invalid.')
        owner = '%s@seafile_group' % (group_id,)
        return _rename_file(request, owner, path, new_name)

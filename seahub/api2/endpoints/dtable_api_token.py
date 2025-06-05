import json
import logging
import time
import jwt
import os
import stat


from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _
from django.utils import timezone
from datetime import datetime

from seaserv import seafile_api

from seahub.api2.endpoints.dtable_storage import get_dirent_info
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.utils import gen_file_upload_url, gen_file_get_url, uuid_str_to_32_chars
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.api2.authentication import TokenAuthentication, AUTHORIZATION_PREFIX
from seahub.api2.throttling import UserRateThrottle, AppRateThrottle
from seahub.api2.utils import api_error
from seahub.api2.status import HTTP_443_ABOVE_QUOTA
from seahub.dtable.models import Workspaces, DTables, DTableAPIToken, BoundThirdPartyAccounts, CustomAssetUUID, \
    IdInOrgTuple, DTableAssetTrash
from seahub.settings import DTABLE_PRIVATE_KEY, DTABLE_SERVER_URL, DTABLE_SOCKET_URL, DTABLE_DB_URL, \
    SEATABLE_FAAS_AUTH_TOKEN
from seahub.dtable.utils import check_dtable_admin_permission, check_dtable_permission, \
    check_quota_by_workspace, check_quota_and_row_limit_by_workspace, \
    check_row_limit_by_workspace, UPLOAD_IMG_RELATIVE_PATH, UPLOAD_FILE_RELATIVE_PATH, send_file_access_msg
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.base.accounts import User

logger = logging.getLogger(__name__)
API_TOKEN_PERMISSION_TUPLE = (PERMISSION_READ, PERMISSION_READ_WRITE)


def _resource_check(workspace_id, table_name):
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        error_msg = 'Workspace %s not found.' % workspace_id
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None, None

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        error_msg = 'Library %s not found.' % repo_id
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None, None

    dtable = DTables.objects.get_dtable(workspace, table_name)
    if not dtable:
        error_msg = 'dtable %s not found.' % table_name
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None, None

    return None, workspace, dtable


def _permission_check_for_api_token(username, owner):
    # only owner or group admin
    if not check_dtable_admin_permission(username, owner):
        error_msg = _('Permission denied.')
        return api_error(status.HTTP_403_FORBIDDEN, error_msg)

    return None


def _api_token_obj_to_dict(api_token_obj):
    return {
        'app_name': api_token_obj.app_name,
        'api_token': api_token_obj.token,
        'generated_by': api_token_obj.generated_by,
        'generated_at': datetime_to_isoformat_timestr(api_token_obj.generated_at),
        'last_access': datetime_to_isoformat_timestr(api_token_obj.last_access),
        'permission': api_token_obj.permission,
    }


class DTableAPITokensView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """list dtable api token for thirdpart app
        """
        table_name = name
        username = request.user.username

        # resource check
        error, workspace, dtable = _resource_check(workspace_id, table_name)
        if error:
            return error

        # permission check
        owner = workspace.owner
        error = _permission_check_for_api_token(username, owner)
        if error:
            return error

        # main
        api_tokens = list()

        try:
            api_token_queryset = DTableAPIToken.objects.list_by_dtable(dtable)
            for api_token_obj in api_token_queryset:
                data = _api_token_obj_to_dict(api_token_obj)
                api_tokens.append(data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'api_tokens': api_tokens})

    def post(self, request, workspace_id, name):
        """generate dtable api token
        """
        table_name = name
        username = request.user.username

        # argument check
        app_name = request.data.get('app_name')
        if not app_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'app_name invalid.')

        permission = request.data.get('permission')
        if not permission or permission not in API_TOKEN_PERMISSION_TUPLE:
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        error, workspace, dtable = _resource_check(workspace_id, table_name)
        if error:
            return error

        # permission check
        owner = workspace.owner
        error = _permission_check_for_api_token(username, owner)
        if error:
            return error

        # main
        try:
            exist_obj = DTableAPIToken.objects.get_by_dtable_and_app_name(dtable, app_name)
            if exist_obj is not None:
                return api_error(status.HTTP_400_BAD_REQUEST, 'api token already exist.')

            api_token_obj = DTableAPIToken.objects.add(dtable, app_name, username, permission)

            data = _api_token_obj_to_dict(api_token_obj)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(data, status=status.HTTP_201_CREATED)


class DTableAPITokenView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, workspace_id, name, app_name):
        """delete dtable api token
        """
        table_name = name
        username = request.user.username

        # resource check
        error, workspace, dtable = _resource_check(workspace_id, table_name)
        if error:
            return error

        # permission check
        owner = workspace.owner
        error = _permission_check_for_api_token(username, owner)
        if error:
            return error

        # main
        try:
            api_token_obj = DTableAPIToken.objects.get_by_dtable_and_app_name(dtable, app_name)
            if api_token_obj is None:
                return api_error(status.HTTP_404_NOT_FOUND, 'api token not found.')

            api_token_obj.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def put(self, request, workspace_id, name, app_name):
        """update dtable api token
        """
        table_name = name
        username = request.user.username

        # argument check
        permission = request.data.get('permission')
        if not permission or permission not in API_TOKEN_PERMISSION_TUPLE:
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        error, workspace, dtable = _resource_check(workspace_id, table_name)
        if error:
            return error

        # permission check
        owner = workspace.owner
        error = _permission_check_for_api_token(username, owner)
        if error:
            return error

        # main
        try:
            api_token_obj = DTableAPIToken.objects.get_by_dtable_and_app_name(dtable, app_name)
            if api_token_obj is None:
                return api_error(status.HTTP_404_NOT_FOUND, 'api token not found.')

            if permission == api_token_obj.permission:
                return api_error(status.HTTP_400_BAD_REQUEST, 'api token already has %s permission.' % permission)

            api_token_obj.permission = permission
            api_token_obj.save(update_fields=['permission'])

            data = _api_token_obj_to_dict(api_token_obj)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(data)


class DTableAppAccessTokenView(APIView):
    throttle_classes = (AppRateThrottle,)

    def get(self, request):
        """thirdpart app used dtable api token to get access token and dtable uuid
        """
        # argument check
        token_list = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not token_list or token_list[0].lower() not in AUTHORIZATION_PREFIX or len(token_list) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        api_token = token_list[1]

        # main
        try:  # checkout token from db
            api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
            if api_token_obj is not None:
                api_token_obj.update_last_access()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        username = None
        if not api_token_obj:  # temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            username = payload.get('username') or None
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        if api_token_obj:
            dtable = api_token_obj.dtable
            permission = api_token_obj.permission
            app_name = api_token_obj.app_name
        else:
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
            permission = PERMISSION_READ_WRITE
            app_name = 'scripts'

        if username:
            try:
                User.objects.get(email=username)
            except User.DoesNotExist:
                username = None

        table_name = dtable.name
        workspace_id = dtable.workspace_id

        error, workspace, dtable = _resource_check(workspace_id, table_name)
        if error:
            return error

        permission = permission if check_quota_and_row_limit_by_workspace(workspace) else PERMISSION_READ
        if enable_dtable_server_cluster:
            dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
            dtable_socket_url = dtable_server_url
        else:
            dtable_server_url = DTABLE_SERVER_URL
            dtable_socket_url = DTABLE_SOCKET_URL
        dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url, app_name=app_name, permission=permission)
        return Response({
            'app_name': app_name,
            'access_token': dtable_server_api.view_access_token,
            'dtable_uuid': str(dtable.uuid),
            'dtable_server': dtable_server_url,
            'dtable_socket': dtable_socket_url,
            'dtable_db': DTABLE_DB_URL,
            'workspace_id': workspace_id,
            'dtable_name': dtable.name,
            'use_api_gateway': True,
        })


class DTableAppUploadLinkView(APIView):

    throttle_classes = (AppRateThrottle, )

    def get(self, request):
        """get file upload link by dtable api token

        Permission:
        1. valid token
        """
        # argument check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        # resource check
        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            api_token_obj.update_last_access()
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        table_name = dtable.name
        workspace_id = dtable.workspace_id

        error, workspace, dtable = _resource_check(workspace_id, table_name)
        if error:
            return error

        # quota and rows check
        if not check_quota_by_workspace(workspace):
            return api_error(HTTP_443_ABOVE_QUOTA, 'Asset quota exceeded.')
        if not check_row_limit_by_workspace(workspace):
            return api_error(HTTP_443_ABOVE_QUOTA, 'Rows exceeded.')

        # create asset dir
        repo_id = workspace.repo_id
        asset_dir_path = '/asset/' + str(dtable.uuid)
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        if not asset_dir_id:
            try:
                generated_by = api_token_obj.generated_by if api_token_obj else ''
                seafile_api.mkdir_with_parents(
                    repo_id, '/', asset_dir_path[1:], generated_by)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # get token
        obj_id = json.dumps({'parent_dir': asset_dir_path})
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
        res['parent_path'] = asset_dir_path
        res['img_relative_path'] = os.path.join(UPLOAD_IMG_RELATIVE_PATH, str(datetime.today())[:7])
        res['file_relative_path'] = os.path.join(UPLOAD_FILE_RELATIVE_PATH, str(datetime.today())[:7])

        return Response(res)


class DTableAppDownloadLinkView(APIView):

    throttle_classes = (AppRateThrottle, )

    def get(self, request):
        """get file download link by dtable api token

        Permission:
        1. valid token
        """

        # argument check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        path = request.GET.get('path', '/')

        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        asset_dir_path = '/asset/' + str(dtable.uuid)
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        if not asset_dir_id:
            error_msg = 'asset not found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        target_path = os.path.join(asset_dir_path, path.strip('/')) # target_path is path inside repo


        file_id = seafile_api.get_file_id_by_path(repo_id, target_path.strip('/'))
        if not file_id:
            error_msg = 'path %s not found.' % path
            return  api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            download_token = seafile_api.get_fileserver_access_token(repo_id,
                                                                     file_id,
                                                                     'download-link',
                                                                     request.user.username,
                                                                     use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        file_name = os.path.basename(path.rstrip('/'))
        download_link = gen_file_get_url(download_token, file_name)
        send_file_access_msg(request, dtable, target_path, 'download')

        return Response({'download_link': download_link})


class DTableAppAssetView(APIView):
    throttle_classes = (AppRateThrottle, )

    def delete(self, request):
        """delete file by dtable api token

        Permission:
        1. valid token

        Parms:
        1. path, string, required
        """

        # argument check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        path = request.GET.get('path')
        if not path:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid path.')

        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        asset_dir_path = '/asset/' + str(dtable.uuid)

        target_path = os.path.join(asset_dir_path, path.strip('/')) # target_path is path inside repo

        dirent = seafile_api.get_dirent_by_path(repo_id, target_path)
        if not dirent or stat.S_ISDIR(dirent.mode):
            error_msg = f'File not found.'
            return  api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            file_name = os.path.basename(target_path)
            success = seafile_api.del_file(repo_id, target_path.rsplit(file_name, 1)[0], json.dumps([file_name]), '') == 0
            if success:
                DTableAssetTrash.objects.create(
                    dtable_uuid=dtable.uuid.hex,
                    name=file_name,
                    delete_from=DTableAssetTrash.SYSTEM,
                    item_type=DTableAssetTrash.FILE,
                    basedir=path.rsplit(file_name, 1)[0].strip('/'),
                    commit_id=repo.head_cmmt_id,
                    size=dirent.size,
                    deleted_at=timezone.now()
                )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': success})


class DTableAppCustomAssetFileView(APIView):

    throttle_classes = (AppRateThrottle, )

    def get(self, request):
        parent_dir = request.GET.get('path', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        relative_path = parent_dir.strip('/')

        file_name = request.GET.get('name', None)
        if not file_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]


        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        dtable_uuid = str(dtable.uuid)
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

    def delete(self, request):
        path = request.GET.get('path', None)
        if not path:
            error_msg = 'path invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]


        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        dtable_uuid = str(dtable.uuid)

        # resource check
        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        base_dir = '/asset/' + dtable_uuid + '/custom'
        target_path = os.path.join(base_dir, path.strip('/'))

        dirent = seafile_api.get_dirent_by_path(repo_id, target_path)
        if not dirent or stat.S_ISDIR(dirent.mode):
            error_msg = 'File not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            file_name = os.path.basename(target_path)
            basedir = target_path.rsplit(file_name, 1)[0]
            success = seafile_api.del_file(repo_id, basedir, json.dumps([file_name]), '') == 0
            if success:
                DTableAssetTrash.objects.create(
                    dtable_uuid=dtable.uuid.hex,
                    name=file_name,
                    delete_from=DTableAssetTrash.CUSTOM,
                    item_type=DTableAssetTrash.FILE,
                    basedir=path.rsplit(file_name, 1)[0].strip('/'),
                    commit_id=repo.head_cmmt_id,
                    size=dirent.size,
                    deleted_at=timezone.now()
                )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': success})

class DTableAppCustomAssetDirView(APIView):
    """
    Support uniform interface for file related operations,
    including create/delete/rename/view, etc.
    """

    throttle_classes = (AppRateThrottle, )

    def _list_custom_asset(self, repo_id, parent_dir):
        dirent_dict = {
            'dir': [],
            'file': [],
        }
        dirs = seafile_api.list_dir_by_path(repo_id, parent_dir)
        for obj in dirs:
            info = get_dirent_info(obj)
            if info.get('is_file'):
                dirent_dict['file'].append({'name': info.get('obj_name')})
            else:
                dirent_dict['dir'].append({'name': info.get('obj_name')})


        return dirent_dict

    def get(self, request):
        # argument check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        parent_dir = request.GET.get('path', None)
        if not parent_dir:
            error_msg = 'parent_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        dtable_uuid = str(dtable.uuid)
        repo_id = dtable.workspace.repo_id
        base_dir = '/asset/' + dtable_uuid + '/custom'
        dirent_dict = {'dir': [], 'file': []}
        if not parent_dir or parent_dir == '/':
            parent_dir = base_dir
            parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
            if not parent_dir_id:
                return Response(dirent_dict)
            dirent_dict = self._list_custom_asset(repo_id, parent_dir)
            return Response(dirent_dict)

        parent_dir = base_dir + parent_dir
        parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
        if not parent_dir_id:
            error_msg = 'parent_dir not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dirent_dict = self._list_custom_asset(repo_id, parent_dir)
        return Response(dirent_dict)

class DTableAppCustomAssetDownloadLinkView(APIView):

    throttle_classes = (AppRateThrottle, )

    def get(self, request):
        # argument check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        path = request.GET.get('path', None)
        if not path:
            error_msg = 'path invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        asset_dir_path = '/asset/' + str(dtable.uuid) + '/custom/'
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        if not asset_dir_id:
            error_msg = 'asset not found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        target_path = os.path.join(asset_dir_path, path.strip('/')) # target_path is path inside repo


        file_id = seafile_api.get_file_id_by_path(repo_id, target_path.strip('/'))
        if not file_id:
            error_msg = 'path %s not found.' % path
            return  api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            download_token = seafile_api.get_fileserver_access_token(repo_id,
                                                                     file_id,
                                                                     'download-link',
                                                                     request.user.username,
                                                                     use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        file_name = os.path.basename(path.rstrip('/'))
        download_link = gen_file_get_url(download_token, file_name)
        send_file_access_msg(request, dtable, target_path, 'download')

        return Response({'download_link': download_link})


class DTableAppCustomAssetUploadLinkView(APIView):

    throttle_classes = (AppRateThrottle,)

    def get(self, request):
        # argument check
        parent_dir = request.GET.get('path', '/')
        relative_path = parent_dir.lstrip('/')

        # quota check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        # resource check
        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            api_token_obj.update_last_access()
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        table_name = dtable.name
        workspace_id = dtable.workspace_id

        error, workspace, dtable = _resource_check(workspace_id, table_name)
        if error:
            return error

        # quota and rows check
        if not check_quota_by_workspace(workspace):
            return api_error(HTTP_443_ABOVE_QUOTA, 'Asset quota exceeded.')
        if not check_row_limit_by_workspace(workspace):
            return api_error(HTTP_443_ABOVE_QUOTA, 'Rows exceeded.')

        # create custom dir
        repo_id = dtable.workspace.repo_id
        dtable_uuid = str(dtable.uuid)
        base_dir = '/asset/' + dtable_uuid + '/custom'
        base_dir_id = seafile_api.get_dir_id_by_path(repo_id, base_dir)
        if not base_dir_id:
            generated_by = api_token_obj.generated_by if api_token_obj else ''
            seafile_api.mkdir_with_parents(repo_id, '/', base_dir[1:], generated_by)

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


class DTableTempAPITokenView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    EXPIRE_TIME = 60 * 60

    def get(self, request, workspace_id, name):
        username = request.user.username

        # resource check
        error, workspace, dtable = _resource_check(workspace_id, name)
        if error:
            return error

        # permission check
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        api_token = jwt.encode({
            'username': username,
            'dtable_uuid': str(dtable.uuid),
            'exp': time.time() + DTableTempAPITokenView.EXPIRE_TIME
        }, SEATABLE_FAAS_AUTH_TOKEN, algorithm='HS256')

        return Response({'api_token': api_token})

class DTableAppThirdPartyAccountView(APIView):

    throttle_classes = (AppRateThrottle, )

    def get(self, request):
        """get third party account detail by dtable api token

        Permission:
        1. valid token
        """
        # argument check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        account_name = request.GET.get('account_name', '')

        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            uuid_str = uuid_str_to_32_chars(dtable.uuid.hex)
            account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'account': account.to_dict()})

class DTableAppUserInfoView(APIView):

    throttle_classes = (AppRateThrottle, )

    def get(self, request):


        # argument check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        api_token = auth[1]

        # resource check
        dtable = None
        api_token_obj = DTableAPIToken.objects.get_by_token(api_token)
        if api_token_obj:
            api_token_obj.update_last_access()
            dtable = api_token_obj.dtable
        if not dtable:  # check info from temp api token
            try:
                payload = jwt.decode(api_token, SEATABLE_FAAS_AUTH_TOKEN, algorithms=['HS256'])
            except:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable_uuid = payload.get('dtable_uuid')
            if not dtable_uuid:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)

        if not dtable:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        username = request.GET.get('username', '')
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple.exists() and id_in_org_tuple[0].id_in_org or ''
        name = email2nickname(username)

        res = {
            'id_in_org': id_in_org,
            'name': name
        }

        return Response(res)

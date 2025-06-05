import os
import stat
import logging
import requests
import posixpath

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from django.utils.translation import gettext as _
from django.http import HttpResponseRedirect, HttpResponse
from django.urls import reverse

from seaserv import seafile_api, check_quota, get_org_id_by_repo_id

from seahub.api2.authentication import TokenAuthentication, SdocJWTTokenAuthentication
from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.seadoc.authentication import InternalAccessTokenAuthentication
from seahub.seadoc.utils import is_valid_seadoc_access_token, get_seadoc_upload_link, \
    get_seadoc_download_link, gen_seadoc_access_token, \
    gen_seadoc_image_parent_path, get_seadoc_asset_upload_link, get_seadoc_asset_download_link, gen_seadoc_base_dir
from seahub.utils.file_types import SEADOC, IMAGE
from seahub.utils.file_op import if_locked_by_online_office
from seahub.utils import get_file_type_and_ext, normalize_dir_path, PREVIEW_FILEEXT, is_pro_version, normalize_file_path, render_error
from seahub.utils.error_msg import file_type_error_msg

from seahub.dtable.models import CustomAssetUUID, DTables
from seahub.dtable.utils import can_access_asset, set_dtable_asset_cache_read_permission


logger = logging.getLogger(__name__)


class SeadocAccessToken(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication, InternalAccessTokenAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    def get(self, request, file_uuid):

        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'file %s not found.' % (file_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = asset.dtable_uuid

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        filename = asset.file_name
        dtable_uuid = asset.dtable_uuid
        file_uuid = str(asset.uuid)
        base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

        filetype, fileext = get_file_type_and_ext(filename)
        if filetype != SEADOC:
            error_msg = 'seadoc file type %s invalid.' % filetype
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        real_sdoc_file_path = posixpath.join(base_dir, filename)
        try:

            obj_id = seafile_api.get_file_id_by_path(repo_id, real_sdoc_file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not obj_id:
            error_msg = 'File %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check asset permission
        asset_id = seafile_api.get_file_id_by_path(repo_id, real_sdoc_file_path)
        can_access, need_cache, user_permission = can_access_asset(request, dtable.workspace, dtable,
                                                                   real_sdoc_file_path, asset_id)
        if not can_access:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        access_token = gen_seadoc_access_token(file_uuid, filename, request.user.username, permission=user_permission)

        return Response({'access_token': access_token})


class SeadocDownloadLink(APIView):

    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, file_uuid):
        # jwt permission check
        auth = request.headers.get('authorization', '').split()
        if not is_valid_seadoc_access_token(auth, file_uuid):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'seadoc uuid %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        filetype, fileext = get_file_type_and_ext(asset.file_name)
        if filetype != SEADOC:
            error_msg = 'seadoc file type %s invalid.' % filetype
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = asset.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        download_link = get_seadoc_download_link(repo_id, asset)
        if not download_link:
            error_msg = 'seadoc file %s not found.' % asset.file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return Response({'download_link': download_link})


class SeadocUploadFile(APIView):

    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, file_uuid):
        # jwt permission check
        auth = request.headers.get('authorization', '').split()
        if not is_valid_seadoc_access_token(auth, file_uuid):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file not found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'seadoc uuid %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        filetype, fileext = get_file_type_and_ext(asset.file_name)
        if filetype != SEADOC:
            error_msg = 'seadoc file type %s invalid.' % filetype
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = asset.dtable_uuid
        parent_path = asset.parent_path
        filename = asset.file_name
        file_uuid = str(asset.uuid)
        base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

        # real parent path
        real_parent_path = posixpath.join(base_dir, parent_path)
        real_file_path = posixpath.join(real_parent_path, filename)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo_id = dtable.workspace.repo_id

        file_id = seafile_api.get_file_id_by_path(repo_id, real_file_path)
        if not file_id:  # save file anyway
            seafile_api.post_empty_file(
                repo_id, real_parent_path, filename, '')
        #
        last_modify_user = request.POST.get('last_modify_user', '')
        upload_link = get_seadoc_upload_link(repo_id, asset, last_modify_user)

        if not upload_link:
            error_msg = 'seadoc file %s not found.' % filename
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # update file
        files = {'file': file}
        data = {'filename': filename, 'target_file': real_file_path}
        resp = requests.post(upload_link, files=files, data=data)
        if not resp.ok:
            logger.error('save sdoc failed %s, %s' % (file_uuid, resp.text))
            return api_error(resp.status_code, resp.content)

        return Response({'success': True})


class SeadocEditorCallBack(APIView):

    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, file_uuid):

        # jwt permission check
        auth = request.headers.get('authorization', '').split()
        if not is_valid_seadoc_access_token(auth, file_uuid):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # file info check
        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'seadoc uuid %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        filetype, fileext = get_file_type_and_ext(asset.file_name)
        if filetype != SEADOC:
            error_msg = 'seadoc file type %s invalid.' % filetype
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # currently only implement unlock file
        sdoc_status = request.POST.get('status', '')
        if sdoc_status != 'no_write':
            error_msg = 'status invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = asset.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo_id = dtable.workspace.repo_id

        parent_path = asset.parent_path
        filename = asset.file_name
        dtable_uuid = asset.dtable_uuid
        file_uuid = str(asset.uuid)
        base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

        # real parent path
        real_parent_path = posixpath.join(base_dir, parent_path)
        real_file_path = posixpath.join(real_parent_path, filename)

        # unlock file
        try:
            if is_pro_version() and if_locked_by_online_office(repo_id, real_file_path):
                seafile_api.unlock_file(repo_id, real_file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class SeadocUploadImage(APIView):

    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, file_uuid):
        """image path: /images/sdoc/${sdocUuid}/${filename}
        """
        # jwt permission check
        auth = request.headers.get('authorization', '').split()
        is_valid, payload = is_valid_seadoc_access_token(auth, file_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file_list = request.FILES.getlist('file')
        if not file_list or not isinstance(file_list, list):
            error_msg = 'Image can not be found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        # max 10 images
        file_list = file_list[:10]

        for file in file_list:
            file_type, ext = get_file_type_and_ext(file.name)
            if file_type != IMAGE:
                error_msg = file_type_error_msg(ext, PREVIEW_FILEEXT.get('Image'))
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'seadoc uuid %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = asset.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo_id = dtable.workspace.repo_id

        if check_quota(repo_id) < 0:
            error_msg = _("Out of quota.")
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = payload.get('username', '')

        real_parent_path = gen_seadoc_image_parent_path(asset, repo_id, username)
        upload_link = get_seadoc_asset_upload_link(repo_id, real_parent_path, username)

        relative_path = []
        for file in file_list:
            new_file_path = posixpath.join(real_parent_path, file.name)
            files = {'file': file}
            data = {'parent_dir': real_parent_path, 'filename': file.name, 'target_file': new_file_path}
            resp = requests.post(upload_link, files=files, data=data)
            if not resp.ok:
                logger.error(resp.text)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            image_url = '/' + file.name
            relative_path.append(image_url)
        return Response({'relative_path': relative_path})


class SeadocDownloadImage(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication, InternalAccessTokenAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, file_uuid, filename):
        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'seadoc uuid %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = asset.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo_id = dtable.workspace.repo_id

        image_filename = filename
        file_uuid = str(asset.uuid)
        dtable_uuid = asset.dtable_uuid
        parent_path = asset.parent_path
        sdoc_filename = asset.file_name
        base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

        # real sdoc parent path
        real_sdoc_parent_path = posixpath.join(base_dir, parent_path)
        real_sdoc_file_path = posixpath.join(real_sdoc_parent_path, sdoc_filename)

        username = request.user.username

        asset_id = seafile_api.get_file_id_by_path(repo_id, real_sdoc_file_path)
        can_access, need_cache, user_permission = can_access_asset(request, dtable.workspace, dtable, real_sdoc_file_path, asset_id)
        if not can_access:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if need_cache:
            set_dtable_asset_cache_read_permission(request, dtable_uuid, asset_id)

        real_image_parent_path = gen_seadoc_image_parent_path(asset, repo_id, username)
        download_link = get_seadoc_asset_download_link(repo_id, real_image_parent_path, image_filename, username)
        if not download_link:
            error_msg = 'file %s not found.' % image_filename
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        resp = requests.get(download_link)
        if not resp.ok:
            logger.error(resp.text)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        filetype, fileext = get_file_type_and_ext(image_filename)
        return HttpResponse(content=resp.content, content_type='image/' + fileext)


class SeadocDirView(APIView):
    """list all files in dir
    """
    authentication_classes = (SdocJWTTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, file_uuid):

        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'seadoc uuid %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = asset.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % (dtable_uuid,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        parent_path = asset.parent_path

        file_type = request.GET.get('type', 'sdoc')  # sdoc, image, file
        path = request.GET.get('p', '/')

        dtable_uuid = asset.dtable_uuid
        file_uuid = str(asset.uuid)
        base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

        real_path = posixpath.join(base_dir, parent_path, path.strip('/'))
        real_path = normalize_dir_path(real_path)

        dir_id = seafile_api.get_dir_id_by_path(repo_id, real_path)
        if not dir_id:
            error_msg = 'Folder %s not found.' % real_path
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        asset_id = seafile_api.get_file_id_by_path(repo_id, real_path)
        can_access, need_cache, user_permission = can_access_asset(request, dtable.workspace, dtable, real_path, asset_id)

        if not can_access:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if need_cache:
            set_dtable_asset_cache_read_permission(request, dtable_uuid, asset_id)

        try:
            dirs = seafile_api.list_dir_by_path(repo_id, real_path)
            dirs = dirs if dirs else []
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to list dir.")

        uuid_map_queryset = CustomAssetUUID.objects.list_by_path(dtable_uuid, path)
        dir_list, file_list = [], []
        for dirent in dirs:
            entry = {}
            if stat.S_ISDIR(dirent.mode):
                dtype = "dir"
            else:
                dtype = "file"
                filetype, fileext = get_file_type_and_ext(dirent.obj_name)
                dirent_uuid_map = uuid_map_queryset.filter(file_name=dirent.obj_name).first()
                dirent_file_uuid = str(dirent_uuid_map.uuid) if dirent_uuid_map else ''
                if file_type == 'sdoc' and filetype == SEADOC:
                    entry["file_uuid"] = dirent_file_uuid
                elif filetype == 'image' and filetype == IMAGE:
                    entry["file_uuid"] = dirent_file_uuid
                elif file_type == 'file' and filetype not in (SEADOC, IMAGE):
                    entry["file_uuid"] = dirent_file_uuid
                else:
                    continue
            entry["type"] = dtype
            entry["name"] = dirent.obj_name
            entry["id"] = dirent.obj_id
            entry["mtime"] = dirent.mtime
            entry["permission"] = dirent.permission
            if dtype == 'dir':
                dir_list.append(entry)
            else:
                file_list.append(entry)

        dir_list.sort(key=lambda x: x['name'].lower())
        file_list.sort(key=lambda x: x['name'].lower())
        dentrys = dir_list + file_list
        return Response(dentrys)


class SeadocFileView(APIView):
    """redirect to file view by file_uuid
    """
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, file_uuid):
        # do not permission check, just redirect

        asset = CustomAssetUUID.objects.get_by_uuid(file_uuid)
        if not asset:
            error_msg = 'file uuid %s not found.' % file_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = asset.dtable_uuid
        file_name = asset.file_name
        parent_dir = asset.parent_path

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return render_error(request, _('This base does not exist'))

        asset_path = normalize_file_path(os.path.join('custom', parent_dir, file_name))
        url = reverse('dtable:dtable_asset_preview', args=(dtable.workspace.id, dtable_uuid, asset_path.strip('/')))

        return HttpResponseRedirect(url)

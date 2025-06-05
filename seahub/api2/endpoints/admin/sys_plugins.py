import os
import logging
import json
import shutil
import requests
from zipfile import ZipFile, is_zipfile
from datetime import datetime

from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.utils.translation import gettext as _
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from seaserv import seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTableSystemPlugins, DTablePluginsInstallCount
from seahub.utils import rreplace, CsrfExemptSessionAuthentication, get_market_url_by_lang
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.base.templatetags.seahub_tags import email2nickname

logger = logging.getLogger(__name__)

TMP_EXTRACTED_PATH = '/tmp/dtable_plugin/'
INFO_FILE_NAME = 'info.json'
MAINJS_FILE_NAME = 'main.js'
PLUGINS_REPO_ID = settings.PLUGINS_REPO_ID


def create_plugin_asset_files(repo_id, username, plugin_name, folder_path):
    for root, dirs, files in os.walk(TMP_EXTRACTED_PATH):
        for file_name in files:
            inner_path = root[len(TMP_EXTRACTED_PATH):]  # path inside plugin zip
            tmp_file_path = os.path.join(root, file_name)
            cur_file_parent_path = os.path.join('/', plugin_name, inner_path, '')

            # check zip of a folder
            if folder_path:
                cur_file_parent_path = rreplace(cur_file_parent_path, folder_path + '/', '', 1)

            # check current file's parent path before post file
            path_id = seafile_api.get_dir_id_by_path(repo_id, cur_file_parent_path)
            if not path_id:
                seafile_api.mkdir_with_parents(repo_id, '/', cur_file_parent_path[1:], username)

            seafile_api.post_file(repo_id, tmp_file_path, cur_file_parent_path, file_name, username)


def get_folder_path(namelist):
    """
         folder_path is aimed to check zip of a folder, e.g.

         xxx.zip
               |- some_folder_name
                                |- info.json
                                |- main.js

         if dir tree is like above, then folder_path = some_folder_name
    """
    if INFO_FILE_NAME not in namelist:
        for path in namelist:
            if INFO_FILE_NAME in path and len(path.split('/')[:-1]) == 1:
                return ''.join(path.split('/')[:-1])
    return ''

def delete_plugin_asset_folder(repo_id, username, plugin_file_path):
    parent_dir = os.path.dirname(plugin_file_path)
    file_name = os.path.basename(plugin_file_path)
    seafile_api.del_file(repo_id, parent_dir, json.dumps([file_name]), username)


class AdminDTableSystemPluginsView(APIView):
    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
            list all plugins for system admin
        """
        try:
            plugins = DTableSystemPlugins.objects.all()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        plugin_list = list()
        for plugin in plugins:
            try:
                plugin_list.append(plugin.to_dict())
            except Exception as e:
                logger.error(e)
                plugin_dict = {
                    'id': plugin.pk,
                    'plugin_name': plugin.name,
                    'info': {'name': 'Broken',
                             'display_name': _('Broken'),
                             'description': _('This plugin is broken')},
                    'added_by': email2nickname(plugin.added_by),
                    'added_time': datetime_to_isoformat_timestr(plugin.added_time)
                }
                plugin_list.append(plugin_dict)

        return Response({'plugin_list': plugin_list})

    def post(self, request):
        """
            upload a plugin, or import a plugin from market
        """
        # use TemporaryFileUploadHandler, which contains TemporaryUploadedFile
        # TemporaryUploadedFile has temporary_file_path() method
        # in order to change upload_handlers, we must exempt csrf check

        # permission check
        if not request.user.admin_permissions.can_manage_plugin():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        username = request.user.username

        from_market = request.data.get('from_market', '').lower()
        if from_market and from_market not in ['true', 'false']:
            error_msg = 'from_market %s invalid.' % from_market
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if from_market == 'true':
            """
            if we add plugin from market
            1. get plugin_download_url from market by plugin_name
            2. download plugin zip by plugin_download_url
            3. extract zip in TMP_EXTRACTED_PATH
            4. create file in asset dir, and delete TMP_EXTRACTED_PATH
            5. record in database
            """
            plugin_name = request.data.get('plugin_name', '')
            if not plugin_name:
                error_msg = 'plugin_name invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if DTableSystemPlugins.objects.filter(name=plugin_name).exists():
                error_msg = _('Plugin with name %s already exists.') % plugin_name
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # get plugin_download_url from market by plugin_name
            # download plugin zip by plugin_download_url
            seatable_market_url = get_market_url_by_lang()
            seamarket_plugin_api_url = seatable_market_url.rstrip('/') + '/api/plugins/' + plugin_name + '/'
            res = requests.get(seamarket_plugin_api_url)
            download_url = json.loads(res.content).get('download_url', '')

            if not download_url:
                error_msg = 'plugin %s not found.' % plugin_name
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            plugin_zip_file_response = requests.get(download_url)

            os.mkdir('/tmp/plugin_download_from_market')
            tmp_zip_path = '/tmp/plugin_download_from_market/plugin_zip'
            with open(tmp_zip_path, 'wb') as f:
                f.write(plugin_zip_file_response.content)

            # extract zip in TMP_EXTRACTED_PATH
            with ZipFile(tmp_zip_path, 'r') as zip_file:
                folder_path = get_folder_path(zip_file.namelist())
                try:
                    info_json_str = zip_file.read(os.path.join(folder_path, INFO_FILE_NAME))
                    if isinstance(info_json_str, bytes):
                        info_json_str = info_json_str.decode()
                except Exception:
                    error_msg = _('"info.json" not found.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                zip_file.extractall(TMP_EXTRACTED_PATH)

            shutil.rmtree('/tmp/plugin_download_from_market')

            # create file in asset dir, and delete TMP_EXTRACTED_PATH
            # if no plugins path, create it
            # plugin_path = '/asset/' + str(dtable.uuid) + '/plugins/'
            plugin_path = '/' + plugin_name
            plugin_path_id = seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, plugin_path)
            if not plugin_path_id:
                try:
                    seafile_api.mkdir_with_parents(PLUGINS_REPO_ID, '/', plugin_name, username)
                except Exception as e:
                    logger.error(e)
                    error_msg = 'Internal Server Error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            # if asset dir has plugin with same name, we replace old with new
            if seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, plugin_path):
                delete_plugin_asset_folder(PLUGINS_REPO_ID, username, plugin_path)

            # create path and file
            try:
                create_plugin_asset_files(PLUGINS_REPO_ID, username, plugin_name, folder_path)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            # remove extracted tmp file
            shutil.rmtree(TMP_EXTRACTED_PATH)

            # 4. record in database
            try:
                plugin_record = DTableSystemPlugins.objects.create(
                    added_by=username,
                    added_time=datetime.now(),
                    name=plugin_name,
                    info=info_json_str,
                )
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            return Response(plugin_record.to_dict())

        # 1. check params
        plugin_file = request.FILES.get('plugin', None)
        if not plugin_file:
            error_msg = 'plugin invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if plugin_file.size >> 20 > 300:
            error_msg = _('File is too large.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # 2. read info from zip file, and extract zip in TMP_EXTRACTED_PATH
        uploaded_temp_path = plugin_file.temporary_file_path()
        if not is_zipfile(uploaded_temp_path):
            error_msg = _('A zip file is required.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        with ZipFile(uploaded_temp_path, 'r') as zip_file:
            folder_path = get_folder_path(zip_file.namelist())
            try:
                info_json_str = zip_file.read(os.path.join(folder_path, INFO_FILE_NAME))
                if isinstance(info_json_str, bytes):
                    info_json_str = info_json_str.decode()
                info = json.loads(info_json_str)
            except Exception:
                error_msg = _('"info.json" not found.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                zip_file.read(os.path.join(folder_path, MAINJS_FILE_NAME))
            except Exception:
                error_msg = _('"main.js" not found.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            plugin_name = info.get('name', '')
            zip_file.extractall(TMP_EXTRACTED_PATH)

        if DTableSystemPlugins.objects.filter(name=plugin_name).exists():
            shutil.rmtree(TMP_EXTRACTED_PATH)
            error_msg = _('Plugin with name %s already exists.') % plugin_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # 3. create file in asset dir, and delete TMP_EXTRACTED_PATH
        # if no plugins path, create it
        plugin_path = '/' + plugin_name
        plugin_path_id = seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, plugin_path)
        if not plugin_path_id:
            try:
                seafile_api.mkdir_with_parents(PLUGINS_REPO_ID, '/', plugin_name, username)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # if asset dir has plugin with same name, we replace old with new
        if seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, '/' + plugin_name):
            delete_plugin_asset_folder(PLUGINS_REPO_ID, username, '/' + plugin_name)

        # create path and file
        try:
            create_plugin_asset_files(PLUGINS_REPO_ID, username, plugin_name, folder_path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # remove extracted tmp file
        shutil.rmtree(TMP_EXTRACTED_PATH)

        try:
            plugin_record = DTableSystemPlugins.objects.create(
                added_by=username,
                added_time=datetime.now(),
                name=plugin_name,
                info=info_json_str,
            )
        except Exception as e:
            logging.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(plugin_record.to_dict())

class AdminDTableSystemPluginView(APIView):
    authentication_classes = (TokenAuthentication, CsrfExemptSessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, plugin_id):
        """
            update a plugin
        """
        # permission check
        if not request.user.admin_permissions.can_manage_plugin():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        username = request.user.username
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        # 1. check params, perms and resources
        try:
            plugin_record = DTableSystemPlugins.objects.get(pk=plugin_id)
        except DTableSystemPlugins.DoesNotExist:
            error_msg = 'Plugin %s not found.' % plugin_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        from_market = request.data.get('from_market', '').lower()
        if from_market and from_market not in ['true', 'false']:
            error_msg = 'from_market %s invalid.' % from_market
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        old_plugin_path = '/' + plugin_record.name

        plugin_file_dir_id = seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, old_plugin_path)
        if not plugin_file_dir_id:
            error_msg = 'Plugin %s not found.' % plugin_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if from_market == 'true':
            """
            if we update plugin from market
            1. get plugin_download_url from market by plugin_name
            2. download plugin zip by plugin_download_url
            3. extract zip in TMP_EXTRACTED_PATH
            4. delete old asset, create file in asset dir, and delete TMP_EXTRACTED_PATH
            5. update record in database
            """
            plugin_name = request.data.get('plugin_name', '')
            if not plugin_name:
                error_msg = 'plugin_name invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # get plugin_download_url from market by plugin_name
            # download plugin zip by plugin_download_url
            seatable_market_url = get_market_url_by_lang()
            seamarket_plugin_api_url = seatable_market_url.rstrip('/') + '/api/plugins/' + plugin_name + '/'
            res = requests.get(seamarket_plugin_api_url)
            download_url = json.loads(res.content).get('download_url', '')

            if not download_url:
                error_msg = 'plugin %s not found.' % plugin_name
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            plugin_zip_file_response = requests.get(download_url)

            os.mkdir('/tmp/plugin_download_from_market')
            tmp_zip_path = '/tmp/plugin_download_from_market/plugin_zip'
            with open(tmp_zip_path, 'wb') as f:
                f.write(plugin_zip_file_response.content)

            # extract zip in TMP_EXTRACTED_PATH
            with ZipFile(tmp_zip_path, 'r') as zip_file:
                folder_path = get_folder_path(zip_file.namelist())
                try:
                    info_json_str = zip_file.read(os.path.join(folder_path, INFO_FILE_NAME))
                    if isinstance(info_json_str, bytes):
                        info_json_str = info_json_str.decode()
                except Exception:
                    error_msg = _('"info.json" not found.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                zip_file.extractall(TMP_EXTRACTED_PATH)

            shutil.rmtree('/tmp/plugin_download_from_market')

            # delete old asset file
            try:
                delete_plugin_asset_folder(PLUGINS_REPO_ID, username, old_plugin_path)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            # create file in asset dir, and delete TMP_EXTRACTED_PATH
            # if no plugins path, create it
            plugin_path = '/' + plugin_name
            plugin_path_id = seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, plugin_path)
            if not plugin_path_id:
                try:
                    seafile_api.mkdir_with_parents(PLUGINS_REPO_ID, '/', plugin_name, username)
                except Exception as e:
                    logger.error(e)
                    error_msg = 'Internal Server Error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            # if asset dir has plugin with same name, we replace old with new
            if seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, plugin_path):
                delete_plugin_asset_folder(PLUGINS_REPO_ID, username, plugin_path)

            # create path and file
            try:
                create_plugin_asset_files(PLUGINS_REPO_ID, username, plugin_name, folder_path)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            # remove extracted tmp file
            shutil.rmtree(TMP_EXTRACTED_PATH)

            try:
                plugin_record.info = info_json_str
                plugin_record.save()
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            return Response(plugin_record.to_dict())


        plugin_file = request.FILES.get('plugin', None)
        if not plugin_file:
            error_msg = 'plugin invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if plugin_file.size >> 20 > 300:
            error_msg = _('File is too large.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        uploaded_temp_path = plugin_file.temporary_file_path()
        if not is_zipfile(uploaded_temp_path):
            error_msg = _('A zip file is required.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # read from zip
        with ZipFile(uploaded_temp_path, 'r') as zip_file:
            folder_path = get_folder_path(zip_file.namelist())
            try:
                info_json_str = zip_file.read(os.path.join(folder_path, INFO_FILE_NAME))
                if isinstance(info_json_str, bytes):
                    info_json_str = info_json_str.decode()
                info = json.loads(info_json_str)
            except Exception:
                error_msg = _('"info.json" not found.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                zip_file.read(os.path.join(folder_path, MAINJS_FILE_NAME))
            except Exception:
                error_msg = _('"main.js" not found.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            new_plugin_name = info.get('name', '')
            zip_file.extractall(TMP_EXTRACTED_PATH)

        new_plugin_path = '/' + new_plugin_name

        # if new_plugin_name == old plugin name, no need to check name
        if plugin_record.name != new_plugin_name:

            # check if duplicate plugin name within a dtable asset
            if seafile_api.get_dir_id_by_path(PLUGINS_REPO_ID, new_plugin_path):
                error_msg = _('Plugin with name %s already exists.') % new_plugin_name
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # delete old asset file
        try:
            delete_plugin_asset_folder(PLUGINS_REPO_ID, username, old_plugin_path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # create file in asset dir, and delete TMP_EXTRACTED_PATH
        try:
            create_plugin_asset_files(PLUGINS_REPO_ID, username, new_plugin_name, folder_path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        shutil.rmtree(TMP_EXTRACTED_PATH)

        # 4. update record in database
        try:
            plugin_record.name = new_plugin_name
            plugin_record.info = info_json_str
            plugin_record.save()
        except Exception as e:
            logger.error(e)
            return Response(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(plugin_record.to_dict())


    def delete(self, request, plugin_id):
        """
            delete a plugin
        """
        # permission check
        if not request.user.admin_permissions.can_manage_plugin():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        username = request.user.username

        try:
            plugin_record = DTableSystemPlugins.objects.get(pk=plugin_id)

        except DTableSystemPlugins.DoesNotExist:
            error_msg = 'Plugin record %s not found.' % plugin_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            delete_plugin_asset_folder(PLUGINS_REPO_ID, username, '/' + plugin_record.name)
        except Exception as e:
            logger.error(e)

        try:
            plugin_record.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})



class AdminDTableSystemPluginsInstallCountView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        """
            list all plugins installed count for system admin
        """
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25
        start, end = (current_page - 1) * per_page, current_page * per_page

        try:
            plugins_install_count_list = DTablePluginsInstallCount.objects.all()[start: end]
            count = DTablePluginsInstallCount.objects.all().count()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        plugins_install_count_list = [p.to_dict() for p in plugins_install_count_list]

        return Response({'plugins_install_count_list': plugins_install_count_list, 'count': count})

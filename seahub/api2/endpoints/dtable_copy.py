import io
import logging
import json
import os
import re
import shutil
import time
from zipfile import ZipFile, is_zipfile

import requests
from django.contrib.auth.hashers import check_password

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE
from seahub.dtable.constants import FOLDER_ITEM_DTABLE
from seahub.dtable.models import DTables, Workspaces, DTableExternalLinks, FolderItems, Folders, DTableExternalApps
from seahub.dtable.utils import check_dtable_permission, check_dtable_admin_permission, copy_dtable, \
    check_dtable_operation_permission, copy_asset, COPY_TMP_PATH, clear_tmp_files_and_dirs, update_custom_assets, \
    copy_dataset_syncs
from seahub.utils import update_page_design_static_image, \
    rename_universal_app_static_assets_dir, update_universal_app_custom_page_static_image, update_universal_app_single_record_page_static_assets
from seahub.utils.storage_backend import storage_backend
from seaserv import seafile_api


logger = logging.getLogger(__name__)


class DTableCopyView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def _password_check(self, request, dtable):
        if not dtable.is_encrypted():
            return True

        password = request.data.get('password')
        if check_password(password, dtable.password):
            return True

        return False

    def post(self, request):
        # role permission check
        username = request.user.username
        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        try:
            src_workspace_id = int(request.data.get('src_workspace_id'))
            dst_workspace_id = int(request.data.get('dst_workspace_id'))
        except:
            error_msg = 'src_workspace_id or dst_workspace_id is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        name = request.data.get('name')
        if not name:
            error_msg = 'name is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            is_copy_dataset_syncs = to_python_boolean(request.data.get('is_copy_dataset_syncs', 'false'))
        except:
            is_copy_dataset_syncs = False

        # resource check
        src_workspace = Workspaces.objects.get_workspace_by_id(src_workspace_id)
        if not src_workspace:
            error_msg = 'workspace: %s not found' % src_workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        src_dtable = DTables.objects.get_dtable(src_workspace, name)
        if not src_dtable:
            error_msg = 'dtable: %s not found' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        password_check = self._password_check(request, src_dtable)
        if not password_check:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        op_permission, error = check_dtable_operation_permission(username, src_workspace, src_dtable)
        if error:
            error_msg = error
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not op_permission.get('can_copy'):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)


        dst_workspace = Workspaces.objects.get_workspace_by_id(dst_workspace_id)
        if not dst_workspace_id:
            error_msg = 'workspace: %s not found' % dst_workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        # must be dist workspace's owner or admin
        username = request.user.username
        if check_dtable_permission(username, src_workspace, src_dtable) not in (PERMISSION_READ_WRITE, PERMISSION_READ) or \
            not check_dtable_admin_permission(username, dst_workspace.owner):
            error_msg = 'Permission denied'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        name = DTables.objects.get_non_duplicated_name(name, dst_workspace.id)

        # create dtable
        # 1. copy dtable content
        dst_dtable, error_msg = copy_dtable(src_workspace, src_dtable, dst_workspace, name, username, request, include_assets=False)
        if error_msg:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # 2. copy common-dataset-syncs
        syncs = {'success': [], 'failed': []}
        if '@seafile_group' not in src_workspace.owner or '@seafile_group' not in dst_workspace.owner:
            is_copy_dataset_syncs = False
        if is_copy_dataset_syncs:
            try:
                syncs = copy_dataset_syncs(src_dtable, dst_dtable, username)
            except Exception as e:
                logger.exception('copy dtable: %s syncs error: %s', src_dtable, e)

        # 3. copy assets
        try:
            res = copy_asset(src_workspace.repo_id, src_dtable.uuid, dst_workspace.repo_id, dst_dtable.uuid, username, sync_copy=False)
            if res:
                task_id = res.task_id
            else:
                task_id = None
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'dtable': dst_dtable.to_dict(), 'task_id': task_id, 'common_dataset_syncs': syncs})

class DTableCopyStatusView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        Get copy asset task status by task id
        :param request:
        :return:
        """
        task_id = request.GET.get('task_id', '')
        if not task_id:
            return Response({'successful': True, 'total': 0, 'done': 0})

        task_result = seafile_api.get_copy_task(task_id)
        return Response({
            'total': task_result and task_result.total or 0,
            'done': task_result and task_result.done or 0,
            'canceled': task_result and task_result.canceled or '',
            'failed': task_result and task_result.failed or '',
            'failed_reason': task_result and task_result.failed_reason or '',
            'successful': task_result and task_result.successful or False
        })

class DTableDoTaskAfterCopyView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        """
        Deal something after the assets have been copied, such as page design, custom assets
        :param request:
        :return:
        """
        dst_dtable_uuid = request.data.get('dst_dtable_uuid')
        username = request.user.username
        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid)
        if not dst_dtable:
            err_msg = "dtable: %s not found" % dst_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        if not check_dtable_admin_permission(username, dst_dtable.workspace.owner):
            error_msg = 'Permission denied'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_content = storage_backend.get_dtable(dst_dtable)
        if dtable_content:

            # page design plugin static img URL
            plugin_settings = dtable_content.get('plugin_settings', {})
            page_design_settings = plugin_settings and plugin_settings.get('page-design', []) or []
            page_design_content_json_tmp_path = os.path.join(COPY_TMP_PATH, str(dst_dtable.uuid), 'page-design')
            update_page_design_static_image(
                page_design_settings,
                dst_dtable.workspace.repo_id,
                dst_dtable.workspace_id,
                str(dst_dtable.uuid),
                page_design_content_json_tmp_path,
                username
            )

            # universal app: custom page static image URL
            universal_apps = list(DTableExternalApps.objects.get_external_apps_by_dtable_uuid(dst_dtable.uuid.hex))
            for app in universal_apps:
                if app.app_type == 'universal-app':
                    app_id = app.id
                    app_config = json.loads(app.app_config)
                    settings = app_config.get('settings', {})
                    pages = settings.get('pages', [])
                    universal_app_page_content_json_tmp_path = os.path.join(COPY_TMP_PATH, str(dst_dtable.uuid), 'external-apps')
                    rename_universal_app_static_assets_dir(pages, app_id, dst_dtable.workspace.repo_id, str(dst_dtable.uuid), username)
                    update_universal_app_custom_page_static_image(pages, app_id, dst_dtable.workspace.repo_id, dst_dtable.workspace_id,
                            str(dst_dtable.uuid), universal_app_page_content_json_tmp_path, username)
                    update_universal_app_single_record_page_static_assets(pages, app_id, dst_dtable.workspace.repo_id, dst_dtable.workspace_id,
                            str(dst_dtable.uuid), universal_app_page_content_json_tmp_path, username)
                    for page in pages:
                        page_type = page.get('type', '')
                        page_id = page.get('id', '')
                        if page_type == 'custom_page' or page_type == 'single_record_page':
                            page['content_url'] = '/%s/%s/%s.json' % (app_id, page_id, page_id)

                    app.app_config = json.dumps(app_config)
                    app.save()

            # update custom-assets
            try:
                update_custom_assets(dtable_content, dst_dtable, username)
            except Exception as e:
                logger.exception('update dtable: %s custom assets error: %s', dst_dtable_uuid, e)

            clear_tmp_files_and_dirs(str(dst_dtable.uuid))

        return Response({'success': True})

class DTableExternalLinkCopyView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def _check_link(self, link):
        # checkout token
        re_link = r'dtable/external-links/([0-9a-zA-Z]+)/$'
        matches = re.findall(re_link, link)
        if not matches:
            error_msg = 'link is invalid.'
            return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        token = matches[0]
        # verify link
        try:
            resp = requests.get(link)
            if resp.status_code != 200:
                error_msg = 'link is invalid.'
                return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except:
            error_msg = 'link is invalid'
            return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        return token, None

    def post(self, request):
        # role permission check
        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # arguments check
        link = request.data.get('link')
        if not link:
            error_msg = 'link invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        dst_workspace_id = request.data.get('dst_workspace_id')
        if not dst_workspace_id:
            error_msg = 'dst_workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        folder_id = request.data.get('folder_id')

        try:
            dst_workspace_id = int(dst_workspace_id)
            if folder_id:
                folder_id = int(folder_id)
        except ValueError:
            error_msg = 'dst_workspace_id or folder_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # check link
        token, error = self._check_link(link)
        if error:
            return error

        # resource check
        dtable_external_link = DTableExternalLinks.objects.filter(token=token).select_related('dtable', 'dtable__workspace').first()
        if not dtable_external_link:
            error_msg = 'link %s not found.' % (link,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        if dtable_external_link.dtable.deleted:
            error_msg = 'link %s not found.' % (link,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        if folder_id and not Folders.objects.filter(workspace_id=dst_workspace_id, id=folder_id).exists():
            return api_error(status.HTTP_404_NOT_FOUND, 'Folder not found.')

        username = request.user.username

        # self workspace check
        dst_workspace = Workspaces.objects.filter(id=dst_workspace_id).first()
        if not dst_workspace:
            error_msg = 'workspace %s not found.' % (dst_workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        if not check_dtable_admin_permission(username, dst_workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        name = DTables.objects.get_non_duplicated_name(dtable_external_link.dtable.name, dst_workspace.id)

        # copy
        dst_dtable, error_msg = copy_dtable(dtable_external_link.dtable.workspace, dtable_external_link.dtable, dst_workspace,
                                        name, username, request)
        if folder_id:
            FolderItems.objects.create(folder_id=folder_id, item_type=FOLDER_ITEM_DTABLE, item_id=dst_dtable.uuid.hex)
        if error_msg:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'dtable': dst_dtable.to_dict()})


class DTableCopyPreCDSsCheckView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        username = request.user.username
        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        try:
            src_workspace_id = int(request.data.get('src_workspace_id'))
            dst_workspace_id = int(request.data.get('dst_workspace_id'))
        except:
            error_msg = 'src_workspace_id or dst_workspace_id is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        name = request.data.get('name')
        if not name:
            error_msg = 'name is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        src_workspace = Workspaces.objects.get_workspace_by_id(src_workspace_id)
        if not src_workspace:
            error_msg = 'workspace: %s not found' % src_workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        src_dtable = DTables.objects.get_dtable(src_workspace, name)
        if not src_dtable:
            error_msg = 'dtable: %s not found' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dst_workspace = Workspaces.objects.get_workspace_by_id(dst_workspace_id)
        if not dst_workspace:
            error_msg = 'workspace: %s not found' % dst_workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, src_workspace, src_dtable) not in (PERMISSION_READ_WRITE, PERMISSION_READ) or \
            not check_dtable_admin_permission(username, dst_workspace.owner):
            error_msg = 'Permission denied'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        syncs = {'success': [], 'failed': []}
        is_copy_dataset_syncs = True
        if '@seafile_group' not in src_workspace.owner or '@seafile_group' not in dst_workspace.owner:
            is_copy_dataset_syncs = False
        if is_copy_dataset_syncs:
            syncs = copy_dataset_syncs(src_dtable, None, username, dry_run=True, dst_workspace=dst_workspace)

        return Response({'common_dataset_syncs_check': syncs})

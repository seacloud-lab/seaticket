# -*- coding: utf-8 -*-

import os
import json
import logging
import time
from io import BytesIO
from datetime import datetime

import requests
from PIL import Image
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _
from urllib.parse import quote
from django.db.utils import OperationalError, IntegrityError
from django.conf import settings

from pysearpc import SearpcError
from seaserv import seafile_api, ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.status import HTTP_443_ABOVE_QUOTA
from seahub.api2.throttling import UserRateThrottle, RepairBaseRateThrottle
from seahub.api2.utils import api_error, get_user_common_info
from seahub.api2.permissions import CanUseAdvancedPerms
from seahub.dtable.models import Workspaces, DTables, DTableRowShares, UserStarredDTables, DTableViewUserShare, \
    DTableViewGroupShare, DTableShare, DTableGroupShare, IdInOrgTuple, Folders, FolderItems, DTableAPIToken, \
    DTableGroupOrders, UserShareFolders, DTableSharePermission
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.signals import move_dtable_to_trash, restore_dtable_from_trash
from seahub.group.utils import group_id_to_name, is_group_member, get_user_admin_group_ids
from seahub.utils import is_valid_dirent_name, is_org_context, \
    check_filename_with_rename, gen_file_upload_url, gen_file_get_url, \
    DTABLE_EVENTS_ENABLED, events_redis_connection, get_file_type_and_ext, file_types, \
    get_inner_fileserver_root, gen_inner_file_get_url, get_inner_dtable_server_url
from seahub.settings import MAX_UPLOAD_FILE_NAME_LEN, DTABLE_SERVER_URL, \
    DTABLE_SOCKET_URL, USE_INNER_FILESERVER_FOR_DTABLE_SERVER, INIT_BASE_CONF, DTABLE_WEB_SERVICE_URL, \
    DTABLE_DB_URL, ENABLE_BIND_PHONE, \
    CAN_REMOVE_BASE_PASSWORD_VIA_PHONE, DISABLE_ADDING_PERSONAL_BASES
from seahub.dtable.utils import clean_org_storage_size_cache, convert_page_design_to_pdf, copy_dtable, create_repo_and_workspace, check_dtable_permission, get_user_admin_dtables, is_valid_jwt, \
    list_dtable_related_users, UPLOAD_IMG_RELATIVE_PATH, UPLOAD_FILE_RELATIVE_PATH, UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH, convert_dtable_trash_names, \
    check_dtable_admin_permission, check_quota_by_workspace, check_row_limit_by_workspace, \
    check_quota_and_row_limit_by_workspace, has_collection_table_permission, COLLECTION_TABLE_RELATIVE_PATH, \
    has_dtable_asset_upload_permission, restore_trash_dtable_names, check_base_limit, \
    query_dtable_io_status, restore_trash_dtable_names
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.constants import PERMISSION_ADMIN, PERMISSION_READ_WRITE, PASSWORD_ADD, PASSWORD_UNSET, PASSWORD_MODIFY, PASSWORD_UNSET_BY_PHONE
from seahub.thumbnail.utils import remove_thumbnail_by_id
from seahub.dtable.constants import FOLDER_ITEM_DTABLE
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster
from seahub.utils.storage_backend import storage_backend
from pypinyin import lazy_pinyin
from seahub.utils.verify import verify_sms_code
from seahub.profile.models import Profile
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.utils.dtable_storage_server_api import storage_api
from seahub.department_v2.utils import get_department_v2_groups_by_user
from seahub.audit_log.models import GROUP_BASE_CREATE, GROUP_BASE_RENAME, GROUP_BASE_DELETE, BASE_CREATE, BASE_RENAME, BASE_DELETE, BASE_RESTORE
from seahub.audit_log.signals import audit_operation

logger = logging.getLogger(__name__)


FILE_TYPE = '.dtable'
GROUP_DOMAIN = '@seafile_group'
WRITE_PERMISSION_TUPLE = (PERMISSION_READ_WRITE, PERMISSION_ADMIN)
BASE_PASSWORD_OPERATIONS = [
    PASSWORD_ADD,
    PASSWORD_MODIFY,
    PASSWORD_UNSET,
    PASSWORD_UNSET_BY_PHONE,
]


def add_template_bases(request, private_workspace, username):
    if ('TEMPLATES_WORKSPACE_ID' not in INIT_BASE_CONF) or ('BASES' not in INIT_BASE_CONF):
        return

    if not INIT_BASE_CONF['BASES']:
        return

    if DISABLE_ADDING_PERSONAL_BASES:
        return

    src_workspace_id = INIT_BASE_CONF['TEMPLATES_WORKSPACE_ID']
    src_workspace = Workspaces.objects.filter(pk=src_workspace_id).first()
    if not src_workspace:
        return

    for base_name in INIT_BASE_CONF['BASES']:
        src_dtable = DTables.objects.get_dtable(src_workspace, base_name, deleted=False)
        if not src_dtable:
            continue
        copy_dtable(src_workspace, src_dtable, private_workspace, base_name, username, request)


class WorkspacesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """get all workspaces
        """
        detail = request.GET.get('detail', 'true')
        if detail not in ('true', 'false'):
            error_msg = 'detail invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        if org_id > 0:
            groups = ccnet_api.get_org_groups_by_user(org_id, username, return_ancestors=True)
        else:
            groups = ccnet_api.get_groups(username, return_ancestors=True)

        group_id_list = [group.id for group in groups]

        # department v2 groups
        if settings.ENABLE_ADDRESSBOOK_V2:
            department_v2_groups = get_department_v2_groups_by_user(username).select_related('department')
            department_v2_group_id_list = []
            department_v2_group_id_dict = {}
            for item in department_v2_groups:
                department_v2_group_id_list.append(item.group_id)
                department_v2_group_id_dict[item.group_id] = item
        else:
            department_v2_groups = []
            department_v2_group_id_list = []
            department_v2_group_id_dict = {}

        group_id_list += department_v2_group_id_list

        admin_group_ids = get_user_admin_group_ids(username)

        group_orders = DTableGroupOrders.objects.filter(username=username).first()
        if not group_orders:
            try:
                DTableGroupOrders.objects.create(
                    username=username,
                    detail=json.dumps({'group_ids': group_id_list})
                )
            except Exception as e:
                logger.warning("group order create warning: %s" % e)
                pass
        else:
            group_id_list = group_orders.flush(group_id_list)

        owner_list = [username] + ['%s@seafile_group' % group_id for group_id in group_id_list]

        try:
            workspaces = Workspaces.objects.filter(owner__in=owner_list)
            if not workspaces.filter(owner=username).exists() and detail == 'true':
                workspaces = list(workspaces)
                workspace = create_repo_and_workspace(username, org_id)
                workspaces.extend([workspace])
                if org_id == -1:
                    add_template_bases(request, private_workspace=workspace, username=username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        workspace_list = list()
        if detail == 'false':
            workspace_list.append(dict(id='', name='starred', type='starred'))
            workspace_list.append(dict(id='', name='shared', type='shared'))
            workspace_list_for_group = []
            for workspace in workspaces:
                owner = workspace.owner
                res = dict(id=workspace.id)
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    res['name'] = group_id_to_name(group_id)
                    res['type'] = 'group'
                    res['group_id'] = group_id
                    if group_id not in department_v2_group_id_dict:
                        res['group_owner'] = [g.creator_name for g in groups if g.id == group_id][0]
                    else:
                        res['department_id'] = department_v2_group_id_dict[group_id].department_id
                        res['group_owner'] = 'system admin'  # department-v2-group's owner always be 'system admin'
                    res['is_admin'] = group_id in admin_group_ids
                    workspace_list_for_group.append(res)
                else:
                    res['name'] = 'personal'
                    res['type'] = 'personal'
                    workspace_list.append(res)

            workspace_list_for_group = sorted(workspace_list_for_group, key=lambda x: group_id_list.index(x.get('group_id')))
            workspace_list.extend(workspace_list_for_group)

            return Response({'workspace_list': workspace_list}, status=status.HTTP_200_OK)

        try:
            dtable_list = DTables.objects.filter(workspace__in=workspaces, deleted=False).select_related()
            starred_table_uuid_set = set(UserStarredDTables.objects.get_dtable_uuids_by_email(username))

            shared_tables_by_user = DTableShare.objects.filter(
                to_user=username, dtable__deleted=False, share_folder__isnull=True).select_related('dtable')
            shared_views_by_user = DTableViewUserShare.objects.filter(
                to_user=username, dtable__deleted=False, share_folder__isnull=True).select_related('dtable')

            group_shared_table_list = list(DTableGroupShare.objects.filter(
                group_id__in=group_id_list, dtable__deleted=False).select_related('dtable', 'dtable__workspace'))
            group_shared_view_list = list(DTableViewGroupShare.objects.filter(
                to_group_id__in=group_id_list, dtable__deleted=False).select_related('dtable', 'dtable__workspace'))

            # folders and folder-items
            folders = list(Folders.objects.filter(workspace_id__in=[w.id for w in workspaces]))
            folder_items = list(FolderItems.objects.filter(folder_id__in=[f.id for f in folders]))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        starred_table_uuid_list = set()
        starred_table_list = list()
        shared_table_list = list()
        shared_view_list = list()

        # group and personal tables
        workspace_id2table_list = {}
        for table in dtable_list:
            table_info = table.to_dict()
            if table.workspace.id in workspace_id2table_list:
                workspace_id2table_list[table.workspace.id].append(table_info)
            else:
                workspace_id2table_list[table.workspace.id] = [table_info]
            if table.uuid.hex in starred_table_uuid_set:
                table_info['starred'] = True
                if table.uuid.hex not in starred_table_uuid_list:
                    starred_table_uuid_list.add(table.uuid.hex)
                    starred_table_list.append(table_info)
            else:
                table_info['starred'] = False

        # shared tables
        for table in shared_tables_by_user:
            dtable_info = table.dtable.to_dict()
            dtable_info['share_id'] = table.id
            dtable_info['share_type'] = 'dtable-share'
            if table.dtable.uuid.hex in starred_table_uuid_set:
                dtable_info['starred'] = True
                if table.dtable.uuid.hex not in starred_table_uuid_list:
                    starred_table_uuid_list.add(table.dtable.uuid.hex)
                    starred_table_list.append(dtable_info)
            else:
                dtable_info['starred'] = False
            dtable_info['from_user'] = table.from_user
            dtable_info['permission'] = table.permission
            avatar_url, is_default, date_uploaded = api_avatar_url(table.from_user)
            dtable_info['from_user_avatar'] = avatar_url
            if '@seafile_group' in table.from_user:
                group_id = table.from_user.split('@')[0]
                dtable_info['from_user_name'] = group_id_to_name(group_id)
            else:
                dtable_info['from_user_name'] = email2nickname(table.from_user)
            shared_table_list.append(dtable_info)

        # shared views
        for view in shared_views_by_user:
            view_info = view.to_dict()
            avatar_url, is_default, date_uploaded = api_avatar_url(view_info['from_user'])
            view_info['from_user_name'] = email2nickname(view.from_user)
            view_info['to_user_name'] = email2nickname(view.to_user)
            view_info['from_user_avatar'] = avatar_url
            view_info['workspace_id'] = view.dtable.workspace.id
            view_info['color'] = view.dtable.color
            view_info['text_color'] = view.dtable.text_color
            view_info['icon'] = view.dtable.icon
            view_info['share_id'] = view.id
            view_info['share_type'] = 'view-share'
            shared_view_list.append(view_info)

        # shared to group tables
        group_shared_dtables = {}
        for table in group_shared_table_list:
            table_info = table.dtable.to_dict()
            table_info['dtable_share_id'] = table.id
            table_info['permission'] = table.permission
            from_owner = table.dtable.workspace.owner
            avatar_url, is_default, date_uploaded = api_avatar_url(from_owner)
            if '@seafile_group' in from_owner:
                group_id = int(from_owner.split('@')[0])
                table_info['from_group_id'] = group_id
                table_info['from_group_name'] = group_id_to_name(group_id)
                table_info['from_group_avatar'] = avatar_url
                table_info['from_user'] = from_owner
            else:
                table_info['from_user_name'] = email2nickname(from_owner)
                table_info['from_user_avatar'] = avatar_url
                table_info['from_user'] = from_owner
            if table.group_id in group_shared_dtables:
                group_shared_dtables[table.group_id].append(table_info)
            else:
                group_shared_dtables[table.group_id] = [table_info]
            if table.dtable.uuid.hex in starred_table_uuid_set:
                table_info['starred'] = True
                if table.dtable.uuid.hex not in starred_table_uuid_list:
                    starred_table_uuid_list.add(table.dtable.uuid.hex)
                    starred_table_list.append(table_info)
            else:
                table_info['starred'] = False

        # shared to group views
        group_shared_views = {}
        for view in group_shared_view_list:
            view_info = view.dtable.to_dict()
            view_info['view_share_id'] = view.id
            view_info['shared_name'] = view.shared_name
            from_owner = view.dtable.workspace.owner
            avatar_url, is_default, date_uploaded = api_avatar_url(from_owner)
            if '@seafile_group' in from_owner:
                group_id = int(from_owner.split('@')[0])
                view_info['from_group_id'] = group_id
                view_info['from_group_name'] = group_id_to_name(group_id)
                view_info['from_group_avatar'] = avatar_url
                view_info['from_user'] = from_owner
            else:
                view_info['from_user_name'] = email2nickname(from_owner)
                view_info['from_user_avatar'] = avatar_url
                view_info['from_user'] = from_owner
            if view.to_group_id in group_shared_views:
                group_shared_views[view.to_group_id].append(view_info)
            else:
                group_shared_views[view.to_group_id] = [view_info]

        starred_tables = dict(id='', name='starred', type='starred')
        starred_tables['table_list'] = starred_table_list
        workspace_list.append(starred_tables)

        shared_tables = dict(id='', name='shared', type='shared')
        share_folders = UserShareFolders.objects.filter(username=username)

        shared_tables['shared_table_list'] = shared_table_list
        shared_tables['shared_view_list'] = shared_view_list
        shared_tables['share_folders'] = [sf.to_dict() for sf in share_folders]
        workspace_list.append(shared_tables)

        # handle folders and folder-items
        folder_items_dict = {}
        for item in folder_items:
            if item.folder_id not in folder_items_dict:
                folder_items_dict[item.folder_id] = [item]
            else:
                folder_items_dict[item.folder_id].append(item)
        workspace_folders_dict = {}
        for folder in folders:
            folder_info = folder.to_dict()
            items = folder_items_dict.get(folder.id, [])

            folder_info.update({'items': [i.to_dict() for i in items]})
            if folder.workspace_id not in workspace_folders_dict:
                workspace_folders_dict[folder.workspace_id] = [folder_info]
            else:
                workspace_folders_dict[folder.workspace_id].append(folder_info)

        workspace_list_for_group =[]
        for workspace in workspaces:
            owner = workspace.owner
            res = dict(id=workspace.id)
            if '@seafile_group' in owner:
                group_id = int(owner.split('@')[0])
                res['name'] = group_id_to_name(group_id)
                res['type'] = 'group'
                res['group_id'] = group_id
                if group_id not in department_v2_group_id_dict:
                    res['group_owner'] = [g.creator_name for g in groups if g.id == group_id][0]
                else:
                    res['department_id'] = department_v2_group_id_dict[group_id].department_id
                    res['group_owner'] = 'system admin'  # department-v2-group's owner always be 'system admin'
                res['is_admin'] = group_id in admin_group_ids
                res['table_list'] = workspace_id2table_list.get(workspace.id, [])
                res['group_shared_dtables'] = group_shared_dtables.get(group_id, [])
                res['group_shared_views'] = group_shared_views.get(group_id, [])
                res['folders'] = workspace_folders_dict.get(workspace.id, [])
                workspace_list_for_group.append(res)
            else:
                res['name'] = 'personal'
                res['type'] = 'personal'
                res['table_list'] = workspace_id2table_list.get(workspace.id, [])
                res['folders'] = workspace_folders_dict.get(workspace.id, [])
                workspace_list.append(res)
        workspace_list_for_group = sorted(workspace_list_for_group, key=lambda x: group_id_list.index(x.get('group_id')))
        workspace_list.extend(workspace_list_for_group)

        if DTABLE_EVENTS_ENABLED:
            timestamp = datetime.utcnow().strftime('%Y-%m-%d 00:00:00')
            message = {
                'username': username, 'timestamp': timestamp, 'org_id': org_id
            }

            try:
                events_redis_connection.publish('user-activity-statistic', json.dumps(message))
            except Exception as e:
                logger.error("Failed to publish message: %s " % e)
            finally:
                events_redis_connection.close()
        return Response({'workspace_list': workspace_list}, status=status.HTTP_200_OK)


class DTablesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request):
        """create a table file

        Permission:
        1. owner
        2. group admin
        """
        # role permission check
        if not request.user.permissions.can_add_dtable():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        table_owner = request.POST.get('owner')
        workspace_id = request.POST.get('workspace_id')
        folder_id = request.POST.get('folder_id')

        table_name = request.POST.get('name')
        if not table_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_file_name = table_name + FILE_TYPE
        if not is_valid_dirent_name(table_file_name):
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # color text-color icon
        color = request.data.get('color')
        text_color = request.data.get('text_color')
        icon = request.data.get('icon')
        password = request.data.get('password', None)

        # resource check
        workspace = None
        if table_owner:
            workspace = Workspaces.objects.get_workspace_by_owner(table_owner)
            if not workspace:
                org_id = -1
                if is_org_context(request):
                    org_id = request.user.org.org_id
                try:
                    workspace = create_repo_and_workspace(table_owner, org_id)
                except Exception as e:
                    logger.error(e)
                    error_msg = 'Internal Server Error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        elif workspace_id:
            workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
            if not workspace:
                error_msg = 'Workspace not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        else:
            workspace = Workspaces.objects.get_workspace_by_owner(request.user.username)

        existed_dtables = DTables.objects.filter(workspace=workspace, name=table_name)
        if len(existed_dtables) > 0:
            error_msg = _('Base %s already exists in this workspace.') % table_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        folder = None
        if folder_id:
            folder = Folders.objects.filter(id=folder_id).first()
            if not folder or folder.workspace_id != workspace.id:
                error_msg = 'Folder not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_base_limit(workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # repo status check
        repo_status = repo.status
        if repo_status != 0:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            if password:
                password = make_password(password)
            dtable = DTables.objects.create_dtable(username, workspace, table_name, color=color, text_color=text_color, icon=icon, password=password)
            if GROUP_DOMAIN == workspace.owner[ - len(GROUP_DOMAIN) : ] :
                group_id = int(workspace.owner[ : - len(GROUP_DOMAIN)])
                group = ccnet_api.get_group(int(group_id))
                audit_operation.send(None, username=username, operation=GROUP_BASE_CREATE, detail={
                    'id': group_id,
                    'name': group.group_name,
                    'dtable_name': table_name,
                    'dtable_uuid': str(dtable.uuid)
                }, org_id=workspace.org_id)
            else:
                audit_operation.send(None, username=username, operation=BASE_CREATE, detail={
                    'name': table_name
                }, org_id=workspace.org_id)
            if folder:
                FolderItems.objects.create(folder_id=folder.id, item_type=FOLDER_ITEM_DTABLE, item_id=dtable.uuid.hex)
        except OperationalError:
            error_msg = _('Base name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except IntegrityError:
            error_msg = _('Base %s already exists in this workspace.') % table_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # create new empty table
        try:
            storage_backend.create_empty_dtable(dtable, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"table": dtable.to_dict()}, status=status.HTTP_201_CREATED)


class DTableView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, workspace_id):
        """rename a table

        Permission:
        1. owner
        2. group adminn
        """
        # argument check
        # name
        table_name = request.data.get('name')
        if not table_name:
            error_msg = _('Base name is invalid')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_table_name = request.data.get('new_name')

        if new_table_name:
            new_table_file_name = new_table_name + FILE_TYPE
            if not is_valid_dirent_name(new_table_file_name):
                error_msg = _('New base name is invalid')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if len(new_table_file_name) > MAX_UPLOAD_FILE_NAME_LEN:
                error_msg = _('New base name is too long')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # color text-color icon
        color = request.data.get('color')
        text_color = request.data.get('text_color')
        icon = request.data.get('icon')
        password = request.data.get('password')

        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id


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
            error_msg = _('Base %s not found.') % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if DTables.objects.filter(workspace_id=workspace_id, name=new_table_name).exclude(pk=dtable.pk).exists():
            error_msg = _('%s exists.') % (new_table_name,)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # real logic code
        if new_table_name:
            checked_table_file_name = check_filename_with_rename(repo_id, '/', new_table_file_name)
            if new_table_file_name != checked_table_file_name:
                error_msg = '%s file exists.' % (new_table_name,)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # repo status check
            repo_status = repo.status
            if repo_status != 0:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            # rename table
            old_table_file_name = table_name + FILE_TYPE
            try:
                storage_backend.rename_dtable(dtable, old_table_file_name, new_table_file_name, username)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            if new_table_name:
                dtable.name = new_table_name
            if color:
                dtable.color = color
            if text_color:
                dtable.text_color = text_color
            if icon:
                dtable.icon = icon
            dtable.modifier = username
            dtable.save()
            if GROUP_DOMAIN in workspace.owner[-len(GROUP_DOMAIN) : ] :
                group_id = int(workspace.owner[ : - len(GROUP_DOMAIN)])
                group = ccnet_api.get_group(int(group_id))
                audit_operation.send(None, username=username, operation=GROUP_BASE_RENAME, detail={
                    'id': group_id,
                    'name': group.group_name,
                    'old_dtable_name': table_name,
                    'new_dtable_name': new_table_name,
                    'dtable_uuid': str(dtable.uuid)
                }, org_id=workspace.org_id)
            else:
                audit_operation.send(None, username=username, operation=BASE_RENAME, detail={
                    'old_name': table_name,
                    'new_name': new_table_name
                }, org_id=workspace.org_id)
        except OperationalError:
            error_msg = _('Base name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            if new_table_name:  # rename back
                try:
                    storage_backend.rename_dtable(dtable, new_table_file_name, old_table_file_name, username)
                except Exception as e:
                    logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"table": dtable.to_dict()}, status=status.HTTP_200_OK)

    def delete(self, request, workspace_id):
        """delete a table

        Permission:
        1. owner
        2. group admin
        """
        # argument check
        table_name = request.data.get('name')
        if not table_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        table_file_name = table_name + FILE_TYPE

        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

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
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # repo status check
        repo_status = repo.status
        if repo_status != 0:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # rename .dtable file
        new_dtable_name, old_dtable_file_name, new_dtable_file_name = convert_dtable_trash_names(dtable)

        # if has .dtable file, then rename, else skip
        try:
            storage_backend.rename_dtable(dtable, old_dtable_file_name, new_dtable_file_name, username)
        except Exception as e:
            logger.error('delete dtable file: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            DTables.objects.filter(id=dtable.id).update(deleted=True,
                                                        delete_time=datetime.now(),
                                                        name=new_dtable_name)
            move_dtable_to_trash.send(None, dtable_uuid=dtable.uuid.hex)
            if GROUP_DOMAIN == workspace.owner[ - len(GROUP_DOMAIN) : ] :
                group_id = int(workspace.owner[ : - len(GROUP_DOMAIN)])
                group = ccnet_api.get_group(int(group_id))
                audit_operation.send(None, username=username, operation=GROUP_BASE_DELETE, detail={
                    'id': group_id,
                    'name': group.group_name,
                    'dtable_name': table_name,
                    'dtable_uuid': str(dtable.uuid)
                }, org_id=workspace.org_id)
            else:
                audit_operation.send(None, username=username, operation=BASE_DELETE, detail={
                    'name': table_name,
                    'dtable_uuid': str(dtable.uuid)
                }, org_id=workspace.org_id)
        except Exception as e:
            logger.error('delete dtable: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)

class DTableSizeView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, dtable_uuid):
        """get size of a dtable
        """

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'dtable %s not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        result = storage_api.get_dtable_size(dtable_uuid)
        if not result:
            logger.error('get dtable: %s size error', dtable.id)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'result': result})

class DTableRepairView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (RepairBaseRateThrottle, )

    def put(self, request, dtable_uuid):
        """get size (MB) of a dtable
        """

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'dtable %s not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dtable_server_api = DTableServerAPI(request.user.username, dtable_uuid, get_inner_dtable_server_url())
            result = dtable_server_api.repair_base()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(result)

class DTablePasswordView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def _clean_password_in_session(self, request, dtable):
        base_access_key = 'base_access_' + dtable.uuid.hex
        password_in_session = request.session.get(base_access_key)
        if password_in_session:
            del request.session[base_access_key]

    def put(self, request, workspace_id, name):
        table_name = name

        password_operation = request.data.get('operation', '')
        if not password_operation in BASE_PASSWORD_OPERATIONS:
            error_msg = 'Options %s is invalid' % password_operation
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = _('Base %s not found.') % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # add password to null-encrypted base
        if password_operation == PASSWORD_ADD:
            if ENABLE_BIND_PHONE and CAN_REMOVE_BASE_PASSWORD_VIA_PHONE:
                profile = Profile.objects.get_profile_by_user(request.user.username)
                phone = profile.phone

                if not phone:
                    error_msg = 'Phone has not been bound'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if dtable.is_encrypted():
                error_msg = _('Password already exists')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            password = request.data.get('password', None)
            if not password:
                error_msg = _('Password is invalid')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                password = make_password(password)
                dtable.password = password
                dtable.save()
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # cancel the encrypted-base password, which should be verified
        if password_operation == PASSWORD_UNSET:
            if not dtable.is_encrypted():
                error_msg = 'Base is not password protected'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            old_password = request.data.get('password', None)
            try:
                if check_password(old_password, dtable.password):
                    dtable.password = None
                    dtable.save()
                    self._clean_password_in_session(request, dtable)
                else:
                    error_msg = _('Password is incorrect')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # cancel the encrypted-base password, which should be verified by phone code
        if password_operation == PASSWORD_UNSET_BY_PHONE:
            if not dtable.is_encrypted():
                error_msg = 'Base is not password protected'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            code = request.data.get('code', None)
            if not code:
                error_msg = 'code invalid'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            profile = Profile.objects.get_profile_by_user(request.user.username)
            phone = profile.phone

            if not phone:
                error_msg = 'Phone has not been bound'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # # verify code
            if not verify_sms_code(phone, 'dtable_unset_password', code):
                error_msg = 'Code incorrect'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                dtable.password = None
                dtable.save()
                self._clean_password_in_session(request, dtable)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # modify the encrypted-base password, need old password and new password
        if password_operation == PASSWORD_MODIFY:
            if not dtable.is_encrypted():
                error_msg = 'Base is not password protected'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            old_password = request.data.get('password', None)
            new_password = request.data.get('new_password', None)
            if not (old_password and new_password):
                error_msg = _('Password and new password cannot be empty')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                if not check_password(old_password, dtable.password):
                    error_msg = _('Old password is incorrect')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                new_password = make_password(new_password)
                dtable.password = new_password
                dtable.save()
                self._clean_password_in_session(request, dtable)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"table": dtable.to_dict()}, status=status.HTTP_200_OK)

class DTableAssetUploadLinkView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id):
        """get table file upload link

        Permission:
        1. owner
        2. group member
        3. shared user with `rw` or `admin` permission
        """
        # argument check
        table_name = request.GET.get('name', None)
        if not table_name:
            error_msg = 'name invalid.'
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
        is_collection_table = False
        if not has_dtable_asset_upload_permission(request, workspace, dtable):
            if has_collection_table_permission(request, dtable.uuid.hex):
                is_collection_table = True
            else:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # quota check
        if not check_quota_by_workspace(workspace):
            error_msg = 'Asset quota exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)
        # rows check
        if not check_row_limit_by_workspace(workspace):
            error_msg = 'Rows exceeded'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        # create asset dir
        asset_dir_path = os.path.join('/asset', str(dtable.uuid))
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        if not asset_dir_id:
            seafile_api.mkdir_with_parents(repo_id, '/', asset_dir_path[1:], username)

        # get token
        obj_id = json.dumps({'parent_dir': asset_dir_path})
        try:
            token = seafile_api.get_fileserver_access_token(repo_id, obj_id, 'upload',
                                                            '', use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        upload_link = gen_file_upload_url(token, 'upload-api')

        dtable.modifier = username
        dtable.save()

        res = dict()
        res['upload_link'] = upload_link
        res['parent_path'] = asset_dir_path
        res['img_relative_path'] = os.path.join(UPLOAD_IMG_RELATIVE_PATH, str(datetime.today())[:7])
        res['file_relative_path'] = os.path.join(UPLOAD_FILE_RELATIVE_PATH, str(datetime.today())[:7])
        res['digital_signs_relative_path'] = os.path.join(UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH, str(datetime.today())[:7])
        res['public_path'] = 'public'
        if is_collection_table:
            res['img_relative_path'] = os.path.join(
                UPLOAD_IMG_RELATIVE_PATH, COLLECTION_TABLE_RELATIVE_PATH, str(datetime.today())[:7])
            res['file_relative_path'] = os.path.join(
                UPLOAD_FILE_RELATIVE_PATH, COLLECTION_TABLE_RELATIVE_PATH, str(datetime.today())[:7])
            res['digital_signs_relative_path'] = os.path.join(
                UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH, COLLECTION_TABLE_RELATIVE_PATH, str(datetime.today())[:7])
        return Response(res)


class DTableUpdateLinkView(APIView):

    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """get table file update link
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

        username = request.user.username
        # get token
        obj_id = json.dumps({'parent_dir': '/'})
        try:
            token = seafile_api.get_fileserver_access_token(repo_id, obj_id, 'upload',
                                                            username, use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if USE_INNER_FILESERVER_FOR_DTABLE_SERVER:
            update_link = '%s/%s/%s' % (get_inner_fileserver_root(), 'upload-api', token)
        else:
            update_link = gen_file_upload_url(token, 'upload-api')

        res = dict()
        res['update_link'] = update_link
        res['file_name'] = dtable.name + FILE_TYPE

        return Response(res)


class DTableDownloadLinkView(APIView):

    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """get table file download link
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
        table_name = dtable.name

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        table_file_name = table_name + FILE_TYPE
        try:
            file_path = '/' + table_file_name
            file_id = seafile_api.get_file_id_by_path(repo_id, file_path)
            if not file_id:
                error_msg = 'file %s not found.' % table_file_name
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            token = seafile_api.get_fileserver_access_token(repo_id, file_id, 'download',
                                                            username, use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if USE_INNER_FILESERVER_FOR_DTABLE_SERVER:
            download_link = '%s/files/%s/%s' % (get_inner_fileserver_root(), token, quote(table_name))
        else:
            download_link = gen_file_get_url(token, table_name)

        return Response({'download_link': download_link})


class DTableAccessTokenView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """get dtable access token
        """

        table_name = name

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
        if dtable.is_encrypted():
            base_access_key = 'base_access_' + dtable.uuid.hex
            password_in_session = request.session.get(base_access_key)
            if not password_in_session:
                password = request.data.get('base_password')
                if not password:
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
                if not check_password(password, dtable.password):
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # permission check
        username = request.user.username
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if enable_dtable_server_cluster:
            dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
            dtable_socket_url = dtable_server_url
        else:
            dtable_server_url = DTABLE_SERVER_URL
            dtable_socket_url = DTABLE_SOCKET_URL
        permission = permission if check_quota_and_row_limit_by_workspace(dtable.workspace) else 'r'
        dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url, permission=permission)
        return Response({
            'access_token': dtable_server_api.view_access_token,
            'dtable_uuid': str(dtable.uuid),
            'dtable_server': dtable_server_url,
            'dtable_socket': dtable_socket_url,
            'dtable_db': DTABLE_DB_URL
        })



class DTableUserViewShareAccessTokenView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedPerms)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """get dtable access token
        """

        table_name = name

        user_view_share_id = request.query_params.get('user_view_share_id', '')
        if not user_view_share_id:
            error_msg = 'user_view_share_id invalid.'
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
        try:
            view_share = DTableViewUserShare.objects.get(id=user_view_share_id)
        except DTableViewUserShare.DoesNotExist:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if request.user.username != view_share.to_user:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if enable_dtable_server_cluster:
            dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
            dtable_socket_url = dtable_server_url
        else:
            dtable_server_url = DTABLE_SERVER_URL
            dtable_socket_url = DTABLE_SOCKET_URL
        kwargs = {
            'table_id': view_share.table_id,
            'view_id': view_share.view_id
        }
        dtable_server_api = DTableServerAPI(request.user.username, str(dtable.uuid), dtable_server_url, permission=view_share.permission, kwargs=kwargs)
        return Response({
            'access_token': dtable_server_api.view_access_token,
            'dtable_uuid': str(dtable.uuid),
            'dtable_server': dtable_server_url,
            'dtable_socket': dtable_socket_url,
        })


class DTableGroupViewShareAccessTokenView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedPerms)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """get dtable access token
        """

        table_name = name

        group_view_share_id = request.query_params.get('group_view_share_id', '')
        if not group_view_share_id:
            error_msg = 'group_view_share_id invalid.'
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
        try:
            view_share = DTableViewGroupShare.objects.get(id=group_view_share_id)
        except DTableViewGroupShare.DoesNotExist:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if not is_group_member(view_share.to_group_id, request.user.username):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if enable_dtable_server_cluster:
            dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
            dtable_socket_url = dtable_server_url
        else:
            dtable_server_url = DTABLE_SERVER_URL
            dtable_socket_url = DTABLE_SOCKET_URL
        kwargs = {
            'table_id': view_share.table_id,
            'view_id': view_share.view_id
        }
        dtable_server_api = DTableServerAPI(request.user.username, str(dtable.uuid), dtable_server_url, permission=view_share.permission, kwargs=kwargs)
        return Response({
            'access_token': dtable_server_api.view_access_token,
            'dtable_uuid': str(dtable.uuid),
            'dtable_server': dtable_server_url,
            'dtable_socket': dtable_socket_url,
        })


class DTableRowSharesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """get a dtable row share link
        Permission:
        1. owner
        2. group member
        3. shared user with `rw` or `admin` permission
        """
        # argument check
        workspace_id = request.GET.get('workspace_id', None)
        if not workspace_id:
            error_msg = 'workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.GET.get('name', None)
        if not table_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_id = request.GET.get('table_id', None)
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        row_id = request.GET.get('row_id', None)
        if not row_id:
            error_msg = 'row_id invalid.'
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
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_uuid = dtable.uuid.hex
        try:
            row_share = DTableRowShares.objects.get_dtable_row_share(
                username, workspace_id, dtable_uuid, table_id, row_id
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"row_share": row_share}, status=status.HTTP_200_OK)

    def post(self, request):
        """create a dtable row share link
        Permission:
        1. owner
        2. group member
        3. shared user with `rw` or `admin` permission
        """
        # argument check
        workspace_id = request.POST.get('workspace_id')
        if not workspace_id:
            error_msg = 'workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.POST.get('name')
        if not table_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_id = request.POST.get('table_id')
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        row_id = request.POST.get('row_id')
        if not row_id:
            error_msg = 'row_id invalid.'
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
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_uuid = dtable.uuid.hex
        row_share = DTableRowShares.objects.get_dtable_row_share(
            username, workspace_id, dtable_uuid, table_id, row_id
        )
        if row_share:
            error_msg = 'Row share link %s already exists.' % row_share['token']
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            row_share = DTableRowShares.objects.add_dtable_row_share(
                username, workspace_id, dtable_uuid, table_id, row_id
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"row_share": row_share}, status=status.HTTP_201_CREATED)


class DTableRowShareView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def delete(self, request, token):
        """ Delete share link.
        Permission:
        1. dtable row share owner;
        """
        # resource check
        row_share = DTableRowShares.objects.get_dtable_row_share_by_token(token)
        if not row_share:
            return Response({'success': True}, status=status.HTTP_200_OK)

        # permission check
        username = request.user.username
        row_share_owner = row_share.username
        if username != row_share_owner:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            DTableRowShares.objects.delete_dtable_row_share(token)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


class InternalDTableRelatedUsersView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        dtable_uuid = request.GET.get('dtable_uuid')
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

        user_list = []
        try:
            email_list = list_dtable_related_users(workspace, dtable)
            email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)

            for email in email_list:
                user_info = get_user_common_info(email)
                user_info['id_in_org'] = email2id_in_org.get(email, '')
                user_name = user_info.get('name', '')
                user_info['name_pinyin'] = "'".join(lazy_pinyin(user_name)) if user_name else ''
                user_list.append(user_info)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'user_list': user_list})


class DTableImageRotateView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id, name):
        # arguments check
        path = request.data.get('path')
        if not path:
            error_msg = 'path is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        angle = request.data.get('angle')
        if not angle or angle not in ('90', '180', '270'):
            error_msg = 'angle is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        angle = {'90': 2, '180': 3, '270': 4}[angle]

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        parent_dir = os.path.join('/asset', str(dtable.uuid))
        asset_path = os.path.join(parent_dir, path.lstrip('/'))
        asset_id = seafile_api.get_file_id_by_path(workspace.repo_id, asset_path)
        if not asset_id:
            error_msg = 'Picture %s not found.' % (path,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        asset_name = os.path.basename(path)
        file_type, _ = get_file_type_and_ext(asset_name)
        if file_type != file_types.IMAGE:
            error_msg = '%s is not a picture.' % (path,)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        user = request.user
        if check_dtable_permission(user.username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # get token
        try:
            token = seafile_api.get_fileserver_access_token(
                workspace.repo_id, asset_id, 'view', '', use_onetime=False
            )
        except Exception as e:
            logger.error('get view token error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        asset_url = gen_inner_file_get_url(token, asset_name)

        # request pic
        try:
            response = requests.get(asset_url)
            if response.status_code != 200:
                logger.error('request asset url: %s response code: %s', asset_url, response.status_code)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        except Exception as e:
            logger.error('request: %s error: %s', asset_url, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        img = response.content

        # get upload link
        old_img = Image.open(BytesIO(img))
        obj_id = json.dumps({'parent_dir': parent_dir})
        try:
            token = seafile_api.get_fileserver_access_token(workspace.repo_id, obj_id, 'upload',
                                                            '', use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        upload_link = gen_file_upload_url(token, 'upload-api')

        # upload
        try:
            # rotate and save to fp
            fp = BytesIO()
            content_type = response.headers['Content-Type']
            old_img.transpose(angle).save(fp, content_type.split('/')[1])
            response = requests.post(upload_link, data={'parent_dir': parent_dir, 'relative_path': os.path.dirname(path.strip('/')), 'replace': 1}, files={
                'file': (asset_name, fp.getvalue(), content_type)
            })
            if response.status_code != 200:
                logger.error('upload: %s status code: %s', upload_link, response.status_code)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        except Exception as e:
            logger.error('upload rotated image error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # remove thumbnails
        remove_thumbnail_by_id(asset_id)

        return Response({'success': True})

class TrashDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def _delete_dtable(self, dtable):
        repo_id = dtable.workspace.repo_id
        asset_dir_path = '/asset/' + str(dtable.uuid)
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        _, table_file_name, _ = restore_trash_dtable_names(dtable)
        if asset_dir_id:
            parent_dir = os.path.dirname(asset_dir_path)
            file_name = os.path.basename(asset_dir_path)
            try:
                seafile_api.del_file(repo_id, parent_dir, json.dumps([file_name]), '')
            except SearpcError as e:
                logger.error('delete dtable: %s assets error: %s', str(dtable.uuid), e)

        # delete table
        try:
            storage_backend.delete_dtable(dtable)
        except Exception as e:
            logger.error('delete dtable: %s file error: %s', table_file_name, e)

        try:
            DTables.objects.delete_dtable(dtable.workspace, dtable.name)
        except Exception as e:
            logger.error('delete dtable: %s in db error: %s', str(dtable.uuid), e)

    def get(self, request):
        # argument check
        username = request.user.username
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except Exception as e:
            error_msg = 'per_page or page invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page
        try:
            dtables = DTables.objects.filter(deleted=True,workspace__owner=username).select_related('workspace').order_by('-delete_time')
        except Exception as e:
            logger.error('get deleted dtables error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        count = dtables.count()
        results = [dtable.to_dict(include_deleted=True) for dtable in dtables[start: end]]

        return Response({'count': count, 'trash_dtable_list': results})

    def delete(self, request):
        # argument check
        username = request.user.username
        try:
            dtables = DTables.objects.filter(deleted=True, workspace__owner=username).select_related(
                'workspace')
            for dtable in dtables:
                self._delete_dtable(dtable)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if is_org_context(request):
            org_id = request.user.org.org_id
            clean_org_storage_size_cache(org_id)

        return Response({'success': True})


class TrashDTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def put(self, request, dtable_id):

        # argument check
        username = request.user.username
        try:
            dtable_id = int(dtable_id)
        except Exception:
            error_msg = 'dtable_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.filter(id=dtable_id, deleted=True).select_related('workspace').first()
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_base_limit(dtable.workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check, only can be restored by user who's dtable's creator
        if username != dtable.workspace.owner:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        new_dtable_name, old_dtable_file_name, new_dtable_file_name = restore_trash_dtable_names(dtable)
        # check existed dtable
        if DTables.objects.get_dtable(dtable.workspace, new_dtable_name):
            error_msg = 'Table with name "%s" exists.' % new_dtable_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # rename dtable
        try:
            storage_backend.rename_dtable(dtable, old_dtable_file_name, new_dtable_file_name, username)
        except Exception as e:
            logger.error('recover dtable file: %s name: %s error: %s', dtable.id, dtable.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # recover dtable
        try:
            DTables.objects.filter(id=dtable_id, deleted=True).update(deleted=False, delete_time=None,
                                                                      name=new_dtable_name)
            restore_dtable_from_trash.send(None, dtable_uuid=dtable.uuid.hex)
        except Exception as e:
            logger.error('recover dtable: %s name: %s error: %s', dtable.id, dtable.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        audit_operation.send(None, username=username, operation=BASE_RESTORE, detail={
            'name': new_dtable_name
        }, org_id=request.user.org.org_id if is_org_context(request) else -1)

        return Response({'success': True})


class PageDesignFileView(APIView):
    authentication_classes = (SessionAuthentication,)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, workspace_id, name):
        page_id = request.data.get('page_id')
        row_id = request.data.get('row_id')
        target_table_name = request.data.get('target_table')
        target_row_id = request.data.get('target_row_id')
        target_column_name = request.data.get('target_column')
        file_name = request.data.get('file_name', 'page-design')
        if not all((page_id, row_id, target_table_name, target_row_id, target_column_name)):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Params invalid.')

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        permission = check_dtable_permission(request.user.username, dtable.workspace, dtable)
        if not permission:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        share_permission_detail = None
        if permission.startswith('c-'):
            try:
                permission_id = int(permission[2:])
            except:
                logger.error('user: %s to dtable: %s permission: %s invalid', request.user.username, dtable.uuid, permission)
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
            dtable_share_permission = DTableSharePermission.objects.get_by_id_and_dtable(permission_id, dtable.uuid.hex)
            try:
                share_permission_detail = json.loads(dtable_share_permission.permission)
            except Exception as e:
                logger.error('share permission: %s permission: %s invalid', permission_id, dtable_share_permission.permission)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # check table and column
        try:
            dtable_server_url = get_inner_dtable_server_url()
            dtable_server_api = DTableServerAPI(
                request.user.username,
                str(dtable.uuid),
                dtable_server_url,
                server_url=DTABLE_WEB_SERVICE_URL,
                workspace_id=dtable.workspace_id,
                repo_id=dtable.workspace.repo_id
            )

            metadata = dtable_server_api.get_metadata_with_plugin('page-design')
            tables = metadata.get('tables', [])
            target_table = None
            for table in tables:
                if table.get('name') == target_table_name:
                    target_table = table
                    break
            if not target_table:
                return api_error(status.HTTP_404_NOT_FOUND, 'Table %s not found.' % (target_table_name,))
            target_column = None
            for column in target_table.get('columns', []):
                if column.get('name') == target_column_name:
                    target_column = column
                    break
            if not target_column:
                return api_error(status.HTTP_404_NOT_FOUND, 'Column %s not found.' % (target_column_name,))
            if target_column.get('type') != 'file':
                return api_error(status.HTTP_400_BAD_REQUEST, 'Column %s is not a file column.' % (target_column_name,))
            page_design_settings = metadata.get('plugin_settings').get('page-design')
            if not page_design_settings:
                return api_error(status.HTTP_404_NOT_FOUND, 'Plugin not found')
            page = None
            for cur_page in page_design_settings:
                if cur_page.get('page_id') == page_id:
                    page = cur_page
                    break
            if not page:
                return api_error(status.HTTP_404_NOT_FOUND, 'Page of page-design not found')
            table_id = page.get('table_id')
            if share_permission_detail and table_id not in share_permission_detail:
                return api_error(status.HTTP_403_FORBIDDEN, 'Internal Server Error')
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        try:
            row = dtable_server_api.get_row(target_table_name, target_row_id)
        except Exception as e:
            return api_error(status.HTTP_404_NOT_FOUND, 'Row not found.')

        try:
            task_id = convert_page_design_to_pdf({
                'dtable_uuid': str(dtable.uuid),
                'page_id': page_id,
                'row_id': row_id
            })
        except Exception as e:
            logger.error('generate convert page to pdf task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        start_time = time.time()
        while True:
            resp = query_dtable_io_status(task_id)
            if resp.status_code == 400:
                logger.error('query task resp 400')
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')
            if not resp.ok:
                logger.error(resp.content)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')
            resp_json = resp.json()
            is_finished = resp_json['is_finished']
            if is_finished:
                break
            time.sleep(1)
            if time.time() - start_time > 15 * 60:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Interval Server Error.')

        # check pdf file
        tmp_pdf_path = os.path.join('/tmp/dtable-io/convert-page-to-pdf', '%s_%s_%s.pdf' % (str(dtable.uuid), page_id, row_id))
        if not os.path.isfile(tmp_pdf_path):
            logger.error("can't find tmp pdf, uuid: %s, page_id: %s, row_id: %s", dtable.uuid.hex, page_id, row_id)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')
        # upload file and update table
        file_name = file_name if file_name.endswith('.pdf') else file_name + '.pdf'
        try:
            # perhaps access_token expired, re-init access_token
            dtable_server_api._init()
            info_dict = dtable_server_api.upload_local_file(tmp_pdf_path, name=file_name, file_type='file')
            # row perhaps changed, so get row again
            row = dtable_server_api.get_row(target_table_name, target_row_id)
            files = row.get(target_column_name)
            if not files or not isinstance(files, list):  # cell value is None(null) or other invalid values, str...
                update_row = {target_column_name: [info_dict]}
            else:
                flag = False
                for file in files:
                    if file['name'] == info_dict['name']:
                        file.update(info_dict)
                        flag = True
                        break
                if flag:
                    update_row = {target_column_name: files}
                else:
                    update_row = {target_column_name: files + [info_dict]}
            dtable_server_api.update_row(target_table_name, target_row_id, update_row)
        except Exception as e:
            logger.error('upload file or update table error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class UserAdminDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """
        get personal dtables and dtables of the groups that user is the admin of
        return: {personal: [dtable_infos...], groups: [{'group_id': group_id, 'group_name': group_name, 'dtables': [dtable_infos....]}]}
        """
        username = request.user.username
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        admin_dtables = get_user_admin_dtables(username, by_group=True)
        personal_dtables = [dtable.to_dict() for dtable in admin_dtables.get('personal', [])]
        group_dtables = []
        for group_with_dtables in admin_dtables.get('groups', []):
            group_dtables.append({
                'group_id': group_with_dtables['group_id'],
                'group_name': group_with_dtables['group'].group_name,
                'dtables': [dtable.to_dict() for dtable in group_with_dtables['dtables']]
            })

        return Response({
            'personal': personal_dtables,
            'groups': group_dtables
        })


class DTableMetadataView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def get(self, request, dtable_uuid):
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        if not check_dtable_permission(request.user.username, dtable.workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        dtable_server_url = get_inner_dtable_server_url()
        dtable_server_api = DTableServerAPI(request.user.username, str(dtable.uuid), dtable_server_url)
        metadata = dtable_server_api.get_metadata()

        return Response({'metadata': metadata})


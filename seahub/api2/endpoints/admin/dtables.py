# Copyright (c) 2012-2019 Seafile Ltd.
import os
import logging
import shutil

import time
import json
from constance import config
from datetime import datetime
from django.http import FileResponse
from urllib.parse import quote

from django.utils.translation import gettext as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from seaserv import ccnet_api, seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.endpoints.admin.organizations import CLOUD_MODE, MULTI_TENANCY
from seahub.api2.endpoints.admin.utils import get_base_archives_stats,get_dtable_size
from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean, \
    get_user_common_info, send_signal_to_dtable_server
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_PREFIX
from seahub.dtable.models import DTables, Workspaces, DTableExternalLinks, \
    DTableViewExternalLinks, DTableAPIToken, DTableShare, \
    DTableSharePermission, DTableGroupShare, FolderItems
from seahub.dtable.constants import FOLDER_ITEM_DTABLE_GROUP_SHARE
from seahub.dtable.settings import DTABLE_SHARE_QUOTA
from seahub.dtable.signals import move_dtable_to_trash, restore_dtable_from_trash
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable.utils import restore_trash_dtable_names, get_dtables_rows_count, \
    convert_dtable_trash_names, get_dtable_owner, copy_dtable, add_dtable_io_task, copy_asset, \
    COPY_TMP_PATH, clear_tmp_files_and_dirs, query_dtable_io_status, \
    get_share_permission, clean_related_users_cache
from seahub.group.utils import is_group_member, group_id_to_name
from seahub.settings import INNER_DTABLE_DB_URL, DTABLE_EXPORT_MAX_SIZE
from seahub.utils import update_page_design_static_image, is_valid_username, get_inner_dtable_server_url
from seahub.utils.storage_backend import storage_backend
from seahub.utils.timeutils import timestamp_to_isoformat_timestr, datetime_to_isoformat_timestr
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import BASE_DELETE, BASE_RESTORE, BASE_REPAIR, BASE_UNSET_PASSWORD

import seaserv


logger = logging.getLogger(__name__)
permission_tuple = (PERMISSION_READ, PERMISSION_READ_WRITE)
GROUP_DOMAIN = '@seafile_group'

def _api_token_obj_to_dict(api_token_obj):
    return {
        'app_name': api_token_obj.app_name,
        'api_token': api_token_obj.token,
        'generated_by': email2nickname(api_token_obj.generated_by),
        'generated_at': datetime_to_isoformat_timestr(api_token_obj.generated_at),
        'last_access': datetime_to_isoformat_timestr(api_token_obj.last_access),
        'permission': api_token_obj.permission,
    }


def get_dtable_info(dtable, include_deleted=False, rows_count_dict=None):
    dtable_info = dtable.to_dict(include_deleted=include_deleted)
    dtable_info['org_id'] = dtable.workspace.org_id
    dtable_info['email'] = dtable.workspace.owner
    dtable_info['group_id'] = dtable.get_owner_group_id()
    owner_name, owner_deleted = get_dtable_owner(dtable)
    dtable_info['owner'] = owner_name
    dtable_info['owner_deleted'] = owner_deleted

    file_size = get_dtable_size(dtable)
    dtable_info['file_size'] = file_size or None

    if dtable.workspace.org_id != -1:
        org = ccnet_api.get_org_by_id(dtable.workspace.org_id)
        if org:
            dtable_info.update({
                'org_name': org.org_name,
            })
    if rows_count_dict:
        dtable_info['rows_count'] = rows_count_dict.get(dtable.uuid.hex, 0)
    return dtable_info

def get_base_archives(page, per_page):
    try:
        dtable_db_api = DTableDBAPI(None, None, INNER_DTABLE_DB_URL)
        return dtable_db_api.get_bases(max(0, (page - 1) * per_page), per_page)
    except Exception as e:
        logger.exception('query dtable-db bases error: %s', e)

def delete_base_archives(dtable_uuid):
    dtable_db_api = DTableDBAPI('dtable-web', dtable_uuid, INNER_DTABLE_DB_URL)
    return dtable_db_api.delete_base()

def get_archive_backups(dtable_uuid):
    dtable_db_api = DTableDBAPI('dtable-web', dtable_uuid, INNER_DTABLE_DB_URL)
    return dtable_db_api.get_backups()

class AdminDtables(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, format=None):
        """ List 'all' dtables

            Permission checking:
            1. only admin can perform this action.
        """
        # list dtables by page
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        start = (current_page - 1) * per_page
        end = start + per_page

        try:
            # not include org
            dtables_count = DTables.objects.filter(deleted=False).count()
            dtables_queryset = DTables.objects.filter(deleted=False).select_related('workspace')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if dtables_count > end:
            has_next_page = True
        else:
            has_next_page = False

        page_info = {
            'has_next_page': has_next_page,
            'current_page': current_page
        }

        return_results = list()

        rows_count_dict = get_dtables_rows_count([d.uuid.hex for d in dtables_queryset])

        for dtable in dtables_queryset:
            return_results.append(get_dtable_info(dtable, rows_count_dict=rows_count_dict))

        return Response({"page_info": page_info, "dtables": return_results})

class AdminDtable(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def delete(self, request, dtable_uuid):
        """delete a table

        """
        # argument check
        username = request.user.username
        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return Response({'success': True}, status=status.HTTP_200_OK)

        # resource check
        workspace = dtable.workspace
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

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
        except Exception as e:
            logger.error('delete dtable: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # send admin operation log signal
        admin_op_detail = {
            'name': dtable.name,
            'dtable_uuid': str(dtable.uuid)
        }
        if workspace.org_id != -1:
            org = ccnet_api.get_org_by_id(workspace.org_id)
            if org:
                admin_op_detail['org_name'] = org.org_name
                admin_op_detail['org_id'] = org.org_id
        
        if GROUP_DOMAIN in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if group:
                admin_op_detail['group_id'] = group_id
                admin_op_detail['group_name'] = group.group_name

        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=BASE_DELETE, detail=admin_op_detail)

        return Response({'success': True}, status=status.HTTP_200_OK)

class AdminUnsetDTablePasswordView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def _clean_password_in_session(self, request, dtable):
        base_access_key = 'base_access_' + dtable.uuid.hex
        password_in_session = request.session.get(base_access_key)
        if password_in_session:
            del request.session[base_access_key]

    def put(self, request, dtable_uuid):
        # permission check
        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not dtable.is_encrypted():
            error_msg = 'Base is not password protected'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            dtable.password = None
            dtable.save()
            self._clean_password_in_session(request, dtable)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # send admin operation log signal
        admin_op_detail = {
            'name': dtable.name,
            'dtable_uuid': str(dtable.uuid)
        }

        if dtable.workspace.org_id != -1:
            org = ccnet_api.get_org_by_id(dtable.workspace.org_id)
            if org:
                admin_op_detail['org_name'] = org.org_name
                admin_op_detail['org_id'] = org.org_id
        
        if GROUP_DOMAIN in dtable.workspace.owner:
            group_id = dtable.workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if group:
                admin_op_detail['group_id'] = group_id
                admin_op_detail['group_name'] = group.group_name

        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=BASE_UNSET_PASSWORD, detail=admin_op_detail)

        return Response({'dtable': dtable.to_dict()})

class AdminRepairDTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def put(self, request, dtable_uuid):
        # permission check
        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_server_url = get_inner_dtable_server_url()
        try:
            dtable_server_api = DTableServerAPI(request.user.username, dtable.uuid.hex, dtable_server_url)
            response = dtable_server_api.repair_base()

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # send admin operation log signal
        admin_op_detail = {
            'name': dtable.name,
            'dtable_uuid': str(dtable.uuid)
        }

        if dtable.workspace.org_id != -1:
            org = ccnet_api.get_org_by_id(dtable.workspace.org_id)
            if org:
                admin_op_detail['org_name'] = org.org_name
                admin_op_detail['org_id'] = org.org_id
        
        if GROUP_DOMAIN in dtable.workspace.owner:
            group_id = dtable.workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if group:
                admin_op_detail['group_id'] = group_id
                admin_op_detail['group_name'] = group.group_name

        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=BASE_REPAIR, detail=admin_op_detail)

        return Response(response)

class AdminTrashDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):

        # argument check
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
        except Exception as e:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page
        try:
            dtables = DTables.objects.filter(deleted=True).select_related('workspace').order_by('-delete_time')
        except Exception as e:
            logger.error('get deleted dtables error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        count = dtables.count()

        results = [get_dtable_info(dtable, include_deleted=True) for dtable in dtables[start: end]]

        return Response({'count': count, 'trash_dtable_list': results})


class AdminTrashDTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def _delete_old_dtable(self, old_dtable, old_dtable_file_name):
        repo_id = old_dtable.workspace.repo_id
        asset_dir_path = '/asset/' + str(old_dtable.uuid)
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        # delete old dtable asset
        if asset_dir_id:
            parent_dir = os.path.dirname(asset_dir_path)
            file_name = os.path.basename(asset_dir_path)
            try:
                seafile_api.del_file(repo_id, parent_dir, json.dumps([file_name]), '')
            except Exception as e:
                logger.error('delete old dtable: %s assets error: %s', str(old_dtable.uuid), e)

        # delete old dtable file
        try:
            seafile_api.del_file(repo_id, '/', json.dumps([old_dtable_file_name]), '')
        except Exception as e:
            logger.error('delete old dtable: %s file error: %s', old_dtable_file_name, e)

        # delete old dtable
        try:
            DTables.objects.delete_dtable(old_dtable.workspace, old_dtable.name)
        except Exception as e:
            logger.error('delete old dtable: %s in db error: %s', str(old_dtable.uuid), e)

    def put(self, request, dtable_id):

        # permission check
        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # argument check
        try:
            dtable_id = int(dtable_id)
        except Exception:
            error_msg = 'dtable_id invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        dtable = DTables.objects.filter(id=dtable_id, deleted=True).select_related('workspace').first()
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_dtable_name, old_dtable_file_name, new_dtable_file_name = restore_trash_dtable_names(dtable)
        # check existed dtable
        if DTables.objects.get_dtable(dtable.workspace, new_dtable_name):
            error_msg = 'Table with name "%s" exists.' % new_dtable_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # restore to sys admin
        restore_to_admin_account = request.data.get('restore_to_admin_account', 'false')
        username = request.user.username
        if str(restore_to_admin_account).lower() == 'true':
            try:
                src_workspace = dtable.workspace
                dst_workspace = Workspaces.objects.get_workspace_by_owner(username)
                new_dtable_name = DTables.objects.get_non_duplicated_name(new_dtable_name, dst_workspace.id)
                new_dtable, _ = copy_dtable(src_workspace, dtable, dst_workspace, new_dtable_name, username, request)
                self._delete_old_dtable(dtable, old_dtable_file_name)
                return Response({'success': True})
            except Exception as e:
                logger.error('recover dtable: %s name: %s error: %s', dtable.id, dtable.name, e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # rename dtable
        try:
            storage_backend.rename_dtable(dtable, old_dtable_file_name, new_dtable_file_name, username)
        except Exception as e:
            logger.error('recover dtable file: %s name: %s error: %s', dtable.id, dtable.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # recover dtable
        try:
            DTables.objects.filter(id=dtable_id, deleted=True).update(deleted=False, delete_time=None, name=new_dtable_name)
            restore_dtable_from_trash.send(None, dtable_uuid=dtable.uuid.hex)
        except Exception as e:
            logger.error('recover dtable: %s name: %s error: %s', dtable.id, dtable.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # send admin operation log signal
        admin_op_detail = {
            'name': new_dtable_name,
            'dtable_uuid': str(dtable.uuid)
        }

        if dtable.workspace.org_id != -1:
            org = ccnet_api.get_org_by_id(dtable.workspace.org_id)
            if org:
                admin_op_detail['org_name'] = org.org_name
                admin_op_detail['org_id'] = org.org_id
        
        if GROUP_DOMAIN in dtable.workspace.owner:
            group_id = dtable.workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if group:
                admin_op_detail['group_id'] = group_id
                admin_op_detail['group_name'] = group.group_name

        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=BASE_RESTORE, detail=admin_op_detail)

        return Response({'success': True})

class AdminSearchDTable(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        query_str = request.GET.get('query', '')
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            per_page = int(request.GET.get('per_page', ''))
            page = int(request.GET.get('page', ''))
        except ValueError:
            per_page = 25
            page = 1

        start = (page - 1) * per_page
        end = page * per_page

        try:
            dtable_queryset = DTables.objects.get_dtable_by_query_str(query_str, include_deleted=False)
            total_count = dtable_queryset.count()
            dtables = dtable_queryset[start: end]
            uuid_str_list = [d.uuid.hex for d in dtables]
            rows_count_dict = get_dtables_rows_count(uuid_str_list)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        search_result = {
            'dtables': dtables and [get_dtable_info(dtable, rows_count_dict=rows_count_dict ) for dtable in dtables] or [],
            'count': total_count
        }
        return Response(search_result)


class AdminDTableExternalLinksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, dtable_id):
        # argument check
        return_info = {
            'base_external_links': [],
            'view_external_links': [],
        }
        try:
            dtable_external_links = DTableExternalLinks.objects.filter(dtable_id=dtable_id)
            if dtable_external_links.exists():
                return_info['base_external_links'] = [link.to_dict() for link in dtable_external_links]

            dtable_view_external_links = DTableViewExternalLinks.objects.filter(dtable_id=dtable_id)
            if dtable_view_external_links.exists():
                return_info['view_external_links'] = [link.to_dict() for link in dtable_view_external_links]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


        return Response({'dtable_external_link_list': return_info})


class AdminDTableArchives(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 100))
        except Exception as e:
            page = 1
            per_page = 100

        try:
            archived_dtables = get_base_archives(page, per_page)
        except Exception as e:
            logger.error('get archived dtables error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not archived_dtables:
            return Response({'bases': [], 'count': 0, 'base_deleted': []})

        base_stats = get_base_archives_stats()
        if not base_stats:
            total_count = 0
        else:
            total_count = base_stats.get('number_of_bases', 0)

        archived_bases_data = archived_dtables.get('bases')
        dtable_uuids = [base.get('id') for base in archived_bases_data]
        dtable_queryset = DTables.objects.filter(uuid__in=dtable_uuids)

        dtable_info_dict = {str(d.uuid): d.name for d in dtable_queryset}

        archived_info_list = []
        base_deleted_list = []
        for base_info in archived_bases_data:
            base_uuid = base_info.get('id')
            base_name = dtable_info_dict.get(base_uuid)
            if not base_name:
                base_deleted_list.append(base_uuid)
                base_name = base_uuid
            archived_info_list.append({
                'uuid': base_uuid,
                'storage': base_info.get('storage'),
                'rows': base_info.get('rows'),
                'name': base_name
            })
        count = total_count
        json_data = {'bases': archived_info_list, 'count':count, 'base_deleted': base_deleted_list}
        return Response(json_data)


    def delete(self, request):

        dtable_uuids = request.data.get('dtable_uuids')
        if not dtable_uuids:
            return Response({'success': True, 'count': 0})

        dtable_query = DTables.objects.filter(uuid__in=dtable_uuids)
        if dtable_query.exists():
            err_msg = "Some bases in uuids have not been deleted."
            return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        success_count, failed_count = 0, 0
        for dtable_uuid in dtable_uuids:
            try:
                delete_base_archives(dtable_uuid)
                success_count += 1
            except Exception as e:
                logger.exception('delete archives: %s error: %s', dtable_uuid, e)
                failed_count += 1

        return Response({'success_count': success_count, 'failed_count': failed_count})

class AdminArchiveBackups(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request, dtable_uuid):
        try:
            archive_back_ups = get_archive_backups(dtable_uuid)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not archive_back_ups:
            return Response({'archive_backups': []})

        results = []
        archive_back_ups = sorted(archive_back_ups, key=lambda x: x.get('ctime'), reverse=True)
        for backcup in archive_back_ups:
            ctime = backcup.get('ctime')
            ctime_format = ctime and timestamp_to_isoformat_timestr(ctime) or ''
            info = {
                "id": backcup.get('id'),
                "version": backcup.get('version'),
                "size": backcup.get('size'),
                "ctime": ctime_format,
            }
            results.append(info)

        return Response({'archive_backups': results})


class AdminDTableAPITokensView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, dtable_uuid):

        api_tokens = list()
        try:
            api_token_queryset = DTableAPIToken.objects.filter(dtable__uuid=dtable_uuid)
            for api_token_obj in api_token_queryset:
                data = _api_token_obj_to_dict(api_token_obj)
                api_tokens.append(data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'api_tokens': api_tokens})


class AdminDTableAPITokenView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, dtable_uuid, token):
        """delete dtable api token
        """

        try:
            api_token_obj = DTableAPIToken.objects.filter(dtable__uuid=dtable_uuid, token=token)
            api_token_obj.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class AdminExportDTable(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):

        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            ignore_asset = to_python_boolean(request.GET.get('ignore_asset', 'f'))
        except:
            ignore_asset = False

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        try:
            if not ignore_asset:
                dtable_asset_path = '/asset/' + str(dtable.uuid)
                dtable_export_max_size = getattr(config, 'DTABLE_EXPORT_MAX_SIZE', DTABLE_EXPORT_MAX_SIZE)
                file_info = seafile_api.get_file_count_info_by_path(repo_id, dtable_asset_path)
                if dtable_export_max_size < (file_info.size >> 20):
                    error_msg = _('Export failed. Base size is larger than %s mb.') % dtable_export_max_size
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception:
            pass

        params = {
            'username': request.user.username,
            'table_name': dtable.name,
            'repo_id': repo_id,
            'workspace_id': dtable.workspace_id,
            'dtable_uuid': str(dtable.uuid),
            'ignore_asset': ignore_asset,
        }

        try:
            task_id = add_dtable_io_task(type='export', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})

class AdminCopyDTable(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):

        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

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

        username = request.user.username

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
        if not dst_workspace_id:
            error_msg = 'workspace: %s not found' % dst_workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        name = DTables.objects.get_non_duplicated_name(name, dst_workspace.id)

        # create dtable
        # 1. copy dtable content
        dst_dtable, error_msg = copy_dtable(src_workspace, src_dtable, dst_workspace, name, username, request, include_assets=False)
        if error_msg:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # 2. copy assets
        try:
            res = copy_asset(src_workspace.repo_id, src_dtable.uuid, dst_workspace.repo_id, dst_dtable.uuid, username, sync_copy=False)
            if res:
                task_id = res.task_id
            else:
                task_id = None
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'dtable': dst_dtable.to_dict(), 'task_id': task_id})


class AdminDTableDoTaskAfterCopyView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        """
        Deal something after the assets have been copied, such as page design
        :param request:
        :return:
        """
        dst_dtable_uuid = request.data.get('dst_dtable_uuid')
        if not dst_dtable_uuid:
            error_msg = 'dst_dtable_uuid %s invalid.' % dst_dtable_uuid
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username
        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid)
        if not dst_dtable:
            err_msg = "dtable: %s not found" % dst_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        dtable_content = storage_backend.get_dtable(dst_dtable)
        if dtable_content:
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
            clear_tmp_files_and_dirs(str(dst_dtable.uuid))

        return Response({'success': True})

class AdminSynchronousExportDTable(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):

        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        
        try:
            ignore_asset = to_python_boolean(request.GET.get('ignore_asset', 'f'))
        except:
            ignore_asset = False

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        
        try:
            if not ignore_asset:
                dtable_asset_path = '/asset/' + str(dtable.uuid)
                dtable_export_max_size = getattr(config, 'DTABLE_EXPORT_MAX_SIZE', DTABLE_EXPORT_MAX_SIZE)
                file_info = seafile_api.get_file_count_info_by_path(repo_id, dtable_asset_path)
                if dtable_export_max_size < (file_info.size >> 20):
                    error_msg = _('Export failed. Base size is larger than %s mb.') % dtable_export_max_size
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception:
            pass

        params = {
            'username': request.user.username,
            'table_name': dtable.name,
            'repo_id': repo_id,
            'workspace_id': dtable.workspace_id,
            'dtable_uuid': str(dtable.uuid),
            'ignore_asset': ignore_asset,
        }

        try:
            task_id = add_dtable_io_task(type='export', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        start_time = time.time()
        while True:
            time.sleep(1)
            resp = query_dtable_io_status(task_id)

            resp_json = resp.json()
            error_msg = resp_json.get('error_msg')

            if resp.status_code == 500:
                logger.error('dtable io query status error: %s, %s' % (task_id, resp.text))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            if not resp.ok:
                return api_error(resp.status_code, error_msg)

            if time.time() - start_time > 60:
                return api_error(status.HTTP_504_GATEWAY_TIMEOUT, 'Timeout Error.')

            is_finished = resp_json['is_finished']
            if is_finished:
                break

        tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'zip_file') + '.zip'
        if not os.path.exists(tmp_zip_path):
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(open(tmp_zip_path, 'rb'), content_type="application/x-zip-compressed", as_attachment=True)
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(dtable.dtable_name) + '.dtable'

        tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid))
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)

        return response

def _check_admin_can_manage_base_and_cloud_mode(func):
    def wrapper(self, request, dtable_uuid):
        if not request.user.admin_permissions.can_manage_base():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        elif CLOUD_MODE or MULTI_TENANCY:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        else:
            return func(self, request, dtable_uuid)
    return wrapper

class AdminDTableSharePermissionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    @_check_admin_can_manage_base_and_cloud_mode
    def get(self, request, dtable_uuid):
        """List dtable share premissions
        """
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # main
        try:
            permission_qs = DTableSharePermission.objects.list_by_dtable(
                dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        permission_list = [item.to_dict() for item in permission_qs]
        return Response({'permission_list': permission_list})

class AdminDTableShareView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    @_check_admin_can_manage_base_and_cloud_mode
    def get(self, request, dtable_uuid):
        """list share users in dtable share
        """
        
         # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            share_queryset = DTableShare.objects.list_by_dtable(dtable)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        user_list = list()
        for item in share_queryset:
            user_info = get_user_common_info(item.to_user)
            user_info['permission'] = item.permission
            user_list.append(user_info)

        return Response({"user_list": user_list})

    @_check_admin_can_manage_base_and_cloud_mode
    def post(self, request, dtable_uuid):
        """share dtable to user
        """    

        # argument check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        to_user = request.data.get('email')
        if not to_user or not is_valid_username(to_user):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        #check resources
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
        workspace = dtable.workspace
        if not workspace:
            error_msg = 'Workspace not found.' 
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            user = User.objects.get(email=to_user)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % to_user
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        #owner && target check
        if GROUP_DOMAIN in workspace.owner:
            group_id = workspace.owner.split('@')[0]
            group = seaserv.get_group(group_id)
            if not group:
                error_msg = 'Group %s not found.' % group_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            if is_group_member(group_id, to_user):
                error_msg = _('This base cannot be shared to its group member.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            from_user = group_id + GROUP_DOMAIN
        else:
            if workspace.owner == to_user:
                error_msg = 'Cannot share to the owner of the base'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            from_user = workspace.owner


        # share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, to_user)
            if obj:
                error_msg = _('Base already shared to %s.') % (to_user)
                return api_error(status.HTTP_409_CONFLICT, error_msg)

            share_count = DTableShare.objects.get_count_by_dtable(dtable)
            if share_count >= DTABLE_SHARE_QUOTA:
                error_msg = _('Base cannot be shared to more than %s users.') % (DTABLE_SHARE_QUOTA)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            DTableShare.objects.add(dtable, from_user, to_user, permission)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True}, status=status.HTTP_201_CREATED)
    
    @_check_admin_can_manage_base_and_cloud_mode
    def put(self, request, dtable_uuid):
        """modify dtable share permission
        """
        
        # argument check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        to_user = request.data.get('email')
        if not to_user or not is_valid_username(to_user):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            
        #check resources
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            user = User.objects.get(email=to_user)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % to_user
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, to_user)
            if not obj:
                error_msg = 'base not shared to %s.' % (to_user)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            if permission == obj.permission:
                error_msg = 'base already has %s share permission.' % (permission)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            obj.permission = permission
            obj.save(update_fields=['permission'])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True})


    @_check_admin_can_manage_base_and_cloud_mode
    def delete(self, request, dtable_uuid):
        """unshare dtable
        """
        
        # argument check
        to_user = request.data.get('email')
        if not to_user or not is_valid_username(to_user):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        #check resources
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
        try:
            user = User.objects.get(email=to_user)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % to_user
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # main
        try:
            obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, to_user)
            if not obj:
                error_msg = 'table not shared to %s.' % ( to_user)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            obj.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True})

def _get_dtable_group_share_info(dtable_group_share):
    group_id = dtable_group_share.group_id
    return {
        'group_id': group_id,
        'group_name': group_id_to_name(group_id),
        'permission': dtable_group_share.permission,
        'dtable_share_id': dtable_group_share.id
    }

class AdminDTableGroupSharesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    @_check_admin_can_manage_base_and_cloud_mode
    def get(self, request, dtable_uuid):
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dgses = DTableGroupShare.objects.filter(dtable=dtable).order_by('created_at')
        dtable_group_shares = [_get_dtable_group_share_info(dgs) for dgs in dgses]
        return Response({'dtable_group_share_list': dtable_group_shares})

    @_check_admin_can_manage_base_and_cloud_mode
    def post(self, request, dtable_uuid):
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # arguments check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_id = request.data.get("group_id")
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if GROUP_DOMAIN in dtable.workspace.owner and str(group_id) + GROUP_DOMAIN == dtable.workspace.owner:
            error_msg = 'Disable to share table to the group which table belongs to.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # share permission check
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        try:
            if DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
                error_msg = _('Base %s already shared to the group.') % dtable.name
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            dgs = DTableGroupShare.objects.create(dtable=dtable, group_id=group_id, permission=permission, created_by=dtable.workspace.owner)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'dtable_group_share': _get_dtable_group_share_info(dgs)})


    @_check_admin_can_manage_base_and_cloud_mode
    def put(self, request, dtable_uuid):
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # argument check
        permission = request.data.get('permission')
        if not permission or (
                permission not in permission_tuple and
                PERMISSION_PREFIX not in permission):
            error_msg = 'permission is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        group_id = request.data.get("group_id")
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if not DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
            error_msg = 'The base has not been shared to group %s' % (group_id,)
            return None, None, api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if permission not in permission_tuple:
            share_permission = get_share_permission(permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        # main
        try:
            updates = {'permission': permission}
            DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).update(**updates)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    @_check_admin_can_manage_base_and_cloud_mode
    def delete(self, request, dtable_uuid):
        group_id = request.data.get("group_id")
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        if not DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).exists():
            error_msg = 'The base has not been shared to group %s' % (group_id,)
            return None, None, api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        try:
            dgs = DTableGroupShare.objects.filter(dtable=dtable, group_id=group_id).first()
            FolderItems.objects.filter(item_type=FOLDER_ITEM_DTABLE_GROUP_SHARE, item_id=dgs.id).delete()
            dgs.delete()
            send_signal_to_dtable_server('dtable-share-changed', dtable)
            clean_related_users_cache(dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

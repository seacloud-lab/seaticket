import uuid
import logging
from datetime import datetime
import json
import os
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response

from pysearpc import SearpcError
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, Workspaces
from seahub.dtable.signals import move_dtable_to_trash, restore_dtable_from_trash
from seahub.dtable.utils import clean_org_storage_size_cache, restore_trash_dtable_names, convert_dtable_trash_names, get_dtables_rows_count, \
    copy_dtable, get_dtable_owner
from seahub.utils import normalize_file_path
from seaserv import seafile_api, ccnet_api
from seahub.utils.storage_backend import storage_backend
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import BASE_DELETE, BASE_RESTORE

logger = logging.getLogger(__name__)
FILE_TYPE = '.dtable'
GROUP_DOMAIN = '@seafile_group'


def get_dtable_info(dtable, include_deleted=False, rows_count_dict=None):
    dtable_info = dtable.to_dict(include_deleted=include_deleted)
    dtable_info['org_id'] = dtable.workspace.org_id
    dtable_info['email'] = dtable.workspace.owner
    dtable_info['group_id'] = dtable.get_owner_group_id()
    owner_name, owner_deleted = get_dtable_owner(dtable)
    dtable_info['owner'] = owner_name
    dtable_info['owner_deleted'] = owner_deleted
    if rows_count_dict:
        dtable_info['rows_count'] = rows_count_dict.get(dtable.uuid.hex, 0)
    return dtable_info


def _check_org(org_id):
    org_id = int(org_id)
    org = ccnet_api.get_org_by_id(org_id)  # todo: wrong
    if not org:
        error_msg = 'Organization %s not found.' % org_id
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None
    return None, org


class OrgAdminDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id):
        # resource check
        error, _ = _check_org(org_id)
        if error:
            return error

        try:
            page = int(request.GET.get('page', 1))
            page = page if page > 0 else 1
            per_page = int(request.GET.get('per_page', 25))
        except:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page

        try:
            dtables_count = DTables.objects.filter(deleted=False, workspace__org_id=org_id).count()
            dtables_queryset = DTables.objects.filter(deleted=False, workspace__org_id=org_id).select_related('workspace')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        rows_count_dict = get_dtables_rows_count([d.uuid.hex for d in dtables_queryset])
        dtable_list = [get_dtable_info(d, rows_count_dict=rows_count_dict) for d in dtables_queryset]

        return Response({
            'dtable_list': dtable_list,
            'count': dtables_count
        })


class OrgAdminDTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def delete(self, request, org_id, dtable_id):
        error, _ = _check_org(org_id)
        if error:
            return error
        # resource check
        dtable = DTables.objects.filter(id=dtable_id, deleted=False, workspace__org_id=org_id).select_related('workspace').first()
        if not dtable:
            error_msg = 'table not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        repo_id = dtable.workspace.repo_id
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
        
        detail = {
            'name': dtable.name,
            'dtable_uuid': str(dtable.uuid)
        }
        if GROUP_DOMAIN in dtable.workspace.owner:
            group_id = int(dtable.workspace.owner.split('@')[0])
            group = ccnet_api.get_group(group_id)
            if group:
                detail['group_id'] = group_id
                detail['group_name'] = group.group_name

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=BASE_DELETE, detail=detail, org_id=org_id)

        return Response({'success': True})


class OrgAdminTrashDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

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

    def get(self, request, org_id):
        error, _ = _check_org(org_id)
        if error:
            return error

        try:
            page = int(request.GET.get('page', 1))
            page = page if page > 0 else 1
            per_page = int(request.GET.get('per_page', 25))
        except:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page

        try:
            dtables_count = DTables.objects.filter(deleted=True, workspace__org_id=org_id).count()
            dtables_queryset = DTables.objects.filter(deleted=True, workspace__org_id=org_id).select_related('workspace')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'dtable_list': [get_dtable_info(d, include_deleted=True) for d in dtables_queryset],
            'count': dtables_count
        })

    def delete(self, request, org_id):
        error, _ = _check_org(org_id)
        if error:
            return error

        try:
            dtables = DTables.objects.filter(deleted=True, workspace__org_id=org_id).select_related('workspace')
            for dtable in dtables:
                self._delete_dtable(dtable)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        clean_org_storage_size_cache(org_id)

        return Response({
            'success': True
        })

class OrgAdminTrashDTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def _delete_old_dtable(self, dtable):
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


    def put(self, request, org_id, dtable_id):
        error, _ = _check_org(org_id)
        if error:
            return api_error
        # resource check
        dtable = DTables.objects.filter(id=dtable_id, deleted=True, workspace__org_id=org_id).first()
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        new_dtable_name, old_dtable_file_name, new_dtable_file_name = restore_trash_dtable_names(dtable)

        # check existed dtable
        if DTables.objects.get_dtable(dtable.workspace, new_dtable_name):
            error_msg = 'Table with name "%s" exists.' % new_dtable_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        restore_to_admin_account = request.data.get('restore_to_admin_account')
        username = request.user.username
        if restore_to_admin_account:
            try:
                src_workspace = dtable.workspace
                dst_workspace = Workspaces.objects.get_workspace_by_owner(username)
                new_dtable_name = DTables.objects.get_non_duplicated_name(new_dtable_name, dst_workspace.id)
                new_dtable, _ = copy_dtable(src_workspace, dtable, dst_workspace, new_dtable_name, username, request)
                self._delete_old_dtable(dtable)
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
        
        detail = {
            'name': new_dtable_name,
            'dtable_uuid': str(dtable.uuid)
        }
        if GROUP_DOMAIN in dtable.workspace.owner:
            group_id = int(dtable.workspace.owner.split('@')[0])
            group = ccnet_api.get_group(group_id)
            if group:
                detail['group_id'] = group_id
                detail['group_name'] = group.group_name

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=BASE_RESTORE, detail=detail, org_id=org_id)

        return Response({'success': True})


class OrgAdminSearchDTables(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id):
        error, _ = _check_org(org_id)
        if error:
            return api_error

        # argument check
        query_str = request.GET.get('query', '').strip()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            page = int(request.GET.get('page', ''))
            per_page = int(request.GET.get('per_page', ''))
        except ValueError:
            page = 1
            per_page = 25

        if page <= 0 or per_page <= 0:
            error_msg = 'page or per_page invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start = (page - 1) * per_page
        end = page * per_page

        if not seafile_api.is_valid_filename('fake_repo_id', query_str + FILE_TYPE):
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            dtables = DTables.objects.search_dtable_in_org(org_id, query_str, start, end)
            rows_count_dict = get_dtables_rows_count([dtable.uuid.hex for dtable in dtables])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        results = list()
        for dtable in dtables:
            dtable_info = get_dtable_info(dtable, rows_count_dict=rows_count_dict)
            results.append(dtable_info)

        return Response({'results': results})

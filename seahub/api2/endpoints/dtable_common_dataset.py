# -*- coding: utf-8 -*-
import json
import logging
import time
import jwt
from datetime import timedelta
from uuid import UUID

import requests
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _
from django.utils import timezone

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import SyncCommonDatasetThrottle, UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info, to_python_boolean
from seahub.ccnet_db.ccnet.groups import get_groups_info
from seahub.constants import PERMISSION_READ_WRITE
from seahub.dtable.constants import ColumnTypes
from seahub.dtable.models import Workspaces, DTables, DTableCommonDataset, DTableCommonDatasetSync
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.utils import is_org_context, get_inner_dtable_server_url, uuid_str_to_36_chars, uuid_str_to_32_chars
from seahub.settings import DTABLE_PRIVATE_KEY, SYNC_COMMON_DATASET_INTERVAL, \
    INNER_DTABLE_DB_URL
from seahub.dtable.utils import check_dtable_permission, check_dtable_admin_permission, \
    list_dtable_related_users, add_sync_common_dataset_task, add_import_common_dataset_task, \
    add_force_sync_common_dataset_task
from seahub.profile.models import Profile

logger = logging.getLogger(__name__)
dtable_server_url = get_inner_dtable_server_url()

def gen_src_dst_assets(dst_dtable, src_dtable, table_id, view_id, dst_table_id, dst_table_name, username):
    """
    resource check and generate some params for import/sync common dataset
    """
    src_dtable_server_api = DTableServerAPI(username, src_dtable.uuid.hex, dtable_server_url)
    dst_dtable_server_api = DTableServerAPI(username, dst_dtable.uuid.hex, dtable_server_url)
    try:
        src_dtable_metadata = src_dtable_server_api.get_metadata()
        dst_dtable_metadata = dst_dtable_server_api.get_metadata()
    except Exception as e:
        logger.error('request src dst dtable: %s, %s metadata error: %s', src_dtable.uuid, dst_dtable.uuid, e)
        return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    src_table, src_view = None, None
    for table in src_dtable_metadata.get('tables', []):
        if table['_id'] == table_id:
            src_table = table
            break
    if not src_table:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Source table not found')
    for view in src_table.get('views', []):
        if view['_id'] == view_id:
            src_view = view
            break
    if not src_view:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Source view not found')

    src_version = src_dtable_metadata.get('version')

    dst_table = None
    if dst_table_id:
        for table in dst_dtable_metadata.get('tables', []):
            if table['_id'] == dst_table_id:
                dst_table = table
                break
        if not dst_table:
            return None, api_error(status.HTTP_404_NOT_FOUND, 'Destination table not found')
    else:
        for table in dst_dtable_metadata.get('tables', []):
            if table['name'] == dst_table_name:
                return None, api_error(status.HTTP_400_BAD_REQUEST, 'Table %s already exists' % dst_table_name)

    return {
        'src_table': src_table,
        'src_version': src_version,
        'dst_table_name': dst_table['name'] if dst_table else None,
        'dst_columns': dst_table['columns'] if dst_table else None
    }, None


class DTableCommonDatasetsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """ List Common Datasets user can access through group
            params:
                from_dtable_id, optional, if given, return sets from_dtable can access
        """

        username = request.user.username

        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        dst_dtable_uuid = request.GET.get('dst_dtable_uuid', '')
        try:
            by_group = to_python_boolean(request.GET.get('by_group', 'false'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'by_group invalid.')

        if dst_dtable_uuid:
            dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid, include_deleted=False)
            if not dst_dtable:
                error_msg = 'Base not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            group_id = dst_dtable.get_owner_group_id()
            if group_id == -1:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            available_sets = DTableCommonDataset.objects.get_common_datasets_by_group(group_id)
        else:
            datasets = DTableCommonDataset.objects.filter(org_id=org_id)
            available_sets = [dataset for dataset in datasets if dataset.can_access_by_user_through_group(username)]

        dataset_list, dtable_uuids = [], []
        for dataset in available_sets:
            data = dataset.to_dict()
            data['can_manage'] = dataset.can_manage_by_user(username)
            dataset_list.append(data)
            dtable_uuids.append(dataset.dtable_uuid)

        dtables = DTables.objects.filter(uuid__in=dtable_uuids, deleted=False).select_related('workspace')
        dtable_uuid_group_ids_dict, uuid_dtables_dict = {}, {}
        for dtable in dtables:
            uuid_dtables_dict[str(dtable.uuid)] = dtable
            group_id = dtable.get_owner_group_id()
            if group_id == -1:  # it will not run here normally
                continue
            dtable_uuid_group_ids_dict[str(dtable.uuid)] = dtable.get_owner_group_id()
        if by_group:
            group_infos_dict = get_groups_info(list(set(dtable_uuid_group_ids_dict.values())))

        # update dataset more infos
        # and build datasets GROUP BY group if by_group is True
        result_dataset_list = []
        for dataset in dataset_list:
            if dataset['dtable_uuid'] not in uuid_dtables_dict:
                continue
            dataset['dtable_name'] = uuid_dtables_dict[dataset['dtable_uuid']].name
            dataset['workspace_id'] = uuid_dtables_dict[dataset['dtable_uuid']].workspace_id
            dataset['dtable_icon'] = uuid_dtables_dict[dataset['dtable_uuid']].icon
            dataset['dtable_color'] = uuid_dtables_dict[dataset['dtable_uuid']].color

            group_id = dtable_uuid_group_ids_dict.get(dataset['dtable_uuid'])
            if not group_id:  # it will not run here normally
                continue
            if not by_group:
                dataset['group_id'] = group_id
            else:
                if group_infos_dict.get(group_id).get('datasets') is None:
                    group_infos_dict[group_id]['datasets'] = [dataset]
                else:
                    group_infos_dict[group_id]['datasets'].append(dataset)

            result_dataset_list.append(dataset)

        if by_group:
            return Response({'dataset_list': group_infos_dict.values()})

        return Response({'dataset_list': result_dataset_list})

    def post(self, request):
        """ Create a Common Dataset
        :param dataset_name: name of dataset
        :param dtable_name: name of dtable
        :param table_name: name of subtable
        :param view_name: name of view
            1. check params, resources and permissions
            2. get dtable data from dtable_esrver
            3. store data in database
        """

        if not request.user.permissions.can_create_common_dataset():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # params check
        dataset_name = request.data.get('dataset_name', '')
        if not dataset_name:
            error_msg = 'dataset_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace_id = request.data.get('workspace_id', '')
        if not workspace_id:
            error_msg = 'workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_name = request.data.get('dtable_name', '')
        if not dtable_name:
            error_msg = 'dtable_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name', '')
        if not table_name:
            error_msg = 'table_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        view_name = request.data.get('view_name', '')
        if not view_name:
            error_msg = 'view_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        # check duplicate by name
        set_with_duplicate_name = DTableCommonDataset.objects.filter(org_id=org_id, dataset_name=dataset_name)
        if len(set_with_duplicate_name) >= 1:
            error_msg = _('Common dataset with name: %s already exists.') % dataset_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, dtable_name)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not dtable.is_owned_by_group:
            error_msg = _('Common dataset could only be created from group owned dtables.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % dtable.workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_server_url = get_inner_dtable_server_url()
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), dtable_server_url)

        metadata = dtable_server_api.get_metadata()

        tables = metadata.get('tables', [])
        target_table = next(filter(lambda table: table.get('name') == table_name, tables), None)

        if not target_table:
            error_msg = 'table %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        target_view = next(filter(lambda view: view.get('name') == view_name, target_table['views']), None)

        if not target_view:
            error_msg = 'view %s not found.' % view_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check duplicate by dtable uuid, table id, view id
        set_duplicates = DTableCommonDataset.objects.filter(org_id=org_id, dtable_uuid=dtable.uuid, table_id=target_table['_id'], view_id=target_view['_id'])
        if len(set_duplicates) >= 1:
            error_msg = _('Common dataset for view %s already exists.') % (view_name)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        common_dataset = DTableCommonDataset.objects.create(
            org_id=org_id,
            group_id=dtable.get_owner_group_id(),
            dtable_uuid=dtable.uuid,
            table_id=target_table['_id'],
            view_id=target_view['_id'],
            creator=request.user.username,
            created_at=timezone.now(),
            dataset_name=dataset_name,
        )

        return Response(common_dataset.to_dict())


class DTableCommonDatasetView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, dataset_id):
        """ return dataset contents
        """
        # argument check
        try:
            start = int(request.GET.get('start', ''))
        except ValueError:
            start = 0

        try:
            limit = int(request.GET.get('limit', ''))
        except ValueError:
            limit = 25

        # resource check
        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not dataset.can_access_by_user_through_group(request.user.username):
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # generate json web token
        dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base %s not found.' % dataset.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        username = request.user.username

        # get base's metadata
        dtable_server_url = get_inner_dtable_server_url()
        server_api = DTableServerAPI(
            username,
            str(dtable.uuid),
            dtable_server_url
        )

        try:
            dtable_metadata = server_api.get_metadata()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # get target table
        tables = dtable_metadata.get('tables', [])
        target_table = {}
        for table in tables:
            if table.get('_id', '') == dataset.table_id:
                target_table = table
                break

        if not target_table:
            error_msg = _('Table %s not found.') % dataset.table_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # get target view
        target_view = {}
        views = target_table.get('views', [])
        for view in views:
            if view.get('_id', '') == dataset.view_id:
                target_view = view
                break

        if not target_view:
            error_msg = _('View %s not found.') % dataset.view_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # get columns
        show_cols = []
        hidden_columns = target_view.get('hidden_columns', [])

        cols = target_table.get('columns', [])
        for col in cols:
            if col['key'] in hidden_columns:
                continue
            show_cols.append(col)

        view_filters = target_view.get('filters', [])
        view_sorts = target_view.get('sorts', [])
        view_filter_conjunction = target_view.get('filter_conjunction', 'And')
        filter_conditions = {
            'start': start,
            'limit': limit,
            'filters': view_filters or [],
            'filter_conjunction': view_filter_conjunction or 'And',
            'sorts': view_sorts or []
        }


        import dtable_events
        try:
            query_columns_str = ', '.join(map(lambda x: f"`{x['name']}`", show_cols))
            sql = dtable_events.filter2sql(
                target_table['name'], target_table['columns'], filter_conditions, by_group=False)
            sql = sql.replace('*', query_columns_str, 1)
        except dtable_events.SQLGeneratorOptionInvalidError:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid option in single or multiple select columns')
        except dtable_events.DateTimeQueryInvalidError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid query in column %s' % e.column_name)
        except dtable_events.ColumnFilterInvalidError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, e.msg)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        db_api = DTableDBAPI(
            username,
            str(dataset.dtable_uuid),
            INNER_DTABLE_DB_URL,
        )
        
        try:
            result = db_api.query(sql, server_only=True)
            if not result.get('success'):
                logger.error('query common dataset: %s content sql: %s query error resp: %s', dataset_id, sql, result)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, result.get('error_message', 'Internal Server Error'))
            rows_data = {
                'rows': result['results']
            }
        except Exception as e:
            logger.error('query common dataset: %s content sql: %s query error %s', dataset_id, sql, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # get related_user_list
        related_user_emails = list_dtable_related_users(workspace=workspace, dtable=dtable)
        related_user_list = [get_user_common_info(email) for email in related_user_emails]

        rows_data.update({'columns': show_cols, 'related_user_list': related_user_list})
        return Response(rows_data)

    def put(self, request, dataset_id):
        dataset_name = request.data.get('dataset_name')

        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % dtable.workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not dataset.can_manage_by_user(request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if dataset_name:
            dataset.dataset_name = dataset_name

        dataset.save()

        dataset_info = dataset.to_dict()
        dataset_info['can_manage'] = dataset.can_manage_by_user(request.user.username)
        dataset_info['dtable_name'] = dtable.name
        dataset_info['workspace_id'] = dtable.workspace_id
        dataset_info['dtable_icon'] = dtable.icon
        dataset_info['dtable_color'] = dtable.color

        return Response({'dataset': dataset_info})


    def delete(self, request, dataset_id):

        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % dtable.workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not dataset.can_manage_by_user(request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dataset.delete()

        return Response({'success': True})


class DTableCommonDatasetSyncsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """
        list common dataset sync record from dst dtable
        """
        dst_dtable_uuid = request.query_params.get('dst_dtable_uuid', '')
        if not dst_dtable_uuid:
            error_msg = 'dst_dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid, include_deleted=False)
        if not dst_dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        if not check_dtable_permission(request.user.username, dst_dtable.workspace, dst_dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        dtable_server_api = DTableServerAPI(request.user.username, str(dst_dtable.uuid), dtable_server_url)
        dst_metadata = dtable_server_api.get_metadata()

        dataset_sync_query_set = DTableCommonDatasetSync.objects.filter(
            dst_dtable_uuid=dst_dtable_uuid,
        ).select_related('dataset')
        dataset_dtable_uuids = list(dataset_sync_query_set.values_list('dataset__dtable_uuid', flat=True))
        valid_dtable_uuids = set(DTables.objects.filter(uuid__in=dataset_dtable_uuids, deleted=False).values_list('uuid', flat=True))
        result_sync_list = []
        metadate_dict = {}
        for dataset_sync in dataset_sync_query_set:
            if dataset_sync.dataset.dtable_uuid in valid_dtable_uuids:
                dst_table = next(filter(lambda table: table['_id'] == dataset_sync.dst_table_id, dst_metadata['tables']), None)
                if not dst_table:
                    continue
                src_dtable_uuid = str(dataset_sync.dataset.dtable_uuid)
                if src_dtable_uuid in metadate_dict:
                    metadata = metadate_dict[src_dtable_uuid]
                else:
                    dtable_server_api = DTableServerAPI(request.user.username, src_dtable_uuid, dtable_server_url)
                    metadata = metadate_dict[src_dtable_uuid] = dtable_server_api.get_metadata()
                src_table_id, src_view_id = dataset_sync.dataset.table_id, dataset_sync.dataset.view_id
                src_table = next(filter(lambda table: table['_id'] == src_table_id, metadata['tables']), None)
                if not src_table:
                    continue
                src_view = next(filter(lambda view: view['_id'] == src_view_id, src_table['views']), None)
                if not src_view:
                    continue
                result_sync_list.append(dataset_sync)

        dataset_sync_list = [dataset_sync.to_dict() for dataset_sync in result_sync_list]

        return Response({'dataset_sync_list': dataset_sync_list})


class DTableCommonDatasetTableImportView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, dataset_id):
        """ import common dateset to a dtable

            dtable-web part handle common dataset resource and perm
            dtable-events part handle table data operation, and update sync info
        """

        dst_dtable_uuid = request.data.get('dst_dtable_uuid', '')
        if not dst_dtable_uuid:
            error_msg = 'dst_dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid, include_deleted=False)
        if not dst_dtable:
            error_msg = 'Base %s not found.' % dst_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if check_dtable_permission(request.user.username, dst_dtable.workspace, dst_dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not dataset.can_access_by_dtable(dst_dtable):
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # generate json web token
        src_dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not src_dtable:
            error_msg = 'Base %s not found.' % dataset.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(src_dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        lang = Profile.objects.get_user_language(request.user.username)
        assets, error = gen_src_dst_assets(dst_dtable, src_dtable, dataset.table_id, dataset.view_id, None, dataset.dataset_name, request.user.username)
        if error:
            return error
        context = {
            'src_dtable_uuid': str(src_dtable.uuid),
            'dst_dtable_uuid': str(dst_dtable.uuid),
            'src_table': assets.get('src_table'),
            'src_view_id': dataset.view_id,
            'dst_table_name': dataset.dataset_name,
            'operator': request.user.username,
            'lang': lang,
            'dataset_id': dataset.id,
            'org_id': dst_dtable.workspace.org_id
        }

        try:
            task_id = add_import_common_dataset_task(context)
        except Exception as e:
            logger.error('add import common dataset error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'task_id': task_id})



class CommonDatasetSyncWithExistTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dataset_id):
        dst_dtable_uuid = request.data.get('dst_dtable_uuid')
        if not dst_dtable_uuid:
            error_msg = 'dst_dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dst_table_id = request.data.get('dst_table_id')
        if not dst_table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dst_table_id invalid')
        is_sync_periodically = request.data.get('is_sync_periodically', 'false')
        try:
            is_sync_periodically = to_python_boolean(is_sync_periodically)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'is_sync_periodically invalid')

        # resource check
        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if dataset.dtable_uuid == uuid_str_to_32_chars(dst_dtable_uuid) and dataset.table_id == dst_table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Can not import dataset from self')

        # perhaps old sync not deleted
        sync_obj = DTableCommonDatasetSync.objects.filter(dst_dtable_uuid=dst_dtable_uuid, dst_table_id=dst_table_id).select_related('dataset').first()
        if sync_obj:
            if not sync_obj.is_valid:  # delete invalid sync
                sync_obj.delete()
            else:
                is_old_valid = True
                old_dataset = sync_obj.dataset
                old_src_dtable_api = DTableServerAPI('dtable-web', old_dataset.dtable_uuid.hex, dtable_server_url)
                old_src_metadata = old_src_dtable_api.get_metadata()
                old_src_tables = old_src_metadata.get('tables') or []
                old_src_table = next(filter(lambda t: t['_id'] == old_dataset.table_id, old_src_tables), None)
                if not old_src_table:
                    is_old_valid = False
                else:
                    old_src_views = old_src_table.get('views') or []
                    old_src_view = next(filter(lambda v: v['_id'] == old_dataset.view_id, old_src_views), None)
                    if not old_src_view:
                        is_old_valid = False
                if is_old_valid:  # bound with another dataset
                    if sync_obj.dataset.id != dataset.id:
                        error_msg = 'Table has been bound with another dataset'
                        return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                    # sync exists and is valid
                    return Response({'sync_info': sync_obj.to_dict()})
                else:
                    sync_obj.delete()

        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid, include_deleted=False)
        if not dst_dtable:
            error_msg = 'Base %s not found.' % dst_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        src_dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not src_dtable:
            error_msg = 'Base %s not found.' % dataset.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if check_dtable_permission(request.user.username, dst_dtable.workspace, dst_dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not dataset.can_access_by_dtable(dst_dtable):
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dst_dtable_server_api = DTableServerAPI(request.user.username, dst_dtable_uuid, dtable_server_url)
        try:
            metadata = dst_dtable_server_api.get_metadata()
        except Exception as e:
            logger.error('request dtable: %s metadata error: %s', dst_dtable_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        dst_table = next(filter(lambda table: table['_id'] == dst_table_id, metadata.get('tables', [])), None)
        if not dst_table:
            return api_error(status.HTTP_404_NOT_FOUND, 'Table %s not found' % dst_table_id)

        src_dtable_server_api = DTableServerAPI(request.user.username, src_dtable.uuid.hex, dtable_server_url)
        try:
            metadata = src_dtable_server_api.get_metadata()
        except Exception as e:
            logger.error('request dtable: %s metadata error: %s', dst_dtable_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        src_table = next(filter(lambda table: table['_id'] == dataset.table_id, metadata.get('tables', [])), None)
        if not src_table:
            return api_error(status.HTTP_404_NOT_FOUND, 'Table %s not found' % dataset.table_id)

        src_first_column = src_table['columns'][0]
        expect_column_type = None
        if src_first_column['type'] == ColumnTypes.FORMULA:
            data = src_first_column.get('data') or {}
            result_type = data.get('result_type', 'string')
            if result_type == 'date':
                expect_column_type = ColumnTypes.DATE
            elif result_type == 'number':
                expect_column_type = ColumnTypes.NUMBER
            elif result_type == 'bool':
                expect_column_type = ColumnTypes.CHECKBOX
            else:
                expect_column_type = ColumnTypes.TEXT
        elif src_first_column['type'] == ColumnTypes.AUTO_NUMBER:
            expect_column_type = ColumnTypes.TEXT
        else:
            expect_column_type = src_first_column['type']
        if dst_table['columns'][0].get('type') != expect_column_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'The first column must be of type %s' % expect_column_type)

        try:
            # Set last_sync_time older for sync after requesting this api
            # because there is sync interval check in sync api
            sync_obj = DTableCommonDatasetSync.objects.create(
                dataset=dataset,
                dst_dtable_uuid=dst_dtable.uuid,
                dst_table_id=dst_table_id,
                creator=request.user.username,
                last_sync_time=timezone.now() - timedelta(days=1),
                src_version=0,
                is_sync_periodically=is_sync_periodically
            )
        except Exception as e:
            logger.error('add sync error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'sync_info': sync_obj.to_dict()})


class DTableCommonDatasetTableSyncView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (SyncCommonDatasetThrottle, )

    def post(self, request, dataset_id):
        """ import common dateset to a dtable

            dtable-web part handle common dataset resource and perm
            dtable-events part handle table data operation, and update sync info
        """

        dst_dtable_uuid = request.data.get('dst_dtable_uuid', '')
        if not dst_dtable_uuid:
            error_msg = 'dst_dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dst_table_id = str(request.data.get('dst_table_id', ''))
        if not dst_table_id:
            error_msg = 'dst_table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid, include_deleted=False)
        if not dst_dtable:
            error_msg = 'Base %s not found.' % dst_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if check_dtable_permission(request.user.username, dst_dtable.workspace, dst_dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not dataset.can_access_by_dtable(dst_dtable):
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # generate json web token
        src_dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not src_dtable:
            error_msg = 'Base %s not found.' % dataset.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(src_dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # create or update sync record
        db_dataset_sync = DTableCommonDatasetSync.objects.filter(
            dataset=dataset,
            dst_dtable_uuid=dst_dtable_uuid,
            dst_table_id=dst_table_id,
        ).first()
        if not db_dataset_sync:
            error_msg = 'Commonn dataset sync record not found. Please import first.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if db_dataset_sync.last_sync_time and (timezone.now() - db_dataset_sync.last_sync_time) < timedelta(seconds=SYNC_COMMON_DATASET_INTERVAL):
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, _('A common dataset can only be synced once every 5 minutes'))

        lang = Profile.objects.get_user_language(request.user.username)
        assets, error = gen_src_dst_assets(dst_dtable, src_dtable, dataset.table_id, dataset.view_id, dst_table_id, None, request.user.username)
        if error:
            return error

        context = {
            'src_dtable_uuid': str(src_dtable.uuid),
            'dst_dtable_uuid': str(dst_dtable.uuid),
            'src_table': assets.get('src_table'),
            'src_view_id': dataset.view_id,
            'src_version': assets.get('src_version'),
            'dst_table_id': dst_table_id,
            'dst_table_name': assets.get('dst_table_name'),
            'dst_columns': assets.get('dst_columns'),
            'operator': request.user.username,
            'lang': lang,
            'dataset_id': dataset.id,
            'org_id': dst_dtable.workspace.org_id,
            'sync_id': db_dataset_sync.id
        }

        try:
            task_id, status_code = add_sync_common_dataset_task(context)
        except Exception as e:
            logger.error('add sync common dataset error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        if status_code == 429:
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, _('A common dataset can only be synced once every 5 minutes'))
        elif status_code != 200:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})

    def put(self, request, dataset_id):
        """
        update sync info
        """

        is_sync_periodically = request.data.get('is_sync_periodically', None)
        sync_interval = request.data.get('sync_interval', None)

        if is_sync_periodically:
            try:
                is_sync_periodically = to_python_boolean(is_sync_periodically)
            except:
                error_msg = 'is_sync_periodically invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if sync_interval and sync_interval not in ['per_day', 'per_hour']:
            error_msg = 'sync type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dst_dtable_uuid = request.data.get('dst_dtable_uuid', '')
        if not dst_dtable_uuid:
            error_msg = 'dst_dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dst_table_id = str(request.data.get('dst_table_id', ''))
        if not dst_table_id:
            error_msg = 'dst_table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dst_dtable = DTables.objects.get_dtable_by_uuid(dst_dtable_uuid, include_deleted=False)
        if not dst_dtable:
            error_msg = 'Base %s not found.' % dst_dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if check_dtable_permission(request.user.username, dst_dtable.workspace, dst_dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not dataset.can_access_by_dtable(dst_dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # generate json web token
        src_dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not src_dtable:
            error_msg = 'Base %s not found.' % dataset.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(src_dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # create or update sync record
        dataset_sync_query_set = DTableCommonDatasetSync.objects.get(
            dataset=dataset,
            dst_dtable_uuid=dst_dtable_uuid,
            dst_table_id=dst_table_id,
        )
        if not dataset_sync_query_set:
            error_msg = 'Commonn dataset sync record not found. Please import first.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            if is_sync_periodically is not None:
                dataset_sync_query_set.is_sync_periodically = is_sync_periodically
            if sync_interval:
                dataset_sync_query_set.sync_interval = sync_interval
            dataset_sync_query_set.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableCommonDatasetForceSyncView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dataset_id):
        # arguments check
        if not isinstance(request.data, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request')
        dst_dtable_uuids = request.data.get('dst_dtable_uuids')
        if not isinstance(dst_dtable_uuids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'dst_dtable_uuids invalid')
        for dst_dtable_uuid in dst_dtable_uuids:
            try:
                UUID(dst_dtable_uuid)
            except ValueError:
                return api_error(status.HTTP_400_BAD_REQUEST, 'dst_dtable_uuids invalid')
        # resource check
        dataset = DTableCommonDataset.objects.filter(id=dataset_id).first()
        if not dataset:
            return api_error(status.HTTP_404_NOT_FOUND, 'Dataset not found')
        dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        dst_dtable_uuids = [dtable_uuid.hex for dtable_uuid in DTableCommonDatasetSync.objects.filter(dst_dtable_uuid__in=dst_dtable_uuids).values_list('dst_dtable_uuid', flat=True)]
        if not dst_dtable_uuids:
            return api_error(status.HTTP_404_NOT_FOUND, 'Destination bases not found')
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), dtable_server_url)
        metadata = dtable_server_api.get_metadata()
        tables = metadata.get('tables') or []
        table = next(filter(lambda t: t['_id'] == dataset.table_id, tables), None)
        if not table:
            return api_error(status.HTTP_404_NOT_FOUND, 'Table not found')
        views = table.get('views') or []
        view = next(filter(lambda v: v['_id'] == dataset.view_id, views), None)
        if not view:
            return api_error(status.HTTP_404_NOT_FOUND, 'View not found')

        # check dtable permission
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        context = {
            'dataset_id': dataset_id,
            'operator': username,
            'src_dtable_uuid': str(dtable.uuid),
            'dst_dtable_uuids': dst_dtable_uuids
        }
        try:
            task_id, status_code = add_force_sync_common_dataset_task(context)
        except Exception as e:
            logger.error('add sync common dataset error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        if status_code == 429:
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, _('A common dataset can only be synced once every 5 minutes'))
        elif status_code != 200:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class DTableCommonDatasetInfoView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @staticmethod
    def get_metadata(dtable_uuid):
        """
        :return: metadata -> dict or None, error -> api_error or None
        """
        dtable_uuid = uuid_str_to_36_chars(dtable_uuid)
        dtable_server_url = get_inner_dtable_server_url()
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, dtable_server_url)
        try:
            metadata = dtable_server_api.get_metadata()
            return metadata, None
        except Exception as e:
            logger.exception('get dtable: %s metadata error: %s', dtable_uuid, e)
            return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    def get(self, request, dataset_id):
        """
        return dataset info
        """
        # resource check
        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not dataset.can_access_by_user_through_group(request.user.username):
            error_msg = 'Permission Denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dataset.dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base %s not found.' % dataset.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_metadata, error = self.get_metadata(dataset.dtable_uuid.hex)
        if error:
            return error

        dataset_info = {'table_name': '', 'view_name': ''}
        dataset_table_id = dataset.table_id
        dataset_view_id = dataset.view_id
        tables = dtable_metadata.get('tables')
        id_to_table_info = {table['_id']: table for table in tables}
        if id_to_table_info.get(dataset_table_id):
            views = id_to_table_info.get(dataset_table_id).get('views')
            id_to_view_info = {view['_id']: view for view in views}
            dataset_info['view_name'] = id_to_view_info.get(dataset_view_id) and id_to_view_info.get(dataset_view_id).get('name') or ''
            dataset_info['table_name'] = id_to_table_info.get(dataset_table_id).get('name')

        dst_uuid_table_ids_dict = {}
        for sync in DTableCommonDatasetSync.objects.filter(dataset_id=dataset_id):
            if sync.dst_dtable_uuid.hex not in dst_uuid_table_ids_dict:
                dst_uuid_table_ids_dict[sync.dst_dtable_uuid.hex] = [sync]
            else:
                dst_uuid_table_ids_dict[sync.dst_dtable_uuid.hex].append(sync)
        dst_uuids = list(dst_uuid_table_ids_dict.keys())
        group_ids = []
        dst_uuid_group_id_dict = {}
        dst_dtables_dict = {}
        dst_dtables = DTables.objects.filter(uuid__in=dst_uuids, deleted=False).select_related('workspace')
        for dst_dtable in dst_dtables:
            owner = dst_dtable.workspace.owner
            if '@seafile_group' not in owner:
                continue
            group_id = int(owner.split('@')[0])
            if group_id not in group_ids:
                group_ids.append(group_id)
            dst_dtables_dict[dst_dtable.uuid.hex] = dst_dtable
            dst_uuid_group_id_dict[dst_dtable.uuid.hex] = group_id

        group_infos_dict = get_groups_info(group_ids)

        import_groups = []
        group_index_dict = {}
        for dst_dtable_uuid, syncs in dst_uuid_table_ids_dict.items():
            if dst_dtable_uuid not in dst_uuid_group_id_dict:
                continue
            dst_metadata, error = self.get_metadata(dst_dtable_uuid)
            if error:
                return error
            dst_tables = []
            for tmp_table in dst_metadata['tables']:
                sync = None
                for tmp_sync in syncs:
                    if tmp_table['_id'] == tmp_sync.dst_table_id:
                        sync = tmp_sync
                        break
                if not sync:
                    continue
                dst_tables.append({
                    'table_id': tmp_table['_id'],
                    'table_name': tmp_table['name'],
                    'last_sync_time': sync.last_sync_time
                })
            if not dst_tables:
                continue
            group_id = dst_uuid_group_id_dict[dst_dtable_uuid]
            if group_id not in group_index_dict:
                if not group_infos_dict.get(group_id):
                    continue
                dst_dtable = dst_dtables_dict[dst_dtable_uuid]
                imported_group = {
                    'group_id': group_id,
                    'group_name': group_infos_dict[group_id]['group_name'],
                    'import_dtables': [{
                        'dtable_uuid': dst_dtable_uuid,
                        'dtable_name': dst_dtable.name,
                        'color': dst_dtable.color,
                        'text_color': dst_dtable.text_color,
                        'icon': dst_dtable.icon,
                        'import_tables': dst_tables
                    }]
                }
                group_index_dict[group_id] = len(import_groups)
                import_groups.append(imported_group)
            else:
                group_index = group_index_dict[group_id]
                dst_dtable = dst_dtables_dict[dst_dtable_uuid]
                import_groups[group_index]['import_dtables'].append({
                    'dtable_uuid': uuid_str_to_36_chars(dst_dtable_uuid),
                    'dtable_name': dst_dtable.name,
                    'color': dst_dtable.color,
                    'text_color': dst_dtable.text_color,
                    'icon': dst_dtable.icon,
                    'import_tables': dst_tables
                })

        dataset_info['import_groups'] = import_groups

        # {table_name, view_name, import_groups: [{group_id, group_name, import_dtables: [{dtable_uuid, dtable_name, import_tables: [{table_id, table_name}]}]}]}
        return Response({'dataset_info': dataset_info})

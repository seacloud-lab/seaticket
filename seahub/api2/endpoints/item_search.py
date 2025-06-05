import json
import logging
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from seaserv import seafile_api, ccnet_api
from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import CanUseExternalApp
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces, DTables, UserStarredDTables, DTableShare, DTableGroupShare, \
    DTableViewUserShare, DTableViewGroupShare
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.utils import USER_BASE_CACHE_PREFIX, USER_WORKFLOW_CACHE_PREFIX, USER_BASE_CACHE_TIMEOUT, \
    USER_WORKFLOW_CACHE_TIMEOUT, USER_APP_CACHE_PREFIX, USER_APP_CACHE_TIMEOUT
from seahub.dtable_apps.universal_app.models import DTableAppUsers
from seahub.dtable_apps.workflow.models import DTableWorkflows, DTableWorkflowShare
from seahub.group.utils import get_user_groups, group_id_to_name, get_user_admin_group_ids as group_get_user_admin_group_ids
from seahub.utils import is_org_context, uuid_str_to_36_chars, normalize_cache_key
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.utils.timeutils import datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)

QUERY_TYPES = [
    'base',
    'workflow',
    'app'
]


def _get_all_avalilable_dtables(request):
    username = request.user.username
    cache_key = normalize_cache_key(username, USER_BASE_CACHE_PREFIX)
    dtables = cache.get(cache_key)
    if dtables:
        return dtables

    groups = get_user_groups(username, return_ancestors=True)

    group_id_list = [group.id for group in groups]
    owner_list = [username] + ['%s@seafile_group' % group_id for group_id in group_id_list]
    workspaces = Workspaces.objects.filter(owner__in=owner_list)
    dtables = []

    starred_table_uuid_list = set()

    # user dtables
    dtable_list = DTables.objects.filter(workspace__in=workspaces, deleted=False).select_related()

    # shared dtables to user
    shared_tables_by_user = DTableShare.objects.filter(
        to_user=username, dtable__deleted=False).select_related('dtable')
    
    # shared views to user
    shared_views_by_user = DTableViewUserShare.objects.filter(
        to_user=username, dtable__deleted=False).select_related('dtable')
    
    # shared dtables to groups
    group_shared_table_list = DTableGroupShare.objects.filter(
        group_id__in=group_id_list, dtable__deleted=False).select_related('dtable')
    
    # shared views to groups
    group_shared_view_list = DTableViewGroupShare.objects.filter(
        to_group_id__in=group_id_list, dtable__deleted=False).select_related('dtable')

    starred_table_uuid_set = set(UserStarredDTables.objects.get_dtable_uuids_by_email(username))

    for table in dtable_list:
        owner = table.workspace.owner
        table_info = table.to_dict()
        if '@seafile_group' in owner:
            group_id = int(owner.split('@')[0])
            table_info['group_name'] = group_id_to_name(group_id)
            table_info['type'] = 'group'
            table_info['group_id'] = group_id
        else:
            table_info['group_name'] = 'personal'
            table_info['type'] = 'personal'

        if table.uuid.hex in starred_table_uuid_set:
            table_info['starred'] = True
            if table.uuid.hex not in starred_table_uuid_list:
                starred_table_uuid_list.add(table.uuid.hex)
        else:
            table_info['starred'] = False
        dtables.append(table_info)

    for table in shared_tables_by_user:
        table_info = table.dtable.to_dict()
        table_info['share_id'] = table.id
        table_info['share_type'] = 'user-share'
        table_info['group_name'] = 'shared'
        table_info['type'] = 'shared'
        if table.dtable.uuid.hex in starred_table_uuid_set:
            table_info['starred'] = True
            if table.dtable.uuid.hex not in starred_table_uuid_list:
                starred_table_uuid_list.add(table.dtable.uuid.hex)
        else:
            table_info['starred'] = False
        table_info['from_user'] = table.from_user
        table_info['permission'] = table.permission
        avatar_url, is_default, date_uploaded = api_avatar_url(table.from_user)
        table_info['from_user_avatar'] = avatar_url
        if '@seafile_group' in table.from_user:
            group_id = table.from_user.split('@')[0]
            table_info['from_user_name'] = group_id_to_name(group_id)
        else:
            table_info['from_user_name'] = email2nickname(table.from_user)
        dtables.append(table_info)

    for table in group_shared_table_list:
        table_info = table.dtable.to_dict()
        table_info['share_id'] = table.id
        table_info['share_type'] = 'group-share'
        table_info['group_name'] = 'shared'
        table_info['type'] = 'shared'
        group_id = table.group_id
        table_info['group_name'] = group_id_to_name(group_id)
        if table.dtable.uuid.hex in starred_table_uuid_set:
            table_info['starred'] = True
            if table.dtable.uuid.hex not in starred_table_uuid_list:
                starred_table_uuid_list.add(table.dtable.uuid.hex)
        else:
            table_info['starred'] = False

        dtables.append(table_info)
        
    for table in shared_views_by_user:
        table_info = table.dtable.to_dict()
        table_info['share_id'] = table.id
        table_info['shared_name'] = table.shared_name
        table_info['share_type'] = 'user-view-share'
        table_info['group_name'] = 'shared'
        table_info['type'] = 'shared'
        if table.dtable.uuid.hex in starred_table_uuid_set:
            table_info['starred'] = True
            if table.dtable.uuid.hex not in starred_table_uuid_list:
                starred_table_uuid_list.add(table.dtable.uuid.hex)
        else:
            table_info['starred'] = False
        table_info['from_user'] = table.from_user
        table_info['permission'] = table.permission
        avatar_url, is_default, date_uploaded = api_avatar_url(table.from_user)
        table_info['from_user_avatar'] = avatar_url
        if '@seafile_group' in table.from_user:
            group_id = table.from_user.split('@')[0]
            table_info['from_user_name'] = group_id_to_name(group_id)
        else:
            table_info['from_user_name'] = email2nickname(table.from_user)
        dtables.append(table_info)
        
    for table in group_shared_view_list:
        table_info = table.dtable.to_dict()
        table_info['share_id'] = table.id
        table_info['shared_name'] = table.shared_name
        table_info['share_type'] = 'group-view-share'
        table_info['group_name'] = 'shared'
        table_info['type'] = 'shared'
        group_id = table.to_group_id
        table_info['group_name'] = group_id_to_name(group_id)
        if table.dtable.uuid.hex in starred_table_uuid_set:
            table_info['starred'] = True
            if table.dtable.uuid.hex not in starred_table_uuid_list:
                starred_table_uuid_list.add(table.dtable.uuid.hex)
        else:
            table_info['starred'] = False

        dtables.append(table_info)
        
    cache.set(cache_key, dtables, USER_BASE_CACHE_TIMEOUT)
    return dtables

def _get_all_available_workflows(request):

    username = request.user.username
    cache_key = normalize_cache_key(username, USER_WORKFLOW_CACHE_PREFIX)
    workflows = cache.get(cache_key)
    if workflows:
        return workflows
    groups = get_user_groups(username, return_ancestors=False)
    if not groups:
        return []

    group_ids = [group.id for group in groups]

    groups_dict = {group.id: group for group in groups}

    workflow_id_set = set()
    workflows = []
    workflows_qset = DTableWorkflows.objects.get_workflows_by_group_ids(group_ids)
    for workflow in workflows_qset:
        group_id = int(workflow.owner.split('@')[0])
        workflow_info = workflow.to_dict()
        workflow_info['group_id'] = group_id
        group_obj = groups_dict.get(group_id)
        workflow_info['group_name'] = group_obj and group_obj.group_name or group_id_to_name(group_id)
        workflow_info['is_shared'] = False
        workflow_id_set.add(workflow_info['id'])
        workflows.append(workflow_info)

    wf_shares = DTableWorkflowShare.objects.list_by_group_ids(group_ids)
    for wf_share in wf_shares:
        shared_group_id = wf_share.group_id
        workflow = wf_share.dtable_workflow
        group_id = int(workflow.owner.split('@')[0])
        group_obj = groups_dict.get(group_id)
        shared_group_obj = groups_dict.get(shared_group_id)
        workflow_info = workflow.to_dict()
        if workflow_info['id'] in workflow_id_set:
            continue
        workflow_info['group_id'] = group_id
        workflow_info['group_name'] = group_obj and group_obj.group_name or group_id_to_name(group_id)
        workflow_info['shared_group_id'] = shared_group_id
        workflow_info['shared_group_name'] = shared_group_obj and shared_group_obj.group_name or group_id_to_name(shared_group_id)
        workflow_info['is_shared'] = True

        workflow_id_set.add(workflow_info['id'])
        workflows.append(workflow_info)
    cache.set(cache_key, workflows, USER_WORKFLOW_CACHE_TIMEOUT)
    return workflows

def _get_all_available_apps(request):
    username = request.user.username
    cache_key = normalize_cache_key(username, USER_APP_CACHE_PREFIX)
    apps = cache.get(cache_key)
    if apps:
        return apps
    apps = []
    app_users = DTableAppUsers.objects.filter(username=username)
    for user in app_users:
        app = user.app
        app_user_id = user.id
        role = user.role
        role_name = role.role_name
        dtable_uuid = app.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(
            uuid_str_to_36_chars(dtable_uuid)
        )
        if not dtable:
            continue

        if dtable.deleted:
            continue

        info_dict = {
            'app_user_id': app_user_id,
            'app_id': app.pk,
            'app_name': app.app_name,
            'app_uuid': app.app_uuid,
            'app_config': app.app_config,
            'role_name': role_name,
            'permission': role.role_permission,
            'dtable_uuid': dtable_uuid,
            'dtable_name': dtable.name,
            'workspace_id': dtable.workspace_id,
            'link': app.link,
            'edit_link': app.edit_link,
            'joined_at': datetime_to_isoformat_timestr(user.created_at)
        }
        apps.append(info_dict)
    cache.set(cache_key, apps, USER_APP_CACHE_TIMEOUT)
    return apps

def _query_dtables(request, query_str):
    all_dtables = _get_all_avalilable_dtables(request)
    query_result = []
    query_str = query_str.lower()
    for dt in all_dtables:
        dt_name = (dt.get('shared_name') or dt.get('name') or '').lower()
        if query_str in dt_name:
            query_result.append(dt)
    return query_result

def _query_workflows(request, query_str):
    username = request.user.username
    admin_group_ids = set(group_get_user_admin_group_ids(username))
    all_workflows = _get_all_available_workflows(request)
    query_result = []
    query_str = query_str.lower()
    for wf in all_workflows:
        group_id = wf.get('group_id')
        is_workflow_admin = group_id in admin_group_ids
        wf['is_admin'] = is_workflow_admin
        wf_config = json.loads(wf.get('workflow_config'))
        wf_name = wf_config.get('workflow_name').lower()
        if query_str in wf_name:
            query_result.append(wf)
    return query_result

def _query_apps(request, query_str):
    all_apps = _get_all_available_apps(request)
    query_result = []
    query_str = query_str.lower()
    for app in all_apps:
        app_name = app.get('app_name').lower()
        if query_str in app_name:
            query_result.append(app)
    return query_result

def query_items(request, query_str, query_type):
    if query_type == 'base':
        return _query_dtables(request, query_str)
    elif query_type == 'workflow':
        return _query_workflows(request, query_str)
    elif query_type == 'app':
        return _query_apps(request, query_str)
    return []



class DTableItemsSearchView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """search items
        """
        query_str = request.GET.get('query_str', '')
        query_type = request.GET.get('query_type', '')

        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if query_type not in QUERY_TYPES:
            error_msg = 'query type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            results = query_items(request, query_str, query_type)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'results': results})

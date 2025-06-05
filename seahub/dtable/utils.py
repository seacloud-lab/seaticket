import base64
import os
import re
import jwt
import time
import requests
import json
import logging
import shutil
import random
import string
from datetime import datetime
from urllib.parse import quote, urljoin, unquote
from uuid import uuid4

from django.core.cache import cache
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.hashers import check_password
from django.conf import settings

from seahub.api2.authentication import AUTHORIZATION_PREFIX
from seahub.auth.models import AnonymousUser, UserQuota
from seahub.base.accounts import User
from seahub.department_v2.models import DepartmentMembersV2
from seahub.department_v2.utils import get_ancestor_groups_by_department, get_departments_map_by_username
from seahub.dtable.constants import DTABLE_ASSET_DOWNLOAD_PERMISSION, ORG_STORAGE_SIZE_PREFIX, DTABLE_RELATED_USERS_CACHE_TIMEOUT, \
    DTABLE_RELATED_USERS_PREFIX, DTABLE_RELATED_USERS_INFO_PREFIX, DTABLE_ASSET_READ_PERMISSION, VALID_OPTION_TAGS, \
    ORG_BIG_DATA_TOTAL_STORAGE_PREFIX, ORG_BIG_DATA_TOTAL_ROWS_PREFIX, \
    DTABLE_APP_USERS_PREFIX, DTABLE_APP_USERS_INFO_PREFIX, DTABLE_APP_USERS_CACHE_TIMEOUT, ColumnTypes, \
    DTABLE_IS_ADVANCE_CACHE_TIMEOUT, DTABLE_IS_ADVANCE_PREFIX
from seahub.dtable.models import DTableShare, Workspaces, DTableFormShare, DTables, DTableGroupShare, \
    DTableRowsCount, UserRowsCount, OrgRowsCount, DTableExternalApps, \
    DTableForms, DTableViewUserShare, DTableViewGroupShare, DTableSharePermission, DTableAPIToken, \
    OrgBigDataStorageStats, DTableAutomationRules, DTableNotificationRules, CustomAssetUUID, DTableCommonDatasetSync, \
    StatsAPIGatewayByTeam, IdInOrgTuple
from seahub.group.utils import get_user_groups, is_group_member, is_group_admin_or_owner, get_group_members, get_user_admin_group_ids
from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_READ, PERMISSION_ADMIN, \
    PERMISSION_PREFIX

from seaserv import ccnet_api, seafile_api

from seahub.organizations.models import OrgSettings, OrgQuota
from seahub.profile.settings import USER_DEPT_CACHE_PREFIX
from seahub.profile.models import Profile
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from seahub.utils import check_filename_with_rename, gen_file_upload_url, get_service_url, normalize_cache_key, is_image_asset_type, \
    get_file_type_and_ext, is_pro_version, uuid_str_to_36_chars, update_page_design_static_image, get_inner_dtable_server_url, \
    rename_universal_app_static_assets_dir, update_universal_app_custom_page_static_image, update_universal_app_single_record_page_static_assets, normalize_file_path
from seahub.constants import DEFAULT_USER
from seahub.settings import DTABLE_PRIVATE_KEY, DTABLE_EVENTS_IO_SERVER_URL, INNER_DTABLE_DB_URL, TEMPLATE_BASE_API_TOKEN, \
    ACCESS_FILE_TYPES_THROUGH_EXTERNAL_LINK, \
    SEATABLE_FAAS_URL, DTABLE_WEB_SERVICE_URL, \
    ENABLE_WORKFLOW, AUDIT_FILE_TYPES
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.utils.storage_backend import storage_backend
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.audit_log.signals import file_audit_operation

try:
    from seahub.settings import CLOUD_MODE
except ImportError:
    CLOUD_MODE = False

logger = logging.getLogger(__name__)

UPLOAD_IMG_RELATIVE_PATH = 'images'
UPLOAD_FILE_RELATIVE_PATH = 'files'
CUSTOM_RELATIVE_PATH = 'custom'
UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH = 'digital-signs'

COLLECTION_TABLE_RELATIVE_PATH = 'collection-tables'

FORM_UPLOAD_IMG_RELATIVE_PATH = 'forms'
PUBLIC_RELATIVE_PATH = 'public'
PUBLIC_FORMS_RELATIVE_PATH = os.path.join(PUBLIC_RELATIVE_PATH, FORM_UPLOAD_IMG_RELATIVE_PATH)
UNIVERSAL_APPS_RELATIVE_PATH = os.path.join(PUBLIC_RELATIVE_PATH, 'universal-apps')

# form share type
ANONYMOUS = 'anonymous'
LOGIN_USERS = 'login_users'
SHARED_GROUPS = 'shared_groups'

# .dtable
FILE_TYPE = '.dtable'

USER_BASE_CACHE_PREFIX = 'user_base_'
USER_APP_CACHE_PREFIX = 'user_app_'
USER_WORKFLOW_CACHE_PREFIX = 'user_workflow_'

USER_BASE_CACHE_TIMEOUT = 60 * 60 * 24
USER_APP_CACHE_TIMEOUT = 60 * 60 * 24
USER_WORKFLOW_CACHE_TIMEOUT = 60 * 60 * 24


def get_dtable_owner(dtable):
    # return the owner name and the existence of such owner of dtable
    # if the owner is deleted, return true, else false
    group_id = dtable.get_owner_group_id()
    if group_id == -1:
        emailuser = ccnet_api.get_emailuser(dtable.creator)
        if not emailuser:
            return '%s (deleted user)' % (email2nickname(dtable.creator)), True
        return email2nickname(dtable.creator), False

    group = ccnet_api.get_group(int(group_id))
    if not group:
        return '%s (deleted group)' % (group_id,), True
    return '%s (group)' % (group.group_name,), False


def check_dtable_permission(username, workspace, dtable=None, org_id=None):
    """Check workspace/dtable access permission of a user.
    """
    if not username:
        logger.warning('Username is empty')
        return None
    owner = workspace.owner

    if '@seafile_group' in owner:
        group_id = int(owner.split('@')[0])
        if is_group_member(group_id, username, in_structure=True):  # in_structure True means check in group and ancestor group(s)
            return PERMISSION_READ_WRITE
    else:
        if username == owner:
            return PERMISSION_READ_WRITE

    if dtable:  # check user's all permissions from `share`, `group-share` and checkout higher one
        dtable_share = DTableShare.objects.get_by_dtable_and_to_user(dtable, username)
        if dtable_share and dtable_share.permission == PERMISSION_READ_WRITE:
            return dtable_share.permission
        permission = dtable_share.permission if dtable_share else None

        groups = get_user_groups(username, return_ancestors=True)
        group_ids = [group.id for group in groups]
        group_permissions = DTableGroupShare.objects.filter(dtable=dtable, group_id__in=group_ids).values_list('permission', flat=True)
        for group_permission in group_permissions:
            permission = permission if permission else group_permission
            if group_permission == PERMISSION_READ_WRITE:
                return group_permission
        if permission:
            return permission

    if settings.ENABLE_ADDRESSBOOK_V2 and settings.ENABLE_DEPARTMENT_ADMIN_MANAGE_MEMBER_BASES and '@seafile_group' not in workspace.owner:
        departments = DepartmentMembersV2.objects.get_user_departments(workspace.owner)
        for department in departments:
            if DepartmentMembersV2.objects.can_user_access_department_member_dtables(username, department):
                return PERMISSION_READ

    return None


def check_dtable_operation_permission_by_metadata(username, workspace, dtable_metadata):
    # check the dtable permission of can_export can_copy can_print using metadata
    permission_dict = {
        'can_export': True,
        'can_print': True,
        'can_copy': True
    }

    group_id = None
    owner = workspace.owner
    if "@seafile_group" in owner:
        group_id = int(owner.split('@')[0])

    if group_id:
        is_admin = is_group_admin_or_owner(group_id, username)
    else:
        is_admin = username == workspace.owner

    try:
        settings = dtable_metadata.get('settings')
    except Exception as e:
        logger.error('Failed to parse dtable metadata, error: %s' % e)
        error_msg = 'Internal Server Error'
        return None, error_msg

    if not settings:
        return permission_dict, None
    security_settings = settings.get('securities')
    if not security_settings:
        return permission_dict, None
    table_settings = security_settings.get('table_settings', {})
    share_user_settings = security_settings.get('share_user_settings', {})
    if is_admin:
        can_export = table_settings.get('can_export', True)
        can_print = table_settings.get('can_print', True)
        can_copy = table_settings.get('can_copy', True)
        can_download = table_settings.get('can_download', True)

    else:
        can_export = table_settings.get('can_export', True) and share_user_settings.get('can_export', True)
        can_print = table_settings.get('can_print', True) and share_user_settings.get('can_print', True)
        can_copy = table_settings.get('can_copy', True) and share_user_settings.get('can_copy', True)
        can_download = table_settings.get('can_download', True) and share_user_settings.get('can_download', True)

    permission_dict.update({
        'can_export': can_export,
        'can_print': can_print,
        'can_copy': can_copy,
        'can_download': can_download
    })
    return permission_dict, None


def check_dtable_operation_permission(username, workspace, dtable):
    dtable_server_url = get_inner_dtable_server_url()
    try:
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), dtable_server_url)
        dtable_metadata = dtable_server_api.get_metadata()
    except Exception as e:
        logger.exception('request dtable: %s metadata error: %s', dtable.uuid, e)
        return None, 'Internal Server Error'
    return check_dtable_operation_permission_by_metadata(username, workspace, dtable_metadata)


def get_user_view_share_permission(username, dtable):
    # if multiple view share is in same dtable, get highest
    # 'rw' is lower than 'r' in lexical order, reverse to get 'rw' first
    view_share = DTableViewUserShare.objects.filter(to_user=username, dtable=dtable).order_by('-permission').first()
    if not view_share:
        return ''
    return view_share.permission


def get_group_view_share_permission(username, dtable):
    # if multiple view share is in same dtable, get highest
    # 'rw' is lower than 'r' in lexical order, reverse to get 'rw' first
    view_shares = DTableViewGroupShare.objects.filter(dtable=dtable).order_by('-permission')

    target_view_share = None
    for view_share in view_shares:
        if is_group_member(view_share.to_group_id, username):
            target_view_share = view_share
            break

    if not target_view_share:
        return ''
    return target_view_share.permission


def get_view_share_permision(username, dtable):
    """
        return 'r' or 'rw' or ''
    """
    user_view_share_perm = get_user_view_share_permission(username, dtable)
    if user_view_share_perm:
        return user_view_share_perm
    group_view_share_perm = get_group_view_share_permission(username, dtable)
    return group_view_share_perm


def get_view_share_permission_by_view(username, dtable, table_id, view_id):
    """
        return 'r' or 'rw' or ''
    """
    view_share = DTableViewUserShare.objects.filter(
        to_user=username, dtable=dtable, table_id=table_id, view_id=view_id).order_by('-permission').first()
    if view_share:
        return view_share.permission

    group_view_shares = DTableViewGroupShare.objects.filter(
        dtable=dtable, table_id=table_id, view_id=view_id).order_by('-permission')
    target_view_share = None
    for view_share in group_view_shares:
        if is_group_member(view_share.to_group_id, username):
            target_view_share = view_share
            break
    if target_view_share:
        return target_view_share.permission

    return ''


def can_access_file_through_external_link(request, dtable, asset_name):
    file_type_ext = get_file_type_and_ext(asset_name)[0]
    if not file_type_ext in ACCESS_FILE_TYPES_THROUGH_EXTERNAL_LINK:
        return False

    external_link = request.session.get('external_link')
    if not external_link:
        return False

    return external_link['dtable_uuid'] == dtable.uuid.hex


def can_access_image_in_templates_app(dtable, asset_name):
    if not TEMPLATE_BASE_API_TOKEN:
        return False

    if not is_image_asset_type(asset_name):
        return False

    db_template_dtable_uuid = cache.get('template_dtable_uuid')
    if not db_template_dtable_uuid:
        db_template_token = DTableAPIToken.objects.filter(token=TEMPLATE_BASE_API_TOKEN).select_related().first()
        if not db_template_token:
            return False
        db_template_dtable_uuid = db_template_token.dtable.uuid.hex
        cache.set('template_dtable_uuid', db_template_dtable_uuid, 24 * 60 * 60)

    return db_template_dtable_uuid == dtable.uuid.hex


def has_dtable_asset_cache_download_permission(request, dtable_uuid):
    session_key = request.session._SessionBase__session_key
    if not session_key:
        return False
    key = session_key + '-' + dtable_uuid.replace('-', '')
    cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_DOWNLOAD_PERMISSION)
    if cache.get(cache_key) == '1':
        return True
    return False


def set_dtable_asset_cache_download_permission(request, dtable_uuid):
    session_key = request.session._SessionBase__session_key
    if not session_key:
        return
    key = session_key + '-' + dtable_uuid.replace('-', '')
    cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_DOWNLOAD_PERMISSION)
    cache.set(cache_key, '1', 30 * 60)


def has_dtable_asset_cache_read_permission(request, dtable_uuid, asset_id):
    session_key = request.session._SessionBase__session_key
    if not session_key:
        return False

    # external-apps
    external_app_session = request.session.get('external_app')
    if external_app_session and isinstance(external_app_session, dict) and asset_id:
        app_dtable_uuid = external_app_session.get('dtable_uuid')
        if app_dtable_uuid and uuid_str_to_36_chars(app_dtable_uuid) == uuid_str_to_36_chars(dtable_uuid):
            key = session_key + '-' + asset_id
            cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_READ_PERMISSION)
            if cache.get(cache_key) == '1':
                return True

    # judge cache between with user and specific asset, for example from workflow
    if asset_id:
        key = session_key + '-' + asset_id
        cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_READ_PERMISSION)
        if cache.get(cache_key) == '1':
            return True

    key = session_key + '-' + dtable_uuid.replace('-', '')
    cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_READ_PERMISSION)
    if cache.get(cache_key) == '1':
        return True

    return False


def set_dtable_asset_cache_read_permission(request, dtable_uuid, asset_id):
    """
    set dtable asset view permission cache

    :asset_id: workflow task asset permission needs to be accurate to session-asset_id
    """
    session_key = request.session._SessionBase__session_key
    if not session_key:
        return

    # cache workflow task asset cache
    workflow_token = request.GET.get('workflow_token')
    task_id = request.GET.get('task_id')
    if workflow_token and task_id and asset_id:
        key = session_key + '-' + asset_id
        cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_READ_PERMISSION)
        cache.set(cache_key, '1', 30 * 60)
        return

    # Skip cache universal app
    external_app_session = request.session.get('external_app')
    if external_app_session and isinstance(external_app_session, dict) and asset_id:
        app_dtable_uuid = external_app_session.get('dtable_uuid')
        if app_dtable_uuid and uuid_str_to_36_chars(app_dtable_uuid) == uuid_str_to_36_chars(dtable_uuid):
            key = session_key + '-' + asset_id
            cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_READ_PERMISSION)
            cache.set(cache_key, '1', 30 * 60)
            return

    key = session_key + '-' + dtable_uuid.replace('-', '')
    cache_key = normalize_cache_key(key, prefix=DTABLE_ASSET_READ_PERMISSION)
    cache.set(cache_key, '1', 30 * 60)


def has_collection_table_permission(request, dtable_uuid):
    collection_table_session = request.session.get('collection_table')
    if not collection_table_session:
        return False
    if not isinstance(collection_table_session, dict):
        return False

    return collection_table_session.get('dtable_uuid') == dtable_uuid


def has_workflow_task_asset_permission(request, path):
    """
    check user can access asset from workflow task
    need login user
    1. admin
    2. participant
    3. initiator
    """
    from seahub.dtable_apps.workflow.utils import can_view_task_asset

    if isinstance(request.user, AnonymousUser):
        return False

    try:
        workflow_token = request.GET.get('workflow_token')
        task_id = int(request.GET.get('task_id'))
    except:
        return False
    column_key = request.GET.get('column_key')
    column_type = request.GET.get('column_type')
    if not (workflow_token and task_id):
        return False

    return can_view_task_asset(
        request.user.username,
        path,
        workflow_token=workflow_token,
        task_id=task_id,
        column_key=column_key,
        column_type=column_type
    )


NEED_CHECK_PERMISSION_PAGES = ['table', 'gallery', 'calendar', 'kanban', 'timeline']
def can_access_asset_through_external_app(request, dtable, path):
    external_app_session = request.session.get('external_app')
    if not external_app_session:
        return False
    if not isinstance(external_app_session, dict):
        return False

    if external_app_session.get('app_type') != 'universal-app':
        return uuid_str_to_36_chars(external_app_session.get('dtable_uuid')) == str(dtable.uuid)

    asset_access_token = external_app_session.get('asset_access_token')
    try:
        payload = jwt.decode(asset_access_token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidSignatureError):
        return False

    app_uuid = payload.get('app_uuid')
    if not app_uuid:
        return False
    external_app = DTableExternalApps.objects.filter(app_uuid=payload.get('app_uuid')).first()
    if not external_app:
        return False

    # files/2023-02/2022050661084029.xls?dl=1&page_id=0HBV&row_id=WLe7JnoBS9ylVuuo8VXyjA&column_key=uV1v
    if uuid_str_to_36_chars(external_app.dtable_uuid) != str(dtable.uuid):
        return False

    asset_name = os.path.basename(path)
    if is_image_asset_type(asset_name):
        return True

    page_id = request.GET.get('page_id')
    column_key = request.GET.get('column_key')
    row_id = request.GET.get('row_id')
    if not page_id:
        return False
    try:
        app_config = json.loads(external_app.app_config)
    except Exception as e:
        return False
    pages = app_config.get('settings').get('pages', [])
    page = None
    for tmp_page in pages:
        if tmp_page['id'] == page_id:
            page = tmp_page
            break
    if not page:
        return False
    if page.get('type') not in NEED_CHECK_PERMISSION_PAGES:
        return True
    # can access image asset
    asset_name = os.path.basename(path)
    # other need check pages
    table, column = None, None
    if column_key not in page.get('shown_column_keys', []):
        return False
    if not row_id:
        return False
    table_id = page.get('table_id')
    dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), get_inner_dtable_server_url())
    dtable_metadata = getattr(dtable, 'metadata', None)
    if not dtable_metadata:
        try:
            dtable_metadata = dtable_server_api.get_metadata()
        except Exception as e:
            logger.error('request metadata error: %s', e)
            return False
    for tmp_table in dtable_metadata.get('tables'):
        if tmp_table['_id'] == table_id:
            table = tmp_table
            break
    if not table:
        return False
    for col in table.get('columns', []):
        if col['key'] == column_key:
            column = col
            break
    if not column or column['type'] not in [ColumnTypes.FILE, ColumnTypes.LINK, ColumnTypes.LINK_FORMULA]:
        return False
    pre_filters = page.get('pre_filters', [])
    pre_filter_conjunction = page.get('pre_filter_conjunction', 'And')
    table_name = table['name']
    username = request.user.username
    if pre_filters:
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
        user_department_ids_map = get_departments_map_by_username(username)
        current_user_department_ids = user_department_ids_map['current_user_department_ids']
        current_user_department_and_sub_ids = user_department_ids_map['current_user_department_and_sub_ids']
        for item in pre_filters:
            if item.get('filter_predicate') == 'include_me':
                item['filter_term'].append(username)
            if item.get('filter_predicate') == 'is_current_user_ID':
                item['filter_term'] = id_in_org
            if item.get('filter_term') == 'current_user_department':
                item['current_user_department'] = current_user_department_ids
            if item.get('filter_term') == 'current_user_department_and_sub':
                item['current_user_department_and_sub'] = current_user_department_and_sub_ids
            if isinstance(item.get('filter_term'), list):
                if 'current_user_department' in item.get('filter_term') or 'current_user_department_and_sub' in item.get('filter_term'):
                    item['current_user_department'] = current_user_department_ids
                    item['current_user_department_and_sub'] = current_user_department_and_sub_ids

    filter_conditions = {
        'filters': pre_filters,
        'filter_conjunction': pre_filter_conjunction
    }

    import dtable_events

    try:
        filter_clause = dtable_events.BaseSQLGenerator(table_name, table['columns'], filter_conditions)._filter2sql()
    except Exception as e:
        logger.warning('filters in app %s page %s table %s error %s', app_uuid, page_id, table_id, e)
        filter_clause = f"WHERE _id='{row_id}'"
    else:
        if filter_clause:
            part_filter_clause = filter_clause[len('WHERE '):]
            filter_clause = f"WHERE ({part_filter_clause}) AND _id='{row_id}'"
        else:
            filter_clause = f"WHERE _id='{row_id}'"
    sql = f"SELECT `{column['name']}` FROM `{table['name']}` {filter_clause}"
    dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
    try:
        results = dtable_db_api.query(sql)['results']
    except Exception as e:
        logger.error('select row error: %s', e)
        return False
    if not results:
        return False
    row = results[0]
    cell_value = row.get(column_key)
    if column['type'] in [ColumnTypes.FILE, ColumnTypes.LINK_FORMULA] and isinstance(cell_value, list):
        for file_item in cell_value:
            if not isinstance(file_item, dict):
                continue
            if unquote(path) in unquote(file_item.get('url', '')):
                return True
    elif column['type'] == 'link' and isinstance(cell_value, list):
        other_column_key = request.GET.get('other_column_key')
        other_row_id = request.GET.get('other_row_id')
        if not other_column_key or not other_row_id:
            return False
        linked_row_item = None
        for linked_item in cell_value:
            if linked_item['row_id'] == other_row_id:
                linked_row_item = linked_item
                break
        if not linked_row_item:
            return False
        link_id = column['data']['link_id']
        other_table_id = column['data']['other_table_id'] if column['data']['other_table_id'] != table['_id'] else column['data']['table_id']
        if page['type'] == 'table':
            link_columns_settings = page.get('link_columns_settings', [])
            for link_colum_settings in link_columns_settings:
                if link_colum_settings['key'] != link_id:
                    continue
                if other_column_key not in link_colum_settings.get('link_existed_visible_column_fields', []):
                    return False
            other_table = None
            for tmp_table in dtable_metadata['tables']:
                if tmp_table['_id'] == other_table_id:
                    other_table = tmp_table
                    break
            if not other_table:
                return False
            other_column = None
            for tmp_column in other_table['columns']:
                if tmp_column['key'] == other_column_key:
                    other_column = tmp_column
                    break
            if not other_column or other_column['type'] != 'file':
                return False
            sql = "SELECT `%(column_name)s` FROM `%(table_name)s` WHERE `_id`='%(row_id)s'" % {
                'column_name': other_column['name'],
                'table_name': other_table['name'],
                'row_id': other_row_id
            }
            try:
                results = dtable_db_api.query(sql)['results']
            except Exception as e:
                logger.error('select other row error: %s', e)
                return False
            if not results:
                return False
            other_row = results[0]
            other_cell_value = other_row.get(other_column_key)
            if other_column['type'] == 'file' and isinstance(other_cell_value, list):
                for file_item in other_cell_value:
                    if unquote(path) in unquote(file_item.get('url', '')):
                        return True
    return False


def can_access_asset(request, workspace, dtable, path, asset_id):
    """
    can access asset with path

    public
    collection-table
    external-link
    cache
    workflow
    base permission
    view permission
    template base
    external-app

    return: can_access -> bool, need_cache -> bool
    """
    # check permission, order matters !!!
    # please arrange heavy checks with multi sql queries or http requests to later positions
    can_access, need_cache, user_permission = False, False, 'r'

    if path.startswith('public'):
        can_access = True
        return can_access, need_cache, user_permission

    if getattr(request.user, 'is_from_cookie', False):
        can_access = True
        return can_access, need_cache, user_permission

    dtable_uuid = str(dtable.uuid)
    asset_dir = os.path.dirname(path)
    asset_name = os.path.basename(normalize_file_path(path))

    workflow_token = request.GET.get('workflow_token')
    task_id = request.GET.get('task_id')
    column_key = request.GET.get('column_key')
    column_type = request.GET.get('column_type')
    is_from_workflow_task = bool(workflow_token and task_id and column_key and column_type)

    if has_collection_table_permission(request, dtable.uuid.hex) and COLLECTION_TABLE_RELATIVE_PATH in asset_dir:
        can_access = True
        return can_access, need_cache, user_permission
    if can_access_file_through_external_link(request, dtable, asset_name):
        can_access = True
        return can_access, need_cache, user_permission
    if has_dtable_asset_cache_read_permission(request, dtable_uuid, asset_id=asset_id):
        can_access = True
        return can_access, need_cache, user_permission
    if is_from_workflow_task and has_workflow_task_asset_permission(request, path):
        can_access = True
        need_cache = True
        return can_access, need_cache, user_permission
    # Please note that some check methods need authenticated user or other limits

    username = request.user.username
    user_dtable_permission = check_dtable_permission(username, workspace, dtable)
    if username and user_dtable_permission:
        can_access = True
        need_cache = True
        return can_access, need_cache, user_dtable_permission
    user_view_permission = get_view_share_permision(username, dtable)
    if username and user_view_permission in [PERMISSION_READ, PERMISSION_READ_WRITE]:
        can_access = True
        need_cache = True
        return can_access, need_cache, user_view_permission
    if can_access_image_in_templates_app(dtable, asset_name):
        can_access = True
        need_cache = True
        return can_access, need_cache, user_permission
    if can_access_asset_through_external_app(request, dtable, path):
        can_access = True
        need_cache = True
        return can_access, need_cache, user_permission

    return can_access, need_cache, user_permission


def can_access_related_users_by_workflow_or_task(request, workflow_token, task_id=None):
    from seahub.dtable_apps.workflow.models import DTableWorkflows, DTableWorkflowTasks, DTableWorkflowTaskParticipants
    from seahub.dtable_apps.workflow.utils import can_submit_workflow_task

    workflow = DTableWorkflows.objects.get_workflow_by_token(workflow_token)
    if not workflow:
        return False
    if can_submit_workflow_task(workflow, request.user):
        return True
    if task_id:
        workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(workflow_token, task_id)
        if not workflow_task:
            return False
        if DTableWorkflowTaskParticipants.objects.can_transfer(workflow_task, request.user.username):
            return True
    return False


def can_access_related_users(request, workspace, dtable):

    username = request.user.username
    if check_dtable_permission(username, workspace, dtable):
        return True

    # workflow/task
    workflow_token = request.GET.get('workflow_token')
    task_id = request.GET.get('task_id')
    if workflow_token and can_access_related_users_by_workflow_or_task(request, workflow_token, task_id=task_id):
        return True

    return False


def has_dtable_asset_upload_permission(request, workspace, dtable):
    # two ways to upload asset
    # 1. through dtable rw perm, including dtable share
    # 2. through view share rw perm
    username = request.user.username

    dtable_permission = check_dtable_permission(username, workspace, dtable)
    if dtable_permission in [PERMISSION_READ_WRITE, PERMISSION_ADMIN]:
        return True
    if dtable_permission and PERMISSION_PREFIX in dtable_permission:
        return True
    if get_view_share_permision(username, dtable) == PERMISSION_READ_WRITE:
        return True
    return False


def can_edit_document(dtable_uuid, dtable_permission, view_permission):
    """
    can edit sdoc, document, sheet...etc

    1. one of dtable_permission or view_permission is rw
    2. custom permission with one of
        1). permission of one of tables is rw
        2). permission of one of tables is detail and permission of one of views is rw
    """

    if PERMISSION_READ_WRITE in (dtable_permission, view_permission):
        return True
    if not (isinstance(dtable_permission, str) and dtable_permission.startswith(PERMISSION_PREFIX)):
        return False
    custom_permission_id = int(dtable_permission.split('-')[1])
    custom_permission = DTableSharePermission.objects.filter(pk=custom_permission_id).first()
    if not custom_permission:
        return False
    try:
        permission = json.loads(custom_permission.permission)
    except:
        logger.warning('custom permission: %s invalid', custom_permission_id)
        return False
    dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, get_inner_dtable_server_url())
    metadata = dtable_server_api.get_metadata()
    for table in metadata.get('tables', []):
        table_permission = permission.get(table['_id'])
        if not table_permission:
            continue
        if table_permission.get('permission') == PERMISSION_READ_WRITE:
            return True
        if table_permission.get('permission') == 'detail':
            for view in table.get('views', []):
                view_permission = table_permission.get(view['_id'])
                if not view_permission:
                    continue
                if view_permission == PERMISSION_READ_WRITE:
                    return True

    return False


def check_dtable_admin_permission(username, owner):
    """Check workspace/dtable access permission of an admin.
    """
    if '@seafile_group' in owner:
        group_id = int(owner.split('@')[0])
        if is_group_admin_or_owner(group_id, username):
            return True
        else:
            return False

    else:
        if username == owner:
            return True
        else:
            return False


def is_belong_to_user_or_in_the_same_org(username, workspace):
    """
    judge whether workspace is of `user` or `org where user is in`
    """
    org_id = workspace.org_id
    if org_id == -1:
        return username == workspace.owner
    return ccnet_api.org_user_exists(org_id, username)


def list_dtable_related_users_info(dtable_uuid):
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_RELATED_USERS_INFO_PREFIX)
    related_users_info_cache = cache.get(cache_key)
    if related_users_info_cache is not None:
        try:
            related_users_info = json.loads(related_users_info_cache)
            return related_users_info
        except Exception as e:
            logger.warning('related user info cache invalid: %s, error: %s', related_users_info_cache, e)
    return None


def set_related_users_info_cache(dtable_uuid, related_users_info):
    """ only for related_users[:DTABLE_RELATED_USERS_PER_PAGE] """
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_RELATED_USERS_INFO_PREFIX)
    cache.set(cache_key, json.dumps(related_users_info), DTABLE_RELATED_USERS_CACHE_TIMEOUT)


def clean_related_users_info_cache(dtable_uuid):
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_RELATED_USERS_INFO_PREFIX)
    cache.delete(cache_key)


def clean_related_users_cache(dtable_uuid):
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_RELATED_USERS_PREFIX)
    cache.delete(cache_key)
    clean_related_users_info_cache(dtable_uuid)


def clean_related_users_cache_by_group_ids(group_ids):
    owners = ['%s@seafile_group' % group_id for group_id in group_ids]
    uuids = list(DTables.objects.filter(workspace__owner__in=owners).values_list('uuid', flat=True))

    # dtables shared to group
    uuids += list(DTableGroupShare.objects.filter(group_id__in=group_ids).values_list('dtable__uuid', flat=True))
    # dtables whose views are shared to group
    uuids += list(DTableViewGroupShare.objects.filter(to_group_id__in=group_ids).values_list('dtable__uuid', flat=True))
    for uuid in set(uuids):
        clean_related_users_cache(uuid.hex)


def clean_related_users_cache_by_group(group_id):
    group_id = int(group_id)
    group = ccnet_api.get_group(group_id)
    if group.parent_group_id == 0:  # normal group
        groups = [group]
    else:  # department group
        groups = ccnet_api.get_ancestor_groups(group_id)
    group_ids = [g.id for g in groups]
    clean_related_users_cache_by_group_ids(group_ids)


def clean_related_users_cache_by_department(department):
    groups = get_ancestor_groups_by_department(department)
    group_ids = [group.group_id for group in groups]
    clean_related_users_cache_by_group_ids(group_ids)


def clean_related_users_cache_by_user(username, org_id=-1):
    # dtables shared to user
    if not username:
        logger.warning('Username is empty')
        return
    uuids = DTableShare.objects.filter(to_user=username).values_list('dtable__uuid', flat=True)
    for uuid in uuids:
        clean_related_users_cache(uuid.hex)
    # dtables in groups that user is in, and their ancestors' groups
    groups = get_user_groups(username, return_ancestors=True)
    group_ids = [group.id for group in groups]
    for group_id in set(group_ids):
        clean_related_users_cache_by_group(group_id)

def clean_user_department_cache(username):
    cache_key = normalize_cache_key(username, USER_DEPT_CACHE_PREFIX)
    cache.delete(cache_key)


def list_dtable_related_users(workspace, dtable):
    """ Return all users who can view this dtable.

    1. owner
    2. shared users
    3. groups users
    """
    cache_key = normalize_cache_key(dtable.uuid.hex, prefix=DTABLE_RELATED_USERS_PREFIX)
    related_users_cache = cache.get(cache_key)
    if related_users_cache:
        try:
            related_users = json.loads(related_users_cache)
        except Exception as e:
            logger.warning('related user cache invalid: %s, error: %s', related_users_cache, e)
        else:
            return related_users

    user_list = list()
    owner = workspace.owner

    # 1. shared users
    shared_queryset = DTableShare.objects.list_by_dtable(dtable)
    user_list.extend([dtable_share.to_user for dtable_share in shared_queryset])

    if '@seafile_group' not in owner:
        # 2. owner
        if owner not in user_list:
            user_list.append(owner)
    else:
        # 3. groups users and descendants groups users
        group_id = int(owner.split('@')[0])
        group = ccnet_api.get_group(group_id)
        if not group:
            groups = []
        elif group.parent_group_id == 0:  # normal group
            groups = [group]
        else:  # department group
            groups = ccnet_api.get_descendants_groups(group_id)
        for group in groups:
            members = get_group_members(group_id)
            for member in members:
                if member['username'] not in user_list:
                    user_list.append(member['username'])

    # 4. users of shared groups
    shared_group_ids = DTableGroupShare.objects.filter(dtable=dtable).values_list('group_id', flat=True)
    for group_id in shared_group_ids:
        members = get_group_members(group_id)
        for member in members:
            if member['username'] not in user_list:
                user_list.append(member['username'])

    # 5. view share single users
    view_shares_user_list = DTableViewUserShare.objects.filter(dtable=dtable)
    for view_share_user in view_shares_user_list:
        if view_share_user.to_user not in user_list:
            user_list.append(view_share_user.to_user)

    # 6. view share group users
    view_share_group_ids = DTableViewGroupShare.objects.filter(dtable=dtable).values_list('to_group_id', flat=True)
    for group_id in view_share_group_ids:
        members = get_group_members(group_id)
        for member in members:
            if member['username'] not in user_list:
                user_list.append(member['username'])

    cache.set(cache_key, json.dumps(user_list), DTABLE_RELATED_USERS_CACHE_TIMEOUT)

    return user_list


def list_dtable_app_users(dtable_uuid):
    """ Return app users [:DTABLE_APP_USERS_PER_PAGE]
    """
    from seahub.dtable_apps.universal_app.models import DTableAppUsers
    from seahub.dtable.settings import DTABLE_APP_USERS_PER_PAGE

    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_APP_USERS_PREFIX)
    app_users_cache = cache.get(cache_key)
    if app_users_cache:
        try:
            app_users = json.loads(app_users_cache)
        except Exception as e:
            logger.warning('app user cache invalid: %s, error: %s', app_users_cache, e)
        else:
            return app_users

    app_queryset = DTableExternalApps.objects.filter(
        dtable_uuid=dtable_uuid.replace('-', ''), app_type='universal-app')
    app_user_queryset = DTableAppUsers.objects.filter(
        app__in=app_queryset)[:DTABLE_APP_USERS_PER_PAGE]
    app_users = []
    for user in app_user_queryset:
        if user.username not in app_users:
            app_users.append(user.username)

    cache.set(cache_key, json.dumps(app_users), DTABLE_APP_USERS_CACHE_TIMEOUT)
    return app_users


def list_dtable_app_users_info(dtable_uuid):
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_APP_USERS_INFO_PREFIX)
    app_users_info_cache = cache.get(cache_key)
    if app_users_info_cache is not None:
        try:
            app_users_info = json.loads(app_users_info_cache)
            return app_users_info
        except Exception as e:
            logger.warning('app user info cache invalid: %s, error: %s', app_users_info_cache, e)
    return None


def set_app_users_info_cache(dtable_uuid, app_users_info):
    """ only for app_users[:DTABLE_APP_USERS_PER_PAGE] """
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_APP_USERS_INFO_PREFIX)
    cache.set(cache_key, json.dumps(app_users_info), DTABLE_APP_USERS_CACHE_TIMEOUT)


def clean_app_users_info_cache(dtable_uuid):
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_APP_USERS_INFO_PREFIX)
    cache.delete(cache_key)


def clean_app_users_cache(dtable_uuid):
    cache_key = normalize_cache_key(dtable_uuid.replace('-', ''), prefix=DTABLE_APP_USERS_PREFIX)
    cache.delete(cache_key)
    clean_app_users_info_cache(dtable_uuid)


def gen_share_dtable_link(token):
    service_url = get_service_url()
    assert service_url is not None
    service_url = service_url.rstrip('/')
    return '%s/dtable/links/%s' % (service_url, token)

def gen_share_unversal_app_link(token):
    service_url = get_service_url()
    assert service_url is not None
    service_url = service_url.rstrip('/')
    return '%s/dtable/universal-app/links/%s' % (service_url, token)


def _get_link_key(token):
    return 'visited_' + token


def check_share_link_access(request, token):
    link_key = _get_link_key(token)
    return request.session.get(link_key, False)


def set_share_link_access(request, token):
    link_key = _get_link_key(token)
    request.session[link_key] = True


def check_share_link_common(request, share_link):
    msg = ''
    if not share_link.is_encrypted():
        return (True, msg)

    if check_share_link_access(request, share_link.token):
        return (True, msg)

    if request.method != 'POST':
        return (False, msg)

    password = request.POST.get('password', None)
    if not password:
        msg = _("Password can\'t be empty")
        return (False, msg)

    if check_password(password, share_link.password):
        set_share_link_access(request, share_link.token)
        return (True, msg)
    else:
        msg = _("Please enter a correct password.")
        return (False, msg)


def gen_dtable_external_link(token, is_custom=False):
    service_url = get_service_url()
    assert service_url is not None
    service_url = service_url.rstrip().rstrip('/')
    if not is_custom:
        link = '%s/dtable/external-links/%s/' % (service_url, token)
    else:
        link = '%s/dtable/external-links/custom/%s/' % (service_url, token)
    return link

def check_base_access(request, dtable):
    msg = ''
    base_access_key = 'base_access_' + dtable.uuid.hex
    password_in_session = request.session.get(base_access_key)
    if not dtable.is_encrypted():
        # remove the session when unset the password of a base
        if password_in_session:
            del request.session[base_access_key]
        return (True, msg)

    if check_password(password_in_session, dtable.password):
        return (True, msg)

    if request.method != 'POST':
        return (False, msg)

    password = request.POST.get('password', None)
    if not password:
        msg = _("Password can\'t be empty")
        return (False, msg)

    if check_password(password, dtable.password):
        request.session[base_access_key] = password
        return (True, msg)
    else:
        msg = _("Please enter a correct password.")
        return (False, msg)


def check_external_link(request, external_link):
    msg = ''
    if not external_link.is_encrypted():
        return (True, msg)

    external_link_key = 'external_link_' + external_link.token
    if request.session.get(external_link_key):
        return (True, msg)

    if request.method != 'POST':
        return (False, msg)

    password = request.POST.get('password', None)
    if not password:
        msg = _("Password can\'t be empty")
        return (False, msg)

    if check_password(password, external_link.password):
        request.session[external_link_key] = True
        return (True, msg)
    else:
        msg = _("Please enter a correct password.")
        return (False, msg)


def is_valid_jwt(auth, dtable_uuid, return_payload=False):
    """
    can decode a valid jwt payload
    """
    is_valid, payload = False, None
    if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
        return (is_valid, payload) if return_payload else is_valid

    token = auth[1]
    if not token or not dtable_uuid:
        return (is_valid, payload) if return_payload else is_valid

    try:
        payload = jwt.decode(token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except:
        is_valid = False
    else:
        dtable_uuid_in_payload = payload.get('dtable_uuid')

        if not dtable_uuid_in_payload:
            is_valid = False
        elif uuid_str_to_36_chars(dtable_uuid_in_payload) != uuid_str_to_36_chars(dtable_uuid):
            is_valid = False
        else:
            is_valid = True

    if return_payload:
        return is_valid, payload
    return is_valid


def is_valid_app_jwt(auth, app_uuid, return_payload=False):
    """
    can decode a valid jwt payload
    """
    is_valid, payload = False, None
    if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
        return (is_valid, payload) if return_payload else is_valid

    token = auth[1]
    if not token or not app_uuid:
        return (is_valid, payload) if return_payload else is_valid

    try:
        payload = jwt.decode(token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        is_valid = False
    else:
        app_uuid_in_payload = payload.get('app_uuid')

        if not app_uuid_in_payload:
            is_valid = False
        elif uuid_str_to_36_chars(app_uuid_in_payload) != uuid_str_to_36_chars(app_uuid):
            is_valid = False
        else:
            is_valid = True

    if return_payload:
        return is_valid, payload
    return is_valid


def create_repo_and_workspace(owner, org_id):
    repo_id = seafile_api.create_repo(
        "My Workspace",
        "My Workspace",
        "dtable@seafile"
    )

    workspace = Workspaces.objects.create_workspace(owner, repo_id, org_id)
    return workspace


def check_form_submit_permission(request, form):
    share_type = form.share_type
    is_auth = request.user.is_authenticated
    username = request.user.username

    if is_auth and username == form.username:
        return True

    if share_type == ANONYMOUS:
        return True
    elif share_type == LOGIN_USERS and is_auth:
        return True
    elif share_type == SHARED_GROUPS and is_auth:
        user_groups = get_user_groups(request.user.username)
        user_group_ids = [group.id for group in user_groups]
        shared_group_ids = DTableFormShare.objects.list_by_form(form)
        intersection = [group_id for group_id in user_group_ids if group_id in shared_group_ids]
        if intersection:
            return True

    return False


def convert_dtable_trash_names(dtable):
    """
    convert dtable's name to trash name and generate old and new .dtable names
    """
    assert dtable.deleted is False
    new_dtable_name = '_(deleted_' + str(dtable.id) + ') ' + dtable.name
    old_dtable_file_name = dtable.name + FILE_TYPE
    new_dtable_file_name = new_dtable_name + FILE_TYPE

    return new_dtable_name, old_dtable_file_name, new_dtable_file_name


def restore_trash_dtable_names(dtable):
    """
    get trash dtable's original name and generate old and new .dtable names
    """
    assert dtable.deleted is True
    new_dtable_name = dtable.name[dtable.name.find(' ')+1:]
    old_dtable_file_name = dtable.name + FILE_TYPE
    new_dtable_file_name = new_dtable_name + FILE_TYPE

    return new_dtable_name, old_dtable_file_name, new_dtable_file_name


def add_dtable_io_task(type, params):

    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    if type == 'export':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-export-task')
    elif type == 'import':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-task')
    elif type == 'parse-excel-csv':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-parse-excel-csv-task')
    elif type == 'append-excel-csv-upload-file':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-append-excel-csv-upload-file-task')
    elif type == 'append-excel-csv-append-parsed-file':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-append-excel-csv-append-parsed-file-task')
    elif type == 'update-excel-upload-excel':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-update-excel-upload-excel-task')
    elif type == 'update-excel-csv-update-parsed-file':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-update-excel-csv-update-parsed-file-task')
    elif type == 'update-csv-upload-csv':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-update-csv-upload-csv-task')
    elif type == 'import-excel-csv-to-dtable':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-excel-csv-to-dtable-task')
    elif type == 'import-excel-csv-to-table':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-excel-csv-to-table-task')
    elif type == 'update-table-via-excel-csv':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-update-table-via-excel-csv-task')
    elif type == 'append-excel-csv-to-table':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-append-excel-csv-to-table-task')
    elif type == 'export-page-design':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-export-page-design-task')
    elif type == 'import-page-design':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-page-design-task')
    elif type == 'export-document':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-export-document-task')
    elif type == 'import-document':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-document-task')

    resp = requests.get(url, params=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception

    return json.loads(resp.content)['task_id']


def add_import_excel_csv_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-excel-csv-task')
    resp = requests.post(url, json=params, headers=headers)
    return json.loads(resp.content)['task_id']


def import_excel_csv_add_table_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-excel-csv-add-table-task')
    resp = requests.post(url, json=params, headers=headers)
    return json.loads(resp.content)['task_id']


def add_dtable_io_big_data_screen_task(type, params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    if type == 'export':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-big-data-screen-export-task')
    elif type == 'import':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-big-data-screen-import-task')

    resp = requests.get(url, params=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception

    return json.loads(resp.content)['task_id']


def add_dtable_io_big_data_screen_app_task(type, params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    if type == 'import':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-big-data-screen-app-import-task')
    elif type == 'export':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-big-data-screen-app-export-task')

    resp = requests.get(url, params=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception

    return json.loads(resp.content)['task_id']


def add_dtable_big_data_task(type, params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = ''
    if type == 'import-big-excel':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-import-big-excel-task')
    elif type == 'update-big-excel':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-update-big-excel-task')
    elif type == 'convert-big-data-view-to-excel':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-convert-big-data-view-to-excel-task')

    resp = requests.post(url, data=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception

    return json.loads(resp.content)['task_id']

def query_dtable_big_data_status(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/query-big-data-status')
    params = {'task_id': task_id}

    resp = requests.get(url, params=params, headers=headers)
    return resp


def add_dtable_message_task(type, params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    if type == 'email':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-email-sending-task')
    elif type == 'wechat_robot':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-wechat-sending-task')
    elif type == 'dingtalk_robot':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-dingtalk-sending-task')
    elif type == 'notification':
        url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-notification-sending-task')

    resp = requests.post(url, data=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception
    return json.loads(resp.content)['task_id']


def add_run_auto_rule_task(type, params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-run-auto-rule-task')
    resp = requests.post(url, data=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception
    return json.loads(resp.content)['task_id']

def add_app_users_sync_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-app-users-sync-task')
    resp = requests.post(url, data=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception
    return json.loads(resp.content)['task_id']


def query_dtable_io_status(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/query-status')
    params = {'task_id': task_id}

    resp = requests.get(url, params=params, headers=headers)
    return resp


def cancel_dtable_io_task(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/cancel-task')
    params = {'task_id': task_id}

    resp = requests.get(url, params=params, headers=headers)
    return resp


def query_dtable_message_send_status(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/query-message-send-status')
    params = {'task_id': task_id}

    resp = requests.get(url, params=params, headers=headers)
    return resp

def cancel_dtable_message_send_task(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/cancel-message-send-task')
    params = {'task_id': task_id}

    resp = requests.get(url, params=params, headers=headers)
    return resp


def export_dtable_asset_files(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/dtable-asset-files')

    resp = requests.post(url, data=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('export dtable asset files error')

    return json.loads(resp.content)['task_id']

def transfer_dtable_asset_files_to_seafile(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/transfer-dtable-asset-files')

    resp = requests.post(url, data=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('transfer dtable asset files error')

    return json.loads(resp.content)['task_id']


def convert_page_design_to_pdf(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/convert-page-design-to-pdf')

    resp = requests.get(url, params=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('convert page design to pdf error')

    return json.loads(resp.content)['task_id']


def convert_document_to_pdf(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/convert-document-to-pdf')

    resp = requests.get(url, params=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('convert document to pdf error')

    return json.loads(resp.content)['task_id']


def add_import_table_from_base_task(context):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/import-table-from-base')

    resp = requests.post(url, json=context, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('import table from base error')

    return json.loads(resp.content)['task_id']


def add_import_common_dataset_task(context):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/import-common-dataset')

    resp = requests.post(url, json=context, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('import common dataset error')

    return json.loads(resp.content)['task_id']


def add_sync_common_dataset_task(context):
    """
    return: taks_id -> str or None, status_code -> int or None
    """
    payload = {'exp': int(time.time()) + 300,}
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/sync-common-dataset')

    resp = requests.post(url, json=context, headers=headers)
    if not resp.ok:
        try:
            resp_json = resp.json()
            if resp_json.get('error_msg') == 'Dataset is syncing':
                logger.warning('dataset: %s is syncing', context.get('dataset_id'))
        except:
            logger.error(resp.content)
        return None, resp.status_code

    return json.loads(resp.content)['task_id'], 200


def add_force_sync_common_dataset_task(context):
    """
    return: taks_id -> str or None, status_code -> int or None
    """
    payload = {'exp': int(time.time()) + 300,}
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/force-sync-common-dataset')

    resp = requests.post(url, json=context, headers=headers)
    if not resp.ok:
        try:
            resp_json = resp.json()
            if resp_json.get('error_msg') == 'Dataset is syncing':
                logger.warning('dataset: %s is syncing', context.get('dataset_id'))
        except:
            logger.error(resp.content)
        return None, resp.status_code

    return json.loads(resp.content)['task_id'], 200


def add_sync_email_task(context):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-sync-email-task')

    resp = requests.post(url, json=context, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('sync email error')

    return json.loads(resp.content)['task_id']


def query_dtable_data_sync_status(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/query-data-sync-status')
    params = {'task_id': task_id}

    resp = requests.get(url, params=params, headers=headers)
    return resp


def add_plugin_email_send_email_task(context):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/plugin-email-send-email')

    resp = requests.post(url, json=context, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('pull email error')

    return json.loads(resp.content)['task_id']


def query_plugin_email_send_status(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/query-plugin-email-send-status')
    params = {'task_id': task_id}

    resp = requests.get(url, params=params, headers=headers)
    return resp


def convert_view_to_excel(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/convert-view-to-excel')

    resp = requests.post(url, json=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('convert view to excel error')

    return json.loads(resp.content)['task_id']


def convert_table_to_excel(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/convert-table-to-excel')

    resp = requests.get(url, params=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception('convert table to excel error')

    return json.loads(resp.content)['task_id']


def clean_org_storage_size_cache(org_id):
    cache.delete(normalize_cache_key(str(org_id), ORG_STORAGE_SIZE_PREFIX))


def clean_org_big_data_cache(org_id):
    cache.delete(normalize_cache_key(str(org_id), ORG_BIG_DATA_TOTAL_ROWS_PREFIX))
    cache.delete(normalize_cache_key(str(org_id), ORG_BIG_DATA_TOTAL_STORAGE_PREFIX))


def is_big_data_row_limit_exceeded(org_id):
    if org_id == -1:
        return False

    row_limit = OrgQuota.objects.get_big_data_row_limit(org_id)
    if row_limit < 0:
        return False

    org_big_data_rows = OrgBigDataStorageStats.objects.get_org_big_data_total_rows(org_id)
    if org_big_data_rows >= row_limit:
        return True

    return False

def is_big_data_storage_limit_exceeded(org_id):
    if org_id == -1:
        return False

    storage_quota = OrgQuota.objects.get_big_data_storage_quota(org_id)
    if storage_quota < 0:
        return False

    org_big_data_storages = OrgBigDataStorageStats.objects.get_org_big_data_total_storage(org_id)
    if org_big_data_storages >= storage_quota:
        return True

    return False




def _check_org_quota(org_id):
    quota = OrgQuota.objects.get_asset_quota(org_id)
    if quota < 0:
        return True
    storage_size = Workspaces.objects.get_org_total_storage(org_id)
    if int(storage_size) > quota:
        return False
    return True


def _check_user_quota(user, workspace=None):
    """
    user: user object, not org-user
    """
    quota, _ = UserQuota.objects.get_asset_quota(user.email, user_obj=user)
    if quota is not None:
        if quota < 0:
            return True
        storage_size = Workspaces.objects.get_owner_total_storage(user.email)
        if int(storage_size) > quota:
            return False
        return True
    else:
        return False


def check_quota_by_workspace(workspace):
    """
    check user/org is whether valid about quota
    """
    username, org_id = workspace.owner, workspace.org_id
    if org_id != -1:
        return _check_org_quota(org_id)
    if '@seafile_group' in username:
        return True
    user = ccnet_api.get_emailuser_with_import(username)
    if not user:  # it will not run here normally
        return False
    orgs = ccnet_api.get_orgs_by_user(username)
    if orgs:  # org user get this
        return _check_org_quota(orgs[0].org_id)
    else:
        return _check_user_quota(user, workspace=workspace)


def _check_org_row_limit(org_id):
    row_limit = OrgQuota.objects.get_row_limit(org_id)
    if row_limit > 0:
        orc = OrgRowsCount.objects.filter(org_id=org_id).first()
        if orc and orc.rows_count > row_limit:
            return False
    return True


def _check_user_row_limit(user):
    """
    user: user object, not org-user
    """
    row_limit, _ = UserQuota.objects.get_row_limit(user.email, user_obj=user)
    if row_limit is not None:
        if row_limit > 0:
            rows_count = UserRowsCount.objects.get_user_rows_count(user.email)
            if rows_count > row_limit:
                return False
        return True
    else:
        return False


def check_row_limit_by_workspace(workspace):
    """
    check user or org rows exceeded
    """
    username, org_id = workspace.owner, workspace.org_id
    if org_id != -1:
        return _check_org_row_limit(org_id)
    if '@seafile_group' in username:
        return True
    user = ccnet_api.get_emailuser_with_import(username)
    if not user:  # it will not run here normally
        return False
    orgs = ccnet_api.get_orgs_by_user(username)
    if orgs:  # org user get this
        return _check_org_row_limit(orgs[0].org_id)
    else:
        return _check_user_row_limit(user)


def check_quota_and_row_limit_by_workspace(workspace):
    return check_quota_by_workspace(workspace) and \
            check_row_limit_by_workspace(workspace)


def get_dtables_rows_count(dtable_uuids):
    """
    dtable_uuids: a list of uuid hex
    return {'dtable_uuid1': 10, 'dtable_uuid2': 2, ...}
    """
    results = {dtable_uuid: 0 for dtable_uuid in dtable_uuids}
    drcs = DTableRowsCount.objects.filter(dtable_uuid__in=dtable_uuids).values('dtable_uuid', 'rows_count')
    results.update({drc['dtable_uuid']: drc['rows_count'] for drc in drcs})
    return results


def get_users_rows_count(usernames):
    """
    usernames: a list of username
    return {'username1': 1, 'username2': 9, ...}
    """
    results = {username: 0 for username in usernames}
    urcs = UserRowsCount.objects.filter(username__in=usernames).values('username', 'rows_count')
    results.update({urc['username']: urc['rows_count'] for urc in urcs})
    return results


def get_orgs_rows_count(org_ids):
    """
    org_ids: a list of org_id
    return {org_id1: 2, org_id2: 0, ...}
    """
    results = {org_id: 0 for org_id in org_ids}
    orcs = OrgRowsCount.objects.filter(org_id__in=org_ids).values('org_id', 'rows_count')
    results.update({orc['org_id']: orc['rows_count'] for orc in orcs})
    return results


def get_snapshot_days_by_workspace(workspace):
    if not is_pro_version():
        return 60

    owner, org_id = workspace.owner, workspace.org_id
    if org_id != -1:
        org = ccnet_api.get_org_by_id(org_id)
        role = OrgSettings.objects.get_role_by_org(org)
    else:
        if '@seafile_group' in owner:
            group_id = int(owner.split('@')[0])
            group = ccnet_api.get_group(group_id)
            username = group.creator_name
        else:
            username = owner
        if username == 'system admin':
            role = DEFAULT_USER
        else:
            user = User.objects.get(email=username)
            role = user.role
    return get_enabled_role_permissions_by_role(role).get('snapshot_days', 30)


# ****** about copy dtable ******
COPY_TMP_PATH = '/tmp/dtable_for_copy/'
service_url = get_service_url().strip()


def clear_tmp_files_and_dirs(uuid):
    # delete tmp files/dirs
    path = os.path.join(COPY_TMP_PATH, uuid)
    if os.path.exists(path):
        shutil.rmtree(path)


def _trans_url(url, src_dtable_uuid, workspace_id, dtable_uuid):
    if url and url.startswith(service_url):
        return re.sub(r'\d+/asset/%s' % (uuid_str_to_36_chars(src_dtable_uuid)), str(workspace_id) + '/asset/' + uuid_str_to_36_chars(dtable_uuid), url)
    return url


def _trans_file_url(file, src_dtable_uuid, workspace_id, dtable_uuid):
    file['url'] = _trans_url(file['url'], src_dtable_uuid, workspace_id, dtable_uuid)
    return file


def _trans_image_url(image_url, src_dtable_uuid, workspace_id, dtable_uuid):
    return _trans_url(image_url, src_dtable_uuid, workspace_id, dtable_uuid)


def _trans_long_text(long_text, src_dtable_uuid, workspace_id, dtable_uuid):
    """
    image in long-text cell
    algorithm maybe not perfect, improve it gradually
    """
    new_images = []
    for image_url in long_text['images']:
        if not image_url:
            continue
        new_image_url = _trans_url(image_url, src_dtable_uuid, workspace_id, dtable_uuid)
        long_text['text'] = long_text['text'].replace(image_url, new_image_url)
        new_images.append(new_image_url)
    long_text['images'] = new_images

    return long_text

def _trans_description_text(description_text, src_dtable_uuid, workspace_id, dtable_uuid):
    urls = re.findall(r'!\[.*?\]\((.*?)\)', description_text, re.M)
    for url in urls:
        if not url:
            continue
        new_url = _trans_url(url, src_dtable_uuid, workspace_id, dtable_uuid)
        description_text = description_text.replace(url, new_url)
    return description_text


def rebuild_content_asset(content, src_dtable, dst_dtable):
    description = content.get('description')
    settings = content.get('settings')
    if settings:
        content['settings']['enable_archive'] = False
    if description:
        new_description_text = _trans_description_text(description.get('text', ''), str(src_dtable.uuid), dst_dtable.workspace_id, str(dst_dtable.uuid))
        content['description']['text'] = new_description_text
    for table in content['tables']:
        img_cols = [col['key'] for col in table['columns'] if col['type'] == 'image']
        file_cols = [col['key'] for col in table['columns'] if col['type'] == 'file']
        long_text_cols = [col['key'] for col in table['columns'] if col['type'] == 'long-text']
        for row in table['rows']:
            for img_col in img_cols:
                if img_col in row and isinstance(row[img_col], list):
                    row[img_col] = [_trans_image_url(img, str(src_dtable.uuid), dst_dtable.workspace_id, str(dst_dtable.uuid)) for img in row.get(img_col, [])]
            for file_col in file_cols:
                if file_col in row and isinstance(row[file_col], list):
                    row[file_col] = [_trans_file_url(f, str(src_dtable.uuid), dst_dtable.workspace_id, str(dst_dtable.uuid)) for f in row.get(file_col, [])]
            for long_text_col in long_text_cols:
                if row.get(long_text_col) and isinstance(row[long_text_col], dict) and row[long_text_col].get('text') and row[long_text_col].get('images'):
                    row[long_text_col] = _trans_long_text(row[long_text_col], str(src_dtable.uuid), dst_dtable.workspace_id, str(dst_dtable.uuid))
    plugin_settings = content.get('plugin_settings', {})
    page_design_settings = plugin_settings.get('page-design', [])
    for page in page_design_settings:
        page['content_url'] = _trans_url(page['content_url'], str(src_dtable.uuid), dst_dtable.workspace_id, str(dst_dtable.uuid))
        page['poster_url'] = _trans_url(page['poster_url'], str(src_dtable.uuid), dst_dtable.workspace_id, str(dst_dtable.uuid))

    return content


def get_uuid_from_custom_path(path):
    dot_index = path.find('.')
    if dot_index == -1:
        return path[len('custom-asset://'):]
    else:
        return path[len('custom-asset://'): dot_index]


def update_custom_assets(content, dst_dtable, username, src_dtable=None):
    if src_dtable:
        if not CustomAssetUUID.objects.filter(dtable_uuid=str(src_dtable.uuid)).exists():
            return
    else:
        custom_dir_id = seafile_api.get_dir_id_by_path(dst_dtable.workspace.repo_id, f'/asset/{str(dst_dtable.uuid)}/custom')
        if not custom_dir_id:
            return
    old_new_dict = {}
    uuid_old_path_dict = {}
    # get old custom-assets in content
    for table in content['tables']:
        img_cols = [col['key'] for col in table['columns'] if col['type'] == 'image']
        file_cols = [col['key'] for col in table['columns'] if col['type'] == 'file']
        for row in table['rows']:
            for img_col in img_cols:
                if img_col in row and isinstance(row[img_col], list):
                    for img in row[img_col]:
                        if not img.startswith('custom-asset://'):
                            continue
                        uuid_old_path_dict[get_uuid_from_custom_path(img)] = img
                        old_new_dict[img] = ''
            for file_col in file_cols:
                if file_col in row and isinstance(row[file_col], list):
                    for file in row[file_col]:
                        if not file['url'].startswith('custom-asset://'):
                            continue
                        uuid_old_path_dict[get_uuid_from_custom_path(file['url'])] = file['url']
                        old_new_dict[file['url']] = ''

    # create custom-assets objects
    step = 1000
    olds = list(old_new_dict.keys())
    for i in range(0, len(olds), step):
        old_uuids = [get_uuid_from_custom_path(old).replace('-', '') for old in olds[i: i+step]]
        old_custom_uuids = CustomAssetUUID.objects.filter(uuid__in=old_uuids).values('uuid', 'parent_path', 'file_name')
        custom_uuid_objs = []
        for uuid_info in old_custom_uuids:
            file_uuid = uuid_info['uuid']
            parent_path = uuid_info['parent_path']
            file_name = uuid_info['file_name']
            new_uuid = uuid4()
            new_md5 = CustomAssetUUID.get_dtable_uuid_parent_path_md5(str(dst_dtable.uuid), parent_path)
            ext = os.path.splitext(uuid_old_path_dict[str(file_uuid)])[1]
            old_new_dict[uuid_old_path_dict[str(file_uuid)]] = f'custom-asset://{str(new_uuid)}{ext}'
            custom_uuid_objs.append(CustomAssetUUID(
                dtable_uuid=str(dst_dtable.uuid),
                uuid=new_uuid,
                parent_path=parent_path,
                dtable_uuid_parent_path_md5=new_md5,
                file_name=file_name
            ))
        CustomAssetUUID.objects.bulk_create(custom_uuid_objs)

    # update content
    for table in content['tables']:
        img_cols = [col['key'] for col in table['columns'] if col['type'] == 'image']
        file_cols = [col['key'] for col in table['columns'] if col['type'] == 'file']
        for row in table['rows']:
            for img_col in img_cols:
                if img_col in row and isinstance(row[img_col], list):
                    for index in range(len(row[img_col])):
                        if not row[img_col][index].startswith('custom-asset://'):
                            continue
                        row[img_col][index] = old_new_dict[row[img_col][index]]  # update
            for file_col in file_cols:
                if file_col in row and isinstance(row[file_col], list):
                    for index in range(len(row[file_col])):
                        if not row[file_col][index]['url'].startswith('custom-asset://'):
                            continue
                        row[file_col][index]['url'] = old_new_dict[row[file_col][index]['url']]  # update

    # update dtable file
    storage_backend.save_dtable(dst_dtable, json.dumps(content), username)

def copy_asset(src_repo_id, src_dtable_uuid, dst_repo_id, dst_dtable_uuid, username, sync_copy=True):
    if sync_copy:
        need_progress = 0
        synchronous = 1
    else:
        need_progress = 1
        synchronous = 0

    src_asset_dir = os.path.join('/asset', str(src_dtable_uuid))
    src_asset_dir_id = seafile_api.get_dir_id_by_path(src_repo_id, src_asset_dir)
    if src_asset_dir_id:
        dst_asset_dir = os.path.join('/asset', str(dst_dtable_uuid))
        src_asset_base_dir, dst_asset_base_dir = os.path.dirname(src_asset_dir), os.path.dirname(dst_asset_dir)
        if not seafile_api.get_dir_id_by_path(dst_repo_id, dst_asset_base_dir):
            seafile_api.mkdir_with_parents(dst_repo_id, '/', dst_asset_base_dir[1:], username)
        res = seafile_api.copy_file(src_repo_id, src_asset_base_dir, json.dumps([str(src_dtable_uuid)]),
                                    dst_repo_id, dst_asset_base_dir, json.dumps([str(dst_dtable_uuid)]),
                                    username=username, need_progress=need_progress, synchronous=synchronous)
        return res
    return None


def copy_dataset_syncs(src_dtable, dst_dtable, username, dry_run=False, dst_workspace=None):
    """
    return dataset synchronous items

    :param: dry_run -> bool, is whether really copy, if dry_run is True, one of dst_dtable or dst_workspace is required; else dst_dtable is required

    :return: {success: [{dataset_id, dataset_name...}], failed: [{dataset_id, dataset_name...}]}
    """
    if dry_run:
        assert dst_dtable or dst_workspace
    else:
        assert dst_dtable

    syncs = {'success': [], 'failed': []}
    src_dtable_server_api = DTableServerAPI('dtable-web', src_dtable.uuid.hex, get_inner_dtable_server_url())
    src_metadata = src_dtable_server_api.get_metadata()
    src_table_ids = [table['_id'] for table in src_metadata.get('tables', [])]

    src_syncs = list(DTableCommonDatasetSync.objects.filter(dst_dtable_uuid=src_dtable.uuid.hex, dst_table_id__in=src_table_ids, is_valid=True).select_related('dataset'))
    valid_dataset_uuids = [d.uuid.hex for d in DTables.objects.filter(uuid__in=[sync.dataset.dtable_uuid for sync in src_syncs], deleted=False)]
    metadata_dict = {}
    for src_sync in src_syncs:
        src_table = next(filter(lambda t: t['_id'] == src_sync.dst_table_id, src_metadata.get('tables', [])), None)
        if src_sync.dataset.dtable_uuid.hex not in valid_dataset_uuids:
            continue
        metadata = metadata_dict.get(src_sync.dataset.dtable_uuid.hex)
        if not metadata:
            dtable_server_api = DTableServerAPI('dtable-web', src_sync.dataset.dtable_uuid.hex, get_inner_dtable_server_url())
            metadata = dtable_server_api.get_metadata()
            metadata_dict[src_sync.dataset.dtable_uuid.hex] = metadata
        dataset_table = next(filter(lambda t: t['_id'] == src_sync.dataset.table_id, metadata.get('tables', [])), None)
        if not dataset_table:
            continue
        dataset_view = next(filter(lambda v: v['_id'] == src_sync.dataset.view_id, dataset_table.get('views', [])), None)
        if not dataset_view:
            continue
        if (dst_dtable and src_sync.dataset.can_access_by_dtable(dst_dtable)) or \
            (dst_workspace and src_sync.dataset.can_access_by_workspace(dst_workspace)):
            if not dry_run:
                sync_obj = DTableCommonDatasetSync.objects.create(
                    dataset=src_sync.dataset,
                    dst_dtable_uuid=dst_dtable.uuid.hex,
                    dst_table_id=src_sync.dst_table_id,
                    creator=username,
                    last_sync_time=src_sync.last_sync_time,
                    src_version=src_sync.src_version,
                    is_sync_periodically=src_sync.is_sync_periodically,
                    sync_interval=src_sync.sync_interval,
                )
                syncs['success'].append(sync_obj.to_dict(detail=True))
            else:
                syncs['success'].append({
                    'dataset_id': src_sync.dataset.id,
                    'dataset_name': src_sync.dataset.dataset_name,
                    'src_table_id': src_table['_id'],
                    'src_table_name': src_table['name']
                })
        else:
            syncs['failed'].append({
                'dataset_id': src_sync.dataset.id,
                'dataset_name': src_sync.dataset.dataset_name,
                'src_table_name': src_table['name'],
                'type': 'permission_denied',
                'error_msg': 'Permission denied to access dataset %s' % src_sync.dataset.dataset_name
            })
    return syncs


def gen_form_id(length=4):
    return ''.join(random.choice(string.ascii_uppercase + string.ascii_lowercase + string.digits) for _ in range(length))


# synchronously copy
def copy_dtable(src_workspace, src_dtable, dst_workspace, dst_name, username, request, include_assets=True):
    from seahub.dtable_apps.workflow.models import DTableWorkflows
    from seahub.dtable_apps.workflow.utils import get_nodes_from_config
    from seahub.dtable_apps.universal_app.models import DTableAppRoles

    # create dtable
    if request and not check_base_limit(dst_workspace, request):
        error_msg = 'base exceeded.'
        return None, error_msg
    try:
        dst_dtable = DTables.objects.create_dtable(username, dst_workspace, dst_name)
    except Exception as e:
        logger.error('create table: %s in dst workspace: %s, error: %s', dst_name, dst_workspace.id, e)
        error_msg = 'Internal Server Error'
        return None, error_msg

    clear_tmp_files_and_dirs(str(dst_dtable.uuid))
    # copy
    try:
        # .dtable
        dtable_server_url = get_inner_dtable_server_url()
        try:
            dtable_server_api = DTableServerAPI('dtable-web', str(src_dtable.uuid), dtable_server_url)
            dtable_content = dtable_server_api.get_base(parse_json=False)
        except Exception as e:
            logger.exception('copy src dtable: %s request content error: %s', src_dtable.uuid, e)
            return None, 'Internal Server Error'
        if dtable_content:
            try:
                dtable_content = json.loads(dtable_content)
            except:
                logger.warning('copy src dtable: %s content invalid', src_dtable.uuid)
                return None, 'Internal Server Error'
        else:
            dtable_content = ''
        if dtable_content:
            # rebuild asset images files url and plugin settings
            dtable_content = rebuild_content_asset(dtable_content, src_dtable, dst_dtable)
            storage_backend.save_dtable(dst_dtable, json.dumps(dtable_content), username)
        else:
            storage_backend.create_empty_dtable(dst_dtable, username)
    except Exception as e:
        logger.error('copy dtable: %s.dtable file error: %s', src_dtable.name, e)
        DTables.objects.filter(id=dst_dtable.id).delete()
        error_msg = 'Internal Server Error'
        return None, error_msg
    finally:
        clear_tmp_files_and_dirs(str(dst_dtable.uuid))

    if include_assets:
        try:
            # asset dir by seafile_api.copy_file, sync-style temporary
            copy_asset(src_workspace.repo_id, src_dtable.uuid, dst_workspace.repo_id, dst_dtable.uuid, username)
        except Exception as e:
            logger.error('dtable: %s, copy asset dir error: %s', src_dtable.id, e)
            error_msg = 'Internal Server Error'
            DTables.objects.filter(id=dst_dtable.id).delete()
            storage_backend.delete_dtable(dst_dtable)
            return None, error_msg
        finally:
            clear_tmp_files_and_dirs(str(dst_dtable.uuid))

        # page design plugin static img
        if dtable_content:
            try:
                plugin_settings = dtable_content.get('plugin_settings', {})
                page_design_settings = plugin_settings.get('page-design', [])
                page_design_content_json_tmp_path = os.path.join(COPY_TMP_PATH, str(dst_dtable.uuid), 'page-design')
                update_page_design_static_image(page_design_settings, dst_workspace.repo_id, dst_dtable.workspace_id,
                    str(dst_dtable.uuid), page_design_content_json_tmp_path, username)
            except Exception as e:
                logger.error('update page design static image failed. ERROR: {}'.format(e))
                return None, 'Internal Server Error'
            finally:
                clear_tmp_files_and_dirs(str(dst_dtable.uuid))

            try:
                update_custom_assets(dtable_content, dst_dtable, username, src_dtable)
            except Exception as e:
                logger.error('update dtable: %s custom assets error: %s', str(dst_dtable.uuid), e)
                return None, 'Internal Server Error'
            finally:
                clear_tmp_files_and_dirs(str(dst_dtable.uuid))

    # copy forms
    try:
        src_forms = DTableForms.objects.filter(dtable_uuid=src_dtable.uuid.hex)
        for src_form in src_forms:
            form_id = gen_form_id()
            while DTableForms.objects.filter(form_id=form_id).exists():
                form_id = gen_form_id()
            form_config = json.loads(src_form.form_config)
            logo_url = form_config.get('logo_url', '')
            theme_background_image_url = form_config.get('theme_background_image_url', '')
            if logo_url and logo_url.startswith(service_url):
                logo_url = re.sub(r'\d+/asset/[-\w]{36}', str(dst_dtable.workspace_id) + '/asset/' + str(dst_dtable.uuid), logo_url)
                form_config['logo_url'] = logo_url
            if theme_background_image_url and theme_background_image_url.startswith(service_url):
                theme_background_image_url = re.sub(r'\d+/asset/[-\w]{36}', str(dst_dtable.workspace_id) + '/asset/' + str(dst_dtable.uuid), theme_background_image_url)
                form_config['theme_background_image_url'] = theme_background_image_url

            dst_form = DTableForms.objects.add_form_obj(
                username, dst_workspace.id, dst_dtable.uuid.hex, json.dumps(form_config)
            )
            # form access permission
            if src_form.share_type == ANONYMOUS or src_form.share_type == LOGIN_USERS:
                dst_form.share_type = src_form.share_type
                dst_form.save()
    except Exception as e:
        logger.error(e)
        return None, 'Internal Server Error'

    # workflows
    old_new_token_dict = {}
    try:
        if ENABLE_WORKFLOW and '@seafile_group' in src_workspace.owner and '@seafile_group' in dst_workspace.owner:
            src_workflows = list(DTableWorkflows.objects.get_workflows_by_dtable_uuid(src_dtable.uuid))
            if src_workflows:
                dst_workflows = []
                for workflow in src_workflows:
                    try:
                        workflow_config = json.loads(workflow.workflow_config)
                    except:
                        continue
                    nodes = get_nodes_from_config(workflow_config)
                    for node in nodes:
                        actions = node.get('actions') or []
                        for action in actions:
                            if action.get('type') == 'run_python_script':
                                action['workspace_id'] = dst_dtable.workspace_id
                                action['owner'] = dst_dtable.workspace.owner
                                action['org_id'] = dst_dtable.workspace.org_id
                                action['repo_id'] = dst_dtable.workspace.repo_id
                    new_token = str(uuid4())
                    dst_workflows.append(DTableWorkflows(
                        token=new_token,
                        dtable_uuid=dst_dtable.uuid.hex,
                        workflow_config=json.dumps(workflow_config),
                        creator=username,
                        owner=dst_workspace.owner
                    ))
                    old_new_token_dict[workflow.token] = new_token
                DTableWorkflows.objects.bulk_create(dst_workflows)
    except Exception as e:
        logger.error('copy workflows error: %s', e)

    # automation rules
    if can_use_automation_rules_by_dtable(dst_dtable):
        try:
            src_auto_rules = DTableAutomationRules.objects.filter(dtable_uuid=src_dtable.uuid.hex)
            dst_auto_rules = []
            for src_auto_rule in src_auto_rules:
                if not src_auto_rule.is_valid:
                    continue
                try:
                    actions = json.loads(src_auto_rule.actions)
                except:
                    actions = []
                for action in actions:
                    if action.get('type') == 'run_python_script':
                        action['workspace_id'] = dst_dtable.workspace_id
                        action['owner'] = dst_dtable.workspace.owner
                        action['org_id'] = dst_dtable.workspace.org_id
                        action['repo_id'] = dst_dtable.workspace.repo_id
                    elif action.get('type') == 'trigger_workflow':
                        action['token'] = old_new_token_dict.get(action.get('token'))
                    elif action.get('type') == 'send_email':
                        action['repo_id'] = dst_dtable.workspace.repo_id
                    elif action.get('type') == 'convert_page_to_pdf':
                        action['repo_id'] = dst_dtable.workspace.repo_id
                        action['workspace_id'] = dst_dtable.workspace_id
                    elif action.get('type') == 'convert_document_to_pdf_and_send':
                        action['repo_id'] = dst_dtable.workspace.repo_id
                        action['workspace_id'] = dst_dtable.workspace_id
                dst_auto_rules.append(DTableAutomationRules(
                    dtable_uuid=dst_dtable.uuid.hex,
                    run_condition=src_auto_rule.run_condition,
                    trigger=src_auto_rule.trigger,
                    actions=json.dumps(actions),
                    creator=username,
                    ctime=datetime.utcnow(),
                    org_id=dst_dtable.workspace.org_id,
                    last_trigger_time=None,
                    is_pause=src_auto_rule.is_pause
                ))
            DTableAutomationRules.objects.bulk_create(dst_auto_rules)
        except Exception as e:
            logger.error(e)
            return None, 'Internal Server Error'

    # notification rules
    try:
        src_notification_rules = DTableNotificationRules.objects.filter(dtable_uuid=src_dtable.uuid.hex)
        for src_notification_rule in src_notification_rules:
            if not src_notification_rule.is_valid:
                continue
            DTableNotificationRules.objects.create(
                dtable_uuid=dst_dtable.uuid.hex,
                run_condition=src_notification_rule.run_condition,
                trigger=src_notification_rule.trigger,
                action=src_notification_rule.action,
                creator=username,
                ctime=datetime.utcnow(),
                last_trigger_time=None,
            )
    except Exception as e:
        logger.error(e)
        return None, 'Internal Server Error'

    # copy apps
    try:
        src_external_apps = list(DTableExternalApps.objects.get_external_apps_by_dtable_uuid(src_dtable.uuid.hex))
        universal_apps, non_universal_apps = [], []

        for external_app in src_external_apps:
            if external_app.app_type == 'universal-app':
                app_id = external_app.id
                app_config = json.loads(external_app.app_config)
                settings = app_config.get('settings', {})
                pages = settings.get('pages', [])
                for page in pages:
                    page_type = page.get('type', '')
                    page_id = page.get('id', '')
                    if page_type == 'custom_page' or page_type == 'single_record_page':
                        page['content_url'] = '/%s/%s/%s.json' % (app_id, page_id, page_id)

                new_app = DTableExternalApps.objects.create(
                    app_uuid=uuid4(),
                    dtable_uuid=dst_dtable.uuid.hex,
                    app_type=external_app.app_type,
                    app_config=json.dumps(app_config),
                    created_at=datetime.utcnow(),
                    creator=username,
                    org_id=dst_dtable.workspace.org_id
                )
                universal_apps.append(new_app)
            else:
                non_universal_apps.append(DTableExternalApps(
                    app_uuid=uuid4(),
                    dtable_uuid=dst_dtable.uuid.hex,
                    app_type=external_app.app_type,
                    app_config=external_app.app_config,
                    created_at=datetime.utcnow(),
                    creator=username,
                    org_id=dst_dtable.workspace.org_id
                ))

        DTableExternalApps.objects.bulk_create(non_universal_apps)
        for app in universal_apps:
            if include_assets:

                # universal app: custom page static image URL
                try:
                    app_id = app.id
                    app_config = json.loads(app.app_config)
                    settings = app_config.get('settings', {})
                    pages = settings.get('pages', [])
                    universal_app_page_content_json_tmp_path = os.path.join(COPY_TMP_PATH, str(dst_dtable.uuid), 'external-apps')
                    rename_universal_app_static_assets_dir(pages, app_id, dst_workspace.repo_id, str(dst_dtable.uuid), username)
                    update_universal_app_custom_page_static_image(pages, app_id, dst_workspace.repo_id, dst_dtable.workspace_id,
                            str(dst_dtable.uuid), universal_app_page_content_json_tmp_path, username)
                    update_universal_app_single_record_page_static_assets(pages, app_id, dst_workspace.repo_id, dst_dtable.workspace_id,
                            str(dst_dtable.uuid), universal_app_page_content_json_tmp_path, username)
                    for page in pages:
                        page_type = page.get('type', '')
                        page_id = page.get('id', '')
                        if page_type == 'custom_page' or page_type == 'single_record_page':
                            page['content_url'] = '/%s/%s/%s.json' % (app_id, page_id, page_id)

                    app.app_config = json.dumps(app_config)
                    app.save()
                except Exception as e:
                    logger.error('update custom page of universal app static image failed. ERROR: {}'.format(e))
                    return None, 'Internal Server Error'
                finally:
                    clear_tmp_files_and_dirs(str(dst_dtable.uuid))
            DTableAppRoles.objects.generate_app_default_role(app)

    except Exception as e:
        logger.error('copy apps error: %s', e)

    return dst_dtable, None


def gen_dtable_temp_api_token_key(dtable_uuid, username):
    return 'DTABLE_TEMP_KEY_%s_%s' % (dtable_uuid, username)


def get_share_permission(permission, dtable_uuid):
    """
    permission: c-7
    dtable_uuid: dtable.uuid.hex
    """
    try:
        permission_id = int(permission[len(PERMISSION_PREFIX):])
    except Exception as e:
        return None

    return DTableSharePermission.objects.get_by_id_and_dtable(
            permission_id, dtable_uuid)


def can_user_run_python(username):
    try:
        user = User.objects.get(username)
    except User.DoesNotExist:
        return False
    return user.permissions.can_run_python_script()


def can_org_run_python(org):
    role = OrgSettings.objects.get_role_by_org(org)
    return get_enabled_role_permissions_by_role(role).get('can_run_python_script', False)


def can_run_python_by_dtable(dtable):
    """
    judge whether owner of the dtable can run python
    """
    if not SEATABLE_FAAS_URL:
        return False
    owner = dtable.workspace.owner
    username, org = None, None
    # checkout org id or username
    if '@seafile_group' in owner:
        group_id = int(owner[:owner.find('@seafile_group')])
        org_id = ccnet_api.get_org_id_by_group(group_id)
        if org_id != -1:
            org = ccnet_api.get_org_by_id(org_id)
        else:
            return True
    else:
        orgs = ccnet_api.get_orgs_by_user(owner)
        if orgs:
            org = orgs[0]
        else:
            username = owner

    # check user/org role and judge whether can run script
    if username:
        return can_user_run_python(username)

    elif org:
        return can_org_run_python(org)

    return False


def can_use_automation_rules_by_dtable(dtable):
    """
    judge whether owner of the dtable can use automation rules
    """
    owner = dtable.workspace.owner
    username, org = None, None
    # checkout org id or username
    if '@seafile_group' in owner:
        group_id = int(owner[:owner.find('@seafile_group')])
        org_id = ccnet_api.get_org_id_by_group(group_id)
        if org_id != -1:
            org = ccnet_api.get_org_by_id(org_id)
        else:
            return True
    else:
        orgs = ccnet_api.get_orgs_by_user(owner)
        if orgs:
            org = orgs[0]
        else:
            username = owner

    # check user/org role and judge whether can use automation rules
    if username:
        try:
            user = User.objects.get(username)
        except User.DoesNotExist:
            return False
        return user.permissions.can_use_automation_rules()

    elif org:
        role = OrgSettings.objects.get_role_by_org(org)
        return get_enabled_role_permissions_by_role(role).get('can_use_automation_rules', False)

    return False


def can_use_workflows_by_dtable(dtable):
    """
    judge whether owner of the dtable can use workflows
    """
    if not ENABLE_WORKFLOW:
        return False

    owner = dtable.workspace.owner
    if '@seafile_group' in owner:
        group_id = int(owner[:owner.find('@seafile_group')])
        org_id = ccnet_api.get_org_id_by_group(group_id)
        if CLOUD_MODE and org_id == -1:
            return False
        return True
    return False


def can_use_external_apps_by_dtable(dtable):
    """
    judge whether owner of the dtable can use apps
    """
    if not is_pro_version():
        return False
    owner = dtable.workspace.owner
    username, org = None, None
    # checkout org id or username
    if '@seafile_group' in owner:
        group_id = int(owner[:owner.find('@seafile_group')])
        org_id = ccnet_api.get_org_id_by_group(group_id)
        if org_id != -1:
            org = ccnet_api.get_org_by_id(org_id)
        else:
            return True
    else:
        orgs = ccnet_api.get_orgs_by_user(owner)
        if orgs:
            org = orgs[0]
        else:
            username = owner

    # check user/org role and judge whether can use apps
    if username:
        try:
            user = User.objects.get(username)
        except User.DoesNotExist:
            return False
        return user.permissions.can_use_external_app()

    elif org:
        role = OrgSettings.objects.get_role_by_org(org)
        return get_enabled_role_permissions_by_role(role).get('can_use_external_app', False)
    return False


def can_use_advanced_permissions_by_dtable(dtable):
    """
    judge whether owner of the dtable can use apps
    """
    if not is_pro_version():
        return False
    owner = dtable.workspace.owner
    org_id = dtable.workspace.org_id
    username, org = None, None

    if org_id != -1:
        org = ccnet_api.get_org_by_id(org_id)
    else:
        if '@seafile_group' in owner:
            return True
        username = owner

    # check user/org role and judge whether can use apps
    if username:
        try:
            user = User.objects.get(username)
        except User.DoesNotExist:
            return False
        return user.permissions.can_use_advanced_permissions()

    elif org:
        role = OrgSettings.objects.get_role_by_org(org)
        return get_enabled_role_permissions_by_role(role).get('can_use_advanced_permissions', False)
    return False


def check_dtable_can_use_advanced_customization(dtable):
    if not is_pro_version():
        return False
    owner = dtable.workspace.owner
    username, org = None, None
    # checkout org id or username
    if '@seafile_group' in owner:
        group_id = int(owner[:owner.find('@seafile_group')])
        org_id = ccnet_api.get_org_id_by_group(group_id)
        if org_id != -1:
            org = ccnet_api.get_org_by_id(org_id)
        else:
            return True
    else:
        orgs = ccnet_api.get_orgs_by_user(owner)
        if orgs:
            org = orgs[0]
        else:
            username = owner

    # check user/org role and judge whether can use apps
    if username:
        try:
            user = User.objects.get(username)
        except User.DoesNotExist:
            return False
        return user.permissions.can_use_advanced_customization()

    elif org:
        role = OrgSettings.objects.get_role_by_org(org)
        return get_enabled_role_permissions_by_role(role).get('can_use_advanced_customization', False)
    return False


def can_use_advanced_customization_by_dtable(dtable):
    """
    judge whether owner of the dtable can use customization
    """
    key = normalize_cache_key(str(dtable.uuid), prefix=DTABLE_IS_ADVANCE_PREFIX)
    can_use_advanced_customization = cache.get(key)
    if can_use_advanced_customization is None:
        can_use_advanced_customization = check_dtable_can_use_advanced_customization(dtable)
        cache.set(key, can_use_advanced_customization, DTABLE_IS_ADVANCE_CACHE_TIMEOUT)

    return can_use_advanced_customization


def clean_advanced_customization_dtable_caches(org_id):
    workspace_ids = list(Workspaces.objects.filter(org_id=org_id).values_list('id', flat=True))
    for workspace_id in workspace_ids:
        dtable_uuids = list(DTables.objects.filter(workspace_id=workspace_id).values_list('uuid', flat=True))
        step = 1000
        for i in range(0, len(dtable_uuids), step):
            keys = [normalize_cache_key(str(dtable_uuid), prefix=DTABLE_IS_ADVANCE_PREFIX) for dtable_uuid in dtable_uuids[i: i+step]]
            cache.delete_many(keys)

def can_archive_rows_by_dtable(dtable):
    """
    judge whether owner of the dtable can use apps
    """
    if not is_pro_version():
        return False
    owner = dtable.workspace.owner
    username, org = None, None
    # checkout org id or username
    if '@seafile_group' in owner:
        group_id = int(owner[:owner.find('@seafile_group')])
        org_id = ccnet_api.get_org_id_by_group(group_id)
        if org_id != -1:
            org = ccnet_api.get_org_by_id(org_id)
        else:
            return True
    else:
        orgs = ccnet_api.get_orgs_by_user(owner)
        if orgs:
            org = orgs[0]
        else:
            username = owner

    # check user/org role and judge whether can archive rows
    if username:
        try:
            user = User.objects.get(username)
        except User.DoesNotExist:
            return False
        return user.permissions.can_archive_rows()

    elif org:
        role = OrgSettings.objects.get_role_by_org(org)
        return get_enabled_role_permissions_by_role(role).get('can_archive_rows', False)
    return False


def is_api_gateway_calls_exceed_by_dtable(dtable):
    org_id = dtable.workspace.org_id
    if org_id == -1:
        return False

    api_calls_limit = OrgQuota.objects.get_monthly_api_call_limit(org_id)
    api_calls_count = StatsAPIGatewayByTeam.objects.get_month_all_count(org_id)

    return api_calls_count > api_calls_limit


def is_form_expired(form_obj):
    form_config = form_obj.form_config
    if not form_config:
        return False
    try:
        form_config_dict = json.loads(form_config)
    except Exception as e:
        logger.error('form: %s, config: %s, invalid error: %s', form_obj.token, form_obj.form_config, e)
        return False
    submit_deadline_option = form_config_dict.get('submit_deadline_option')
    if not submit_deadline_option:
        return False
    is_submit_deadline_show = submit_deadline_option.get('is_submit_deadline_show', False)
    if not is_submit_deadline_show:
        return False
    submit_deadline_str = submit_deadline_option.get('submit_deadline')
    if not submit_deadline_str:
        return False
    try:
        submit_deadline = datetime.strptime(submit_deadline_str, '%Y-%m-%d %H:%M:%S')
    except Exception as e:
        logger.error('form: %s, submit_deadline: %s, submit_deadline error: %s', form_obj.token, submit_deadline_str, e)
        return False
    return submit_deadline < datetime.now()

def is_collection_table_expired(collection_table):
    config = collection_table.config
    if not config:
        return False
    try:
        config_dict = json.loads(config)
    except Exception as e:
        logger.error('collection_table: %s, config: %s, invalid error: %s', collection_table.token, collection_table.config, e)
        return False
    submit_deadline_option = config_dict.get('submit_deadline_option')
    if not submit_deadline_option:
        return False
    is_submit_deadline_show = submit_deadline_option.get('is_submit_deadline_show', False)
    if not is_submit_deadline_show:
        return False
    submit_deadline_str = submit_deadline_option.get('submit_deadline')
    if not submit_deadline_str:
        return False
    try:
        submit_deadline = datetime.strptime(submit_deadline_str, '%Y-%m-%d %H:%M:%S')
    except Exception as e:
        logger.error('collection_table: %s, submit_deadline: %s, submit_deadline error: %s', collection_table.token, submit_deadline_str, e)
        return False
    return submit_deadline < datetime.now()


def check_base_limit(workspace, request):
    from seahub.settings import PERSONAL_BASE_LIMIT, GROUP_BASE_LIMIT, FREE_ORG_BASE_LIMIT
    org_id = workspace.org_id
    if org_id != -1 and not request.user.permissions.can_use_advanced_permissions():
        org_dtable_count = DTables.objects.filter(deleted=False, workspace__org_id=org_id).select_related('workspace').count()
        if org_dtable_count >= FREE_ORG_BASE_LIMIT:
            return False

    try:
        dtable_count = DTables.objects.filter(workspace=workspace, deleted=False).count()
    except Exception as e:
        logger.error('check workspace %d base count error, invalid error: %s', workspace.id, e)
        return False

    owner = workspace.owner
    if '@seafile_group' in owner:
        return dtable_count < GROUP_BASE_LIMIT

    return dtable_count < PERSONAL_BASE_LIMIT


def get_user_admin_groups(username):
    """
    return groups that user is the admin of, [group_objs...]
    """
    groups = get_user_groups(username)

    admin_group_ids = get_user_admin_group_ids(username)
    admin_groups = [group for group in groups if group.id in admin_group_ids]

    return admin_groups


def get_user_admin_dtables(username, by_group=False):
    """
    if by_group is False, return list of dtables
    if by_group is True, return {'personal': [dtbales...], 'groups': [{'group_id': '', 'group': group obj, 'dtables': []}]}
    """
    admin_groups = get_user_admin_groups(username)
    owner_list = [username] + ['%s@seafile_group' % group.id for group in admin_groups]
    dtables = DTables.objects.filter(workspace__owner__in=owner_list, deleted=False).select_related()
    if not by_group:
        return dtables
    else:
        admin_groups_dict = {group.id: group for group in admin_groups}
        group_dtables, group_flags = [], {}
        personal_dtables = []
        for dtable in list(dtables):
            if '@seafile_group' in dtable.workspace.owner:
                group_id = int(dtable.workspace.owner.split('@')[0])
                if group_id not in group_flags:
                    group_flags[group_id] = len(group_dtables)
                    group_dtables.append({
                        'group_id': group_id,
                        'group': admin_groups_dict[group_id],
                        'dtables': [dtable]
                    })
                else:
                    group_dtables[group_flags[group_id]]['dtables'].append(dtable)
            else:
                personal_dtables.append(dtable)

    return {'personal': personal_dtables, 'groups': group_dtables}


def gen_random_option(option_name):
    index = random.randint(0, len(VALID_OPTION_TAGS) - 1)
    tag = {
        'name': option_name,
        'color': VALID_OPTION_TAGS[index]['color'],
        'text_color': VALID_OPTION_TAGS[index]['text_color']
    }
    return tag


def migrate_image(link, dtable, upload_relative_path, target_relative_path, username='form'):
    """
    migrate image from upload relative path, at which image uploaded from form / workflow / univeral apps and so on, to target relative path

    if image link valid and in upload_relative_path, return new link
    if image link invalid or not found or move failed in upload_relative_path return None

    :param link: uploaded image link
    :param dtable
    :param uploaded_relative_path: where image uploaded
    :param target_relative_path: to which image would be migareted
    :return: new_link or None
    """
    link = link.strip()
    if not link.startswith(DTABLE_WEB_SERVICE_URL):
        return None
    if link.startswith(DTABLE_WEB_SERVICE_URL.rstrip('/') + '/workspace/%s/asset/%s/%s/' % (dtable.workspace_id, str(dtable.uuid), target_relative_path)):
        return None

    if os.path.join('/asset', str(dtable.uuid), upload_relative_path) not in link:
        return None

    query_index = link.find('?')
    if query_index != -1:
        link = link[:query_index]
    link = unquote(link.strip('/'))

    image_name = os.path.basename(link)
    old_image_path = os.path.join('/asset', str(dtable.uuid), upload_relative_path, image_name)
    repo_id = dtable.workspace.repo_id
    if not seafile_api.get_file_id_by_path(repo_id, old_image_path):
        logger.warning('can\'t find image by path: %s', old_image_path)
        return None

    dtable_asset_image_dir = os.path.join('/asset', str(dtable.uuid), target_relative_path, str(datetime.today())[:7])
    dtable_asset_image_dir_id = seafile_api.get_dir_id_by_path(repo_id, dtable_asset_image_dir)
    if not dtable_asset_image_dir_id:
        seafile_api.mkdir_with_parents(repo_id, '/', dtable_asset_image_dir[1:], username)
    new_image_name = check_filename_with_rename(repo_id, dtable_asset_image_dir, image_name)

    seafile_api.move_file(repo_id, os.path.dirname(old_image_path), json.dumps([image_name]),
                          repo_id, dtable_asset_image_dir, json.dumps([new_image_name]), 0, username, 0)

    path = os.path.join(target_relative_path, str(datetime.today())[:7], new_image_name)
    new_image_url = '/workspace/%s/asset/%s/%s' % (dtable.workspace_id, str(dtable.uuid), path)

    return DTABLE_WEB_SERVICE_URL.rstrip('/') + quote(new_image_url)


def generate_upload_link(path, dtable):
    """
    generate upload link of path
    :return: upload_link
    """
    # create asset dir
    asset_dir_id = seafile_api.get_dir_id_by_path(dtable.workspace.repo_id, path)
    if not asset_dir_id:
        seafile_api.mkdir_with_parents(dtable.workspace.repo_id, '/', path[1:], '')

    # get token
    obj_id = json.dumps({'parent_dir': path})
    token = seafile_api.get_fileserver_access_token(dtable.workspace.repo_id, obj_id, 'upload', '', use_onetime=False)

    upload_link = gen_file_upload_url(token, 'upload-api')
    return upload_link


def add_convert_app_table_page_to_excel_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}

    url = urljoin(DTABLE_EVENTS_IO_SERVER_URL, '/add-convert-app-table-page-to-excel-task')

    resp = requests.post(url, data=params, headers=headers)
    if not resp.ok:
        logger.error(resp.content)
        raise Exception

    return json.loads(resp.content)['task_id']


def slugid_nice():
    u = uuid4()
    u_bytes = u.bytes
    slugid = base64.urlsafe_b64encode(u_bytes).rstrip(b'=').decode('ascii')

    return slugid


def get_remote_ip(request):
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR', '-')
    return ip


def get_file_suffix(path):
    try:
        name = os.path.basename(path)
        suffix = os.path.splitext(name)[1][1:]
        if suffix:
            return suffix.lower()
        return None
    except:
        return None


USER_AGENT_LENGTH_LIMIT = 500


def send_file_access_msg(request, dtable, path, access_from):
    if get_file_suffix(path) not in AUDIT_FILE_TYPES:
        return

    if not can_use_advanced_customization_by_dtable(dtable):
        return

    try:
        username = request.user.username
        if not username:
            username = 'AnonymousUser'
        org_id = dtable.workspace.org_id
        ip = get_remote_ip(request)
        user_agent = request.headers.get("user-agent")[:USER_AGENT_LENGTH_LIMIT]

        file_audit_operation.send(None, etype=access_from, username=username, ip=ip, user_agent=user_agent,
                                  org_id=org_id, dtable_uuid=str(dtable.uuid), path=path
                                  )
    except Exception as e:
        logger.error('send file access log failed, error: %s', e)


def check_table_operate_permission(workspace, dtable, username, table_name):
    dtable_server_url = get_inner_dtable_server_url()
    try:
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), dtable_server_url)
        metadata = dtable_server_api.get_metadata()
    except Exception as e:
        logger.exception('request dtable: %s, error: %s', dtable.uuid, e)
        return False, False

    table = next(filter(lambda table: table['name'] == table_name, metadata.get('tables', [])), {})
    table_permissions = table.get('table_permissions')

    can_add_row = True
    can_update_row = True

    if not table_permissions:
        return can_add_row, can_update_row

    add_rows_permission = table_permissions.get('add_rows_permission', {})
    edit_rows_permission = table_permissions.get('edit_rows_permission', {})

    add_rows_permission_type = add_rows_permission.get('permission_type')
    edit_rows_permission_type = edit_rows_permission.get('permission_type')

    if add_rows_permission_type == 'none':
        can_add_row = False

    if edit_rows_permission_type == 'none':
        can_update_row = False

    if add_rows_permission_type == 'admins' or edit_rows_permission_type == 'admins':
        group_id = None
        owner = workspace.owner
        if "@seafile_group" in owner:
            group_id = int(owner.split('@')[0])

        if group_id:
            is_admin = is_group_admin_or_owner(group_id, username)
        else:
            is_admin = username == workspace.owner

        if add_rows_permission_type == 'admins' and not is_admin:
            can_add_row = False

        if edit_rows_permission_type == 'admins' and not is_admin:
            can_update_row = False

    if add_rows_permission_type == 'specific_users':
        permitted_users = add_rows_permission.get('permitted_users', [])
        if username not in permitted_users:
            can_add_row = False

    if edit_rows_permission_type == 'specific_users':
        permitted_users = edit_rows_permission.get('permitted_users', [])
        if username not in permitted_users:
            can_update_row = False

    return can_add_row, can_update_row

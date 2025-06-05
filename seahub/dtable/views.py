# -*- coding: utf-8 -*-
import os
import time
import logging
import jwt
import json
import mimetypes
import hashlib
import requests
import shutil
from email.utils import formatdate

from django.urls import reverse
from django.views.decorators.cache import cache_control
from django.http import Http404, HttpResponseRedirect, HttpResponse, FileResponse
from django.db.models import F
from django.shortcuts import render
from django.utils.translation import gettext as _
from urllib.parse import quote
from django.utils.http import quote_etag

import seaserv
from seaserv import seafile_api

from seahub import settings
from seahub.auth import SESSION_MOBILE_LOGIN_KEY
from seahub.auth.models import AnonymousUser
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import Workspaces, DTables, DTableForms, DTableShareLinks, \
    DTableRowShares, DTableShare, \
    DTableFormShare, DTableExternalLinks, DTableViewUserShare, DTableViewGroupShare, \
    DTableSystemPlugins, DTableOpenedBys, DTableCollectionTables, DTableViewExternalLinks, IdInOrgTuple, \
    CustomAssetUUID, BoundThirdPartyAccounts, _decrypt_detail, DTableFormCustomURLs, DTableExternalApps
from seahub.dtable.signals import share_dtable_to_user
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.universal_app.models import DTableAppUserSync
from seahub.dtable_apps.universal_app.utils import check_app_user, check_app_asset_permission
from seahub.dtable_apps.workflow.models import DTableWorkflows
from seahub.dtable_apps.workflow.utils import get_table_id_from_config
from seahub.utils import normalize_file_path, render_error, render_error_form, render_permission_error, \
     gen_file_get_url, get_file_type_and_ext, is_org_context, gen_inner_file_get_url, redner_error_collection, \
     uuid_str_to_36_chars
from seahub.auth.decorators import login_required, bind_token_user, bind_cookie_user
from seahub.settings import DTABLE_SERVER_URL, DTABLE_SOCKET_URL, ENABLE_WORKFLOW, MEDIA_URL, \
    DTABLE_PRIVATE_KEY, FILE_ENCODING_LIST, DTABLE_WEB_SERVICE_URL, POWERED_BY_LINK, DTABLE_BAIDU_MAP_KEY, \
    DTABLE_GOOGLE_MAP_KEY, SEATABLE_MARKET_URL, SHARE_LINK_EXPIRE_DAYS_MIN, DTABLE_MINE_MAP_KEY, \
    SHARE_LINK_EXPIRE_DAYS_MAX, ENABLE_USER_TO_SET_NUMBER_SEPARATOR, \
    INTERNAL_PLUGINS_CONFIG, SEATABLE_FAAS_URL, HELP_LINK, USE_PHONE_REGISTRATION_BY_DEFAULT, \
    ENABLE_ABUSE_REPORT, DTABLE_ENABLE_EMAIL_COLUMN, ADVANCED_PLUGINS, DTABLE_APPS_CONFIG, ENABLED_EXTERNAL_APPS, \
    IS_PRO_VERSION, DTABLE_EXPORT_MAX_SIZE, DTABLE_SERVER_URL, EXTERNAL_LINK_SUPPORT_DOWNLOAD_TYPE, \
    EXTERNAL_LINK_SUPPORT_DOWNLOAD_SIZE, FILE_SERVER_ROOT, BASE_WRITABLE_LIMIT, CUSTOM_COLORS, \
    DEFAULT_SEAFILE_SERVER, USE_EXTERNAL_TEAM_ADMIN, ENABLE_ADDRESSBOOK_V2, \
    ENABLE_DEPARTMENT_COLUMN_FOR_ALL, SEADOC_SERVER_URL, ENABLE_SEADOC, ENABLED_ASSISTANT_TYPES, LOAD_DTABLE_FROM_API_GATEWAY, \
    ENABLE_API_GATEWAY_PROXY_SOCKET


from seahub.api2.utils import send_signal_to_dtable_server, get_user_common_info, to_python_boolean
from seahub.dtable.utils import can_use_automation_rules_by_dtable, check_dtable_operation_permission, \
    check_dtable_permission, clean_related_users_cache, has_dtable_asset_cache_download_permission, \
    can_access_asset, list_dtable_related_users, check_form_submit_permission, SHARED_GROUPS, \
    check_quota_by_workspace, check_row_limit_by_workspace, check_quota_and_row_limit_by_workspace, \
    get_view_share_permision, can_run_python_by_dtable, is_form_expired, is_collection_table_expired, \
    copy_dtable, check_base_access, is_big_data_row_limit_exceeded, \
    set_dtable_asset_cache_download_permission, add_dtable_io_task, query_dtable_io_status, \
    is_group_admin_or_owner, check_external_link, check_share_link_common, is_belong_to_user_or_in_the_same_org, \
    get_snapshot_days_by_workspace, set_dtable_asset_cache_read_permission, is_big_data_storage_limit_exceeded, \
    is_valid_app_jwt, send_file_access_msg, check_dtable_operation_permission_by_metadata
from seahub.constants import PERMISSION_ADMIN, PERMISSION_READ_WRITE, PERMISSION_READ, PERMISSION_COLLECTION_TABLE, \
    DTABLE_MINE_MAP_CUSTOM_CONFIG
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster
from seahub.views.file import get_file_content
from seahub.utils.auth import get_login_bg_image_path
from seahub.group.utils import get_user_groups, group_id_to_name, is_group_member
from seahub.dtable.utils import add_dtable_io_task, query_dtable_io_status, is_group_admin_or_owner, check_external_link, \
    check_share_link_common, is_belong_to_user_or_in_the_same_org, \
    get_snapshot_days_by_workspace, set_dtable_asset_cache_read_permission, can_edit_document
from seahub.organizations.models import OrgAdminSettings
from seahub.weixin.utils import weixin_check
from seahub.utils import DOCUMENT, SPREADSHEET, get_inner_dtable_server_url, SEADOC
from seahub.onlyoffice.utils import get_onlyoffice_dict
from seahub.onlyoffice.settings import ENABLE_ONLYOFFICE, ONLYOFFICE_FILE_EXTENSION
from seahub.dtable.settings import DTABLE_SHARE_QUOTA
from constance import config
from seahub.utils.storage_backend import storage_backend
from seahub.department_v2.models import DepartmentsV2
from seahub.department_v2.utils import get_departments_map_by_request_dtable, is_user_open_department_feature
from seahub.collabora.utils import get_wopi_dict
from seahub.collabora.settings import ENABLE_COLLABORA, COLLABORA_FILE_EXTENSION
from seahub.seadoc.utils import get_seadoc_file_uuid, gen_seadoc_access_token, get_documents_config

if settings.HAS_OFFICE_CONVERTER:
    from seahub.utils import prepare_converted_html

try:
    from seahub.settings import CUSTOM_POWERED_BY
except ImportError:
    CUSTOM_POWERED_BY = ''

logger = logging.getLogger(__name__)

FILE_TYPE = '.dtable'
WRITE_PERMISSION_TUPLE = (PERMISSION_READ_WRITE, PERMISSION_ADMIN)
SEATABLE_VERSION = getattr(settings, 'SEATABLE_VERSION', 'Dev')
SEATABLE_FAAS_TOKEN = getattr(settings, 'SEATABLE_FAAS_AUTH_TOKEN', None)
NOT_IN_STORAGE_ERROR_MSG = 'This Base needs to be migrated to storage-server. Please contact your system administration.'


def conditional_browser_cache(func):
    """
    To use this decorator to set conditional cache headers,
    timepstamp 't' in request.GET is required,
    and 't' is supposed to be in millisecond.
    """
    def wrapper(*args, **kwargs):
        request = args[0]
        timestamp = request.GET.get('t', '')
        if timestamp:
            etag = quote_etag(hashlib.md5(timestamp.encode('utf-8')).hexdigest())
            last_modified = formatdate(timeval=int(timestamp) // 1000, localtime=False, usegmt=True)
        else:
            etag = ''
            last_modified = ''

        if_none_match_etags = request.META.get('HTTP_IF_NONE_MATCH', '')
        if_modified_since = request.META.get('HTTP_IF_MODIFIED_SINCE', '')

        if if_none_match_etags.startswith('W/'):
            if_none_match_etags = if_none_match_etags.lstrip('W/')

        if ((if_none_match_etags and if_none_match_etags == etag) or
            (if_modified_since and if_modified_since == last_modified)):
            response = HttpResponse(status=304)
            response['ETag'] = etag
            response['Last-Modified'] = last_modified
            return response

        response = func(*args, **kwargs)
        response['ETag'] = etag
        response['Last-Modified'] = last_modified
        return response
    return wrapper


@login_required
def dtable_file_view(request, workspace_id, name):
    """

    Permission:
    1. owner
    2. group member
    3. shared user
    """
    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    group_id = ''
    if '@seafile_group' in workspace.owner:
        group_id = workspace.owner.split('@')[0]
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return render_error(request, error_msg)

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        return render_error(request, 'Library does not exist.')

    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    password_check, err_msg = check_base_access(request, dtable)
    if not password_check:
        return render(request, 'base_access_validation.html', {
            'workspace_id': workspace_id,
            'name': name,
            'err_msg': err_msg,
            'view_name': 'dtable:dtable_file_view'
        })

    # permission check
    username = request.user.username
    is_org_staff = request.user.org.is_staff if request.user.org else False
    user_groups = get_user_groups(username)
    user_group_ids = set([g.id for g in user_groups])
    permission = check_dtable_permission(username, workspace, dtable)
    if not permission:
        # check dtable view user share
        user_share = DTableViewUserShare.objects.filter(
            to_user = username,
            dtable = dtable
        ).first()
        if user_share:
            return HttpResponseRedirect(reverse('dtable:dtable_user_view_share_file_view', args=(user_share.id, )))

        # check dtable view group share
        dtable_view_group_shares = DTableViewGroupShare.objects.filter(
            dtable = dtable
        ).values_list('id', 'to_group_id')
        group_share_ids_map = {}
        for share_id, to_group_id in dtable_view_group_shares:
            group_share_ids_map[to_group_id] = share_id

        shared_group_ids = set(group_share_ids_map.keys())

        user_share_group_id_list = list(shared_group_ids.intersection(user_group_ids))
        if user_share_group_id_list:
            group_id = user_share_group_id_list[0]
            share_id = group_share_ids_map.get(group_id)
            return HttpResponseRedirect(reverse('dtable:dtable_group_view_share_file_view', args=(share_id, )))

        return render_permission_error(request, _('Permission denied.'))

    is_first_open = False
    try:
        if DTableOpenedBys.objects.is_first_open_by_user(dtable.uuid.hex, username):
            DTableOpenedBys.objects.create(dtable_uuid=dtable.uuid.hex, opened_by_user=username)
            is_first_open = True
    except Exception as e:
        logger.error('check is first open failed. {}'.format(e))

    is_admin = False
    if group_id:
        is_admin = is_group_admin_or_owner(group_id, username)
    else:
        # open your own dtable
        is_admin = username == workspace.owner

    seafile_url = ''
    repo_api_token = ''
    try:
        seafile_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_type(dtable.uuid.hex, 'seafile').first()
        if seafile_account:
            detail = _decrypt_detail(json.loads(seafile_account.detail))
            seafile_url = detail.get('seafile_url', '')
            repo_api_token = detail.get('repo_api_token', '')
    except Exception as e:
        logger.error(e)

    asset_quota_pass = check_quota_by_workspace(workspace)
    rows_pass = check_row_limit_by_workspace(workspace)
    quota_row_limit_pass = asset_quota_pass and rows_pass


    # can_create_common_dataset, generally permission of role
    # but in org, need permission and ENABLE_ORG_COMMON_DATASET in settings
    can_create_common_dataset = request.user.permissions.can_create_common_dataset()
    org_id = workspace.org_id
    if org_id != -1:
        can_create_common_dataset = can_create_common_dataset and settings.ENABLE_ORG_COMMON_DATASET

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    enable_external_apps = list()
    app_user_table_ids = []
    for app in DTABLE_APPS_CONFIG:
        app_type = app.get('app_type', '')
        if app_type in ENABLED_EXTERNAL_APPS:
            enable_external_apps.append(app)
            if app_type == "universal-app":
                app_user_table_ids = DTableAppUserSync.objects.get_table_ids_by_uuid(dtable.uuid.hex)


    enable_workflow = ENABLE_WORKFLOW
    if '@seafile_group' not in workspace.owner:
        enable_workflow = False

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)

    mobile_login = request.session.get(SESSION_MOBILE_LOGIN_KEY, False)

    kwargs = {
        'id_in_org': id_in_org,
        'user_department_ids_map': user_department_ids_map
    }
    permission = permission if check_quota_and_row_limit_by_workspace(dtable.workspace) else 'r'
    dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url, permission=permission, kwargs=kwargs)
    access_token = dtable_server_api.view_access_token

    # big data row and storage check
    big_data_row_limit_exceeded = is_big_data_row_limit_exceeded(org_id)
    big_data_storage_limit_exceeded = is_big_data_storage_limit_exceeded(org_id)

    disable_big_data_feature = big_data_row_limit_exceeded or big_data_storage_limit_exceeded

    return_dict = {
        'id_in_org': id_in_org,
        'is_org_staff': is_org_staff,
        'version': SEATABLE_VERSION,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_mine_map_custom_config': DTABLE_MINE_MAP_CUSTOM_CONFIG,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'seatable_market_url': SEATABLE_MARKET_URL,
        'filename': name,
        'dtable_color': dtable.color,
        'workspace_id': workspace_id,
        'dtable_uuid': str(dtable.uuid),
        'current_group_id': int(group_id) if dtable.is_owned_by_group else None,
        'is_owned_by_group': dtable.is_owned_by_group,
        'user_group_ids': list(user_group_ids),
        'permission': permission if quota_row_limit_pass else 'r',
        'media_url': MEDIA_URL,
        'seafile_url': seafile_url,
        'repo_api_token': repo_api_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'file_server_root': FILE_SERVER_ROOT,
        'dtable_enable_email_column': DTABLE_ENABLE_EMAIL_COLUMN,
        'is_admin': is_admin,
        'enable_weixin': weixin_check(),
        'big_data_row_limit_exceeded': big_data_row_limit_exceeded,
        'big_data_storage_limit_exceeded': big_data_storage_limit_exceeded,
        'disable_big_data_feature': disable_big_data_feature,
        'asset_quota_exceeded': not asset_quota_pass,
        'rows_exceeded': not rows_pass,
        'share_link_expire_days_default': settings.SHARE_LINK_EXPIRE_DAYS_DEFAULT,
        'share_link_expire_days_min': SHARE_LINK_EXPIRE_DAYS_MIN,
        'share_link_expire_days_max': SHARE_LINK_EXPIRE_DAYS_MAX,
        'enable_user_to_set_number_separator': ENABLE_USER_TO_SET_NUMBER_SEPARATOR,
        'is_belong_to_user_or_in_the_same_org': is_belong_to_user_or_in_the_same_org(username, workspace),
        'internal_plugins_config': INTERNAL_PLUGINS_CONFIG,
        'dtable_apps_config': enable_external_apps,
        'can_create_common_dataset': can_create_common_dataset,
        'seatable_faas_url': SEATABLE_FAAS_URL,
        'is_first_open': is_first_open,
        'help_link': HELP_LINK,
        'can_run_python_script': can_run_python_by_dtable(dtable),
        'is_script_running_configured': bool(SEATABLE_FAAS_URL and SEATABLE_FAAS_TOKEN),
        'advanced_plugins': ADVANCED_PLUGINS,
        'can_use_automation_rules': can_use_automation_rules_by_dtable(dtable),
        'enable_workflow': enable_workflow,
        'app_user_table_ids': ','.join(app_user_table_ids),
        'base_writable_limit': BASE_WRITABLE_LIMIT,
        'mobile_login': mobile_login,
        'custom_colors': CUSTOM_COLORS,
        'default_seafile_server': DEFAULT_SEAFILE_SERVER,
        'use_external_team_admin': USE_EXTERNAL_TEAM_ADMIN,
        'access_token': access_token,
        'enable_address_book_v2': ENABLE_ADDRESSBOOK_V2,
        'user_department_ids_map': user_department_ids_map,
        'is_encrypted': dtable.is_encrypted(),
        'enable_department_column_for_all': ENABLE_DEPARTMENT_COLUMN_FOR_ALL,
        'is_open_department_feature': is_user_open_department_feature(org_id),
        'enable_seadoc': ENABLE_SEADOC,
        'enabled_assistant_types': ENABLED_ASSISTANT_TYPES,
        'seadoc_server_url': SEADOC_SERVER_URL,
        'load_dtable_from_api_gateway': LOAD_DTABLE_FROM_API_GATEWAY,
        'enable_api_gateway_proxy_socket': ENABLE_API_GATEWAY_PROXY_SOCKET,
    }

    return render(request, 'dtable_file_view_react.html', return_dict)


@login_required
def dtable_user_view_share_file_view(request, user_view_share_id):
    view_share = DTableViewUserShare.objects.filter(id=user_view_share_id).first()
    if not view_share:
        error_msg = 'View share %s not found.' % user_view_share_id
        return render_error(request, error_msg)

    if request.user.username != view_share.to_user:
        return render_permission_error(request, _('Permission denied.'))

    permission = view_share.permission

    user_groups = get_user_groups(request.user.username)
    user_group_ids = set([g.id for g in user_groups])

    dtable = view_share.dtable
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    workspace_id = dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    if '@seafile_group' in workspace.owner:
        group_id = workspace.owner.split('@')[0]
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return render_error(request, error_msg)

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        return render_error(request, 'Library does not exist.')

    seafile_url = ''
    repo_api_token = ''
    try:
        seafile_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_type(dtable.uuid.hex, 'seafile').first()
        if seafile_account:
            detail = _decrypt_detail(json.loads(seafile_account.detail))
            seafile_url = detail.get('seafile_url', '')
            repo_api_token = detail.get('repo_api_token', '')
    except Exception as e:
        logger.error(e)

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    kwargs = {
        'id_in_org': id_in_org,
        'table_id': view_share.table_id,
        'view_id': view_share.view_id,
        'user_department_ids_map': user_department_ids_map
    }
    dtable_server_api = DTableServerAPI(request.user.username, str(dtable.uuid), dtable_server_url, permission=view_share.permission, kwargs=kwargs)
    access_token = dtable_server_api.view_access_token

    big_data_row_limit_exceeded = is_big_data_row_limit_exceeded(workspace.org_id)
    big_data_storage_limit_exceeded = is_big_data_storage_limit_exceeded(workspace.org_id)
    disable_big_data_feature = big_data_row_limit_exceeded or big_data_storage_limit_exceeded

    return_dict = {
        'id_in_org': id_in_org,
        'version': SEATABLE_VERSION,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_mine_map_custom_config': DTABLE_MINE_MAP_CUSTOM_CONFIG,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'seatable_market_url': SEATABLE_MARKET_URL,
        'filename': dtable.name,
        'user_group_ids': list(user_group_ids),
        'workspace_id': workspace_id,
        'dtable_uuid': str(dtable.uuid),
        'permission': permission if check_quota_and_row_limit_by_workspace(workspace) else 'r',
        'media_url': MEDIA_URL,
        'seafile_url': seafile_url,
        'repo_api_token': repo_api_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'dtable_enable_email_column': DTABLE_ENABLE_EMAIL_COLUMN,
        'is_admin': False,
        'big_data_row_limit_exceeded': big_data_row_limit_exceeded,
        'big_data_storage_limit_exceeded': big_data_storage_limit_exceeded,
        'disable_big_data_feature': disable_big_data_feature,
        'asset_quota_exceeded': not check_quota_by_workspace(workspace),
        'rows_exceeded': not check_row_limit_by_workspace(workspace),
        'share_link_expire_days_default': settings.SHARE_LINK_EXPIRE_DAYS_DEFAULT,
        'share_link_expire_days_min': SHARE_LINK_EXPIRE_DAYS_MIN,
        'share_link_expire_days_max': SHARE_LINK_EXPIRE_DAYS_MAX,
        'enable_user_to_set_number_separator': ENABLE_USER_TO_SET_NUMBER_SEPARATOR,
        'user_view_share_id': user_view_share_id,
        'can_run_python_script': can_run_python_by_dtable(dtable),
        'is_script_running_configured': bool(SEATABLE_FAAS_URL and SEATABLE_FAAS_TOKEN),
        'can_use_automation_rules': can_use_automation_rules_by_dtable(dtable),
        'base_writable_limit': BASE_WRITABLE_LIMIT,
        'default_seafile_server': DEFAULT_SEAFILE_SERVER,
        'access_token': access_token,
        'enable_address_book_v2': ENABLE_ADDRESSBOOK_V2,
        'user_department_ids_map': user_department_ids_map,
        'enable_department_column_for_all': ENABLE_DEPARTMENT_COLUMN_FOR_ALL,
        'is_open_department_feature': is_user_open_department_feature(workspace.org_id),
        'enable_seadoc': ENABLE_SEADOC,
        'enabled_assistant_types': ENABLED_ASSISTANT_TYPES,
        'seadoc_server_url': SEADOC_SERVER_URL,
        'load_dtable_from_api_gateway': LOAD_DTABLE_FROM_API_GATEWAY,
        'enable_api_gateway_proxy_socket': ENABLE_API_GATEWAY_PROXY_SOCKET,
    }

    return render(request, 'dtable_file_view_react.html', return_dict)


@login_required
def dtable_group_view_share_file_view(request, group_view_share_id):
    view_share = DTableViewGroupShare.objects.filter(id=group_view_share_id).first()
    if not view_share:
        error_msg = 'View share %s not found.' % group_view_share_id
        return render_error(request, error_msg)

    if not is_group_member(view_share.to_group_id, request.user.username):
        return render_permission_error(request, _('Permission denied.'))

    permission = view_share.permission

    user_groups = get_user_groups(request.user.username)
    user_group_ids = set([g.id for g in user_groups])

    dtable = view_share.dtable
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    workspace_id = dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    if '@seafile_group' in workspace.owner:
        group_id = workspace.owner.split('@')[0]
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return render_error(request, error_msg)

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        return render_error(request, 'Library does not exist.')

    seafile_url = ''
    repo_api_token = ''
    try:
        seafile_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_type(dtable.uuid.hex, 'seafile').first()
        if seafile_account:
            detail = _decrypt_detail(json.loads(seafile_account.detail))
            seafile_url = detail.get('seafile_url', '')
            repo_api_token = detail.get('repo_api_token', '')
    except Exception as e:
        logger.error(e)

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    kwargs = {
        'id_in_org': id_in_org,
        'table_id': view_share.table_id,
        'view_id': view_share.view_id,
        'user_department_ids_map': user_department_ids_map
    }
    dtable_server_api = DTableServerAPI(request.user.username, str(dtable.uuid), dtable_server_url, permission=view_share.permission, kwargs=kwargs)
    access_token = dtable_server_api.view_access_token

    big_data_row_limit_exceeded = is_big_data_row_limit_exceeded(workspace.org_id)
    big_data_storage_limit_exceeded = is_big_data_storage_limit_exceeded(workspace.org_id)
    disable_big_data_feature = big_data_row_limit_exceeded or big_data_storage_limit_exceeded

    return_dict = {
        'id_in_org': id_in_org,
        'version': SEATABLE_VERSION,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_mine_map_custom_config': DTABLE_MINE_MAP_CUSTOM_CONFIG,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'seatable_market_url': SEATABLE_MARKET_URL,
        'filename': dtable.name,
        'workspace_id': workspace_id,
        'dtable_uuid': str(dtable.uuid),
        'user_group_ids': list(user_group_ids),
        'permission': permission if check_quota_and_row_limit_by_workspace(workspace) else 'r',
        'media_url': MEDIA_URL,
        'seafile_url': seafile_url,
        'repo_api_token': repo_api_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'dtable_enable_email_column': DTABLE_ENABLE_EMAIL_COLUMN,
        'is_admin': False,
        'big_data_row_limit_exceeded': big_data_row_limit_exceeded,
        'big_data_storage_limit_exceeded': big_data_storage_limit_exceeded,
        'disable_big_data_feature': disable_big_data_feature,
        'asset_quota_exceeded': not check_quota_by_workspace(workspace),
        'rows_exceeded': not check_row_limit_by_workspace(workspace),
        'share_link_expire_days_default': settings.SHARE_LINK_EXPIRE_DAYS_DEFAULT,
        'share_link_expire_days_min': SHARE_LINK_EXPIRE_DAYS_MIN,
        'share_link_expire_days_max': SHARE_LINK_EXPIRE_DAYS_MAX,
        'enable_user_to_set_number_separator': ENABLE_USER_TO_SET_NUMBER_SEPARATOR,
        'group_view_share_id': group_view_share_id,
        'can_run_python_script': can_run_python_by_dtable(dtable),
        'is_script_running_configured': bool(SEATABLE_FAAS_URL and SEATABLE_FAAS_TOKEN),
        'can_use_automation_rules': can_use_automation_rules_by_dtable(dtable),
        'base_writable_limit': BASE_WRITABLE_LIMIT,
        'default_seafile_server': DEFAULT_SEAFILE_SERVER,
        'access_token': access_token,
        'enable_address_book_v2': ENABLE_ADDRESSBOOK_V2,
        'user_department_ids_map': user_department_ids_map,
        'enable_department_column_for_all': ENABLE_DEPARTMENT_COLUMN_FOR_ALL,
        'is_open_department_feature': is_user_open_department_feature(workspace.org_id),
        'enable_seadoc': ENABLE_SEADOC,
        'enabled_assistant_types': ENABLED_ASSISTANT_TYPES,
        'seadoc_server_url': SEADOC_SERVER_URL,
        'load_dtable_from_api_gateway': LOAD_DTABLE_FROM_API_GATEWAY,
        'enable_api_gateway_proxy_socket': ENABLE_API_GATEWAY_PROXY_SOCKET,
    }
    return render(request, 'dtable_file_view_react.html', return_dict)


@bind_cookie_user
@bind_token_user
def dtable_asset_access(request, workspace_id, dtable_uuid, path):
    """

    Permission:
    1. owner
    2. group member
    3. shared user with `rw` or `admin` permission
    """
    asset_name = os.path.basename(normalize_file_path(path))
    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    repo_id = workspace.repo_id

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    try:
        asset_path = normalize_file_path(os.path.join('/asset', dtable_uuid, path))
        asset_id = seafile_api.get_file_id_by_path(repo_id, asset_path)
    except Exception as e:
        if request.method == 'HEAD':
            return HttpResponse(status=404)
        raise Http404
    # use head method to check asset at 'path' whether exists
    if request.method == 'HEAD':
        if not asset_id:
            return HttpResponse(status=404)
        return HttpResponse(status=200)

    if not asset_id:
        return render_error(request, _('Asset file does not exist'))

    dl = request.GET.get('dl', '0') == '1'
    operation = 'download' if dl else 'view'

    asset_permission = can_access_asset(request, workspace, dtable, path, asset_id)
    can_access, need_cache = asset_permission[0], asset_permission[1]

    if not can_access:
        return render_permission_error(request, _('Permission denied.'))

    if need_cache:
        set_dtable_asset_cache_read_permission(request, dtable_uuid, asset_id)

    token = seafile_api.get_fileserver_access_token(
        repo_id, asset_id, operation, '', use_onetime=False
    )

    url = gen_file_get_url(token, asset_name)
    if operation == 'download':
        send_file_access_msg(request, dtable, asset_path, 'download')
    else:
        send_file_access_msg(request, dtable, asset_path, 'view')

    return HttpResponseRedirect(url)


@bind_cookie_user
@login_required
def dtable_asset_preview(request, workspace_id, dtable_uuid, path):

    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        return render_error(request, 'Library does not exist.')

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    asset_path = normalize_file_path(os.path.join('/asset', dtable_uuid, path))
    asset_id = seafile_api.get_file_id_by_path(repo_id, asset_path)
    if not asset_id:
        return render_error(request, _('Asset file does not exist'))

    asset_name = os.path.basename(normalize_file_path(path))

    # permission check
    can_access, need_cache, user_permission = can_access_asset(request, workspace, dtable, path, asset_id)

    if not can_access:
        return render_permission_error(request, _('Permission denied.'))

    if need_cache:
        set_dtable_asset_cache_read_permission(request, dtable_uuid, asset_id)

    file_enc = request.GET.get('file_enc', 'auto')
    if file_enc not in FILE_ENCODING_LIST:
        file_enc = 'auto'

    token = seafile_api.get_fileserver_access_token(
        repo_id, asset_id, 'view', '', use_onetime=False
    )

    file_name = os.path.basename(normalize_file_path(path))
    file_type, file_ext = get_file_type_and_ext(file_name)

    inner_path = gen_inner_file_get_url(token, file_name)
    error_msg, file_content, encoding = get_file_content(file_type, inner_path, file_enc)

    raw_path = gen_file_get_url(token, file_name)
    send_file_access_msg(request, dtable, asset_path, 'view')

    download_url = '%s/workspace/%s/asset/%s/%s?dl=1' % (DTABLE_WEB_SERVICE_URL.strip('/'), workspace_id, dtable_uuid, path)
    # if access workflow task asset, add some additional params to download link
    workflow_token = request.GET.get('workflow_token')
    task_id = request.GET.get('task_id')
    if workflow_token and task_id:
        download_url += '&workflow_token=%s&task_id=%s' % (workflow_token, task_id)

    can_download = has_dtable_asset_cache_download_permission(request, dtable_uuid) or False
    if not can_download:
        permission_dict, error_msg = check_dtable_operation_permission(request.user.username, workspace, dtable)
        if error_msg:
            return render_error(request, error_msg)
        can_download = permission_dict.get('can_download', True)
        if can_download:
            set_dtable_asset_cache_download_permission(request, dtable_uuid)

    return_dict = {
        'repo': repo,
        'filename': file_name,
        'file_path': asset_path,
        'file_type': file_type,
        'file_ext': file_ext,
        'raw_path': raw_path,
        'download_url': download_url,
        'file_content': file_content,
        'err': 'File preview unsupported' if file_type == 'Unknown' else error_msg,
        'has_office_convertor': settings.HAS_OFFICE_CONVERTER,
        'can_download': can_download
    }

    if ENABLE_SEADOC and file_type == SEADOC and path.startswith('custom'):
        # remove 'custom' in path
        path = path[6:]
        file_uuid = get_seadoc_file_uuid(dtable_uuid, path)

        return_dict['file_uuid'] = file_uuid
        return_dict['assets_url'] = '/api/v2.1/seadoc/download-image/' + file_uuid
        return_dict['seadoc_server_url'] = SEADOC_SERVER_URL
        return_dict['path'] = path
        return_dict['is_pro'] = IS_PRO_VERSION

        username = request.user.username
        dtable_permission = check_dtable_permission(username, workspace, dtable)
        view_permission = get_view_share_permision(username, dtable)
        can_edit = can_edit_document(dtable_uuid, dtable_permission, view_permission)

        if can_edit:
            permission = PERMISSION_READ_WRITE
        else:
            permission = PERMISSION_READ
        return_dict['file_perm'] = permission
        return_dict['can_edit_file'] = can_edit
        return_dict['seadoc_access_token'] = gen_seadoc_access_token(file_uuid, file_name, username,
                                                                     permission=permission)

        return render(request, 'sdoc_file_view_react.html', return_dict)

    if file_type in (DOCUMENT, SPREADSHEET):
        if IS_PRO_VERSION and ENABLE_COLLABORA and file_ext in COLLABORA_FILE_EXTENSION:
            username = request.user.username
            if not request.user.permissions.can_use_advanced_permissions():
                can_edit = False
            else:
                dtable_permission = check_dtable_permission(username, workspace, dtable)
                view_permission = get_view_share_permision(username, dtable)
                can_edit = can_edit_document(dtable_uuid, dtable_permission, view_permission)
                # custom permission
            action_name = 'edit' if can_edit else 'view'
            wopi_dict = get_wopi_dict(username, repo_id, asset_path, action_name, can_download, request.LANGUAGE_CODE)
            if wopi_dict:
                return render(request, 'view_file_collabora.html', wopi_dict)
            else:
                return_dict['err'] = _('Error when prepare Collabora Office file preview page.')

        if IS_PRO_VERSION and ENABLE_ONLYOFFICE and file_ext in ONLYOFFICE_FILE_EXTENSION:
            username = request.user.username
            if not request.user.permissions.can_use_advanced_permissions():
                can_edit = False
            else:
                dtable_permission = check_dtable_permission(username, workspace, dtable)
                view_permission = get_view_share_permision(username, dtable)
                can_edit = can_edit_document(dtable_uuid, dtable_permission, view_permission)
            onlyoffice_dict = get_onlyoffice_dict(request, username, repo_id, asset_path, asset_id, can_edit, can_download)
            if onlyoffice_dict:
                return render(request, 'view_file_onlyoffice.html', onlyoffice_dict)
            else:
                return_dict['err'] = _('Error when prepare OnlyOffice file preview page.')

        if settings.HAS_OFFICE_CONVERTER:
            template = 'dtable_asset_file_view_react.html'
            file_url = gen_file_get_url(token, asset_name)
            error_msg = prepare_converted_html(file_url, asset_id, file_ext, return_dict)
            if error_msg:
                return_dict['err'] = error_msg
                return render(request, template, return_dict)

    return render(request, 'dtable_asset_file_view_react.html', return_dict)


def dtable_form_view(request, token):

    # resource check
    form_obj = DTableForms.objects.get_form_by_token(token)
    if not form_obj:
        return render_error(request, 'Table\'s form does not exist.')

    workspace_id = form_obj.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    dtable_uuid = form_obj.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, 'DTable does not exist.')
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    # permission check
    if not check_form_submit_permission(request, form_obj):
        if request.user.username:
            return render(request, 'share_form_permission_error.html', {
            'error_msg': _('You may not have permission to fill out this form'),
        })
        return render(request, 'share_form_permission_error.html', {
            'og_title': json.loads(form_obj.form_config).get('form_name'),
            'og_image': MEDIA_URL + 'img/og-seatable-form.png',
            'og_description': _('Form from SeaTable'),
            'error_msg': _('This form requires login'),
            'log_in': _('Log In'),
            'url': request.path
        })

    # deadline check
    if is_form_expired(form_obj):
        return render_error_form(request)

    # asset quota check
    if not check_quota_by_workspace(workspace):
        return render_error(request, _('Asset quota exceeded.'))
    # rows check
    if not check_row_limit_by_workspace(workspace):
        return render_error(request, _('Rows exceeded.'))

    dtable_server_url = get_inner_dtable_server_url()
    dtable_server_api = DTableServerAPI('form', str(dtable.uuid), dtable_server_url, permission=PERMISSION_READ)
    dtable_metadata = dtable_server_api.get_metadata()

    config_dict = json.loads(form_obj.form_config)
    tables = dtable_metadata['tables']
    form_table_id = config_dict.get('table_id', '')
    table = {}
    for tab in tables:
        if tab['_id'] == form_table_id:
            table = tab
            break
    if not table:
        return render_error(request, _('Form is not properly configured.'))

    form_column_keys = [col['key'] for col in config_dict.get('columns', [])]
    columns = table['columns']
    other_table_view_id_set = set()
    for column in columns:
        if column['type'] == 'link' and column['key'] in form_column_keys:
            column_data = column['data'] or dict()
            other_table_id = column_data['other_table_id'] if column_data['table_id'] == form_table_id else column_data['table_id']
            other_view_id = column_data.get('other_view_id', '') if column_data.get('is_row_from_view', '') else ''
            other_table_view_id_set.add('-'.join([other_table_id, other_view_id]))

    # 'username': request.user.username if request.user.is_authenticated else 'anonymous'

    if request.user.is_authenticated:
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
        user = {
            'name': request.user.name,
            'id': id_in_org,
        }
    else:
        user = {
            'name': '',
            'id': '',
        }

    return_dict = {
        'og_title': json.loads(form_obj.form_config).get('form_name'),
        'og_image': MEDIA_URL + 'img/og-seatable-form.png',
        'og_description': _('Form from SeaTable'),
        'version': SEATABLE_VERSION,
        'dtable_metadata': json.dumps({'metadata': dtable_metadata}),
        'workspace_id': workspace_id,
        'form_config': form_obj.form_config,
        'dtable_name': dtable.name,
        'dtable_uuid': str(dtable.uuid),
        'dtable_web_service_url': DTABLE_WEB_SERVICE_URL,
        'form_token': token,
        'user': json.dumps(user),
        'custom_powered_by': CUSTOM_POWERED_BY if IS_PRO_VERSION else '',
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
    }

    return render(request, 'dtable_share_form_view_react.html', return_dict)

def dtable_form_custom_view(request, custom_url):

    # resource check
    dtable_form_url = DTableFormCustomURLs.objects.filter(custom_url = custom_url).first()
    if not dtable_form_url:
        return render_error(request, 'Page not found.')

    token = dtable_form_url.form_token
    form_obj = DTableForms.objects.get_form_by_token(token)
    if not form_obj:
        return render_error(request, 'Table\'s form does not exist.')

    workspace_id = form_obj.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    dtable_uuid = form_obj.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, 'DTable does not exist.')
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    # permission check
    if not check_form_submit_permission(request, form_obj):
        if request.user.username:
            return render(request, 'share_form_permission_error.html', {
            'error_msg': _('You may not have permission to fill out this form'),
        })
        return render(request, 'share_form_permission_error.html', {
            'og_title': json.loads(form_obj.form_config).get('form_name'),
            'og_image': MEDIA_URL + 'img/og-seatable-form.png',
            'og_description': _('Form from SeaTable'),
            'error_msg': _('This form requires login'),
            'log_in': _('Log In'),
            'url': request.path
        })

    # deadline check
    if is_form_expired(form_obj):
        return render_error_form(request)

    # asset quota check
    if not check_quota_by_workspace(workspace):
        return render_error(request, _('Asset quota exceeded.'))
    # rows check
    if not check_row_limit_by_workspace(workspace):
        return render_error(request, _('Rows exceeded.'))

    dtable_server_url = get_inner_dtable_server_url()
    dtable_server_api = DTableServerAPI('form', str(dtable.uuid), dtable_server_url, permission=PERMISSION_READ)
    dtable_metadata = dtable_server_api.get_metadata()

    config_dict = json.loads(form_obj.form_config)
    tables = dtable_metadata['tables']
    form_table_id = config_dict.get('table_id', '')
    table = {}
    for tab in tables:
        if tab['_id'] == form_table_id:
            table = tab
            break
    if not table:
        return render_error(request, _('Form is not properly configured.'))

    form_column_keys = [col['key'] for col in config_dict.get('columns', [])]
    columns = table['columns']
    other_table_view_id_set = set()
    for column in columns:
        if column['type'] == 'link' and column['key'] in form_column_keys:
            column_data = column['data'] or dict()
            other_table_id = column_data['other_table_id'] if column_data['table_id'] == form_table_id else column_data['table_id']
            other_view_id = column_data.get('other_view_id', '') if column_data.get('is_row_from_view', '') else ''
            other_table_view_id_set.add('-'.join([other_table_id, other_view_id]))

    # 'username': request.user.username if request.user.is_authenticated else 'anonymous'

    if request.user.is_authenticated:
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
        user = {
            'name': request.user.name,
            'id': id_in_org,
        }
    else:
        user = {
            'name': '',
            'id': '',
        }

    return_dict = {
        'og_title': json.loads(form_obj.form_config).get('form_name'),
        'og_image': MEDIA_URL + 'img/og-seatable-form.png',
        'og_description': _('Form from SeaTable'),
        'version': SEATABLE_VERSION,
        'dtable_metadata': json.dumps({'metadata': dtable_metadata}),
        'workspace_id': workspace_id,
        'form_config': form_obj.form_config,
        'dtable_name': dtable.name,
        'dtable_uuid': str(dtable.uuid),
        'dtable_web_service_url': DTABLE_WEB_SERVICE_URL,
        'form_token': token,
        'user': json.dumps(user),
        'custom_powered_by': CUSTOM_POWERED_BY if IS_PRO_VERSION else '',
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
    }

    return render(request, 'dtable_share_form_view_react.html', return_dict)

def dtable_embed_view(request, token):
    """
    the token is currently using external link's token, but not increase view_cnt
    """

    dtable_external_link = DTableExternalLinks.objects.filter(token=token).first()
    if not dtable_external_link:
        raise Http404
    if dtable_external_link.is_expired():
        return render_error(request, _('Share link has expired'))

    password_check, err_msg = check_external_link(request, dtable_external_link)
    if not password_check:
        return render(request, 'external_link_access_validation.html', {
            'token': token,
            'err_msg': err_msg,
            'view_name': 'dtable:dtable_external_link_custom_view' if dtable_external_link.is_custom else 'dtable:dtable_external_link_view'
        })

    # resource check
    workspace_id = dtable_external_link.dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        raise Http404

    name = dtable_external_link.dtable.name
    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    return_dict = {
        'version': SEATABLE_VERSION,
        'external_link_token': token,
    }
    return render(request, 'dtable_embed.html', return_dict)

def dtable_view_embed_view(request, token):

    dtable_view_external_link = DTableViewExternalLinks.objects.filter(token=token).first()
    if not dtable_view_external_link:
        raise Http404
    if dtable_view_external_link.is_expired():
        return render_error(request, _('Share link has expired'))

    password_check, err_msg = check_external_link(request, dtable_view_external_link)
    if not password_check:
        return render(request, 'external_link_access_validation.html', {
            'token': token,
            'err_msg': err_msg,
            'view_name': 'dtable:dtable_view_external_link_custom_view' if dtable_view_external_link.is_custom else 'dtable:dtable_view_external_link_view'
        })

    # resource check
    workspace_id = dtable_view_external_link.dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        raise Http404

    name = dtable_view_external_link.dtable.name
    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    return_dict = {
        'version': SEATABLE_VERSION,
        'view_external_link_token': token,
    }
    return render(request, 'dtable_embed.html', return_dict)

@login_required
def dtable_form_edit(request, token):
    """
    Permission:
    1. owner
    2. group member
    3. shared user with `rw` permission
    """

    # resource check
    form_obj = DTableForms.objects.get_form_by_token(token)
    if not form_obj:
        return render_error(request, 'Table\'s form does not exist.')

    workspace_id = form_obj.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    dtable_uuid = form_obj.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, 'Table does not exist.')
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    # permission check
    username = request.user.username
    permission = check_dtable_permission(username, workspace, dtable)
    if permission != PERMISSION_READ_WRITE:
        return render_permission_error(request, 'Permission denied.')

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
    user = {
        'name': request.user.name,
        'id': id_in_org,
    }

    # quota and rows check
    if not check_quota_by_workspace(workspace):
        return render_error(request, 'Asset quota exceeded.')
    if not check_row_limit_by_workspace(workspace):
        return render_error(request, _('Rows exceeded.'))

    dtable_server_url = get_inner_dtable_server_url()
    dtable_server_api = DTableServerAPI('form', str(dtable.uuid), dtable_server_url, permission=permission)
    dtable_metadata = dtable_server_api.get_metadata()

    share_type = form_obj.share_type
    shared_groups = list()
    if share_type == SHARED_GROUPS:
        group_ids = DTableFormShare.objects.list_by_form(form_obj)
        shared_groups = [{'id': group_id, 'name': group_id_to_name(group_id)} for group_id in group_ids]

    form_config = json.loads(form_obj.form_config)
    form_table_id = form_config.get('table_id')
    trigger_workflow_option = form_config.get('trigger_workflow_option', {})
    trigger_workflow_option['can_trigger_workflow'] = False
    if settings.ENABLE_WORKFLOW:
        workflows = list(DTableWorkflows.objects.get_workflows_by_dtable_uuid(dtable_uuid))
        for workflow in workflows:
            workflow_table_id = get_table_id_from_config(workflow.workflow_config)
            if form_table_id and workflow_table_id and form_table_id == workflow_table_id:
                trigger_workflow_option['workflow_name'] = json.loads(workflow.workflow_config).get('workflow_name')
                if trigger_workflow_option.get('workflow_token') != workflow.token:
                    trigger_workflow_option['is_trigger_workflow'] = False
                trigger_workflow_option['workflow_token'] = workflow.token
                trigger_workflow_option['can_trigger_workflow'] = True
                break
    form_config['trigger_workflow_option'] = trigger_workflow_option

    return_dict = {
        'dtable_metadata': json.dumps({'metadata': dtable_metadata}),
        'dtable_name': dtable.name,
        'workspace_id': workspace_id,
        'form_config': json.dumps(form_config),
        'dtable_uuid': str(dtable.uuid),
        'dtable_web_service_url': DTABLE_WEB_SERVICE_URL,
        'form_token': token,
        'share_type': share_type,
        'shared_groups': json.dumps(shared_groups),
        'user': json.dumps(user),
        'user_permission': request.user.permissions,
        'custom_powered_by': CUSTOM_POWERED_BY if IS_PRO_VERSION else ''
    }

    return render(request, 'dtable_edit_form_view_react.html', return_dict)


def dtable_collection_table_view(request, token):
    """
    Permission:
    1. owner
    2. group member
    3. shared user
    """
    # resource check
    collection_table = DTableCollectionTables.objects.get_collection_table_by_token(token)
    if not collection_table:
        return render_error(request, _('Collection table does not exist.'))

    workspace_id = collection_table.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    dtable_uuid = collection_table.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('Base does not exist.'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    group_id = ''
    if '@seafile_group' in workspace.owner:
        group_id = workspace.owner.split('@')[0]
        group = seaserv.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return render_error(request, error_msg)

    # deadline check
    if is_collection_table_expired(collection_table):
        return redner_error_collection(request)

    # permission check
    if not request.user.is_authenticated:
        return render(request, 'dtable_collection_table_login.html', {
            'og_title': dtable.name,
            'og_image': MEDIA_URL + 'img/og-seatable-base.png',
            'og_description': _('Collection table from SeaTable'),
            'url': request.path,
        })

    username = request.user.username
    user_groups = get_user_groups(username)
    user_group_ids = set([g.id for g in user_groups])
    if group_id:
        is_admin = is_group_admin_or_owner(group_id, username)
    else:
        # open your own dtable
        is_admin = username == workspace.owner

    seafile_url = ''
    repo_api_token = ''
    try:
        seafile_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_type(dtable.uuid.hex, 'seafile').first()
        if seafile_account:
            detail = _decrypt_detail(json.loads(seafile_account.detail))
            seafile_url = detail.get('seafile_url', '')
            repo_api_token = detail.get('repo_api_token', '')
    except Exception as e:
        logger.error(e)

    asset_quota_pass = check_quota_by_workspace(workspace)
    rows_pass = check_row_limit_by_workspace(workspace)
    quota_row_limit_pass = asset_quota_pass and rows_pass

    # can_create_common_dataset, generally permission of role
    # but in org, need permission and ENABLE_ORG_COMMON_DATASET in settings
    can_create_common_dataset = request.user.permissions.can_create_common_dataset()
    org_id = workspace.org_id
    if org_id != -1:
        can_create_common_dataset = can_create_common_dataset and settings.ENABLE_ORG_COMMON_DATASET

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)

    request.session['collection_table'] = {'dtable_uuid': dtable_uuid}
    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    try:
        collection_table.view_count += 1
        collection_table.save()
    except Exception as e:
        logger.error(e)

    enable_external_apps = list()
    for app in DTABLE_APPS_CONFIG:
        if app.get('app_type', '') in ENABLED_EXTERNAL_APPS:
            enable_external_apps.append(app)

    kwargs = {
        'id_in_org': id_in_org,
        'user_department_ids_map': user_department_ids_map,
        'token': token
    }
    dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url, permission=PERMISSION_COLLECTION_TABLE, kwargs=kwargs)
    access_token = dtable_server_api.view_access_token

    return_dict = {
        'id_in_org': id_in_org,
        'version': SEATABLE_VERSION,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_mine_map_custom_config': DTABLE_MINE_MAP_CUSTOM_CONFIG,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'seatable_market_url': SEATABLE_MARKET_URL,
        'filename': dtable.name,
        'workspace_id': workspace_id,
        'dtable_uuid': str(dtable.uuid),
        'is_owned_by_group': dtable.is_owned_by_group,
        'user_group_ids': list(user_group_ids),
        'permission': PERMISSION_COLLECTION_TABLE if quota_row_limit_pass else 'r',
        'media_url': MEDIA_URL,
        'seafile_url': seafile_url,
        'repo_api_token': repo_api_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'dtable_enable_email_column': DTABLE_ENABLE_EMAIL_COLUMN,
        'is_admin': is_admin,
        'enable_weixin': weixin_check(),
        'asset_quota_exceeded': not asset_quota_pass,
        'rows_exceeded': not rows_pass,
        'share_link_expire_days_default': settings.SHARE_LINK_EXPIRE_DAYS_DEFAULT,
        'share_link_expire_days_min': SHARE_LINK_EXPIRE_DAYS_MIN,
        'share_link_expire_days_max': SHARE_LINK_EXPIRE_DAYS_MAX,
        'enable_user_to_set_number_separator': ENABLE_USER_TO_SET_NUMBER_SEPARATOR,
        'is_belong_to_user_or_in_the_same_org': is_belong_to_user_or_in_the_same_org(username, workspace),
        'internal_plugins_config': INTERNAL_PLUGINS_CONFIG,
        'dtable_apps_config': enable_external_apps,
        'can_create_common_dataset': can_create_common_dataset,
        'seatable_faas_url': SEATABLE_FAAS_URL,
        'token': token,
        'help_link': HELP_LINK,
        'dtable_color': dtable.color,
        'can_run_python_script': can_run_python_by_dtable(dtable),
        'is_script_running_configured': bool(SEATABLE_FAAS_URL and SEATABLE_FAAS_TOKEN),
        'base_writable_limit': BASE_WRITABLE_LIMIT,
        'access_token': access_token,
        'enable_address_book_v2': ENABLE_ADDRESSBOOK_V2,
        'user_department_ids_map': user_department_ids_map,
        'enable_department_column_for_all': ENABLE_DEPARTMENT_COLUMN_FOR_ALL,
        'is_open_department_feature': is_user_open_department_feature(org_id),
        'load_dtable_from_api_gateway': LOAD_DTABLE_FROM_API_GATEWAY,
        'enable_api_gateway_proxy_socket': ENABLE_API_GATEWAY_PROXY_SOCKET,
    }

    return render(request, 'dtable_collection_table_react.html', return_dict)


@login_required
def dtable_collection_table_edit(request, token):
    """
    Permission:
    1. owner
    2. group member
    3. shared user with `rw` permission
    """
    # resource check
    collection_table = DTableCollectionTables.objects.get_collection_table_by_token(token)
    if not collection_table:
        return render_error(request, _('Collection table does not exist.'))

    workspace_id = collection_table.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    dtable_uuid = collection_table.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('Base does not exist.'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    # permission check
    username = request.user.username
    permission = check_dtable_permission(username, workspace, dtable)
    if permission != PERMISSION_READ_WRITE:
        return render_permission_error(request, 'Permission denied.')


    # quota and rows check
    if not check_quota_by_workspace(workspace):
        return render_error(request, 'Asset quota exceeded.')
    if not check_row_limit_by_workspace(workspace):
        return render_error(request, _('Rows exceeded.'))

    dtable_server_url = get_inner_dtable_server_url()
    dtable_server_api = DTableServerAPI('collection_table', str(dtable.uuid), dtable_server_url, permission=permission)
    dtable_metadata = dtable_server_api.get_metadata()

    return_dict = {
        'dtable_metadata': json.dumps({'metadata': dtable_metadata}),
        'dtable_name': dtable.name,
        'workspace_id': workspace_id,
        'config': collection_table.config,
        'dtable_uuid': str(dtable.uuid),
        'dtable_web_service_url': DTABLE_WEB_SERVICE_URL,
        'token': token,
    }

    return render(request, 'dtable_edit_collection_table_react.html', return_dict)


@login_required
def dtable_row_share_link_view(request, token):

    # resource check
    dtable_row_share = DTableRowShares.objects.get_dtable_row_share_by_token(token)
    if not dtable_row_share:
        return render_error(request, 'DTable row share link does not exist.')

    workspace_id = dtable_row_share.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        return render_error(request, 'Library does not exist.')

    dtable_uuid = dtable_row_share.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, 'Base %s does not exist' % dtable_uuid)
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    # generate json web token
    username = request.user.username
    dtable_server_url = get_inner_dtable_server_url()
    dtable_server_api = DTableServerAPI(username, str(dtable.uud), dtable_server_url, permission=PERMISSION_READ)
    dtable_metadata = dtable_server_api.get_metadata()
    table = next(filter(lambda table: table['_id'] == dtable_row_share.table_id, dtable_metadata['tables']), None)
    if not table:
        raise Http404
    try:
        row = dtable_server_api.get_row(table['name'], dtable_row_share.row_id)
    except ConnectionError as e:
        if e.args[0] == 404:
            raise Http404
    columns = table['columns']

    return_dict = {
        'row_content': row,
        'columns': columns,
        'workspace_id': workspace_id,
        'dtable_name': dtable.name
    }

    return render(request, 'dtable_shared_row_view_react.html', return_dict)


def dtable_share_link_view(request, token):
    dsl = DTableShareLinks.objects.filter(token=token).first()
    if not dsl:
        return render_error(request, _('The invite link does not exist'))
    if dsl.is_expired():
        return render_error(request, _('The invite link has expired'))

    shared_user = email2nickname(dsl.username)
    login_bg_image_path = get_login_bg_image_path()

    if isinstance(request.user, AnonymousUser):
        return render(request, 'dtable_share_react.html', {
            'shared_user': shared_user,
            'table_name': dsl.dtable.name,
            'next': '/dtable/links/%s' % dsl.token,
            'login_bg_image_path': login_bg_image_path,
            'powered_by_link': POWERED_BY_LINK,
            'use_phone_registration_by_default': USE_PHONE_REGISTRATION_BY_DEFAULT,
        })

    password_check, err_msg = check_share_link_common(request, dsl)
    if not password_check:
        d = {'token': token, 'view_name': 'dtable:dtable_share_link_view', 'err_msg': err_msg}
        return render(request, 'share_access_validation.html', d)

    # resource check
    workspace_id = dsl.dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        raise Http404

    # org share check
    org_id = workspace.org_id
    if org_id != -1 and not OrgAdminSettings.objects.can_external_user_access_invite_link_by_org_id(org_id):
        if not is_org_context(request):
            return render_permission_error(request, _('The team admin has disabled sharing bases to external users outside the team.'))
        if request.user.org.org_id != org_id:
            return render_permission_error(request, _('The team admin has disabled sharing bases to external users outside the team.'))

    name = dsl.dtable.name
    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    current_username = request.user.username
    try:
        obj = DTableShare.objects.get_by_dtable_and_to_user(dtable, current_username)
        if not obj:
            share_count = DTableShare.objects.get_count_by_dtable(dtable)
            if share_count >= DTABLE_SHARE_QUOTA:
                return render_error(request, _('Base cannot be shared to more than %s users.') % (DTABLE_SHARE_QUOTA))

            DTableShare.objects.add(dtable, dsl.username, current_username, dsl.permission)
            share_dtable_to_user.send(sender=None,
                                        table_id=dtable.id,
                                        share_user=dsl.username,
                                        to_user=current_username)
            clean_related_users_cache(dtable.uuid.hex)
            send_signal_to_dtable_server('dtable-share-changed', dtable)
    except Exception as e:
        logger.error('take user: %s to table: %s table-token: %s share-list error: %s',
                     current_username, dsl.dtable_id, token, e)
        return render_error(request, _('Internal Server Error'))

    return HttpResponseRedirect(reverse('dtable:dtable_file_view', args=(workspace_id, name)))

@login_required
def dtable_snapshot_view(request, workspace_id, name, commit_id):
    """

    Permission:
    1. owner
    2. group member
    3. shared user
    """
    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    password_check, err_msg = check_base_access(request, dtable)
    if not password_check:
        return render(request, 'base_snapshot_access_validation.html', {
            'workspace_id': workspace_id,
            'name': name,
            'commit_id': commit_id,
            'err_msg': err_msg,
            'view_name': 'dtable:dtable_snapshot_view'
        })

    # permission check
    username = request.user.username
    permission = check_dtable_permission(username, workspace, dtable)
    if not permission:
        return render_permission_error(request, _('Permission denied.'))

    snapshot_days = get_snapshot_days_by_workspace(workspace)
    snapshot = storage_backend.get_snapshot(dtable, commit_id, snapshot_days, username)
    if not snapshot:
        return render_error(request, 'Snapshot does not exist.')

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL
    kwargs = {
        'id_in_org': id_in_org
    }
    dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url, permission=PERMISSION_READ, kwargs=kwargs)
    access_token = dtable_server_api.view_access_token

    return render(request, 'dtable_snapshot_view_react.html', {
        'id_in_org': id_in_org,
        'version': SEATABLE_VERSION,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_mine_map_custom_config': DTABLE_MINE_MAP_CUSTOM_CONFIG,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'seatable_market_url': SEATABLE_MARKET_URL,
        'file_name': dtable.name,
        'workspace_id': workspace.id,
        'dtable_uuid': str(dtable.uuid),
        'media_url': MEDIA_URL,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'permission': 'r',
        'snapshot_commit_id': commit_id,
        'access_token': access_token,
    })


@cache_control(max_age=settings.BROWSER_CACHE_MAX_AGE, public=True)
@conditional_browser_cache
def dtable_plugin_asset_view(request, plugin_name):

    path = request.GET.get('path', '').strip('/')
    if not path:
        error_msg = 'path invalid'
        return render_error(request, error_msg)

    try:
        plugin_record = DTableSystemPlugins.objects.get(name=plugin_name)
    except DTableSystemPlugins.DoesNotExist:
        error_msg = 'Plugin %s not found.' % plugin_name
        return render_error(request, error_msg)

    repo = seafile_api.get_repo(settings.PLUGINS_REPO_ID)
    if not repo:
        error_msg = 'Plugin library %s not found.' % settings.PLUGINS_REPO_ID
        return render_error(request, error_msg)

    asset_path = os.path.join('/', plugin_record.name, path)
    plugin_file_dir_id = seafile_api.get_file_id_by_path(settings.PLUGINS_REPO_ID, asset_path)
    if not plugin_file_dir_id:
        return render_error(request, _('Asset file does not exist'))

    token = seafile_api.get_fileserver_access_token(
        settings.PLUGINS_REPO_ID, plugin_file_dir_id, 'view', '', use_onetime=False
    )

    url = gen_inner_file_get_url(token, asset_path)
    r = requests.get(url)
    response = HttpResponse(r.content)

    content_type = mimetypes.guess_type(path)
    if type:
        response['Content-Type'] = content_type[0]

    return response


def dtable_external_link_view(request, token):
    dtable_external_link = DTableExternalLinks.objects.filter(token=token).first()
    if not dtable_external_link:
        raise Http404
    if dtable_external_link.is_expired():
        return render_error(request, _('Share link has expired'))

    password_check, err_msg = check_external_link(request, dtable_external_link)
    if not password_check:
        return render(request, 'external_link_access_validation.html', {
            'token': token,
            'err_msg': err_msg,
            'view_name': 'dtable:dtable_external_link_custom_view' if dtable_external_link.is_custom else 'dtable:dtable_external_link_view'
        })

    # resource check
    workspace_id = dtable_external_link.dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        raise Http404

    name = dtable_external_link.dtable.name
    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    try:
        DTableExternalLinks.objects.filter(token=token).update(view_cnt=F('view_cnt')+1)
    except Exception as e:
        logger.error('update external link view_cnt error: %s', e)

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

    request.session['external_link'] = {'token': token, 'dtable_uuid': dtable.uuid.hex}
    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    enable_external_apps = list()
    for app in DTABLE_APPS_CONFIG:
        if app.get('app_type', '') in ENABLED_EXTERNAL_APPS:
            enable_external_apps.append(app)

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)

    kwargs = {
        'id_in_org': id_in_org,
        'user_department_ids_map': user_department_ids_map
    }
    dtable_server_api = DTableServerAPI(None, str(dtable.uuid), dtable_server_url, permission=PERMISSION_READ, kwargs=kwargs)
    access_token = dtable_server_api.view_access_token

    return render(request, 'dtable_external_link_view_react.html', {
        'id_in_org': id_in_org,
        'version': SEATABLE_VERSION,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_mine_map_custom_config': DTABLE_MINE_MAP_CUSTOM_CONFIG,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'media_url': MEDIA_URL,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'workspace_id': workspace.id,
        'file_name': dtable.name,
        'dtable_uuid': str(dtable.uuid),
        'dtable_color': dtable.color,
        'help_link': HELP_LINK,
        'permission': 'r',
        'external_link_token': token,
        'internal_plugins_config': INTERNAL_PLUGINS_CONFIG,
        'dtable_apps_config': enable_external_apps,
        'seatable_faas_url': SEATABLE_FAAS_URL,
        'enable_abuse_report': ENABLE_ABUSE_REPORT,
        'external_link_support_download_type': EXTERNAL_LINK_SUPPORT_DOWNLOAD_TYPE,
        'external_link_support_download_size': EXTERNAL_LINK_SUPPORT_DOWNLOAD_SIZE,
        'access_token': access_token,
        'enable_address_book_v2': ENABLE_ADDRESSBOOK_V2,
        'user_department_ids_map': user_department_ids_map,
        'enable_department_column_for_all': ENABLE_DEPARTMENT_COLUMN_FOR_ALL,
        'is_open_department_feature': is_user_open_department_feature(workspace.org_id),
        'enable_seadoc': ENABLE_SEADOC,
        'seadoc_server_url': SEADOC_SERVER_URL,
        'load_dtable_from_api_gateway': LOAD_DTABLE_FROM_API_GATEWAY,
        'enable_api_gateway_proxy_socket': ENABLE_API_GATEWAY_PROXY_SOCKET,
    })

def dtable_view_external_link_view(request, token):
    dtable_view_external_link = DTableViewExternalLinks.objects.filter(token=token).first()
    if not dtable_view_external_link:
        raise Http404
    if dtable_view_external_link.is_expired():
        return render_error(request, _('Share link has expired'))

    password_check, err_msg = check_external_link(request, dtable_view_external_link)
    if not password_check:
        context = {
            'token': token,
            'err_msg': err_msg,
            'view_name': 'dtable:dtable_view_external_link_custom_view' if dtable_view_external_link.is_custom else 'dtable:dtable_view_external_link_view'
        }
        return render(request, 'external_link_access_validation.html', context)

    # resource check
    workspace_id = dtable_view_external_link.dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        raise Http404

    name = dtable_view_external_link.dtable.name
    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        return render_error(request, _('DTable does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    try:
        DTableViewExternalLinks.objects.filter(token=token).update(view_cnt=F('view_cnt')+1)
    except Exception as e:
        logger.error('update external link view_cnt error: %s', e)

    request.session['external_link'] = {'token': token, 'dtable_uuid': dtable.uuid.hex}
    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    enable_external_apps = list()
    for app in DTABLE_APPS_CONFIG:
        if app.get('app_type', '') in ENABLED_EXTERNAL_APPS:
            enable_external_apps.append(app)

    kwargs = {
        'table_id': dtable_view_external_link.table_id,
        'view_id': dtable_view_external_link.view_id
    }
    dtable_server_api = DTableServerAPI(None, str(dtable.uuid), dtable_server_url, permission='view-external-link', kwargs=kwargs)
    access_token = dtable_server_api.view_access_token

    return render(request, 'dtable_external_link_view_react.html', {
        'version': SEATABLE_VERSION,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_mine_map_custom_config': DTABLE_MINE_MAP_CUSTOM_CONFIG,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'media_url': MEDIA_URL,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'workspace_id': workspace.id,
        'file_name': dtable.name,
        'dtable_uuid': str(dtable.uuid),
        'dtable_color': dtable.color,
        'help_link': HELP_LINK,
        'permission': 'r',
        'view_external_link_token': token,
        'internal_plugins_config': INTERNAL_PLUGINS_CONFIG,
        'dtable_apps_config': enable_external_apps,
        'external_link_support_download_type': EXTERNAL_LINK_SUPPORT_DOWNLOAD_TYPE,
        'external_link_support_download_size': EXTERNAL_LINK_SUPPORT_DOWNLOAD_SIZE,
        'access_token': access_token,
        'enable_address_book_v2': ENABLE_ADDRESSBOOK_V2,
        'enable_department_column_for_all': ENABLE_DEPARTMENT_COLUMN_FOR_ALL,
        'is_open_department_feature': is_user_open_department_feature(workspace.org_id),
        'enable_seadoc': ENABLE_SEADOC,
        'seadoc_server_url': SEADOC_SERVER_URL,
        'load_dtable_from_api_gateway': LOAD_DTABLE_FROM_API_GATEWAY,
        'enable_api_gateway_proxy_socket': ENABLE_API_GATEWAY_PROXY_SOCKET,
    })

def dtable_external_download_link_view(request, token):

    dtable_external_link = DTableExternalLinks.objects.filter(token=token).first()
    if not dtable_external_link:
        raise Http404

    # resource check
    workspace_id = dtable_external_link.dtable.workspace.id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        raise Http404

    name = dtable_external_link.dtable.name
    dtable = DTables.objects.get_dtable(workspace, name)
    if not dtable:
        error_msg = _('This base does not exist')
        return HttpResponse(error_msg, status=404)
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        error_msg = 'Library %s not found.' % repo_id
        return HttpResponse(error_msg, status=404)

    dtable_asset_path = '/asset/' + str(dtable.uuid)
    dtable_export_max_size = getattr(config, 'DTABLE_EXPORT_MAX_SIZE', DTABLE_EXPORT_MAX_SIZE)
    try:
        file_info = seafile_api.get_file_count_info_by_path(repo_id, dtable_asset_path)
        if dtable_export_max_size < (file_info.size >> 20):
            error_msg = _('Export failed. Base size is larger than %s mb.') % dtable_export_max_size
            return HttpResponse(error_msg, status=413)
    except Exception:
        pass

    params = {}
    params['username'] = 'anonymous_user'
    params['table_name'] = name
    params['repo_id'] = repo_id
    params['workspace_id'] = dtable.workspace_id
    params['dtable_uuid'] = str(dtable.uuid)

    try:
        task_id = add_dtable_io_task(type='export', params=params)
    except Exception as e:
        error_msg = 'Server is busy. Please try again later.'
        return HttpResponse(error_msg, status=500)

    finished = False
    while not finished:
        resp = query_dtable_io_status(task_id)

        resp_json = resp.json()
        error_msg = resp_json.get('error_msg')

        if resp.status_code == 500 and error_msg == 'the number of cells accessing the table exceeds the limit':
            return HttpResponse(error_msg, status=413)
        if not resp.ok:
            logger.error(resp.content)
            error_msg = _('Internal Server Error')
            return HttpResponse(error_msg, status=500)

        finished = resp_json['is_finished']
        time.sleep(1)

    tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'zip_file') + '.zip'
    if not os.path.exists(tmp_zip_path):
        error_msg = _('Internal Server Error')
        return HttpResponse(error_msg, status=500)

    with open(tmp_zip_path, 'rb') as f:
        zip_stream = f.read()
    os.remove(tmp_zip_path)

    response = HttpResponse(zip_stream, content_type="application/x-zip-compressed")
    response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(dtable.dtable_name) + '.dtable'
    return response


def dtable_export_content_view(request):
    """
    Get the download content after the dtable exportation task is finished.
    operated by:
    1. customer_user: export their own dtables
    2. org-admin: export the dtables in the org's workspace.
    """
    task_id = request.GET.get('task_id', '')
    if not task_id:
        error_msg = 'task_id invalid.'
        return render_error(request, error_msg)

    dtable_uuid = request.GET.get('dtable_uuid', '')
    if not dtable_uuid:
        error_msg = 'dtable_uuid invalid.'
        return render_error(request, error_msg)

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        error_msg = 'Base not found.'
        return render_error(request, error_msg)
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        error_msg = 'Workspace not found.'
        return render_error(request, error_msg)

    org_id = request.user.org.org_id if request.user.org else None
    is_org_staff = request.user.org.is_staff if request.user.org else False
    # permission check
    permission = False
    if is_org_staff:
        if dtable.workspace.org_id == org_id:
            permission = True
    else:
        permission = check_dtable_permission(request.user.username, workspace, dtable)
    if not permission:
        error_msg = 'Permission denied.'
        return render_error(request, error_msg)

    tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'zip_file') + '.zip'
    if not os.path.exists(tmp_zip_path):
        error_msg = 'Internal Server Error'
        return render_error(request, error_msg)

    response = FileResponse(open(tmp_zip_path, 'rb'), content_type="application/x-zip-compressed", as_attachment=True)
    response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(dtable.dtable_name) + '.dtable'

    tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid))
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)

    return response


def dtable_export_asset_files_view(request):
    task_id = request.GET.get('task_id', '')
    if not task_id:
        error_msg = 'task_id invalid.'
        return render_error(request, error_msg)

    dtable_uuid = request.GET.get('dtable_uuid', '')
    if not dtable_uuid:
        error_msg = 'dtable_uuid invalid.'
        return render_error(request, error_msg)

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        error_msg = 'Base not found.'
        return render_error(request, error_msg)
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        error_msg = 'Workspace not found.'
        return render_error(request, error_msg)

    # permission check
    username = request.user.username
    if not check_dtable_permission(username, workspace, dtable)\
            and not get_view_share_permision(username, dtable):
        error_msg = 'Permission denied.'
        return render_error(request, error_msg)

    tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'asset-files', task_id) + '.zip'
    if not os.path.exists(tmp_zip_path):
        error_msg = 'Task not found or not finished.'
        return render_error(request, error_msg)

    with open(tmp_zip_path, 'rb') as f:
        zip_stream = f.read()

    tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'asset-files', task_id)
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    if os.path.exists(tmp_zip_path):
        os.remove(tmp_zip_path)

    table_name = request.GET.get('table_name', '')
    column_name = request.GET.get('column_name', '')
    response = HttpResponse(zip_stream, content_type="application/x-zip-compressed")
    file_name = dtable.dtable_name + '-' + table_name + '-' + column_name
    response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(file_name) + '.zip'
    return response

def dtable_app_export_asset_files_view(request):
    #resources check
    task_id = request.GET.get('task_id', '')
    if not task_id:
        error_msg = 'task_id invalid.'
        return render_error(request, error_msg)

    app_uuid = request.GET.get('app_uuid', '')
    universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
    if not universal_app:
        error_msg = 'app %s not found.' % app_uuid
        return render_error(request, error_msg)

    dtable_uuid = universal_app.dtable_uuid

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
    if not dtable:
        error_msg = 'Base not found.'
        return render_error(request, error_msg)
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'asset-files', task_id) + '.zip'
    if not os.path.exists(tmp_zip_path):
        error_msg = 'Task not found or not finished.'
        return render_error(request, error_msg)

    #engage...

    with open(tmp_zip_path, 'rb') as f:
        zip_stream = f.read()

    tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'asset-files', task_id)
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    if os.path.exists(tmp_zip_path):
        os.remove(tmp_zip_path)

    response = HttpResponse(zip_stream, content_type="application/x-zip-compressed")
    file_name = request.GET.get('zip_name', '')
    response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(file_name) + '.zip'
    return response


def app_templates_fake_view(request, **kwargs):
    return render(request, 'app_templates_for_react.html')


def dtable_page_design_view(request, dtable_uuid, page_id):
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
    if not dtable:
        raise Http404
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    access_token = request.GET.get('access-token')
    if not access_token:
        return render_permission_error(request, _('Permission denied.'))
    try:
        payload = jwt.decode(access_token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except:
        return render_permission_error(request, _('Permission denied.'))

    if not payload.get('dtable_uuid') or uuid_str_to_36_chars(payload.get('dtable_uuid')) != uuid_str_to_36_chars(dtable_uuid):
        return render_permission_error(request, _('Permission denied.'))

    # dl means download
    # if dl is True, read pdf from fs and return pdf response
    dl = request.GET.get('dl', '0')
    task_id = request.GET.get('task_id')
    pdf_name = request.GET.get('pdf_name', 'SeaTable_page_design')
    if to_python_boolean(dl) and task_id:
        tmp_pdf_path = os.path.join('/tmp/dtable-io/convert-page-to-pdf', '%s_%s_%s.pdf' % (dtable_uuid, page_id, None))
        if not os.path.isfile(tmp_pdf_path):
            return render_error(request, _('Internal Server Error'))
        with open(tmp_pdf_path, 'rb') as f:
            pdf_stream = f.read()
        try:
            os.remove(tmp_pdf_path)
        except Exception as e:
            logger.warning('remove file error: %s', e)

        response = HttpResponse(pdf_stream, content_type="application/pdf")
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(pdf_name) + '.pdf'
        return response

    try:
        dtable_server_url = get_inner_dtable_server_url()
        metadata_url = dtable_server_url.strip('/') + '/api/v1/dtables/%(dtable_uuid)s/metadata/plugin/?from=dtable_web&plugin_type=%(plugin_type)s' \
            % {'dtable_uuid': str(dtable.uuid), 'plugin_type': 'page-design'}
        metadata_response = requests.get(metadata_url, headers={'Authorization': 'Token ' + access_token})
    except Exception as e:
        logger.exception(e)
        logger.error('request metadata error: %s', e)
        return render_error(request, _('Internal Server Error'))

    if metadata_response.status_code == 404:
        raise Http404
    if metadata_response.status_code != 200:
        logger.error('request metadata code: %s', metadata_response.status_code)
        return render_error(request, _('Internal Server Error'))

    try:
        dtable_metadata = metadata_response.json()['metadata']
    except Exception as e:
        logger.error('loads row/metadata error: %s', e)
        return render_error(request, _('Internal Server Error'))

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        return render_error(request, _('Internal Server Error'))

    user_list = []
    try:
        email_list = list_dtable_related_users(workspace, dtable)
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=request.user.username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
        for email in email_list:
            user_info = get_user_common_info(email)
            user_info['id_in_org'] = email2id_in_org.get(email, '')
            user_list.append(user_info)
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    response = render(request, 'dtable_page_design_react.html', {
        'dtable_metadata': json.dumps(dtable_metadata),
        'page_id': page_id,
        'collaborators': json.dumps(user_list),
        'id_in_org': id_in_org,
        'dtable_uuid': str(dtable.uuid),
        'access_token': access_token,
        'workspaceID': workspace.id,
    })
    response.set_cookie('access-token', access_token)
    return response


def dtable_row_page_design_view(request, dtable_uuid, page_id, row_id):
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
    if not dtable:
        raise Http404
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    access_token = request.GET.get('access-token')
    if not access_token:
        return render_permission_error(request, _('Permission denied.'))
    try:
        payload = jwt.decode(access_token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except:
        return render_permission_error(request, _('Permission denied.'))

    if not payload.get('dtable_uuid') or uuid_str_to_36_chars(payload.get('dtable_uuid')) != uuid_str_to_36_chars(dtable_uuid):
        return render_permission_error(request, _('Permission denied.'))

    # dl means download
    # if dl is True, read pdf from fs and return pdf response
    dl = request.GET.get('dl', '0')
    task_id = request.GET.get('task_id')
    pdf_name = request.GET.get('pdf_name', 'SeaTable_page_design')
    if to_python_boolean(dl) and task_id:
        tmp_pdf_path = os.path.join('/tmp/dtable-io/convert-page-to-pdf', '%s_%s_%s.pdf' % (dtable_uuid, page_id, row_id))
        if not os.path.isfile(tmp_pdf_path):
            return render_error(request, _('Internal Server Error'))
        with open(tmp_pdf_path, 'rb') as f:
            pdf_stream = f.read()
        try:
            os.remove(tmp_pdf_path)
        except Exception as e:
            logger.warning('remove file error: %s', e)

        response = HttpResponse(pdf_stream, content_type="application/pdf")
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(pdf_name) + '.pdf'
        return response

    try:
        dtable_server_url = get_inner_dtable_server_url()
        metadata_url = dtable_server_url.strip('/') + '/api/v1/dtables/%(dtable_uuid)s/metadata/plugin/?from=dtable_web&plugin_type=%(plugin_type)s' \
            % {'dtable_uuid': str(dtable.uuid), 'plugin_type': 'page-design'}
        metadata_response = requests.get(metadata_url, headers={'Authorization': 'Token ' + access_token})
    except Exception as e:
        logger.exception(e)
        logger.error('request metadata error: %s', e)
        return render_error(request, _('Internal Server Error'))

    if metadata_response.status_code == 404:
        raise Http404
    if metadata_response.status_code != 200:
        logger.error('request metadata code: %s', metadata_response.status_code)
        return render_error(request, _('Internal Server Error'))

    try:
        dtable_metadata = metadata_response.json()['metadata']
    except Exception as e:
        logger.error('loads row/metadata error: %s', e)
        return render_error(request, _('Internal Server Error'))

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        return render_error(request, _('Internal Server Error'))

    user_list = []
    try:
        email_list = list_dtable_related_users(workspace, dtable)
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)

        for email in email_list:
            user_info = get_user_common_info(email)
            user_info['id_in_org'] = email2id_in_org.get(email, '')
            user_list.append(user_info)
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    response = render(request, 'dtable_row_page_design_react.html', {
        'dtable_metadata': json.dumps(dtable_metadata),
        'page_id': page_id,
        'row_id': row_id,
        'collaborators': json.dumps(user_list),
        'dtable_uuid': str(dtable.uuid),
        'access_token': access_token,
        'workspaceID': workspace.id,
    })
    response.set_cookie('access-token', access_token)
    return response


def dtable_row_document_view(request, dtable_uuid, doc_uuid, row_id):
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)

    if not dtable:
        raise Http404
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    access_token = request.GET.get('access-token')
    if not access_token:
        return render_permission_error(request, _('Permission denied.'))
    try:
        payload = jwt.decode(access_token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except:
        return render_permission_error(request, _('Permission denied.'))

    username = payload.get('username') or ''

    if not payload.get('dtable_uuid') or uuid_str_to_36_chars(payload.get('dtable_uuid')) != uuid_str_to_36_chars(dtable_uuid):
        return render_permission_error(request, _('Permission denied.'))

    # dl means download
    # if dl is True, read pdf from fs and return pdf response
    dl = request.GET.get('dl', '0')
    task_id = request.GET.get('task_id')
    pdf_name = request.GET.get('pdf_name', 'SeaTable_document')
    if to_python_boolean(dl) and task_id:
        tmp_pdf_path = os.path.join('/tmp/dtable-io/convert-document-to-pdf', '%s_%s_%s.pdf' % (dtable_uuid, doc_uuid, row_id))
        if not os.path.isfile(tmp_pdf_path):
            return render_error(request, _('Internal Server Error'))
        with open(tmp_pdf_path, 'rb') as f:
            pdf_stream = f.read()
        try:
            os.remove(tmp_pdf_path)
        except Exception as e:
            logger.warning('remove file error: %s', e)

        response = HttpResponse(pdf_stream, content_type="application/pdf")
        response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(pdf_name) + '.pdf'
        return response

    try:
        dtable_server_url = get_inner_dtable_server_url()
        metadata_url = dtable_server_url.strip('/') + '/api/v1/dtables/%(dtable_uuid)s/metadata/plugin/?from=dtable_web&plugin_type=%(plugin_type)s' \
            % {'dtable_uuid': str(dtable.uuid), 'plugin_type': 'document'}
        metadata_response = requests.get(metadata_url, headers={'Authorization': 'Token ' + access_token})
    except Exception as e:
        logger.exception(e)
        logger.error('request metadata error: %s', e)
        return render_error(request, _('Internal Server Error'))

    if metadata_response.status_code == 404:
        raise Http404
    if metadata_response.status_code != 200:
        logger.error('request metadata code: %s', metadata_response.status_code)
        return render_error(request, _('Internal Server Error'))

    try:
        dtable_metadata = metadata_response.json()['metadata']
    except Exception as e:
        logger.error('loads row/metadata error: %s', e)
        return render_error(request, _('Internal Server Error'))

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        return render_error(request, _('Internal Server Error'))

    documents_settings = get_documents_config(workspace.repo_id, str(dtable.uuid), request.user.username)
    doc = next(filter(lambda cur_doc: cur_doc.get('doc_uuid') == doc_uuid, documents_settings), None)
    if not doc:
        return render_error(request, _('This document does not exist'))

    user_list = []
    try:
        email_list = list_dtable_related_users(workspace, dtable)
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)

        for email in email_list:
            user_info = get_user_common_info(email)
            user_info['id_in_org'] = email2id_in_org.get(email, '')
            user_list.append(user_info)
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

    org_id = dtable.workspace.org_id
    departments = DepartmentsV2.objects.filter(org_id=org_id).order_by('id')
    department_infos = [department.to_dict() for department in departments]

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)

    response = render(request, 'dtable_row_document_react.html', {
        'document_setting': json.dumps(doc),
        'dtable_metadata': json.dumps(dtable_metadata),
        'doc_uuid': doc_uuid,
        'row_id': row_id,
        'collaborators': json.dumps(user_list),
        'dtable_uuid': str(dtable.uuid),
        'access_token': access_token,
        'workspaceID': workspace.id,
        'seadoc_server_url': SEADOC_SERVER_URL,
        'id_in_org': id_in_org,
        'departments': json.dumps(department_infos),
        'user_department_ids_map': json.dumps(user_department_ids_map),
    })
    kwargs = {
        'id_in_org': id_in_org,
        'user_department_ids_map': user_department_ids_map
    }
    dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url, kwargs=kwargs)
    response.set_cookie('access-token', dtable_server_api.internal_dtable_server_access_token)
    return response


@login_required
def dtable_template_copy_view(request):
    # arguments check
    template_link_token = request.GET.get('template_link_token')
    if not template_link_token:
        return HttpResponseRedirect('/')
    username = request.user.username
    dst_workspace = Workspaces.objects.get_workspace_by_owner(username)

    # resource check
    dtable_external_link = DTableExternalLinks.objects.filter(token=template_link_token).select_related('dtable',
                                                                                          'dtable__workspace').first()
    if not dtable_external_link or dtable_external_link.dtable.deleted:
        error_msg = 'template_link_token %s not found.' % (template_link_token,)
        return render_error(request, error_msg)
    name = DTables.objects.get_non_duplicated_name(dtable_external_link.dtable.name, dst_workspace.id)
    # copy
    dst_dtable, error_msg = copy_dtable(dtable_external_link.dtable.workspace, dtable_external_link.dtable,
                                        dst_workspace, name, username, request)

    if error_msg:
        return render_error(request, error_msg)

    redirect_to = '/workspace/' + str(dst_dtable.workspace.id) + '/dtable/' + quote(dst_dtable.name) + '/'

    return HttpResponseRedirect(redirect_to)


def custom_asset_access(request, dtable_uuid, asset_uuid):
    """

    Permission:
    1. owner
    2. group member
    3. shared user with `rw` or `admin` permission
    """
    # resource check
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    asset = CustomAssetUUID.objects.get_by_uuid(asset_uuid)
    if not asset:
        return render_error(request, _('Asset file does not exist'))
    if asset.dtable_uuid != dtable_uuid:
        return render_error(request, _('Asset file does not exist'))

    parent_dir = asset.parent_path
    file_name = asset.file_name
    dl = request.GET.get('dl', '0')

    asset_path = normalize_file_path(os.path.join('custom', parent_dir, file_name))
    url = reverse('dtable:dtable_asset_access', args=(dtable.workspace.id, dtable_uuid, asset_path.strip('/'))) + '?dl=' + dl

    return HttpResponseRedirect(url)


@login_required
def custom_asset_preview(request, dtable_uuid, asset_uuid):
    # resource check
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    asset = CustomAssetUUID.objects.get_by_uuid(asset_uuid)
    if not asset:
        return render_error(request, _('Asset file does not exist'))
    if asset.dtable_uuid != dtable_uuid:
        return render_error(request, _('Asset file does not exist'))

    parent_dir = asset.parent_path
    file_name = asset.file_name

    asset_path = normalize_file_path(os.path.join('custom', parent_dir, file_name))
    url = reverse('dtable:dtable_asset_preview', args=(dtable.workspace.id, dtable_uuid, asset_path.strip('/')))

    return HttpResponseRedirect(url)


@login_required
def custom_asset_thumbnail(request, dtable_uuid, asset_uuid):
    # resource check
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('This base does not exist'))
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    asset = CustomAssetUUID.objects.get_by_uuid(asset_uuid)
    if not asset:
        return render_error(request, _('Asset file does not exist'))
    if asset.dtable_uuid != dtable_uuid:
        return render_error(request, _('Asset file does not exist'))

    parent_dir = asset.parent_path
    file_name = asset.file_name

    asset_path = normalize_file_path(os.path.join('custom', parent_dir, file_name))
    url = reverse('thumbnail_get', args=(dtable.workspace.id, dtable_uuid, asset_path.strip('/'))) \
        + '?size=' + str(request.GET.get('size', 256))

    return HttpResponseRedirect(url)


def dtable_export_big_data_screen_files_view(request):
    task_id = request.GET.get('task_id', '')
    if not task_id:
        error_msg = 'task_id invalid.'
        return render_error(request, error_msg)

    file_name = request.GET.get('page_name')
    if not file_name:
        file_name = task_id

    dtable_uuid = request.GET.get('dtable_uuid', '')
    if not dtable_uuid:
        error_msg = 'dtable_uuid invalid.'
        return render_error(request, error_msg)

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        error_msg = 'Base not found.'
        return render_error(request, error_msg)
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        error_msg = 'Workspace not found.'
        return render_error(request, error_msg)

    # permission check
    username = request.user.username
    if not check_dtable_permission(username, workspace, dtable)\
            and not get_view_share_permision(username, dtable):
        error_msg = 'Permission denied.'
        return render_error(request, error_msg)

    tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'big-data-screen', task_id) + '.zip'
    if not os.path.exists(tmp_zip_path):
        error_msg = 'Task not found or not finished.'
        return render_error(request, error_msg)

    with open(tmp_zip_path, 'rb') as f:
        zip_stream = f.read()

    tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'big-data-screen', task_id)
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    if os.path.exists(tmp_zip_path):
        os.remove(tmp_zip_path)

    response = HttpResponse(zip_stream, content_type="application/x-zip-compressed")
    response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(file_name) + '.zip'
    return response


def dtable_export_big_data_screen_app_files_view(request):
    task_id = request.GET.get('task_id', '')
    if not task_id:
        error_msg = 'task_id invalid.'
        return render_error(request, error_msg)

    file_name = request.GET.get('app_name')
    if not file_name:
        file_name = task_id

    app_uuid = request.GET.get('app_uuid', '')
    if not app_uuid:
        error_msg = 'app_uuid invalid.'
        return render_error(request, error_msg)

    external_app = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
    if not external_app:
        return render_error(request, 'App not found')

    dtable = DTables.objects.get_dtable_by_uuid(external_app.dtable_uuid, include_deleted=False)
    if not dtable:
        error_msg = 'Base not found.'
        return render_error(request, error_msg)
    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        error_msg = 'Workspace not found.'
        return render_error(request, error_msg)

    # permission check
    username = request.user.username
    if not check_dtable_permission(username, workspace, dtable)\
            and not get_view_share_permision(username, dtable):
        error_msg = 'Permission denied.'
        return render_error(request, error_msg)

    tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'big-data-screen', task_id) + '.zip'
    if not os.path.exists(tmp_zip_path):
        error_msg = 'Task not found or not finished.'
        return render_error(request, error_msg)

    with open(tmp_zip_path, 'rb') as f:
        zip_stream = f.read()

    tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'big-data-screen', task_id)
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    if os.path.exists(tmp_zip_path):
        os.remove(tmp_zip_path)

    response = HttpResponse(zip_stream, content_type="application/x-zip-compressed")
    response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(file_name) + '.zip'
    return response



@bind_cookie_user
@login_required
def dtable_app_asset_preview(request, app_uuid, path):
    page_id = request.GET.get('page_id')
    if not page_id:
        return render_error(request, 'page_id invalid')
    row_id = request.GET.get('row_id')
    if not row_id:
        return render_error(request, 'row_id invalid')

    external_app = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
    if not external_app:
        return render_error(request, 'App does not exist.')

    if external_app.inactive:
        return render_error(request, 'App is not available.')
    
    app_config = json.loads(external_app.app_config)
    pages = app_config.get('settings').get('pages')
    page = next(filter(lambda x: x.get('id') == page_id, pages), None)
    if not page:
        error_msg = 'page %s not found.' % page_id
        render_error(request, error_msg)

    dtable_uuid = external_app.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, 'Base does not exist.')

    if dtable.deleted:
        return render_error(request, 'Base does not exist.')

    if not dtable.in_storage:
        return render_error(request, NOT_IN_STORAGE_ERROR_MSG)

    workspace_id = dtable.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        return render_error(request, 'Library does not exist.')

    asset_path = normalize_file_path(os.path.join('/asset', uuid_str_to_36_chars(dtable_uuid), path))

    file_name = os.path.basename(normalize_file_path(path))
    file_type, file_ext = get_file_type_and_ext(file_name)

    asset_id = seafile_api.get_file_id_by_path(repo_id, asset_path)
    if not asset_id:
        return render_error(request, 'Asset file does not exist')

    table_id = page.get('table_id')
        # metadata
    dtable_server_api = DTableServerAPI('dtable-web', str(dtable_uuid), get_inner_dtable_server_url())
    try:
        metadata = dtable_server_api.get_metadata()
    except Exception as e:
        logger.exception('request dtable: %s metadata error: %s', dtable_uuid, e)
        return render_error(request, 'Internal Server Error')

    tables = metadata.get('tables')
    table = next(filter(lambda x: x.get('_id') == table_id, tables), None)
    if not table:
        error_msg = 'table %s not found.' % table_id
        return render_error(request, error_msg)

    username = request.user.username

    dtable.metadata = metadata
    try:
        can_access, can_edit = check_app_asset_permission(request, workspace, dtable, external_app, page, table, row_id, path, asset_id)
    except Exception as e:
        logger.error(e)
        return render_error(request, 'Internal Server Error')

    if not can_access:
        return render_permission_error(request, 'Permission denied.')

    token = seafile_api.get_fileserver_access_token(
        repo_id, asset_id, 'view', '', use_onetime=False
    )

    inner_path = gen_inner_file_get_url(token, file_name)
    error_msg, file_content, encoding = get_file_content(file_type, inner_path, 'auto')

    raw_path = gen_file_get_url(token, file_name)
    send_file_access_msg(request, dtable, asset_path, 'view')

    can_download = has_dtable_asset_cache_download_permission(request, dtable_uuid) or False
    if not can_download:
        permission_dict, error_msg = check_dtable_operation_permission_by_metadata(request.user.username, workspace, metadata)
        if error_msg:
            return render_error(request, error_msg)
        can_download = permission_dict.get('can_download', True)
        if can_download:
            set_dtable_asset_cache_download_permission(request, dtable_uuid)

    download_url = '%s/workspace/%s/asset/%s/%s?dl=1' % (DTABLE_WEB_SERVICE_URL.strip('/'), workspace_id, dtable_uuid, path)
    return_dict = {
        'repo': repo,
        'filename': file_name,
        'file_path': asset_path,
        'file_type': file_type,
        'file_ext': file_ext,
        'raw_path': raw_path,
        'download_url': download_url,
        'file_content': file_content,
        'err': 'File preview unsupported' if file_type == 'Unknown' else error_msg,
        'has_office_convertor': settings.HAS_OFFICE_CONVERTER,
        'can_download': can_download
    }

    if ENABLE_SEADOC and file_type == SEADOC and path.startswith('custom'):
        # remove 'custom' in path
        path = path[6:]
        file_uuid = get_seadoc_file_uuid(dtable_uuid, path)

        return_dict['file_uuid'] = file_uuid
        return_dict['assets_url'] = '/api/v2.1/seadoc/download-image/' + file_uuid
        return_dict['seadoc_server_url'] = SEADOC_SERVER_URL
        return_dict['path'] = path
        return_dict['is_pro'] = IS_PRO_VERSION
        if can_edit:
            permission = PERMISSION_READ_WRITE
        else:
            permission = PERMISSION_READ
        return_dict['file_perm'] = permission
        return_dict['can_edit_file'] = can_edit
        return_dict['seadoc_access_token'] = gen_seadoc_access_token(file_uuid, file_name, username,
                                                                     permission=permission)

        return render(request, 'sdoc_file_view_react.html', return_dict)

    if file_type in (DOCUMENT, SPREADSHEET):
        if IS_PRO_VERSION and ENABLE_COLLABORA and file_ext in COLLABORA_FILE_EXTENSION:
            username = request.user.username
            if not request.user.permissions.can_use_advanced_permissions():
                can_edit = False
                # custom permission
            action_name = 'edit' if can_edit else 'view'
            wopi_dict = get_wopi_dict(username, repo_id, asset_path, action_name, 'true', request.LANGUAGE_CODE)
            if wopi_dict:
                return render(request, 'view_file_collabora.html', wopi_dict)
            else:
                return_dict['err'] = _('Error when prepare Collabora Office file preview page.')

        if IS_PRO_VERSION and ENABLE_ONLYOFFICE and file_ext in ONLYOFFICE_FILE_EXTENSION:
            username = request.user.username
            if not request.user.permissions.can_use_advanced_permissions():
                can_edit = False
            
            onlyoffice_dict = get_onlyoffice_dict(request, username, repo_id, asset_path, asset_id, can_edit, can_download)
            if onlyoffice_dict:
                return render(request, 'view_file_onlyoffice.html', onlyoffice_dict)
            else:
                return_dict['err'] = _('Error when prepare OnlyOffice file preview page.')

        if settings.HAS_OFFICE_CONVERTER:
            template = 'dtable_asset_file_view_react.html'
            file_url = gen_file_get_url(token, file_name)
            error_msg = prepare_converted_html(file_url, asset_id, file_ext, return_dict)
            if error_msg:
                return_dict['err'] = error_msg
                return render(request, template, return_dict)

    return render(request, 'dtable_asset_file_view_react.html', return_dict)

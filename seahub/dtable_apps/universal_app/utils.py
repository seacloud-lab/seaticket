import json
import logging
import os
import re
import random

import requests
import jwt

from seaserv import seafile_api

from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.utils import can_access_asset, can_access_asset_through_external_app, set_dtable_asset_cache_read_permission
from seahub.settings import DTABLE_PRIVATE_KEY, INNER_DTABLE_DB_URL
from seahub.utils import gen_file_get_url, uuid_str_to_36_chars, gen_inner_file_get_url
from seahub.dtable.models import IdInOrgTuple
from seahub.department_v2.utils import get_departments_map_by_username
from seahub.dtable_apps.dtable_db_api import DTableDBAPI


logger = logging.getLogger(__name__)
CAN_USED_APP = 'can_used_app_folder'
MY_MANAGED_APP = 'managed_app_folder'

NAV_TYPE_FOLDER = 'folder'
NAV_TYPE_PAGE = 'page'
MOVE_BELOW = 'move_below'

APP_FOLDER_TYPES = [
    CAN_USED_APP,
    MY_MANAGED_APP,
]


def generator_base64_code(length=4):
    possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789'
    ids = random.sample(possible, length)
    return ''.join(ids)


def get_navigation_ids_set(navigation):
    navigation_ids_set = set()

    def recursive_item(item):
        navigation_ids_set.add(item.get('id'))
        children = item.get('children', [])
        for child in children:
            recursive_item(child)

    for item in navigation:
        recursive_item(item)

    return navigation_ids_set


def gen_unique_navigation_id(navigation_ids_set, length=4):
    _id = generator_base64_code(length)
    while _id in navigation_ids_set:
        _id = generator_base64_code(length)

    return _id


def add_nav_into_folder(nav, folder, target_folder_id):
    if folder.get('id') == target_folder_id:
        folder.get('children', []).append(nav)
    else:
        for child in folder.get('children', []):
            if child.get('type') == NAV_TYPE_FOLDER:
                add_nav_into_folder(nav, child, target_folder_id)


def insert_nav_into_folder(nav, folder, target_page_id, target_folder_id, move_position):
    if target_folder_id == folder.get('id'):
        insert_index = -1
        if target_page_id:
            target_page = next(filter(lambda x: x.get('id') == target_page_id, folder.get('children', [])), None)
            if target_page:
                insert_index = folder.get('children', []).index(target_page)

        if move_position == MOVE_BELOW:
            insert_index += 1

        folder.get('children', []).insert(insert_index, nav)
    else:
        for child in folder.get('children', []):
            if child.get('type') == NAV_TYPE_FOLDER:
                insert_nav_into_folder(nav, child, target_page_id, target_folder_id, move_position)


def insert_page_under_folder(nav, target_folder_id, move_position, navigation):
    if not target_folder_id:
        navigation.append(nav)
        return

    has_inserted = False
    index_offset = 0
    if move_position == MOVE_BELOW:
        index_offset += 1

    target_folder = next(filter(lambda x: x.get('id') == target_folder_id, navigation), None)
    if target_folder:
        navigation.insert(navigation.index(target_folder) + index_offset, nav)
        has_inserted = True
    else:
        for item in navigation:
            if item.get('type') == NAV_TYPE_FOLDER:
                target_sub_folder = next(filter(lambda x: x.get('id') == target_folder_id, item.get('children', [])), None)
                if target_sub_folder:
                    insert_index = item.get('children', []).index(target_sub_folder) + index_offset
                    item.get('children', []).insert(insert_index, nav)
                    has_inserted = True

    if not has_inserted:
        navigation.append(nav)


def add_page_to_navigation(page, navigation, target_folder_id):
    new_nav = { 'id': page.get('id'), 'type': NAV_TYPE_PAGE }
    if not target_folder_id:
        navigation.append(new_nav)
    else:
        for item in navigation:
            if item.get('type') == NAV_TYPE_FOLDER:
                add_nav_into_folder(new_nav, item, target_folder_id)


def del_page_from_folder(page_id, folder):
    page = next(filter(lambda x: x.get('id') == page_id and x.get('type') == NAV_TYPE_PAGE, folder.get('children', [])), None)
    if page:
        folder.get('children', []).remove(page)
    else:
        for item in folder.get('children', []):
            if item.get('type') == NAV_TYPE_FOLDER:
                del_page_from_folder(page_id, item)


def del_page_from_navigation(page_id, navigation):
    page = next(filter(lambda x: x.get('id') == page_id and x.get('type') == NAV_TYPE_PAGE, navigation), None)
    if page:
        navigation.remove(page)
    else:
        for item in navigation:
            if item.get('type') == NAV_TYPE_FOLDER:
                del_page_from_folder(page_id, item)


def move_page_from_navigation(moved_page_id, target_page_id, target_folder_id, move_position, is_moved_out, navigation):
    del_page_from_navigation(moved_page_id, navigation)

    moved_nav = { 'id': moved_page_id, 'type': NAV_TYPE_PAGE }

    # move page under folder
    if is_moved_out:
        insert_page_under_folder(moved_nav, target_folder_id, move_position, navigation)
        return

    if target_folder_id:
        for item in navigation:
            if item.get('type') == NAV_TYPE_FOLDER:
                insert_nav_into_folder(moved_nav, item, target_page_id, target_folder_id, move_position)
    else:
        insert_index = -1
        if target_page_id:
            target_page = next(filter(lambda x: x.get('id') == target_page_id, navigation), None)
            if target_page:
                insert_index = navigation.index(target_page)

        if insert_index == -1:
            navigation.append(moved_nav)
            return

        if move_position == MOVE_BELOW:
            insert_index += 1

        navigation.insert(insert_index, moved_nav)


def _get_app_page_permissions(payload, page, permission_name):
    app_role_name = payload.get('user_role_name')
    app_role_id = payload.get('role_id')
    page_permissions = page.get('page_permissions', {})
    if not page_permissions:
        return True
    permission = page_permissions.get(permission_name)
    if not permission:
        return True
    permission_type = permission.get('permission_type')
    if permission_type == 'default':
        return True
    if permission_type == 'admins' and app_role_name == 'admin':
        return True
    if permission_type == 'specific_roles':
        permitted_role_ids = permission.get('permitted_roles')
        if app_role_id in permitted_role_ids:
            return True
        
    return False

def app_page_can_read(payload, page):
    app_role_name = payload.get('user_role_name')
    if app_role_name == 'admin':
        return True
    return _get_app_page_permissions(payload, page, 'view_rows_permission')

def app_page_can_add(payload, page):
    username = payload.get('username')
    if not username:
        return False
    if username == 'anonymous':
        return False
    return _get_app_page_permissions(payload, page, 'add_rows_permission')

def app_page_can_modify(payload, page):
    username = payload.get('username')
    if not username:
        return False
    if username == 'anonymous':
        return False
    page_type = page.get('type')
    is_query_result_editable = page.get('is_query_result_editable', False)
    if page_type == 'data_search' and not is_query_result_editable:
        return False
    return _get_app_page_permissions(payload, page, 'edit_rows_permission')

def app_page_can_delete(payload, page):
    username = payload.get('username')
    if not username:
        return False
    if username == 'anonymous':
        return False
    return _get_app_page_permissions(payload, page, 'delete_rows_permission')

def app_page_can_submit_form(payload, page=None):
    username = payload.get('username')
    if not username:
        return False
    return True

def get_app_user(app_user):
    app_username = app_user.username
    app_user_role = app_user.role
    app_user_info = app_user.to_dict()
    avatar_url, _, _ = api_avatar_url(app_username)

    app_user_info.update({
        'name': email2nickname(app_username),
        'app_name': app_user.app.app_name,
        'role_id': app_user_role and app_user_role.pk,
        'role_name': app_user_role and app_user_role.role_name,
        'role_permission': app_user_role and app_user_role.role_permission,
        'avatar_url': avatar_url,
        'email': app_username,

    })

    return app_user_info

def rebuild_table_info(tables):
    """
    Change the table data structure returned from metadata
    from:

    [{'_id': "xxx", "name": "xxx", "columns": [{"key":"xxxxx", "name": "xxxxx"}]}]

    to a big dict such as:

    {
        <table_id>: {
            "name": "xxxxx",
            "columns": {
                <column_key>: {...other column info dict}
            }
        }
    }
    """
    return {
        t.get("_id"): {
            "name": t.get('name'),
            "columns": {
                col.get('key'): col
                for col in t.get('columns')
            }
        }

        for t in tables
    }


def get_linked_table_name(metadata, current_table_id, current_link_column_key):
    tables = metadata.get('tables', [])
    tables_dict = rebuild_table_info(tables)
    link_column_data = tables_dict \
        .get(current_table_id, {}) \
        .get('columns', {}) \
        .get(current_link_column_key, {}) \
        .get('data', {})

    link_table_id = link_column_data.get('table_id')
    link_other_table_id = link_column_data.get('other_table_id')

    if (link_table_id != link_other_table_id) and \
            current_table_id == link_other_table_id:
        link_table_id, link_other_table_id = link_other_table_id, link_table_id

    return tables_dict.get(link_other_table_id, {}).get('name', None)


def get_custom_pages(app_config, repo_id, dtable_uuid):
    if isinstance(app_config, str):
        app_config = json.loads(app_config)

    custom_pages = {}
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    empty_content = {
        'block_ids': [],
        'block_by_id': {},
        'version': 5
    }
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'custom_page':
            content_url = page.get('content_url', '')
            if not content_url:
                custom_pages[page_id] = empty_content
                continue

            if 'external-apps' not in content_url:
                # relative path
                # /app_id/page_id/page_id.json
                # /app_id-page_id/page_id.json
                content_path = base_dir + '/external-apps/' + content_url.strip('/')
                content_file_id = seafile_api.get_file_id_by_path(repo_id, content_path)

            else:
                if base_dir not in content_url:
                    custom_pages[page_id] = empty_content
                    continue

                base_dir_index = content_url.find(base_dir)
                content_path = base_dir + '/' + content_url[base_dir_index+len(base_dir):].strip('/')

            content_file_id = seafile_api.get_file_id_by_path(repo_id, content_path)
            content_file_name = os.path.basename(content_path)
            if not content_file_id:
                custom_pages[page_id] = empty_content
                continue
            token = seafile_api.get_fileserver_access_token(
                repo_id, content_file_id, 'download', '', use_onetime=False
            )
            url = gen_file_get_url(token, content_file_name)
            try:
                response = requests.get(url)
                custom_pages[page_id] = response.json()
            except Exception as e:
                logger.warning('dtable: %s content_url: %s file url: %s error: %s', dtable_uuid, content_url, url, e)
                custom_pages[page_id] = empty_content

    return custom_pages


def get_custom_pages_in_snapshot(app_config, repo_id, dtable_uuid, snapshot_id):
    if isinstance(app_config, str):
        app_config = json.loads(app_config)

    custom_pages = {}
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    empty_content = {
        'block_ids': [],
        'block_by_id': {},
        'version': 5
    }
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'custom_page':
            content_url = page.get('content_url', '')
            if not content_url:
                custom_pages[page_id] = empty_content
                continue

            if 'external-apps' not in content_url:
                # relative path
                # /app_id/page_id/page_id.json
                # /app_id-page_id/page_id.json
                content_path = base_dir + '/external-apps/' + content_url.strip('/')

            else:
                if base_dir not in content_url:
                    custom_pages[page_id] = empty_content
                    continue

                base_dir_index = content_url.find(base_dir)
                content_path = base_dir + '/' + content_url[base_dir_index + len(base_dir):].strip('/')

            content_file_name = os.path.basename(content_path)
            src_path = os.path.dirname(content_path)
            snapshot_content_path = os.path.join(src_path, 'custom_page_backup_%s' % snapshot_id, content_file_name)
            content_file_id = seafile_api.get_file_id_by_path(repo_id, snapshot_content_path)

            if not content_file_id:
                custom_pages[page_id] = empty_content
                continue
            token = seafile_api.get_fileserver_access_token(
                repo_id, content_file_id, 'download', '', use_onetime=False
            )
            url = gen_file_get_url(token, content_file_name)
            try:
                response = requests.get(url)
                custom_pages[page_id] = response.json()
            except Exception as e:
                logger.warning('dtable: %s content_url: %s file url: %s error: %s', dtable_uuid, content_url, url, e)
                custom_pages[page_id] = empty_content

    return custom_pages


def backup_custom_pages(app, repo_id, dtable_uuid, username, snapshot_id):
    app_config = json.loads(app.app_config)
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'custom_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            if 'external-apps' not in content_url:
                # relative path
                # /app_id/page_id/page_id.json
                # /app_id-page_id/page_id.json
                content_path = base_dir + '/external-apps/' + content_url.strip('/')

            else:
                if base_dir not in content_url:
                    continue

                base_dir_index = content_url.find(base_dir)
                content_path = base_dir + '/' + content_url[base_dir_index + len(base_dir):].strip('/')

            src_path = os.path.dirname(content_path)
            content_file_name = os.path.basename(content_path)
            asset_id = seafile_api.get_file_id_by_path(repo_id, content_path)

            dist_path = os.path.join(src_path, 'custom_page_backup_%s' % snapshot_id)
            try:
                if asset_id:
                    seafile_api.mkdir_with_parents(repo_id, '/', dist_path[1:], '')
                    seafile_api.copy_file(repo_id, src_path, json.dumps([content_file_name]),
                                        repo_id, dist_path, json.dumps([content_file_name]),
                                        username=username, need_progress=0, synchronous=1)
            except Exception as e:
                logger.warning('fail to backup dtable: %s app: %s custom page: %s error: %s', dtable_uuid,
                               app.id, page_id, e)
                continue


def revert_custom_pages(app, repo_id, dtable_uuid, username, snapshot_id):
    app_config = json.loads(app.app_config)
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'custom_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            if 'external-apps' not in content_url:
                # relative path
                # /app_id/page_id/page_id.json
                # /app_id-page_id/page_id.json
                content_path = base_dir + '/external-apps/' + content_url.strip('/')

            else:
                if base_dir not in content_url:
                    continue

                base_dir_index = content_url.find(base_dir)
                content_path = base_dir + '/' + content_url[base_dir_index + len(base_dir):].strip('/')

            dist_path = os.path.dirname(content_path)
            src_path = os.path.join(dist_path, 'custom_page_backup_%s' % snapshot_id)
            content_file_name = os.path.basename(content_path)

            try:
                # seafile_api.mkdir_with_parents(repo_id, '/', dist_path[1:], '')
                src_file_path = os.path.join(src_path, content_file_name)
                asset_id = seafile_api.get_file_id_by_path(repo_id, content_path)
                backup_asset_id = seafile_api.get_file_id_by_path(repo_id, src_file_path)
                if not backup_asset_id:
                    logger.warning('backup asset not found: dtable: %s, app: %s, custom_page: %s', dtable_uuid, app.id, page_id)
                    continue

                if asset_id:
                    seafile_api.del_file(repo_id, dist_path, json.dumps([content_file_name]), username)
                    seafile_api.copy_file(repo_id, src_path, json.dumps([content_file_name]),
                                        repo_id, dist_path, json.dumps([content_file_name]),
                                        username=username, need_progress=0, synchronous=1)
            except Exception as e:
                logger.warning('fail to revert dtable: %s app: %s custom page: %s error: %s', dtable_uuid,
                               app.id, page_id, e)
                continue


def delete_custom_pages_backup_dir(app_snapshot_config, repo_id, dtable_uuid, username, snapshot_id):
    app_settings = app_snapshot_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'custom_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            if 'external-apps' not in content_url:
                # relative path
                # /app_id/page_id/page_id.json
                # /app_id-page_id/page_id.json
                content_path = base_dir + '/external-apps/' + content_url.strip('/')

            else:
                if base_dir not in content_url:
                    continue

                base_dir_index = content_url.find(base_dir)
                content_path = base_dir + '/' + content_url[base_dir_index + len(base_dir):].strip('/')

            dir_path = os.path.dirname(content_path)
            file_path = os.path.join(dir_path, 'custom_page_backup_%s' % snapshot_id)
            dir_name = os.path.basename(file_path)
            content_file_name = os.path.basename(content_path)

            try:
                # delete file in dir
                seafile_api.del_file(repo_id, file_path, json.dumps([content_file_name]), username)
                # delete dir
                seafile_api.del_file(repo_id, dir_path, json.dumps([dir_name]), username)

            except Exception as e:
                logger.warning('fail to delete dtable: %s app_snapshot: %s custom page: %s error: %s', dtable_uuid,
                               snapshot_id, page_id, e)
                continue


def duplicate_custom_pages(old_app, repo_id, workspace_id, dtable_uuid, new_app, username):
    if old_app.app_type != 'universal-app':
        return new_app

    old_app_config = json.loads(old_app.app_config)
    old_app_settings = old_app_config.get('settings', {})
    old_app_pages = old_app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    new_page_id_content_path_map = {}
    for page in old_app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'custom_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            if 'external-apps' not in content_url:
                # relative path
                # /app_id/page_id/page_id.json
                # /app_id-page_id/page_id.json
                content_path = base_dir + '/external-apps/' + content_url.strip('/')

            else:
                if base_dir not in content_url:
                    continue
                base_dir_index = content_url.find(base_dir)
                content_path = base_dir + '/' + content_url[base_dir_index+len(base_dir):].strip('/')

            src_path = os.path.dirname(content_path)
            content_file_name = os.path.basename(content_path)
            content_file_tag = content_file_name.split('.')[0]
            content_file_id = seafile_api.get_file_id_by_path(repo_id, content_path)

            if not content_file_id:
                continue
            try:
                new_app_relative_path = 'external-apps/%s/%s' % (new_app.id, content_file_tag)

                # make new system dir
                new_app_path = os.path.join(base_dir, new_app_relative_path)
                seafile_api.mkdir_with_parents(repo_id, '/', new_app_path[1:], '')
                exist_files_names = [dirent.obj_name for dirent in seafile_api.list_dir_by_path(repo_id, src_path)]
                seafile_api.copy_file(repo_id, src_path, json.dumps(exist_files_names),
                                      repo_id, new_app_path, json.dumps(exist_files_names),
                                      username=username, need_progress=0, synchronous=1)

                # download page, update some assets path and upload
                token = seafile_api.get_fileserver_access_token(
                    repo_id, content_file_id, 'view', '', use_onetime=True
                )
                is_changed = False
                url = gen_inner_file_get_url(token, content_file_name)
                page_content = requests.get(url).json()

                if 'block_ids' not in page_content.keys():
                    page_content = {
                        'block_ids': [],
                        'block_by_id': {},
                        'version': 5
                    }
                block_ids = page_content.get('block_ids', [])
                block_by_id = page_content.get('block_by_id', {})
                for block_id in block_ids:
                    block = block_by_id.get(block_id, {})
                    block_children = block.get('children', [])
                    for block_children_id in block_children:
                        element = block_by_id.get(block_children_id, {})
                        element_type = element.get('type', '')
                        if element_type == 'static_long_text':
                            # images in external-apps/form_long_text_image
                            dst_image_url_part = '%s/asset/%s/external-apps/form_long_text_image' % (str(workspace_id), uuid_str_to_36_chars(dtable_uuid))
                            element['value']['text'] = re.sub(r'\d+/asset/[-0-9a-f]{36}/external-apps/form_long_text_image', dst_image_url_part, element['value']['text'])
                            # images in external-apps/<app_id>/page_id
                            dst_image_url_part = '%s/asset/%s/external-apps/%s/%s' % (str(workspace_id), uuid_str_to_36_chars(dtable_uuid), new_app.id, page_id)
                            element['value']['text'] = re.sub(r'\d+/asset/[-0-9a-f]{36}/external-apps/\d+/\w+', dst_image_url_part, element['value']['text'])

                            is_changed = True

                if is_changed:
                    tmp_page_content_path = '/tmp/dtbale-io/%s-%s.json' % (new_app.id, page_id)
                    os.makedirs(os.path.dirname(tmp_page_content_path), exist_ok=True)
                    with open(tmp_page_content_path, 'w') as f:
                        json.dump(page_content, f)
                    seafile_api.put_file(repo_id, tmp_page_content_path, new_app_path, content_file_name, username, None)
                    os.remove(tmp_page_content_path)

                new_content_url = '/%s/%s/%s.json' % (new_app.id, content_file_tag, content_file_tag)
                new_page_id_content_path_map[page_id] = new_content_url
            except Exception as e:
                logger.warning('fail to duplicate dtable: %s app: %s custom page: %s error: %s', dtable_uuid, old_app.id, page_id, e)
                continue
    new_app_config = json.loads(new_app.app_config)
    new_app_settings = new_app_config.get('settings', {})
    new_app_pages = new_app_settings.get('pages', [])
    for page in new_app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'custom_page' and page_id in new_page_id_content_path_map:
            page['content_url'] = new_page_id_content_path_map[page_id]
    new_app.app_config = json.dumps(new_app_config)
    new_app.save()
    return new_app


def get_single_record_pages(app_config, repo_id, dtable_uuid):
    if isinstance(app_config, str):
        app_config = json.loads(app_config)

    single_record_pages = {}
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    empty_content = {
        'sections': [],
        'elements': [],
        'version': 1,
    }
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'single_record_page':
            content_url = page.get('content_url', '')
            if not content_url:
                single_record_pages[page_id] = empty_content
                continue

            # /app_id/page_id/page_id.json
            # /app_id-page_id/page_id.json
            content_path = base_dir + '/external-apps/' + content_url.strip('/')

            content_file_name = os.path.basename(content_path)
            content_file_id = seafile_api.get_file_id_by_path(repo_id, content_path)

            if not content_file_id:
                single_record_pages[page_id] = empty_content
                continue
            token = seafile_api.get_fileserver_access_token(
                repo_id, content_file_id, 'download', '', use_onetime=False
            )
            url = gen_file_get_url(token, content_file_name)
            try:
                response = requests.get(url)
                single_record_pages[page_id] = response.json()
            except Exception as e:
                logger.warning('dtable: %s content_url: %s file url: %s error: %s', dtable_uuid, content_url, url, e)
                single_record_pages[page_id] = empty_content

    return single_record_pages


def get_single_record_pages_in_snapshot(app_config, repo_id, dtable_uuid, snapshot_id):
    if isinstance(app_config, str):
        app_config = json.loads(app_config)

    single_record_pages = {}
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    empty_content = {
        'sections': [],
        'elements': [],
        'version': 1,
    }
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'single_record_page':
            content_url = page.get('content_url', '')
            if not content_url:
                single_record_pages[page_id] = empty_content
                continue

            # /app_id/page_id/page_id.json
            # /app_id-page_id/page_id.json
            content_path = base_dir + '/external-apps/' + content_url.strip('/')
            content_file_name = os.path.basename(content_path)
            src_path = os.path.dirname(content_path)
            snapshot_content_path = os.path.join(src_path, 'single_record_page_backup_%s' % snapshot_id, content_file_name)
            content_file_id = seafile_api.get_file_id_by_path(repo_id, snapshot_content_path)

            if not content_file_id:
                single_record_pages[page_id] = empty_content
                continue
            token = seafile_api.get_fileserver_access_token(
                repo_id, content_file_id, 'download', '', use_onetime=False
            )
            url = gen_file_get_url(token, content_file_name)
            try:
                response = requests.get(url)
                single_record_pages[page_id] = response.json()
            except Exception as e:
                logger.warning('dtable: %s content_url: %s file url: %s error: %s', dtable_uuid, content_url, url, e)
                single_record_pages[page_id] = empty_content

    return single_record_pages


def backup_single_record_pages(app, repo_id, dtable_uuid, username, snapshot_id):
    app_config = json.loads(app.app_config)
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'single_record_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            # /app_id/page_id/page_id.json
            # /app_id-page_id/page_id.json
            content_path = base_dir + '/external-apps/' + content_url.strip('/')

            src_path = os.path.dirname(content_path)
            content_file_name = os.path.basename(content_path)
            dist_path = os.path.join(src_path, 'single_record_page_backup_%s' % snapshot_id)
            asset_id = seafile_api.get_file_id_by_path(repo_id, content_path)

            try:
                if asset_id:
                    seafile_api.mkdir_with_parents(repo_id, '/', dist_path[1:], '')
                    seafile_api.copy_file(repo_id, src_path, json.dumps([content_file_name]),
                                        repo_id, dist_path, json.dumps([content_file_name]),
                                        username=username, need_progress=0, synchronous=1)
            except Exception as e:
                logger.warning('fail to backup dtable: %s app: %s single record page: %s error: %s', dtable_uuid,
                               app.id, page_id, e)
                continue


def revert_single_record_pages(app, repo_id, dtable_uuid, username, snapshot_id):
    app_config = json.loads(app.app_config)
    app_settings = app_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'single_record_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            # /app_id/page_id/page_id.json
            # /app_id-page_id/page_id.json
            content_path = base_dir + '/external-apps/' + content_url.strip('/')

            dist_path = os.path.dirname(content_path)
            src_path = os.path.join(dist_path, 'single_record_page_backup_%s' % snapshot_id)
            content_file_name = os.path.basename(content_path)

            try:
                # seafile_api.mkdir_with_parents(repo_id, '/', dist_path[1:], '')
                src_file_path = os.path.join(src_path, content_file_name)
                asset_id = seafile_api.get_file_id_by_path(repo_id, content_path)
                backup_asset_id = seafile_api.get_file_id_by_path(repo_id, src_file_path)
                if not backup_asset_id:
                    logger.warning('backup asset not found: dtable: %s, app: %s, single record page: %s', dtable_uuid, app.id, page_id)
                    continue

                if asset_id:
                    seafile_api.del_file(repo_id, dist_path, json.dumps([content_file_name]), username)
                    seafile_api.copy_file(repo_id, src_path, json.dumps([content_file_name]),
                                        repo_id, dist_path, json.dumps([content_file_name]),
                                        username=username, need_progress=0, synchronous=1)
            except Exception as e:
                logger.warning('fail to revert dtable: %s app: %s single record page: %s error: %s', dtable_uuid,
                               app.id, page_id, e)
                continue


def delete_single_record_pages_backup_dir(app_snapshot_config, repo_id, dtable_uuid, username, snapshot_id):
    app_settings = app_snapshot_config.get('settings', {})
    app_pages = app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    for page in app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'single_record_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            # /app_id/page_id/page_id.json
            # /app_id-page_id/page_id.json
            content_path = base_dir + '/external-apps/' + content_url.strip('/')

            dir_path = os.path.dirname(content_path)
            file_path = os.path.join(dir_path, 'single_record_page_backup_%s' % snapshot_id)
            dir_name = os.path.basename(file_path)
            content_file_name = os.path.basename(content_path)

            try:
                # delete file in dir
                seafile_api.del_file(repo_id, file_path, json.dumps([content_file_name]), username)
                # delete dir
                seafile_api.del_file(repo_id, dir_path, json.dumps([dir_name]), username)

            except Exception as e:
                logger.warning('fail to delete dtable: %s app_snapshot: %s single record page: %s error: %s', dtable_uuid,
                               snapshot_id, page_id, e)
                continue


def duplicate_single_record_pages(old_app, repo_id, workspace_id, dtable_uuid, new_app, username):
    if old_app.app_type != 'universal-app':
        return new_app

    old_app_config = json.loads(old_app.app_config)
    old_app_settings = old_app_config.get('settings', {})
    old_app_pages = old_app_settings.get('pages', [])
    base_dir = '/asset/%s' % uuid_str_to_36_chars(dtable_uuid)
    new_page_id_content_path_map = {}
    for page in old_app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'single_record_page':
            content_url = page.get('content_url', '')
            if not content_url:
                continue

            # /app_id/page_id/page_id.json
            # /app_id-page_id/page_id.json
            content_path = base_dir + '/external-apps/' + content_url.strip('/')

            src_path = os.path.dirname(content_path)
            content_file_name = os.path.basename(content_path)
            content_file_tag = content_file_name.split('.')[0]
            content_file_id = seafile_api.get_file_id_by_path(repo_id, content_path)

            if not content_file_id:
                continue
            try:
                new_app_relative_path = 'external-apps/%s/%s' % (new_app.id, content_file_tag)

                # make new system dir
                new_app_path = os.path.join(base_dir, new_app_relative_path)
                seafile_api.mkdir_with_parents(repo_id, '/', new_app_path[1:], '')
                exist_files_names = [dirent.obj_name for dirent in seafile_api.list_dir_by_path(repo_id, src_path)]
                seafile_api.copy_file(repo_id, src_path, json.dumps(exist_files_names),
                                      repo_id, new_app_path, json.dumps(exist_files_names),
                                      username=username, need_progress=0, synchronous=1)

                # download page, update some assets path and upload
                token = seafile_api.get_fileserver_access_token(
                    repo_id, content_file_id, 'view', '', use_onetime=True
                )
                is_changed = False
                url = gen_inner_file_get_url(token, content_file_name)
                page_content = requests.get(url).json()
                elements = page_content.get('elements', [])
                for element in elements:
                    element_type = element.get('type', '')
                    if element_type == 'long_text':
                        # images in external-apps/form_long_text_image
                        dst_image_url_part = '%s/asset/%s/external-apps/form_long_text_image' % (str(workspace_id), uuid_str_to_36_chars(dtable_uuid))
                        element['value']['text'] = re.sub(r'\d+/asset/[-0-9a-f]{36}/external-apps/form_long_text_image', dst_image_url_part, element['value']['text'])
                        # images in external-apps/<app_id>/page_id
                        dst_image_url_part = '%s/asset/%s/external-apps/%s/%s' % (str(workspace_id), uuid_str_to_36_chars(dtable_uuid), new_app.id, page_id)
                        element['value']['text'] = re.sub(r'\d+/asset/[-0-9a-f]{36}/external-apps/\d+/\w+', dst_image_url_part, element['value']['text'])

                        is_changed = True

                if is_changed:
                    tmp_page_content_path = '/tmp/dtbale-io/%s-%s.json' % (new_app.id, page_id)
                    os.makedirs(os.path.dirname(tmp_page_content_path), exist_ok=True)
                    with open(tmp_page_content_path, 'w') as f:
                        json.dump(page_content, f)
                    seafile_api.put_file(repo_id, tmp_page_content_path, new_app_path, content_file_name, username, None)
                    os.remove(tmp_page_content_path)

                new_content_url = '/%s/%s/%s.json' % (new_app.id, content_file_tag, content_file_tag)
                new_page_id_content_path_map[page_id] = new_content_url
            except Exception as e:
                logger.warning('fail to duplicate dtable: %s app: %s single record page: %s error: %s', dtable_uuid, old_app.id, page_id, e)
                continue
    new_app_config = json.loads(new_app.app_config)
    new_app_settings = new_app_config.get('settings', {})
    new_app_pages = new_app_settings.get('pages', [])
    for page in new_app_pages:
        page_type = page.get('type', '')
        page_id = page.get('id', '')
        if page_type == 'single_record_page' and page_id in new_page_id_content_path_map:
            page['content_url'] = new_page_id_content_path_map[page_id]
    new_app.app_config = json.dumps(new_app_config)
    new_app.save()
    return new_app


def get_columns(table, view):
    if not table:
        return []
    table_columns = table.get('columns', [])
    if not view:
        return table_columns

    hidden_column_keys = view.get('hidden_columns', [])
    return [column for column in table_columns if column['key'] not in hidden_column_keys]


def calculate_columns_name(columns, columns_name):
    if not columns:
        return []
    new_columns_name = [column['name'] for column in columns]
    if not columns_name:
        return new_columns_name

    valid_columns_name = [column_name for column_name in columns_name if column_name in new_columns_name]
    for column_name in new_columns_name:
        if column_name not in valid_columns_name:
            valid_columns_name.append(column_name)
    return valid_columns_name

def get_common_user_info(username):
    avatar_url, _, _ = api_avatar_url(username)
    return {
        'email': username,
        'name': email2nickname(username),
        'avatar_url': avatar_url

    }

def check_app_user(app, username):
    from seahub.dtable_apps.universal_app.models import DTableAppUsers
    app_user = DTableAppUsers.objects.filter(
        app = app,
        username=username,
        is_active=True
    ).first()

    if not app_user:
        return None
    return app_user


class ValueEmptyError(Exception):


    def __init__(self, name):
        self.name = name

    def __str__(self):
        return "%s can not be empty" % self.name
    
class RowNotExistsError(Exception):

    def __init__(self, row_id):
        self.row_id = row_id

    def __str__(self):
        return "row %s does not exists in this page" % self.row_id



def is_archive_to_db(metadata: dict, app_config: dict, table_id: str):
    """
    judge whether new rows to table need to be archived to db
    """
    # base turn on enable_archive
    if not metadata.get('settings', {}).get('enable_archive'):
        return False

    # app_config turn on auto_archive_to_big_data
    if not app_config.get('auto_archive_to_big_data'):
        return False

    # table turn on auto archive
    return table_id in (app_config.get('auto_archive_table_ids') or [])


def get_archive_to_db_tables(metadata: dict, app_config: dict):
    """
    return tables whose new rows should be archived to db
    """
    # base turn on enable_archive
    if not metadata.get('settings', {}).get('enable_archive'):
        return []

    # app_config turn on auto_archive_to_big_data
    if not app_config.get('auto_archive_to_big_data'):
        return []

    table_ids = app_config.get('auto_archive_table_ids') or []
    return [table for table in metadata['tables'] if table['_id'] in table_ids]


def check_app_asset_permission(
    request,
    workspace,
    dtable,
    app,
    page,
    table,
    row_id,
    path,
    asset_id
):
    app_asset_can_access, app_asset_can_edit = True, True

    external_app_session = request.session.get('external_app')
    asset_access_token = external_app_session.get('asset_access_token')
    payload = jwt.decode(asset_access_token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])

    can_access, need_cache, _ = can_access_asset(request, workspace, dtable, path, asset_id)

    if not can_access:
        app_asset_can_access = False
        app_asset_can_edit = False
        return app_asset_can_access, app_asset_can_edit

    if need_cache:
        set_dtable_asset_cache_read_permission(request, str(dtable.uuid), asset_id)

    # 1. check user has edit row permission
    if not app_page_can_modify(payload, page):
        app_asset_can_edit = False

    # 2. check row id lock
    table_name = table['name']
    sql = f"SELECT `_locked`, `_id` FROM `{table_name}` WHERE _id='{row_id}'"
    dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
    rows = dtable_db_api.query(sql)['results']

    if not rows:
        app_asset_can_edit = False
        return app_asset_can_access, app_asset_can_edit
    else:
        row = rows[0]
        if row.get('_locked'):
            app_asset_can_edit = False

    return app_asset_can_access, app_asset_can_edit

import os
import jwt
import json
import time
import uuid
import logging
import posixpath
import requests
import io
import shutil
from zipfile import ZipFile, is_zipfile

from seaserv import seafile_api, USE_GO_FILESERVER

from seahub.settings import DTABLE_PRIVATE_KEY
from seahub.utils import normalize_file_path, gen_file_get_url, gen_file_upload_url, gen_inner_file_get_url, \
    get_inner_fileserver_root, uuid_str_to_36_chars
from seahub.utils.auth import AUTHORIZATION_PREFIX
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.seadoc.settings import SDOC_REVISIONS_DIR, SDOC_IMAGES_DIR, DOCUMENT_PLUGIN_FILE_RELATIVE_PATH, DOCUMENT_CONFIG_FILE_NAME
from seahub.dtable.models import CustomAssetUUID

logger = logging.getLogger(__name__)


def gen_seadoc_access_token(file_uuid, filename, username, permission='rw', default_title='untitled'):
    name = email2nickname(username)
    url, is_default, date_uploaded = api_avatar_url(username)

    access_token = jwt.encode({
        'file_uuid': file_uuid,
        'filename': filename,
        'username': username,
        'name': name,
        'avatar_url': url,
        'permission': permission,
        'default_title': default_title,
        'exp': int(time.time()) + 86400 * 3,  # 3 days
    },
        DTABLE_PRIVATE_KEY,
        algorithm='HS256'
    )
    return access_token


def is_valid_seadoc_access_token(auth, file_uuid, return_payload=False):
    """
    can decode a valid jwt payload
    """
    is_valid, payload = False, None
    if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
        return (is_valid, payload) if return_payload else is_valid

    token = auth[1]
    if not token or not file_uuid:
        return (is_valid, payload) if return_payload else is_valid

    try:
        payload = jwt.decode(token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except Exception as e:
        logger.error('Failed to decode jwt: %s' % e)
        is_valid = False
    else:
        file_uuid_in_payload = payload.get('file_uuid')

        if not file_uuid_in_payload:
            is_valid = False
        elif uuid_str_to_36_chars(file_uuid_in_payload) != uuid_str_to_36_chars(file_uuid):
            is_valid = False
        else:
            is_valid = True

    if return_payload:
        return is_valid, payload
    return is_valid


def get_seadoc_file_uuid(dtable_uuid, path):

    path = normalize_file_path(path)
    parent_dir = os.path.dirname(path)
    filename = os.path.basename(path)
    asset = CustomAssetUUID.objects.get_or_create_by_path(dtable_uuid, parent_dir.strip('/'), filename)

    file_uuid = str(asset.uuid)  # 36 chars str
    return file_uuid


def get_seadoc_upload_link(repo_id, asset, last_modify_user=''):
    parent_path = asset.parent_path
    dtable_uuid = asset.dtable_uuid
    file_uuid = asset.uuid
    base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

    # real parent path
    real_parent_path = posixpath.join(base_dir, parent_path)

    obj_id = json.dumps({'online_office_update': True, 'parent_dir': real_parent_path})
    token = seafile_api.get_fileserver_access_token(
        repo_id, obj_id, 'update', last_modify_user, use_onetime=True)
    if not token:
        return None
    upload_link = gen_file_upload_url(token, 'update-api')
    return upload_link


def get_seadoc_download_link(repo_id, asset, is_inner=False):
    filename = asset.file_name
    parent_path = asset.parent_path
    dtable_uuid = asset.dtable_uuid
    file_uuid = asset.uuid
    base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

    real_file_path = posixpath.join(base_dir, parent_path, filename)
    obj_id = seafile_api.get_file_id_by_path(repo_id, real_file_path)
    if not obj_id:
        return None
    token = seafile_api.get_fileserver_access_token(
        repo_id, obj_id, 'view', '', use_onetime=False)
    if not token:
        return None

    if is_inner:
        download_link = gen_inner_file_get_url(token, filename)
    else:
        download_link = gen_file_get_url(token, filename)

    return download_link


def gen_seadoc_image_parent_path(asset, repo_id, username):
    dtable_uuid = asset.dtable_uuid
    file_uuid = asset.uuid
    base_dir = gen_seadoc_base_dir(dtable_uuid, file_uuid)

    parent_path = os.path.join(base_dir + SDOC_IMAGES_DIR)
    dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_path)
    if not dir_id:
        seafile_api.mkdir_with_parents(repo_id, '/', parent_path[1:], username)
    return parent_path


def gen_seadoc_base_dir(dtable_uuid, file_uuid):
    return posixpath.join('/asset', dtable_uuid, DOCUMENT_PLUGIN_FILE_RELATIVE_PATH, str(file_uuid))


def get_seadoc_asset_upload_link(repo_id, parent_path, username):
    obj_id = json.dumps({'parent_dir': parent_path})
    token = seafile_api.get_fileserver_access_token(repo_id, obj_id, 'upload-link', '', use_onetime=False)
    if not token:
        return None
    upload_link = gen_file_upload_url(token, 'upload-api', True)
    return upload_link


def get_seadoc_asset_download_link(repo_id, parent_path, filename, username):
    file_path = posixpath.join(parent_path, filename)
    obj_id = seafile_api.get_file_id_by_path(repo_id, file_path)
    if not obj_id:
        return None
    token = seafile_api.get_fileserver_access_token(
        repo_id, obj_id, 'view', username, use_onetime=False)
    if not token:
        return None
    download_link = gen_file_get_url(token, filename)
    return download_link


def copy_sdoc_images_with_sdoc_uuid(src_repo_id, src_asset, dst_repo_id, dst_asset, username, is_async=True):
    """
    /asset/<dtable-uuid>/files/plugins/<plugins-name>/<doc-uuid>/images/
    """

    src_image_parent_path = gen_seadoc_image_parent_path(src_asset, src_repo_id, username)

    src_dir_id = seafile_api.get_dir_id_by_path(src_repo_id, src_image_parent_path)
    if not src_dir_id:
        return

    src_base_dir = gen_seadoc_base_dir(src_asset.dtable_uuid, src_asset.uuid)
    dst_base_dir = gen_seadoc_base_dir(dst_asset.dtable_uuid, dst_asset.uuid)

    if is_async:
        need_progress=1
        synchronous=0
    else:
        need_progress=0
        synchronous=1
    seafile_api.copy_file(
        src_repo_id, src_base_dir,
        json.dumps([SDOC_IMAGES_DIR.strip('/')]),
        dst_repo_id, dst_base_dir,
        json.dumps([SDOC_IMAGES_DIR.strip('/')]),
        username=username,
        need_progress=need_progress, synchronous=synchronous,
    )


def gen_document_cover_parent_path(asset, repo_id, username):
    """
    /asset/<dtable-uuid>/files/plugins/<plugins-name>/<doc-uuid>/doc-uuid.png
    """
    dtable_uuid = asset.dtable_uuid
    file_uuid = asset.uuid
    parent_path = gen_seadoc_base_dir(dtable_uuid, file_uuid)

    dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_path)
    if not dir_id:
        seafile_api.mkdir_with_parents(repo_id, '/', parent_path[1:], username)
    return parent_path


def copy_document_cover_with_sdoc_uuid(src_repo_id, src_asset, dst_repo_id, dst_asset, username, is_async=True):
    src_cover_parent_path = gen_document_cover_parent_path(src_asset, src_repo_id, username)
    src_dir_id = seafile_api.get_dir_id_by_path(src_repo_id, src_cover_parent_path)
    if not src_dir_id:
        return
    src_cover_name = str(src_asset.uuid) + '.png'
    src_cover_parent_path = gen_document_cover_parent_path(src_asset, src_repo_id, username=username)
    src_cover_path = os.path.join(src_cover_parent_path, src_cover_name)
    file_id = seafile_api.get_file_id_by_path(src_repo_id, src_cover_path)
    if not file_id:
        return
    dst_cover_parent_path = gen_document_cover_parent_path(dst_asset, dst_repo_id, username=username)
    dst_cover_name = str(dst_asset.uuid) + '.png'

    if is_async:
        need_progress = 1
        synchronous = 0
    else:
        need_progress = 0
        synchronous = 1
    seafile_api.copy_file(
        src_repo_id, src_cover_parent_path,
        json.dumps([src_cover_name]),
        dst_repo_id, dst_cover_parent_path,
        json.dumps([dst_cover_name]),
        username=username,
        need_progress=need_progress, synchronous=synchronous,
    )


def gen_document_base_dir(dtable_uuid):
    return posixpath.join('/asset', dtable_uuid, DOCUMENT_PLUGIN_FILE_RELATIVE_PATH)


def save_documents_config(repo_id, dtable_uuid, username, documents_config):
    document_plugin_dir = gen_document_base_dir(dtable_uuid)
    obj_id = json.dumps({'parent_dir': document_plugin_dir})

    dir_id = seafile_api.get_dir_id_by_path(repo_id, document_plugin_dir)
    if not dir_id:
        seafile_api.mkdir_with_parents(repo_id, '/', document_plugin_dir, username)

    token = seafile_api.get_fileserver_access_token(repo_id, obj_id, 'upload-link', '', use_onetime=False)
    if not token:
        raise Exception('upload token invalid')

    upload_link = gen_file_upload_url(token, 'upload-api')
    upload_link = upload_link + '?replace=1'

    files = {
        'file': (DOCUMENT_CONFIG_FILE_NAME, documents_config)
    }
    data = {'parent_dir': document_plugin_dir, 'relative_path': '', 'replace': 1}
    resp = requests.post(upload_link, files=files, data=data)
    if not resp.ok:
        raise Exception(resp.text)


def get_documents_config(repo_id, dtable_uuid, username):
    document_plugin_dir = gen_document_base_dir(dtable_uuid)
    config_path = posixpath.join(document_plugin_dir, DOCUMENT_CONFIG_FILE_NAME)
    file_id = seafile_api.get_file_id_by_path(repo_id, config_path)
    if not file_id:
        return []
    token = seafile_api.get_fileserver_access_token(repo_id, file_id, 'download', username, use_onetime=True)
    url = gen_inner_file_get_url(token, DOCUMENT_CONFIG_FILE_NAME)
    resp = requests.get(url)
    documents_config = json.loads(resp.content)
    return documents_config

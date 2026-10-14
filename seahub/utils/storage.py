import os
import json
import logging
from datetime import datetime, timezone

from django.utils.http import parse_etags
from django.http import FileResponse

from seahub.utils import mq, uuid_str_to_32_chars, uuid_str_to_36_chars
from seahub.utils.attachment_backend import (
    CONNECTION_ATTACHMENTS,
    PROJECT_ATTACHMENTS,
    FileNotFound,
    get_backend,
)

logger = logging.getLogger(__name__)
PORTAL_LOGO_FILE_PATH = 'portal/logo'
PORTAL_BACKGROUND_IMAGE_FILE_PATH = 'portal/background-image'
PROJECT_STORAGE_UPDATE_CHANNEL = 'project_storage_update'
INLINE_ATTACHMENT_CONTENT_TYPES = {
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.heic': 'image/heic',
    '.ico': 'image/x-icon',
    '.jfif': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp',
}


def publish_project_storage_update(project_uuid):
    if mq is None:
        logger.warning('Redis is unavailable; project storage update was not published')
        return
    try:
        payload = json.dumps({'project_uuid': uuid_str_to_32_chars(project_uuid)})
        mq.publish(PROJECT_STORAGE_UPDATE_CHANNEL, payload)
    except Exception as e:
        logger.warning('Failed to publish project storage update for project %s: %s', project_uuid, e)


def if_none_match_hit(request, etag):
    if_none_match = request.META.get('HTTP_IF_NONE_MATCH', '')
    if not if_none_match or not etag:
        return False

    def normalize(value):
        value = value.strip()
        if value.startswith('W/'):
            value = value[2:].strip()
        if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
            return value[1:-1]
        return value

    target = normalize(etag)
    for candidate in parse_etags(if_none_match):
        if candidate == '*':
            return True
        if normalize(candidate) == target:
            return True
    return False

def gen_project_file_path(project_uuid, file_path):
    project_uuid = uuid_str_to_36_chars(project_uuid)
    return f'/projects/{project_uuid}/{file_path}'


def gen_connection_file_path(project_uuid, connection_id, filename):
    project_uuid = uuid_str_to_32_chars(project_uuid)
    return f"{project_uuid}/{connection_id}/" + filename


def gen_record_file_path(entity_type, record_id, filename=''):
    parent_dir = 'portal' if entity_type == 'portal-issues' else 'attachments'
    return f'{parent_dir}/{entity_type}/{record_id}/{filename}'

def gen_tmp_upload_file_path(project_uuid, file_path):
    project_uuid = uuid_str_to_36_chars(project_uuid)
    tmp_upload_file_path = os.path.join('/tmp', 'projects', project_uuid, file_path)
    tmp_dir = os.path.dirname(tmp_upload_file_path)
    if not os.path.exists(tmp_dir):
        os.makedirs(tmp_dir, exist_ok=True)
    return tmp_upload_file_path


def upload_file_to_tmp_dir(project_uuid, file, subdir=''):
    subdir_prefix = (subdir.strip('/') + '/') if subdir else ''
    file_path = subdir_prefix + datetime.now(timezone.utc).strftime('%Y-%m') + '/' + file.name
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
    with open(tmp_upload_file_path, 'wb') as fd:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            fd.write(chunk)
    return tmp_upload_file_path


def upload_files(project_uuid, file_urls, username, entity_type, record_id):
    new_file_urls_dict = {}
    backend = get_backend()
    for file_url in file_urls:
        if '/upload-file/project/' not in file_url:
            continue
        file_name = os.path.basename(file_url)
        file_path = file_url.split('/')[-2] + '/' + file_name
        tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
        if not os.path.exists(tmp_upload_file_path):
            logger.warning(tmp_upload_file_path + ' not exists.')
            continue

        final_file_path = gen_record_file_path(entity_type, record_id, file_name)
        storage_path = gen_project_file_path(project_uuid, final_file_path)
        if check_file_exists(backend, PROJECT_ATTACHMENTS, storage_path):
            logger.warning(storage_path + ' already exists.')
            continue

        backend.upload_file_by_path(
            PROJECT_ATTACHMENTS, tmp_upload_file_path, storage_path,
            extra_args={'Metadata': {'username': username}},
        )
        publish_project_storage_update(project_uuid)

        new_file_url = f'/file/project/{project_uuid}/{final_file_path}'
        new_file_urls_dict[new_file_url] = file_url

        try:
            os.remove(tmp_upload_file_path)
        except Exception as e:
            logger.error(e)

    return new_file_urls_dict


def upload_portal_files(project_uuid, file_urls, username, entity_type, record_id):
    portal_prefix = f'/upload-file/portal/{project_uuid}/'
    new_file_urls_dict = {}
    backend = get_backend()
    for file_url in file_urls:
        if not isinstance(file_url, str) or not file_url.startswith(portal_prefix):
            continue
        file_name = os.path.basename(file_url)
        rel = file_url[len(portal_prefix):]
        tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, f'portal/{rel}')
        if not os.path.exists(tmp_upload_file_path):
            logger.warning(tmp_upload_file_path + ' not exists.')
            continue

        final_file_path = gen_record_file_path(entity_type, record_id, file_name)
        storage_path = gen_project_file_path(project_uuid, final_file_path)
        if check_file_exists(backend, PROJECT_ATTACHMENTS, storage_path):
            logger.warning(storage_path + ' already exists.')
            continue

        backend.upload_file_by_path(
            PROJECT_ATTACHMENTS, tmp_upload_file_path, storage_path,
            extra_args={'Metadata': {'username': username}},
        )
        publish_project_storage_update(project_uuid)

        new_file_url = f'/file/portal/{project_uuid}/{final_file_path}'
        new_file_urls_dict[new_file_url] = file_url

        try:
            os.remove(tmp_upload_file_path)
        except Exception as e:
            logger.error(e)

    return new_file_urls_dict


def upload_portal_logo_file(project_uuid, file):
    storage_path = gen_project_file_path(project_uuid, PORTAL_LOGO_FILE_PATH)
    content_type = getattr(file, 'content_type', None) or 'application/octet-stream'
    version = int(datetime.now(timezone.utc).timestamp())

    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + os.path.basename(PORTAL_LOGO_FILE_PATH)
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
    try:
        with open(tmp_upload_file_path, 'wb') as fd:
            fd.write(file.read())

        get_backend().upload_file_by_path(
            PROJECT_ATTACHMENTS, tmp_upload_file_path, storage_path,
            extra_args={'ContentType': content_type},
        )
        publish_project_storage_update(project_uuid)
    finally:
        if os.path.exists(tmp_upload_file_path):
            try:
                os.remove(tmp_upload_file_path)
            except Exception as e:
                logger.error(f"Failed to remove temp file: {e}")

    return f'/api/v1/portal/{project_uuid}/logo/?v={version}'


def upload_portal_background_image_file(project_uuid, file):
    storage_path = gen_project_file_path(project_uuid, PORTAL_BACKGROUND_IMAGE_FILE_PATH)
    content_type = getattr(file, 'content_type', None) or 'application/octet-stream'
    version = int(datetime.now(timezone.utc).timestamp())

    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + os.path.basename(PORTAL_BACKGROUND_IMAGE_FILE_PATH)
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
    try:
        with open(tmp_upload_file_path, 'wb') as fd:
            fd.write(file.read())

        get_backend().upload_file_by_path(
            PROJECT_ATTACHMENTS, tmp_upload_file_path, storage_path,
            extra_args={'ContentType': content_type},
        )
    finally:
        if os.path.exists(tmp_upload_file_path):
            try:
                os.remove(tmp_upload_file_path)
            except Exception as e:
                logger.error(f"Failed to remove temp file: {e}")

    return f'/api/v1/portal/{project_uuid}/background-image/?v={version}'


def check_file_exists(backend, attachment_type, path):
    try:
        backend.get_file_metadata(attachment_type, path)
        return True
    except FileNotFound:
        return False


def is_safe_inline_attachment(file_path, content_type=None):
    extension = os.path.splitext(file_path)[1].lower()
    if extension:
        expected_content_type = INLINE_ATTACHMENT_CONTENT_TYPES.get(extension)
        return expected_content_type is not None and content_type in (None, expected_content_type)
    return content_type in INLINE_ATTACHMENT_CONTENT_TYPES.values()


def get_attachment_file_response(file, file_path, content_type=None, force_download=False):
    safe_inline = is_safe_inline_attachment(file_path, content_type)
    as_attachment = force_download or not safe_inline
    inline_content_type = INLINE_ATTACHMENT_CONTENT_TYPES.get(
        os.path.splitext(file_path)[1].lower(), content_type
    )
    response = FileResponse(
        file,
        as_attachment=as_attachment,
        filename=os.path.basename(file_path) if as_attachment else None,
        content_type='application/octet-stream' if as_attachment else inline_content_type,
    )
    response['X-Content-Type-Options'] = 'nosniff'
    return response


def get_project_file(project_uuid, file_path):
    storage_path = gen_project_file_path(project_uuid, file_path)
    return get_backend().get_file_by_path(PROJECT_ATTACHMENTS, storage_path)


def get_project_file_metadata(project_uuid, file_path):
    storage_path = gen_project_file_path(project_uuid, file_path)
    return get_backend().get_file_metadata(PROJECT_ATTACHMENTS, storage_path)


def get_connection_file_metadata(project_uuid, site_id, filename):
    storage_path = gen_connection_file_path(project_uuid, site_id, filename)
    return get_backend().get_file_metadata(CONNECTION_ATTACHMENTS, storage_path)


def get_connection_file(project_uuid, connection_id, filename):
    storage_path = gen_connection_file_path(project_uuid, connection_id, filename)
    return get_backend().get_file_by_path(CONNECTION_ATTACHMENTS, storage_path)


def delete_file(project_uuid, file_path):
    storage_path = gen_project_file_path(project_uuid, file_path)
    get_backend().delete_file(PROJECT_ATTACHMENTS, storage_path)
    publish_project_storage_update(project_uuid)
    return storage_path


def delete_record_attachments(project_uuid, entity_type, record_id):
    prefix = gen_project_file_path(project_uuid, gen_record_file_path(entity_type, record_id))
    get_backend().delete_files_by_prefix(PROJECT_ATTACHMENTS, prefix)
    publish_project_storage_update(project_uuid)
    return prefix


def delete_project_attachments(project_uuid):
    prefix = gen_project_file_path(project_uuid, '')
    backend = get_backend()
    backend.delete_files_by_prefix(PROJECT_ATTACHMENTS, prefix)
    backend.delete_files_by_prefix(
        CONNECTION_ATTACHMENTS, gen_connection_file_path(project_uuid, '', '')
    )
    publish_project_storage_update(project_uuid)
    return prefix

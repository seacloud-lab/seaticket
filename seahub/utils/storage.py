import os
import json
import logging
from datetime import datetime, timezone

from botocore.exceptions import ClientError
from django.utils.http import parse_etags

from seahub.utils import mq, s3_client
from seahub.settings import S3_FILE_BUCKET, S3_WEB_CRAWL_BUCKET
from seahub.utils import uuid_str_to_32_chars, uuid_str_to_36_chars

logger = logging.getLogger(__name__)
PORTAL_LOGO_FILE_PATH = 'portal/logo'
PORTAL_BACKGROUND_IMAGE_FILE_PATH = 'portal/background-image'
PROJECT_STORAGE_UPDATE_CHANNEL = 'project_storage_update'


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

class FileNotFound(Exception):
    pass

def gen_s3_project_file_path(project_uuid, file_path):
    project_uuid = uuid_str_to_36_chars(project_uuid)
    return f'/projects/{project_uuid}/{file_path}'


def gen_s3_connection_file_path(project_uuid, connection_id, filename):
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


def upload_files_to_s3(project_uuid, file_urls, username, entity_type, record_id):
    new_file_urls_dict = {}
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
        s3_file_path = gen_s3_project_file_path(project_uuid, final_file_path)
        if check_file_exists_from_s3(s3_file_path):
            logger.warning(s3_file_path + ' already exists.')
            continue

        s3_client.upload_file(tmp_upload_file_path, S3_FILE_BUCKET, s3_file_path, ExtraArgs={'Metadata': {'username': username}})
        publish_project_storage_update(project_uuid)

        new_file_url = f'/file/project/{project_uuid}/{final_file_path}'
        new_file_urls_dict[new_file_url] = file_url

        try:
            os.remove(tmp_upload_file_path)
        except Exception as e:
            logger.error(e)

    return new_file_urls_dict


def upload_portal_files_to_s3(project_uuid, file_urls, username, entity_type, record_id):
    portal_prefix = f'/upload-file/portal/{project_uuid}/'
    new_file_urls_dict = {}
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
        s3_file_path = gen_s3_project_file_path(project_uuid, final_file_path)
        if check_file_exists_from_s3(s3_file_path):
            logger.warning(s3_file_path + ' already exists.')
            continue

        s3_client.upload_file(tmp_upload_file_path, S3_FILE_BUCKET, s3_file_path,
                              ExtraArgs={'Metadata': {'username': username}})
        publish_project_storage_update(project_uuid)

        new_file_url = f'/file/portal/{project_uuid}/{final_file_path}'
        new_file_urls_dict[new_file_url] = file_url

        try:
            os.remove(tmp_upload_file_path)
        except Exception as e:
            logger.error(e)

    return new_file_urls_dict


def upload_portal_logo_file_to_s3(project_uuid, file):
    s3_file_path = gen_s3_project_file_path(project_uuid, PORTAL_LOGO_FILE_PATH)
    content_type = getattr(file, 'content_type', None) or 'application/octet-stream'
    version = int(datetime.now(timezone.utc).timestamp())

    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + os.path.basename(PORTAL_LOGO_FILE_PATH)
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
    try:
        with open(tmp_upload_file_path, 'wb') as fd:
            fd.write(file.read())

        s3_client.upload_file(
            tmp_upload_file_path,
            S3_FILE_BUCKET,
            s3_file_path,
            ExtraArgs={'ContentType': content_type}
        )
        publish_project_storage_update(project_uuid)
    finally:
        if os.path.exists(tmp_upload_file_path):
            try:
                os.remove(tmp_upload_file_path)
            except Exception as e:
                logger.error(f"Failed to remove temp file: {e}")

    return f'/api/v1/portal/{project_uuid}/logo/?v={version}'


def upload_portal_background_image_file_to_s3(project_uuid, file):
    s3_file_path = gen_s3_project_file_path(project_uuid, PORTAL_BACKGROUND_IMAGE_FILE_PATH)
    content_type = getattr(file, 'content_type', None) or 'application/octet-stream'
    version = int(datetime.now(timezone.utc).timestamp())

    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + os.path.basename(PORTAL_BACKGROUND_IMAGE_FILE_PATH)
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
    try:
        with open(tmp_upload_file_path, 'wb') as fd:
            fd.write(file.read())

        s3_client.upload_file(
            tmp_upload_file_path,
            S3_FILE_BUCKET,
            s3_file_path,
            ExtraArgs={'ContentType': content_type}
        )
    finally:
        if os.path.exists(tmp_upload_file_path):
            try:
                os.remove(tmp_upload_file_path)
            except Exception as e:
                logger.error(f"Failed to remove temp file: {e}")

    return f'/api/v1/portal/{project_uuid}/background-image/?v={version}'


def check_file_exists_from_s3(s3_file_path):
    try:
        s3_client.head_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
        return True
    except Exception:
        return False


def get_project_file_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_project_file_path(project_uuid, file_path)
    response = s3_client.get_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
    return response['Body']


def get_project_file_head_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_project_file_path(project_uuid, file_path)
    try:
        return s3_client.head_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise FileNotFound()
        raise


def get_connection_file_head_from_s3(project_uuid, site_id, filename):
    s3_file_path = gen_s3_connection_file_path(project_uuid, site_id, filename)
    try:
        return s3_client.head_object(Bucket=S3_WEB_CRAWL_BUCKET, Key=s3_file_path)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise FileNotFound()
        raise


def get_connection_file_from_s3(project_uuid, connection_id, filename):
    s3_file_path = gen_s3_connection_file_path(project_uuid, connection_id, filename)
    try:
        response = s3_client.get_object(Bucket=S3_WEB_CRAWL_BUCKET, Key=s3_file_path)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise FileNotFound()
        raise
    return response['Body']


def delete_file_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_project_file_path(project_uuid, file_path)
    s3_client.delete_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
    publish_project_storage_update(project_uuid)
    return s3_file_path


def _delete_s3_prefix(prefix):
    continuation_token = None
    while True:
        kwargs = {'Bucket': S3_FILE_BUCKET, 'Prefix': prefix}
        if continuation_token:
            kwargs['ContinuationToken'] = continuation_token
        response = s3_client.list_objects_v2(**kwargs)
        contents = response.get('Contents') or []
        if contents:
            objects_to_delete = [{'Key': obj['Key']} for obj in contents]
            s3_client.delete_objects(Bucket=S3_FILE_BUCKET, Delete={'Objects': objects_to_delete})
        if response.get('IsTruncated'):
            continuation_token = response.get('NextContinuationToken')
            if not continuation_token:
                break
        else:
            break


def delete_record_attachments_from_s3(project_uuid, entity_type, record_id):
    prefix = gen_s3_project_file_path(project_uuid, gen_record_file_path(entity_type, record_id))
    _delete_s3_prefix(prefix)
    publish_project_storage_update(project_uuid)
    return prefix


def delete_project_dir_from_s3(project_uuid):
    s3_dir_path = gen_s3_project_file_path(project_uuid, '')
    _delete_s3_prefix(s3_dir_path)
    publish_project_storage_update(project_uuid)
    logger.info(f'Deleted {project_uuid} s3 files.')
    return s3_dir_path

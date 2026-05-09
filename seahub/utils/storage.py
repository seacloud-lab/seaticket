import os
import hashlib
import json
import logging
from datetime import datetime, timezone

from botocore.exceptions import ClientError

from seahub.utils import s3_client
from seahub.settings import S3_FILE_BUCKET, S3_WEB_CRAWL_BUCKET

logger = logging.getLogger(__name__)
PORTAL_LOGO_OBJECT_NAME = 'logo'


def gen_file_etag_cache_path(file_path):
    return f'{file_path}.etag'


def _build_file_etag(file_path):
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as fd:
        for chunk in iter(lambda: fd.read(1024 * 1024), b''):
            hasher.update(chunk)
    return f'"{hasher.hexdigest()}"'


def _write_file_etag_cache(file_path, etag):
    cache_path = gen_file_etag_cache_path(file_path)
    payload = {
        'etag': etag,
        'size': os.path.getsize(file_path),
        'mtime_ns': os.stat(file_path).st_mtime_ns,
    }
    tmp_cache_path = f'{cache_path}.tmp'
    with open(tmp_cache_path, 'w', encoding='utf-8') as fd:
        json.dump(payload, fd, separators=(',', ':'))
    os.replace(tmp_cache_path, cache_path)


def get_file_etag(file_path):
    stat_result = os.stat(file_path)
    cache_path = gen_file_etag_cache_path(file_path)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as fd:
                payload = json.load(fd)
            if (
                payload.get('size') == stat_result.st_size and
                payload.get('mtime_ns') == stat_result.st_mtime_ns and
                payload.get('etag')
            ):
                return payload['etag']
        except Exception:
            pass

    etag = _build_file_etag(file_path)
    _write_file_etag_cache(file_path, etag)
    return etag


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
    for candidate in (item.strip() for item in if_none_match.split(',') if item.strip()):
        if candidate == '*':
            return True
        if normalize(candidate) == target:
            return True
    return False


def gen_s3_file_path(project_uuid, file_path):
    return f'/projects/{project_uuid}/{file_path}'


def gen_s3_web_crawl_file_path(project_uuid, site_id, filename):
    return f"{project_uuid}/{site_id}/" + filename

def gen_portal_logo_file_path(filename=PORTAL_LOGO_OBJECT_NAME):
    return f'attachments/portal-logo/{filename}'

def gen_tmp_upload_file_path(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    file_name = os.path.basename(file_path)
    tmp_dir = f'/tmp{s3_file_path.replace(file_name, "")}'
    if not os.path.exists(tmp_dir):
        os.makedirs(tmp_dir, exist_ok=True)
    return os.path.join(tmp_dir, file_name)


def upload_file_to_tmp_dir(project_uuid, file):
    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + file.name
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
    hasher = hashlib.sha256()
    with open(tmp_upload_file_path, 'wb') as fd:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            hasher.update(chunk)
            fd.write(chunk)
    _write_file_etag_cache(tmp_upload_file_path, f'"{hasher.hexdigest()}"')
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

        final_file_path = f'attachments/{entity_type}/{record_id}/{file_name}'
        s3_file_path = gen_s3_file_path(project_uuid, final_file_path)
        if check_file_exists_from_s3(s3_file_path):
            logger.warning(s3_file_path + ' already exists.')
            continue

        s3_client.upload_file(tmp_upload_file_path, S3_FILE_BUCKET, s3_file_path, ExtraArgs={'Metadata': {'username': username}})

        new_file_url = f'/file/project/{project_uuid}/{final_file_path}'
        new_file_urls_dict[new_file_url] = file_url

        try:
            os.remove(tmp_upload_file_path)
        except Exception as e:
            logger.error(e)

    return new_file_urls_dict



def upload_portal_logo_file_to_s3(project_uuid, file):
    final_file_path = gen_portal_logo_file_path()
    s3_file_path = gen_s3_file_path(project_uuid, final_file_path)
    content_type = getattr(file, 'content_type', None) or 'application/octet-stream'
    version = int(datetime.now(timezone.utc).timestamp())

    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + PORTAL_LOGO_OBJECT_NAME
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

    return f'/api/v1/portal/{project_uuid}/logo/?v={version}'


def check_file_exists_from_s3(s3_file_path):
    try:
        s3_client.head_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
        return True
    except Exception:
        return False


def get_file_metadata_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    response = s3_client.head_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
    return {
        'ContentLength': response.get('ContentLength', 0),
        'ContentType': response.get('ContentType', ''),
        'LastModified': response.get('LastModified'),
        'ETag': response.get('ETag', ''),
    }


def get_file_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    response = s3_client.get_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
    return response['Body']


def get_file_from_s3_with_meta(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    return s3_client.get_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)


class FileNotFound(Exception):
    pass


def get_file_from_s3_web_crawl(project_uuid, site_id, filename):
    s3_file_path = gen_s3_web_crawl_file_path(project_uuid, site_id, filename)
    try:
        response = s3_client.get_object(Bucket=S3_WEB_CRAWL_BUCKET, Key=s3_file_path)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise FileNotFound()
        raise
    return response['Body']


def get_file_from_s3_web_crawl_with_meta(project_uuid, site_id, filename):
    s3_file_path = gen_s3_web_crawl_file_path(project_uuid, site_id, filename)
    try:
        return s3_client.get_object(Bucket=S3_WEB_CRAWL_BUCKET, Key=s3_file_path)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise FileNotFound()
        raise


def delete_file_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    s3_client.delete_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
    return s3_file_path


def _delete_s3_prefix(prefix):
    continuation_token = None
    while True:
        if prefix.startswith('/'):
            prefix = prefix.lstrip('/')
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
    prefix = gen_s3_file_path(project_uuid, f'attachments/{entity_type}/{record_id}/')
    _delete_s3_prefix(prefix)
    return prefix


def delete_project_dir_from_s3(project_uuid):
    s3_dir_path = gen_s3_file_path(project_uuid, '')
    _delete_s3_prefix(s3_dir_path)
    logger.info(f'Deleted {project_uuid} s3 files.')
    return s3_dir_path

import os
import hashlib
import logging
from datetime import datetime, timezone

from botocore.exceptions import ClientError

from seahub.utils import s3_client
from seahub.settings import S3_FILE_BUCKET, S3_WEB_CRAWL_BUCKET

logger = logging.getLogger(__name__)
PORTAL_LOGO_OBJECT_NAME = 'logo'


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
    with open(tmp_upload_file_path, 'wb') as fd:
        fd.write(file.read())
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


def calculate_md5(file_stream):
    md5_hash = hashlib.md5()
    # Read in chunks to handle large files without memory spikes
    for chunk in iter(lambda: file_stream.read(4096), b""):
        md5_hash.update(chunk)
    file_stream.seek(0)
    return f'"{md5_hash.hexdigest()}"'


def get_s3_file_metadata(s3_file_path):
    try:
        response = s3_client.head_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
        return response
    except s3_client.exceptions.ClientError as e:
        if e.response['Error']['Code'] == "404":
            return None
        raise e


def upload_portal_logo_file_to_s3(project_uuid, file, username):
    final_file_path = gen_portal_logo_file_path()
    s3_file_path = gen_s3_file_path(project_uuid, final_file_path)

    # Calculate local MD5 first
    local_etag = calculate_md5(file)
    version = local_etag.strip('"')

    # Check S3 Metadata
    metadata = get_s3_file_metadata(s3_file_path)

    # ETag Cache Detection: Skip upload if ETag matches
    if metadata and metadata.get('ETag') == local_etag:
        return f'/portal-logo/{project_uuid}/?v={version}'

    # Upload only if necessary
    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + PORTAL_LOGO_OBJECT_NAME
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)

    try:
        with open(tmp_upload_file_path, 'wb') as fd:
            fd.write(file.read())

        s3_client.upload_file(
            tmp_upload_file_path,
            S3_FILE_BUCKET,
            s3_file_path,
            ExtraArgs={'Metadata': {'username': username}}
        )
    finally:
        if os.path.exists(tmp_upload_file_path):
            try:
                os.remove(tmp_upload_file_path)
            except Exception as e:
                logger.error(f"Failed to remove temp file: {e}")

    return f'/portal-logo/{project_uuid}/?v={version}'


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

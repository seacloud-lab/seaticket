import os
import hashlib
import logging
from datetime import datetime, timezone

from botocore.exceptions import ClientError

from seahub.utils import s3_client
from seahub.settings import S3_FILE_BUCKET, S3_WEB_CRAWL_BUCKET

logger = logging.getLogger(__name__)


def gen_s3_file_path(project_uuid, file_path):
    return f'/projects/{project_uuid}/{file_path}'


def gen_s3_web_crawl_file_path(project_uuid, site_id, filename):
    return f"{project_uuid}/{site_id}/" + filename


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


def upload_files_to_s3(project_uuid, file_urls, username):
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
        s3_file_path = gen_s3_file_path(project_uuid, file_path)
        if check_file_exists_from_s3(s3_file_path):
            logger.warning(s3_file_path + ' already exists.')
            continue
        s3_client.upload_file(tmp_upload_file_path, S3_FILE_BUCKET, s3_file_path, ExtraArgs={'Metadata': {'username': username}})
        new_file_url = file_url.replace('/upload-file/', '/file/')
        new_file_urls_dict[new_file_url] = file_url
        try:
            os.remove(tmp_upload_file_path)
        except Exception as e:
            logger.error(e)
    return new_file_urls_dict


def check_file_exists_from_s3(s3_file_path):
    try:
        s3_client.head_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
        return True
    except Exception:
        return False


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


def delete_project_dir_from_s3(project_uuid):
    s3_dir_path = gen_s3_file_path(project_uuid, '')
    response = s3_client.list_objects_v2(Bucket=S3_FILE_BUCKET, Prefix=s3_dir_path)
    objects_to_delete = []
    if 'Contents' in response:
        for obj in response['Contents']:
            objects_to_delete.append({'Key': obj['Key']})
        s3_client.delete_objects(Bucket=S3_FILE_BUCKET, Delete={'Objects': objects_to_delete})
        logger.info(f'Deleted {project_uuid} s3 files.')
    return s3_dir_path

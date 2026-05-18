import logging

from botocore.exceptions import ClientError

from seaqa_io.utils import s3_client, uuid_str_to_32_chars
from seaqa_io.config import S3_WEB_CRAWL_BUCKET

logger = logging.getLogger(__name__)


def gen_s3_connection_file_path(project_uuid, site_id, filename):
    project_uuid = uuid_str_to_32_chars(project_uuid)
    return f"{project_uuid}/{site_id}/" + filename


class FileNotFound(Exception):
    pass


def get_connection_file_from_s3(project_uuid, site_id, filename):
    s3_file_path = gen_s3_connection_file_path(project_uuid, site_id, filename)
    response = s3_client.get_object(Bucket=S3_WEB_CRAWL_BUCKET, Key=s3_file_path)
    return response['Body']

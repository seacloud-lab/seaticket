import logging

from botocore.exceptions import ClientError

from seaqa_io.utils import s3_client
from seaqa_io.config import S3_WEB_CRAWL_BUCKET

logger = logging.getLogger(__name__)


def gen_s3_web_crawl_file_path(project_uuid, site_id, filename):
    return f"{project_uuid}/{site_id}/" + filename


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
        raise Exception(e)
    return response['Body']

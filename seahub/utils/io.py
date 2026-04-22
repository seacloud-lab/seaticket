import time
import logging
import jwt
import requests

from urllib.parse import urljoin
from django.conf import settings

from seahub.settings import SEAQA_IO_LOCAL_SERVER_URL


logger = logging.getLogger(__name__)


def _sign_auth_token():
    private_key = getattr(settings, 'JWT_PRIVATE_KEY', '')
    payload = {'exp': int(time.time()) + 300}
    return jwt.encode(payload, private_key, algorithm='HS256')


def convert_kb_view_to_excel(params):
    url = urljoin(SEAQA_IO_LOCAL_SERVER_URL, '/convert-kb-view-to-excel')
    headers = {"Authorization": "Token %s" % _sign_auth_token()}
    resp = requests.post(url, json=params, headers=headers)
    if not resp.ok:
        logger.error(resp.text)
        raise Exception('convert kb view to excel error')
    return resp.json().get('task_id')


def query_io_task_status(task_id):
    url = urljoin(SEAQA_IO_LOCAL_SERVER_URL, '/io-task-status')
    headers = {"Authorization": "Token %s" % _sign_auth_token()}
    resp = requests.get(url, params={'task_id': task_id}, headers=headers)
    return resp


def import_kb_from_excel(params):
    url = urljoin(SEAQA_IO_LOCAL_SERVER_URL, '/import-kb-from-excel')
    headers = {"Authorization": "Token %s" % _sign_auth_token()}
    resp = requests.post(url, json=params, headers=headers)
    if not resp.ok:
        logger.error(resp.text)
        raise Exception('import kb from excel error')
    return resp.json().get('task_id')


def zip_email_attachments(params):
    url = urljoin(SEAQA_IO_LOCAL_SERVER_URL, '/zip-email-attachments')
    headers = {"Authorization": "Token %s" % _sign_auth_token()}
    resp = requests.post(url, json=params, headers=headers)
    if not resp.ok:
        logger.error(resp.text)
        raise Exception('zip email attachments error')
    return resp.json().get('task_id')

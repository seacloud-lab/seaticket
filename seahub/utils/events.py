import logging
import time

import jwt
import requests
from urllib.parse import urljoin

from seahub.settings import SEAQA_IO_LOCAL_SERVER_URL, JWT_PRIVATE_KEY

logger = logging.getLogger(__name__)

class TaskConflictError(Exception):
    pass

def _build_headers():
    payload = {'exp': int(time.time()) + 300}
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    return {"Authorization": f'Token {token}'}

def submit_embedding_analysis_task(params):
    headers = _build_headers()
    url = urljoin(SEAQA_IO_LOCAL_SERVER_URL, '/add-embedding-analysis-task')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 409:
        raise TaskConflictError(resp.text)
    if resp.status_code == 500:
        raise Exception(f'submit embedding analysis task error status: {resp.status_code} body: {resp.text}')
    response_data = resp.json()
    task_id = response_data.get('task_id')
    if not task_id:
        logger.error('No task_id returned from seaqa-io')
        raise Exception('Failed to submit analysis task.')
    return task_id


def get_embedding_analysis_task_status(task_id):
    headers = _build_headers()
    url = urljoin(SEAQA_IO_LOCAL_SERVER_URL, '/embedding-analysis-task-status')
    params = {'task_id': task_id}
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code == 500:
        raise Exception(f'get embedding analysis task status error status: {resp.status_code} body: {resp.text}')
    response_data = resp.json()
    is_finished = response_data.get('is_finished')
    records = response_data.get('records', [])
    return {
        'is_finished': is_finished,
        'records': records
    }

import json
import time

import jwt
import requests
from urllib.parse import urljoin

from seahub.settings import SEAQA_INDEXER_INNER_SERVER_URL, JWT_PRIVATE_KEY


def _build_headers():
    payload = {'exp': int(time.time()) + 300}
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    return {"Authorization": f'Token {token}'}


def add_connection_sync_task(params):
    headers = _build_headers()
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/add-connection-sync-task')
    resp = requests.get(url, params=params, headers=headers)
    return json.loads(resp.content)


def manual_sync_connection(params):
    headers = _build_headers()
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/manual-sync-connection')
    resp = requests.post(url, json=params, headers=headers)
    return json.loads(resp.content), resp.status_code


def keyword_search(params):
    headers = _build_headers()
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/search/keyword')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'search error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    return resp_json.get('results')

def vector_search(params):
    headers = _build_headers()
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/search/vector')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'find related records error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    return resp_json.get('results')

def vector_search_with_text(params):
    headers = _build_headers()
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/search/vector-from-text')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'search error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    return resp_json.get('results')

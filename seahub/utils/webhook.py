import time

import jwt
import requests
from urllib.parse import urljoin

from seahub.settings import SEAQA_INDEXER_INNER_SERVER_URL, JWT_PRIVATE_KEY


def _build_headers(extra_headers=None):
    payload = {'exp': int(time.time()) + 300}
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": f'Token {token}'}
    if extra_headers:
        headers.update(extra_headers)
    return headers


def update_github_issue_by_webhook(params):
    headers = _build_headers()
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/webhook/github/')
    resp = requests.post(url, json=params, headers=headers)
    resp.raise_for_status()
    return resp


def update_discourse_topic_by_webhook(params):
    connection_id = params.get('connection_id')
    data = params.get('data')
    event_type = params.get('event_type')
    headers = _build_headers({
        "X-Discourse-Event": event_type,
    })
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/webhook/discourse/')
    query_params = {'connection_id': connection_id}
    resp = requests.post(
        url,
        params=query_params,
        json=data,
        headers=headers,
    )
    resp.raise_for_status()
    return resp

import logging
import time

import jwt
import requests
from urllib.parse import urljoin

from seahub.chats.constants import AI_REPLY_TIMEOUT
from seahub.settings import SEAQA_AI_INNER_SERVER_URL, JWT_PRIVATE_KEY

logger = logging.getLogger(__name__)


def _build_headers():
    payload = {'exp': int(time.time()) + 300}
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    return {"Authorization": f'Token {token}'}


def convert_record_to_ticket(params):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/convert-record-to-ticket')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'convert record to ticket error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    title = resp_json.get('title', '')
    content = resp_json.get('description', '')
    return title, content


def convert_ticket_to_kb_record(params):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/convert-ticket-to-kb-record')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'convert ticket to kb record error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    kb_title = resp_json.get('kb_title', '')
    kb_content = resp_json.get('kb_content', '')
    return kb_title, kb_content


def rank_related_records(params):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/rank-related-records')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'rank related records error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    ranked_ids = resp_json.get('ranked_ids', [])
    return ranked_ids


def get_chat_title(params):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/generate-chat-title')
    resp = requests.post(url, json=params, headers=headers, timeout=AI_REPLY_TIMEOUT)
    if resp.status_code != 200:
        raise Exception(f'generate chat title error status: {resp.status_code} body: {resp.text}')
    return resp.json().get('title', '')


def validate_chat_input(params):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/validate-chat-input')
    resp = requests.post(url, json=params, headers=headers, timeout=AI_REPLY_TIMEOUT)
    if resp.status_code != 200:
        raise Exception(f'validate chat input error status: {resp.status_code} body: {resp.text}')

    result = resp.json()
    if not isinstance(result, dict) or not isinstance(result.get('valid'), bool) or not isinstance(result.get('reason'), str):
        raise Exception('validate chat input returned an invalid response')
    if result['valid'] and result['reason']:
        raise Exception('validate chat input returned an invalid allowed response')
    if not result['valid'] and not result['reason']:
        raise Exception('validate chat input returned an invalid rejected response')
    return result


def list_builtin_skills():
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/internal/skills/builtins')
    resp = requests.get(url, headers=headers, timeout=AI_REPLY_TIMEOUT)
    if resp.status_code != 200:
        raise Exception(f'list builtin skills error status: {resp.status_code} body: {resp.text}')
    return resp.json().get('skills', [])


def get_builtin_skill(name):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, f'/internal/skills/builtins/{name}')
    resp = requests.get(url, headers=headers, timeout=AI_REPLY_TIMEOUT)
    if resp.status_code == 404:
        return None
    if resp.status_code != 200:
        raise Exception(f'get builtin skill error status: {resp.status_code} body: {resp.text}')
    return resp.json().get('skill')


def parse_skill(content, expected_name=None):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/internal/skills/parse')
    payload = {'content': content}
    if expected_name:
        payload['expected_name'] = expected_name
    resp = requests.post(url, json=payload, headers=headers, timeout=AI_REPLY_TIMEOUT)
    if resp.status_code == 400:
        error_msg = resp.json().get('error_msg', 'Invalid skill content.')
        raise ValueError(error_msg)
    if resp.status_code != 200:
        raise Exception(f'parse skill error status: {resp.status_code} body: {resp.text}')
    return resp.json().get('skill')

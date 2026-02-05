import logging
import time

import jwt
import requests
from urllib.parse import urljoin

from seahub.settings import SEAQA_AI_INNER_SERVER_URL, SEAQA_EVENTS_INNER_SERVER_URL, JWT_PRIVATE_KEY

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


def rank_related_issues(params):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/rank-related-issues')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'rank related records error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    ranked_ids = resp_json.get('ranked_ids', [])
    return ranked_ids


# ── Agent APIs ────────────────────────────────────────────────────

def list_agent_runs(project_uuid, page=1, per_page=50):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/agent/runs/')
    resp = requests.get(url, params={
        'project_uuid': project_uuid, 'page': page, 'per_page': per_page
    }, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise Exception(f'list agent runs error status: {resp.status_code} body: {resp.text}')
    return resp.json()


def get_agent_run_detail(project_uuid, run_id):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, f'/agent/runs/{run_id}/')
    resp = requests.get(url, params={'project_uuid': project_uuid}, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise Exception(f'get agent run detail error status: {resp.status_code} body: {resp.text}')
    return resp.json()

def trigger_agent(project_uuid):
    headers = _build_headers()
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/agent/trigger/')
    data = {'project_uuid': project_uuid}
    resp = requests.post(url, json=data, headers=headers, timeout=300)
    if resp.status_code != 200:
        raise Exception(f'trigger agent error status: {resp.status_code} body: {resp.text}')
    return resp.json()

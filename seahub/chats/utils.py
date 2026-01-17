# -*- coding: utf-8 -*-
import logging
import json

import requests
import jwt
import uuid
import time
from urllib.parse import urljoin
from seahub.chats.models import ChatToolCalls
from seahub.settings import JWT_PRIVATE_KEY, SEAQA_AI_INNER_SERVER_URL
from seahub.knowledge_base.knowledge_base_utils import get_whole_knowledge_bases_data
from seahub.tickets.ticket_utils import get_whole_tickets_data
from seahub.seadb_models.site_seadb_api import SiteSeaDBAPI
from seahub.seadb_models.seafile_seadb_api import SeafileSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.project.constants import ConnectionType, ExtraSourceType

logger = logging.getLogger(__name__)

def format_thought_process(tool_calls):
    results = {
        'actions': [],
        'final_answer': {},
    }

    actions_input_tokens = 0
    actions_output_tokens = 0
    actions_total_tokens = 0
    answer_input_tokens = 0
    answer_output_tokens = 0
    answer_total_tokens = 0

    for tool_call in tool_calls.values():
        if 'is_final_answer' in tool_call and tool_call['is_final_answer']:
            result = tool_call.get('result', '')
            if not isinstance(result, str):
                result = '```json\n' + json.dumps(result, indent=4, ensure_ascii=False) + '\n```'
            results['final_answer'] = {
                'result': result,
                'reach_max_steps': tool_call.get('reach_max_steps', False)
            }

            if 'static' in tool_call:
                token_usage = tool_call['static'].get('token_usage', {})
                input_tokens = token_usage.get('input_tokens', 0)
                output_tokens = token_usage.get('output_tokens', 0)
                total_tokens = token_usage.get('total_tokens', 0)
                answer_input_tokens += input_tokens
                answer_output_tokens += output_tokens
                answer_total_tokens += total_tokens
                results['final_answer']['token_usage'] = {
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'total_tokens': total_tokens
                }
        else:
            # action steps
            observation = ''
            new_substeps = []
            for substep in tool_call.get('substeps', []):
                output = substep.get('output', '')
                if not isinstance(output, str):
                    output = '```json\n' + json.dumps(output, indent=4, ensure_ascii=False) + '\n```'
                new_substeps.append({
                    'name': substep['name'],
                    'arguments': substep['arguments']
                })
                observation += output + '\n'

            results['actions'].append({
                'tool_calls': new_substeps,
                'result': observation[:-1] if observation else '',
            })

            if 'static' in tool_call:
                token_usage = tool_call['static'].get('token_usage', {})
                input_tokens = token_usage.get('input_tokens', 0)
                output_tokens = token_usage.get('output_tokens', 0)
                total_tokens = token_usage.get('total_tokens', 0)
                actions_input_tokens += input_tokens
                actions_output_tokens += output_tokens
                actions_total_tokens += total_tokens
                results['actions'][-1]['token_usage'] = {
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'total_tokens': total_tokens
                }
    
    if actions_input_tokens or actions_output_tokens or actions_total_tokens or answer_input_tokens or answer_output_tokens or answer_total_tokens:
        results['static'] = {
            'token_usage': {
                'input_tokens': {
                    'action_steps': actions_input_tokens,
                    'answer_generation': answer_input_tokens,
                    'total': actions_input_tokens + answer_input_tokens
                },
                'output_tokens': {
                    'action_steps': actions_output_tokens,
                    'answer_generation': answer_output_tokens,
                    'total': actions_output_tokens + answer_output_tokens
                },
                'total_tokens': {
                    'action_steps': actions_total_tokens,
                    'answer_generation': answer_total_tokens,
                    'total': actions_total_tokens + answer_total_tokens
                }
            }
        }

    return results


def get_ai_reply(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/get-ai-reply')
    resp = requests.post(url, json=params, headers=headers, timeout=180)
    if resp.status_code == 500:
        raise Exception('ask ai error status: %s body: %s', resp.status_code, resp.text)
    resp_json = resp.json()
    return {
        'ai_reply': resp_json.get('answer', ''),
        'sources': resp_json.get('sources', []),
        'thought_process': resp_json.get('thought_process', {})
    }


def gen_message_id(session_uuid, max_try=5):
    trying = 0
    new_message_id = ''
    while not new_message_id and trying < max_try:
        try_message_id = uuid.uuid4().hex[:4]
        if ChatToolCalls.objects.filter(session_uuid=session_uuid, message_id=try_message_id).count() == 0:
            new_message_id = try_message_id
        trying += 1

    if trying == max_try:
        raise Exception(f'Failure to generate message_id')

    return new_message_id

def get_attachments(seadb_api, project_uuid, attachments):
    knowledge_base_ids = []
    site_documents = []
    seafile_documents = []
    ticket_ids = []
    github_issues = []
    discourse_issues = []
    email_issues = []

    for attachment in attachments:
        try:
            record_id = int(attachment.get('record_id', -1))
        except:
            continue
        if record_id < 0:
            continue

        # documents
        if attachment.get('type') == ExtraSourceType.KNOWLEDGE_BASE.value:
            knowledge_base_ids.append(record_id)
        elif attachment.get('type') == ConnectionType.SITE.value:
            site_documents.append(attachment)
        elif attachment.get('type') == ConnectionType.SEAFILE.value:
            seafile_documents.append(attachment)
        
        # issues
        elif attachment.get('type') == ExtraSourceType.TICKET.value:
            ticket_ids.append(record_id)
        elif attachment.get('type') == ConnectionType.GITHUB_ISSUE.value:
            github_issues.append(attachment)
        elif attachment.get('type') == ConnectionType.EMAIL.value:
            email_issues.append(attachment)
        elif attachment.get('type') == ConnectionType.DISCOURSE_FORUM.value:
            discourse_issues.append(attachment)

    results = []
    ## documents
    if knowledge_base_ids:
        results += get_whole_knowledge_bases_data(seadb_api, project_uuid, knowledge_base_ids)
    
    if site_documents:
        site_seadb_api = SiteSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += site_seadb_api.get_whole_sites_data(project_uuid, site_documents)
    
    if seafile_documents:
        seafile_seadb_api = SeafileSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += seafile_seadb_api.get_whole_seafiles_data(seafile_documents)

    ## issues
    if ticket_ids:
        results += get_whole_tickets_data(seadb_api, project_uuid, ticket_ids)

    if github_issues:
        github_seadb_api = GitHubSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += github_seadb_api.get_whole_github_issue_data(github_issues)

    if email_issues:
        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += email_seadb_api.get_whole_email_data(email_issues)

    if discourse_issues:
        discourse_seadb_api = DiscourseSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += discourse_seadb_api.get_whole_discourse_data(discourse_issues)
    
    return results

def remove_content_details_in_attachments(attachments):
    for attachment in attachments:
        try:
            del attachment['content']
        except:
            pass

        try:
            del attachment['comments']
        except:
            pass

        try:
            del attachment['emails']
        except:
            pass
    
    return attachments

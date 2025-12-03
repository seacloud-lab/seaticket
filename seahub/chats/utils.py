# -*- coding: utf-8 -*-
import logging
import json

import requests
import jwt
import uuid
import time
from urllib.parse import urljoin
from seahub.chats.models import ChatMessages, ChatToolCalls, ChatSessions
from seahub.settings import JWT_PRIVATE_KEY, SEAQA_AI_INNER_SERVER_URL

logger = logging.getLogger(__name__)


def delete_session(session_uuid):
    try:
        ChatMessages.objects.filter(session_uuid=session_uuid).delete()
        ChatToolCalls.objects.filter(session_uuid=session_uuid).delete()
        ChatSessions.objects.filter(session_uuid=session_uuid).delete()
        return True
    except Exception as e:
        logger.error('delete session: %s error: %s', str(session_uuid), e)
        return False


def format_ask_thought_process(tool_calls):
    results = {
        'tool_calls': [],
        'result': ''
    }
    for tool_call_id, tool_call in tool_calls.items():
        if tool_call_id == 'result':
            if not isinstance(tool_call, str):
                tool_call = '```json\n' + json.dumps(tool_call, indent=4, ensure_ascii=False) + '\n```'
            results['result'] = tool_call
        else:
            for substep in tool_call.get('substeps', []):
                if not isinstance(substep['output'], str):
                    output = '```json\n' + json.dumps(substep['output'], indent=4, ensure_ascii=False) + '\n```'
                    substep['output'] = output
                results['tool_calls'].append(substep)
    return results


def format_agent_thought_process(tool_calls):
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
    resp = requests.post(url, json=params, headers=headers)
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

def format_extra_contents(extra_contents):
    new_extra_contents = []
    for extra_content in extra_contents:
        if extra_content['type'] == 'ticket':
            new_extra_contents.append({
                'type': extra_content['type'],
                'ticket_id': extra_content['ticket_id'],
                'title': extra_content['title']
            })
        elif extra_content['type'] == 'issue':
            new_extra_contents.append({
                'type': extra_content['type'],
                'issue_id': extra_content['issue_id'],
                'connection_id': extra_content['connection_id'],
                'state': extra_content['state'],
                'title': extra_content['title']
            })
    return new_extra_contents

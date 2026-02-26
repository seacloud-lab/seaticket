# -*- coding: utf-8 -*-
import logging
import json
import requests
import jwt
import uuid
import time
from django.core.cache import cache
from urllib.parse import urljoin
from seahub.chats.constants import AI_REPLY_TIMEOUT
from seahub.chats.models import ChatMessageThoughtProcess, ChatMessages
from seahub.settings import JWT_PRIVATE_KEY, SEAQA_AI_INNER_SERVER_URL
from seahub.knowledge_base.knowledge_base_utils import get_whole_knowledge_bases_data
from seahub.tickets.ticket_utils import get_whole_tickets_data
from seahub.seadb_models.site_seadb_api import SiteSeaDBAPI
from seahub.seadb_models.seafile_seadb_api import SeafileSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.project.constants import ConnectionType, ExtraSourceType
from seahub.utils import mq

logger = logging.getLogger(__name__)

def gen_chat_task_id(session_uuid):
    return f"chat_{session_uuid.replace('-', '')}"

def gen_message_id(session_uuid, max_try=5):
    trying = 0
    new_message_id = ''
    while not new_message_id and trying < max_try:
        try_message_id = uuid.uuid4().hex[:4]
        if ChatMessageThoughtProcess.objects.filter(session_uuid=session_uuid, message_id=try_message_id).count() == 0:
            new_message_id = try_message_id
        trying += 1

    if trying == max_try:
        raise Exception(f'Failure to generate message_id')

    return new_message_id

def record_message_to_db(ai_result, username, session_uuid, message_id, query, attachments):
    if 'ai_reply' not in ai_result:
        ai_result['ai_reply'] = ai_result.get('answer', '')
    
    ai_result.pop('answer', None)
    ai_result.update({
        'session_uuid': session_uuid,
        'attachments': remove_content_details_in_attachments(attachments)
    })

    try:
        ChatMessageThoughtProcess.objects.create_thought_process(session_uuid, message_id, ai_result.get('thought_process', {}))
        user_message = ChatMessages.objects.create_message(session_uuid, message_id, username, 'user', query, attachments=attachments)
        ai_reply_message = ChatMessages.objects.create_message(session_uuid, message_id, username, 'assistant', ai_result['ai_reply'], sources=json.dumps(ai_result['sources']))
        ai_result.update({
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id
        })
    except Exception as e:
        logger.warning(f'Failure to record messages to db: {e}')

    return ai_result

def process_stream_ai_reply(chat_task_id_info, ai_response, username, session_uuid, message_id, query, attachments):
    has_recorded_result = False
    try:
        for line in ai_response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if not line_str.startswith('data:'):
                    line_str = f"data: {line_str}"
                content = line_str[len('data: '):]
                # use if - else instead of json.loads() to avoid performance issues
                if content.startswith('{"results": ') and content.endswith('}'):
                    results = json.loads(content)['results']
                    item = f'data: {json.dumps({
                        "results": record_message_to_db(results, username, session_uuid, message_id, query, attachments)
                    })}\n\n'
                    has_recorded_result = True
                else:
                    if not line_str.endswith('\n\n'):
                        line_str += '\n\n'
                    item = line_str
                try:
                    yield item
                except: # continues to receive data even client interrupts the stream
                    continue
    except Exception as e:
        logger.exception(f'Streaming response is interrupted: {e}')
        if not has_recorded_result:
            item = f'data: {json.dumps({
                "results": record_message_to_db({
                    "ai_reply": "There is an issue with the AI server or web server (internal server error), please try again later",
                    "sources": []
                }, username, session_uuid, message_id, query, attachments)
            })}\n\n'
            try:
                yield item
            except:
                pass
        try:
            yield 'data: [DONE]\n\n'
        except:
            pass
    cache.delete(chat_task_id_info)

def get_ai_reply(params):
    payload = {'exp': int(time.time()) + AI_REPLY_TIMEOUT, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/get-ai-reply')

    if params.get('stream', False):
        resp =  requests.post(
            url,
            json=params,
            headers=headers,
            stream=True,
            timeout=AI_REPLY_TIMEOUT # for stream output, the timeout can down to 30
        )
        if resp.status_code == 500:
            raise Exception('ask ai error status: %s body: %s', resp.status_code, resp.text)
        return resp
    else:
        resp = requests.post(url, json=params, headers=headers, timeout=AI_REPLY_TIMEOUT)
        if resp.status_code == 500:
            raise Exception('ask ai error status: %s body: %s', resp.status_code, resp.text)
        resp_json = resp.json()
        return {
            'ai_reply': resp_json.get('answer', ''),
            'sources': resp_json.get('sources', []),
            'thought_process': resp_json.get('thought_process', {})
        }

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

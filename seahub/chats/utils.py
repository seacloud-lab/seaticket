# -*- coding: utf-8 -*-
import logging
import json

import requests
import jwt
import uuid
import time
from urllib.parse import urljoin
from seahub.chats.models import ChatMessageThoughtProcess
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
        if ChatMessageThoughtProcess.objects.filter(session_uuid=session_uuid, message_id=try_message_id).count() == 0:
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
            record_id = int(attachment.get('_id', -1))
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

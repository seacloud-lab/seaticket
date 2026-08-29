# -*- coding: utf-8 -*-
import os
import base64
import logging
import json
import mimetypes
import requests
import jwt
import uuid
import time
from copy import deepcopy
from django.core.cache import cache
from urllib.parse import urljoin
from trafilatura import extract
from bs4 import BeautifulSoup
from seahub.chats.constants import AI_REPLY_TIMEOUT
from seahub.chats.models import ChatMessageThoughtProcess, ChatMessages, ChatSessions
from seahub.portal.models import PortalChatSessions
from seahub.settings import JWT_PRIVATE_KEY, SEAQA_AI_INNER_SERVER_URL
from seahub.knowledge_base.knowledge_base_utils import get_whole_knowledge_bases_data
from seahub.tickets.ticket_utils import get_whole_tickets_data
from seahub.seadb_models.site_seadb_api import SiteSeaDBAPI
from seahub.seadb_models.seafile_seadb_api import SeafileSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.jira_seadb_api import JiraSeaDBAPI
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.seadb_models.general_task_seadb_api import GeneralTaskSeaDBAPI
from seahub.utils.ai_client import get_chat_title
from seahub.utils.storage import get_project_file_from_s3
from seahub.chats.constants import CHAT_IMAGE_MAX_COUNT, CHAT_PAGE_CONTENT_MAX_COUNT
from seahub.project.constants import ConnectionType, ExtraSourceType, AIScenario
from seahub.project.utils import parse_webpage_url

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

def record_message_to_db(ai_result, session_uuid, message_id, query, attachments):
    if 'ai_reply' not in ai_result:
        ai_result['ai_reply'] = ai_result.get('answer', '')

    ai_result.pop('answer', None)
    ai_result.update({
        'session_uuid': session_uuid,
        'attachments': strip_content_details_from_attachments(attachments)
    })

    try:
        thought_process = ai_result.get('thought_process', {})
        if thought_process:
            ChatMessageThoughtProcess.objects.create_thought_process(session_uuid, message_id, thought_process)
        user_message = ChatMessages.objects.create_message(session_uuid, message_id, 'user', query, attachments=ai_result['attachments'])
        ai_reply_message = ChatMessages.objects.create_message(session_uuid, message_id, 'assistant', ai_result['ai_reply'], sources=json.dumps(ai_result['sources']))
        ai_result.update({
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id
        })
    except Exception as e:
        logger.warning(f'Failure to record messages to db: {e}')

    return ai_result

def process_stream_ai_reply(chat_task_id_info, ai_response, session_uuid, message_id, query, attachments):
    has_recorded_result = False
    enconter_generator_exit = False
    error_msg = None
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
                        "results": record_message_to_db(results, session_uuid, message_id, query, attachments)
                    })}\n\n'
                    has_recorded_result = True
                elif content.startswith('[ERROR: ') and content.endswith(']'):
                    error_msg = content[1:-1]
                    item = f'data: {json.dumps({
                        "results": record_message_to_db(error_msg, session_uuid, message_id, query, attachments)
                    })}\n\n'
                    has_recorded_result = True
                else:
                    if not line_str.endswith('\n\n'):
                        line_str += '\n\n'
                    item = line_str
                if not enconter_generator_exit:
                    try:
                        yield item
                    except GeneratorExit:
                        enconter_generator_exit = True
                        continue
                if error_msg:
                    raise ConnectionError(error_msg)
    except Exception as e:
        logger.exception(f'Streaming response is interrupted: {e}')
        if not has_recorded_result:
            item = f'data: {json.dumps({
                "results": record_message_to_db({
                    "ai_reply": "There is an issue with the AI server or web server (LLM or internal server error), please try again later",
                    "sources": []
                }, session_uuid, message_id, query, attachments)
            })}\n\n'
            if not enconter_generator_exit:
                try:
                    yield item
                except GeneratorExit:
                    enconter_generator_exit = True
        if not enconter_generator_exit:
            try:
                yield 'data: [DONE]\n\n'
            except GeneratorExit:
                enconter_generator_exit = True
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


def format_chat_title(title, fallback=''):
    title = (title or '').strip().replace('\r', ' ').replace('\n', ' ')
    title = title.strip('\'"')
    title = ' '.join(title.split())
    title = title.rstrip('.,!?;:，。！？；：')
    title = title[:60]
    if title:
        return title

    fallback = ' '.join((fallback or '').strip().split())
    fallback = fallback[:60]
    return fallback


def _generate_session_title(session, project_uuid, org_id, query, ai_reply, scenario, session_uuid=None):
    if not session:
        return ''

    fallback = query or session.session_name
    try:
        title_params = {
            'project_uuid': project_uuid,
            'org_id': org_id,
            'query': query,
            'ai_reply': ai_reply,
            'scenario': scenario,
        }
        if session_uuid:
            title_params['session_uuid'] = session_uuid
        generated_title = get_chat_title(title_params)
    except Exception as e:
        logger.warning(f'Generate chat title failed: {e}')
        generated_title = ''

    final_title = format_chat_title(generated_title, fallback=fallback)
    if not final_title:
        return session.session_name

    session.session_name = final_title
    session.save()
    return session.session_name


def generate_session_title(session_uuid, project_uuid, org_id, query, ai_reply):
    session = ChatSessions.objects.get_session_by_uuid(session_uuid)
    return _generate_session_title(
        session=session,
        project_uuid=project_uuid,
        org_id=org_id,
        query=query,
        ai_reply=ai_reply,
        scenario=AIScenario.CHAT.value,
    )


def generate_portal_session_title(session_uuid, project_uuid, org_id, query, ai_reply):
    session = PortalChatSessions.objects.get_session_by_uuid(session_uuid)
    return _generate_session_title(
        session=session,
        project_uuid=project_uuid,
        org_id=org_id,
        query=query,
        ai_reply=ai_reply,
        scenario=AIScenario.PORTAL_CHAT.value,
        session_uuid=session_uuid,
    )

def get_attachments(seadb_api, project_uuid, attachments):
    knowledge_base_ids = []
    site_documents = []
    seafile_documents = []
    ticket_ids = []
    github_issues = []
    jira_issues = []
    discourse_issues = []
    email_issues = []
    general_tasks = []

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
        elif attachment.get('type') == ConnectionType.JIRA_ISSUE.value:
            jira_issues.append(attachment)
        elif attachment.get('type') == ConnectionType.EMAIL.value:
            email_issues.append(attachment)
        elif attachment.get('type') == ConnectionType.DISCOURSE_FORUM.value:
            discourse_issues.append(attachment)

        # tasks
        elif attachment.get('type') == ConnectionType.GENERAL_TASK.value:
            general_tasks.append(attachment)

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

    if jira_issues:
        jira_seadb_api = JiraSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += jira_seadb_api.get_whole_jira_issue_data(jira_issues)

    if email_issues:
        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += email_seadb_api.get_whole_email_data(email_issues)

    if discourse_issues:
        discourse_seadb_api = DiscourseSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += discourse_seadb_api.get_whole_discourse_data(discourse_issues)

    # tasks
    if general_tasks:
        general_tasks_seadb_api = GeneralTaskSeaDBAPI(project_uuid, seadb_api=seadb_api)
        results += general_tasks_seadb_api.get_whole_general_tasks_data(general_tasks)

    return results

def strip_content_details_from_attachments(attachments):
    new_attachments = deepcopy(attachments)
    for attachment in new_attachments:
        attachment_type = attachment.get('type', '')
        if attachment_type == 'page_content':
            continue
        attachment.pop('content', None)
        attachment.pop('comments', None)
        attachment.pop('emails', None)
    return new_attachments


def split_attachments(project_uuid, attachments):
    """Split mixed attachments into temp image paths and non-image attachments.

    Returns (temp_image_paths, page_content_attachments, other_attachments). Image items whose path is
    not a temp upload URL owned by this project are dropped.
    """
    if not isinstance(attachments, list):
        return [], [], []
    prefix = f'/upload-file/project/{project_uuid}/'
    temp_paths = []
    page_content_attachments = []
    others = []
    for a in attachments:
        if isinstance(a, dict) and a.get('type') == 'image':
            path = a.get('path')
            if isinstance(path, str) and path.startswith(prefix):
                temp_paths.append(path)
        elif isinstance(a, dict) and a.get('type') == 'page_content':
            page_content_attachments.append(a)
        else:
            others.append(a)
    return temp_paths[:CHAT_IMAGE_MAX_COUNT], page_content_attachments[:CHAT_PAGE_CONTENT_MAX_COUNT], others


def build_image_attachments(permanent_image_paths):
    return [
        {'type': 'image', 'path': p, 'name': os.path.basename(p)}
        for p in permanent_image_paths
    ]


def extract_other_page_info(html_content, title, url):
    try:
        web_page_info = extract(html_content, output_format="json", favor_recall=True, include_tables=True)
        web_page_info = json.loads(web_page_info) if web_page_info else {}
        web_page_text = web_page_info.get('text', '')
        web_page_excerpt = web_page_info.get('excerpt', '')
        return { 'content': f'Text: {web_page_text}\nExcerpt: {web_page_excerpt}' }, title
    except Exception as e:
        logger.error(f'Error parsing page: {url}')
        return { 'content': url }, title


def extract_discourse_info(html_content, title, url):
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
    except Exception as e:
        logger.error(f'Failed to parse discourse HTML: {e}')
        return { 'content': url }, title

    title_div = soup.find('a', class_='fancy-title')
    topic_title = title_div.get_text(strip=True) if title_div else ''
    if not topic_title:
        topic_title = title

    # Find all div elements with class="cooked".
    cooked_divs = soup.find_all('div', class_='cooked')

    # Find all replies
    replies = []
    for cooked_div in cooked_divs:
        # Try to find the username - look up the nearest element that contains the username
        reply_element = cooked_div.find_parent('article')
        username = "Unknown user"
        reply_time = ""

        if reply_element:
            # Extract username
            username_elem = reply_element.select_one('.names .username a')
            if username_elem:
                username = username_elem.text.strip()

            # Extract publish time
            time_elem = reply_element.select_one('.post-date .relative-date')
            if time_elem:
                reply_time = time_elem.get('title', '')

        # Create cooked_div copy
        content_div = BeautifulSoup(str(cooked_div), 'html.parser')

        # Remove reference block
        for quote in content_div.select('aside.quote'):
            quote.decompose()
        # Extract post content
        content = content_div.get_text(strip=True)
        replies.append({
            'author': username,
            'time': reply_time,
            'content': content
        })

    if not replies:
        return extract_other_page_info(html_content, topic_title, url)

    return { 'replies': replies }, topic_title


def _extract_github_issue_title(soup):
    """
    Extract GitHub issue title with multiple fallback strategies.
    Tries multiple selector strategies to handle potential GitHub page structure changes.
    """
    title = ''

    # Strategy 1: Try data-testid selector (current GitHub structure)
    title_elem = soup.find('h1', {'data-testid': 'issue-title'})

    # Strategy 2: Fallback to finding h1 with specific class pattern
    if not title_elem:
        title_elem = soup.find('h1', class_='gh-header-title')

    # Strategy 3: Fallback to finding the first h1 in header/heading container
    if not title_elem:
        title_elem = soup.find('div', {'data-testid': 'issue-header'})
        if title_elem:
            title_elem = title_elem.find('h1')

    # Strategy 4: Look for title in bdi tag (often contains issue title)
    if not title_elem:
        bdi_elem = soup.find('bdi')
        if bdi_elem:
            title_elem = bdi_elem

    # Strategy 5: Find first h1 tag as last resort
    if not title_elem:
        title_elem = soup.find('h1')

    if title_elem:
        try:
            # In current GitHub UI the real title lives inside a <bdi> child;
            # the h1 also carries issue number text (e.g. "#123") which we
            # don't want.  Fall back to full h1 text when bdi is absent.
            bdi = title_elem.find('bdi')
            title = bdi.get_text(strip=True) if bdi else title_elem.get_text(strip=True)
        except Exception as e:
            logger.warning(f'Error extracting GitHub issue title: {e}')

    return title


def _extract_github_issue_metadata(soup):
    """
    Extract GitHub issue metadata (state, number, labels, assignees).

    Tries multiple selector strategies to handle potential GitHub page structure changes.
    """
    metadata = {
        'issue_number': '',
        'state': '',
        'labels': [],
        'assignees': []
    }

    try:
        # Strategy 1: Try data-testid selector for issue header
        issue_header = soup.find('div', {'data-testid': 'issue-header'})

        # Strategy 2: Fallback to finding header by class
        if not issue_header:
            issue_header = soup.find('div', class_='gh-header')

        # Strategy 3: Fallback to finding the first div with header classes
        if not issue_header:
            issue_header = soup.find('div', class_='Box-row')

        if issue_header:
            # Extract issue number - look for #123 format
            text = issue_header.get_text()
            import re
            match = re.search(r'#(\d+)', text)
            if match:
                metadata['issue_number'] = f"#{match.group(1)}"

            # Extract state (Open/Closed)
            state_elem = issue_header.find(class_='State')
            if state_elem:
                metadata['state'] = state_elem.get_text(strip=True)
            else:
                # Fallback: look for span with status
                state_spans = issue_header.find_all('span', class_='Label')
                for span in state_spans:
                    text = span.get_text(strip=True).lower()
                    if 'open' in text or 'closed' in text:
                        metadata['state'] = span.get_text(strip=True)
                        break

            # Extract labels
            labels_container = issue_header.find('div', class_='IssueLabels')
            if not labels_container:
                labels_container = issue_header

            label_links = labels_container.find_all('a', class_='Label')
            for label_link in label_links:
                label_text = label_link.get_text(strip=True)
                if label_text and label_text != metadata['state']:  # Avoid duplicating state as label
                    metadata['labels'].append(label_text)

            # Extract assignees
            assignee_links = issue_header.find_all('a', class_='avatar-link')
            for assignee_link in assignee_links:
                title = assignee_link.get('title', '')
                if title:
                    metadata['assignees'].append(title)

    except Exception as e:
        logger.warning(f'Error extracting GitHub issue metadata: {e}')

    return metadata


def _extract_github_issue(soup):
    """
    Extract GitHub issue info with title and metadata using multiple fallback strategies.

    Tries multiple selector strategies to handle potential GitHub page structure changes.
    Includes: title, issue number, state, labels, assignees, author, timestamp, and content.
    """
    # Extract title
    title = _extract_github_issue_title(soup)

    # Extract metadata
    metadata = _extract_github_issue_metadata(soup)

    # Extract body content
    content = ''
    author = 'unknown'
    post_time = None

    # Strategy 1: Try data-testid selector (current GitHub structure)
    issue_body = soup.find('div', {'data-testid': 'issue-body'})

    # Strategy 2: Fallback to class-based selector if data-testid fails
    if not issue_body:
        issue_body = soup.find('div', class_='Box-body')
        if issue_body:
            # Filter to get the first box body which is typically the issue description
            all_box_bodies = soup.find_all('div', class_='Box-body')
            issue_body = all_box_bodies[0] if all_box_bodies else None

    # Strategy 3: Fallback to finding the first markdown body in article context
    if not issue_body:
        article = soup.find('article')
        if article:
            issue_body = article

    if issue_body:
        try:
            # Extract author - try multiple strategies
            author_elem = issue_body.find('a', {'data-testid': 'avatar-link'})
            if not author_elem:
                for link in issue_body.find_all('a', {'data-hovercard-type': 'user'}):
                    if link.text.strip():
                        author_elem = link
                        break
            if not author_elem:
                # Fallback: look for username in class
                author_elem = issue_body.find('a', class_='user-mention')
            if not author_elem:
                # Fallback: look in summary/author div
                author_summary = issue_body.find('div', class_='TimelineItem-body')
                if author_summary:
                    author_elem = author_summary.find('a', class_='user-mention')
            if author_elem:
                author = author_elem.text.strip()
            
            # Extract time - try multiple strategies
            time_elem = issue_body.find('relative-time')
            if not time_elem:
                # Fallback: look for timestamp in title attribute
                time_elem = soup.find('relative-time')
            if time_elem:
                post_time = time_elem.get('datetime') or time_elem.get('title')
            
            # Extract content - try multiple strategies
            content_elem = issue_body.find('div', {'data-testid': 'markdown-body'})
            if not content_elem:
                # Fallback: look for markdown class
                content_elem = issue_body.find('div', class_='markdown-body')
            if not content_elem:
                # Fallback: get all text from issue body
                content_elem = issue_body
            
            if content_elem:
                content = content_elem.get_text(separator='\n', strip=True)
                # Clean up common GitHub UI text
                content = content.replace('Create sub-issue', '').strip()
                # Remove code copy button text
                content = content.replace('Copy', '').strip()
        
        except Exception as e:
            logger.warning(f'Error extracting GitHub issue body: {e}')

    return {
        'title': title,
        'issue_number': metadata.get('issue_number', ''),
        'state': metadata.get('state', ''),
        'labels': metadata.get('labels', []),
        'assignees': metadata.get('assignees', []),
        'author': author,
        'time': post_time,
        'content': content
    }


def _is_user_comment(block):
    """Return True if this timeline event block is a genuine user comment.

    GitHub's issue timeline mixes user comments with system events (commit
    references, label changes, assignments, cross-references, etc.).  Without
    this filter those system events get collected as "comments" and pollute
    the issue summary.
    """
    # -- positive signals: real comments have a header or edit wrapper ------
    # Modern GitHub: data-testid markers
    if block.find(attrs={'data-testid': 'comment-header'}):
        return True
    if block.find(attrs={'data-testid': 'comment-body'}):
        return True

    # Legacy GitHub: class-based markers
    if block.find(class_='timeline-comment-header'):
        return True
    if block.find(class_='edit-comment-hide'):
        return True

    # -- negative signals: known system-event structures --------------------
    # Commit references ("added N commits that reference this issue")
    if block.find(attrs={'data-testid': 'commit-ref'}):
        return False
    # Cross-reference markers
    if block.find(class_='cross-reference'):
        return False
    # Label / milestone / assignment events carry these classes
    for cls in ('IssueLabel', 'labels-timeline-item', 'TimelineItem-badge'):
        if block.find(class_=cls):
            return False

    return False


def _extract_github_comments(soup):
    """
    Extract GitHub issue comments with multiple fallback strategies.

    Tries multiple selector strategies to handle potential GitHub page structure changes.
    """

    def _all_timeline_blocks(container):
        """Return every timeline-event block inside *container*, falling back
        to class-based selectors when data- attributes are absent."""
        blocks = container.find_all('div', {'data-timeline-event-id': True})
        if not blocks:
            blocks = container.find_all('div', class_='TimelineItem')
        if not blocks:
            blocks = container.find_all('div', class_='discussion-item')
        return blocks

    comments = []

    # Strategy 1: Try data-testid selector (current GitHub structure)
    comments_container = soup.find('div', {'data-testid': 'issue-viewer-comments-container'})
    if comments_container:
        comment_blocks = _all_timeline_blocks(comments_container)
    else:
        # Strategy 2: Fallback to finding all timeline event divs globally
        comment_blocks = soup.find_all('div', {'data-timeline-event-id': True})
        if not comment_blocks:
            comment_blocks = _all_timeline_blocks(soup)

    for block in comment_blocks:
        if not _is_user_comment(block):
            continue

        try:
            username = 'unknown'
            post_time = None
            content = ''

            # Extract username - try multiple strategies
            user_elem = block.find('a', {'data-testid': 'avatar-link'})
            if not user_elem:
                for link in block.find_all('a', {'data-hovercard-type': 'user'}):
                    if link.text.strip():
                        user_elem = link
                        break
            if not user_elem:
                user_elem = block.find('a', class_='user-mention')
            if not user_elem:
                user_elem = block.find('strong', class_='author')

            if user_elem:
                username = user_elem.text.strip()

            # Extract time - try multiple strategies
            time_elem = block.find('relative-time')
            if time_elem:
                post_time = time_elem.get('datetime') or time_elem.get('title')

            # Extract content - try multiple strategies
            content_elem = block.find('div', {'data-testid': 'markdown-body'})
            if not content_elem:
                content_elem = block.find('div', class_='markdown-body')
            if not content_elem:
                # Fallback: find the first div that looks like content
                content_elem = block.find('div', class_='comment-body')
            if not content_elem:
                content_elem = block.find('td', class_='comment')

            if content_elem:
                content = content_elem.get_text(separator='\n', strip=True)
                # Clean up common GitHub UI text
                content = content.replace('Copy', '').strip()

            # Only add non-empty comments
            if content:
                comments.append({
                    'author': username,
                    'time': post_time,
                    'content': content
                })

        except Exception as e:
            logger.warning(f'Error extracting GitHub comment: {e}')
            continue

    return comments


def extract_GitHub_issues(html_content, title, url):
    """
    Extract GitHub issue and comments from HTML content.

    Uses multiple selector strategies to handle potential GitHub page structure changes.
    Falls back gracefully if selectors change.

    Args:
        html_content: HTML string of GitHub issue page
        title: title of GitHub issue page

    Returns:
        Formatted text containing issue body and comments
    """
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
    except Exception as e:
        logger.error(f'Failed to parse GitHub issue HTML: {e}')
        return { 'content': url }, title

    try:
        # Extract issue info
        issue_info = _extract_github_issue(soup)
    except Exception as e:
        issue_info = {}
        logger.warning(f'Failed to extract GitHub issue body: {e}')

    try:
        # Extract comments
        comments = _extract_github_comments(soup)
    except Exception as e:
        comments = []
        logger.warning(f'Failed to extract GitHub comments: {e}')

    info = {
        'created_at': issue_info.get('time', ''),
        'content': issue_info.get('content', ''),
        'author': issue_info.get('author', ''),
        'comments': comments
    }
    return info, issue_info.get('title', title)


def build_page_content_attachments(attachments):
    _attachments = []
    for attachment in attachments:
        title = attachment.get('title', '')
        url = attachment.get('url', '')
        html_content = attachment.get('html_content', '')
        type = attachment.get('type', '')
        if not html_content:
            _attachments.append(attachment)
            continue

        other_info = {}

        external_ref_url, external_ref_id, connection_type = parse_webpage_url(url)
        if connection_type == ConnectionType.DISCOURSE_FORUM.value:
            other_info, title = extract_discourse_info(html_content, title, url)
        elif connection_type == ConnectionType.GITHUB_ISSUE.value:
            other_info, title = extract_GitHub_issues(html_content, title, url)
        else:
            other_info, title = extract_other_page_info(html_content, title, url)
        base_info = { 'url': url, 'title': title, 'type': type }
        _attachments.append({**base_info, **other_info})
    return _attachments


class ImageProcessingError(Exception):
    pass


def build_ai_images_payload(project_uuid, permanent_image_paths):
    payload = []
    file_prefix = f'/file/project/{project_uuid}/'
    for path in permanent_image_paths:
        if not isinstance(path, str) or not path.startswith(file_prefix):
            raise ImageProcessingError(f'Invalid image path: {path}')
        file_path = path[len(file_prefix):]
        name = os.path.basename(file_path)
        mime_type, _ = mimetypes.guess_type(name)
        if not mime_type or not mime_type.startswith('image/'):
            raise ImageProcessingError(f'Unsupported image type: {name}')
        try:
            body = get_project_file_from_s3(project_uuid, file_path)
            data = base64.b64encode(body.read()).decode('ascii')
        except Exception as e:
            logger.warning(f'Failed to read image {file_path} from s3: {e}')
            raise ImageProcessingError(f'Failed to read image: {name}')
        payload.append({'name': name, 'mime_type': mime_type, 'data': data})
    return payload

import uuid
import json
import logging
import os
import re
import time
from urllib.parse import quote, unquote

import jwt
from django.conf import settings

from django.core.cache import cache
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status

from seahub.api2.utils import api_error
from seahub.project.constants import AIScenario
from seahub.project.constants import IMAGE_EXTS
from seahub.project.models import AIUsageStatistics
from seahub.project.utils import convert_cost_to_credit
from seahub.portal.models import PortalChatMessages, ProjectExternalUser
from seahub.utils import normalize_cache_key, uuid_str_to_32_chars
from seahub.chats.utils import strip_content_details_from_attachments
from seahub.chats.constants import CHAT_IMAGE_MAX_COUNT

logger = logging.getLogger(__name__)

from .constants import (
    PORTAL_EXTERNAL_CHAT_USER_RATE_LIMIT,
    PORTAL_EXTERNAL_CHAT_USER_RATE_WINDOW,
    PORTAL_EXTERNAL_CHAT_PROJECT_RATE_LIMIT,
    PORTAL_EXTERNAL_CHAT_PROJECT_RATE_WINDOW,
    PORTAL_ANON_CHAT_SESSION_DAILY_LIMIT,
    PORTAL_ANON_CHAT_IP_DAILY_LIMIT,
    PORTAL_ANON_CHAT_DAILY_TTL,
    PORTAL_CHAT_DAILY_CREDIT_LIMIT_DEFAULT,
    PORTAL_CHAT_IMAGE_TOKEN_AUDIENCE,
    PORTAL_CHAT_IMAGE_TOKEN_TTL,
    PORTAL_CHAT_PROXY_IMAGE_ATTACHMENT_PREFIXES,
)


def get_portal_external_username(request, project_uuid):
    ext_username = request.session.get('portal_external_username')
    ext_project_uuid = request.session.get('portal_external_project_uuid')
    if not ext_username or ext_project_uuid != project_uuid:
        return ''
    exists = ProjectExternalUser.objects.filter(
        project_uuid=project_uuid, username=ext_username, activated=True
    ).exists()
    return ext_username if exists else ''


def _get_counter_cache_key(prefix, *parts):
    return normalize_cache_key(':'.join(str(part) for part in parts), prefix=prefix)


def _get_cached_counter(key):
    return cache.get(key, 0) or 0


def _increase_cached_counter(key, timeout):
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout)
        return 1


def _get_external_user_rate_limit_key(project_uuid, username):
    return _get_counter_cache_key('portal_ext_chat_user_', project_uuid, username)


def _get_external_project_rate_limit_key(project_uuid):
    return _get_counter_cache_key('portal_ext_chat_project_', project_uuid)


def check_external_chat_rate_limit(project_uuid, username):
    user_key = _get_external_user_rate_limit_key(project_uuid, username)
    if _get_cached_counter(user_key) >= PORTAL_EXTERNAL_CHAT_USER_RATE_LIMIT:
        return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Too many requests, please try again later.')

    project_key = _get_external_project_rate_limit_key(project_uuid)
    if _get_cached_counter(project_key) >= PORTAL_EXTERNAL_CHAT_PROJECT_RATE_LIMIT:
        return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Too many requests, please try again later.')

    return None


def mark_external_chat_rate_limit(project_uuid, username):
    _increase_cached_counter(
        _get_external_user_rate_limit_key(project_uuid, username),
        PORTAL_EXTERNAL_CHAT_USER_RATE_WINDOW
    )
    _increase_cached_counter(
        _get_external_project_rate_limit_key(project_uuid),
        PORTAL_EXTERNAL_CHAT_PROJECT_RATE_WINDOW
    )


def get_project_portal_chat_credit_used(project_uuid):
    today = timezone.localdate()
    total_cost = AIUsageStatistics.objects.filter(
        date=today,
        project_uuid=uuid_str_to_32_chars(project_uuid),
        scenario=AIScenario.PORTAL_CHAT.value,
    ).aggregate(
        total_cost=Coalesce(Sum('cost'), Value(0.0))
    )['total_cost']

    return convert_cost_to_credit(total_cost or 0)


def _get_anon_session_rate_limit_key(visitor_uuid, date_str):
    return _get_counter_cache_key('portal_anon_chat_session_daily_', visitor_uuid, date_str)


def _get_anon_ip_rate_limit_key(ip, date_str):
    return _get_counter_cache_key('portal_anon_chat_ip_daily_', ip, date_str)


def check_anonymous_chat_rate_limit(visitor_uuid, ip):
    today_str = timezone.localdate().strftime('%Y%m%d')

    session_key = _get_anon_session_rate_limit_key(visitor_uuid, today_str)
    if _get_cached_counter(session_key) >= PORTAL_ANON_CHAT_SESSION_DAILY_LIMIT:
        return api_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            'Anonymous chat daily limit exceeded. Please try again tomorrow or log in.'
        )

    ip_key = _get_anon_ip_rate_limit_key(ip, today_str)
    if _get_cached_counter(ip_key) >= PORTAL_ANON_CHAT_IP_DAILY_LIMIT:
        return api_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            'Too many requests from this IP. Please try again tomorrow.'
        )

    return None


def mark_anonymous_chat_rate_limit(visitor_uuid, ip):
    today_str = timezone.localdate().strftime('%Y%m%d')

    _increase_cached_counter(
        _get_anon_session_rate_limit_key(visitor_uuid, today_str),
        PORTAL_ANON_CHAT_DAILY_TTL
    )
    _increase_cached_counter(
        _get_anon_ip_rate_limit_key(ip, today_str),
        PORTAL_ANON_CHAT_DAILY_TTL
    )


def get_portal_chat_settings(project):
    settings = project.settings or '{}'
    if isinstance(settings, str):
        try:
            settings = json.loads(settings)
        except:
            settings = {}
    portal_settings = settings.get('portal', {})
    chat_allowed_sources = portal_settings.get('chat_allowed_sources')
    if not isinstance(chat_allowed_sources, dict):
        chat_allowed_sources = {}
    daily_chat_credit_limit = portal_settings.get('daily_chat_credit_limit', PORTAL_CHAT_DAILY_CREDIT_LIMIT_DEFAULT)
    try:
        daily_chat_credit_limit = int(daily_chat_credit_limit)
    except (TypeError, ValueError):
        daily_chat_credit_limit = PORTAL_CHAT_DAILY_CREDIT_LIMIT_DEFAULT
    if daily_chat_credit_limit < 0:
        daily_chat_credit_limit = PORTAL_CHAT_DAILY_CREDIT_LIMIT_DEFAULT
    return {
        'chat_allowed_sources': {
            'connection_ids': chat_allowed_sources.get('connection_ids') or [],
            'extra_sources': chat_allowed_sources.get('extra_sources') or [],
        },
        'daily_chat_credit_limit': daily_chat_credit_limit,
    }


def gen_portal_message_id(session_uuid, max_try=5):
    trying = 0
    new_message_id = ''
    while not new_message_id and trying < max_try:
        try_message_id = uuid.uuid4().hex[:4]
        if not PortalChatMessages.objects.filter(session_uuid=session_uuid, message_id=try_message_id).exists():
            new_message_id = try_message_id
        trying += 1

    if trying == max_try:
        raise Exception('Failure to generate message_id')

    return new_message_id


def gen_portal_chat_task_id(session_uuid):
    return f"portal_chat_{session_uuid.replace('-', '')}"


def _get_portal_chat_image_jwt_secret():
    return getattr(settings, 'JWT_PRIVATE_KEY', '')


def _split_url_suffix(file_path):
    suffix_index = len(file_path)
    for sep in ('?', '#'):
        index = file_path.find(sep)
        if index != -1:
            suffix_index = min(suffix_index, index)
    return file_path[:suffix_index], file_path[suffix_index:]


def normalize_portal_chat_image_file_path(file_path):
    if not isinstance(file_path, str) or not file_path:
        return ''
    file_path, _ = _split_url_suffix(file_path)
    file_path = unquote(file_path).lstrip('/')
    if not file_path.startswith(PORTAL_CHAT_PROXY_IMAGE_ATTACHMENT_PREFIXES):
        return ''
    if any(part == '..' for part in file_path.split('/')):
        return ''
    return file_path


def is_portal_chat_proxy_image_file_path(file_path):
    if not isinstance(file_path, str) or not file_path:
        return False
    ext = os.path.splitext(file_path)[1].lstrip('.').lower()
    return ext in IMAGE_EXTS


def encode_portal_chat_image_token(project_uuid, file_path, session_uuid, message_id, username):
    now = int(time.time())
    payload = {
        'aud': PORTAL_CHAT_IMAGE_TOKEN_AUDIENCE,
        'project_uuid': str(project_uuid),
        'file_path': file_path,
        'session_uuid': session_uuid,
        'message_id': message_id,
        'username': username,
        'iat': now,
        'exp': now + PORTAL_CHAT_IMAGE_TOKEN_TTL,
    }
    return jwt.encode(payload, _get_portal_chat_image_jwt_secret(), algorithm='HS256')


def decode_portal_chat_image_token(token):
    return jwt.decode(
        token,
        _get_portal_chat_image_jwt_secret(),
        algorithms=['HS256'],
        audience=PORTAL_CHAT_IMAGE_TOKEN_AUDIENCE,
    )


def build_portal_chat_image_url(project_uuid, file_path, session_uuid, message_id, username):
    token = encode_portal_chat_image_token(project_uuid, file_path, session_uuid, message_id, username)
    return f'/file/portal-chat-image/{project_uuid}/?token={quote(token, safe="")}'


def rewrite_portal_chat_image_urls(project_uuid, value, session_uuid, message_id, username):
    if not isinstance(value, str) or not value:
        return value
    if not session_uuid or not message_id or not username:
        return value

    project_uuid = str(project_uuid)
    pattern = re.compile(
        r'/file/project/%s/'
        r'(?P<file_path>attachments/[^\s\)\\\]"\']+)' % re.escape(project_uuid)
    )

    def replace(match):
        file_path = normalize_portal_chat_image_file_path(match.group('file_path'))
        if not file_path or not is_portal_chat_proxy_image_file_path(file_path):
            return match.group(0)
        return build_portal_chat_image_url(project_uuid, file_path, session_uuid, message_id, username)

    return pattern.sub(replace, value)


def build_portal_message_result(ai_result, project_uuid, session_uuid, message_id, query, username, attachments=None):
    if 'ai_reply' not in ai_result:
        ai_result['ai_reply'] = ai_result.get('answer', '')

    ai_result.pop('answer', None)
    stripped_attachments = strip_content_details_from_attachments(attachments or [])
    ai_result.update({
        'session_uuid': session_uuid,
        'attachments': stripped_attachments,
    })

    try:
        user_message = PortalChatMessages.objects.create_message(
            session_uuid, message_id, 'user', query, attachments=stripped_attachments,
        )
        ai_reply_message = PortalChatMessages.objects.create_message(
            session_uuid, message_id, 'assistant', ai_result['ai_reply']
        )
        ai_result.update({
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id
        })
    except Exception as e:
        logger.warning(f'Failure to record portal messages to db: {e}')

    ai_result['ai_reply'] = rewrite_portal_chat_image_urls(
        project_uuid, ai_result['ai_reply'], session_uuid, message_id, username
    )
    return ai_result


def process_portal_stream_ai_reply(chat_task_id_info, ai_response, project_uuid, session_uuid, message_id, query, username, attachments=None):
    has_recorded_result = False
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
                    item = f'data: {json.dumps({"results": build_portal_message_result(results, project_uuid, session_uuid, message_id, query, username, attachments)})}\n\n'
                    has_recorded_result = True
                elif content.startswith('[ERROR: ') and content.endswith(']'):
                    error_msg = content[1:-1]
                    item = f'data: {json.dumps({"results": build_portal_message_result({"ai_reply": error_msg, "sources": []}, project_uuid, session_uuid, message_id, query, username, attachments)})}\n\n'
                    has_recorded_result = True
                else:
                    line_str = rewrite_portal_chat_image_urls(
                        project_uuid, line_str, session_uuid, message_id, username
                    )
                    if not line_str.endswith('\n\n'):
                        line_str += '\n\n'
                    item = line_str
                try:
                    yield item
                except:  # continues to receive data even client interrupts the stream
                    continue
                if error_msg:
                    raise ConnectionError(error_msg)
    except Exception as e:
        logger.exception(f'Portal streaming response is interrupted: {e}')
        if not has_recorded_result:
            item = f'data: {json.dumps({"results": build_portal_message_result({"ai_reply": "There is an issue with the AI server or web server (LLM or internal server error), please try again later", "sources": []}, project_uuid, session_uuid, message_id, query, username, attachments)})}\n\n'
            try:
                yield item
            except:
                pass
        try:
            yield 'data: [DONE]\n\n'
        except:
            pass
    cache.delete(chat_task_id_info)


def extract_portal_chat_image_urls(project_uuid, attachments):
    if not isinstance(attachments, list):
        return []
    portal_prefix = f'/upload-file/portal/{project_uuid}/'
    urls = []
    for a in attachments:
        if isinstance(a, dict) and a.get('type') == 'image':
            path = a.get('path')
            if isinstance(path, str) and path.startswith(portal_prefix):
                urls.append(path)
    return urls[:CHAT_IMAGE_MAX_COUNT]

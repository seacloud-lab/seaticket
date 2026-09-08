import logging
import time
import mimetypes
import json
from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta
from django.core.cache import cache
from django.http import FileResponse, StreamingHttpResponse
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from seahub.portal.permissions import PortalChatPermission, PortalAdminPermission
from seahub.portal.utils import portal_endpoint
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import uuid_str_to_32_chars
from seahub.utils.storage import upload_portal_files_to_s3
from seahub.project.models import AIUsageStatistics
from seahub.project.constants import AIScenario
from seahub.project.utils import check_ai_limit, check_project_admin_permission, delete_portal_sessions, convert_cost_to_credit
from seahub.utils.ip import get_remote_ip
from seahub.portal.chat.utils import (
    build_portal_chat_error_response,
    build_portal_message_result,
    check_anonymous_chat_rate_limit,
    check_external_chat_rate_limit,
    decode_portal_chat_image_token,
    extract_portal_chat_image_urls,
    gen_portal_chat_task_id,
    gen_portal_message_id,
    get_portal_chat_settings,
    get_project_portal_chat_credit_used,
    is_portal_chat_proxy_image_file_path,
    mark_anonymous_chat_rate_limit,
    mark_external_chat_rate_limit,
    normalize_portal_chat_image_file_path,
    process_portal_stream_ai_reply,
    rewrite_portal_chat_image_urls,
    rewrite_portal_chat_admin_image_urls,
)
from seahub.portal.chat.constants import PORTAL_CHAT_ADMIN_IMAGE_TOKEN_TYPE
from seahub.portal.models import PortalChatSessions, PortalChatMessages
from seahub.chats.utils import (
    build_ai_images_payload,
    build_image_attachments,
    get_ai_reply,
    ImageProcessingError,
    generate_portal_session_title,
)
from seahub.chats.constants import AI_REPLY_TIMEOUT
from seahub.utils.ai_client import validate_chat_input
from seahub.utils.storage import FileNotFound, get_project_file_from_s3, get_project_file_head_from_s3

logger = logging.getLogger(__name__)


def _get_session_or_error(session_uuid, username):
    session = PortalChatSessions.objects.get_session_by_uuid(session_uuid)
    if not session:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Session not found.')
    if session.username != username:
        return None, api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
    return session, None


def _get_portal_chat_usage(project_uuid, start_date, end_date):
    """Return Portal Chat usage and users for an inclusive date range."""
    usage = AIUsageStatistics.objects.filter(
        project_uuid=uuid_str_to_32_chars(project_uuid),
        scenario=AIScenario.PORTAL_CHAT.value,
        date__range=(start_date, end_date),
    ).aggregate(
        input_tokens=Sum('input_tokens', default=0),
        output_tokens=Sum('output_tokens', default=0),
        total_cost=Sum('cost', default=0),
    )
    start_time = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
    end_time = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time()))
    user_count = PortalChatSessions.objects.filter(
        project_uuid=project_uuid,
        created_at__gte=start_time,
        created_at__lt=end_time,
    ).aggregate(
        user_count=Count('username', distinct=True),
    )['user_count'] or 0

    return {
        'users': user_count,
        'input_tokens': usage['input_tokens'] or 0,
        'output_tokens': usage['output_tokens'] or 0,
        'credit_used': convert_cost_to_credit(usage['total_cost'] or 0),
    }


def _get_percentage_change(current, previous):
    if not previous:
        return None if not current else 100
    return round((current - previous) * 100 / previous, 2)


class PortalChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid):
        try:
            sessions = PortalChatSessions.objects.get_sessions_by_project(project_uuid, request.identity['username'])
            sessions_data = [session.to_dict() for session in sessions]
            return Response({'sessions': sessions_data})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @portal_endpoint
    def post(self, request, project_uuid):
        """Create a new portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        try:
            session = PortalChatSessions.objects.create_session(
                project_uuid=project_uuid,
                session_name=session_name,
                username=request.identity['username'],
            )
            return Response({'session': session.to_dict()}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def put(self, request, project_uuid, session_uuid):
        """Modify portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        session, error = _get_session_or_error(session_uuid, request.identity['username'])
        if error:
            return error

        try:
            session.session_name = session_name
            session.save()
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @portal_endpoint
    def delete(self, request, project_uuid, session_uuid):
        """Delete portal chat session"""
        _, error = _get_session_or_error(session_uuid, request.identity['username'])
        if error:
            return error

        try:
            delete_portal_sessions([session_uuid])
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatSessionTitleView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def post(self, request, project_uuid, session_uuid):
        if 'query' not in request.data:
            return api_error(status.HTTP_400_BAD_REQUEST, 'query parameter is required.')
        query = request.data.get('query')

        if 'ai_reply' not in request.data:
            return api_error(status.HTTP_400_BAD_REQUEST, 'ai_reply parameter is required.')
        ai_reply = request.data.get('ai_reply', '')

        _, error = _get_session_or_error(session_uuid, request.identity['username'])
        if error:
            return error

        org_id = getattr(getattr(request.project, 'workspace', None), 'org_id', -1) or -1
        session_name = generate_portal_session_title(
            session_uuid=session_uuid,
            project_uuid=project_uuid,
            org_id=org_id,
            query=query,
            ai_reply=ai_reply,
        )
        return Response({
            'success': True,
            'session_name': session_name,
        })


class PortalChatMessagesView(APIView):
    """Portal Chat Messages API - Get message history"""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid, session_uuid):
        """Retrieve the message list of the portal chat session"""
        _, error = _get_session_or_error(session_uuid, request.identity['username'])
        if error:
            return error

        try:
            messages = PortalChatMessages.objects.get_messages_by_session(session_uuid)
            messages_data = []
            for message in messages:
                message_data = message.to_dict()
                if message_data.get('role') == 'assistant':
                    message_data['content'] = rewrite_portal_chat_image_urls(
                        project_uuid,
                        message_data.get('content'),
                        session_uuid,
                        message_data.get('message_id'),
                        request.identity['username'],
                    )
                messages_data.append(message_data)
            chat_task_info = cache.get(gen_portal_chat_task_id(session_uuid))
            results = {
                'messages': messages_data,
                'running_task': chat_task_info is not None,
            }
            if results['running_task']:
                results['user_input'] = chat_task_info['user_input']
            return Response(results)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalAdminChatMessagesView(APIView):
    """Return a portal chat session and its messages for an administrator."""

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalAdminPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid, session_uuid):
        session = PortalChatSessions.objects.filter(
            project_uuid=project_uuid,
            session_uuid=session_uuid,
        ).first()
        if not session:
            return api_error(status.HTTP_404_NOT_FOUND, 'Session not found.')

        try:
            messages_data = []
            for message in PortalChatMessages.objects.get_messages_by_session(session_uuid):
                message_data = message.to_dict()
                if message_data.get('role') == 'assistant':
                    message_data['content'] = rewrite_portal_chat_admin_image_urls(
                        project_uuid,
                        message_data.get('content'),
                        session_uuid,
                        message_data.get('message_id'),
                        request.user.username,
                        session.username,
                    )
                messages_data.append(message_data)
            return Response({
                'session': session.to_dict(),
                'messages': messages_data,
            })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalAdminChatSessionsView(APIView):
    """List all portal chat sessions for a project in read-only admin mode."""

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalAdminPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def post(self, request, project_uuid):
        try:
            try:
                start = int(request.POST.get('start', 0))
                limit = int(request.POST.get('limit', 1000))
                view_config = request.POST.get('config', '{}')
                view_config = json.loads(view_config)
            except (TypeError, ValueError):
                return api_error(status.HTTP_400_BAD_REQUEST, 'per_page or page invalid')
            end = start + limit

            sorts = view_config.get('sorts', [])
            if not sorts:
                sorts = [ { 'column_key': 'updated_at', 'sort_type': 'down' } ]

            sorts = [
                f'-{s["column_key"]}' if s['sort_type'] == 'down' else s['column_key']
                for s in sorts
            ]

            sessions = PortalChatSessions.objects.filter(
                project_uuid=project_uuid,
            ).order_by(*sorts)[start:end]
            return Response({
                'sessions': [session.to_dict() for session in sessions],
            })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalAdminChatStatisticsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalAdminPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid):
        try:

            today = timezone.localdate()
            start_date = today - relativedelta(months=1) + timedelta(days=1)
            start_time = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
            session_created_times = PortalChatSessions.objects.filter(
                project_uuid=project_uuid,
                created_at__gte=start_time,
            ).values_list('created_at', flat=True)
            session_counts_by_date = {}
            for created_at in session_created_times:
                date = timezone.localtime(created_at).date()
                session_counts_by_date[date] = session_counts_by_date.get(date, 0) + 1
            daily_session_counts = [
                {
                    'date': (start_date + timedelta(days=offset)).isoformat(),
                    'count': session_counts_by_date.get(start_date + timedelta(days=offset), 0),
                }
                for offset in range((today - start_date).days + 1)
            ]

            current_month_start = today.replace(day=1)
            previous_month_end = today - relativedelta(months=1)
            previous_month_start = previous_month_end.replace(day=1)

            current_month = _get_portal_chat_usage(
                project_uuid, current_month_start, today
            )
            previous_same_period = _get_portal_chat_usage(
                project_uuid, previous_month_start, previous_month_end
            )
            change_percent = {
                metric: _get_percentage_change(
                    current_month[metric], previous_same_period[metric]
                )
                for metric in ('users', 'input_tokens', 'output_tokens', 'credit_used')
            }

            return Response({
                'daily_session_counts': daily_session_counts,
                'current': current_month,
                'change_percent': change_percent,
            })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatView(APIView):
    """Portal Chat API - Send message and get AI reply"""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid):
        session_uuid = request.GET.get('session_uuid')
        if not session_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_uuid parameter is required.')

        try:
            _, error = _get_session_or_error(session_uuid, request.identity['username'])
            if error:
                return error

            chat_task_id_info = gen_portal_chat_task_id(session_uuid)
            while cache.get(chat_task_id_info) is not None:
                time.sleep(0.1)

            last_message = PortalChatMessages.objects.get_last_message_by_session(session_uuid)
            if not last_message:
                return api_error(status.HTTP_404_NOT_FOUND, 'No messages found.')

            result = {
                'ai_reply': rewrite_portal_chat_image_urls(
                    project_uuid,
                    last_message.content,
                    session_uuid,
                    last_message.message_id,
                    request.identity['username'],
                ),
                'ai_reply_message_id': last_message.id,
                'session_uuid': session_uuid,
            }

            return Response(result)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @portal_endpoint
    def post(self, request, project_uuid):
        """Send message and get AI reply"""
        query = request.data.get('query')
        if not query:
            return api_error(status.HTTP_400_BAD_REQUEST, 'query invalid.')

        session_uuid = request.data.get('session_uuid')
        if not session_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_uuid parameter is required.')

        clear_context = request.data.get('clear_context', False)
        if isinstance(clear_context, str):
            clear_context = clear_context.lower() == 'true'
        if not isinstance(clear_context, bool):
            return api_error(status.HTTP_400_BAD_REQUEST, 'clear_context invalid.')

        stream = request.project.to_dict()['settings'].get('streaming_response', True)
        stream_from_request = request.data.get('stream')
        if stream_from_request is not None:
            if isinstance(stream_from_request, str):
                stream_from_request = stream_from_request.lower() == 'true'
            if not isinstance(stream_from_request, bool):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid stream')
            stream = stream_from_request

        portal_settings = get_portal_chat_settings(request.project)
        if request.identity['is_external_user']:
            rate_limit_error = check_external_chat_rate_limit(project_uuid, request.identity['username'])
            if rate_limit_error:
                return rate_limit_error

        visitor_uuid = request.identity.get('visitor_uuid', '')
        ip = ''
        if request.identity['is_anonymous']:
            ip = get_remote_ip(request)
            rate_limit_error = check_anonymous_chat_rate_limit(visitor_uuid, ip)
            if rate_limit_error:
                return rate_limit_error

        project_credit_used = get_project_portal_chat_credit_used(project_uuid)
        if project_credit_used >= portal_settings['daily_chat_credit_limit']:
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Portal chat daily quota exceeded.')

        username = request.identity['username']

        session, error = _get_session_or_error(session_uuid, username)
        if error:
            return error

        current_session_uuid = session.session_uuid

        # Check AI quota of org
        org_id = getattr(getattr(request.project, 'workspace', None), 'org_id', -1) or -1
        if check_ai_limit(org_id):
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, 'AI credit not enough.')

        project_prompt = ''
        if request.project.settings:
            try:
                project_settings = json.loads(request.project.settings)
                project_prompt = project_settings.get('prompt', '')
            except json.JSONDecodeError:
                pass

        try:
            message_id = gen_portal_message_id(current_session_uuid)
        except Exception as e:
            logger.exception(f'Failure to generate message id: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

        raw_attachments = request.data.get('attachments', [])
        temp_image_urls = extract_portal_chat_image_urls(project_uuid, raw_attachments)

        attachments = []
        ai_attachments = []
        if temp_image_urls:
            image_names = [u.rsplit('/', 1)[-1] for u in temp_image_urls if isinstance(u, str)]
            if len(image_names) != len(set(image_names)):
                return build_portal_chat_error_response(stream, {
                    'ai_reply': 'Images with the same name are not allowed.',
                    'sources': [],
                }, project_uuid, current_session_uuid, message_id, query, username, attachments)

            try:
                record_id = f'{current_session_uuid}/{message_id}'
                new_url_map = upload_portal_files_to_s3(project_uuid, temp_image_urls, username, 'portal-chat', record_id)
                permanent_image_paths = list(new_url_map.keys())
            except Exception as e:
                logger.exception(f'Failed to upload images to S3: {e}')
                return build_portal_chat_error_response(stream, {
                    'ai_reply': 'Failed to upload image. Please try again.',
                    'sources': [],
                }, project_uuid, current_session_uuid, message_id, query, username, attachments)

            if len(permanent_image_paths) != len(temp_image_urls):
                logger.warning(
                    f'Image upload incomplete: requested={len(temp_image_urls)} succeeded={len(permanent_image_paths)}'
                )
                return build_portal_chat_error_response(stream, {
                    'ai_reply': 'Failed to upload image. Please try again.',
                    'sources': [],
                }, project_uuid, current_session_uuid, message_id, query, username, attachments)

            attachments = build_image_attachments(permanent_image_paths)

            # build_ai_images_payload validates against /file/project/ before
            # reading from S3. The S3 object is the same; only the URL wrapper
            # differs. Rewrite locally so we don't have to teach the shared
            # helper about portal URLs.
            portal_file_prefix = f'/file/portal/{project_uuid}/'
            project_file_prefix = f'/file/project/{project_uuid}/'
            ai_payload_paths = [
                project_file_prefix + p[len(portal_file_prefix):]
                for p in permanent_image_paths
            ]
            try:
                ai_images_payload = build_ai_images_payload(project_uuid, ai_payload_paths)
            except ImageProcessingError as e:
                logger.warning(f'Image processing failed: {e}')
                return build_portal_chat_error_response(stream, {
                    'ai_reply': str(e),
                    'sources': [],
                }, project_uuid, current_session_uuid, message_id, query, username, attachments)

            image_data_by_name = {img['name']: img for img in ai_images_payload}
            ai_attachments = [{**a, **image_data_by_name.get(a['name'], {})} for a in attachments]

        try:
            validation = validate_chat_input({
                'project_uuid': uuid_str_to_32_chars(project_uuid),
                'session_uuid': current_session_uuid,
                'query': query,
                'attachments': ai_attachments,
                'org_id': org_id,
                'project_prompt': project_prompt,
                'portal_chat_prompt': portal_settings['chat_prompt'],
                'is_external_portal': True,
                'scenario': AIScenario.PORTAL_CHAT.value,
            })
        except Exception as e:
            logger.exception(f'Portal chat input validation failed: {e}')
            return build_portal_chat_error_response(stream, {
                'ai_reply': 'Input validation service is temporarily unavailable, please try again later.',
                'sources': [],
            }, project_uuid, current_session_uuid, message_id, query, username, attachments)
        if not validation['valid']:
            return build_portal_chat_error_response(stream, {
                'ai_reply': validation['reason'],
                'sources': [],
            }, project_uuid, current_session_uuid, message_id, query, username, attachments)
        if clear_context:
            PortalChatMessages.objects.clear_context(current_session_uuid)

        chat_sources = portal_settings['chat_allowed_sources']

        chat_task_id_info = gen_portal_chat_task_id(current_session_uuid)
        if cache.get(chat_task_id_info) is not None:
            return api_error(status.HTTP_409_CONFLICT, 'There are unfinished tasks in the current session, please try again later.')

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'session_uuid': current_session_uuid,
            'message_id': message_id,
            'query': query,
            'attachments': ai_attachments,
            'org_id': org_id,
            'connection_ids': chat_sources['connection_ids'],
            'extra_sources': chat_sources['extra_sources'],
            'is_external_portal': True,
            'project_prompt': project_prompt,
            'portal_chat_prompt': portal_settings['chat_prompt'],
            'stream': stream,
            'scenario': AIScenario.PORTAL_CHAT.value,
        }

        if request.identity['is_external_user']:
            mark_external_chat_rate_limit(project_uuid, request.identity['username'])
        elif request.identity['is_anonymous']:
            mark_anonymous_chat_rate_limit(visitor_uuid, ip)

        task_info = {
            'user_input': {
                'message': query,
                'attachments': attachments,
            }
        }
        cache.set(chat_task_id_info, task_info, AI_REPLY_TIMEOUT)

        if stream:
            try:
                return StreamingHttpResponse(
                    process_portal_stream_ai_reply(
                        chat_task_id_info,
                        get_ai_reply(params),
                        project_uuid,
                        current_session_uuid,
                        message_id,
                        query,
                        username,
                        attachments,
                    ),
                    content_type='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no'
                    }
                )
            except Exception as e:
                logger.exception(f'Failure to make portal stream: {e}')
                cache.delete(chat_task_id_info)
                return build_portal_chat_error_response(stream, {
                    'ai_reply': 'AI service is temporarily unavailable, please try again later.',
                    'sources': [],
                }, project_uuid, current_session_uuid, message_id, query, username, attachments)

        try:
            ai_response = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_response = {
                'ai_reply': 'Sorry, the AI service is temporarily unavailable, please try again later.',
            }

        cache.delete(chat_task_id_info)

        return Response(build_portal_message_result(ai_response, project_uuid, current_session_uuid, message_id, query, username, attachments))


class PortalChatImageView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalChatPermission,)
    throttle_classes = (UserRateThrottle,)

    @portal_endpoint
    def get(self, request, project_uuid):
        token = request.GET.get('token')
        if not token:
            return api_error(status.HTTP_400_BAD_REQUEST, 'token is required.')

        try:
            payload = decode_portal_chat_image_token(token)
        except Exception as e:
            logger.warning(f'Invalid portal chat image token: {e}')
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if payload.get('project_uuid') != str(project_uuid):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        session_uuid = payload.get('session_uuid')
        token_type = payload.get('token_type')
        username = request.identity['username']
        if token_type == PORTAL_CHAT_ADMIN_IMAGE_TOKEN_TYPE:
            if not request.user.is_authenticated or not check_project_admin_permission(
                    request.user.username, request.project.workspace.owner):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            if payload.get('username') != request.user.username:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            
            session, error = _get_session_or_error(session_uuid, payload.get('session_username'))
            if error:
                return error
        else:
            if payload.get('username') != username:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
            session, error = _get_session_or_error(session_uuid, username)
            if error:
                return error
        if str(session.project_uuid) != str(project_uuid):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        file_path = normalize_portal_chat_image_file_path(payload.get('file_path'))
        if not file_path or not is_portal_chat_proxy_image_file_path(file_path):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            get_project_file_head_from_s3(project_uuid, file_path)
        except FileNotFound:
            return api_error(status.HTTP_404_NOT_FOUND, 'File not exist.')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            file = get_project_file_from_s3(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
        response = FileResponse(file, content_type=content_type)
        response['Cache-Control'] = 'private, max-age=300'
        return response

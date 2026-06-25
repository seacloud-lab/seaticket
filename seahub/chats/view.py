# -*- coding: utf-8 -*-
import logging
import time
import json
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django.core.cache import cache
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import uuid_str_to_32_chars
from seahub.project.models import Projects
from seahub.project.utils import check_project_permission, check_ai_limit, delete_sessions
from seahub.project.seadb_api import SeaDBAPI
from seahub.utils.storage import upload_files_to_s3
from seahub.chats.constants import AI_REPLY_TIMEOUT
from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess
from seahub.chats.utils import get_ai_reply, gen_message_id, gen_chat_task_id, get_attachments, \
    record_message_to_db, process_stream_ai_reply, strip_content_details_from_attachments, \
    split_image_and_other_attachments, build_image_attachments, build_ai_images_payload, \
    ImageProcessingError, generate_session_title
from django.utils.translation import gettext as _
from seahub.utils.decorators import require_org_context
from seahub.project.constants import AIScenario

logger = logging.getLogger(__name__)

class ChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request):
        """Retrieve the user's chat session list"""
        # argument check
        project_uuid = request.GET.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session_type = request.GET.get('type', 'mine')
            
            if session_type == 'team':
                sessions = ChatSessions.objects.get_shared_sessions_by_project(project_uuid)
            else:
                sessions = ChatSessions.objects.get_sessions_by_project(project_uuid, username)
            
            sessions_data = [session.to_dict() for session in sessions]

            return Response({'sessions': sessions_data})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    @require_org_context
    def post(self, request):
        """Create a new chat session"""
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        session_name = request.data.get('session_name', '')
        if not session_name:
            error_msg = 'session_name parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.create_session(
                project_uuid=project_uuid,
                session_name=session_name,
                username=request.user.username
            )

            return Response({ 'session': session.to_dict() }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def put(self, request, session_uuid):
        """Modify chat session"""
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        session_name = request.data.get('session_name')
        is_shared = request.data.get('is_shared')

        if session_name is None and is_shared is None:
            error_msg = 'At least one of session_name or is_shared parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if str(session.project_uuid) != str(project_uuid):
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if session.username != username:
                error_msg = 'Permission denied. Only the session owner can modify this session.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if session_name is not None:
                session.session_name = session_name

            if is_shared is not None:
                session.is_shared = is_shared

            session.save()

            return Response({'success': True, 'session': session.to_dict()})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    @require_org_context
    def delete(self, request, session_uuid):
        """Delete chat session"""
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if str(session.project_uuid) != str(project_uuid):
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if session.username != username:
                error_msg = 'Permission denied. Only the session owner can delete this session.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            delete_sessions([session_uuid])
            return Response({'success': True})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatSessionTitleView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, session_uuid):
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if 'query' not in request.data:
            error_msg = 'query parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        query = request.data.get('query')

        if 'ai_reply' not in request.data:
            error_msg = 'ai_reply parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        ai_reply = request.data.get('ai_reply', '')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        session = ChatSessions.objects.get_session_by_uuid(session_uuid)
        if not session:
            error_msg = 'Session not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if str(session.project_uuid) != str(project_uuid):
            error_msg = 'Session not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if session.username != username:
            error_msg = 'Permission denied. Only the session owner can modify this session.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = request.user.org.org_id if hasattr(request.user, 'org') else -1
        session_name = generate_session_title(
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


class ChatSessionCopyView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, session_uuid):
        """Create a new chat session from an existing session history."""
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if str(session.project_uuid) != str(project_uuid):
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if session.username != username and not session.is_shared:
                error_msg = 'Permission denied. You can only copy your own sessions or shared team sessions.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if cache.get(gen_chat_task_id(session.session_uuid)) is not None:
                error_msg = 'There are unfinished tasks in the current session, please try again later.'
                return api_error(status.HTTP_409_CONFLICT, error_msg)

            new_session = ChatSessions.objects.copy_session(session, username)
            return Response({'session': new_session.to_dict()}, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatMessagesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, session_uuid):
        """Retrieve the message list of the chat session"""
        # argument check
        project_uuid = request.GET.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if str(session.project_uuid) != str(project_uuid):
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if session.username != username and not session.is_shared:
                error_msg = 'Permission denied. You can only access your own sessions or shared team sessions.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            messages = ChatMessages.objects.get_messages_by_session(session_uuid)

            message_ids = set([message.message_id for message in messages])

            message_id_thought_process_map = ChatMessageThoughtProcess.objects.get_thought_process_from_session_uuid_and_message_ids(session_uuid, message_ids)

            messages_data = []
            for message in messages:
                data = message.to_dict()
                if message.role == 'assistant':
                    thought_process = message_id_thought_process_map.get(message.message_id, {})
                    if thought_process:
                        data['thought_process'] = thought_process
                messages_data.append(data)
            chat_task_info = cache.get(gen_chat_task_id(session_uuid))
            results = {
                'session': session.to_dict(),
                'messages': messages_data,
                'running_task': chat_task_info is not None
            }
            if results['running_task']:
                 results['user_input'] = chat_task_info['user_input']
            return Response(results)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request):
        session_uuid = request.GET.get('session_uuid')
        if not session_uuid:
            error_msg = 'session_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            project = Projects.objects.get_project_by_uuid(session.project_uuid)
            if not project:
                error_msg = 'project not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            workspace = project.workspace
            username = request.user.username
            if not check_project_permission(username, workspace.owner):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if session.username != username and not session.is_shared:
                error_msg = 'Permission denied. You can only access your own sessions or shared team sessions.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            chat_task_id_info = gen_chat_task_id(session_uuid)
            while cache.get(chat_task_id_info) is not None:
                time.sleep(0.1)

            ai_reply = ChatMessages.objects.get_last_message_by_session(session_uuid).to_dict()
            result = {
                'ai_reply': ai_reply['content'],
                'ai_reply_message_id': ai_reply['id'],
                'sources': ai_reply['sources'],
                'session_uuid': session_uuid
            }

            result['thought_process'] = ChatMessageThoughtProcess.objects.get_thought_process_from_session_uuid_and_message_id(session_uuid, ai_reply['message_id'])

            return Response(result)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


    @require_org_context
    def post(self, request):
        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        query = request.data.get('query')
        if not query:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        clear_context = request.data.get('clear_context', False)
        if isinstance(clear_context, str):
            clear_context = clear_context.lower() == 'true'
        if not isinstance(clear_context, bool):
            error_msg = 'clear_context invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        stream = project.to_dict()['settings'].get('streaming_response', True)
        stream_from_request = request.data.get('stream')
        if stream_from_request is not None:
            if isinstance(stream_from_request, str):
                stream_from_request = stream_from_request.lower() == 'true'
            if not isinstance(stream_from_request, bool):
                error_msg = 'Invalid stream'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            stream = stream_from_request

        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # Check AI quota
        org_id = request.user.org.org_id if hasattr(request.user, 'org') else -1
        is_exceed = check_ai_limit(org_id)
        if is_exceed:
            error_msg = 'AI credit not enough.'
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, error_msg)

        raw_attachments = request.data.get('attachments', [])
        temp_image_paths, non_image_attachments = split_image_and_other_attachments(project_uuid, raw_attachments)
        # Extra contents
        try:
            attachments = get_attachments(SeaDBAPI(), project_uuid, non_image_attachments)
        except Exception as e:
            attachments = []
            logger.warning(f'Failure to get extra contents: {e}')

        session_uuid = request.data.get('session_uuid')
        if not session_uuid:
            session = ChatSessions.objects.create_session(project_uuid, _('New chat'), request.user.username)
            session_uuid = session.session_uuid
        else:
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = f'Chat session {session_uuid} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if str(session.project_uuid) != str(project_uuid):
                error_msg = f'Chat session {session_uuid} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            # Only the session owner can continue or clear context in this session.
            if session.username != username:
                if session.is_shared:
                    error_msg = 'Permission denied. Only the session owner can continue this chat. Start a new chat from this conversation to continue.'
                else:
                    error_msg = 'Permission denied. You can only access your own sessions or shared team sessions.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            elif clear_context:
                ChatMessages.objects.clear_context(session_uuid)
        
        chat_task_id_info = gen_chat_task_id(session_uuid)
        if cache.get(chat_task_id_info) is not None:
            error_msg = 'There are unfinished tasks in the current session, please try again later.'
            return api_error(status.HTTP_409_CONFLICT, error_msg)

        try:
            message_id = gen_message_id(session.session_uuid)
        except Exception as e:
            logger.exception(f'Failure to generate message id: {e}')
            error_msg = 'Internal server error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # Move user-uploaded images from /tmp to S3 and append to attachments
        permanent_image_paths = []
        if temp_image_paths:
            image_names = [path.rsplit('/', 1)[-1] for path in temp_image_paths if isinstance(path, str)]
            if len(image_names) != len(set(image_names)):
                return api_error(status.HTTP_400_BAD_REQUEST, _('Images with the same name are not allowed.'))
            try:
                record_id = f'{session.session_uuid}/{message_id}'
                new_url_map = upload_files_to_s3(project_uuid, temp_image_paths, username, 'chat', record_id)
                permanent_image_paths = list(new_url_map.keys())
            except Exception as e:
                logger.exception(f'Failed to upload images to S3: {e}')
                return api_error(status.HTTP_400_BAD_REQUEST, 'Failed to upload image. Please try again.')

            if len(permanent_image_paths) != len(temp_image_paths):
                logger.warning(
                    f'Image upload incomplete: requested={len(temp_image_paths)} succeeded={len(permanent_image_paths)}'
                )
                return api_error(status.HTTP_400_BAD_REQUEST, 'Failed to upload image. Please try again.')

            attachments = attachments + build_image_attachments(permanent_image_paths)

        # Read project-level custom prompt from settings
        project_prompt = ''
        if project.settings:
            try:
                project_settings = json.loads(project.settings)
                project_prompt = project_settings.get('prompt', '')
            except json.JSONDecodeError:
                pass

        try:
            ai_images_payload = build_ai_images_payload(project_uuid, permanent_image_paths)
        except ImageProcessingError as e:
            logger.warning(f'Image processing failed: {e}')
            return api_error(status.HTTP_400_BAD_REQUEST, str(e))

        image_data_by_name = {img['name']: img for img in ai_images_payload}
        ai_attachments = []
        for a in attachments:
            if isinstance(a, dict) and a.get('type') == 'image':
                # a: {type:'image', path, name}
                # extra: {name, mime_type, data(base64)}
                # {**a, **extra}: {type:'image', path, name, mime_type, data}
                extra = image_data_by_name.get(a.get('name'), {})
                ai_attachments.append({**a, **extra})
            else:
                # a: {type, record_id, content/comments/emails, ...}
                ai_attachments.append(a)

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'session_uuid': session.session_uuid,
            'query': query,
            'attachments': ai_attachments,
            'org_id': org_id,
            'scenario': AIScenario.CHAT.value,
            'llm_model': request.data.get('model'),
            'stream': stream,
            'project_prompt': project_prompt,
            'username': username # used for kb generator
        }

        task_info = {
            'user_input': {
                'message': query,
                'attachments': strip_content_details_from_attachments(attachments)
            }
        }

        cache.set(chat_task_id_info, task_info, AI_REPLY_TIMEOUT)

        if stream:
            try:
                return StreamingHttpResponse(
                    process_stream_ai_reply(chat_task_id_info, get_ai_reply(params), session_uuid, message_id, query, attachments),
                    content_type='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no'
                    }
                )
            except Exception as e:
                # the exceptions in process_stream_ai_reply will not be catched in here, so it should be a 500 error
                logger.exception(f'Failure to make stream: {e}')
                error_msg = 'Internal server error'
                cache.delete(chat_task_id_info)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # non-stream response
        try:
            ai_response = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_response = {
                'ai_reply': 'Sorry, the AI service is temporarily unavailable, please try again later.',
                'sources': []
            }

        response = record_message_to_db(ai_response, session_uuid, message_id, query, attachments)
        cache.delete(chat_task_id_info)
        return Response(response)

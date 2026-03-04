import uuid
import logging
import json

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import uuid_str_to_32_chars
from seahub.project.models import Projects, ProjectConnections
from seahub.project.utils import check_same_org_permission, check_ai_limit, delete_portal_sessions
from seahub.utils.decorators import require_org_context
from seahub.portal.models import PortalChatSessions, PortalChatMessages
from seahub.chats.utils import get_ai_reply

logger = logging.getLogger(__name__)


# Default chat allowed source types for portal
DEFAULT_CHAT_ALLOWED_SOURCES = ['site', 'seafile', 'github_issue', 'discourse_forum']


def get_portal_settings(project):
    settings = project.settings or '{}'
    if isinstance(settings, str):
        try:
            settings = json.loads(settings)
        except:
            settings = {}
    portal_settings = settings.get('portal', {})
    return {
        'chat_allowed_sources': portal_settings.get('chat_allowed_sources', DEFAULT_CHAT_ALLOWED_SOURCES),
    }


def get_project_or_error(project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
    return project, None


def check_portal_permission(user, project):
    if not check_same_org_permission(user, project.workspace):
        return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
    return None


def get_session_or_error(session_uuid, username):
    session = PortalChatSessions.objects.get_session_by_uuid(session_uuid)
    if not session:
        return None, api_error(status.HTTP_404_NOT_FOUND, 'Session not found.')
    if session.username != username:
        return None, api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
    return session, None


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


class PortalChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        error = check_portal_permission(request.user, project)
        if error:
            return error

        try:
            sessions = PortalChatSessions.objects.get_sessions_by_project(project_uuid, request.user.username)
            sessions_data = [session.to_dict() for session in sessions]
            return Response({'sessions': sessions_data})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @require_org_context
    def post(self, request, project_uuid):
        """Create a new portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        error = check_portal_permission(request.user, project)
        if error:
            return error

        try:
            session = PortalChatSessions.objects.create_session(
                project_uuid=project_uuid,
                session_name=session_name,
                username=request.user.username,
            )
            return Response({'session': session.to_dict()}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def put(self, request, project_uuid, session_uuid):
        """Modify portal chat session"""
        session_name = request.data.get('session_name', '')
        if not session_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'session_name parameter is required.')

        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        error = check_portal_permission(request.user, project)
        if error:
            return error

        session, error = get_session_or_error(session_uuid, request.user.username)
        if error:
            return error

        try:
            session.session_name = session_name
            session.save()
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    @require_org_context
    def delete(self, request, project_uuid, session_uuid):
        """Delete portal chat session"""
        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        error = check_portal_permission(request.user, project)
        if error:
            return error

        session, error = get_session_or_error(session_uuid, request.user.username)
        if error:
            return error

        try:
            delete_portal_sessions([session_uuid])
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatMessagesView(APIView):
    """Portal Chat Messages API - Get message history"""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, session_uuid):
        """Retrieve the message list of the portal chat session"""
        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        error = check_portal_permission(request.user, project)
        if error:
            return error

        session, error = get_session_or_error(session_uuid, request.user.username)
        if error:
            return error

        try:
            messages = PortalChatMessages.objects.get_messages_by_session(session_uuid)
            messages_data = [message.to_dict() for message in messages]
            return Response({'messages': messages_data})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class PortalChatView(APIView):
    """Portal Chat API - Send message and get AI reply"""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
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

        project, error = get_project_or_error(project_uuid)
        if error:
            return error

        error = check_portal_permission(request.user, project)
        if error:
            return error

        username = request.user.username
        session, error = get_session_or_error(session_uuid, username)
        if error:
            return error

        if clear_context:
            PortalChatMessages.objects.clear_context(session_uuid, username)

        # Check AI quota
        org_id = request.user.org.org_id if hasattr(request.user, 'org') else -1
        if check_ai_limit(username, org_id):
            return api_error(status.HTTP_402_PAYMENT_REQUIRED, 'AI credit not enough.')

        model = request.data.get('model')

        try:
            message_id = gen_portal_message_id(session.session_uuid)
        except Exception as e:
            logger.exception(f'Failure to generate message id: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal server error')

        portal_settings = get_portal_settings(project)
        allowed_sources = portal_settings['chat_allowed_sources']
        connections = ProjectConnections.objects.filter(project=project, deleted=False, is_active=True)
        document_connections = []
        issue_connections = []
        for connection in connections:
            if connection.type not in allowed_sources:
                continue
            if connection.type in ('seafile', 'site'):
                document_connections.append({'type': connection.type, 'id': connection.pk})
            else:
                issue_connections.append({'type': connection.type, 'id': connection.pk})

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'session_uuid': session.session_uuid,
            'message_id': message_id,
            'query': query,
            'attachments': [],
            'username': username,
            'org_id': org_id,
            'llm_model': model,
            'document_connections': document_connections,
            'issue_connections': issue_connections,
            'is_external_portal': True
        }

        try:
            ai_response = get_ai_reply(params)
        except Exception as e:
            logger.warning(f'AI service error: {e}')
            ai_response = {
                'ai_reply': 'Sorry, the AI service is temporarily unavailable, please try again later.',
            }

        # Save messages
        user_message = PortalChatMessages.objects.create_message(
            session.session_uuid, message_id, username, 'user', query
        )
        ai_reply_message = PortalChatMessages.objects.create_message(
            session.session_uuid, message_id, username, 'assistant',
            ai_response['ai_reply']
        )

        return Response({
            'ai_reply': ai_response['ai_reply'],
            'session_uuid': session_uuid,
            'user_message_id': user_message.id,
            'ai_reply_message_id': ai_reply_message.id,
        })



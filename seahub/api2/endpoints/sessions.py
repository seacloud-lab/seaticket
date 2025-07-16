# Copyright (c) 2012-2019 Seafile Ltd.
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.db.models import Q

from seahub.auth.models import SessionLog
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from datetime import datetime, timedelta, UTC
from django.contrib.sessions.models import Session
from seahub.base.templatetags.seahub_tags import email2nickname
from user_agents import parse


logger = logging.getLogger(__name__)


def get_user_agent_info(user_agent):
    ua = parse(user_agent)
    browser_family = ua.browser.family
    browser_version = ua.browser.version_string
    browser_info = browser_family + ' ' + browser_version

    os_family = ua.os.family
    os_version = ua.os.version_string
    os_info = os_family + ' ' + os_version
    return {'browser_info': browser_info, 'os_info': os_info}


class SessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """ List online sessions """

        session_key = request.session.session_key
        username = request.user.username
        show_num = 25

        try:
            log_sessions = SessionLog.objects.filter(user_name=username).order_by('-op_time')[0:show_num]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        session_key_list = [session.session_key for session in log_sessions if session.session_key]
        session_key_id_map = {session.session_key: session.id for session in log_sessions if session.session_key}
        try:
            online_sessions = Session.objects.filter(expire_date__gte=datetime.now(UTC), session_key__in=session_key_list).order_by('-expire_date')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return_results = []
        online_session_key_info = {}
        for session in online_sessions:
            session_dict = {'user_name': email2nickname(session.get_decoded().get('_auth_user_name', '')),
                            'user_agent': get_user_agent_info(session.get_decoded().get('user_agent', '')),
                            'remote_address': session.get_decoded().get('remote_address', ''),
                            'op_time': session.get_decoded().get('op_time', ''),
                            'session_id': session_key_id_map[session.session_key],
                            'is_online': True,
                            'is_self': session.session_key == session_key,
                            }
            online_session_key_info[session.session_key] = True
            return_results.append(session_dict)

        # history session
        if len(online_sessions) < show_num:
            for session in log_sessions:
                if not session.session_key or not online_session_key_info.get(session.session_key):
                    session_dict = {'user_name': email2nickname(session.user_name),
                                    'user_agent': get_user_agent_info(session.user_agent),
                                    'remote_address': session.remote_address,
                                    'op_time': session.op_time,
                                    'is_online': False,
                                    'session_id': session.id
                                    }
                    return_results.append(session_dict)

        return Response({"sessions": return_results})


class SessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, session_id):

        try:
            log_session = SessionLog.objects.filter(id=session_id, user_name=request.user.username)
            log_session.delete()
        except Session.DoesNotExist:
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True})


class OnlineSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, session_id):
        """ delete session """
        log_session = SessionLog.objects.filter(id=session_id)[0]
        if log_session:
            session_key = log_session.session_key
        else:
            session_key = ''
        try:
            session = Session.objects.get(session_key=session_key)
            session.delete()
        except Session.DoesNotExist:
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)

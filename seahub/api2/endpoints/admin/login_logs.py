# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.permissions import IsProVersion
from seahub.api2.utils import api_error
from seahub.sysadmin_extra.models import UserLoginLog
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.api2.endpoints.utils import get_user_name_dict, get_user_contact_email_dict
from seahub.utils.timeutils import datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)


class AdminLogsLoginLogs(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """ Get all login logs.
        Permission checking:
        1. only admin can perform this action.
        """
        if not request.user.admin_permissions.can_view_user_log():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            current_page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

        logs = UserLoginLog.objects.all().order_by('-login_date')[start:end]
        count = UserLoginLog.objects.all().count()

        nickname_dict = {}
        contact_email_dict = {}
        user_email_set = set([log.username for log in logs])
        for e in user_email_set:
            if e not in nickname_dict:
                nickname_dict[e] = email2nickname(e)
            if e not in contact_email_dict:
                contact_email_dict[e] = email2contact_email(e)

        logs_info = []
        for log in logs:
            data = dict()
            user_email = log.username
            data['login_time'] = datetime_to_isoformat_timestr(log.login_date)
            data['login_ip'] = log.login_ip
            data['log_success'] = log.login_success
            data['name'] = nickname_dict.get(user_email, '')
            data['email'] = user_email
            data['contact_email'] = contact_email_dict.get(user_email, '')
            logs_info.append(data)

        resp = {'login_log_list': logs_info, 'total_count': count}

        return Response(resp)


class AdminLoginLogs(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def _get_admin_user_emails(self):

        admin_users = ccnet_api.get_superusers()
        admin_user_emails = []
        for user in admin_users:
            admin_user_emails.append(user.email)

        return admin_user_emails

    def _get_response_data(self, logs):

        user_list = []
        for log in logs:
            user_list.append(log.username)

        name_dict = get_user_name_dict(user_list)
        contact_email_dict = get_user_contact_email_dict(user_list)

        data = []
        for log in logs:
            email = log.username
            data.append({
                'login_time': datetime_to_isoformat_timestr(log.login_date),
                'login_ip': log.login_ip,
                'login_success': log.login_success,
                'email': email,
                'name': name_dict[email],
                'contact_email': contact_email_dict[email],
            })

        return data

    def get(self, request):
        # permission check
        if not request.user.admin_permissions.can_view_admin_log():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            page = 1
            per_page = 100

        if page <= 0:
            error_msg = 'page invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if per_page <= 0:
            error_msg = 'per_page invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        offset = per_page * (page - 1)
        admin_user_emails = self._get_admin_user_emails()
        all_logs = UserLoginLog.objects.filter(username__in=admin_user_emails)

        total_count = all_logs.count()
        logs = all_logs[offset:offset+per_page]

        data = self._get_response_data(logs)
        result = {'data': data, 'total_count': total_count}
        resp = Response(result)

        return resp

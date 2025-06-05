# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from seaserv import ccnet_api, seafile_api

from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error
from seahub.api2.endpoints.utils import get_user_name_dict, get_user_contact_email_dict, is_org_user
from seahub.profile.models import Profile
from seahub.sysadmin_extra.models import UserLoginLog
from seahub.utils.timeutils import datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)


def get_log_datas(logs):
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

class OrgAdminUserLoginLogs(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)


    def _get_org_user_login_strs(self, org):
        # including email, contact_email, login_id, phone number

        org_members = ccnet_api.get_org_users_by_url_prefix(org.url_prefix, -1, -1)
        org_user_emails = []

        for m in org_members:
            org_user_emails.append(m.email)

        login_strs = org_user_emails
        user_profiles = Profile.objects.filter(user__in=org_user_emails)
        for p in user_profiles:
            login_strs.extend([p.contact_email, p.login_id, p.phone])

        return login_strs

    def get(self, request, org_id):
        """List organization user
        """
        # resource check

        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        org = request.user.org
        if org.org_id != org_id:
            error_msg = 'Organization invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
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
        login_strs = self._get_org_user_login_strs(org)
        all_logs = UserLoginLog.objects.filter(username__in=login_strs)

        total_count = all_logs.count()
        logs = all_logs[offset: offset+per_page]

        data = get_log_datas(logs)
        result = {'login_list': data, 'total_count': total_count}
        resp = Response(result)

        return resp

class OrgAdminUserLoginLog(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id, email):
        """List organization user
        """
        # resource check

        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        org = request.user.org
        if org.org_id != org_id:
            error_msg = 'Organization invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        org_name = org.org_name
        if not is_org_user(email, org_id):
            error_msg = 'User %s is not member of organization %s.' % (email, org_name)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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

        login_strs = [email, ]
        user_profile = Profile.objects.get_profile_by_user(email)
        if user_profile:
            login_strs.extend([user_profile.contact_email, user_profile.login_id, user_profile.phone])

        offset = per_page * (page - 1)
        all_logs = UserLoginLog.objects.filter(username__in=login_strs)

        total_count = all_logs.count()
        logs = all_logs[offset: offset+per_page]

        data = get_log_datas(logs)
        result = {'data': data, 'total_count': total_count}
        resp = Response(result)

        return resp

# -*- coding: utf-8 -*-
import logging
from datetime import datetime

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import ccnet_threaded_rpc, ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.utils import get_daily_active_users, is_pro_version, DTABLE_EVENTS_ENABLED

logger = logging.getLogger(__name__)


def get_daily_active_user_info(email, org_id):
    email_user = ccnet_threaded_rpc.get_emailuser(email)
    if not email_user:
        return None
    url, is_default, date_uploaded = api_avatar_url(email)

    user_info = dict()
    user_info['avatar_url'] = url
    user_info['email'] = email
    user_info['contact_email'] = email2contact_email(email)
    user_info['name'] = email2nickname(email)
    user_info['reg_date'] = datetime.fromtimestamp(email_user.ctime / 1000000)
    if org_id != -1:
        org = ccnet_api.get_org_by_id(org_id)
        user_info['org_id'] = org_id
        user_info['org_name'] = org.org_name

    return user_info


class DailyActiveUsersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        if not is_pro_version() or not DTABLE_EVENTS_ENABLED:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Events not enabled.')

        # argument check
        date = request.GET.get('date', '')
        if not date:
            error_msg = 'date invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            page = int(request.GET.get('page', ''))
            per_page = int(request.GET.get('per_page', ''))
        except ValueError:
            page = 1
            per_page = 25

        start = (page - 1) * per_page
        count = per_page

        # format date str
        try:
            date_day = datetime.strptime(date, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            error_msg = 'date %s invalid' % date
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        if not request.user.admin_permissions.can_view_statistic():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            active_users, total_count = get_daily_active_users(date_day, start, count)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        active_user_list = list()
        for active_user in active_users:
            user_info = get_daily_active_user_info(active_user.username, active_user.org_id)
            if not user_info:
                continue
            active_user_list.append(user_info)

        result = {
            'active_user_list': active_user_list,
            'page': page,
            'total_count': total_count
        }

        return Response(result)

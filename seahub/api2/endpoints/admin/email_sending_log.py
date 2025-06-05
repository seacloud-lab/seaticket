# Copyright (c) 2012-2016 Seafile Ltd.
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
import logging
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error

from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.utils import DTABLE_EVENTS_ENABLED, get_email_sending_logs
from seahub.utils.timeutils import utc_datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)

def get_email_sending_log_detail(log):
    return {
        'create_time': utc_datetime_to_isoformat_timestr(log.timestamp),
        'name': email2nickname(log.username),
        'host': log.host,
        'success': log.success
    }

class EmailSendingLogsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        if not DTABLE_EVENTS_ENABLED:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Events not enabled.')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except ValueError:
            page = 1
            per_page = 25

        start, end = (page - 1) * per_page, page * per_page
        try:
            logs, count = get_email_sending_logs(start, end)
        except Exception as e:
            logger.error(e)
            err_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, err_msg)
        return Response({
            'email_sending_logs': [get_email_sending_log_detail(log) for log in logs],
            'count': count
        })

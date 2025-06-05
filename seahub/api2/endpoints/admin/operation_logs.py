import json
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.urls import reverse

from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.admin_log.models import AdminLog, ADMIN_LOG_OPERATION_TYPE

from seahub.api2.permissions import IsProVersion
from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.admin_log.models import USER_DELETE, GROUP_TRANSFER

logger = logging.getLogger(__name__)

def get_log_info(log_obj):
    detail = json.loads(log_obj.detail)
    operation = log_obj.operation

    if operation == GROUP_TRANSFER:
        detail['from_nickname'] = email2nickname(detail.get('from'))
        detail['to_nickname'] = email2nickname(detail.get('to'))
    if "username" in detail:
        detail["name"] = email2nickname(detail["username"])
    log_info = {
        "email": log_obj.email,
        "name": email2nickname(log_obj.email),
        "operation": log_obj.operation,
        "detail": detail,
        "datetime": datetime_to_isoformat_timestr(log_obj.datetime),
    }

    return log_info


class AdminOperationLogs(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request):
        """ List all logs

        Permission checking:
        1. Admin user;
        """
        # permission check
        if not request.user.admin_permissions.can_view_admin_log():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        email = request.GET.get('email', '')
        operation = request.GET.get('operation', '')
        if operation:
            if operation not in ADMIN_LOG_OPERATION_TYPE:
                error_msg = 'operation invalid.'
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

        # generate data result
        data = []
        offset = per_page * (page -1)
        total_count = AdminLog.objects.get_admin_logs(email=email, operation=operation).count()
        admin_logs = AdminLog.objects.get_admin_logs(email=email, operation=operation)[offset:offset+per_page]

        for log in admin_logs:
            log_info = get_log_info(log)
            data.append(log_info)

        result = {'data': data, 'total_count': total_count}
        resp = Response(result)

        return resp

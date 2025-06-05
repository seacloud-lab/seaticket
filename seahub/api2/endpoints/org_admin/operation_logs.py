import json
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import ccnet_api

from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.admin_log.models import OrgAdminLog

from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.admin_log.models import USER_DELETE, USER_ADD, GROUP_TRANSFER


logger = logging.getLogger(__name__)


def get_log_info(log_obj):
    detail = json.loads(log_obj.detail)
    operation = log_obj.operation

    if operation == GROUP_TRANSFER:
        detail['from_nickname'] = email2nickname(detail.get('from'))
        detail['to_nickname'] = email2nickname(detail.get('to'))
    elif operation == USER_ADD:
        detail['nickname'] = email2nickname(detail.get('username'))

    log_info = {
        "email": log_obj.email,
        "name": email2nickname(log_obj.email),
        "operation": log_obj.operation,
        "detail": detail,
        "datetime": datetime_to_isoformat_timestr(log_obj.datetime),
    }

    return log_info


class OrgAdminOperationLogs(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id):
        # resource check
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

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
        logs = []
        offset = per_page * (page - 1)
        try:
            total_count = OrgAdminLog.objects.get_admin_logs(org_id).count()
            admin_logs = OrgAdminLog.objects.get_admin_logs(org_id)[offset:offset+per_page]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        for log in admin_logs:
            log_info = get_log_info(log)
            logs.append(log_info)

        result = {'logs': logs, 'total_count': total_count}
        resp = Response(result)

        return resp

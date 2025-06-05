import logging
import os

from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.audit_log.models import AuditLog, FileAccessLog
from seahub.dtable.models import DTables

from seahub.api2.permissions import IsProVersion, IsOrgAdminUser, CanUseAdvancedPerms
from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication

logger = logging.getLogger(__name__)

class OrgAdminAuditLogs(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id):
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

        # resource check
        org_id = int(org_id)

        # generate data result
        data = []
        offset = per_page * (page - 1)
        logs_obj = AuditLog.objects.get_audit_logs(org_id=org_id)
        total_count = logs_obj.count()
        audit_logs = logs_obj[offset : offset + per_page]

        for log in audit_logs:
            log_info = log.to_dict()
            data.append(log_info)

        result = {'audit_log_list': data, 'count': total_count}
        resp = Response(result)

        return resp


class OrgAdminFileAccessLogsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (CanUseAdvancedPerms, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id):
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

        # permission check
        if not request.user.admin_permissions.can_view_audit_log():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # generate data result
        data = []
        offset = per_page * (page - 1)
        logs_obj = FileAccessLog.objects.get_file_access_logs(org_id=org_id)
        total_count = logs_obj.count()
        file_access_logs = logs_obj[offset: offset + per_page]

        dtable_uuids = set()
        for log in file_access_logs:
            log_info = log.to_dict()
            dtable_uuids.add(log_info['dtable_uuid'])
            data.append(log_info)

        dtable_queryset = DTables.objects.filter(uuid__in=dtable_uuids)
        dtable_info_dict = {str(d.uuid): d.name for d in dtable_queryset}

        events_info = []
        for ev in file_access_logs:
            data = ev.to_dict()
            data['dtable_name'] = dtable_info_dict.get(ev.dtable_uuid)
            events_info.append(data)

        resp = {
            'file_access_log_list': events_info,
            'count': total_count
        }

        return Response(resp)

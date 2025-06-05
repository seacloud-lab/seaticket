import logging
import os

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.audit_log.models import AuditLog, FileAccessLog
from seahub.dtable.models import DTables

from seahub.api2.permissions import IsProVersion, CanUseAdvancedPerms
from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.ccnet_db.ccnet.organizations import get_orgs_base_info

logger = logging.getLogger(__name__)


class AdminAuditLogsView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request):
        """ List all logs

        Permission checking:
        1. Admin user;
        """
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
        logs_obj = AuditLog.objects.get_audit_logs()
        total_count = logs_obj.count()
        audit_logs = logs_obj[offset : offset + per_page]

        org_ids = set()
        for log in audit_logs:
            log_info = log.to_dict()
            org_ids.add(log_info['org_id'])
            data.append(log_info)

        org_infos = get_orgs_base_info(list(org_ids))
        for log_info in data:
            org_id = log_info['org_id']
            log_info['org_name'] = org_infos[org_id]['org_name'] if org_id in org_infos else ''

        result = {'audit_log_list': data, 'count': total_count}
        resp = Response(result)

        return resp


class AdminFileAccessLogsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, CanUseAdvancedPerms)

    def get(self, request):
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
        logs_obj = FileAccessLog.objects.get_file_access_logs()
        total_count = logs_obj.count()
        file_access_logs = logs_obj[offset: offset + per_page]

        org_ids = set()
        dtable_uuids = set()
        for log in file_access_logs:
            log_info = log.to_dict()
            org_ids.add(log_info['org_id'])
            dtable_uuids.add(log_info['dtable_uuid'])
            data.append(log_info)

        orgs_info = get_orgs_base_info(list(org_ids))
        dtable_queryset = DTables.objects.filter(uuid__in=dtable_uuids)
        dtable_info_dict = {str(d.uuid): d.name for d in dtable_queryset}

        events_info = []
        for ev in file_access_logs:
            data = ev.to_dict()
            data['dtable_name'] = dtable_info_dict.get(ev.dtable_uuid)
            data['org_name'] = orgs_info.get(ev.org_id, {}).get('org_name', '')
            events_info.append(data)

        resp = {
            'file_access_log_list': events_info,
            'count': total_count
        }

        return Response(resp)

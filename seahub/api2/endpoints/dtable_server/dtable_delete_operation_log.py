import json
import logging
from datetime import datetime, timedelta

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, DeleteOperationLog
from seahub.dtable.utils import is_valid_jwt, check_dtable_permission
from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_ADMIN

logger = logging.getLogger(__name__)

WRITE_PERMISSION_TUPLE = (PERMISSION_READ_WRITE, PERMISSION_ADMIN)

class DTableDeleteOperationLogsView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        # arguments
        op_type = request.GET.get('op_type', None)

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth, dtable_uuid):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        start, limit = (page - 1) * per_page, per_page
        operation_logs_queryset = DeleteOperationLog.objects.filter(dtable_uuid=dtable.uuid.hex)
        if op_type:
            operation_logs_queryset = operation_logs_queryset.filter(op_type=op_type)
        operation_logs = [operation_log.to_dict() for operation_log in operation_logs_queryset[start: start+limit]]

        return Response({
            'delete_operation_logs': operation_logs,
            'count': operation_logs_queryset.count()
        })
    
class DTableDeleteOperationLogView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle, )

    def delete(self, request, dtable_uuid, log_id):
        try:
            log_id = int(log_id)
        except Exception:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid log_id.')
        
        # resources check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        if check_dtable_permission(payload.get('username', ''), dtable.workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        logs = DeleteOperationLog.objects.filter(pk=log_id)
        if not logs:
            return api_error(status.HTTP_404_NOT_FOUND, 'Log not found.')
        
        log = logs.first()
        
        try:
            log.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Delete record failure')
        
        return Response({
            'success': True
        })

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, DTableOperationLogs
from seahub.dtable.utils import is_valid_jwt
from seahub.utils import uuid_str_to_32_chars

logger = logging.getLogger(__name__)
KEY_OPERATION_LOG = 'operation_log'

class DTableOprationLogsView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    
    def get(self, request, dtable_uuid):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 100))
        except:
            page, per_page = 1, 100

        if per_page > 500:
            per_page = 500
        
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        
        start, limit = (page - 1) * per_page, per_page

        if not getattr(settings, 'ENABLE_OPERATION_LOG_DB', False):
            queryset = DTableOperationLogs.objects.filter(dtable_uuid=uuid_str_to_32_chars(dtable_uuid))
        else:
            queryset = DTableOperationLogs.objects.using(KEY_OPERATION_LOG).filter(dtable_uuid=uuid_str_to_32_chars(dtable_uuid))

        res = [q.to_dict() for q in queryset[start: start + limit]]
        return Response({'operations': res})

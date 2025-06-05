import logging, json

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable.models import DTables
from seahub.dtable.utils import is_valid_jwt
from seahub.settings import INNER_DTABLE_DB_URL

logger = logging.getLogger(__name__)
KEY_OPERATION_LOG = 'big_dataoperation_log'

class DTableBigDataOprationLogsView(APIView):
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
        '''
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid = is_valid_jwt(auth, dtable_uuid)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        '''
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        dtable_db_api = DTableDBAPI(request.user.username, dtable_uuid, INNER_DTABLE_DB_URL)
        try:
            results = dtable_db_api.query_operation_logs(page, per_page)
            for res in results:
                res['operation'] = json.loads(res['operation'])
                res['operation']['op_type'] = res['op_type']
                del res['op_type']
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'operations': results})

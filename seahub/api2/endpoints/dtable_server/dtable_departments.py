import json
import logging
from datetime import datetime, timedelta

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.department_v2.models import DepartmentsV2
from seahub.dtable.models import DTables
from seahub.dtable.utils import is_valid_jwt
from seahub.utils import uuid_str_to_32_chars

logger = logging.getLogger(__name__)

class DTableDepartmentsView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        org_id = dtable.workspace.org_id
        departments = DepartmentsV2.objects.filter(org_id=org_id).order_by('id')
        department_infos = [department.to_dict() for department in departments]
        return Response({'departments': department_infos})

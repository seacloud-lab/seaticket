# -*- coding: utf-8 -*-

import logging
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

import seaserv
from seaserv import ccnet_api

from seahub.api2.utils import api_error
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.group.utils import is_group_member

logger = logging.getLogger(__name__)


class Departments(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """list all departments
        """

        try:
            departments = ccnet_api.list_all_departments()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        result = []
        for department in departments:
            department = seaserv.get_group(department.id)

            username = request.user.username
            if not is_group_member(department.id, username):
                continue

            created_at = timestamp_to_isoformat_timestr(department.timestamp)

            department_info = {
                "id": department.id,
                "email": '%s@seafile_group' % str(department.id),
                "parent_group_id": department.parent_group_id,
                "name": department.group_name,
                "owner": department.creator_name,
                "created_at": created_at,
            }

            result.append(department_info)

        return Response(result)

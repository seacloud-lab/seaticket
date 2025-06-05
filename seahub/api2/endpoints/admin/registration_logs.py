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
from seahub.invitations.models import RegistrationLogs
import datetime
logger = logging.getLogger(__name__)

class RegistrationLogsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        source = request.GET.get('source', None)
        register_date = request.GET.get('register_date', None)

        try:
            page = int(request.data.get('page', 1))
            per_page = int(request.data.get('per_page', 25))
        except:
            error_msg = 'per_page or page invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        start, end = (page - 1) * per_page, page * per_page
        try:
            if not register_date:
                register_date = datetime.datetime.now()
            elif isinstance(register_date, str):
                register_date = datetime.datetime.strptime(register_date, "%Y-%m-%d")
            if register_date and source == 'invitation':
                invitation_logs = RegistrationLogs.objects.get_invitation_infos_by_date(register_date)
            else:
                invitation_logs = RegistrationLogs.objects.all()[start: end]
        except Exception as e:
            logger.error(e)
            err_msg = 'Internal server error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, err_msg)

        return Response({
            'invitation_logs': [log.to_dict() for log in invitation_logs]
        })

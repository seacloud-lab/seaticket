# Copyright (c) 2012-2019 Seafile Ltd.
import logging
import datetime

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.constants import ABUSE_TYPE_LIST
from seahub.dtable.models import DTableExternalLinks, DTableAbuseReport

logger = logging.getLogger(__name__)


class AbuseReports(APIView):
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        reporter = request.data.get('reporter')
        if not reporter:
            return api_error(status.HTTP_400_BAD_REQUEST, 'reporter invalid.')

        abuse_type = request.data.get('abuse_type')
        if not abuse_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'abuse_type invalid.')

        abuse_type = abuse_type.lower()
        if abuse_type not in ABUSE_TYPE_LIST:
            return api_error(status.HTTP_400_BAD_REQUEST, 'abuse_type invalid.')

        external_link_token = request.data.get('external_link_token')
        if not external_link_token:
            return api_error(status.HTTP_400_BAD_REQUEST, 'external_link_token invalid.')

        description = request.data.get('description', '')

        try:
            external_link =  DTableExternalLinks.objects.get(token=external_link_token)
        except DTableExternalLinks.DoesNotExist:
            external_link = None

        if DTableAbuseReport.objects.filter(abuse_type=abuse_type,
                                            reporter=reporter,
                                            external_link_token=external_link_token
                                            ).exists():
            return api_error(status.HTTP_400_BAD_REQUEST, 'same report exists.')

        try:
            DTableAbuseReport.objects.create(
                reporter=reporter,
                external_link_token=external_link_token,
                abuse_type=abuse_type,
                description=description,
                dtable_uuid=external_link.dtable.uuid.hex if external_link else '',
                handled=False,
                create_time=datetime.datetime.now(),
            )
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})



# Copyright (c) 2012-2019 Seafile Ltd.
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.core.cache import cache

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.constants import ABUSE_TYPE_LIST
from seahub.dtable.models import DTableAbuseReport, DTables

logger = logging.getLogger(__name__)


def get_abuse_report_response_data(abuse_report):
    data = abuse_report.to_dict()
    dtable_name = cache.get(abuse_report.dtable_uuid)
    if not dtable_name:
        try:
            dtable = DTables.objects.filter(uuid=abuse_report.dtable_uuid).first()
        except Exception as e:
            logger.error(e)
        dtable_name = dtable.name if dtable else 'base deleted'
        cache.set(abuse_report.dtable_uuid, dtable_name, 60 * 60 * 24)
    data['dtable_name'] = dtable_name
    return data


class AdminAbuseReports(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        """ List abuse reports

            optional: filter by `abuse_type` or `handled`
        """
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page
        abuse_type = request.GET.get('abuse_type')
        if abuse_type and abuse_type not in ABUSE_TYPE_LIST:
            return api_error(status.HTTP_400_BAD_REQUEST, 'abuse_type invalid.')

        handle = request.GET.get('handled')
        if handle:
            handle = handle.lower()
            if handle not in ['true', 'false']:
                return api_error(status.HTTP_400_BAD_REQUEST, 'handled invalid.')

        try:
            abuse_report_count = DTableAbuseReport.objects.count()
            if abuse_type and not handle:
                abuse_reports = DTableAbuseReport.objects.filter(abuse_type=abuse_type).order_by('-create_time')[start:end]
            elif handle and not abuse_type:
                abuse_reports = DTableAbuseReport.objects.filter(handle=(True if handle == 'true' else False)).order_by('-create_time')[start:end]
            elif abuse_type and handle:
                abuse_reports = DTableAbuseReport.objects.filter(abuse_type=abuse_type, handle=(True if handle == 'true' else False)).order_by('-create_time')[start:end]
            else:
                abuse_reports = DTableAbuseReport.objects.all().order_by('-create_time')[start:end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        has_next_page = True if abuse_report_count > end else False

        abuse_report_list = []
        for abuse_report in abuse_reports:
            abuse_report_list.append(get_abuse_report_response_data(abuse_report))

        return Response({
            'abuse_report_list': abuse_report_list,
            'has_next_page': has_next_page,
        })


class AdminAbuseReport(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def put(self, request, report_id):
        """ update handled state
        """
        handled = request.data.get('handled')
        if not handled:
            return api_error(status.HTTP_400_BAD_REQUEST, 'handled invalid.')

        handled = handled.lower()
        if handled not in ['true', 'false']:
            return api_error(status.HTTP_400_BAD_REQUEST, 'handled invalid.')
        try:
            abuse_report = DTableAbuseReport.objects.get(id=report_id)
            abuse_report.handled = True if handled == 'true' else False
            abuse_report.save()
        except DTableAbuseReport.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'report not found.')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(get_abuse_report_response_data(abuse_report))


# Copyright (c) 2012-2019 Seafile Ltd.

import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTableExternalApps, DTables
from seahub.utils import uuid_str_to_36_chars
from seaserv import ccnet_api

logger = logging.getLogger(__name__)


class AdminOrgExternalApps(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request, org_id):

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        start, end = (page - 1) * per_page, page * per_page
        try:
            external_apps_count = DTableExternalApps.objects.filter(org_id=org_id).count()
            external_apps = DTableExternalApps.objects.filter(org_id=org_id).order_by('-created_at')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        external_app_list = [external_app.to_dict() for external_app in list(external_apps)]

        dtable_uuid_list = list(set([external_app['dtable_uuid'] for external_app in external_app_list]))
        try:
            dtables = DTables.objects.filter(uuid__in=dtable_uuid_list).values('name', 'uuid')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        table_dict = {str(v['uuid']): v['name'] for v in dtables}
        for external_app in external_app_list:
            try:
                external_app['dtable_name'] = table_dict[uuid_str_to_36_chars(external_app['dtable_uuid'])]
            except:
                external_app['dtable_name'] = '_deleted'

        return Response({'external_app_list': external_app_list, 'count': external_apps_count})

# Copyright (c) 2012-2020 Seafile Ltd.
# encoding: utf-8

import logging
import json

from django.utils.translation import gettext as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.organizations.models import OrgCorpAuth
from seahub.org_dingtalk.utils import org_dingtalk_check

logger = logging.getLogger(__name__)


class OrgAdminDingtalkInfo(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        if not org_dingtalk_check():
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
            if not org_corp or org_corp.permanent_code:  # dingtalk do not have permanent_code
                error_msg = '该企业未添加 SeaTable 应用'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            info = org_corp.to_dict()
            try:
                extra_data = json.loads(org_corp.extra_data)
                department_count = len(
                    extra_data['auth_scope']['auth_org_scopes']['authed_dept'])
            except Exception as e:
                department_count = 1
            info['department_count'] = department_count
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'corp': info})

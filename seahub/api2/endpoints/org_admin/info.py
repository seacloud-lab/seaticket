# Copyright (c) 2012-2016 Seafile Ltd.
import logging

import requests
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from django.conf import settings as dj_settings

from seaserv import ccnet_api

from seahub.constants import ORG_DEFAULT
from seahub.dtable.models import Workspaces, OrgRowsCount, OrgBigDataStorageStats, StatsAPIGatewayByTeam
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role

from seahub.ai.utils import get_ai_cost_by_org_id, get_ai_credit_by_org_id

from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error

from seahub.organizations.models import OrgMemberQuota, OrgSettings, OrgQuota
from seahub.organizations.settings import ORG_MEMBER_QUOTA_ENABLED
from seahub.organizations.permissions import IsOrgAdmin

logger = logging.getLogger(__name__)


class OrgAdminInfo(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdmin)

    def get(self, request):
        """Get info of an organization
        """

        org = request.user.org
        org_id = org.org_id

        # space quota
        org_role = OrgSettings.objects.filter(org_id=org_id).first()
        org_role = org_role.role if org_role else ORG_DEFAULT
        storage_quota = OrgQuota.objects.get_asset_quota(org_id)
        storage_usage = Workspaces.objects.get_org_total_storage(org_id)

        # member quota
        if ORG_MEMBER_QUOTA_ENABLED:
            member_quota = OrgMemberQuota.objects.get_quota(org_id)
        else:
            member_quota = None

        # member usage
        try:
            url_prefix = request.user.org.url_prefix
            org_members = ccnet_api.get_org_emailusers(url_prefix, -1, -1)
        except Exception as e:
            logger.error(e)
            org_members = []

        member_usage = 0
        active_members = 0
        if org_members:
            member_usage = len(org_members)
            active_members = len([m for m in org_members if m.is_active])

        info = {}
        info['org_id'] = org_id
        info['org_name'] = org.org_name
        info['storage_quota'] = storage_quota
        info['storage_usage'] = storage_usage
        info['member_quota'] = member_quota
        info['member_usage'] = member_usage
        info['active_members'] = active_members
        # rows
        info['row_usage'] = OrgRowsCount.objects.get_org_rows_count(org_id)
        row_limit = OrgQuota.objects.get_row_limit(org_id)
        info['row_total'] = row_limit
        info['role'] = org_role

        info['big_data_row_limit'] = OrgQuota.objects.get_big_data_row_limit(org_id)
        info['big_data_storage_quota'] = OrgQuota.objects.get_big_data_storage_quota(org_id)
        org_big_data_total_rows = OrgBigDataStorageStats.objects.get_org_big_data_total_rows(org_id)
        org_big_data_total_storage = OrgBigDataStorageStats.objects.get_org_big_data_total_storage(org_id)
        info['big_data_total_rows'] = org_big_data_total_rows
        info['big_data_total_storage'] = org_big_data_total_storage
        info['api_calls_count'] = StatsAPIGatewayByTeam.objects.get_month_all_count(org_id)
        info['api_calls_limit'] = OrgQuota.objects.get_monthly_api_call_limit(org_id)

        if dj_settings.SEATABLE_FAAS_URL:
            info['scripts_running_total'] = get_enabled_role_permissions_by_role(org_role).get('scripts_running_limit', -1)
            # get user/org scripts-running count
            try:
                url = dj_settings.SEATABLE_FAAS_URL.strip('/') + '/scripts-running-count/'
                headers = {'Authorization': 'Token ' + dj_settings.SEATABLE_FAAS_AUTH_TOKEN}
                params = {'org_id': request.user.org.org_id}
                response = requests.get(url, params=params, headers=headers, timeout=10)
                if response.status_code != 200:
                    logger.error('get scripts_running_count error response: %s', response)
                    scripts_running_count = -1
                else:
                    scripts_running_count = response.json()['count']
            except Exception as e:
                logger.error('scripts_running_count error: %s', e)
                scripts_running_count = -1

            info['scripts_running_count'] = scripts_running_count

        if dj_settings.ENABLE_SEATABLE_AI and dj_settings.SEATABLE_AI_SERVER_URL:
            info['ai_cost'] = round(get_ai_cost_by_org_id(org_id), 2)
            info['ai_credit'] = get_ai_credit_by_org_id(org_id)

        return Response(info)

    def put(self, request):
        org = request.user.org
        org_id = org.org_id

        new_org_name = request.data.get('new_org_name')
        if new_org_name:
            try:
                ccnet_api.set_org_name(org_id, new_org_name)
            except Exception as e:
                logger.error('set org_id: %s new_org_name: %s error: %s', org_id, new_org_name, e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


        return Response({'success': True})

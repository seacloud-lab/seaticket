# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication

from seahub.constants import TEAM_FREE

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error

from seahub.organizations.models import OrgMemberQuota, OrgSettings, Organization
from django.db.models import Sum
from seahub.organizations.settings import ORG_MEMBER_QUOTA_ENABLED
from seahub.organizations.permissions import IsOrgAdmin
from seahub.project.models import ProjectIssuesStatistics

logger = logging.getLogger(__name__)


class OrgAdminInfo(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdmin,)

    def get(self, request):
        """Get info of an organization
        """

        org = request.user.org
        org_id = org.org_id

        # space quota
        org_role = OrgSettings.objects.filter(org_id=org_id).first()
        org_role = org_role.role if org_role else TEAM_FREE

        # member quota
        if ORG_MEMBER_QUOTA_ENABLED:
            member_quota = OrgMemberQuota.objects.get_quota(org_id)
        else:
            member_quota = None

        # member usage
        try:
            url_prefix = request.user.org.url_prefix
            org_members = Organization.objects.get_org_users_by_url_prefix(url_prefix)
        except Exception as e:
            logger.error(e)
            org_members = []

        member_usage = 0
        active_members = 0
        if org_members:
            member_usage = len(org_members)
            active_members = len([m for m in org_members if m.is_active])

        # issues usage
        try:
            issues_usage = ProjectIssuesStatistics.objects.filter(
                org_id=org_id
            ).aggregate(total=Sum('total_issues_count'))['total'] or 0
        except Exception as e:
            logger.error(e)
            issues_usage = 0

        info = {}
        info['org_id'] = org_id
        info['org_name'] = org.org_name
        info['member_quota'] = member_quota
        info['member_usage'] = member_usage
        info['active_members'] = active_members
        info['role'] = org_role
        info['issues_usage'] = issues_usage

        return Response(info)

    def put(self, request):
        org = request.user.org
        org_id = org.org_id

        org_name = request.data.get('org_name')
        if org_name:
            try:
                org.org_name = org_name
                org.save()
            except Exception as e:
                logger.error('set org_id: %s org_name: %s error: %s', org_id, org_name, e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

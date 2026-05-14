import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.permissions import IsOrgAdminUser
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error

from seahub.base.accounts import User
from seahub.organizations.models import Organization, OrgUser, OrgGroup, OrgMemberQuota, OrgSettings, OrgAdminSettings,\
    OrgSAMLConfig
from seahub.organizations.signals import org_deleted
from seahub.organizations.settings import ORG_ENABLE_ADMIN_DELETE_ORG
from seahub.project.models import Workspaces, AIUsageStatistics
from seahub.admin_log.models import OrgAdminLog

try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False

logger = logging.getLogger(__name__)


class OrgAdminDeleteOrg(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

    def delete(self, request, org_id):

        if not MULTI_TENANCY or not ORG_ENABLE_ADMIN_DELETE_ORG:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            # remove org users
            page_size = 100
            while True:
                users = list(OrgUser.objects.get_org_email_users(org_id, 0, page_size))
                if not users:
                    break
                for u in users:
                    OrgUser.objects.remove_org_user(org_id, u.email)
                    User.objects.get(email=u.email).delete()
                if len(users) < page_size:
                    break

            # remove org groups
            groups = OrgGroup.objects.get_org_groups(org_id)
            for g in groups:
                OrgGroup.objects.remove_org_group(org_id, g.group_id)

            # remove org workspace and projects
            Workspaces.objects.delete_workspaces_by_org_id(org_id)

            # remove org-related configs and records
            OrgMemberQuota.objects.filter(org_id=org_id).delete()
            OrgSettings.objects.filter(org_id=org_id).delete()
            OrgAdminSettings.objects.filter(org_id=org_id).delete()
            OrgSAMLConfig.objects.filter(org_id=org_id).delete()
            OrgAdminLog.objects.filter(org_id=org_id).delete()

            # remove org
            Organization.objects.remove_org(org_id)

            # handle signal
            org_deleted.send(sender=None, org_id=org_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

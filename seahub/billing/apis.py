# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle

from seahub.utils.auth import AUTHORIZATION_PREFIX
from seahub.utils.timeutils import timestamp_to_isoformat_timestr

from seahub.organizations.signals import org_role_updated
from seahub.organizations.models import Organization, OrgSettings

from seahub.role_permissions.utils import get_available_roles
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email

from seahub.settings import BILLING_AUTH_TOKEN, MULTI_TENANCY

logger = logging.getLogger(__name__)


def get_org_info(org):
    org_id = org.org_id

    org_info = {}
    org_info['org_id'] = org_id
    org_info['org_name'] = org.org_name
    org_info['ctime'] = timestamp_to_isoformat_timestr(org.ctime)
    org_info['role'] = OrgSettings.objects.get_role_by_org(org)

    creator = org.creator
    org_info['creator_email'] = creator
    org_info['creator_name'] = email2nickname(creator)
    org_info['creator_contact_email'] = email2contact_email(creator)

    return org_info


class BillingOrganizationOperation(APIView):

    throttle_classes = (UserRateThrottle,)

    def _validate_and_get_org(self, request, org_id):

        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX:
            error_msg = 'Invalid token header. No credentials provided.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if len(auth) == 1:
            error_msg = 'Invalid token header. No credentials provided.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if len(auth) > 2:
            error_msg = 'Invalid token header. Token string should not contain spaces.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        key = auth[1]
        if key != BILLING_AUTH_TOKEN:
            error_msg = 'Invalid token.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not MULTI_TENANCY:
            error_msg = 'Feature is not enabled.'
            return None, api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            org_id = int(org_id)
        except ValueError:
            error_msg = 'org_id invalid.'
            return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if org_id == 0:
            error_msg = 'org_id invalid.'
            return None, api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return None, api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return org, None

    def get(self, request, org_id):
        """ Get base info of a organization

        Permission checking:
        1. only admin can perform this action.
        """
        org, error = self._validate_and_get_org(request, org_id)
        if error:
            return error

        org_info = get_org_info(org)
        return Response(org_info)

    def put(self, request, org_id):
        """ Update base info of a organization

        Permission checking:
        1. only admin can perform this action.
        """
        org, error = self._validate_and_get_org(request, org_id)
        if error:
            return error

        role = request.data.get('role')
        if role:
            if role not in get_available_roles():
                error_msg = 'Role %s invalid.' % role
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            OrgSettings.objects.add_or_update(org, role=role)
            org_role_updated.send(None, org_id=org_id)

        org_info = get_org_info(org)
        return Response(org_info)

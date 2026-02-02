# Copyright (c) 2012-2016 Seafile Ltd.

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error

from seahub.utils import is_org_context
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.group.models import Group, GroupUser
from seahub.organizations.models import OrgGroup


def get_group_info(group):
    isoformat_timestr = timestamp_to_isoformat_timestr(group.timestamp)
    group_info = {
        "id": group.group_id,
        "name": group.group_name,
        "owner": group.creator_name,
        "created_at": isoformat_timestr,
    }

    return group_info

class SearchGroup(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def _can_use_global_address_book(self, request):

        return request.user.permissions.can_use_global_address_book()

    def get(self, request, format=None):
        """  Search group.

        Permission checking:
        1. default(NOT guest) user;
        """

        # argument check
        q = request.GET.get('q', None)
        if not q:
            error_msg = 'q invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        if not self._can_use_global_address_book(request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_id = request.user.org.org_id
        org_groups = OrgGroup.objects.filter(org_id=org_id)
        groups = Group.objects.filter(
            group_id__in=[g.group_id for g in org_groups])

        result = []
        for group in groups:
            group_name = group.group_name
            if not group_name:
                continue

            if q.lower() in group_name.lower():
                group_info = get_group_info(group)
                result.append(group_info)

        return Response(result)

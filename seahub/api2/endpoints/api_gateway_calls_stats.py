from datetime import datetime

import jwt
from django.conf import settings
from django.db.models import Sum
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.ccnet_db.ccnet.organizations import get_users_org_ids
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.auth.models import UserQuota
from seahub.dtable.models import StatsAPIGatewayByTeam, StatsAPIGatewayByOwner, ExceedAPIQuotaTeams
from seahub.organizations.models import OrgQuota
from seahub.utils import publish_api_gateway_calls_changed


class InternalUpdateExceedAPIQuotaView(APIView):
    authentication_classes = ()
    permission_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        if not isinstance(request.data, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request')

        org_ids = request.data.get('org_ids') or []
        if org_ids and not isinstance(org_ids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_ids invalid')
        org_ids = [org_id for org_id in org_ids if isinstance(org_id, int) and org_id > 0]

        owner_ids = request.data.get('owner_ids') or []
        if owner_ids and not isinstance(owner_ids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'owner_ids invalid')
        owner_ids = [owner_id for owner_id in owner_ids if isinstance(owner_id, str) and '@seafile_group' not in owner_id]
        # filter non-org owner_id
        if owner_ids:
            org_usernames_set = get_users_org_ids(owner_ids).keys()
            owner_ids = [owner_id for owner_id in owner_ids if owner_id not in org_usernames_set]

        month = request.data.get('month')
        if not isinstance(month, str):
            return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid')
        try:
            datetime.strptime(month, '%Y-%m-01')
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'month invalid')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        try:
            jwt.decode(auth[1], settings.DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        except:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # query stats
        org_stats = list(StatsAPIGatewayByTeam.objects.filter(
            org_id__in=org_ids,
            month=month
        ).values(
            'org_id'
        ).annotate(total_count=Sum('count')))

        owner_stats = list(StatsAPIGatewayByOwner.objects.filter(
            owner_id__in=owner_ids,
            month=month
        ).values(
            'owner_id'
        ).annotate(total_count=Sum('count')))

        # query limits
        org_limits = OrgQuota.objects.batch_get_monthly_api_call_limit(org_ids)
        owner_limits = UserQuota.objects.batch_get_monthly_api_call_limit(owner_ids)

        exceed_org_ids = []
        non_exceed_org_ids = []
        org_api_limit_dict = {}
        for item in org_stats:
            org_id = item['org_id']
            total_count = item['total_count']
            limit = org_limits.get(org_id) or -1
            if limit > 0 and total_count >= limit:
                exceed_org_ids.append(org_id)
                org_api_limit_dict[org_id] = limit
            elif limit < 0 or total_count < limit:
                non_exceed_org_ids.append(org_id)

        exceed_owner_ids = []
        non_exceed_owner_ids = []
        owner_api_limit_dict = {}
        for item in owner_stats:
            owner_id = item['owner_id']
            total_count = item['total_count']
            limit = owner_limits.get(owner_id) or -1
            if limit > 0 and total_count >= limit:
                exceed_owner_ids.append(owner_id)
                owner_api_limit_dict[owner_id] = limit
            elif limit < 0 or total_count < limit:
                non_exceed_owner_ids.append(owner_id)

        # delete non-exceed
        ## org
        del_org_num = 0
        if non_exceed_org_ids:
            del_org_num, _ = ExceedAPIQuotaTeams.objects.filter(org_id__in=non_exceed_org_ids).delete()
        ## owner
        del_owner_num = 0
        if non_exceed_owner_ids:
            del_owner_num, _ = ExceedAPIQuotaTeams.objects.filter(owner_id__in=non_exceed_owner_ids).delete()

        # append exceed
        ## org
        existing_org_ids = list(ExceedAPIQuotaTeams.objects.filter(org_id__in=exceed_org_ids).values_list('org_id', flat=True))
        exceed_org_ids = [org_id for org_id in exceed_org_ids if org_id not in existing_org_ids]
        if exceed_org_ids:
            ExceedAPIQuotaTeams.objects.bulk_create([ExceedAPIQuotaTeams(org_id=org_id, owner_id='', api_limit=org_api_limit_dict[org_id]) for org_id in exceed_org_ids])
        ## owner
        existing_owner_ids = list(ExceedAPIQuotaTeams.objects.filter(owner_id__in=exceed_owner_ids).values_list('owner_id', flat=True))
        exceed_owner_ids = [owner_id for owner_id in exceed_owner_ids if owner_id not in existing_owner_ids]
        if exceed_owner_ids:
            ExceedAPIQuotaTeams.objects.bulk_create([ExceedAPIQuotaTeams(org_id=-1, owner_id=owner_id, api_limit=owner_api_limit_dict[owner_id]) for owner_id in exceed_owner_ids])

        if (del_org_num or exceed_org_ids) or (del_owner_num or exceed_owner_ids):
            publish_api_gateway_calls_changed()

        return Response({'success': True})

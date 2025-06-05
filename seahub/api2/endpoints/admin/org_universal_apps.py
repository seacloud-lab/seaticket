import logging

from django.db.models import Count
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.ccnet_db.ccnet.organizations import get_orgs_base_info
from seahub.dtable.models import DTableExternalApps


from seahub.dtable_apps.universal_app.models import DTableAppUsers

logger = logging.getLogger(__name__)

class AdminOrgUniversalAppStats(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page


        unversal_apps_sum =DTableExternalApps.objects.filter(
            app_type='universal-app',
            org_id__gt=0
        ).values(
            'org_id'
        ).annotate(
            count=Count('pk')
        ).values_list('org_id', 'count')


        org_universal_app_count_dict = {}
        org_universal_app_user_count_dict = {}

        total_count = unversal_apps_sum.count()

        for app_info in list(unversal_apps_sum[start: end]):
            org_id = app_info[0]
            app_count = app_info[1]
            org_universal_app_count_dict[org_id] = app_count

        org_ids = list(org_universal_app_count_dict.keys())

        if not org_ids:
            return Response({'org_app_infos': [], 'total_count': 0})

        universal_app_users = list(DTableAppUsers.objects.filter(
            app__app_type='universal-app',
            app__org_id__in=org_ids
        ).values(
            'app__org_id'
        ).annotate(
            count=Count('pk')
        ).values_list('app__org_id', 'count'))

        for app_user_info  in universal_app_users:
            org_id = app_user_info[0]
            user_count = app_user_info[1]
            org_universal_app_user_count_dict[org_id]= user_count

        try:
            orgs_base_info = get_orgs_base_info(org_ids)
            results = []
            for org_id in org_ids:
                results.append(
                    {
                        'org_id': org_id,
                        'org_name': orgs_base_info.get(org_id, {}).get('org_name'),
                        'app_count': org_universal_app_count_dict.get(org_id, 0),
                        'user_count': org_universal_app_user_count_dict.get(org_id, 0)
                    }
                )
        except Exception as e:
            logger.error(e)
            error_msg = "Internal Server Error"
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'org_app_infos': results, 'total_count': total_count })

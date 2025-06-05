import logging

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables
from seahub.dtable.utils import get_dtables_rows_count, get_dtable_owner
from seahub.api2.endpoints.admin.utils import get_dtable_size

from seaserv import ccnet_api

logger = logging.getLogger(__name__)


def get_dtable_info(dtable, include_deleted=False, rows_count_dict=None):
    dtable_info = dtable.to_dict(include_deleted=include_deleted)
    owner_name, owner_deleted = get_dtable_owner(dtable)
    dtable_info['owner'] = owner_name
    dtable_info['owner_deleted'] = owner_deleted
    file_size = get_dtable_size(dtable)
    dtable_info['file_size'] = file_size or None
    if rows_count_dict:
        dtable_info['rows_count'] = rows_count_dict.get(dtable.uuid.hex, 0)
    return dtable_info


class OrgDTables(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request, org_id):
        # arguments check
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
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
        dtables = DTables.objects.filter(workspace__org_id=org_id, deleted=False).select_related('workspace')
        rows_count_dict = get_dtables_rows_count([d.uuid.hex for d in dtables[start: end]])
        dtable_list = [get_dtable_info(d, rows_count_dict=rows_count_dict) for d in dtables[start: end]]

        return Response({'dtable_list': dtable_list, 'count': dtables.count()})

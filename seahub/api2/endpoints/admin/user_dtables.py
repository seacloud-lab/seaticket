from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import DTables, DTableShare
from seahub.dtable.utils import get_dtables_rows_count
from seahub.api2.endpoints.admin.utils import get_dtable_size


def get_dtable_info(dtable, include_deleted=False, rows_count_dict=None):
    dtable_info = dtable.to_dict(include_deleted=include_deleted)
    dtable_info['creator'] = email2nickname(dtable.creator)
    dtable_info['modifier'] = email2nickname(dtable.modifier)
    file_size = get_dtable_size(dtable)
    dtable_info['file_size'] = file_size or None
    if rows_count_dict:
        dtable_info['rows_count'] = rows_count_dict.get(dtable.uuid.hex, 0)
    return dtable_info


class AdminUserDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, email):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25

        start, end = (page - 1) * per_page, page * per_page
        dtables = DTables.objects.filter(workspace__owner=email, deleted=False).select_related('workspace')
        rows_count_dict = get_dtables_rows_count([d.uuid.hex for d in dtables[start: end]])
        dtable_list = [get_dtable_info(d, rows_count_dict=rows_count_dict) for d in dtables[start: end]]

        return Response({'dtable_list': dtable_list, 'count': dtables.count()})


class AdminUserSharedDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, email):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25

        start, end = (page - 1) * per_page, page * per_page
        all_shares = DTableShare.objects.filter(to_user=email, dtable__deleted=False)
        shares = all_shares.select_related('dtable')[start: end]
        dtables = [s.dtable for s in shares]
        rows_count_dict = get_dtables_rows_count([d.uuid.hex for d in dtables])
        dtable_list = []
        for s in shares:
            dtable_info = get_dtable_info(s.dtable, rows_count_dict=rows_count_dict)
            dtable_info['from_user'] = s.from_user
            if '@seafile_group' not in s.from_user:
                dtable_info['from_user_name'] = email2nickname(s.from_user)
            dtable_list.append(dtable_info)

        return Response({'dtable_list': dtable_list, 'count': all_shares.count()})

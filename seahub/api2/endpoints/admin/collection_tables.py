import json
import logging

from django.db import connection
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import DTables, DTableCollectionTables

logger = logging.getLogger(__name__)


class AdminCollectionTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 2))
        except:
            page, per_page = 1, 25

        start = (page - 1) * per_page

        sql = '''
        SELECT dct.* FROM dtable_collection_tables dct
        JOIN dtables d ON dct.dtable_uuid=d.uuid
        WHERE d.deleted=0
        ORDER BY dct.created_at DESC
        LIMIT %s OFFSET %s
        '''
        collection_tables = DTableCollectionTables.objects.raw(sql, (per_page, start))
        dtable_uuids = set([ct.dtable_uuid for ct in collection_tables])
        dtables = DTables.objects.filter(uuid__in=dtable_uuids)
        dtables_dict = {d.uuid.hex: d for d in dtables}
        table_list = []
        for table in collection_tables:
            try:
                config = json.loads(table.config)
            except Exception as e:
                logger.error('load form: %s config error: %s', table.id, e)
                continue
            info = {
                'id': table.id,
                'table_name': config.get('name'),
                'username': email2nickname(table.username),
                'dtable_name': dtables_dict[table.dtable_uuid].name,
                'token':table.token,
                'created_at': table.to_dict().get('created_at'),
                'view_count': table.view_count
            }
            table_list.append(info)

        return Response({'collection_table_list': table_list})


class AdminCollectionTableView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, token):

        # permission check
        if not request.user.admin_permissions.can_manage_form():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            DTableCollectionTables.objects.delete_collection_table(token)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'success': True})

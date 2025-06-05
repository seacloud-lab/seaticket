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
from seahub.dtable.models import DTables, DTableForms

logger = logging.getLogger(__name__)


class AdminFormsView(APIView):
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
        SELECT df.* FROM dtable_forms df
        JOIN dtables d ON df.dtable_uuid=d.uuid
        WHERE d.deleted=0
        ORDER BY df.created_at DESC
        LIMIT %s OFFSET %s
        '''
        forms = DTableForms.objects.raw(sql, (per_page, start))
        dtable_uuids = set([f.dtable_uuid for f in forms])
        dtables = DTables.objects.filter(uuid__in=dtable_uuids)
        dtables_dict = {d.uuid.hex: d for d in dtables}
        form_list = []
        for form in forms:
            try:
                config = json.loads(form.form_config)
            except Exception as e:
                logger.error('load form: %s config error: %s', form.id, e)
                continue
            info = {
                'id': form.id,
                'form_name': config.get('form_name'),
                'username': email2nickname(form.username),
                'dtable_name': dtables_dict[form.dtable_uuid].name,
                'token': form.token,
                'created_at': form.to_dict().get('created_at'),
                'submit_count': form.submit_count
            }
            form_list.append(info)

        return Response({'form_list': form_list})


class AdminFormView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, token):

        # permission check
        if not request.user.admin_permissions.can_manage_form():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            DTableForms.objects.delete_form(token)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'success': True})

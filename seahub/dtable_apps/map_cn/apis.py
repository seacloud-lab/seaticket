import json
import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTableExternalApps, DTables
from seahub.dtable.utils import is_valid_app_jwt
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.utils import get_inner_dtable_server_url, uuid_str_to_36_chars

logger = logging.getLogger(__name__)


class DTableMapCNRowsView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        # resource check
        external_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not external_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if external_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.GET.get('table_name')
        view_name = request.GET.get('view_name')
        if not table_name or not view_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_name or view_name invalid')

        dtable_uuid = uuid_str_to_36_chars(external_app.dtable_uuid)
        app_config = json.loads(external_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'map-cn':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()

        is_valid = is_valid_app_jwt(auth, app_uuid)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        dtable_server_url = get_inner_dtable_server_url().strip('/')
        dtable_server_api = DTableServerAPI('', dtable_uuid, dtable_server_url)
        rows = dtable_server_api.list_rows(table_name, view_name=view_name, convert_link_id=True)

        return Response({'rows': rows})


class DTableMapCNMetadataView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        # resource check
        external_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not external_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if external_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(external_app.dtable_uuid)
        app_config = json.loads(external_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'map-cn':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()

        is_valid = is_valid_app_jwt(auth, app_uuid)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        dtable_server_url = get_inner_dtable_server_url().strip('/')
        dtable_server_api = DTableServerAPI('', dtable_uuid, dtable_server_url)
        metadata = dtable_server_api.get_metadata()

        return Response({'metadata': metadata})

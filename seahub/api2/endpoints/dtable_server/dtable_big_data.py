import json
import logging
from datetime import datetime, timedelta

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, DTableRowActivities
from seahub.dtable.utils import is_valid_jwt
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import INNER_DTABLE_DB_URL
from seahub.utils import uuid_str_to_32_chars, get_inner_dtable_server_url

logger = logging.getLogger(__name__)


class DTableArchiveView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    
    def post(self, request, dtable_uuid):
        table_name = request.data.get('table_name')
        if not table_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_name invalid.')
        
        where = request.data.get('where', None)
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        
        username = payload.get('username', '')
        dtable_db_api = DTableDBAPI(username, str(dtable_uuid), INNER_DTABLE_DB_URL)
        res = dtable_db_api.archive_view(table_name, where=where)
        return Response(res)


class DTableDbMetadataView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    
    def get(self, request, dtable_uuid):
        
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        
        dtable_db_api = DTableDBAPI('dtable-web', str(dtable_uuid), INNER_DTABLE_DB_URL)
        res = dtable_db_api.get_metadata()
        return Response(res)


class DTableDbIndexView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    
    def post(self, request, dtable_uuid):
        
        table_id = request.data.get('table_id', None)
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid.')
        
        columns = request.data.get('columns', None)
        if not columns:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid.')
        
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        
        dtable_db_api = DTableDBAPI('dtable-web', str(dtable_uuid), INNER_DTABLE_DB_URL)
        res = dtable_db_api.add_index(table_id, columns)
        return Response(res)
    
    def delete(self, request, dtable_uuid):
        table_id = request.data.get('table_id', None)
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid.')
    
        index_id = request.data.get('index_id', None)
        if not index_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'index_id invalid.')
    
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
    
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
    
        dtable_db_api = DTableDBAPI('dtable-web', str(dtable_uuid), INNER_DTABLE_DB_URL)
        res = dtable_db_api.delete_index(table_id, index_id)
        return Response(res)


class DTableDbIndexTaskStatusView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    
    def get(self, request, dtable_uuid):
        
        task_id = request.GET.get('task_id', None)
        if not task_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_id invalid.')
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        dtable_db_api = DTableDBAPI('dtable-web', str(dtable_uuid), INNER_DTABLE_DB_URL)
        res = dtable_db_api.query_index_task(task_id)
        return Response(res)


class DTableDbBigDataFeatureView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    
    def post(self, request, dtable_uuid):
        
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        dtable_db_api = DTableDBAPI('dtable-web', str(dtable_uuid), INNER_DTABLE_DB_URL)
        res = dtable_db_api.open_big_data_feature()
        return Response(res)
    
class DTableConnectedCollaboratorView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    
    def get(self, request, dtable_uuid):
        
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable_uuid), get_inner_dtable_server_url())
        res = dtable_server_api.list_connected_collaborators()
        return Response(res)

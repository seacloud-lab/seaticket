import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.dtable.models import DTableRowComments, DTables
from seahub.dtable.utils import is_valid_jwt, check_dtable_admin_permission
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.utils import uuid_str_to_32_chars, get_inner_dtable_server_url

logger = logging.getLogger(__name__)

def have_comment_permission(permission):
    if permission in ['r', 'rw']:
        return True
    if permission.startswith('c-'):
        return True
    return False

class DTableRowCommentsCountView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        row_id = request.GET.get('row_id')
        if not row_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_id invalid.')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not have_comment_permission(payload.get('permission', '')):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        count = DTableRowComments.objects.filter(dtable_uuid=uuid_str_to_32_chars(dtable_uuid), row_id=row_id).count()

        return Response({'count': count})

class DTableRowCommentsView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        # arguments
        row_id = request.GET.get('row_id')
        if not row_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_id invalid.')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not have_comment_permission(payload.get('permission', '')):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        start, limit = (page - 1) * per_page, per_page
        comments_queryset = DTableRowComments.objects.filter(dtable_uuid=dtable.uuid.hex, row_id=row_id).order_by('id')
        comments = [comment.to_dict() for comment in comments_queryset[start: start+limit]]

        return Response({
            'comment_list': comments,
            'count': comments_queryset.count()
        })
    
    def post(self, request, dtable_uuid):
        row_id = request.data.get('row_id')
        if not row_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_id invalid.')
        
        table_id = request.data.get('table_id')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid.')
        
        comment = request.data.get('comment')
        if not comment:
            return api_error(status.HTTP_400_BAD_REQUEST, 'comment invalid.')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not have_comment_permission(payload.get('permission', '')):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        username = payload.get('username')
        dtable_server_url = get_inner_dtable_server_url()

        dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url)
        res = dtable_server_api.add_row_comment(table_id, row_id, comment)
        return Response(res)


class DTableRowCommentView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def put(self, request, dtable_uuid, comment_id):
        try:
            options = request.data.get('options', {})
            resolved = to_python_boolean(str(options.get('resolved', 'false')))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'resolved invalid.')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not have_comment_permission(payload.get('permission', '')):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        comment = DTableRowComments.objects.filter(dtable_uuid=dtable.uuid.hex, id=comment_id).first()
        if not comment:
            return api_error(status.HTTP_404_NOT_FOUND, 'Comment not found.')

        try:
            comment.resolved = resolved
            comment.save()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

    def delete(self, request, dtable_uuid, comment_id):
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not have_comment_permission(payload.get('permission', '')):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        comment = DTableRowComments.objects.filter(dtable_uuid=uuid_str_to_32_chars(dtable_uuid), id=comment_id).first()
        if not comment:
            return api_error(status.HTTP_404_NOT_FOUND, 'Comment not found.')

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = payload.get('username')
        if comment.author != username and not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            DTableRowComments.objects.filter(dtable_uuid=uuid_str_to_32_chars(dtable_uuid), id=comment_id).delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class DTableRowsCommentsNumView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_jwt(auth, dtable_uuid, return_payload=True)
        if not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not have_comment_permission(payload.get('permission', '')):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # Default list of comments from the past 180 days
        last_time = datetime.utcnow() - timedelta(days=180)
        row_ids = DTableRowComments.objects.filter(dtable_uuid=dtable.uuid.hex, created_at__gte=last_time).values_list('row_id', flat=True)
        rows_comments_num = defaultdict(int)

        for row_id in row_ids:
            rows_comments_num[row_id] += 1

        return Response({'rows_comments_num': rows_comments_num})

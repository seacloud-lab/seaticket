import logging

import jwt
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.dtable.models import DTableNotifications, DTables
from seahub.utils import uuid_str_to_32_chars
from seahub.api2.authentication import AUTHORIZATION_PREFIX

logger = logging.getLogger(__name__)


def _check_token(request, dtable_uuid):
    """
    return payload, api_error()
    """
    auth = request.META.get('HTTP_AUTHORIZATION', '').split()
    if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
        return None, api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
    access_token = auth[1]
    try:
        payload = jwt.decode(access_token, settings.DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except Exception as e:
        return None, api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

    if payload.get('dtable_uuid', '').replace('-', '') != dtable_uuid.replace('-', ''):
        return None, api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

    return payload, None


class DTableNotificationsView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle, )

    def get(self, request, dtable_uuid):
        # arguments
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page, per_page = 1, 25

        payload, error = _check_token(request, dtable_uuid)
        if error:
            return error

        username = payload.get('username', '')
        offset, limit = (page - 1) * per_page, per_page

        try:
            notices_query = DTableNotifications.objects.filter(username=username, dtable_uuid=uuid_str_to_32_chars(dtable_uuid)).order_by('-created_at')
            notification_list = [notice.to_dict() for notice in list(notices_query[offset: offset + limit])]
            return Response({
                'notification_list': notification_list
            })
        except Exception as e:
            logger.error('list dtable-notifications error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

    def put(self, request, dtable_uuid):
        # arguments
        try:
            seen = to_python_boolean(request.data.get('seen'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'seen invalid.')

        payload, error = _check_token(request, dtable_uuid)
        if error:
            return error

        username = payload.get('username', '')

        try:
            DTableNotifications.objects.filter(username=username, dtable_uuid=uuid_str_to_32_chars(dtable_uuid)).update(seen=seen)
        except Exception as e:
            logger.error('update dtable-notifications error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

    def delete(self, request, dtable_uuid):
        payload, error = _check_token(request, dtable_uuid)
        if error:
            return error

        username = payload.get('username', '')

        try:
            DTableNotifications.objects.filter(username=username, dtable_uuid=uuid_str_to_32_chars(dtable_uuid)).delete()
        except Exception as e:
            logger.error('delete dtable-notifications error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class DTableNotificationView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle, )

    def put(self, request, dtable_uuid, notification_id):
        # arguments
        try:
            seen = to_python_boolean(request.data.get('seen'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'seen invalid.')

        payload, error = _check_token(request, dtable_uuid)
        if error:
            return error

        username = payload.get('username', '')

        try:
            DTableNotifications.objects.filter(username=username, dtable_uuid=uuid_str_to_32_chars(dtable_uuid), id=notification_id).update(seen=seen)
        except Exception as e:
            logger.error('update dtable-notification error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

import logging

from django.db import IntegrityError
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import UserStarredDTables, DTables
from seahub.dtable.utils import check_dtable_permission

logger = logging.getLogger(__name__)


class UserStarredDTablesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """
        list all starred dtables
        """
        user = request.user
        dtable_uuids = UserStarredDTables.objects.get_dtable_uuids_by_email(user.username)
        dtables = DTables.objects.filter(uuid__in=dtable_uuids)

        return Response({'user_starred_dtable_list': [d.to_dict() for d in dtables]})

    def post(self, request):
        # argument check
        dtable_uuid = request.data.get('dtable_uuid')
        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid is invalid.')

        user = request.user
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        if not check_dtable_permission(user.username, dtable.workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            UserStarredDTables.objects.create(email=user.username, dtable_uuid=dtable.uuid.hex)
        except IntegrityError:
            return Response({'success': True})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


    def delete(self, request):
        # argument check
        dtable_uuid = request.GET.get('dtable_uuid')
        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid is invalid.')

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        user = request.user
        # resource check

        user_starred_dtable = UserStarredDTables.objects.filter(email=user.username, dtable_uuid=dtable.uuid.hex)
        if not user_starred_dtable.exists():
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        try:
            user_starred_dtable.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

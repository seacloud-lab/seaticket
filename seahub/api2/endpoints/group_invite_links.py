import logging

from django.utils.translation import gettext as _

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.utils import api_error
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.group.models import Group, GroupUser, GroupInviteLinkModel
from seahub.group.utils import is_group_admin_or_owner
from seahub.settings import ENABLE_ADDRESSBOOK_V2

logger = logging.getLogger(__name__)


class GroupInviteLinks(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    def get(self, request, group_id):
        group_id = int(group_id)
        email = request.user.username

        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'group not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if ENABLE_ADDRESSBOOK_V2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Forbidden to operate department group')

        if not is_group_admin_or_owner(group_id, email):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            invite_link_query_set = GroupInviteLinkModel.objects.filter(group_id=group_id)
        except Exception as e:
            logger.error(f'query group invite links failed. {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'group_invite_link_list': [group_invite_link.to_dict() for group_invite_link in invite_link_query_set]})

    def post(self, request, group_id):
        group_id = int(group_id)
        email = request.user.username

        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'group not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if ENABLE_ADDRESSBOOK_V2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Forbidden to operate department group')

        if not is_group_admin_or_owner(group_id, email):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            invite_link = GroupInviteLinkModel.objects.create_link(group_id, email)
        except Exception as e:
            logger.error(f'create group invite links failed. {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(invite_link.to_dict())


class GroupInviteLink(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    def delete(self, request, group_id, token):
        group_id = int(group_id)
        email = request.user.username

        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'group not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if ENABLE_ADDRESSBOOK_V2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Forbidden to operate department group')

        if not is_group_admin_or_owner(group_id, email):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            GroupInviteLinkModel.objects.filter(token=token, group_id=group_id).delete()
        except Exception as e:
            logger.error(f'delete group invite links failed. {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

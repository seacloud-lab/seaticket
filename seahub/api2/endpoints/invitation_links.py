import logging

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.invitations.models import InvitationLinks
from seahub.utils import is_org_context

logger = logging.getLogger(__name__)


class InvitationLinkView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        if is_org_context(request):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        invitation_link = InvitationLinks.objects.get_invitation_link_by_user(request.user)
        return Response({
            'invitation_link': invitation_link.link
        })

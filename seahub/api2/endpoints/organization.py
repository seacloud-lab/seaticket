from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.permissions import IsOrgMember
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error

from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.organizations.models import Organization


class OrganizationView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, IsOrgMember)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id):
        if not request.cloud_mode:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Feature not enabled.')
        org_id = int(org_id)
        if org_id == 0:
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_id invalid.')
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            return api_error(status.HTTP_404_NOT_FOUND, 'Organization not found.')
        return Response({
            'org_id': org_id,
            'org_name': org.org_name
        })


class OrganizationMembersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, IsOrgMember)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id):

        org_id = int(org_id)
        if org_id == 0:
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_id invalid.')
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            return api_error(status.HTTP_404_NOT_FOUND, 'Organization not found.')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
        except ValueError:
            page = 1
            per_page = 20
        start = (page - 1) * per_page
        org_members = Organization.objects.get_org_users_by_url_prefix(org.url_prefix, start, per_page)
        member_list = []
        for member in org_members:
            member_info = get_user_info(member.email)
            member_list.append(member_info)
        return Response({
            'members': member_list
        })

def get_user_info(email):

    info = {}
    info['email'] = email
    info['name'] = email2nickname(email)
    info['contact_email'] = email2contact_email(email)
    avatar_url, _, _  = api_avatar_url(email)
    info['avatar_url'] = avatar_url
    return info

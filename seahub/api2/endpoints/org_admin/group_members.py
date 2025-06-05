# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from django.utils.translation import gettext as _

from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.permissions import IsProVersion
from seahub.api2.endpoints.admin.group_members import AdminGroupMembers as SysAdminGroupMembers
from seahub.api2.endpoints.admin.group_members import AdminGroupMember as SysAdminGroupMember
from seahub.organizations.permissions import IsOrgAdmin
from seahub.organizations.utils import check_org_admin
from seahub.base.templatetags.seahub_tags import email2nickname

from seaserv import seafile_api, ccnet_api
from seahub.api2.utils import api_error
from seahub.base.accounts import User
from seahub.settings import GROUP_MEMBER_LIMIT
from seahub.group.utils import get_group_member_info,is_group_member
from seahub.group.signals import add_user_to_group
from seahub.organizations.views import get_org_id_by_group
from seahub.dtable.utils import clean_related_users_cache_by_group, clean_user_department_cache
from seahub.department_v2.utils import is_department_v2_group

logger = logging.getLogger(__name__)


class AdminGroupMembers(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdmin, IsProVersion)

    @check_org_admin
    def get(self, request, org_id, group_id, format=None):
        """ List all group members

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return SysAdminGroupMembers().get(request, group_id, format)

    @check_org_admin
    def post(self, request, org_id, group_id):
        """
        Bulk add group members.

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_department_v2_group(group_id):
            return api_error(status.HTTP_403_FORBIDDEN, 'Forbidden to operate department group')

        emails = request.POST.getlist('email', '')
        if not emails:
            error_msg = 'Email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        result = {}
        result['failed'] = []
        result['success'] = []
        emails_need_add = []

        for email in emails:
            try:
                User.objects.get(email=email)
            except User.DoesNotExist:
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s not found.' % email
                })
                continue

            if is_group_member(group_id, email, in_structure=False):
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s is already a group member.' % email2nickname(email)
                })
                continue

            #check the consistency for user and organization
            if not ccnet_api.org_user_exists(org_id, email):
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s not found in organization.' % email2nickname(email)
                })
                continue

            emails_need_add.append(email)

        try:
            group_members = ccnet_api.get_group_members(group_id)
            old_members_count = len(group_members) if group_members else 0
        except Exception as e:
            logger.error(f'get group members failed. {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        over_limit_count = len(emails_need_add) + old_members_count - GROUP_MEMBER_LIMIT
        if over_limit_count > 0:
            emails_over_limit = emails_need_add[:over_limit_count]
            emails_need_add = emails_need_add[over_limit_count:]

            for email in emails_over_limit:
                result['failed'].append({
                        'email': email,
                        'error_msg': _('Number of group members exceeds limit.')
                        })

        # Add user to group.
        for email in emails_need_add:
            try:
                ccnet_api.group_add_member(group_id, group.creator_name, email)
                member_info = get_group_member_info(request, group_id, email)
                result['success'].append(member_info)
            except Exception as e:
                logger.error(e)
                result['failed'].append({
                    'email': email,
                    'error_msg': 'Internal Server Error'
                })

            add_user_to_group.send(sender=None,
                                   group_staff=request.user.username,
                                   group_id=group_id,
                                   added_user=email)
            clean_user_department_cache(email)

        clean_related_users_cache_by_group(group_id)

        return Response(result)

class AdminGroupMember(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdmin, IsProVersion)

    @check_org_admin
    def put(self, request, org_id, group_id, email, format=None):
        """ update role of a group member

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_department_v2_group(group_id):
            return api_error(status.HTTP_403_FORBIDDEN, 'Forbidden to operate department group')

        return SysAdminGroupMember().put(request, group_id, email, format)

    @check_org_admin
    def delete(self, request, org_id, group_id, email, format=None):
        """ Delete an user from group

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_department_v2_group(group_id):
            return api_error(status.HTTP_403_FORBIDDEN, 'Forbidden to operate department group')

        return SysAdminGroupMember().delete(request, group_id, email, format)

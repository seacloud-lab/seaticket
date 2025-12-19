# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from django.conf import settings
from django.utils.translation import gettext as _

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.group.signals import add_user_to_group
from seahub.group.utils import is_group_member, \
    is_group_owner, is_group_admin_or_owner, get_group_member_info, \
    get_group_members
from seahub.profile.models import Profile
from seahub.settings import GROUP_MEMBER_LIMIT
from seahub.utils import string2list, is_org_context
from seahub.group.models import Group, GroupUser
from seahub.organizations.models import OrgUser
from seahub.notifications.utils import add_user_to_group_notice

from .utils import api_check_group

logger = logging.getLogger(__name__)


class GroupMembers(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    @api_check_group
    def get(self, request, group_id, format=None):
        """
        Get all group members.
        """

        try:
            # only group member can get info of all group members
            if not is_group_member(group_id, request.user.username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            members = get_group_members(group_id)

            group = Group.objects.get_group(int(group_id))
            if not group:
                return api_error(status.HTTP_404_NOT_FOUND, 'Group not found')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        is_admin = request.GET.get('is_admin', 'false')
        members_info = {m['username']: m['is_staff'] for m in members if (is_admin == 'true' and m['is_staff']) or is_admin == 'false'}
        usernames = [m['username'] for m in members if (is_admin == 'true' and m['is_staff']) or is_admin == 'false']

        try:
            profiles = Profile.objects.filter(user__in=usernames)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        users_info = {p.user: [p.contact_email, p.nickname] for p in profiles}

        group_member_list = []
        for email in usernames:
            avatar_url, is_default, date_uploaded = api_avatar_url(email)
            role = 'Member'
            is_admin = members_info.get(email)
            if email == group.creator_name:
                role = 'Owner'
            elif is_admin:
                role = 'Admin'

            if email in users_info:
                nickname = users_info.get(email)[1]
                contact_email = users_info.get(email)[0]
            else:
                nickname = ''
                contact_email = email
            member_info = {
                "name": nickname.strip() if nickname else email.split('@')[0],
                'email': email,
                "contact_email": contact_email,
                "avatar_url": avatar_url,
                "is_admin": is_admin,
                "role": role,
                "group_id": group.group_id,
            }
            group_member_list.append(member_info)

        return Response(group_member_list)

    @api_check_group
    def post(self, request, group_id):
        """
        Add a group member.
        """
        username = request.user.username

        # only group owner/admin can add a group member
        if not is_group_admin_or_owner(group_id, username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        email = request.data.get('email', None)
        if not email:
            error_msg = 'Email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            if is_group_member(group_id, email):
                error_msg = _('User %s is already a group member.') % email2nickname(email)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            group_members = []
            try:
                group_members = GroupUser.objects.filter(group_id=group_id)
            except Exception as e:
                logger.error(f'get group members failed. {e}')
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            if group_members and len(group_members) >= GROUP_MEMBER_LIMIT:
                return api_error(status.HTTP_400_BAD_REQUEST, _('Number of group members exceeds limit.'))

            GroupUser.objects.create(
                group_id=group_id,
                user_name=email,
                is_staff=False,
            )
            group = Group.objects.get_group(int(group_id))
            if group:
                add_user_to_group_notice(email, group_id, group.group_name, username)
            add_user_to_group.send(sender=None,
                                   group_staff=username,
                                   group_id=group_id,
                                   added_user=email)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        member_info = get_group_member_info(group_id, email)

        return Response(member_info, status=status.HTTP_201_CREATED)


class GroupMember(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    @api_check_group
    def get(self, request, group_id, email):
        """
        Get info of a specific group member.
        """
        try:
            group = Group.objects.get_group(int(group_id))
            if not group:
                return api_error(status.HTTP_404_NOT_FOUND, 'Group not found')
            # only group member can get info of a specific group member
            if not is_group_member(group_id, request.user.username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if not is_group_member(group_id, email):
                error_msg = 'Email %s invalid.' % email
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        member_info = get_group_member_info(group_id, email)

        return Response(member_info)

    @api_check_group
    def put(self, request, group_id, email):
        """
        Set/unset a specific group member as admin.
        """

        username = request.user.username
        is_admin = request.data.get('is_admin', '')
        try:
            if not is_group_admin_or_owner(group_id, username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            if not is_group_member(group_id, email):
                error_msg = 'Email %s invalid.' % email
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # set/unset a specific group member as admin
            if is_admin.lower() == 'true':
                GroupUser.objects.filter(
                    group_id=group_id, user_name=email).update(is_staff=True)
            elif is_admin.lower() == 'false':
                GroupUser.objects.filter(
                    group_id=group_id, user_name=email).update(is_staff=False)
            else:
                error_msg = 'is_admin invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        member_info = get_group_member_info(group_id, email)

        return Response(member_info)

    @api_check_group
    def delete(self, request, group_id, email):
        """
        User leave group or group owner/admin delete a group member.
        """

        try:
            if not is_group_member(group_id, email):
                error_msg = 'Email %s invalid.' % email
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        username = request.user.username
        # user leave group
        if username == email:
            try:
                if is_group_owner(group_id, username):
                    # group owner cannot leave group
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Group owner cannot leave group.')
                else:
                    GroupUser.objects.filter(
                        group_id=group_id, user_name=email).delete()
                return Response({'success': True})
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # group owner/admin delete a group member
        try:
            if is_group_owner(group_id, username):
                # clean related-users of projects in group or ancestors' groups
                # group owner can delete all group member
                GroupUser.objects.filter(
                    group_id=group_id, user_name=email).delete()
                return Response({'success': True})
            elif is_group_admin_or_owner(group_id, username):
                # group admin can NOT delete group owner/admin
                if not is_group_admin_or_owner(group_id, email):
                    # clean related-users of projects in group or ancestors' groups
                    GroupUser.objects.filter(
                        group_id=group_id, user_name=email).delete()
                    return Response({'success': True})
                else:
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            else:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class GroupMembersBulk(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    @api_check_group
    def post(self, request, group_id):
        """
        Bulk add group members.
        """
        username = request.user.username
        try:
            if not is_group_admin_or_owner(group_id, username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        emails_str = request.data.get('emails', '')
        emails_list = string2list(emails_str)
        emails_list = [x.lower() for x in emails_list]
        if not emails_list:
            error_msg = 'Email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        result = {}
        result['failed'] = []
        result['success'] = []
        emails_need_add = []

        org_id = None
        if is_org_context(request):
            org_id = request.user.org.org_id

        for email in emails_list:
            if not email:
                continue
            email_name = email2nickname(email)
            try:
                User.objects.get(email=email)
            except User.DoesNotExist:
                result['failed'].append({
                    'email': email,
                    'email_name': email_name,
                    'error_msg': 'User %s not found.' % email_name
                    })
                continue

            if is_group_member(group_id, email):
                result['failed'].append({
                    'email': email,
                    'email_name': email_name,
                    'error_msg': _('User %s is already a group member.') % email_name
                    })
                continue

            # Can only invite organization users to group
            if org_id and not \
                OrgUser.objects.filter(org_id=org_id, email=email).exists():
                result['failed'].append({
                    'email': email,
                    'email_name': email_name,
                    'error_msg': _('User %s not found in organization.') % email_name
                    })
                continue

            emails_need_add.append(email)

        try:
            group_members = get_group_members(group_id)
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
                GroupUser.objects.create(
                    group_id=group_id,
                    user_name=email,
                    is_staff=False,
                )
                group = Group.objects.get_group(int(group_id))
                if group:
                    add_user_to_group_notice(email, group_id, group.group_name, username)
                member_info = get_group_member_info(group_id, email)
                result['success'].append(member_info)
            except Exception as e:
                logger.error(e)
                result['failed'].append({
                    'email': email,
                    'error_msg': 'Internal Server Error'
                    })

            add_user_to_group.send(sender=None,
                                   group_staff=username,
                                   group_id=group_id,
                                   added_user=email)

        return Response(result)


class GroupSearchMember(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @api_check_group
    def get(self, request, group_id, format=None):
        """
        Search group member by email.
        """

        q = request.GET.get('q', '')
        if not q:
            error_msg = 'q invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not is_group_member(group_id, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            members = get_group_members(group_id)
        except Exception as e:
            logger.error(f'get group members failed. {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        group_members = []
        for member in members:
            member_info = get_group_member_info(group_id, member['username'])
            if q in member_info.get('contact_email') or q in member_info.get('name'):
                group_members.append(member_info)

        return Response(group_members)

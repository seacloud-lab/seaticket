# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from django.utils.translation import gettext as _

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.group.utils import get_group_member_info, is_group_member, get_group_members
from seahub.group.signals import add_user_to_group
from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.base.accounts import User
from seahub.settings import GROUP_MEMBER_LIMIT
from seahub.base.templatetags.seahub_tags import email2nickname

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.profile.models import Profile
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import GROUP_MEMBER_ADD, GROUP_MEMBER_DELETE
from seahub.group.models import Group, GroupUser
from seahub.project.models import Workspaces

logger = logging.getLogger(__name__)


class AdminGroupMembers(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, group_id, format=None):
        """ List all group members

        Permission checking:
        1. only admin can perform this action.
        """

        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        members = get_group_members(group_id)

        usernames = [m['username'] for m in members]
        try:
            profiles = Profile.objects.filter(user__in=usernames)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        users_info = {p.user: [p.contact_email, p.nickname] for p in profiles}
        group_member_list = []
        for m in members:
            email = m['username']
            avatar_url, is_default, date_uploaded = api_avatar_url(email)
            role = 'Member'
            is_admin = m['is_staff'] == 1
            if email == group.creator_name:
                role = 'Owner'
            elif is_admin:
                role = 'Admin'

            # filter empty-user from bug that made an empty-group-owner when creating department
            if role == 'Owner' and email == '':
                continue

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
                "role": role
            }
            group_member_list.append(member_info)

        return Response({
            'group_id': group_id,
            'group_name': group.group_name,
            'org_id': workspace.org_id,
            'members': group_member_list
        })

    def post(self, request, group_id):
        """
        Bulk add group members.

        Permission checking:
        1. only admin can perform this action.
        """

        # argument check
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        emails = request.POST.getlist('email', '')
        if not emails:
            error_msg = 'Email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        result = {}
        result['failed'] = []
        result['success'] = []
        emails_need_add = []

        for email in emails:
            if not email:
                continue
            try:
                User.objects.get(email=email)
            except User.DoesNotExist:
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s not found.' % email
                    })
                continue

            if is_group_member(group_id, email):
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s is already a group member.' % email2nickname(email)
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
                GroupUser.objects.group_add_member(group_id, email)
                member_info = get_group_member_info(group_id, email)
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
        admin_op_detail = {
            'group_id': group_id,
            'group_name': group.group_name,
            'username': email
        }
        admin_operation.send(
            sender=None, 
            admin_name=request.user.username,
            operation=GROUP_MEMBER_ADD, 
            detail=admin_op_detail,
            org_id=workspace.org_id
        )
        
        return Response(result)


class AdminGroupMember(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def put(self, request, group_id, email, format=None):
        """ update role of a group member

        Permission checking:
        1. only admin can perform this action.
        """

        # argument check
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            if not is_group_member(group_id, email):
                error_msg = 'Email %s invalid.' % email
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        is_admin = request.data.get('is_admin', None)
        try:
            is_admin = to_python_boolean(is_admin)
        except:
            error_msg = 'is_admin invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            
            # set/unset a specific group member as admin
            if is_admin:
                GroupUser.objects.group_set_admin(group_id, email)
            else:
                GroupUser.objects.group_unset_admin(group_id, email)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        member_info = get_group_member_info(group_id, email)
        return Response(member_info)

    def delete(self, request, group_id, email, format=None):
        """ Delete an user from group

        Permission checking:
        1. only admin can perform this action.
        """

        # argument check
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # delete member from group
        try:
            if not is_group_member(group_id, email):
                return Response({'success': True})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            GroupUser.objects.remove_group_user(email)
            admin_op_detail = {
                'group_id': group_id,
                'group_name': group.group_name,
                'username': email
            }
            admin_operation.send(
                sender=None,
                admin_name=request.user.username,
                operation=GROUP_MEMBER_DELETE,
                detail=admin_op_detail,
                org_id=workspace.org_id
            )
            
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

# Copyright (c) 2012-2016 Seafile Ltd.
import logging
from datetime import datetime, UTC

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from django.utils.translation import gettext as _

from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.project.models import Workspaces, Projects, ProjectAPIToken
from seahub.group.utils import validate_group_name, is_group_member, is_group_admin_or_owner, check_group_name_conflict, \
    refresh_group_name_cache, get_group_members, get_group_member_info
from seahub.utils import is_valid_username
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.organizations.settings import ORG_GROUP_QUOTA, FREE_ORG_GROUP_LIMIT, ADVANCE_ORG_GROUP_LIMIT
from seahub.settings import PERSONAL_GROUP_LIMIT, GROUP_MEMBER_LIMIT

from seahub.organizations.views import get_org_groups
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import GROUP_CREATE, GROUP_DELETE, GROUP_TRANSFER, GROUP_MEMBER_DELETE, BASE_DELETE
from seahub.organizations.models import Organization, OrgUser, OrgGroup
from seahub.group.models import Group, GroupUser
from seahub.profile.models import Profile
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.group.signals import add_user_to_group
from seahub.project.utils import convert_project_trash_names, get_project_owner
from seahub.notifications.utils import add_user_to_group_notice

logger = logging.getLogger(__name__)


class OrgAdminGroups(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id):
        """List organization group
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Make sure page request is an int. If not, deliver first page.
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        groups = get_org_groups(org_id, per_page * (current_page - 1), per_page)

        groups_list = []
        for i in groups:
            group = {}
            group['id'] = i.group_id
            group['group_name'] = i.group_name
            group['ctime'] = timestamp_to_isoformat_timestr(i.timestamp)
            group['creator_name'] = email2nickname(i.creator_name)
            group['creator_email'] = i.creator_name
            group['creator_contact_email'] = email2contact_email(i.creator_name)

            groups_list.append(group)

        if len(groups) == per_page:
            page_next = True
        else:
            page_next = False

        return Response({
                'groups': groups_list,
                'page': current_page,
                'per_page': per_page,
                'page_next': page_next,
                })

    def post(self, request, org_id):
        '''
        org-admin create a group
        '''
        # arguments check
        org_id = int(org_id)

        group_name  = request.data.get('group_name')
        if not group_name:
            error_msg = 'group_name %s invalid.' % group_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_name = group_name.strip()
        if not validate_group_name(group_name):
            error_msg = _('Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        group_owner = request.data.get('group_owner', '')
        if group_owner:
            try:
                User.objects.get(email=group_owner)
            except User.DoesNotExist:
                error_msg = 'User %s not found.' % group_owner
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            # check if group_owner a memeber of org
            if not OrgUser.objects.org_user_exists(org_id, group_owner):
                error_msg = 'User %s not found in organization.' % email2nickname(group_owner)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Default by login org admin user if group_owner not set
        group_owner = group_owner or request.user.username
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Check whether group name is duplicated.
        pattern_matched_groups = OrgGroup.objects.get_org_groups(org_id)
        for group in pattern_matched_groups:
            if group.group_name == group_name:
                error_msg = _('There is already a group with that name.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # quota
        group_count = len(pattern_matched_groups)
        error_msg = ''
        if not request.user.permissions.can_use_advanced_permissions() and group_count >= FREE_ORG_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % FREE_ORG_GROUP_LIMIT
        elif request.user.permissions.can_use_advanced_permissions() and group_count >= ADVANCE_ORG_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % ADVANCE_ORG_GROUP_LIMIT
        elif group_count >= ORG_GROUP_QUOTA:
            error_msg = _('Number of groups exceeds the %s limit.') % ORG_GROUP_QUOTA
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # personal group limit
        user_groups = OrgGroup.objects.get_org_groups_by_user(org_id, group_owner)
        if len(user_groups) >= PERSONAL_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % PERSONAL_GROUP_LIMIT
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # create group.
        try:
            group = OrgGroup.objects.create_org_group(org_id, group_name, username)
            group_id = group.group_id
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        username = request.user.username
        new_owner = group_owner or username

        # send org admin operation log signal
        admin_op_detail = {
            "id": group_id,
            "name": group_name,
            "owner": new_owner,
        }

        org_admin_operation.send(sender=None, admin_name=username,
                             operation=GROUP_CREATE, detail=admin_op_detail, org_id=org_id)

        # get info of new group
        group_info = {
            "id": group_id,
            "group_name": group.group_name,
            "ctime": timestamp_to_isoformat_timestr(group.timestamp),
            "creator_email": group.creator_name,
            "creator_name": email2nickname(group.creator_name),
            'creator_contact_email': email2contact_email(group.creator_name),
        }

        return Response(group_info)


class OrgAdminGroup(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id, group_id):
        """get org group info
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        try:
            org_group = OrgGroup.objects.get(group_id=group_id)
        except OrgGroup.DoesNotExist:
            error_msg = 'group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if org_group.org_id != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group = Group.objects.get_group(group_id)
        group_info = {
            "id": group.group_id,
            "group_name": group.group_name,
            "ctime": timestamp_to_isoformat_timestr(group.timestamp),
            "creator_email": group.creator_name,
            "creator_name": email2nickname(group.creator_name),
            'creator_contact_email': email2contact_email(group.creator_name),
        }

        return Response(group_info)

    def put(self, request, org_id, group_id):

        # recourse check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_owner = request.data.get('new_owner', '')
        if new_owner:
            if not is_valid_username(new_owner):
                error_msg = 'new_owner %s invalid.' % new_owner
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # check if new_owner exists,
            # NOT need to check old_owner for old_owner may has been deleted.
            try:
                User.objects.get(email=new_owner)
            except User.DoesNotExist:
                error_msg = 'User %s not found.' % new_owner
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            # check if new_owner a member of org
            if not OrgUser.objects.org_user_exists(org_id, new_owner):
                error_msg = 'User %s not found in organization.' % email2nickname(new_owner)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            old_owner = group.creator_name
            if new_owner == old_owner:
                error_msg = _('User %s is already group owner.') % new_owner
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # transfer a group
            try:
                if not is_group_member(group_id, new_owner):
                    GroupUser.objects.group_add_member(group_id, new_owner)

                if not is_group_admin_or_owner(group_id, new_owner):
                    GroupUser.objects.group_set_admin(group_id, new_owner)

                Group.objects.set_group_creator(group_id, new_owner)
                GroupUser.objects.group_unset_admin(group_id, old_owner)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            # send org admin operation log signal
            admin_op_detail = {
                "id": group_id,
                "name": group.group_name,
                "from": old_owner,
                "to": new_owner,
            }
            org_admin_operation.send(sender=None, admin_name=request.user.username,
                                 operation=GROUP_TRANSFER, detail=admin_op_detail, org_id=org_id)

        new_group_name = request.data.get('new_group_name', '')
        if new_group_name:
            try:
                # Check whether group name is validate.
                if not validate_group_name(new_group_name):
                    error_msg = _(
                        'Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                # Check whether group name is duplicated.
                if check_group_name_conflict(request, new_group_name):
                    error_msg = _('There is already a group with that name.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                Group.objects.set_group_name(group_id, new_group_name)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            refresh_group_name_cache(group_id, new_group_name)

        group = Group.objects.get_group(group_id)
        group_info = {
            "id": group.group_id,
            "group_name": group.group_name,
            "ctime": timestamp_to_isoformat_timestr(group.timestamp),
            "creator_email": group.creator_name,
            "creator_name": email2nickname(group.creator_name),
            'creator_contact_email': email2contact_email(group.creator_name),
        }

        return Response(group_info)

    def delete(self, request, org_id, group_id):
        """Remove an organization group
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        group = Group.objects.filter(group_id=group_id).first() 
        if not group:
            return Response({'success': True})

        # permission checking
        org_group = OrgGroup.objects.get(group_id=group_id)
        if org_group.org_id != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # projects check
        owner = '%s@seafile_group' % (group_id)
        workspace = Workspaces.objects.filter(owner=owner).first()
        if workspace and Projects.objects.filter(workspace=workspace, deleted=False).exists():
            return api_error(status.HTTP_400_BAD_REQUEST, _('Cannot delete group with projects'))

        # mark group's workspace as deleted
        try:
            Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now(UTC))
        except Exception as e:
            logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            OrgGroup.objects.remove_org_group(org_id, group_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        group_owner = group.creator_name
        group_name = group.group_name

        # send org admin operation log signal
        admin_op_detail = {
            "id": group_id,
            "name": group_name,
            "owner": group_owner,
        }

        org_admin_operation.send(sender=None, admin_name=request.user.username,
                                 operation=GROUP_DELETE, detail=admin_op_detail, org_id=org_id)

        return Response({'success': True})

class AdminGroupMembers(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id, group_id, format=None):
        """ List all group members

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if Organization.objects.get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
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
            is_admin = m['is_staff']
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
                "role": role
            }
            group_member_list.append(member_info)

        group_members = {
            'group_id': group_id,
            'group_name': group.group_name,
            'org_id': org_id,
            'members': group_member_list
        }

        return Response(group_members)

    def post(self, request, org_id, group_id):
        """
        Bulk add group members.

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if Organization.objects.get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
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
            if not OrgUser.objects.org_user_exists(org_id, email):
                result['failed'].append({
                    'email': email,
                    'error_msg': 'User %s not found in organization.' % email2nickname(email)
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
                add_user_to_group_notice(email, group_id, group.group_name, request.user.username)
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

        return Response(result)

class AdminGroupMember(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def put(self, request, org_id, group_id, email, format=None):
        """ update role of a group member

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if Organization.objects.get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
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

        is_admin = request.data.get('is_admin', '')
        try:
            # set/unset a specific group member as admin
            if is_admin.lower() == 'true':
                GroupUser.objects.group_set_admin(group_id, email)
            elif is_admin.lower() == 'false':
                GroupUser.objects.group_unset_admin(group_id, email)
            else:
                error_msg = 'is_admin invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        member_info = get_group_member_info(request, group_id, email)
        return Response(member_info)

    def delete(self, request, org_id, group_id, email, format=None):
        """ Delete an user from group

        Permission checking:
        1. only admin can perform this action.
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if Organization.objects.get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
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
            # remove member logic
            GroupUser.objects.filter(
                    group_id=group_id, user_name=email).delete()
            admin_op_detail = {
                'group_id': group_id,
                'group_name': group.group_name,
                'username': email
            }
            org_admin_operation.send(
                sender=None, admin_name=request.user.username, operation=GROUP_MEMBER_DELETE, detail=admin_op_detail, org_id=org_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

class OrgAdminGroupProjects(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id, group_id):
        """
        list org group projects
        """
        # resource check
        org_id = int(org_id)
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        if Organization.objects.get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project_list = []
        projects = Projects.objects.filter(workspace=workspace, deleted=False)
        for project in projects:
            owner_name, is_deleted = get_project_owner(project)
            project_dict = dict()
            project_dict['id'] = project.pk
            project_dict['workspace_id'] = project.workspace_id
            project_dict['uuid'] = project.uuid
            project_dict['name'] = project.name
            project_dict['creator'] = email2nickname(project.creator)
            project_dict['owner'] = owner_name
            project_dict['creator_email'] = project.creator
            project_dict['modifier'] = email2nickname(project.modifier)
            project_dict['created_at'] = project.created_at
            project_dict['updated_at'] = project.updated_at
            project_dict['group_id'] = group_id
            project_list.append(project_dict)

        return Response({'projects': project_list})


class OrgAdminGroupProject(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsProVersion, IsOrgAdminUser)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)

    def delete(self, request, org_id, group_id, project_uuid):
        """
        delete a project from a group
        """
        # resource check
        org_id = int(org_id)
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        if Organization.objects.get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.filter(workspace=workspace, uuid=project_uuid).first()
        if not project:
            error_msg = _('Project not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        new_project_name = convert_project_trash_names(project)

        try:
            Projects.objects.filter(id=project.id).update(
                deleted=True, delete_time=datetime.now(), name=new_project_name)
            ProjectAPIToken.objects.filter(project=project).delete()
        except Exception as e:
            logger.error('delete project: %s error: %s', project.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        detail = {
            'name': project.name,
            'project_uuid': str(project.uuid),
            'group_id': group_id,
            'group_name': Group.objects.get_group(group_id).group_name
        }

        org_admin_operation.send(
            sender=None, admin_name=request.user.username, operation=BASE_DELETE, detail=detail, org_id=org_id)

        return Response({'success': True}, status=status.HTTP_200_OK)

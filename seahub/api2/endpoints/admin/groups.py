import logging
from datetime import datetime, UTC

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils.translation import gettext as _

from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.project.models import Workspaces, Projects
from seahub.signals import group_deleted
from seahub.utils import is_valid_username
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.group.utils import is_group_member, is_group_admin_or_owner, \
        validate_group_name
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import GROUP_CREATE, GROUP_DELETE, GROUP_TRANSFER
from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.endpoints.utils import is_org_user
from seahub.organizations.models import Organization
from seahub.group.models import Group, GroupUser

logger = logging.getLogger(__name__)

def get_group_info(group, show_size=False):
    isoformat_timestr = timestamp_to_isoformat_timestr(group.timestamp)
    group_info = {
        "id": group.group_id,
        "name": group.group_name,
        "owner": group.creator_name,
        "owner_name": email2nickname(group.creator_name),
        "created_at": isoformat_timestr,
        "parent_group_id": group.parent_group_id,
    }

    return group_info

class AdminGroups(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        """ List all groups / search group by name

        Permission checking:
        1. Admin user;
        """
        # permission check
        if not request.user.admin_permissions.can_manage_group():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # search groups by name
        group_name = request.GET.get('name', '')
        group_name = group_name.strip()
        return_results = []
        if group_name:
            groups_all = Group.objects.filter(name__icontains=group_name)
            for group in groups_all:
                group_info = get_group_info(group)
                return_results.append(group_info)

            return Response({"name": group_name, "groups": return_results})

        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        start = (current_page - 1) * per_page
        end = start + per_page

        try:
            all_groups = Group.objects.all()
            groups = all_groups.order_by('-timestamp')[start:end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return_results = []

        for group in groups:
            group_info = get_group_info(group)
            return_results.append(group_info)


        return Response({"count": len(all_groups), "groups": return_results})

    def post(self, request):
        """ Create a group

        Permission checking:
        1. Admin user;
        """
        # permission check
        if not request.user.admin_permissions.can_manage_group():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # argument check
        group_name = request.data.get('group_name', '')
        if not group_name:
            error_msg = 'group_name %s invalid.' % group_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_name = group_name.strip()
        # Check whether group name is validate.
        if not validate_group_name(group_name):
            error_msg = _('Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # Check whether group name is duplicated.
        pattern_matched_groups = Group.objects.search_groups(group_name)
        for group in pattern_matched_groups:
            if group.group_name == group_name:
                error_msg = _('There is already a group with that name.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_owner = request.data.get('group_owner', '')
        if group_owner:
            try:
                User.objects.get(email=group_owner)
            except User.DoesNotExist:
                error_msg = 'User %s not found.' % group_owner
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        new_owner = group_owner or username

        # create group.
        try:
            group = Group.objects.create_group(group_name, new_owner)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # send admin operation log signal
        admin_op_detail = {
            "id": group.id,
            "name": group_name,
            "owner": new_owner,
        }
        admin_operation.send(sender=None, admin_name=username,
                operation=GROUP_CREATE, detail=admin_op_detail)

        # get info of new group
        group_info = get_group_info(group, show_size=True)

        return Response(group_info, status=status.HTTP_201_CREATED)


class AdminGroup(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def put(self, request, group_id):
        """ Admin update a group

        1. transfer a group.
        2. set group quota

        Permission checking:
        1. Admin user;
        """
        # permission check
        if not request.user.admin_permissions.can_manage_group():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # recourse check
        group_id = int(group_id) # Checked by URL Conf
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_owner = request.data.get('new_owner', '')
        if new_owner:
            org_id = Organization.objects.get_org_id_by_group(group_id)
            if org_id != -1 and not is_org_user(new_owner, org_id):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

            # send admin operation log signal
            admin_op_detail = {
                "id": group_id,
                "name": group.group_name,
                "from": old_owner,
                "to": new_owner,
            }
            if org_id != -1:
                org = Organization.objects.get_org_by_id(org_id)
                if org:
                    admin_op_detail['org_name'] = org.org_name
                    admin_op_detail['org_id'] = org.org_id
            admin_operation.send(sender=None, admin_name=request.user.username,
                    operation=GROUP_TRANSFER, detail=admin_op_detail)

        group_info = get_group_info(group, show_size=True)
        return Response(group_info)

    def delete(self, request, group_id):
        """ Dismiss a specific group
        """
        # permission check
        if not request.user.admin_permissions.can_manage_group():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            return Response({'success': True})

        if Organization.objects.get_org_id_by_group(group_id) > 0:
            error_msg = 'Can not delete an organization group'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_owner = group.creator_name
        group_name = group.group_name

        # if there are bases in this group, prohibit deletion of groups
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if Projects.objects.filter(workspace=workspace, deleted=False).exists():
            error_msg = _('Cannot delete group with projects')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # mark group's workspace as deleted
        try:
            Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now(UTC))
        except Exception as e:
            logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            Group.objects.remove_group(group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # send admin operation log signal
        admin_op_detail = {
            "id": group_id,
            "name": group_name,
            "owner": group_owner,
        }
        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=GROUP_DELETE, detail=admin_op_detail)
        group_deleted.send(sender=None, group_id=group_id)
        return Response({'success': True})


class AdminSearchGroup(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        """ Search group by name

        Permission checking:
        1. Admin user;
        """

        query_str = request.GET.get('query', '').lower().strip()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        result = []
        groups = Group.objects.search_groups(query_str)
        group_id_list = [group.group_id for group in groups]
        owner_list = ['%s@seafile_group' % group_id for group_id in group_id_list]
        workspaces = Workspaces.objects.filter(owner__in=owner_list)
        group_workspace_dict = {workspace.owner.strip('@seafile_group'): workspace.id for workspace in workspaces}

        for group in groups:
            group_info = get_group_info(group, show_size=True)
            group_info['workspace_id'] = group_workspace_dict.get(str(group.group_id))
            result.append(group_info)

        return Response({"groups": result})

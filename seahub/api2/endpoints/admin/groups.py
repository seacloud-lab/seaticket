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
from seahub.utils import is_valid_username, is_pro_version
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.group.utils import is_group_member, is_group_admin, \
        validate_group_name
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import GROUP_CREATE, GROUP_DELETE, GROUP_TRANSFER
from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.endpoints.utils import is_org_user

from seahub.group.models import Group

logger = logging.getLogger(__name__)

def get_group_info(group, show_size=False):
    isoformat_timestr = timestamp_to_isoformat_timestr(group.timestamp)
    group_info = {
        "id": group.group_id,
        "name": group.group_name,
        "owner": group.creator_name,
        "owner_name": email2nickname(group.creator_name),
        "created_at": isoformat_timestr,
        "parent_group_id": group.parent_group_id if is_pro_version() else 0
    }
    # Explicit set owner for department
    if group.parent_group_id != 0:
        group_info['owner'] = 'system admin'
        group_info['owner_name'] = 'system admin'

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
                group_info = get_group_info(group.id)
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
            groups = Group.objects.all().order_by('-timestamp')[start:end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        has_next_page = True
        if len(groups) < per_page:
            has_next_page = False

        return_results = []

        for group in groups:
            group_info = get_group_info(group)
            return_results.append(group_info)

        page_info = {
            'has_next_page': has_next_page,
            'current_page': current_page
        }

        return Response({"page_info": page_info, "groups": return_results})

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
        pattern_matched_groups = ccnet_api.search_groups(group_name, -1, -1)
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
            group_id = ccnet_api.create_group(group_name, new_owner)
        except SearpcError as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # send admin operation log signal
        admin_op_detail = {
            "id": group_id,
            "name": group_name,
            "owner": new_owner,
        }
        admin_operation.send(sender=None, admin_name=username,
                operation=GROUP_CREATE, detail=admin_op_detail)

        # get info of new group
        group_info = get_group_info(group_id, show_size=True)

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
        group = ccnet_api.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_owner = request.data.get('new_owner', '')
        if new_owner:
            org_id = ccnet_api.get_org_id_by_group(group_id)
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
                    ccnet_api.group_add_member(group_id, old_owner, new_owner)

                if not is_group_admin(group_id, new_owner):
                    ccnet_api.group_set_admin(group_id, new_owner)

                ccnet_api.set_group_creator(group_id, new_owner)
                ccnet_api.group_unset_admin(group_id, old_owner)
            except SearpcError as e:
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
                org = ccnet_api.get_org_by_id(org_id)
                if org:
                    admin_op_detail['org_name'] = org.org_name
                    admin_op_detail['org_id'] = org.org_id
            admin_operation.send(sender=None, admin_name=request.user.username,
                    operation=GROUP_TRANSFER, detail=admin_op_detail)

        # set group quota
        group_quota = request.data.get('quota', '')
        if group_quota:
            try:
                group_quota = int(group_quota)
            except ValueError:
                error_msg = 'quota invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not (group_quota > 0 or group_quota == -2):
                error_msg = 'quota invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                seafile_api.set_group_quota(group_id, group_quota)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        group_info = get_group_info(group_id, show_size=True)
        return Response(group_info)

    def delete(self, request, group_id):
        """ Dismiss a specific group
        """
        # permission check
        if not request.user.admin_permissions.can_manage_group():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        if not group:
            return Response({'success': True})

        if ccnet_api.get_org_id_by_group(group_id) > 0:
            error_msg = 'Can not delete an organization group'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_owner = group.creator_name
        group_name = group.group_name

        # if there are bases in this group, prohibit deletion of groups
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if Projects.objects.filter(workspace=workspace, deleted=False).exists():
            error_msg = _('Cannot delete group with bases')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # mark group's workspace as deleted
        try:
            Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now(UTC))
        except Exception as e:
            logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            ccnet_api.remove_group(group_id)
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
        groups = ccnet_api.search_groups(query_str, 0, 25)
        group_id_list = [group.id for group in groups]
        owner_list = ['%s@seafile_group' % group_id for group_id in group_id_list]
        workspaces = Workspaces.objects.filter(owner__in=owner_list)
        group_workspace_dict = {workspace.owner.strip('@seafile_group'): workspace.id for workspace in workspaces}

        for group in groups:
            group_info = get_group_info(group.id, show_size=True)
            group_info['workspace_id'] = group_workspace_dict.get(str(group.id))
            result.append(group_info)

        return Response({"group_list": result})

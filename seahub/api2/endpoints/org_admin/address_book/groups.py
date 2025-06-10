import logging
from datetime import datetime

from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.db import transaction
from django.utils.translation import gettext as _

from seahub.api2.utils import api_error, to_python_boolean
from seahub.signals import group_deleted
from seahub.organizations.views import get_org_id_by_group
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.permissions import IsProVersion
from seahub.api2.authentication import TokenAuthentication
from seahub.organizations.permissions import IsOrgAdmin
from seahub.organizations.utils import check_org_admin
from seahub.dtable.models import Workspaces, DTables
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.group.utils import validate_group_name, refresh_group_name_cache
from seahub.organizations.settings import ORG_GROUP_QUOTA, FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT, \
    ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT
from seahub.dtable.utils import create_repo_and_workspace
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import DEPARTMENT_CREATE, DEPARTMENT_DELETE, DEPARTMENT_RENAME

logger = logging.getLogger(__name__)

def address_book_group_to_dict(group):
    if isinstance(group, int):
        group = ccnet_api.get_group(group)

    return {
        "id": group.id,
        "name": group.group_name,
        "owner": group.creator_name,
        "created_at": timestamp_to_isoformat_timestr(group.timestamp),
        "parent_group_id": group.parent_group_id,
        "quota": seafile_api.get_group_quota(group.id),
    }

class AdminAddressBookGroups(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdmin, IsProVersion)

    @check_org_admin
    def get(self, request, org_id):
        """List top groups in org address book."""
        return_results = []

        groups = ccnet_api.get_org_top_groups(org_id)
        for group in groups:
            return_results.append(address_book_group_to_dict(group))

        return Response({"data": return_results})

    @check_org_admin
    def post(self, request, org_id):
        """Add a group in an org address book.

        parent_group: -1 - no parent group;
                      > 0 - have parent group.
        group_owner: default to system admin
        group_staff: default to system admin
        """
        group_name = request.data.get('group_name', '').strip()
        if not group_name:
            error_msg = 'name %s invalid.' % group_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # Check whether group name is validate.
        if not validate_group_name(group_name):
            error_msg = _(
                'Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_owner = request.data.get('group_owner', 'system admin')

        try:
            parent_group = int(request.data.get('parent_group', -1))
        except ValueError:
            error_msg = 'parent_group invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if parent_group < 0 and parent_group != -1:
            error_msg = 'parent_group invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # TODO: check parent group exists

        # quota
        org_groups = ccnet_api.get_org_groups(org_id, -1, -1)
        group_count = len(org_groups)
        error_msg = ''
        if not request.user.permissions.can_use_advanced_permissions() and group_count >= FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT
        elif request.user.permissions.can_use_advanced_permissions() and group_count >= ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT
        elif group_count >= ORG_GROUP_QUOTA:
            error_msg = _('Number of groups exceeds the %s limit.') % ORG_GROUP_QUOTA
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            # request called by org admin
            group_id = ccnet_api.create_org_group(org_id, group_name, group_owner, parent_group_id=parent_group)
            seafile_api.set_group_quota(group_id, -2)
        except SearpcError as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # if the group has no workspace, create a workspace
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            try:
                create_repo_and_workspace(owner, org_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # get info of new group
        group_info = address_book_group_to_dict(group_id)

        detail = {
            'name': group_name,
            'id': group_id
        }

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=DEPARTMENT_CREATE, detail=detail, org_id=org_id)

        return Response(group_info, status=status.HTTP_200_OK)


class AdminAddressBookGroup(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdmin, IsProVersion)

    def _get_address_book_group_memeber_info(self, request, group_member_obj):

        email = group_member_obj.user_name
        is_admin = bool(group_member_obj.is_staff)
        avatar_url, is_default, date_uploaded = api_avatar_url(email)
        role = 'Admin' if is_admin else 'Member'
        member_info = {
            'email': email,
            "name": email2nickname(email),
            "contact_email": email2contact_email(email),
            "avatar_url": avatar_url,
            "is_admin": is_admin,
            "role" : role
        }
        return member_info

    @check_org_admin
    def get(self, request, org_id, group_id):
        """List child groups and members in an org address book group."""
        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group = ccnet_api.get_group(group_id)
        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            return_ancestors = to_python_boolean(request.GET.get(
                'return_ancestors', 'f'))
        except ValueError:
            return_ancestors = False

        ret_dict = address_book_group_to_dict(group)
        ret_groups = []
        ret_members = []

        groups = ccnet_api.get_child_groups(group_id)
        for group in groups:
            ret_groups.append(address_book_group_to_dict(group))

        try:
            members = ccnet_api.get_group_members(group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        for m in members:
            member_info = self._get_address_book_group_memeber_info(request, m)
            # filter empty-user from bug that made an empty-group-owner when creating department
            if m.user_name == '':
                continue
            ret_members.append(member_info)

        ret_dict['groups'] = ret_groups
        ret_dict['members'] = ret_members

        if return_ancestors:
            # get ancestor groups and remove last group which is self
            ancestor_groups = ccnet_api.get_ancestor_groups(group_id)[:-1]
            ret_dict['ancestor_groups'] = [address_book_group_to_dict(grp) for grp in ancestor_groups]
        else:
            ret_dict['ancestor_groups'] = []

        return Response(ret_dict)

    @check_org_admin
    def delete(self, request, org_id, group_id):
        """ Delete an org address book group.
        """
        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        group_name = group.group_name
        if not group:
            return Response({'success': True})

        # permission check
        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            child_groups = ccnet_api.get_child_groups(group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if len(child_groups) > 0:
            error_msg = 'There are sub-departments in this department.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if workspace:
            if DTables.objects.filter(workspace=workspace, deleted=False).exists():
                error_msg = _('Cannot delete group with bases')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # mark group's workspace as deleted
            try:
                Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now())
            except Exception as e:
                logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            ccnet_api.remove_org_group(org_id, group_id)
            ret_code = ccnet_api.remove_group(group_id)
            group_deleted.send(sender=None, group_id=group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if ret_code == -1:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        detail = {
            'name': group_name
        }

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=DEPARTMENT_DELETE, detail=detail, org_id=org_id)

        return Response({'success': True})

    @check_org_admin
    def put(self, request, org_id, group_id):
        """ Update an org address book group.
        """
        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        old_group_name = group.group_name
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_group_name = request.data.get('group_name', '').strip()
        if not new_group_name:
            error_msg = 'name %s invalid.' % new_group_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # Check whether group name is validate.
        if not validate_group_name(new_group_name):
            error_msg = _(
                'Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_id = int(group_id)

        try:
            ccnet_threaded_rpc.set_group_name(group_id, new_group_name)
        except SearpcError as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        refresh_group_name_cache(group_id, new_group_name)

        detail = {
            'id': group_id,
            'old_name': old_group_name,
            'new_name': new_group_name
        }

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=DEPARTMENT_RENAME, detail=detail, org_id=org_id)

        return Response({'success': True})

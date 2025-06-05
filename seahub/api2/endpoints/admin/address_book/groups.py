import logging
from datetime import datetime

from django.db import transaction, connection
from django.utils.translation import gettext as _
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import seafile_api, ccnet_api, ccnet_threaded_rpc
from pysearpc import SearpcError

from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import GROUP_DELETE
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import to_python_boolean, api_error
from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.utils import create_repo_and_workspace, convert_dtable_trash_names
from seahub.dtable.signals import move_dtable_to_trash
from seahub.group.utils import validate_group_name, refresh_group_name_cache
from seahub.signals import group_deleted
from seahub.utils.timeutils import timestamp_to_isoformat_timestr

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
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request):
        """List top groups in address book."""
        return_results = []

        groups = ccnet_api.get_top_groups(including_org=False)
        for group in groups:
            return_results.append(address_book_group_to_dict(group))

        return Response({"data": return_results})

    def post(self, request):
        """Add a group in address book.

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
            error_msg = _('Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # Group owner is 'system admin'
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
        try:
            group_id = ccnet_api.create_group(group_name, group_owner,
                                                  parent_group_id=parent_group)
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
                org_id = -1
                create_repo_and_workspace(owner, org_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


        # get info of new group
        group_info = address_book_group_to_dict(group_id)

        return Response(group_info, status=status.HTTP_200_OK)


class AdminAddressBookGroup(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

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

    def get(self, request, group_id):
        """List child groups and members in an address book group."""
        group_id = int(group_id)

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
            member_info = self._get_address_book_group_memeber_info(request,
                    m)
            # filter empty-user from bug that made an empty-group-owner when creating department
            if m.user_name == '':
                continue
            ret_members.append(member_info)

        ret_dict['groups'] = ret_groups
        ret_dict['members'] = ret_members

        if return_ancestors:
            # get ancestor groups and remove last group which is self
            ancestor_groups = ccnet_api.get_ancestor_groups(group_id)[:-1]
            ret_dict['ancestor_groups'] = [address_book_group_to_dict(grp)
                                           for grp in ancestor_groups]
        else:
            ret_dict['ancestor_groups'] = []

        return Response(ret_dict)

    def delete(self, request, group_id):
        """ Delete an address book group.
        """
        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        if not group:
            return Response({'success': True})

        if ccnet_api.get_org_id_by_group(group_id) > 0:
            error_msg = 'Can not delete an organization department'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            child_groups = ccnet_api.get_child_groups(group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if len(child_groups) > 0:
            error_msg = _('There are sub-departments in this department.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # if there are bases in this group, prohibit deletion of groups
        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
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
            ret_code = ccnet_api.remove_group(group_id)
            group_deleted.send(sender=None, group_id=group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if ret_code == -1:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # send admin operation log signal
        group_owner = group.creator_name
        group_name = group.group_name
        admin_op_detail = {
            "id": group_id,
            "name": group_name,
            "owner": group_owner,
        }
        admin_operation.send(sender=None, admin_name=request.user.username,
                operation=GROUP_DELETE, detail=admin_op_detail)

        return Response({'success': True})

    def put(self, request, group_id):
        """ Update an address book group.
        """
        new_group_name = request.data.get('group_name', '').strip()
        if not new_group_name:
            error_msg = 'name %s invalid.' % new_group_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # Check whether group name is validate.
        if not validate_group_name(new_group_name):
            error_msg = _('Group name can only contain letters, numbers, blank, hyphen, dot, single quote or underscore')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        group_id = int(group_id)

        try:
            ccnet_threaded_rpc.set_group_name(group_id, new_group_name)
        except SearpcError as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        refresh_group_name_cache(group_id, new_group_name)

        return Response({'success': True})

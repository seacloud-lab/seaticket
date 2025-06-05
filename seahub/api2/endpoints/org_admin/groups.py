# Copyright (c) 2012-2016 Seafile Ltd.
import logging
from datetime import datetime

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from django.conf import settings
from django.utils.translation import gettext as _

from seaserv import ccnet_api, seafile_api
from pysearpc import SearpcError
from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.dtable.models import DTables, Workspaces
from seahub.dtable.utils import create_repo_and_workspace
from seahub.group.utils import validate_group_name, is_group_member, is_group_admin, check_group_name_conflict, \
    refresh_group_name_cache
from seahub.signals import group_deleted
from seahub.utils import is_valid_username
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.organizations.settings import ORG_GROUP_QUOTA, FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT, ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT
from seahub.settings import PERSONAL_GROUP_LIMIT

from seahub.organizations.views import get_org_groups, get_org_id_by_group
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import GROUP_CREATE, GROUP_DELETE, GROUP_TRANSFER
from seahub.department_v2.models import DepartmentV2Groups
from seahub.ccnet_db.ccnet.groups import search_org_group


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
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Make sure page request is an int. If not, deliver first page.
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        groups_plus_one = get_org_groups(org_id, per_page * (current_page - 1), per_page + 1)
        groups = groups_plus_one[:per_page]
        group_ids = [g.id for g in groups]
        if settings.ENABLE_ADDRESSBOOK_V2:
            department_v2_groups = DepartmentV2Groups.objects.filter(group_id__in=group_ids)
            group_id_department_dict = {d2g.group_id: d2g.department_id for d2g in department_v2_groups}
        else:
            group_id_department_dict = {}

        groups_list = []
        for i in groups:
            group = {}
            group['id'] = i.id
            group['group_name'] = i.group_name
            group['ctime'] = timestamp_to_isoformat_timestr(i.timestamp)
            if i.id in group_id_department_dict:
                group['department_id'] = group_id_department_dict[i.id]
            # parent_group_id != 0 department
            # parent_group_id == 0 ordinary group
            if i.parent_group_id == 0:
                group['creator_name'] = email2nickname(i.creator_name)
                group['creator_email'] = i.creator_name
                group['creator_contact_email'] = email2contact_email(i.creator_name)
            else:
                # Explicit set owner for department
                group['creator_name'] = 'system admin'
                group['creator_email'] = 'system admin'
                group['creator_contact_email'] = ''

            owner = '%s@seafile_group' % i.id
            workspace = Workspaces.objects.get_workspace_by_owner(owner)
            if workspace:
                repo = seafile_api.get_repo(workspace.repo_id)
                group['size'] = repo.size if repo else -1

            groups_list.append(group)

        if len(groups_plus_one) == per_page + 1:
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
            if not ccnet_api.org_user_exists(org_id, group_owner):
                error_msg = 'User %s not found in organization.' % email2nickname(group_owner)
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Default by login org admin user if group_owner not set
        group_owner = group_owner or request.user.username
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Check whether group name is duplicated.
        pattern_matched_groups = ccnet_api.get_org_groups(org_id, -1, -1)
        for group in pattern_matched_groups:
            if group.group_name == group_name:
                error_msg = _('There is already a group with that name.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # quota
        group_count = len(pattern_matched_groups)
        error_msg = ''
        if not request.user.permissions.can_use_advanced_permissions() and group_count >= FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % FREE_ORG_DEPARTMENT_OR_GROUP_LIMIT
        elif request.user.permissions.can_use_advanced_permissions() and group_count >= ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % ADVANCE_ORG_DEPARTMENT_OR_GROUP_LIMIT
        elif group_count >= ORG_GROUP_QUOTA:
            error_msg = _('Number of groups exceeds the %s limit.') % ORG_GROUP_QUOTA
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # personal group limit
        user_groups = ccnet_api.get_org_groups_by_user(org_id, group_owner)
        if len(user_groups) >= PERSONAL_GROUP_LIMIT:
            error_msg = _('Number of groups exceeds the %s limit.') % PERSONAL_GROUP_LIMIT
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # create group.
        try:
            group_id = ccnet_api.create_org_group(org_id, group_name, group_owner)
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
        group = ccnet_api.get_group(group_id)
        group_info = {
            "id": group.id,
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
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        group = ccnet_api.get_group(group_id)

        group_info = {
            "id": group.id,
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
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
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

            # check if new_owner a memeber of org
            if not ccnet_api.org_user_exists(org_id, new_owner):
                error_msg = 'User %s not found in organization.' % email2nickname(new_owner)
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

                ccnet_api.set_group_name(group_id, new_group_name)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            refresh_group_name_cache(group_id, new_group_name)

        group = ccnet_api.get_group(group_id)
        group_info = {
            "id": group.id,
            "group_name": group.group_name,
            "ctime": timestamp_to_isoformat_timestr(group.timestamp),
            "creator_email": group.creator_name,
            "creator_name": email2nickname(group.creator_name),
            'creator_contact_email': email2contact_email(group.creator_name),
        }

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if workspace:
            repo = seafile_api.get_repo(workspace.repo_id)
            group_info['size'] = repo.size if repo else -1

        return Response(group_info)

    def delete(self, request, org_id, group_id):
        """Remove an organization group
        """
        # resource check

        org_id = int(org_id)
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id = int(group_id)
        group = ccnet_api.get_group(group_id)
        if not group:
            return Response({'success': True})

        # permission checking
        if get_org_id_by_group(group_id) != org_id:
            error_msg = 'Group %s not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # dtables check
        owner = '%s@seafile_group' % (group_id)
        workspace = Workspaces.objects.filter(owner=owner).first()
        if workspace and DTables.objects.filter(workspace=workspace, deleted=False).exists():
            return api_error(status.HTTP_400_BAD_REQUEST, _('Cannot delete group with bases'))

        # mark group's workspace as deleted
        try:
            Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now())
        except Exception as e:
            logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            ccnet_api.remove_org_group(org_id, group_id)
            ccnet_api.remove_group(group_id)
            group_deleted.send(sender=None, group_id=group_id)
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
    
class OrgAdminSearchGroups(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id):
        """Query organization groups
        """

        # resource check
        try:
            org_id = int(org_id)
        except:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if not ccnet_api.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        query = request.GET.get('query', '').strip()
        if not query:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        group_infos = [{
                'id': group_info['group_id'],
                'name': group_info['group_name'],
                'owner': group_info['creator_name'],
                'created_at': timestamp_to_isoformat_timestr(group_info['timestamp']),
            } 
            for group_info in search_org_group(org_id, query, 0, 25)
        ]

        results = {
            'group_list': group_infos
        }
        
        return Response(results)

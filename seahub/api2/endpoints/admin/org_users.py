# Copyright (c) 2012-2016 Seafile Ltd.
import logging
import requests

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.project.models import Workspaces
from seahub.organizations.views import is_org_staff
from seahub.utils import is_valid_email
from seahub.utils.licenseparse import user_number_over_limit
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.base.models import UserLastLogin
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email
from seahub.profile.models import Profile
from seahub.options.models import UserOptions
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.api2.permissions import IsProVersion
from seahub.api2.endpoints.utils import is_org_user
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import USER_DELETE, USER_ADD, USER_ACTIVATE, USER_DEACTIVATE, USER_SET_ORG_ADMIN, USER_UNSET_ORG_ADMIN
from seahub.settings import FORCE_PASSWORD_CHANGE
from seahub.organizations.models import Organization, OrgUser

try:
    from seahub.settings import ORG_MEMBER_QUOTA_ENABLED
except ImportError:
    ORG_MEMBER_QUOTA_ENABLED= False

logger = logging.getLogger(__name__)


def get_org_user_info(org_id, user_obj):
    email = user_obj.email
    user_info = dict()
    workspace = Workspaces.objects.get_workspace_by_owner(email)
    user_info['org_id'] = org_id
    user_info['workspace_id'] = workspace and workspace.id or None
    user_info['email'] = email
    user_info['name'] = email2nickname(email)
    user_info['contact_email'] = email2contact_email(email)
    user_info['is_org_admin'] = True if is_org_staff(org_id, email) == 1 else False

    user_info['create_time'] = timestamp_to_isoformat_timestr(user_obj.ctime)
    user_info['last_login'] = UserLastLogin.objects.get_by_username(
        email).last_login if UserLastLogin.objects.get_by_username(email) else ''

    return user_info

def check_org_user(func):
    """
    Decorator for check if org user valid
    """
    def _decorated(view, request, org_id, email):

        # argument check
        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            org = Organization.objects.get_org_by_id(org_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # resource check
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not is_org_user(email, org_id):
            error_msg = 'User %s is not member of organization %s.' \
                    % (email, org.org_name)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        return func(view, request, org_id, email)

    return _decorated

class AdminOrgUsers(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    def get(self, request, org_id):
        """ Get all users in an org.

        Permission checking:
        1. only admin can perform this action.
        """
        # argument check
        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            is_staff = to_python_boolean(request.GET.get('is_staff', 'false'))
        except ValueError:
            error_msg = 'is_staff invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        result = []
        org_users = Organization.objects.get_org_users_by_url_prefix(org.url_prefix)
        for org_user in org_users:
            user_info = get_org_user_info(org_id, org_user)
            user_info['active'] = org_user.is_active
            result.append(user_info)

        if is_staff:
            result = [res for res in result if res.get('is_org_admin')]

        return Response({'users': result})

    def post(self, request, org_id):
        """ Add new user to org.

        Permission checking:
        1. only admin can perform this action.
        """

        if not request.user.admin_permissions.can_manage_organization():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # argument check
        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        email = request.POST.get('email', None)
        if not email or not is_valid_email(email):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        password = request.POST.get('password', None)
        if not password:
            error_msg = 'password invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        active = request.POST.get('active', 'true')
        active = active.lower()
        if active not in ('true', 'false'):
            error_msg = 'active invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_active = active == 'true'

        try:
            existed_profile = Profile.objects.filter(contact_email=email).first()
            vid = existed_profile.user if existed_profile else email
            User.objects.get(email=vid)
            user_exists = True
        except User.DoesNotExist:
            user_exists = False

        if user_exists:
            error_msg = 'User %s already exists.' % email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # check user number limit by org member quota
        org_members = Organization.objects.get_org_users_by_url_prefix(org.url_prefix)
        org_active_members = len([m for m in org_members if m.is_active])
        if ORG_MEMBER_QUOTA_ENABLED:
            from seahub.organizations.models import OrgMemberQuota
            org_members_quota = OrgMemberQuota.objects.get_quota(org_id)
            if org_members_quota is not None and org_active_members >= org_members_quota:
                error_msg = 'Failed. You can only invite %d members.' % org_members_quota
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # create user
        try:
            user = User.objects.create_user(email, password, is_staff=False,
                    is_active=is_active)
        except User.DoesNotExist as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # add user to org
        # set `is_staff` parameter as `0`
        try:
            OrgUser.objects.add_org_user(org_id, user.email, 0)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        name = request.POST.get('name', None)
        if name:
            Profile.objects.add_or_update(user.email, name)

        if FORCE_PASSWORD_CHANGE:
            UserOptions.objects.set_force_passwd_change(user.email)

        user_info = get_org_user_info(org_id, user)
        user_info['active'] = is_active

        # send admin operation log signal
        admin_op_detail = {
            'username': user.username,
        }
        admin_operation.send(sender=None, admin_name=request.user.username,
                             operation=USER_ADD, detail=admin_op_detail)

        return Response(user_info)


class AdminOrgUser(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser, IsProVersion)

    @check_org_user
    def get(self, request, org_id, email):
        """ get base info of a org user

        Permission checking:
        1. only admin can perform this action.
        """

        # argument check
        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        user_info = get_org_user_info(org_id, user_obj)
        user_info['active'] = user_obj.is_active
        return Response(user_info)

    @check_org_user
    def put(self, request, org_id, email):
        """ update base info of a org user

        Permission checking:
        1. only admin can perform this action.
        """
        # argument check
        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            org = Organization.objects.get_org_by_id(org_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # resource check
        if not org:
            error_msg = 'Organization %d not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not is_org_user(email, org_id):
            error_msg = 'User %s is not member of organization %s.' \
                    % (email, org.org_name)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not request.user.admin_permissions.can_manage_organization():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # update active
        active = request.data.get('active', None)
        if active:
            active = active.lower()
            if active not in ('true', 'false'):
                error_msg = "active invalid, should be 'true' or 'false'."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if active == 'true':
                if user_number_over_limit():
                    error_msg = 'The number of users exceeds the limit.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
                if not user.is_active and ORG_MEMBER_QUOTA_ENABLED:
                    from seahub.organizations.models import OrgMemberQuota
                    org_members_quota = OrgMemberQuota.objects.get_quota(org_id)
                    org_active_members_count = Organization.objects.count_active_members_by_org_id(org_id)
                    if org_members_quota is not None and org_active_members_count >= org_members_quota:
                        error_msg = 'The number of users exceeds the limit.'
                        return api_error(status.HTTP_403_FORBIDDEN, error_msg)
                user.is_active = True
            else:
                user.is_active = False

            try:
                # update user status
                result_code = user.save()
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            if result_code == -1:
                error_msg = 'Fail to update user %s.' % email
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            detail = {
                    'username': email,
                    }
            admin_operation.send(sender=None, admin_name=request.user.username, operation=USER_ACTIVATE if user.is_active else USER_DEACTIVATE, detail=detail)

        # update name
        name = request.data.get('name', None)
        if name:
            profile = Profile.objects.get_profile_by_user(email)
            if profile is None:
                profile = Profile(user=email)
            profile.nickname = name
            profile.save()

        # update contact_email
        contact_email = request.data.get('contact_email', None)
        if contact_email:
            profile = Profile.objects.get_profile_by_user(email)
            if profile is None:
                profile = Profile(user=email)
            profile.contact_email = contact_email
            profile.save()

        # update admin
        try:
            is_admin = to_python_boolean(request.data.get('is_admin'))
        except:
            is_admin = None
        if is_admin is True:
            OrgUser.objects.set_org_staff(org_id, user.username)
        elif is_admin is False:
            OrgUser.objects.unset_org_staff(org_id, user.username)

        if is_admin is not None:
            detail = {
                'username': email,
                'org_id': org_id,
                'org_name': org.org_name
            }
            admin_operation.send(sender=None, admin_name=request.user.username, operation=USER_SET_ORG_ADMIN if is_admin else USER_UNSET_ORG_ADMIN, detail=detail)

        user_info = get_org_user_info(org_id, user)
        user_info['active'] = user.is_active
        return Response(user_info)

    @check_org_user
    def delete(self, request, org_id, email):
        """ Delete an user from org

        Permission checking:
        1. only admin can perform this action.
        """
        if not request.user.admin_permissions.can_manage_organization():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        org = Organization.objects.get_org_by_id(org_id)
        if org.creator == email:
            error_msg = 'Failed to delete: %s is an organization creator.' % email
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            OrgUser.objects.remove_org_user(org_id, email)
            User.objects.get(email=email).delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # send admin operation log signal
        admin_op_detail = {
            "email": email,
        }
        admin_operation.send(sender=None, admin_name=request.user.username,
                             operation=USER_DELETE, detail=admin_op_detail)

        return Response({'success': True})

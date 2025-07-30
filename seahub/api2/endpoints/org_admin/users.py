# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from django.utils.translation import gettext as _
from django.conf import settings

from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error, to_python_boolean, get_user_social_auth_info
from seahub.api2.endpoints.utils import is_org_user
from seahub.base.accounts import User
from seahub.base.models import UserLastLogin
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.profile.models import Profile
from seahub.utils import is_valid_email, IS_EMAIL_CONFIGURED, send_html_email, get_site_name
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.project.models import IdInOrgTuple, Workspaces
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.utils.two_factor_auth import has_two_factor_auth
from seahub.two_factor.models import default_device, user_has_device
from seahub.options.models import UserOptions
from seahub.settings import SEND_EMAIL_ON_ACTIVATING_ORG_USER

from seahub.organizations.models import Organization, OrgUser
from seahub.organizations.settings import ORG_MEMBER_QUOTA_ENABLED
from seahub.organizations.views import is_org_staff, unset_org_user, set_org_user, set_org_staff, unset_org_staff
from seahub.weixin.utils import weixin_check
from seahub.org_work_weixin.utils import org_work_weixin_check
from seahub.org_dingtalk.utils import org_dingtalk_check
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import USER_DELETE, USER_ADD, USER_DEACTIVATE, USER_ACTIVATE


logger = logging.getLogger(__name__)


class OrgAdminUsers(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id):
        """List organization user
        """
        # resource check

        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        org = request.user.org
        # is_staff=true: return all the admins of such org
        # is_staff=false: return all the users (include admin) of such org
        try:
            is_staff = to_python_boolean(request.GET.get('is_staff', 'false'))
        except ValueError:
            error_msg = 'is_staff invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        user_list_info = {}

        if is_staff:
            org_users = Organization.objects.get_org_users_by_url_prefix(org.url_prefix)
            users = []
            if is_staff:
                for user in org_users:
                    if is_org_staff(org.org_id, user.email):
                        users.append(user)
        else:
            # Make sure page request is an int. If not, deliver first page.
            try:
                current_page = int(request.GET.get('page', '1'))
                per_page = int(request.GET.get('per_page', '25'))
            except ValueError:
                current_page = 1
                per_page = 25

            start = (current_page - 1) * per_page
            limit = per_page
            users_plus_one = OrgUser.objects.get_org_email_users(org_id, start, limit)

            if len(users_plus_one) == per_page:
                page_next = True
            else:
                page_next = False

            users = users_plus_one[:per_page]
            user_list_info.update({
                'per_page': per_page,
                'page': current_page,
                'page_next': page_next
            })

        email_list = [x.email for x in users]
        last_logins = UserLastLogin.objects.filter(username__in=email_list)
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)
        user_list = []
        for user in users:
            user_info = get_user_info(user.email, org_id)
            user_info['id_in_org'] = email2id_in_org.get(user.email, '')

            # populate user last login time
            user_info['last_login'] = None
            for last_login in last_logins:
                if last_login.username == user.email:
                    user_info['last_login'] = last_login.last_login

            user_info['id'] = user.id
            user_info['is_active'] = user.is_active
            user_info['ctime'] = timestamp_to_isoformat_timestr(user.ctime)

            # these two fields are designed to be compatible with the old API
            user_info['self_usage'] = user_info.get('quota_usage')
            user_info['quota'] = user_info.get('quota_total')
            try:
                user_info['is_org_admin'] = True if is_org_staff(org.org_id, user.email) == 1 else False
            except Exception as e:
                logger.error(e)
                user_info['is_org_admin'] = False
                continue

            if has_two_factor_auth():
                user_info['has_default_device'] = True if default_device(user) else False
                user_info['is_force_2fa'] = UserOptions.objects.is_force_2fa(user.email)
                user.username = user.email
                user_info['is_2fa_enabled'] = user_has_device(user)

            user_list.append(user_info)

        user_list_info.update({
            'user_list': user_list
        })
        return Response(user_list_info)

    def post(self, request, org_id):
        """Added an organization user, check member quota before adding.
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check plan
        url_prefix = request.user.org.url_prefix
        org_members = Organization.objects.get_org_users_by_url_prefix(url_prefix)
        org_active_members = len([m for m in org_members if m.is_active])

        if ORG_MEMBER_QUOTA_ENABLED:
            from seahub.organizations.models import OrgMemberQuota
            org_members_quota = OrgMemberQuota.objects.get_quota(request.user.org.org_id)
            if org_members_quota is not None and org_active_members >= org_members_quota:
                err_msg = 'Failed. You can only invite %d members.' % org_members_quota
                return api_error(status.HTTP_409_CONFLICT, err_msg)

        email = request.data.get('email', '')
        name = request.data.get('name', '')
        password = request.data.get('password', '')

        if not email or not is_valid_email(email):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Email invalid.')

        if not password:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Password invalid.')

        if len(password) > 4096:
            error_msg = 'Password is too long (maximum is 4096 characters).'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        name = name.strip()
        if not name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Name invalid.')

        if len(name) > 64:
            error_msg = 'Name is too long (maximum is 64 characters).'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if "/" in name:
            error_msg = "Name should not include '/'."
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = User.objects.get(email=email)
            error_msg = _('User %s already exists.') % email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except User.DoesNotExist:
            pass

        if Profile.objects.filter(contact_email=email).first():
            error_msg = _('User %s already exists.') % email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = User.objects.create_user(email, password, is_staff=False,
                                            is_active=True)
        except User.DoesNotExist as e:
            logger.error(e)
            error_msg = 'Fail to add user %s.' % email
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if user and name:
            Profile.objects.add_or_update(username=user.username, nickname=name)

        set_org_user(org_id, user.username)
        user_info = {}
        user_info['id'] = user.id
        user_info['is_active'] = user.is_active
        user_info['ctime'] = timestamp_to_isoformat_timestr(user.ctime)
        user_info['name'] = email2nickname(user.email)
        user_info['email'] = user.email
        user_info['contact_email'] = email2contact_email(user.email)
        user_info['last_login'] = None
        # send org admin operation log signal
        admin_op_detail = {
            "email": email,
            "username": user.email,
        }
        org_admin_operation.send(sender=None, admin_name=request.user.username,
                             operation=USER_ADD, detail=admin_op_detail, org_id=org_id)

        return Response(user_info)


class OrgAdminUser(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id, email):
        """Get org user info

        """

        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            err_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        # permission check
        if not OrgUser.objects.org_user_exists(org_id, email):
            err_msg = _('User %s not found in organization.') % email
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        # get user info
        user_info = get_user_info(email, org_id)
        avatar_url, is_default, date_uploaded = api_avatar_url(email)
        user_info['avatar_url'] = avatar_url

        id_id_org_query_set = IdInOrgTuple.objects.filter(virtual_id=user.email)
        user_info['id_in_org'] = id_id_org_query_set.first().id_in_org if id_id_org_query_set.exists() else ''

        if has_two_factor_auth():
            user_info['has_default_device'] = True if default_device(user) else False
            user_info['is_force_2fa'] = UserOptions.objects.is_force_2fa(email)

        if weixin_check() or org_work_weixin_check() or org_dingtalk_check():
            social_auth_info = get_user_social_auth_info(email, org_id)
            user_info.update(social_auth_info)

        return Response(user_info)

    def put(self, request, org_id, email):
        """ update name of an org user.

        Permission checking:
        1. only admin can perform this action.
        """

        # resource check
        org_id = int(org_id)
        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not is_org_user(email, org_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # update user's name
        name = request.data.get("name", None)
        if name is not None:

            name = name.strip()
            if len(name) > 64:
                error_msg = 'Name is too long (maximum is 64 characters).'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if "/" in name:
                error_msg = "Name should not include '/'."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                Profile.objects.add_or_update(email, nickname=name)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update user's contact email
        contact_email = request.data.get("contact_email", None)
        if contact_email is not None and settings.ENABLE_USER_SET_CONTACT_EMAIL:

            contact_email = contact_email.strip()
            if contact_email != '' and not is_valid_email(contact_email):
                error_msg = 'contact_email invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if Profile.objects.filter(contact_email=contact_email).exists():
                error_msg = f'Contact email {contact_email} exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                Profile.objects.add_or_update(email, contact_email=contact_email)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        is_staff = request.data.get("is_staff", None)
        if is_staff is not None:
            try:
                is_staff = to_python_boolean(is_staff)
            except ValueError:
                error_msg = 'is_staff invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if is_staff:
                if is_org_staff(org_id, user.username):
                    error_msg = '%s is already organization staff.' % email
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                set_org_staff(org_id, user.username)

            if not is_staff:
                if not is_org_staff(org_id, user.username):
                    error_msg = '%s is not organization staff.' % email
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                if OrgUser.objects.get_org_staff_count(org_id) == 1:
                    err_msg = 'At least one administrator required for an organization.'
                    return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

                unset_org_staff(org_id, user.username)

        id_in_org = request.data.get("id_in_org", None)
        if id_in_org is not None:
            if IdInOrgTuple.objects.filter(org_id=org_id, id_in_org=id_in_org).exists():
                error_msg = f'ID {id_in_org} exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                IdInOrgTuple.objects.add_or_update(virtual_id=email, id_in_org=id_in_org, org_id=org_id)
            except Exception as e:
                logger.error(f'update id_in_org failed. {e}')
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        is_active = request.data.get('is_active')
        if is_active is not None:
            if email == request.user.username:
                error_msg = "Cannot activate or inactivate yourself."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            is_active_bool = to_python_boolean(is_active)
            user.is_active = is_active_bool
            user.save()
            if is_active_bool == False:
                # del tokens and personal repo api tokens (not group)
                from seahub.utils import inactive_user
                try:
                    inactive_user(email)
                except Exception as e:
                    logger.error("Failed to inactive_user %s: %s." % (email, e))

            if user.is_active and IS_EMAIL_CONFIGURED and SEND_EMAIL_ON_ACTIVATING_ORG_USER:
                send_to = user.email
                profile = Profile.objects.get_profile_by_user(user.email)
                if profile and profile.contact_email:
                    send_to = profile.contact_email
                try:
                    send_html_email(_(u'Your account on %s is activated') % get_site_name(),
                                    'organizations/user_activation_email.html', {'username': send_to}, None,
                                    [send_to])
                except Exception as e:
                    logger.error(e)

            detail = {
                "username": user.username,
                "nickname": email2nickname(user.username)
            }
            org_admin_operation.send(sender=None, admin_name=request.user.username, operation=USER_ACTIVATE if user.is_active else USER_DEACTIVATE, detail=detail, org_id=org_id)

        info = get_user_info(email, org_id)
        info['is_active'] = user.is_active
        info['id'] = user.id
        info['ctime'] = timestamp_to_isoformat_timestr(user.ctime)
        info['id_in_org'] = id_in_org

        try:
            last_login = UserLastLogin.objects.get(username=user.email)
            info['last_login'] = last_login.last_login
        except UserLastLogin.DoesNotExist:
            info['last_login'] = None

        return Response(info)

    def delete(self, request, org_id, email):
        """Remove an organization user
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            err_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        if OrgUser.objects.is_org_staff(org_id, email) and OrgUser.objects.get_org_staff_count(org_id):
            err_msg = 'At least one administrator required for an organization.'
            return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        # permission check
        org = request.user.org
        if not OrgUser.objects.org_user_exists(org.org_id, user.username):
            err_msg = 'User %s does not exist in the organization.' % email
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        nickname = email2nickname(email)
        user.delete()
        unset_org_user(org.org_id, user.username)

        # send org admin operation log signal
        admin_op_detail = {
            "username": email,
            "nickname": nickname,
        }
        org_admin_operation.send(sender=None, admin_name=request.user.username,
                                 operation=USER_DELETE, detail=admin_op_detail, org_id=org_id)

        return Response({'success': True})


class OrgAdminSearchUsers(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id):
        """List organization user
        """
        # resource check
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        org = request.user.org


        user_list_info = {}

            # Make sure page request is an int. If not, deliver first page.
        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            page = 1
            per_page = 100

        start = (page - 1) * per_page
        end = page * per_page
        org_all_users = Organization.objects.get_org_users_by_url_prefix(
            org.url_prefix, -1, -1)

        query_str = request.GET.get('query', '').strip()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        all_email_list = [x.email for x in org_all_users]

        users_profile = Profile.objects.filter(
            user__in = all_email_list,
            nickname__icontains=query_str
        )

        email_list = [up.user for up in users_profile]
        org_users = [user for user in org_all_users if user.email in email_list]
        total_count = len(org_users)
        last_logins = UserLastLogin.objects.filter(username__in=email_list)
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)

        org_users = sorted(org_users, key=lambda u: u.ctime)

        user_list = []
        for user in org_users[start: end]:
            user_info = get_user_info(user.email, org_id)
            user_info['id_in_org'] = email2id_in_org.get(user.email, '')
            workspace = Workspaces.objects.get_workspace_by_owner(user.email)

            # populate user last login time
            user_info['last_login'] = None
            for last_login in last_logins:
                if last_login.username == user.email:
                    user_info['last_login'] = last_login.last_login

            user_info['id'] = user.id
            user_info['is_active'] = user.is_active
            user_info['ctime'] = timestamp_to_isoformat_timestr(user.ctime)

            # these two fields are designed to be compatible with the old API
            user_info['self_usage'] = user_info.get('quota_usage')
            user_info['quota'] = user_info.get('quota_total')
            user_info['workspace_id'] = workspace and workspace.id or None
            try:
                user_info['is_org_admin'] = True if is_org_staff(org.org_id, user.email) == 1 else False
            except Exception as e:
                logger.error(e)
                user_info['is_org_admin'] = False
                continue

            if has_two_factor_auth():
                user_info['has_default_device'] = True if default_device(user) else False
                user_info['is_force_2fa'] = UserOptions.objects.is_force_2fa(user.email)
                user.username = user.email
                user_info['is_2fa_enabled'] = user_has_device(user)

            user_list.append(user_info)

        user_list_info.update({
            'user_list': user_list,
            'count': total_count,
        })
        return Response(user_list_info)



def get_user_info(email, org_id):

    info = {}
    info['email'] = email
    info['name'] = email2nickname(email)
    info['contact_email'] = email2contact_email(email)

    return info

# Copyright (c) 2012-2016 Seafile Ltd.
import logging
import re
from django.db.models import Q
from types import FunctionType
from constance import config

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.cache import cache
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean

import seahub.settings as settings
from seahub.organizations.views import is_org_staff
from seahub.base.models import UserLastLogin
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname, \
    email2contact_email
from seahub.profile.models import Profile
from seahub.profile.settings import CONTACT_CACHE_TIMEOUT, CONTACT_CACHE_PREFIX, \
    NICKNAME_CACHE_PREFIX, NICKNAME_CACHE_TIMEOUT
from seahub.utils import is_valid_username, is_org_context, \
    is_pro_version, normalize_cache_key, is_valid_email, \
    IS_EMAIL_CONFIGURED, send_html_email, get_site_name
from seahub.settings import SEND_EMAIL_ON_ADDING_SYSTEM_MEMBER, INIT_PASSWD, \
    SEND_EMAIL_ON_RESETTING_USER_PASSWD, SEND_EMAIL_ON_ACTIVATING_USER, ENABLE_LDAP, \
    ENABLE_SSO_USER_CHANGE_PASSWORD, ENABLE_LDAP_USER_CHANGE_PASSWORD, FORCE_PASSWORD_CHANGE
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.utils.user_permissions import get_user_role
from seahub.role_permissions.utils import get_available_roles
from seahub.role_permissions.models import AdminRole
from seahub.constants import DEFAULT_ADMIN
from seahub.utils.licenseparse import user_number_over_limit
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import USER_DELETE, USER_ADD, USER_ACTIVATE, USER_DEACTIVATE
from seahub.options.models import UserOptions
from seahub.auth.models import UserQuota, SocialAuthUser
from seahub.utils.two_factor_auth import has_two_factor_auth
from seahub.two_factor.models import default_device
from seahub.organizations.models import Organization
from seahub.auth.models import EmailUser
from seahub.project.models import IdInOrgTuple
from seahub.group.utils import is_group_admin_or_owner_by_group
from seahub.group.models import Group, GroupUser

try:
    from seahub.settings import LDAP_PROVIDER
except ImportError:
    LDAP_PROVIDER = ''

logger = logging.getLogger(__name__)
json_content_type = 'application/json; charset=utf-8'

def get_virtual_id_by_email(email):
    profile_obj = Profile.objects.get_profile_by_contact_email(email)
    if profile_obj is None:
        return email
    else:
        return profile_obj.user

def create_user_info(request, email, role, nickname, contact_email, quota_total_mb):
    # update additional user info

    if is_pro_version() and role:
        User.objects.update_role(email, role)

    if nickname is not None:
        Profile.objects.add_or_update(email, nickname)
        key = normalize_cache_key(nickname, NICKNAME_CACHE_PREFIX)
        cache.set(key, nickname, NICKNAME_CACHE_TIMEOUT)

    if contact_email is not None:
        Profile.objects.add_or_update(email, contact_email=contact_email)
        key = normalize_cache_key(email, CONTACT_CACHE_PREFIX)
        cache.set(key, contact_email, CONTACT_CACHE_TIMEOUT)


def update_user_info(request, user, password, is_active, is_staff, role,
                     nickname, login_id, contact_email, institution_name,
                     id_in_org, unit, phone, monthly_api_call_limit_per_user):

    email = user.username

    # update basic user info
    if is_active is not None:
        user.is_active = is_active
        if is_active == False:
            # del tokens and personal repo api tokens (not group)
            from seahub.utils import inactive_user
            try:
                inactive_user(email)
            except Exception as e:
                logger.error("Failed to inactive_user %s: %s." % (email, e))

    if password:
        user.set_password(password)

    if is_staff is not None:
        user.is_staff = is_staff

    # update user
    user.save()

    # update additional user info
    if is_pro_version() and role:
        User.objects.update_role(email, role)

    if nickname is not None:
        Profile.objects.add_or_update(email, nickname)
        key = normalize_cache_key(nickname, NICKNAME_CACHE_PREFIX)
        cache.set(key, nickname, NICKNAME_CACHE_TIMEOUT)

    if login_id is not None:
        Profile.objects.add_or_update(email, login_id=login_id)

    if contact_email is not None:
        Profile.objects.add_or_update(email, contact_email=contact_email)
        key = normalize_cache_key(email, CONTACT_CACHE_PREFIX)
        cache.set(key, contact_email, CONTACT_CACHE_TIMEOUT)

    if phone is not None:
        Profile.objects.add_or_update(email, phone=phone)

    if institution_name is not None:
        Profile.objects.add_or_update(email, institution=institution_name)

    if unit is not None:
        Profile.objects.add_or_update(email, unit=unit)

    orgs = Organization.objects.get_orgs_by_user(email)
    org_id = -1
    if orgs:
        org_id = orgs[0].org_id

    if id_in_org:
        IdInOrgTuple.objects.add_or_update(virtual_id=email, id_in_org=id_in_org, org_id=org_id)

    if org_id == -1 and (monthly_api_call_limit_per_user is not None):
        uq = UserQuota.objects.get_or_create(user.username)
        uq.monthly_api_call_limit_per_user = monthly_api_call_limit_per_user if monthly_api_call_limit_per_user is not None else uq.monthly_api_call_limit_per_user
        uq.save()


def get_user_info(email):
    # this function is currently used in three api:
    # post a new user
    # get single user
    # put single user

    user = User.objects.get(email=email)
    profile = Profile.objects.get_profile_by_user(email)
    id_id_org_query_set = IdInOrgTuple.objects.filter(virtual_id=user.email)

    info = {}

    orgs = Organization.objects.get_orgs_by_user(email)
    try:
        if orgs:
            org_id = orgs[0].org_id
            info['org_id'] = org_id
            info['org_name'] = orgs[0].org_name
    except Exception as e:
        info['is_org_admin'] = False
        logger.error(e)

    info['email'] = email
    info['name'] = email2nickname(email)
    info['contact_email'] = profile.contact_email if profile and profile.contact_email else ''
    info['unit'] = profile.unit if profile and profile.unit else ''
    info['login_id'] = profile.login_id if profile and profile.login_id else ''
    info['id_in_org'] = id_id_org_query_set.first().id_in_org if id_id_org_query_set.exists() else ''

    info['is_staff'] = user.is_staff
    info['is_active'] = user.is_active
    info['phone'] = profile.phone if profile and profile.phone else ''

    info['create_time'] = timestamp_to_isoformat_timestr(user.ctime)

    if getattr(settings, 'MULTI_INSTITUTION', False):
        info['institution'] = profile.institution if profile else ''

    info['role'] = get_user_role(user)

    return info


class AdminUsers(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """List all users

        Permission checking:
        1. only admin can perform this action.
        """
        # permission check
        if not request.user.admin_permissions.can_manage_user():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            page = 1
            per_page = 25

        start = (page - 1) * per_page

        # source: 'DB' or 'LDAPImport', default is 'DB'
        source = request.GET.get('source', 'DB')
        source = source.lower()

        start = (page - 1) * per_page
        sql = """SELECT a.*, b.role FROM email_user a 
        LEFT JOIN user_role b ON a.email=b.email ORDER BY a.ctime DESC LIMIT %s OFFSET %s"""
        users = EmailUser.objects.raw(sql, (per_page, start))

        total_count = EmailUser.objects.count()

        data = []
        email_list = [user.email for user in users]
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)
        social_auth_user_queryset = SocialAuthUser.objects.filter(username__in=email_list)
        social_auth_user_dict = {}
        for item in social_auth_user_queryset:
            if item.username in social_auth_user_dict:
                social_auth_user_dict[item.username].append(item)
            else:
                social_auth_user_dict[item.username] = [item]

        profiles = list(Profile.objects.filter(user__in=email_list))
        profiles_dict = {p.user: p for p in profiles}

        for user in users:
            username = user.email
            profile = profiles_dict.get(username)
            info = {}
            info['email'] = username
            info['name'] = email2nickname(username)
            info['contact_email'] = email2contact_email(username)
            info['unit'] = profile.unit if profile and profile.unit else ''
            info['login_id'] = profile.login_id if profile and profile.login_id else ''
            info['is_staff'] = user.is_staff
            info['is_active'] = user.is_active
            info['id_in_org'] = email2id_in_org.get(user.email, '')

            org = Organization.objects.get_org_by_username(username)
            try:
                if org:
                    org_id = org.org_id
                    info['org_id'] = org_id
                    info['org_name'] = org.org_name
                    info['is_org_admin'] = True if is_org_staff(org_id, username) == 1 else False
            except Exception as e:
                logger.error(e)

            info['create_time'] = timestamp_to_isoformat_timestr(user.ctime)
            last_login_obj = UserLastLogin.objects.get_by_username(username)
            info['last_login'] = last_login_obj.last_login if last_login_obj else ''
            if not info.get('org_id'):
                info['role'] = get_user_role(user)
            else:
                info['role'] = None
            if getattr(settings, 'MULTI_INSTITUTION', False):
                info['institution'] = profile.institution if profile else ''

            social_auth_user = social_auth_user_dict.get(user.email, [])
            info['social_auth'] = [{'provider': item.provider, 'uid': item.uid} for item in social_auth_user]

            data.append(info)

        result = {'users': data, 'count': total_count}
        return Response(result)

    def post(self, request):
        # permission check
        if not request.user.admin_permissions.can_manage_user():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if user_number_over_limit():
            error_msg = _("The number of users exceeds the limit.")
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        email = request.data.get('email', None)
        if not email or not is_valid_username(email):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # basic user info check
        is_staff = request.data.get("is_staff", 'False')
        try:
            is_staff = to_python_boolean(is_staff)
        except ValueError:
            error_msg = 'is_staff invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_active = request.data.get("is_active", 'True')
        try:
            is_active = to_python_boolean(is_active)
        except ValueError:
            error_msg = 'is_active invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # additional user info check
        role = request.data.get("role", None)
        if role:
            available_roles = get_available_roles()
            if role not in available_roles:
                error_msg = 'role must be in %s.' % str(available_roles)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        name = request.data.get("name", None)
        if name:
            if len(name) > 64:
                error_msg = 'Name is too long (maximum is 64 characters).'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if "/" in name:
                error_msg = "Name should not include '/'."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        else:
            name = email.split('@')[0]

        user_exist = Profile.objects.filter(contact_email=email).exists()

        if user_exist:
            error_msg = "User %s already exists." % email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        password = request.data.get('password', None)
        if not password:
            error_msg = 'password required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(password) > 4096:
            error_msg = 'Password is too long (maximum is 4096 characters).'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # create user
        try:
            user_obj = User.objects.create_user(email, password, is_staff, is_active)
            create_user_info(request, email=user_obj.username, role=role,
                             nickname=name, contact_email=None,
                             quota_total_mb=quota_total_mb)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if FORCE_PASSWORD_CHANGE:
            UserOptions.objects.set_force_passwd_change(user_obj.email)

        add_user_tip = _('Successfully added user %(user)s.') % {'user': email}
        if IS_EMAIL_CONFIGURED and SEND_EMAIL_ON_ADDING_SYSTEM_MEMBER:
            c = {'user': request.user.username, 'email': email, 'password': password}
            try:
                send_html_email(_('You are invited to join %s') % get_site_name(),
                                'sysadmin/user_add_email.html', c, None, [email])
                add_user_tip = _('Successfully added user %(user)s. An email notification has been sent.') % {
                    'user': email}
            except Exception as e:
                logger.error(str(e))
                add_user_tip = _(
                    'Successfully added user %(user)s. But email notification can not be sent, because email service is not properly configured.') % {
                                   'user': email}

        virtual_id = get_virtual_id_by_email(email)
        user_info = get_user_info(virtual_id)
        user_info['add_user_tip'] = add_user_tip

        # send admin operation log signal
        admin_op_detail = {
            "username": user_obj.username,
        }
        admin_operation.send(sender=None, admin_name=request.user.username,
                             operation=USER_ADD, detail=admin_op_detail)

        return Response(user_info)


class AdminUser(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, email):
        # permission check
        if not (request.user.admin_permissions.can_manage_user() or \
            request.user.admin_permissions.can_update_user()):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        user_info = get_user_info(email)

        # get other detailed info
        user_info['avatar_url'], _, _ = api_avatar_url(email)
        if has_two_factor_auth():
            user_info['has_default_device'] = True if default_device(user) else False
            user_info['is_force_2fa'] = UserOptions.objects.is_force_2fa(email)

        return Response(user_info)

    def put(self, request, email):
        # permission check
        if not (request.user.admin_permissions.can_manage_user() or \
            request.user.admin_permissions.can_update_user()):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # basic user info check
        is_staff = request.data.get("is_staff", None)
        if is_staff:
            try:
                is_staff = to_python_boolean(is_staff)
            except ValueError:
                error_msg = 'is_staff invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_active = request.data.get("is_active", None)
        if is_active:
            if email == request.user.username:
                error_msg = "Cannot activate or inactivate yourself."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                is_active = to_python_boolean(is_active)
                if is_active and user_number_over_limit():
                    error_msg = _("The number of users exceeds the limit.")
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            except ValueError:
                error_msg = 'is_active invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # additional user info check
        role = request.data.get("role", None)
        if role:
            available_roles = get_available_roles()
            if role not in available_roles:
                error_msg = 'role must be in %s.' % str(available_roles)
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        name = request.data.get("name", None)
        if name:
            if len(name) > 64:
                error_msg = 'Name is too long (maximum is 64 characters).'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if "/" in name:
                error_msg = "Name should not include '/'."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # argument check for login_id
        login_id = request.data.get("login_id", None)
        if login_id is not None:
            login_id = login_id.strip()
            username_by_login_id = Profile.objects.get_username_by_login_id(login_id)
            if username_by_login_id is not None:
                return api_error(status.HTTP_400_BAD_REQUEST,
                                 _("Login id %s already exists." % login_id))

        contact_email = request.data.get("contact_email", None)
        if contact_email is not None and contact_email.strip() != '':
            contact_email = contact_email.strip()
            if not is_valid_email(contact_email):
                error_msg = 'Contact email invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if Profile.objects.filter(contact_email=contact_email).exists():
                error_msg = f'Contact email {contact_email} exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        phone = request.data.get('phone')
        if phone is not None and phone.strip() != '':
            phone = phone.strip()
            if not re.match(r'^1[3456789]\d{9}$', phone):
                return api_error(status.HTTP_400_BAD_REQUEST, 'phone invalid')
            if Profile.objects.filter(phone=phone).exists():
                error_msg = f'Phone {phone} exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org_id = -1
        try:
            orgs = Organization.objects.get_orgs_by_user(email)
            if orgs:
                org_id = orgs[0].org_id
        except Exception as e:
            logger.error(f'check org failed. {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        id_in_org = request.data.get("id_in_org", None)
        if id_in_org is not None:
            id_in_org = id_in_org.strip()

            if IdInOrgTuple.objects.filter(org_id=org_id, id_in_org=id_in_org).exists():
                error_msg = f'ID {id_in_org} exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        unit = request.data.get("unit", None)

        password = request.data.get("password")

        institution = request.data.get("institution", None)

        # api calls limit per user
        monthly_api_call_limit_per_user = request.data.get('monthly_api_call_limit_per_user')
        if monthly_api_call_limit_per_user:
            try:
                monthly_api_call_limit_per_user = int(monthly_api_call_limit_per_user)
            except:
                error_msg = "Must be an integer that is greater than or equal to 0."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if monthly_api_call_limit_per_user < 0:
                error_msg = "Limit of API calls is too low (minimum value is 0)."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # query user info
        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            update_user_info(request, user=user_obj, password=password, is_active=is_active, is_staff=is_staff,
                             role=role, nickname=name, login_id=login_id, contact_email=contact_email,
                             institution_name=institution, id_in_org=id_in_org, unit=unit, phone=phone,
                             monthly_api_call_limit_per_user=monthly_api_call_limit_per_user)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update user
        try:
            user_obj.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        update_status_tip = ''
        if is_active is not None:
            detail = {
                    "username": email,
                    }
            admin_operation.send(sender=None, admin_name=request.user.username, operation=USER_ACTIVATE if is_active else USER_DEACTIVATE, detail=detail)
            update_status_tip = _('Edit succeeded')
            if user_obj.is_active and IS_EMAIL_CONFIGURED and SEND_EMAIL_ON_ACTIVATING_USER:
                send_to = user_obj.email
                profile = Profile.objects.get_profile_by_user(user_obj.email)
                if profile and profile.contact_email:
                    send_to = profile.contact_email
                try:
                    send_html_email(_(u'Your account on %s is activated') % get_site_name(),
                                    'sysadmin/user_activation_email.html', {'username': send_to}, None,
                                    [send_to])
                    update_status_tip = _('Edit succeeded, an email has been sent.')
                except Exception as e:
                    logger.error(e)
                    update_status_tip = _(
                        'Edit succeeded, but failed to send email, please check your email configuration.')

        user_info = get_user_info(email)
        user_info['update_status_tip'] = update_status_tip

        # perhaps need to update exceed api calls status

        return Response(user_info)

    def delete(self, request, email):
        # permission check
        if not request.user.admin_permissions.can_manage_user():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # org user check
        orgs = Organization.objects.get_orgs_by_user(email)
        if orgs:
            error_msg = 'Failed to delete: %s is an organization user' % email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # delete user
        try:
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


class AdminSearchUser(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """Search user from DB and Profile

        Permission checking:
        1. only admin can perform this action.
        """

        query_str = request.GET.get('query', '').lower()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except ValueError:
            page = 1
            per_page = 25
        start = (page - 1) * per_page

        users_count = User.objects.search_emailusers_count(query_str)
        users = User.objects.search_emailusers(query_str, start, per_page)

        ccnet_user_emails = [u.email for u in users]

        # get institution for user from ccnet
        if getattr(settings, 'MULTI_INSTITUTION', False):
            user_institution_dict = {}
            profiles = Profile.objects.filter(user__in=ccnet_user_emails)
            for profile in profiles:
                email = profile.user
                if email not in user_institution_dict:
                    user_institution_dict[email] = profile.institution

            for user in users:
                user.institution = user_institution_dict.get(user.email, '')

        data = []
        for user in users:
            info = {}
            info['email'] = user.email
            info['name'] = email2nickname(user.email)
            info['contact_email'] = email2contact_email(user.email)
            info['is_staff'] = user.is_staff
            info['is_active'] = user.is_active

            orgs = Organization.objects.get_orgs_by_user(user.email)
            if orgs:
                org_id = orgs[0].org_id
                info['org_id'] = org_id
                info['org_name'] = orgs[0].org_name

            info['create_time'] = timestamp_to_isoformat_timestr(user.ctime)
            last_login_obj = UserLastLogin.objects.get_by_username(user.email)
            info['last_login'] = last_login_obj.last_login if last_login_obj else ''

            if not orgs:
                info['role'] = get_user_role(user)
            else:
                info['role'] = None

            if getattr(settings, 'MULTI_INSTITUTION', False):
                info['institution'] = user.institution

            data.append(info)

        result = {'users': data, 'count': users_count}
        return Response(result)


class AdminUserResetPassword(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, email):
        """Reset password for user

        Permission checking:
        1. only admin can perform this action.
        """
        # permission check
        if not request.user.admin_permissions.can_manage_user():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        if not is_valid_username(email):
            error_msg = 'email invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        has_bind_social_auth = False
        if SocialAuthUser.objects.filter(username=email).exists():
            has_bind_social_auth = True

        has_bind_ldap_auth = False
        if SocialAuthUser.objects.filter(username=email, provider=LDAP_PROVIDER).exists():
            has_bind_ldap_auth = True

        can_reset_password = True
        if (not ENABLE_SSO_USER_CHANGE_PASSWORD) and has_bind_social_auth:
            can_reset_password = False

        if ENABLE_LDAP and (not ENABLE_LDAP_USER_CHANGE_PASSWORD) and has_bind_ldap_auth:
            can_reset_password = False

        if not can_reset_password:
            return api_error(status.HTTP_400_BAD_REQUEST, _('Unable to reset password.'))

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as e:
            logger.error(e)
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if isinstance(INIT_PASSWD, FunctionType):
            new_password = INIT_PASSWD()
        else:
            new_password = INIT_PASSWD

        if len(new_password) > 4096:
            error_msg = 'Password is too long (maximum is 4096 characters).'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        user.set_password(new_password)
        user.save()

        if FORCE_PASSWORD_CHANGE:
            UserOptions.objects.set_force_passwd_change(user.username)

        contact_email = Profile.objects.get_contact_email_by_user(email)
        user_name = user.name
        if IS_EMAIL_CONFIGURED:
            if SEND_EMAIL_ON_RESETTING_USER_PASSWD:
                c = {'email': contact_email, 'password': new_password}
                try:
                    send_html_email(_(u'Password has been reset on %s') % get_site_name(),
                                    'sysadmin/user_reset_email.html', c, None, [contact_email])
                    reset_tip = _('Successfully reset password to %(passwd)s, an email has been sent to %(user)s.') % \
                                {'passwd': new_password, 'user': contact_email}
                except Exception as e:
                    logger.warning(e)
                    reset_tip = _(
                        'Successfully reset password to %(passwd)s, but failed to send email to %(user)s, please check your email configuration.') % \
                                {'passwd': new_password, 'user': contact_email}
            else:
                reset_tip = _('Successfully reset password to %(passwd)s for user %(user)s') % \
                            {'passwd': new_password, 'user': user_name}
        else:
            reset_tip = _(
                'Successfully reset password to %(passwd)s for user %(user)s But email notification can not be sent, because email service is not properly configured.') % \
                        {'passwd': new_password, 'user': user_name}

        return Response({'new_password': new_password, 'reset_tip': reset_tip})


class AdminUserGroups(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, email):
        """ return all groups user joined

        Permission checking:
        1. Admin user;
        """

        if not is_valid_username(email):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist as e:
            logger.error(e)
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        groups_info = []
        try:
            groups = Group.objects.get_personal_groups_by_user(email)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # Use dict to reduce memcache fetch cost in large for-loop.
        nickname_dict = {}
        creator_name_set = set([g.creator_name for g in groups])
        for e in creator_name_set:
            if e not in nickname_dict:
                nickname_dict[e] = email2nickname(e)

        for group in groups:
            isoformat_timestr = timestamp_to_isoformat_timestr(group.timestamp)
            group_info = {
                "id": group.group_id,
                "name": group.group_name,
                "owner_email": group.creator_name,
                "owner_name": nickname_dict.get(group.creator_name, ''),
                "created_at": isoformat_timestr,
                "parent_group_id": group.parent_group_id if is_pro_version() else 0
            }
            groups_info.append(group_info)

            try:
                is_group_staff = is_group_admin_or_owner_by_group(group, email)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            if email == group.creator_name:
                group_info['role'] = 'Owner'
            elif is_group_staff:
                group_info['role'] = 'Admin'
            else:
                group_info['role'] = 'Member'
        return Response({'groups': groups_info})

    def post(self, request, email):
        """add user to groups
        """
        req_group_ids = request.data.getlist('group_id')
        if not req_group_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_id invalid')
        group_ids = []
        for group_id in req_group_ids:
            try:
                group_ids.append(int(group_id))
            except:
                pass
        if not group_ids:
            return api_error(status.HTTP_404_NOT_FOUND, 'group_id invalid')

        if not is_valid_username(email):
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist as e:
            logger.error(e)
            error_msg = 'User %s not found.' % email
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        result = {}
        result['failed'] = []
        result['success'] = []
        groups_info_dict = get_groups_info(group_ids)
        in_group_ids = get_user_group_ids(email)
        for group_id in group_ids:
            group_info = groups_info_dict.get(group_id)
            if not group_info:
                result['failed'].append({
                    'group_id': group_id,
                    'error_msg': 'Group %s not found' % group_id
                })
                continue
            if group_id in in_group_ids:
                result['failed'].append({
                    'group_id': group_id,
                    'error_msg': 'User has been in group %s' % group_info['group_name']
                })
                continue
            GroupUser.objects.group_add_member(group_id, email)
            result['success'].append({
                "id": group_info['group_id'],
                "name": group_info['group_name'],
                "owner_email": group_info['group_owner'],
                "owner_name": email2nickname(group_info['group_owner']),
                "created_at": timestamp_to_isoformat_timestr(group_info['timestamp']),
                "parent_group_id": group_info['parent_group_id'],
                "role": 'Member'
            })
        return Response(result)
   

class AdminAdminUsers(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """List all admins from database and ldap imported
        """
        try:
            # EmailUser
            admin_users = User.objects.get_superusers()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        admin_users_info = []
        # rows_count_dict = get_users_rows_count([user.email for user in admin_users])
        for user in admin_users:
            user_info = {}
            profile = Profile.objects.get_profile_by_user(user.email)
            user_info['email'] = user.email
            user_info['name'] = email2nickname(user.email)
            user_info['contact_email'] = email2contact_email(user.email)
            user_info['login_id'] = profile.login_id if profile and profile.login_id else ''

            user_info['is_staff'] = user.is_staff
            user_info['is_active'] = user.is_active

            org = Organization.objects.get_org_by_username(user.email)
            try:
                if org:
                    org_id = org.org_id
                    user_info['org_id'] = org_id
                    user_info['org_name'] = org.org_name
            except Exception as e:
                logger.error(e)

            user_info['create_time'] = timestamp_to_isoformat_timestr(user.ctime)
            last_login_obj = UserLastLogin.objects.get_by_username(user.email)
            user_info['last_login'] = last_login_obj.last_login if last_login_obj else ''

            try:
                admin_role = AdminRole.objects.get_admin_role(user.email)
                user_info['admin_role'] = admin_role.role
            except AdminRole.DoesNotExist:
                user_info['admin_role'] = DEFAULT_ADMIN
            admin_users_info.append(user_info)

        result = {
            'users': admin_users_info,
        }
        return Response(result)


class AdminSearchUserByOrgId(APIView):
    """ Search user depend on org_id
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):

        query_str = request.GET.get('query', None)

        if not query_str:
            return api_error(status.HTTP_400_BAD_REQUEST, 'query invalid.')

        try:
            org_id = int(request.GET.get('org_id', -1))
        except:
            org_id = -1

        try:
            search_limit = int(request.GET.get('limit', 10))
        except:
            search_limit = 10

        try:
            start = 0

            user_list = Profile.objects.filter(
                Q(nickname__icontains=query_str) | Q(contact_email__icontains=query_str)
            ).values('user', 'nickname', 'contact_email')[start:start + search_limit]

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # format users
        users = []
        for user in user_list:
            user_info = {}
            email = user['user']
            url, is_default, date_uploaded = api_avatar_url(email)
            user_info['avatar_url'] = url
            user_info['email'] = email
            user_info['name'] = user['nickname']
            user_info['contact_email'] = user['contact_email']
            users.append(user_info)

        return Response({"users": users})

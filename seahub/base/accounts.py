# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import os
import sys
import logging
import uuid
from datetime import datetime

from django.core.mail import send_mail
from django.utils import translation
from django.utils.encoding import smart_str
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from constance import config
from seahub.constants import DEFAULT_ADMIN
from seahub.profile.models import Profile
from seahub.role_permissions.models import AdminRole
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role, \
        get_enabled_admin_role_permissions_by_role
from seahub.utils import get_site_name, \
    clear_token, get_system_admins, is_pro_version, IS_EMAIL_CONFIGURED
from seahub.utils.mail import send_html_email_with_dj_template
from seahub.utils.auth import gen_user_virtual_id
from seahub.auth.models import SocialAuthUser, UserQuota
from seahub.settings import LDAP_SAML_USE_SAME_UID, ENABLE_SASL, SASL_MECHANISM, SASL_AUTHC_ID_ATTR
from seahub.auth.models import EmailUser

try:
    from seahub.settings import CLOUD_MODE
except ImportError:
    CLOUD_MODE = False
try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False
try:
    import ldap
    import ldap.sasl
    import ldap.filter
    from seahub.settings import ENABLE_LDAP, LDAP_SERVER_URL, LDAP_BASE_DN, LDAP_ADMIN_DN, LDAP_ADMIN_PASSWORD, \
         LDAP_LOGIN_ATTR, LDAP_USER_FIRST_NAME_ATTR, LDAP_USER_LAST_NAME_ATTR, LDAP_USER_NAME_REVERSE, \
         LDAP_PROVIDER, LDAP_FILTER, LDAP_CONTACT_EMAIL_ATTR, LDAP_EMPLOYEE_ID_ATTR, \
         LDAP_USER_ROLE_ATTR
except ImportError:
    ENABLE_LDAP = False
    LDAP_SERVER_URL = ''
    LDAP_BASE_DN = ''
    LDAP_ADMIN_DN = ''
    LDAP_ADMIN_PASSWORD = ''
    LDAP_LOGIN_ATTR = ''
    LDAP_PROVIDER = ''

try:
    from seahub.settings import SAML_PROVIDER_IDENTIFIER
except ImportError:
    SAML_PROVIDER_IDENTIFIER = 'saml'

try:
    from seahub.settings import LDAP_USER_UNIQUE_ID
except ImportError:
    LDAP_USER_UNIQUE_ID = ''

LDAP_UPDATE_USER_WHEN_LOGIN = getattr(settings, 'LDAP_UPDATE_USER_WHEN_LOGIN', True)

logger = logging.getLogger(__name__)

ANONYMOUS_EMAIL = 'Anonymous'

UNUSABLE_PASSWORD = '!'  # This will never be a valid hash

def default_ldap_role_mapping(role):
    return role

def default_ldap_role_list_mapping(role_list):
    return role_list[0] if role_list else ''

ldap_role_mapping = default_ldap_role_mapping
ldap_role_list_mapping = default_ldap_role_list_mapping
USE_LDAP_ROLE_LIST_MAPPING = False

if ENABLE_LDAP:
    current_path = os.path.dirname(os.path.abspath(__file__))
    conf_dir = os.path.join(current_path, '../../../../conf')
    sys.path.append(conf_dir)
    try:
        from seatable_custom_functions.custom_functions import ldap_role_mapping
        ldap_role_mapping = ldap_role_mapping
    except:
        pass
    try:
        from seatable_custom_functions.custom_functions import ldap_role_list_mapping
        ldap_role_list_mapping = ldap_role_list_mapping
        USE_LDAP_ROLE_LIST_MAPPING = True
    except:
        pass

class UserManager(object):

    def create_user(self, email, password=None, is_staff=False, is_active=False):
        """
        Creates and saves a User with given username and password.
        """
        virtual_id = gen_user_virtual_id()

        # Lowercasing email address to avoid confusion.
        email = email.lower()

        user = User(email=virtual_id)
        user.is_staff = is_staff
        user.is_active = is_active
        user.set_password(password)
        # if user.save() == 0:
        if user.save():

            # Set email as contact email.
            Profile.objects.add_or_update(username=virtual_id, contact_email=email, need_show_video=True)

        return self.get(email=virtual_id)

    # def create_oauth_user(self, email=None, password=None, is_staff=False, is_active=False):
    #     """
    #     Creates and saves an oauth User which can without email.
    #     """
    #     virtual_id = gen_user_virtual_id()
    #
    #     user = User(email=virtual_id)
    #     user.is_staff = is_staff
    #     user.is_active = is_active
    #     user.set_password(password)
    #     if user.save() == 0:
    #
    #         # Set email as contact email.
    #         if email:
    #             email = email.lower()
    #         Profile.objects.add_or_update(username=virtual_id, contact_email=email)
    #
    #     return self.get(email=virtual_id)
    #
    # def create_ldap_user(self, email=None, password=None, nickname=None, is_staff=False, is_active=False):
    #     """
    #     Creates and saves an ldap User which can without email.
    #     """
    #     virtual_id = gen_user_virtual_id()
    #
    #     user = User(email=virtual_id)
    #     user.is_staff = is_staff
    #     user.is_active = is_active
    #     user.set_password(password)
    #     if user.save() == 0:
    #
    #         # Set email as contact email.
    #         if email:
    #             email = email.lower()
    #         Profile.objects.add_or_update(username=virtual_id, contact_email=email, nickname=nickname)
    #
    #     return self.get(email=virtual_id)
    #
    # def create_saml_user(self, email=None, password=None, nickname=None, is_staff=False, is_active=False):
    #     """
    #     Creates and saves an saml User which can without email.
    #     """
    #     virtual_id = gen_user_virtual_id()
    #
    #     user = User(email=virtual_id)
    #     user.is_staff = is_staff
    #     user.is_active = is_active
    #     user.set_password(password)
    #     if user.save() == 0:
    #
    #         # Set email as contact email.
    #         if email:
    #             email = email.lower()
    #         Profile.objects.add_or_update(username=virtual_id, contact_email=email, nickname=nickname)
    #
    #     return self.get(email=virtual_id)

    def update_role(self, email, role):
        """
        If user has a role, update it; or create a role for user.
        """
        ccnet_api.update_role_emailuser(email, role)
        return self.get(email=email)

    def create_superuser(self, email, password):
        u = self.create_user(email, password, is_staff=True, is_active=True)
        Profile.objects.add_or_update(username=u.username, nickname='admin')
        return u

    def get_superusers(self):
        """Return a list of admins.
        """
        # emailusers = ccnet_threaded_rpc.get_superusers()
        emailusers = EmailUser.objects.get_superusers()

        user_list = []
        for e in emailusers:
            user = User(e.email)
            user.id = e.id
            user.is_staff = e.is_staff
            user.is_active = e.is_active
            user.ctime = e.ctime
            user_list.append(user)

        return user_list

    def get(self, email=None, id=None):
        if not email and not id:
            raise User.DoesNotExist('User matching query does not exits.')

        if email:
            # emailuser = ccnet_threaded_rpc.get_emailuser(email)
            emailuser = EmailUser.objects.get_user_by_email(email)
        if id:
            emailuser = EmailUser.objects.get_user_by_id(id)
        if not emailuser:
            raise User.DoesNotExist('User matching query does not exits.')

        from seahub.organizations.models import Organization
        from seahub.role_permissions.models import UserRole
        org = Organization.objects.get_org_by_username(email)

        try:
            user_role = UserRole.objects.get_user_role(email)
        except UserRole.DoesNotExist:
            user_role = None

        user = User(emailuser.email)
        user.id = emailuser.id
        user.enc_password = emailuser.password
        user.is_staff = emailuser.is_staff
        user.is_active = emailuser.is_active
        user.ctime = emailuser.ctime
        user.org = org
        # user.source = emailuser.source
        user.role = user_role
        user.reference_id = emailuser.reference_id

        if user.is_staff:
            try:
                role_obj = AdminRole.objects.get_admin_role(emailuser.email)
                admin_role = role_obj.role
            except AdminRole.DoesNotExist:
                admin_role = DEFAULT_ADMIN

            user.admin_role = admin_role
        else:
            user.admin_role = ''

        return user

class UserPermissions(object):
    def __init__(self, user):
        self.user = user

    def _get_perm_by_roles(self, perm_name, default=None):
        role = self.user.role
        return get_enabled_role_permissions_by_role(role).get(perm_name, default or False)

    def can_add_group(self):
        return self._get_perm_by_roles('can_add_group')

    def can_add_dtable(self):
        return self._get_perm_by_roles('can_add_dtable')

    def can_use_global_address_book(self):
        return self._get_perm_by_roles('can_use_global_address_book')

    def can_add_public_repo(self):
        """ Check if user can create public repo or share existed repo to public.

        Used when MULTI_TENANCY feature is NOT enabled.
        """

        if CLOUD_MODE:
            if MULTI_TENANCY:
                return True
            else:
                return False
        elif self.user.is_staff:
            return True
        elif self._get_perm_by_roles('can_add_public_repo') and \
                bool(config.ENABLE_USER_CREATE_ORG_REPO):
            return True
        else:
            return False

    def can_drag_drop_folder_to_sync(self):
        return self._get_perm_by_roles('can_drag_drop_folder_to_sync')

    def can_connect_with_android_clients(self):
        return self._get_perm_by_roles('can_connect_with_android_clients')

    def can_connect_with_ios_clients(self):
        return self._get_perm_by_roles('can_connect_with_ios_clients')

    def can_connect_with_desktop_clients(self):
        return self._get_perm_by_roles('can_connect_with_desktop_clients')

    def can_invite_guest(self):
        return self._get_perm_by_roles('can_invite_guest')

    def can_create_common_dataset(self):
        return self._get_perm_by_roles('can_create_common_dataset')

    def can_export_files_via_mobile_client(self):
        return self._get_perm_by_roles('can_export_files_via_mobile_client')

    def role_quota(self):
        return self._get_perm_by_roles('role_quota')

    def role_asset_quota(self):
        return self._get_perm_by_roles('role_asset_quota')

    def can_send_share_link_mail(self):
        if not IS_EMAIL_CONFIGURED:
            return False

        return self._get_perm_by_roles('can_send_share_link_mail')

    def can_generate_external_link(self):
        return self._get_perm_by_roles('can_generate_external_link')

    def can_run_python_script(self):
        return self._get_perm_by_roles('can_run_python_script')

    def can_use_advanced_permissions(self):
        return self._get_perm_by_roles('can_use_advanced_permissions')

    def can_use_advanced_customization(self):
        return self._get_perm_by_roles('can_use_advanced_customization')

    def can_use_external_app(self):
        return self._get_perm_by_roles('can_use_external_app')

    def can_use_automation_rules(self):
        return self._get_perm_by_roles('can_use_automation_rules')

    def can_archive_rows(self):
        return self._get_perm_by_roles('can_archive_rows')

    def storage_ids(self):
        return self._get_perm_by_roles('storage_ids')

    def row_limit(self):
        return self._get_perm_by_roles('row_limit', default=-1)

    def share_limit(self):
        return self._get_perm_by_roles('share_limit', default=100)


class AdminPermissions(object):
    def __init__(self, user):
        self.user = user

    def can_view_system_info(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_view_system_info']

    def can_view_statistic(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_view_statistic']

    def can_config_system(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_config_system']

    def can_manage_library(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_library']

    def can_manage_user(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_user']

    def can_manage_group(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_group']

    def can_manage_external_link(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_external_link']

    def can_view_user_log(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_view_user_log']

    def can_view_audit_log(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_view_audit_log']

    def can_view_admin_log(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_view_admin_log']

    def can_update_user(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_update_user']

    def can_manage_app(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_app']

    def can_manage_base(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_base']

    def can_manage_form(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_form']

    def can_manage_organization(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_organization']

    def can_update_organization(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_update_organization']

    def can_manage_sys_notification(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_sys_notification']

    def can_manage_plugin(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['can_manage_plugin']

    def other_permission(self):
        return get_enabled_admin_role_permissions_by_role(self.user.admin_role)['other_permission']

class User(object):
    is_staff = False
    is_active = False
    is_superuser = False
    groups = []
    org = None
    objects = UserManager()

    @property
    def contact_email(self):
        if not hasattr(self, '_cached_contact_email'):
            self._cached_contact_email = email2contact_email(self.username)

        return self._cached_contact_email

    @property
    def name(self):
        if not hasattr(self, '_cached_nickname'):
            # convert raw string to unicode obj
            self._cached_nickname = smart_str(email2nickname(self.username))

        return self._cached_nickname

    class DoesNotExist(Exception):
        pass

    def __init__(self, email):
        self.username = email
        self.email = email
        self.permissions = UserPermissions(self)
        self.admin_permissions = AdminPermissions(self)

        self.password_changed = False

    def __unicode__(self):
        return self.username

    @property
    def is_anonymous(self):
        """
        Always returns False. This is a way of comparing User objects to
        anonymous users.
        """
        return False

    @property
    def is_authenticated(self):
        """
        Always return True. This is a way to tell if the user has been
        authenticated in templates.
        """
        return True

    def save(self):
        # emailuser = ccnet_threaded_rpc.get_emailuser(self.username)
        emailuser = EmailUser.objects.get_user_by_email(email=self.username)
        if emailuser:
            if not hasattr(self, 'password'):
                self.set_unusable_password()

            # if emailuser.source == "DB":
            #     source = "DB"
            # else:
            #     source = "LDAP"

            if not self.is_active:
                # clear web api and repo sync token
                # when inactive an user
                try:
                    clear_token(self.username)
                except Exception as e:
                    logger.error(e)

            emailuser = EmailUser.objects.update_emailuser(emailuser.id, self.password, int(self.is_staff), int(self.is_active))
            # result_code = ccnet_threaded_rpc.update_emailuser(source,
            #                                                   emailuser.id,
            #                                                   self.password,
            #                                                   int(self.is_staff),
            #                                                   int(self.is_active))
            if self.password_changed:
                # emailuser = ccnet_threaded_rpc.get_emailuser(self.username)
                emailuser = EmailUser.objects.get(email=self.username)
                self.enc_password = emailuser.password
                self.password_changed = False
        else:
            # result_code = ccnet_threaded_rpc.add_emailuser(self.username,
            #                                                self.password,
            #                                                int(self.is_staff),
            #                                                int(self.is_active))
            emailuser = EmailUser.objects.add_emailuser(self.username,
                                                           self.password,
                                                           int(self.is_staff),
                                                           int(self.is_active))
        # -1 stands for failed; 0 stands for success
        # return result_code
        return emailuser

    def delete(self):
        """
        When delete user, we should also delete group relationships.
        """
        # if self.source == "DB":
        #     source = "DB"
        # else:
        #     source = "LDAP"

        username = self.username

        # orgs = []
        # if is_pro_version():
        #     orgs = ccnet_api.get_orgs_by_user(username)

        # # remove owned repos
        # owned_repos = []
        # if orgs:
        #     for org in orgs:
        #         owned_repos += seafile_api.get_org_owned_repo_list(org.org_id,
        #                                                            username)
        # else:
        #     owned_repos += seafile_api.get_owned_repo_list(username)
        #
        # for r in owned_repos:
        #     seafile_api.remove_repo(r.id)
        #
        # # remove shared in repos
        # shared_in_repos = []
        # if orgs:
        #     for org in orgs:
        #         org_id = org.org_id
        #         shared_in_repos = seafile_api.get_org_share_in_repo_list(org_id,
        #                 username, -1, -1)
        #
        #         for r in shared_in_repos:
        #             seafile_api.org_remove_share(org_id,
        #                     r.repo_id, r.user, username)
        # else:
        #     shared_in_repos = seafile_api.get_share_in_repo_list(username, -1, -1)
        #     for r in shared_in_repos:
        #         seafile_api.remove_share(r.repo_id, r.user, username)

        # clear web api and repo sync token
        # when delete user
        try:
            clear_token(self.username)
        except Exception as e:
            logger.error(e)

        # remove current user from joined groups
        from seahub.group.models import GroupUser

        # team 被删除了，这个team下某个用户的所有用户数据就都删除了
        GroupUser.objects.remove_group_user(username)
        # ccnet_api.remove_group_user(username)
        EmailUser.objects.remove_emailuser(username)
        # ccnet_api.remove_emailuser(source, username)

        SocialAuthUser.objects.filter(username=username).delete()
        # UserQuota.objects.filter(username=username).delete()

        from seahub.registration.signals import user_deleted

        user_deleted.send(sender=self.__class__, username=username)

        Profile.objects.delete_profile_by_user(username)
        self.delete_user_options(username)

    def get_username(self):
        return self.username

    def delete_user_options(self, username):
        """Remove user's all options.
        """
        from seahub.options.models import UserOptions
        UserOptions.objects.filter(email=username).delete()

    def get_and_delete_messages(self):
        messages = []
        return messages

    def set_password(self, raw_password):
        if raw_password is None:
            self.set_unusable_password()
        else:
            self.password = '%s' % raw_password

        self.password_changed = True

        # clear web api and repo sync token
        # when user password change
        try:
            clear_token(self.username)
        except Exception as e:
            logger.error(e)

    def check_password(self, raw_password):
        """
        Returns a boolean of whether the raw_password was correct. Handles
        encryption formats behind the scenes.
        """
        # Backwards-compatibility check. Older passwords won't include the
        # algorithm or salt.

        # if '$' not in self.password:
        #     is_correct = (self.password == \
        #                       get_hexdigest('sha1', '', raw_password))
        #     return is_correct
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.enc_password)

    def set_unusable_password(self):
        # Sets a value that will never be a valid hash
        self.password = UNUSABLE_PASSWORD

    def email_user(self, subject, message, from_email=None):
        # Sends an e-mail to this User.
        send_mail(subject, message, from_email, [self.contact_email])

    def freeze_user(self, notify_admins=False):
        self.is_active = False
        self.save()

        if notify_admins:
            admins = get_system_admins()
            for u in admins:
                # save current language
                cur_language = translation.get_language()

                # get and active user language
                user_language = Profile.objects.get_user_language(u.email)
                translation.activate(user_language)

                send_to = u.email
                profile = Profile.objects.get_profile_by_user(u.email)
                if profile and profile.contact_email:
                    send_to = profile.contact_email

                send_html_email_with_dj_template(
                    send_to, dj_template='sysadmin/user_freeze_email.html',
                    subject=_('Account %(account)s froze on %(site)s.') % {
                        "account": self.email,
                        "site": get_site_name(),
                    },
                    context={'user': self.email}
                )

                # restore current language
                translation.activate(cur_language)


class AuthBackend(object):

    def get_user_with_import(self, username):
        # emailuser = seaserv.get_emailuser_with_import(username)
        # if not emailuser:
        #     raise User.DoesNotExist('User matching query does not exits.')
        #
        # user = User(emailuser.email)
        # user.id = emailuser.id
        # user.enc_password = emailuser.password
        # user.is_staff = emailuser.is_staff
        # user.is_active = emailuser.is_active
        # user.ctime = emailuser.ctime
        # user.org = emailuser.org
        # user.source = emailuser.source
        # user.role = emailuser.role

        user = User.objects.get(username)

        if user.is_staff:
            try:
                role_obj = AdminRole.objects.get_admin_role(user.email)
                admin_role = role_obj.role
            except AdminRole.DoesNotExist:
                admin_role = DEFAULT_ADMIN

            user.admin_role = admin_role
        else:
            user.admin_role = ''

        return user

    def get_user(self, username):
        try:
            user = self.get_user_with_import(username)
        except User.DoesNotExist:
            user = None
        return user

    def authenticate(self, username=None, password=None):
        user = self.get_user(username)
        if not user:
            return None
        if user.check_password(password):
            return user


def parse_ldap_res(ldap_search_result):
    first_name = ''
    last_name = ''
    unique_id = ''
    contact_email = ''
    id_in_org = ''
    user_role = ''
    authc_id = ''
    login_attr = ''
    dn = ldap_search_result[0][0]
    first_name_list = ldap_search_result[0][1].get(LDAP_USER_FIRST_NAME_ATTR, [])
    last_name_list = ldap_search_result[0][1].get(LDAP_USER_LAST_NAME_ATTR, [])
    unique_id_list = ldap_search_result[0][1].get(LDAP_USER_UNIQUE_ID, [])
    login_attr_list = ldap_search_result[0][1].get(LDAP_LOGIN_ATTR, [])
    contact_email_list = ldap_search_result[0][1].get(LDAP_CONTACT_EMAIL_ATTR, [])
    id_in_org_list = ldap_search_result[0][1].get(LDAP_EMPLOYEE_ID_ATTR, [])
    user_role_list = ldap_search_result[0][1].get(LDAP_USER_ROLE_ATTR, [])
    authc_id_list = list()
    if ENABLE_SASL and SASL_MECHANISM:
        authc_id_list = ldap_search_result[0][1].get(SASL_AUTHC_ID_ATTR, [])

    if first_name_list:
        first_name = first_name_list[0].decode()
    if last_name_list:
        last_name = last_name_list[0].decode()

    if LDAP_USER_NAME_REVERSE:
        nickname = last_name + ' ' + first_name
    else:
        nickname = first_name + ' ' + last_name

    if unique_id_list:
        try:
            unique_id = uuid.UUID(bytes=unique_id_list[0])
        except ValueError:
            unique_id = unique_id_list[0].decode()

    if login_attr_list:
        login_attr = login_attr_list[0].decode()

    else:
        logger.error(f'Get ldap user {LDAP_LOGIN_ATTR} failed.')

    if contact_email_list:
        contact_email = contact_email_list[0].decode()

    if id_in_org_list:
        id_in_org = id_in_org_list[0].decode()

    if user_role_list:
        if not USE_LDAP_ROLE_LIST_MAPPING:
            role = user_role_list[0].decode()
            user_role = ldap_role_mapping(role)
        else:
            role_list = [role.decode() for role in user_role_list]
            user_role = ldap_role_list_mapping(role_list)

    if authc_id_list:
        authc_id = authc_id_list[0].decode()

    return dn, nickname, unique_id, login_attr, contact_email, id_in_org, user_role, authc_id


class CustomLDAPBackend(object):
    """ A custom LDAP authentication backend """

    def get_user(self, username):
        try:
            user = User.objects.get(username)
        except User.DoesNotExist:
            user = None
        return user

    def authenticate(self, username, password):
        if not is_pro_version() or not ENABLE_LDAP or LDAP_SAML_USE_SAME_UID:
            return

        self.l = ldap.initialize(LDAP_SERVER_URL)

        try:
            self.l.set_option(ldap.OPT_REFERRALS, 0)
        except Exception as e:
            logger.error(f'Failed to set referrals option. {e}')
            return

        try:
            self.l.protocol_version = ldap.VERSION3
            if ENABLE_SASL and SASL_MECHANISM:
                sasl_cb_value_dict = {}
                if SASL_MECHANISM != 'EXTERNAL' and SASL_MECHANISM != 'GSSAPI':
                    sasl_cb_value_dict = {
                        ldap.sasl.CB_AUTHNAME: LDAP_ADMIN_DN,
                        ldap.sasl.CB_PASS: LDAP_ADMIN_PASSWORD,
                    }
                sasl_auth = ldap.sasl.sasl(sasl_cb_value_dict, SASL_MECHANISM)
                self.l.sasl_interactive_bind_s('', sasl_auth)
            else:
                self.l.simple_bind_s(LDAP_ADMIN_DN, LDAP_ADMIN_PASSWORD)
        except Exception as e:
            logger.error(f'ldap admin bind failed. {e}')
            return

        if LDAP_LOGIN_ATTR.lower() in ['email', 'mail']:
            filterstr = ldap.filter.filter_format('(&(mail=%s))', [username])
        else:
            filterstr = ldap.filter.filter_format(f'(&({LDAP_LOGIN_ATTR}=%s))', [username])

        if LDAP_FILTER:
            filterstr = filterstr[:-1] + '(' + LDAP_FILTER + '))'

        try:
            result_data = self.l.search_s(LDAP_BASE_DN, ldap.SCOPE_SUBTREE, filterstr)
        except Exception as e:
            logger.error(f'ldap user search failed. {e}')
            return

        # user not found in ldap
        if not result_data:
            logger.error(f'ldap user {username} not found.')
            return

        # delete old ldap connection instance and create new, if not, some err will occur
        self.l.unbind_s()
        del self.l
        self.l = ldap.initialize(LDAP_SERVER_URL)

        try:
            dn, nickname, unique_id, login_attr, contact_email, id_in_org, user_role, authc_id = parse_ldap_res(result_data)
        except Exception as e:
            logger.error(f'parse ldap result failed {e}')
            return

        if contact_email == '':
            contact_email = username

        try:
            self.l.protocol_version = ldap.VERSION3
            if ENABLE_SASL and SASL_MECHANISM:
                sasl_cb_value_dict = {}
                if SASL_MECHANISM != 'EXTERNAL' and SASL_MECHANISM != 'GSSAPI':
                    sasl_cb_value_dict = {
                        ldap.sasl.CB_AUTHNAME: authc_id,
                        ldap.sasl.CB_PASS: password,
                    }
                sasl_auth = ldap.sasl.sasl(sasl_cb_value_dict, SASL_MECHANISM)
                self.l.sasl_interactive_bind_s('', sasl_auth)
            else:
                self.l.simple_bind_s(dn, password)
        except Exception as e:
            logger.error(f'ldap user bind failed. {e}')
            return
        self.l.unbind_s()

        # check if existed
        ldap_auth_user = SocialAuthUser.objects.filter(provider=LDAP_PROVIDER, uid=login_attr).first()
        if not ldap_auth_user:
            ldap_auth_user = SocialAuthUser.objects.filter(provider=LDAP_PROVIDER, uid=unique_id).first()

        if not ldap_auth_user:
            try:
                user = User.objects.create_ldap_user(
                    email=contact_email, nickname=nickname, is_active=True)
                ldap_auth_user = SocialAuthUser.objects.add(user.username, LDAP_PROVIDER, login_attr)
            except Exception as e:
                logger.error(f'create ldap user failed. {e}')
                return

        user = self.get_user(ldap_auth_user.username)
        if not user:
            logger.warning('The DB data is invalid, delete it and recreate one.')
            try:
                SocialAuthUser.objects.filter(provider=LDAP_PROVIDER, uid=login_attr).delete()
                user = User.objects.create_ldap_user(
                    email=contact_email, nickname=nickname, is_active=True)
                SocialAuthUser.objects.add(user.username, LDAP_PROVIDER, login_attr)
            except Exception as e:
                logger.error(f'recreate ldap user failed. {e}')
                return

        # login_attr
        if not SocialAuthUser.objects.filter(
                provider=LDAP_PROVIDER, uid=login_attr).exists():
            SocialAuthUser.objects.add(user.username, LDAP_PROVIDER, login_attr)

        username = user.username
        # update user's id_in_org
        org_id = -1
        orgs = ccnet_api.get_orgs_by_user(username)
        if orgs:
            org_id = orgs[0].org_id
        if id_in_org:
            from seahub.dtable.models import IdInOrgTuple
            IdInOrgTuple.objects.add_or_update(username, id_in_org, org_id)

        if LDAP_UPDATE_USER_WHEN_LOGIN:
            try:
                if nickname:
                    Profile.objects.add_or_update(username, nickname=nickname)
                if contact_email:
                    p = Profile.objects.get_profile_by_user(username)
                    if not (p and p.is_manually_set_contact_email):
                        Profile.objects.add_or_update(username, contact_email=contact_email)
            except Exception as e:
                logger.error(f'update ldap user failed {e}')
                return

        if user_role:
            User.objects.update_role(username, user_role)
        return user


# Move here to avoid circular import
from seahub.base.templatetags.seahub_tags import email2nickname, \
    email2contact_email

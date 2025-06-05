# Copyright (c) 2012-2016 Seafile Ltd.
import datetime
import hashlib
import urllib.request, urllib.parse, urllib.error
import logging

# import auth
from django.core.exceptions import ImproperlyConfigured
from django.db import models
from django.db.models.manager import EmptyManager
from django.contrib.contenttypes.models import ContentType
from django.utils.encoding import smart_str
from django.utils.translation import gettext_lazy as _

from seaserv import ccnet_api, seafile_api

from seahub.constants import DEFAULT_USER
from seahub.ccnet_db.ccnet.users import get_users_role
from seahub.dtable.signals import move_dtable_to_trash
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from seahub.utils.file_size import get_quota_from_string
from seahub.utils.timeutils import datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)
UNUSABLE_PASSWORD = '!'  # This will never be a valid hash


def get_hexdigest(algorithm, salt, raw_password):
    """
    Returns a string of the hexdigest of the given plaintext password and salt
    using the given algorithm ('md5', 'sha1' or 'crypt').
    """
    raw_password, salt = smart_str(raw_password).encode('utf-8'), smart_str(salt).encode('utf-8')
    if algorithm == 'crypt':
        try:
            import crypt
        except ImportError:
            raise ValueError('"crypt" password algorithm not supported in this environment')
        return crypt.crypt(raw_password, salt)

    if algorithm == 'md5':
        return hashlib.md5(salt + raw_password).hexdigest()
    elif algorithm == 'sha1':
        return hashlib.sha1(salt + raw_password).hexdigest()
    raise ValueError("Got unknown password algorithm type in password.")


def check_password(raw_password, enc_password):
    """
    Returns a boolean of whether the raw_password was correct. Handles
    encryption formats behind the scenes.
    """
    algo, salt, hsh = enc_password.split('$')
    return hsh == get_hexdigest(algo, salt, raw_password)


class SiteProfileNotAvailable(Exception):
    pass


class AnonymousUser(object):
    id = None
    username = ''
    is_staff = False
    is_active = False
    is_superuser = False
    org = None
    _groups = EmptyManager(object)
    _user_permissions = EmptyManager(object)

    def __init__(self):
        pass

    def __unicode__(self):
        return 'AnonymousUser'

    def __str__(self):
        return 'AnonymousUser'

    def __eq__(self, other):
        return isinstance(other, self.__class__)

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return 1  # instances always return the same hash value

    def save(self):
        raise NotImplementedError

    def delete(self):
        raise NotImplementedError

    def set_password(self, raw_password):
        raise NotImplementedError

    def check_password(self, raw_password):
        raise NotImplementedError

    def _get_groups(self):
        return self._groups

    groups = property(_get_groups)

    def _get_user_permissions(self):
        return self._user_permissions

    user_permissions = property(_get_user_permissions)

    def get_group_permissions(self, obj=None):
        return set()

    def get_all_permissions(self, obj=None):
        return _user_get_all_permissions(self, obj=obj)

    def has_perm(self, perm, obj=None):
        return _user_has_perm(self, perm, obj=obj)

    def has_perms(self, perm_list, obj=None):
        for perm in perm_list:
            if not self.has_perm(perm, obj):
                return False
        return True

    def has_module_perms(self, module):
        return _user_has_module_perms(self, module)

    def get_and_delete_messages(self):
        return []

    @property
    def is_anonymous(self):
        return True

    @property
    def is_authenticated(self):
        return False


class SocialAuthUserManager(models.Manager):
    def add(self, username, provider, uid, extra_data=''):
        try:
            social_auth_user = self.model(username=username, provider=provider, uid=uid, extra_data=extra_data)
            social_auth_user.save()
            return social_auth_user
        except Exception as e:
            logger.error(e)
            return None

    def get_by_provider_and_uid(self, provider, uid):
        try:
            social_auth_user = self.get(provider=provider, uid=uid)
            return social_auth_user
        except self.model.DoesNotExist:
            return None

    def delete_by_username_and_provider(self, username, provider):
        self.filter(username=username, provider=provider).delete()


class SocialAuthUser(models.Model):
    username = models.CharField(max_length=255, db_index=True)
    provider = models.CharField(max_length=32)
    uid = models.CharField(max_length=255)
    extra_data = models.TextField()
    objects = SocialAuthUserManager()

    class Meta:
        """Meta data"""
        app_label = "base"
        unique_together = ('provider', 'uid')
        db_table = 'social_auth_usersocialauth'


class UserQuotaManager(models.Manager):

    def get_or_create(self, username):
        us = super(UserQuotaManager, self).filter(username=username).first()
        if not us:
            us = super(UserQuotaManager, self).create(username=username)
        return us

    def get_row_limit(self, username, role=None, user_obj=None):
        """
        return:
        (row_limit, error)
        if it is org.user error is not None
        """
        if ccnet_api.get_orgs_by_user(username):
            return (None, Exception('user: %s is org user' % (username,)))
        uq = super(UserQuotaManager, self).filter(username=username).first()
        if uq and uq.row_limit is not None and uq.row_limit != 0:
            return (uq.row_limit, None)
        if not role:
            if not user_obj:
                user_obj = ccnet_api.get_emailuser_with_import(username)
            role = user_obj.role
        row_limit = get_enabled_role_permissions_by_role(role).get('row_limit', -1)
        return (row_limit, None)

    def get_asset_quota(self, username, role=None, user_obj=None):
        """
        return:
        (asset_quota, error)
        if it is org.user error is not None
        """
        if ccnet_api.get_orgs_by_user(username):
            return (None, Exception('user: %s is org user' % (username,)))
        uq = super(UserQuotaManager, self).filter(username=username).first()
        if uq and uq.asset_quota is not None and uq.asset_quota != 0:
            return (uq.asset_quota, None)
        else:
            if not role:
                if not user_obj:
                    user_obj = ccnet_api.get_emailuser_with_import(username)
                role = user_obj.role
            asset_quota = get_enabled_role_permissions_by_role(role).get('role_asset_quota', '')
            return (get_quota_from_string(asset_quota) if asset_quota else -2, None)

    def get_monthly_api_call_limit_per_user(self, username, role=None, user_obj=None):
        uq = super(UserQuotaManager, self).filter(username=username).first()
        if uq:
            if uq.monthly_api_call_limit_per_user and uq.monthly_api_call_limit_per_user > 0:
                return uq.monthly_api_call_limit_per_user

        if not role:
            if not user_obj:
                user_obj = ccnet_api.get_emailuser_with_import(username)
            role = user_obj.role
        monthly_api_call_limit_per_user = get_enabled_role_permissions_by_role(role).get('monthly_api_call_limit_per_user', -1)
        return monthly_api_call_limit_per_user

    def batch_get_monthly_api_call_limit(self, usernames):
        """
        return:
        a dict of {org_id: number of api_call_limit}
        """
        limit_per_user_dict = {}  # {username: limit_per_user}
        roles_dict = {}           # {username: role}
        # query limits per user
        ## query limits in db
        queryset = list(super(UserQuotaManager, self).filter(username__in=usernames))
        for item in queryset:
            if item.monthly_api_call_limit_per_user:
                limit_per_user_dict[item.username] = item.monthly_api_call_limit_per_user

        # query roles
        users_role_dict = get_users_role(usernames)
        for username in usernames:
            role = users_role_dict.get(username) or DEFAULT_USER
            roles_dict[username] = role

        # query limits not in db
        for username in usernames:
            if username in limit_per_user_dict:
                continue
            role = roles_dict[username]
            limit_per_user_dict[username] = get_enabled_role_permissions_by_role(role).get('monthly_api_call_limit_per_user', -1)

        results = {}
        for username in usernames:
            limit_per_user = limit_per_user_dict[username]
            if limit_per_user < 0:
                results[username] = -1
                continue
            results[username] = limit_per_user

        return results

    def get_scripts_running_limit(self, username, role=None, user_obj=None):
        """
        return: (scripts_running_limit, error)
        scripts_running_limit: a number, int
        """
        if ccnet_api.get_orgs_by_user(username):
            return (None, 'user: %s is org user' % (username,))
        if not role:
            if not user_obj:
                user_obj = ccnet_api.get_emailuser_with_import(username)
            role = user_obj.role if user_obj else role
        scripts_running_limit = get_enabled_role_permissions_by_role(role).get('scripts_running_limit', -1)
        return (scripts_running_limit, None)


class UserQuota(models.Model):
    username = models.CharField(max_length=255, db_index=True, unique=True)
    asset_quota = models.BigIntegerField()
    row_limit = models.IntegerField()
    monthly_api_call_limit_per_user = models.IntegerField()

    objects = UserQuotaManager()

    class Meta:
        app_label = "base"
        db_table = 'user_quota'


class SessionLogManager(models.Manager):
    def create(self, user_name, user_agent, remote_address, session_key):
        return super(SessionLogManager, self).create(
            user_name=user_name,
            user_agent=user_agent,
            remote_address=remote_address,
            session_key=session_key,
            op_time=datetime.datetime.now()
        )


class SessionLog(models.Model):
    user_name = models.CharField(max_length=255, db_index=True)
    user_agent = models.CharField(max_length=512)
    remote_address = models.CharField(max_length=60)
    session_key = models.CharField(max_length=40)
    op_time = models.DateTimeField()

    objects = SessionLogManager()

    class Meta:
        app_label = "base"
        db_table = 'session_log'

    def to_dict(self):
        return {
            'id': self.pk,
            'user_name': self.user_name,
            'user_agent': self.user_agent,
            'remote_address': self.remote_address,
            'session_key': self.session_key,
            'op_time': datetime_to_isoformat_timestr(self.op_time)
        }


# # handle signals
from django.dispatch import receiver
from seahub.auth.signals import user_logged_in


@receiver(user_logged_in)
def _handle_auth_login(sender, request, user, **kwargs):
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    remote_address = request.META.get('REMOTE_ADDR', '')
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if x_forwarded_for:
        remote_address = x_forwarded_for.split(',')[0]
    session_key = request.session.session_key
    if session_key:
        request.session['user_agent'] = user_agent
        request.session['remote_address'] = remote_address
        request.session['op_time'] = datetime_to_isoformat_timestr(datetime.datetime.now())
        try:
            SessionLog.objects.create(user.username, user_agent, remote_address, session_key)
        except Exception as e:
            logger.error('save session log error: %s', e)

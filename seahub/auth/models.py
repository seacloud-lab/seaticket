# Copyright (c) 2012-2016 Seafile Ltd.
import datetime
import hashlib
import time
import logging

from django.db import models
from django.db.models.manager import EmptyManager
from django.utils.encoding import smart_str
from django.contrib.auth.hashers import make_password


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
            op_time=datetime.datetime.now(datetime.UTC)
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
            'op_time': self.op_time
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
        request.session['op_time'] = str(datetime.datetime.now(datetime.UTC))
        try:
            SessionLog.objects.create(user.username, user_agent, remote_address, session_key)
        except Exception as e:
            logger.error('save session log error: %s', e)


class EmailUserManager(models.Manager):
    def update_emailuser(self, user_id, password, is_staff, is_active):
        try:
            user = self.get(id=user_id)
            user.password = make_password(password)
            user.is_staff = is_staff
            user.is_active = is_active
        except EmailUser.DoesNotExist:
            logger.warn('%s email user does not exists' % user_id)
            return None

        user.save(using=self._db)
        return user

    def add_emailuser(self, username, password, is_staff, is_active):
        ctime = int(time.time_ns() / 1000)
        password = make_password(password)
        model = super(EmailUserManager, self).create(email=username, password=password,
                                                     is_staff=is_staff, is_active=is_active, ctime=ctime)
        # self.model.passwd = make_password(self.password)
        model.save()
        return model

    def get_user_by_email(self, email):
        try:
            return super(EmailUserManager, self).get(email=email)
        except EmailUser.DoesNotExist:
            return None

    def get_user_by_id(self, user_id):
        try:
            return super(EmailUserManager, self).get(id=user_id)
        except EmailUser.DoesNotExist:
            return None

    def remove_emailuser(self, email):
        self.model.objects.filter(email=email).delete()

    def get_superusers(self):
        return self.filter(is_staff=True)

    def get_emailuser(self, username):
        try:
            return super(EmailUserManager, self).get(email=username)
        except EmailUser.DoesNotExist:
            return None



class EmailUser(models.Model):
    email = models.CharField(max_length=255, unique=True)
    password = models.CharField(max_length=256)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)
    ctime = models.BigIntegerField()
    reference_id = models.CharField(max_length=255, default=None)

    objects = EmailUserManager()

    class Meta:
        db_table = 'email_user'
        app_label = 'base'

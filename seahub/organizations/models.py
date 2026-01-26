# Copyright (c) 2012-2016 Seafile Ltd.
import os
import uuid
import time
import logging
from copy import deepcopy
from django.db import models
from django.db import connection
from django.utils.safestring import mark_safe

from seahub.profile.settings import ROLE_CACHE_PREFIX
from seahub.utils import normalize_cache_key
from .settings import ORG_MEMBER_QUOTA_DEFAULT
from seahub.api2.utils import to_python_boolean
from seahub.constants import ORG_DEFAULT
from seahub.role_permissions.utils import get_available_roles, get_enabled_role_permissions_by_role
from django.core.cache import cache
from seahub.group.models import Group, GroupUser

logger = logging.getLogger(__name__)


class OrgMemberQuotaManager(models.Manager):
    def get_quota(self, org_id):
        try:
            return self.get(org_id=org_id).quota
        except self.model.DoesNotExist:
            return ORG_MEMBER_QUOTA_DEFAULT

    def set_quota(self, org_id, quota):
        try:
            q = self.get(org_id=org_id)
            q.quota = quota
        except self.model.DoesNotExist:
            q = self.model(org_id=org_id, quota=quota)
        q.save(using=self._db)
        return q


class OrgMemberQuota(models.Model):
    org_id = models.IntegerField(db_index=True)
    quota = models.IntegerField()

    objects = OrgMemberQuotaManager()


class OrgSettingsManager(models.Manager):
    def get_by_orgs(self, orgs):
        org_ids = [x.org_id for x in orgs]
        return self.filter(org_id__in=org_ids)

    def cache_delete(self, org, role):
        role_cache_key = normalize_cache_key(str(org.org_id), ROLE_CACHE_PREFIX)
        role_cached = cache.get(role_cache_key, None)
        if role_cached and role != role_cached:
            cache.delete(role_cache_key)

    def get_role_by_org(self, org):
        org_id = org.org_id
        try:
            role = self.get(org_id=org_id).role
        except OrgSettings.DoesNotExist:
            return ORG_DEFAULT
        else:
            if not role:
                return ORG_DEFAULT

            if role in get_available_roles():
                return role
            else:
                logger.warning('Role %s is not valid' % role)
                return ORG_DEFAULT

    def get_role_by_org_id(self, org_id):
        try:
            role = self.get(org_id=org_id).role
        except OrgSettings.DoesNotExist:
            return ORG_DEFAULT
        else:
            if not role:
                return ORG_DEFAULT

            if role in get_available_roles():
                return role
            else:
                logger.warning('Role %s is not valid' % role)
                return ORG_DEFAULT

    def add_or_update(self, org, role=None):
        org_id = org.org_id
        try:
            settings = self.get(org_id=org_id)
        except OrgSettings.DoesNotExist:
            settings = self.model(org_id=org_id)

        if role is not None:
            if role in get_available_roles():
                settings.role = role
                self.cache_delete(org, role)
            else:
                logger.warning('Role %s is not valid' % role)

        settings.save(using=self._db)
        return settings


class OrgSettings(models.Model):
    org_id = models.IntegerField(unique=True)
    role = models.CharField(max_length=100, null=True, blank=True)

    objects = OrgSettingsManager()


def _gen_org_logo_path(org_id, image_file):
    from seahub.avatar.settings import AVATAR_STORAGE_DIR
    (root, ext) = os.path.splitext(image_file.name.lower())
    return '%s/org-logo/%s/%s%s' % (AVATAR_STORAGE_DIR, org_id, uuid.uuid4(), ext)


def _save_org_logo_file(org_id, image_file):
    from seahub.avatar.util import get_avatar_file_storage
    org_logo_path = _gen_org_logo_path(org_id, image_file)
    storage = get_avatar_file_storage()
    storage.save(org_logo_path, image_file)
    return org_logo_path


def _delete_org_logo_file(org_logo_path):
    from seahub.avatar.util import get_avatar_file_storage
    storage = get_avatar_file_storage()
    storage.delete(org_logo_path)
    return


def _get_org_logo_url(org_logo_path):
    from seahub.avatar.util import get_avatar_file_storage
    from seahub.avatar.settings import AVATAR_FILE_STORAGE
    storage = get_avatar_file_storage()
    if AVATAR_FILE_STORAGE == 'django_oss_storage.backends.OssStorage':
        org_logo_url = storage.url(org_logo_path)
        org_logo_url = mark_safe(org_logo_url)
    elif AVATAR_FILE_STORAGE == 'django_s3_storage.storage.S3Storage':
        org_logo_url = storage.url(org_logo_path)
        org_logo_url = mark_safe(org_logo_url)
    else:
        org_logo_url = org_logo_path
    return org_logo_url


class OrgAdminSettingsManager(models.Manager):
    def get_admin_settings(self, org_id):
        settings = super(OrgAdminSettingsManager, self).filter(org_id=org_id)
        results = deepcopy(self.model.BOOLEAN_SETTINGS)
        for s in settings:
            if s.key in self.model.BOOLEAN_SETTINGS:
                results[s.key] = to_python_boolean(s.value)
        return results

    def add_or_update(self, org_id, **updates):
        for key, value in updates.items():
            try:
                # add/update key in settings of model
                if key in self.model.BOOLEAN_SETTINGS:
                    value = '1' if to_python_boolean(value) else '0'
                    super(OrgAdminSettingsManager, self).update_or_create(org_id=org_id, key=key, defaults={'value': value})
            except Exception as e:
                logger.error(e)

    def _get_setting_with_key(self, org_id, key):
        org_admin_setting = super(OrgAdminSettingsManager, self).filter(org_id=org_id, key=key).first()
        if key in self.model.BOOLEAN_SETTINGS:
            return to_python_boolean(org_admin_setting.value) if org_admin_setting else self.model.BOOLEAN_SETTINGS[key]
        else:
            return None

    def is_enable_new_user_email_by_org_id(self, org_id):
        return self._get_setting_with_key(org_id, 'enable_new_user_email')

    def is_enable_force_2fa_by_org_id(self, org_id):
        return self._get_setting_with_key(org_id, 'enable_force_2fa')

    def is_enable_memeber_modify_name_by_org_id(self, org_id):
        return self._get_setting_with_key(org_id, 'enable_member_modify_name')

    def save_org_logo(self, org_id, image_file):
        obj = self.filter(org_id=org_id, key='org_logo_path').first()
        if obj and obj.value:  # delete old file
            _delete_org_logo_file(obj.value)
        if not obj:
            obj = self.model(org_id=org_id, key='org_logo_path')
        obj.value = _save_org_logo_file(org_id, image_file)
        obj.save()
        return obj

    def get_org_logo_url(self, org_id):
        obj = self.filter(org_id=org_id, key='org_logo_path').first()
        if not obj:
            return ''
        org_logo_url = _get_org_logo_url(obj.value)
        return org_logo_url

    def delete_org_logo(self, org_id):
        obj = self.filter(org_id=org_id, key='org_logo_path').first()
        if obj:
            _delete_org_logo_file(obj.value)
            self.filter(org_id=org_id, key='org_logo_path').delete()
        return

class OrgAdminSettings(models.Model):
    # boolean settings / str settings / int settings, etc
    # key: default-value
    BOOLEAN_SETTINGS = {
        'enable_force_2fa': False,
        'enable_new_user_email': True,
        'enable_member_modify_name': True
    }

    org_id = models.IntegerField(db_index=True, null=False)
    key = models.CharField(max_length=255, null=False)
    value = models.TextField()

    objects = OrgAdminSettingsManager()

    class Meta:
        unique_together = [('org_id', 'key')]


class OrgQuotaManager(models.Manager):

    def add_or_update(self, org, monthly_api_call_limit_per_user=None):
        try:
            oq = super(OrgQuotaManager, self).get(org_id=org.org_id)
        except OrgQuota.DoesNotExist:
            oq = self.model(org_id=org.org_id)

        if monthly_api_call_limit_per_user is not None:
            oq.monthly_api_call_limit_per_user = monthly_api_call_limit_per_user

        oq.save(using=self._db)

    def get_monthly_api_call_limit_per_user(self, org_id):
        """
        return:
        number of api_call_limit per user
        """
        oq = super(OrgQuotaManager, self).filter(org_id=org_id).first()
        if oq:
            if oq.monthly_api_call_limit_per_user is not None and oq.monthly_api_call_limit_per_user > 0:
                return oq.monthly_api_call_limit_per_user

        role = ORG_DEFAULT
        os = OrgSettings.objects.filter(org_id=org_id).first()
        if os and os.role:
            role = os.role
        call_limit = get_enabled_role_permissions_by_role(role).get('monthly_api_call_limit_per_user', -1)
        return call_limit

    def get_monthly_api_call_limit(self, org_id):
        """
        return:
        api_call_limit: number of api_call_limit
        """
        oq = super(OrgQuotaManager, self).filter(org_id=org_id).first()
        max_user = OrgMemberQuota.objects.get_quota(org_id)
        if oq:
            if oq.monthly_api_call_limit_per_user is not None and oq.monthly_api_call_limit_per_user > 0:
                return oq.monthly_api_call_limit_per_user * max_user

        role = ORG_DEFAULT
        os = OrgSettings.objects.filter(org_id=org_id).first()
        if os and os.role:
            role = os.role
        api_call_limit_per_user = get_enabled_role_permissions_by_role(role).get('monthly_api_call_limit_per_user', -1)
        if api_call_limit_per_user < 0:
            return -1
        return api_call_limit_per_user * max_user

    def batch_get_monthly_api_call_limit(self, org_ids):
        """
        return:
        a dict of {org_id: number of api_call_limit}
        """
        limit_per_user_dict = {}  # {org_id: limit_per_user}
        roles_dict = {}           # {org_id: role}
        users_dict = {}           # {org_id: member_quota}
        # query limits per user
        ## query limits in db
        queryset = list(super(OrgQuotaManager, self).filter(org_id__in=org_ids))
        for item in queryset:
            if item.monthly_api_call_limit_per_user and item.monthly_api_call_limit_per_user > 0:
                limit_per_user_dict[item.org_id] = item.monthly_api_call_limit_per_user

        # query roles
        queryset = list(OrgSettings.objects.filter(org_id__in=org_ids))
        for item in queryset:
            roles_dict[item.org_id] = item.role or ORG_DEFAULT
        for org_id in org_ids:
            if org_id in roles_dict:
                continue
            roles_dict[org_id] = ORG_DEFAULT

        # query limits not in db
        for org_id in org_ids:
            if org_id in limit_per_user_dict:
                continue
            role = roles_dict[org_id]
            limit_per_user_dict[org_id] = get_enabled_role_permissions_by_role(role).get('monthly_api_call_limit_per_user', -1)

        # query user limit
        queryset = list(OrgMemberQuota.objects.filter(org_id__in=org_ids))
        for item in queryset:
            users_dict[item.org_id] = item.quota or ORG_MEMBER_QUOTA_DEFAULT
        for org_id in org_ids:
            if org_id in users_dict:
                continue
            users_dict[org_id] = ORG_MEMBER_QUOTA_DEFAULT

        results = {}
        for org_id in org_ids:
            limit_per_user = limit_per_user_dict[org_id]
            if limit_per_user < 0:
                results[org_id] = -1
                continue
            user_limit = users_dict[org_id]
            results[org_id] = limit_per_user * user_limit

        return results


class OrgQuota(models.Model):
    org_id = models.IntegerField(unique=True)
    asset_quota = models.BigIntegerField()
    big_data_row_limit = models.BigIntegerField()
    row_limit = models.IntegerField()
    big_data_storage_quota = models.BigIntegerField()
    monthly_api_call_limit_per_user = models.IntegerField()

    objects = OrgQuotaManager()

    class Meta:
        db_table = 'organizations_org_quota'


class OrgSAMLConfigManager(models.Manager):
    def get_config_by_org_id(self, org_id):
        try:
            config = self.get(org_id=org_id)
            return config
        except OrgSAMLConfig.DoesNotExist:
            return None

    def get_config_by_domain(self, domain):
        try:
            config = self.get(domain=domain)
            return config
        except OrgSAMLConfig.DoesNotExist:
            return None


class OrgSAMLConfig(models.Model):
    org_id = models.IntegerField(unique=True)
    metadata_url = models.TextField()
    domain = models.CharField(max_length=255, unique=True, null=True, blank=True)
    dns_txt = models.CharField(max_length=64, null=True, blank=True)
    domain_verified = models.BooleanField(db_index=True, default=False)
    idp_certificate = models.TextField(null=True, blank=True)

    objects = OrgSAMLConfigManager()

    class Meta:
        db_table = 'org_saml_config'

    def to_dict(self):
        return {
            'id': self.pk,
            'org_id': self.org_id,
            'metadata_url': self.metadata_url,
            'domain': self.domain,
            'dns_txt': self.dns_txt,
            'domain_verified': self.domain_verified,
            'idp_certificate': self.idp_certificate,
        }


class OrganizationManager(models.Manager):
    def get_org_by_id(self, org_id):
        try:
            organization = self.get(org_id=org_id)
            return organization
        except Organization.DoesNotExist:
            return None

    def get_orgs_by_org_ids(self, org_ids):
        orgs = self.filter(org_id__in=org_ids)
        return orgs

    def get_org_by_username(self, username):
        try:
            org_user = OrgUser.objects.get_org_user_by_username(username)
            if not org_user:
                return None
            return self.get_org_by_id(org_user.org_id)
        except Organization.DoesNotExist:
            return None

    def get_org_by_url_prefix(self, url_prefix):
        try:
            org = super(OrganizationManager, self).get(url_prefix=url_prefix)
            return org
        except Organization.DoesNotExist:
            return None

    def get_org_id_by_group(self, group_id):
        try:
            org_group = OrgGroup.objects.filter(group_id=group_id).first()
            if not org_group:
                return None
            return org_group.org_id
        except Organization.DoesNotExist:
            return None

    def create_org(self, org_name, url_prefix, creator):
        try:
            return super(OrganizationManager, self).get(url_prefix=url_prefix)
        except self.model.DoesNotExist:
            ctime = int(time.time_ns() / 1000)
            org = self.model(org_name=org_name, url_prefix=url_prefix, creator=creator, ctime=ctime)
            org.save()
            org_id = org.org_id
            is_staff = True
            OrgUser.objects.create_org_user(org_id, creator, is_staff)
            return org

    def get_org_users_by_url_prefix(self, url_prefix):
        sql = """SELECT a.org_id, b.email, b.is_staff, c.ctime, c.is_active, c.id FROM organization_organization a 
        INNER JOIN org_user b ON a.org_id=b.org_id 
        INNER JOIN email_user c ON b.email=c.email WHERE a.url_prefix=%s"""
        users = Organization.objects.raw(sql, (url_prefix, ))
        return users

    def count_active_members_by_org_id(self, org_id):
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*)
                FROM org_user ou
                JOIN email_user eu ON ou.email = eu.email
                WHERE ou.org_id = %s AND eu.is_active = 1
            """, [org_id])
            return cursor.fetchone()[0]

    def remove_org(self, org_id):
        self.filter(org_id=org_id).delete()

    def search_orgs(self, query_string):
        return self.filter(org_name__icontains=query_string)

    def get_orgs_by_user(self, username):
        org_users = OrgUser.objects.filter(email=username)
        return self.filter(org_id__in=[o.org_id for o in org_users])

    def count_orgs(self):
        return self.count()


class Organization(models.Model):
    org_id = models.AutoField(primary_key=True)
    org_name = models.CharField(max_length=255, null=True, blank=True)
    url_prefix = models.CharField(max_length=255, unique=True, null=True, blank=True)
    creator = models.CharField(max_length=255)
    ctime = models.BigIntegerField()

    objects = OrganizationManager()

    class Meta:
        db_table = 'organization_organization'

    def to_dict(self):
        return {
            'id': self.pk,
            'org_id': self.org_id,
            'org_name': self.org_name,
            'url_prefix': self.url_prefix,
            'creator': self.creator,
            'ctime': self.ctime,
        }


class OrgUserManager(models.Manager):
    def get_org_user_by_username(self, username):
        try:
            return self.get(email=username)
        except OrgUser.DoesNotExist:
            return None

    def create_org_user(self, org_id, username, is_staff=False):
        try:
            return super(OrgUserManager, self).get(org_id=org_id, email=username)
        except self.model.DoesNotExist:
            org = self.model(org_id=org_id, email=username, is_staff=is_staff)
            org.save()
            return org

    def is_org_staff(self, org_id, username):
        org_user = self.get(org_id=org_id, email=username)
        return org_user.is_staff

    def remove_org_user(self, org_id, username):
        self.model.objects.filter(org_id=org_id, email=username).delete()

    def org_user_exists(self, org_id, username):
        return self.filter(org_id=org_id, email=username).exists()

    def set_org_staff(self, org_id, username):
        return self.filter(org_id=org_id, email=username).update(is_staff=True)

    def unset_org_staff(self, org_id, username):
        return self.filter(org_id=org_id, email=username).update(is_staff=False)

    def get_org_staff_count(self, org_id):
        return self.filter(org_id=org_id).count()

    def get_org_email_users(self, org_id, start, limit):
        sql = """SELECT
                  ou.org_id,
                  ou.is_staff,
                  ou.email,
                  eu.ctime,
                  eu.id,
                  eu.is_active 
                FROM
                    org_user ou
                    JOIN email_user eu ON ou.email = eu.email 
                WHERE
                    ou.org_id = %s
                ORDER BY
                    eu.ctime DESC
                LIMIT 
                    %s OFFSET %s"""
        org_users = self.model.objects.raw(sql, (org_id, limit, start))

        return org_users

    def add_org_user(self, org_id, email, is_staff=False):
        return self.create(org_id=org_id, email=email, is_staff=is_staff)


class OrgUser(models.Model):
    org_id = models.IntegerField()
    email = models.CharField(max_length=255)
    is_staff = models.BooleanField(default=False)

    objects = OrgUserManager()

    class Meta:
        db_table = 'org_user'
        indexes = [
            models.Index(fields=['org_id', 'email'], name='org_user_org_id_email')
        ]

    def to_dict(self):
        return {
            'id': self.pk,
            'org_id': self.org_id,
            'email': self.email,
            'is_staff': self.is_staff
        }


class OrgGroupManager(models.Manager):
    def get_org_group_by_org_id(self, org_id):
        try:
            org_group = self.get(org_id=org_id)
            return org_group
        except OrgGroup.DoesNotExist:
            return None

    def get_org_group_by_group_id(self, group_id):
        try:
            org_group = self.get(group_id=group_id)
            return org_group
        except OrgGroup.DoesNotExist:
            return None

    def remove_org_groups(self, org_id):
        org_groups = self.model.objects.filter(org_id=org_id)
        for group in org_groups:
            group_id = group.group_id
            Group.objects.remove_group(group_id)
        org_groups.delete()

    def remove_org_group(self, org_id, group_id):
        self.filter(org_id=org_id, group_id=group_id).delete()
        Group.objects.remove_group(group_id)

    def create_org_group(self, org_id, group_name, username, parent_group_id=0):
        ctime = int(time.time_ns() / 1000)
        group = Group.objects.create(group_name=group_name, creator_name=username, parent_group_id=parent_group_id, timestamp=ctime)
        GroupUser.objects.create(group_id=group.group_id, user_name=username, is_staff=True)
        org_group = self.create(org_id=org_id, group_id=group.group_id)
        return group

    def get_org_groups_by_user(self, org_id, username):
        sql = """SELECT a.id, a.org_id, a.group_id, b.user_name, b.is_staff, c.group_name, c.parent_group_id, c.creator_name, c.timestamp 
        FROM org_group a 
        INNER JOIN group_user b ON a.group_id=b.group_id 
        INNER JOIN `group` c ON c.group_id=b.group_id WHERE a.org_id=%s AND b.user_name=%s"""
        org_groups = self.raw(sql, (org_id, username))
        return org_groups

    def get_org_groups(self, org_id):
        org_groups = self.filter(org_id=org_id)
        return Group.objects.filter(group_id__in=[o.group_id for o in org_groups])

class OrgGroup(models.Model):
    org_id = models.IntegerField()
    group_id = models.IntegerField()

    objects = OrgGroupManager()

    class Meta:
        db_table = 'org_group'

    def to_dict(self):
        return {
            'id': self.pk,
            'org_id': self.org_id,
            'group_id': self.group_id,
        }

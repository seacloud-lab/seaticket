# -*- coding: utf-8 -*-
import uuid
import hmac
import hashlib
import json
from copy import deepcopy
import requests

from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.db import connection
from django.db.models import Sum
from django.utils import timezone
from django.core.exceptions import ValidationError
from hashlib import sha1
import datetime
import logging
import seaserv

from django.db import models
from constance import config
from django.conf import settings
from seahub.dtable.signals import delete_dtable, move_dtable_to_trash, restore_dtable_from_trash
from seahub.dtable.constants import ORG_STORAGE_SIZE_PREFIX, ORG_STORAGE_SIZE_CACHE_TIMEOUT, \
    FOLDER_ITEM_DTABLE_GROUP_SHARE, FOLDER_ITEM_VIEW_GROUP_SHARE, FOLDER_ITEM_DTABLE, \
    ORG_BIG_DATA_TOTAL_STORAGE_PREFIX, ORG_BIG_DATA_TOTAL_STORAGE_CACHE_TIMEOUT, ORG_BIG_DATA_TOTAL_ROWS_PREFIX, \
    ORG_BIG_DATA_TOTAL_ROWS_CACHE_TIMEOUT

from seaserv import seafile_api, ccnet_api

from seahub.base.fields import LowerCaseCharField
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, RUN_CONDITION_PER_DAY, RUN_CONDITION_PER_WEEK, \
    RUN_CONDITION_PER_UPDATE, COPYRIGHT_ISSUE, VIRUS_ISSUE, ABUSE_CONTENT_ISSUE, OTHER_ISSUE, RUN_CONDITION_PER_MONTH
from seahub.signals import group_deleted
from seahub.utils import gen_token, uuid_str_to_36_chars, normalize_cache_key, get_no_duplicate_obj_name, \
    utf8_normalize, publish_count_rows, is_valid_uuid
from seahub.utils.hasher import AESPasswordHasher
from seahub.utils.timeutils import timestamp_to_isoformat_timestr, datetime_to_isoformat_timestr, utc_datetime_to_isoformat_timestr, \
    utc_to_local
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.group.utils import is_group_member, is_group_admin_or_owner
from seahub.settings import DTABLE_WEB_SERVICE_URL, NEW_DTABLE_IN_STORAGE_SERVER
from seahub.organizations.signals import org_role_updated

logger = logging.getLogger(__name__)


class WorkspacesManager(models.Manager):

    def get_workspace_by_owner(self, owner):
        try:
            return super(WorkspacesManager, self).get(owner=owner)
        except self.model.DoesNotExist:
            return None

    def get_workspace_by_id(self, workspace_id):
        try:
            return super(WorkspacesManager, self).get(pk=workspace_id)
        except self.model.DoesNotExist:
            return None

    def get_workspace_by_repo_id(self, repo_id):
        try:
            return super(WorkspacesManager, self).get(repo_id=repo_id)
        except self.model.DoesNotExist:
            return None

    def list_workspaces_by_owner(self, owner):
        return super(WorkspacesManager, self).filter(owner=owner)

    def list_workspaces_by_org_id(self, org_id):
        return super(WorkspacesManager, self).filter(org_id=org_id)

    def get_owner_total_storage(self, owner):
        workspaces = self.list_workspaces_by_owner(owner=owner)
        return sum([workspace.repo_size for workspace in workspaces])

    def get_org_total_storage(self, org_id):
        cache_key = normalize_cache_key(str(org_id), ORG_STORAGE_SIZE_PREFIX)
        cache_total_storage = cache.get(cache_key)
        if cache_total_storage:
            return int(cache_total_storage)
        workspaces = self.list_workspaces_by_org_id(org_id=org_id)
        total_storage = sum([workspace.repo_size for workspace in workspaces])
        cache.set(cache_key, total_storage, ORG_STORAGE_SIZE_CACHE_TIMEOUT)
        return total_storage

    def create_workspace(self, owner, repo_id, org_id):
        try:
            return super(WorkspacesManager, self).get(owner=owner, repo_id=repo_id)
        except self.model.DoesNotExist:
            workspace = self.model(owner=owner, repo_id=repo_id, org_id=org_id)
            workspace.save()
            return workspace

    def delete_workspace(self, workspace_id):
        try:
            workspace = super(WorkspacesManager, self).get(pk=workspace_id)
            # delete dtable related tables
            # then delete workspace related dtables
            dtables = DTables.objects.filter(workspace=workspace)
            for dtable in dtables:
                delete_dtable.send(sender=None, dtable_uuid=dtable.uuid.hex)
            folders = Folders.objects.filter(workspace_id=int(workspace_id))
            FolderItems.objects.filter(folder_id__in=[f.id for f in folders]).delete()
            folders.delete()
            workspace.delete()
            return True
        except self.model.DoesNotExist:
            return False

    def delete_workspaces_by_org_id(self, org_id):
        workspaces = self.list_workspaces_by_org_id(org_id)
        for workspace in workspaces:
            self.delete_workspace(workspace.id)

    def get_deleted_workspaces_by_expire_seconds(self, expire_seconds):
        return super(WorkspacesManager, self).filter(
            deleted=True, delete_time__lt=(datetime.datetime.now()-datetime.timedelta(seconds=expire_seconds)))


class Workspaces(models.Model):
    name = models.CharField(max_length=255, null=True)
    owner = models.CharField(max_length=255, unique=True)
    repo_id = models.CharField(max_length=36, unique=True)
    org_id = models.IntegerField(default=-1, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    delete_time = models.DateTimeField(null=True)

    objects = WorkspacesManager()

    class Meta:
        db_table = 'workspaces'

    @property
    def updated_at(self):
        assert len(self.repo_id) == 36

        repo = seafile_api.get_repo(self.repo_id)
        if not repo:
            return ''

        return timestamp_to_isoformat_timestr(repo.last_modify)

    @property
    def repo_size(self):
        try:
            repo = seafile_api.get_repo(self.repo_id)
            return repo.size if repo else 0
        except Exception as e:
            raise e

    def to_dict(self):
        return {
            'id': self.pk,
            'repo_id': self.repo_id,
        }

    def get_group_id(self):
        if '@seafile_group' in self.owner:
            return int(self.owner.split('@')[0])
        return None


class DTablesManager(models.Manager):

    def get_dtable_by_workspace(self, workspace):
        try:
            dtables = super(DTablesManager, self).filter(workspace=workspace)
            dtable_list = list()
            for dtable in dtables:
                dtable_dict = dict()
                dtable_dict['id'] = dtable.pk
                dtable_dict['workspace_id'] = dtable.workspace_id
                dtable_dict['uuid'] = str(dtable.uuid)
                dtable_dict['name'] = dtable.name
                dtable_dict['creator'] = email2nickname(dtable.creator)
                dtable_dict['modifier'] = email2nickname(dtable.modifier)
                dtable_dict['created_at'] = datetime_to_isoformat_timestr(dtable.created_at)
                dtable_dict['updated_at'] = datetime_to_isoformat_timestr(dtable.updated_at)
                dtable_list.append(dtable_dict)
            return dtable_list
        except self.model.DoesNotExist:
            return None

    def create_dtable(self, username, workspace, name, color=None, text_color=None, icon=None, password=None):
            name = utf8_normalize(name)
            dtable = self.model(workspace=workspace, name=name,
                                creator=username, modifier=username,
                                color=color, text_color=text_color, icon=icon, password=password,
                                in_storage=NEW_DTABLE_IN_STORAGE_SERVER)
            dtable.save()
            return dtable

    def get_dtable(self, workspace, name, deleted=False):
        try:
            return super(DTablesManager, self).get(workspace=workspace, name=name, deleted=deleted)
        except self.model.DoesNotExist:
            return None

    def get_dtable_by_uuid(self, dtable_uuid, include_deleted=True):
        try:
            if not include_deleted:
                return super(DTablesManager, self).get(uuid=dtable_uuid, deleted=False)
            return super(DTablesManager, self).get(uuid=dtable_uuid)
        except self.model.DoesNotExist:
            return None
        except ValidationError:  # uuid maybe invalid
            return None

    def get_dtable_by_query_str(self, query_str, include_deleted = True):

        try:
            if is_valid_uuid(query_str):
                query_result = self.filter(uuid=query_str)
            else:
                query_result = self.filter(name__icontains=query_str)
        except self.model.DoesNotExist:
            return None

        if not include_deleted:
            query_result = query_result.filter(deleted=False)
        return query_result

    def search_dtable_in_org(self, org_id, query_str, start, end):
        workspace_ids = Workspaces.objects.filter(org_id=org_id).values('id')
        if is_valid_uuid(query_str):
            return super(DTablesManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, uuid=query_str).order_by('id')[start:end]
        else:
            return super(DTablesManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, name__icontains=query_str).order_by('id')[start:end]

    def delete_dtable(self, workspace, name):
        try:
            dtable = super(DTablesManager, self).get(workspace=workspace, name=name)
            delete_dtable.send(sender=None, dtable_uuid=dtable.uuid.hex)
            dtable.delete()
            return True
        except self.model.DoesNotExist:
            return False

    def get_trash_dtables_by_expire_seconds(self, expire_seconds=None):
        if not expire_seconds:
            return super(DTablesManager, self).filter(deleted=True).select_related('workspace')
        else:
            return super(DTablesManager, self).filter(deleted=True,
                                                      delete_time__lt=(datetime.datetime.now()-datetime.timedelta(seconds=expire_seconds)),
                                                      ).select_related('workspace')

    def get_non_duplicated_name(self, name, workspace_id):
        dtables = super(DTablesManager, self).filter(deleted=False, name__startswith=name, workspace_id=workspace_id)
        existed_names = [d.name for d in dtables]
        if not existed_names or name not in existed_names:
            return name
        return get_no_duplicate_obj_name(name, existed_names)

    def get_personal_dtables_by_username(self, username):
        user_workspace = Workspaces.objects.get_workspace_by_owner(username)
        try:
            return super(DTablesManager, self).filter(workspace=user_workspace, deleted=False)
        except self.model.DoesNotExist:
            return None


class DTables(models.Model):
    workspace = models.ForeignKey(Workspaces, on_delete=models.CASCADE, db_index=True)
    uuid = models.UUIDField(unique=True, default=uuid.uuid4)
    name = models.CharField(max_length=255)
    creator = models.CharField(max_length=255)
    modifier = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now_add=True, db_index=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    delete_time = models.DateTimeField(null=True)
    color = models.CharField(max_length=50, null=True)
    text_color = models.CharField(max_length=50, null=True)
    icon = models.CharField(max_length=50, null=True)
    password = models.CharField(max_length=255, null=True)
    in_storage = models.BooleanField(default=False, null=False)

    objects = DTablesManager()

    class Meta:
        unique_together = (('workspace', 'name'),)
        db_table = 'dtables'

    def to_dict(self, include_deleted=False):
        result = {
            'id': self.pk,
            'workspace_id': self.workspace_id,
            'uuid': str(self.uuid),
            'name': self.dtable_name,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'updated_at': datetime_to_isoformat_timestr(self.updated_at),
            'color': self.color,
            'text_color': self.text_color,
            'icon': self.icon,
            'is_encrypted': self.is_encrypted(),
            'in_storage': self.in_storage,
        }
        if include_deleted:
            result.update({
                'deleted': self.deleted,
                'delete_time': datetime_to_isoformat_timestr(self.delete_time) if self.delete_time else '',
            })
        return result

    @property
    def is_owned_by_group(self):
        return '@seafile_group' in self.workspace.owner

    @property
    def dtable_name(self):
        if self.deleted:
            return self.name[self.name.find(' ')+1:]
        else:
            return self.name

    def get_owner_group_id(self):
        if self.is_owned_by_group:
            group_id = self.workspace.owner.split('@')[0]
            try:
                group_id = int(group_id)
            except:
                pass
            return group_id
        return -1


    def is_encrypted(self):
        return self.password is not None

class DTableSharePermissionManager(models.Manager):

    def list_by_dtable(self, dtable_uuid):
        return self.filter(dtable_uuid=dtable_uuid)

    def get_by_id_and_dtable(self, pk, dtable_uuid):
        return self.filter(id=pk, dtable_uuid=dtable_uuid).first()


class DTableSharePermission(models.Model):
    """ Share permission for tables and views in a dtable.
    """

    dtable_uuid = models.CharField(max_length=36, db_index=True)
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=500)
    permission = models.TextField()

    objects = DTableSharePermissionManager()

    class Meta:
        db_table = 'dtable_share_permission'

    def to_dict(self):
        return {
            'id': self.pk,
            'name': self.name,
            'description': self.description,
        }

    def get_raw_permission_detail(self):
        return json.loads(self.permission)

    def set_raw_permission(self, raw_permission):
        self.permission = json.dumps(raw_permission)


class DTableShareManager(models.Manager):

    def list_by_dtable(self, dtable):
        return self.filter(dtable=dtable)

    def list_by_to_user(self, to_user):
        return self.filter(to_user=to_user, dtable__deleted=False).select_related('dtable')

    def get_by_dtable_and_to_user(self, dtable, to_user):
        qs = self.filter(dtable=dtable, to_user=to_user)
        if qs.exists():
            return qs[0]
        return None

    def get_count_by_dtable(self, dtable):
        return self.filter(dtable=dtable).count()

    def add(self, dtable, from_user, to_user, permission):
        obj = self.model(
            dtable=dtable, from_user=from_user, to_user=to_user, permission=permission)
        obj.save()
        return obj


class UserShareFoldersManager(models.Manager):
    def get_non_duplicated_name(self, name, username):
        folders = super(UserShareFoldersManager, self).filter(username=username, name__startswith=name)
        existed_names = [f.name for f in folders]
        if not existed_names or name not in existed_names:
            return name
        return get_no_duplicate_obj_name(name, existed_names)

class UserShareFolders(models.Model):
    name = models.CharField(max_length=255, null=False)
    username = models.CharField(max_length=255, null=False)
    objects = UserShareFoldersManager()

    class Meta:
        db_table = 'user_share_folders'
        unique_together = [('username', 'name')]

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'username': self.username
        }

class DTableShare(models.Model):
    """Model used to dtable share

     from_user, to_user: user email or group_id@seafile_group
    """
    id = models.BigAutoField(primary_key=True)
    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE)
    from_user = models.CharField(max_length=255, db_index=True)
    to_user = models.CharField(max_length=255, db_index=True)
    permission = models.CharField(max_length=15)
    share_folder = models.ForeignKey(UserShareFolders, on_delete=models.SET_NULL, null=True, related_name='dtable_user_shares')

    objects = DTableShareManager()

    class Meta:
        unique_together = (('dtable', 'to_user'),)
        db_table = 'dtable_share'


class DTableGroupShare(models.Model):
    """
    Model used to dtable-group-share
    dtable group_id permission created_by created_at
    """
    id = models.BigAutoField(primary_key=True)
    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE)
    group_id = models.IntegerField(db_index=True)
    permission = models.CharField(max_length=15)
    created_by = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        unique_together = (('dtable', 'group_id'),)
        db_table = 'dtable_group_share'


class DTableViewUserShare(models.Model):
    """Model used to dtable user view share

    """
    id = models.BigAutoField(primary_key=True)
    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE)
    from_user = models.CharField(max_length=255, db_index=True)
    to_user = models.CharField(max_length=255, db_index=True)
    permission = models.CharField(max_length=15)
    table_id = models.CharField(max_length=36, db_index=True)
    view_id = models.CharField(max_length=36, db_index=True)
    shared_name = models.CharField(max_length=255, null=True)
    share_folder = models.ForeignKey(UserShareFolders, on_delete=models.SET_NULL, null=True, related_name='view_user_shares')


    objects = DTableShareManager()

    class Meta:
        unique_together = (('dtable', 'to_user', 'table_id', 'view_id'),)
        db_table = 'dtable_view_user_share'

    def to_dict(self):
        result = {
            'id': self.id,
            'dtable_name': self.dtable.name,
            'from_user': self.from_user,
            'to_user': self.to_user,
            'permission': self.permission,
            'table_id': self.table_id,
            'view_id': self.view_id,
            'shared_name': self.shared_name,
        }
        return result

class DTableViewGroupShareManager(models.Manager):
    def get_count_by_dtable(self, dtable):
        return self.filter(dtable=dtable).count()

class DTableViewGroupShare(models.Model):
    """Model used to dtable group view share

    """
    id = models.BigAutoField(primary_key=True)
    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE)
    from_user = models.CharField(max_length=255, db_index=True)
    to_group_id = models.IntegerField(db_index=True)
    permission = models.CharField(max_length=15)
    table_id = models.CharField(max_length=36, db_index=True)
    view_id = models.CharField(max_length=36, db_index=True)
    shared_name = models.CharField(max_length=255, null=True)


    objects = DTableViewGroupShareManager()

    class Meta:
        unique_together = (('dtable', 'to_group_id', 'table_id', 'view_id'),)
        db_table = 'dtable_view_group_share'

    def to_dict(self):
        result = {
            'id': self.id,
            'dtable_name': self.dtable.name,
            'from_user': self.from_user,
            'to_group_id': self.to_group_id,
            'permission': self.permission,
            'table_id': self.table_id,
            'view_id': self.view_id,
            'shared_name': self.shared_name
        }
        return result


class DTableAPITokenManager(models.Manager):

    def get_by_token(self, token):
        qs = self.filter(token=token)
        if qs.exists():
            return qs[0]
        return None

    def get_by_dtable_and_app_name(self, dtable, app_name):
        qs = self.filter(dtable=dtable, app_name=app_name)
        if qs.exists():
            return qs[0]
        return None

    def list_by_dtable(self, dtable):
        return self.filter(dtable=dtable)

    def generate_key(self):
        unique = str(uuid.uuid4())
        return hmac.new(unique.encode('utf-8'), digestmod=sha1).hexdigest()

    def add(self, dtable, app_name, email, permission):

        obj = self.model(
            dtable=dtable,
            app_name=app_name,
            generated_by=email,
            permission=permission,
        )
        obj.token = self.generate_key()
        obj.save()
        return obj


class DTableAPIToken(models.Model):
    """dtable api token for thirdpart apps to get dtable-server access token
    """
    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE)
    app_name = models.CharField(max_length=255, db_index=True)
    token = models.CharField(unique=True, max_length=40)
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.CharField(max_length=255)
    last_access = models.DateTimeField(auto_now=True)
    permission = models.CharField(max_length=15)

    objects = DTableAPITokenManager()

    class Meta:
        unique_together = (('dtable', 'app_name'),)
        db_table = 'dtable_api_token'

    def update_last_access(self):
        self.last_access = datetime.datetime.now
        self.save(update_fields=['last_access'])


class DTableShareLinksManager(models.Manager):

    def create_link(self, dtable_id, username,
                    password=None, expire_date=None, permission='r'):
        if password:
            password = make_password(password)
        token = gen_token(max_length=config.SHARE_LINK_TOKEN_LENGTH)
        sdl = super(DTableShareLinksManager, self).create(dtable_id=dtable_id, username=username,
                                                          token=token,
                                                          permission=permission,
                                                          expire_date=expire_date, password=password)
        return sdl


class DTableShareLinks(models.Model):

    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE, db_index=True, db_column='dtable_id')
    username = LowerCaseCharField(max_length=255, db_index=True)
    token = models.CharField(max_length=100, unique=True)
    ctime = models.DateTimeField(default=datetime.datetime.now)
    password = models.CharField(max_length=128, null=True)
    expire_date = models.DateTimeField(null=True)
    permission = models.CharField(max_length=50, db_index=True,
                                  default=PERMISSION_READ)

    objects = DTableShareLinksManager()

    class Meta:
        db_table = 'dtable_share_links'

    def is_owner(self, username):
        return self.username == username

    def is_expired(self):
        if not self.expire_date:
            return False
        else:
            return self.expire_date < timezone.now()

    def is_encrypted(self):
        return False if not self.password else True


class DTableFormsManager(models.Manager):

    def add_form_obj(self, username, workspace_id, dtable_uuid, form_config):
        token = uuid.uuid4()
        form_obj = self.model(
            username=username,
            workspace_id=workspace_id,
            dtable_uuid=dtable_uuid,
            form_config=form_config,
            token=token
        )
        form_obj.save()
        return form_obj

    def get_form_by_form_config(self, dtable_uuid, form_config):
        form_objs = self.filter(dtable_uuid=dtable_uuid, form_config=form_config)
        if len(form_objs) > 0:
            form_obj = form_objs[0]
            return form_obj
        else:
            return None

    def get_forms_by_dtable_uuid(self, dtable_uuid):
        forms = self.filter(dtable_uuid=dtable_uuid)
        return forms

    def get_form_by_token(self, token):
        try:
            return self.get(token=token)
        except self.model.DoesNotExist:
            return None

    def delete_form(self, token):
        try:
            form_obj = self.get(token=token)
            form_obj.delete()
            return True
        except self.model.DoesNotExist:
            return False


class DTableForms(models.Model):

    SHARE_TYPE_CHOICES = (
        ('anonymous', 'Anonymous'),
        ('login_users', 'Login_Users'),
        ('shared_groups', 'Shared_Groups'),
    )

    username = models.CharField(max_length=255, db_index=True)
    workspace_id = models.IntegerField(db_index=True)
    dtable_uuid = models.CharField(max_length=36, db_index=True)
    form_id = models.CharField(max_length=36)
    form_config = models.TextField(null=True)
    token = models.CharField(max_length=36, unique=True)
    share_type = models.CharField(max_length=20, choices=SHARE_TYPE_CHOICES, default='anonymous')
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    submit_count = models.IntegerField(default=0)

    objects = DTableFormsManager()

    class Meta:
        # unique_together = (('dtable_uuid', 'token'),)
        db_table = 'dtable_forms'

    def to_dict(self):
        form_link = "%s/dtable/forms/%s/" % (DTABLE_WEB_SERVICE_URL.rstrip('/'), self.token)
        return {
            'id': self.pk,
            'username': self.username,
            'workspace_id': self.workspace_id,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'form_config': self.form_config,
            'token': self.token,
            'form_link': form_link,
            'share_type': self.share_type,
            'created_at': datetime_to_isoformat_timestr(self.created_at) if self.created_at else None,
            'submit_count': self.submit_count
        }


class DTableFormCustomURLs(models.Model):
    form_token = models.CharField(max_length=36)
    custom_url = models.CharField(max_length=100, null=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'dtable_form_custom_urls'


    def to_dict(self):
        form_link = "%s/dtable/forms/custom/%s/" % (DTABLE_WEB_SERVICE_URL.rstrip('/'), self.custom_url)
        return {
            'id': self.pk,
            'form_token': self.form_token,
            'custom_url': self.custom_url,
            'created_at': datetime_to_isoformat_timestr(self.created_at) if self.created_at else None,
            'form_link': form_link,
        }


class DTableCollectionTablesManager(models.Manager):
    def add_collection_table(self, username, workspace_id, dtable_uuid, collection_config):
        token = uuid.uuid4()
        collection_table = self.model(
            username=username,
            workspace_id=workspace_id,
            dtable_uuid=dtable_uuid,
            config=collection_config,
            token=token
        )
        collection_table.save()
        return collection_table

    def get_collection_table_by_token(self, token):
        try:
            return self.get(token=token)
        except self.model.DoesNotExist:
            return None

    def get_collection_tables_by_dtable_uuid(self, dtable_uuid):
        collection_tables = self.filter(dtable_uuid=dtable_uuid)
        return collection_tables

    def get_collection_table_by_config(self, dtable_uuid, collection_config):
        collection_tables = self.filter(dtable_uuid=dtable_uuid, config=collection_config)
        if len(collection_tables) > 0:
            collection_table = collection_tables[0]
            return collection_table
        else:
            return None

    def delete_collection_table(self, token):
        try:
            collection_table = self.get(token=token)
            collection_table.delete()
            return True
        except self.model.DoesNotExist:
            return False


class DTableCollectionTables(models.Model):

    username = models.CharField(max_length=255, db_index=True)
    workspace_id = models.IntegerField(db_index=True)
    dtable_uuid = models.CharField(max_length=36, db_index=True)
    config = models.TextField(null=True)
    token = models.CharField(max_length=36, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    view_count = models.IntegerField(default=0)
    objects = DTableCollectionTablesManager()

    class Meta:
        db_table = 'dtable_collection_tables'

    def to_dict(self):
        collection_link = "%s/dtable/collection-tables/%s/" % (DTABLE_WEB_SERVICE_URL.rstrip('/'), self.token)
        return {
            'id': self.pk,
            'username': self.username,
            'workspace_id': self.workspace_id,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'config': self.config,
            'token': self.token,
            'collection_link': collection_link,
            'view_count': self.view_count,
            'created_at': datetime_to_isoformat_timestr(self.created_at) if self.created_at else None
        }


class DTableFormShareManager(models.Manager):

    def share_by_group_id(self, form, group_id):
        obj = self.model(form=form, group_id=group_id)
        obj.save()
        return obj

    def list_by_form(self, form):
        return [obj.group_id for obj in self.filter(form=form)]

    def list_by_group_ids(self, group_ids):
        return self.filter(group_id__in=group_ids).order_by('group_id').select_related('form')

class DTableFormShare(models.Model):

    form =models.ForeignKey(DTableForms, on_delete=models.CASCADE, db_column='form_id')
    group_id = models.IntegerField(db_index=True)

    objects = DTableFormShareManager()

    class Meta:
        unique_together = (('form', 'group_id'),)
        db_table = 'dtable_form_share'


class DTableRowSharesManager(models.Manager):

    def add_dtable_row_share(self, username, workspace_id, dtable_uuid, table_id, row_id):
        token = uuid.uuid4()
        row_share_obj = self.model(
            username=username,
            workspace_id=workspace_id,
            dtable_uuid=dtable_uuid,
            table_id=table_id,
            row_id=row_id,
            token=token
        )
        row_share_obj.save()
        row_share = row_share_obj.to_dict()
        row_share["row_share_link"] = "%s/dtable/row-share-links/%s" % \
                                      (settings.DTABLE_WEB_SERVICE_URL.rstrip('/'), token)
        return row_share

    def get_dtable_row_share(self, username, workspace_id, dtable_uuid, table_id, row_id):
        row_shares = super(DTableRowSharesManager, self).filter(
            username=username,
            workspace_id=workspace_id,
            dtable_uuid=dtable_uuid,
            table_id=table_id,
            row_id=row_id
        )
        if len(row_shares) > 0:
            row_share_obj = row_shares[0]
            row_share = row_share_obj.to_dict()
            row_share["row_share_link"] = "%s/dtable/row-share-links/%s" % \
                                          (settings.DTABLE_WEB_SERVICE_URL.rstrip('/'), row_share_obj.token)
            return row_share
        else:
            return None

    def get_dtable_row_share_by_token(self, token):
        try:
            return super(DTableRowSharesManager, self).get(token=token)
        except self.model.DoesNotExist:
            return None

    def delete_dtable_row_share(self, token):
        try:
            row_share = super(DTableRowSharesManager, self).get(token=token)
            row_share.delete()
            return True
        except self.model.DoesNotExist:
            return False


class DTableRowShares(models.Model):

    username = models.CharField(max_length=255, db_index=True)
    workspace_id = models.IntegerField(db_index=True)
    dtable_uuid = models.CharField(max_length=36, db_index=True)
    table_id = models.CharField(max_length=36)
    row_id = models.CharField(max_length=36, db_index=True)
    token = models.CharField(max_length=100, unique=True)

    objects = DTableRowSharesManager()

    class Meta:
        db_table = 'dtable_row_shares'

    def to_dict(self):

        return {
            'id': self.pk,
            'username': self.username,
            'workspace_id': self.workspace_id,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'table_id': self.table_id,
            'row_id': self.row_id,
            'token': self.token,
        }


class DTableSnapshotManager(models.Manager):

    def list_by_dtable_uuid(self, dtable_uuid, snapshot_days=None):
        filters = {
            'dtable_uuid': dtable_uuid
        }
        if snapshot_days:
            start_timestamp = (datetime.datetime.now() - datetime.timedelta(days=snapshot_days)).timestamp() * 1000
            filters['ctime__gte'] = start_timestamp
        return self.filter(**filters).order_by('-ctime')

    def get_by_commit_id(self, commit_id, dtable_uuid):
        querysets = self.filter(dtable_uuid=dtable_uuid, commit_id=commit_id)
        if querysets.exists():
            return querysets[0]
        return None


class DTableSnapshot(models.Model):

    id = models.BigAutoField(primary_key=True)
    dtable_uuid = models.CharField(max_length=36, db_index=True)
    dtable_name = models.CharField(max_length=255)  # for seafile_api.get_file_id_by_commit_and_path
    commit_id = models.CharField(max_length=40)
    ctime = models.BigIntegerField()

    objects = DTableSnapshotManager()

    class Meta:
        db_table = 'dtable_snapshot'
        unique_together = (('dtable_uuid', 'commit_id'),)

    def is_allowed_view_by_days(self, snapshot_days):
        start_timestamp = (datetime.datetime.now() - datetime.timedelta(days=snapshot_days)).timestamp() * 1000
        return self.ctime >= start_timestamp


class PageDesignSnapshotManager(models.Manager):
    def add_snapshot(self, page_id, dtable_uuid, commit_id, ctime):
        snapshot_obj = self.model(
            page_id=page_id,
            dtable_uuid=dtable_uuid,
            commit_id=commit_id,
            ctime=ctime,
        )
        snapshot_obj.save()
        return snapshot_obj

    def list_by_page_id(self, page_id):
        return self.filter(page_id=page_id).order_by('-ctime')

    def get_by_commit_id(self, page_id, commit_id):
        query_set = self.filter(page_id=page_id, commit_id=commit_id)
        if query_set.exists():
            return query_set[0]
        return None


class PageDesignSnapshot(models.Model):
    id = models.BigAutoField(primary_key=True)
    page_id = models.CharField(max_length=36, db_index=True)
    dtable_uuid = models.CharField(max_length=36)
    commit_id = models.CharField(max_length=40)
    ctime = models.BigIntegerField()

    objects = PageDesignSnapshotManager()

    class Meta:
        db_table = 'page_design_snapshot'
        unique_together = (('page_id', 'commit_id'),)

    def to_dict(self):
        return {
            'id': self.pk,
            'page_id': self.page_id,
            'dtable_uuid': self.dtable_uuid,
            'commit_id': self.commit_id,
            'ctime': self.ctime,
        }


class DTableExternalAppsManager(models.Manager):
    def get_external_apps_by_dtable_uuid(self, dtable_uuid):
        external_apps = self.filter(dtable_uuid=dtable_uuid)
        return external_apps

    def get_external_app_by_uuid(self, app_uuid):
        try:
            return self.get(app_uuid=app_uuid)
        except self.model.DoesNotExist:
            return None

    def get_external_app(self, dtable_uuid, app_type, app_config=None):
        queryset = self.filter(
            dtable_uuid=dtable_uuid, app_type=app_type, app_config=app_config)
        if queryset.exists():
            return queryset[0]
        return None

    def delete_external_app_by_id(self, external_app_id):
        try:
            external_app = self.get(id=external_app_id)
            external_app.delete()
            return True
        except self.model.DoesNotExist:
            return False

    def add_external_app(self, dtable_uuid, app_type, creator, org_id=None, app_config=None):
        token = uuid.uuid4()
        external_app = self.model(
            app_uuid=token,
            dtable_uuid=dtable_uuid,
            app_type=app_type,
            creator=creator,
            org_id=org_id,
            app_config=app_config
        )
        external_app.save()
        return external_app

class DTableExternalApps(models.Model):

    app_uuid = models.CharField(max_length=36, unique=True)
    dtable_uuid = models.CharField(max_length=36, db_index=True)
    app_type = models.CharField(max_length=255)
    app_config = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    visit_times = models.IntegerField(default=0)
    creator = models.CharField(max_length=255)
    org_id = models.IntegerField(null=True)
    custom_url = models.CharField(max_length=100, null=True, unique=True)
    inactive = models.BooleanField(default=False)
    version = models.IntegerField(default=1)

    objects = DTableExternalAppsManager()

    class Meta:
        db_table = 'dtable_external_apps'

    @property
    def app_name(self):
        return json.loads(self.app_config).get('app_name')

    def open_registration_auth(self):
        app_config_json = json.loads(self.app_config)
        authed, authed_role_id = app_config_json.get('is_open_register'), app_config_json.get('authed_role_id')
        if not authed:
            return None, None

        authed_role = self.app_roles.filter(pk=authed_role_id).first()
        return True, authed_role or None

    @property
    def can_anonymous_access(self):
        app_config_json = json.loads(self.app_config)
        can_access = app_config_json.get('can_anonymous_access', None)
        if not can_access:
            return False
        return True

    @property
    def is_anonymous_need_password(self):
        app_config_json = json.loads(self.app_config)
        is_anonymous_need_password = app_config_json.get('is_anonymous_need_password', None)
        if not is_anonymous_need_password:
            return False
        return True

    @property
    def can_anonymous_download_assets(self):
        app_config_json = json.loads(self.app_config)
        can_anonymous_download_assets = app_config_json.get('can_anonymous_download_assets', None)
        if not can_anonymous_download_assets:
            return False
        return True

    def update_version(self):
        if self.app_type == 'universal-app':
            self.version += 1
            self.save()

    @property
    def link(self):
        if self.custom_url:
            return self.custom_link
        return "%s/external-apps/%s/" % (DTABLE_WEB_SERVICE_URL.rstrip('/'), self.app_uuid)

    @property
    def edit_link(self):
        return "%s/dtable/external-apps-edit/%s/" % (DTABLE_WEB_SERVICE_URL.rstrip('/'), self.app_uuid)

    @property
    def custom_link(self):
        if not self.custom_url:
            return None
        service_url = DTABLE_WEB_SERVICE_URL.rstrip().rstrip('/')
        return '%s/apps/custom/%s/' % (service_url, self.custom_url)

    def to_dict(self):
        return {
            'id': self.pk,
            'app_uuid': self.app_uuid,
            'dtable_uuid': self.dtable_uuid,
            'app_type': self.app_type,
            'app_config': self.app_config,
            'org_id': self.org_id,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'external_app_url': self.link,
            'visit_times': self.visit_times,
            'creator': email2nickname(self.creator),
            'can_anonymous_access': self.can_anonymous_access,
            'inactive': self.inactive,
        }

    @property
    def related_base_uuids(self):
        return [uuid_str_to_36_chars(self.dtable_uuid), ]


class DTableExternalAppsOrgStatistics(models.Model):
    org_id = models.IntegerField(null=False)
    visit_date = models.DateField(db_index=True)
    visit_count = models.IntegerField(default=1)
    latest_visit_at = models.DateTimeField(default=datetime.datetime.now)

    class Meta:
        db_table = 'org_external_apps_statistics'
        unique_together = (('org_id', 'visit_date'),)

    def to_dict(self):
        return {
            'org_id': self.org_id,
            'visit_date': self.visit_date.strftime('%Y%m'),
            'visit_count': self.visit_count,
            'latest_visit_at': datetime_to_isoformat_timestr(self.latest_visit_at)
        }


class DTableExternalAppsUserStatistics(models.Model):
    username = models.CharField(max_length=255, null=False)
    visit_date = models.DateField(db_index=True)
    visit_count = models.IntegerField(default=1)
    latest_visit_at = models.DateTimeField(default=datetime.datetime.now)

    class Meta:
        db_table = 'user_external_apps_statistics'
        unique_together = (('username', 'visit_date'),)

    def to_dict(self):
        return {
            'username': self.username,
            'name': email2nickname(self.username),
            'visit_date': self.visit_date.strftime('%Y%m'),
            'visit_count': self.visit_count,
            'latest_visit_at': datetime_to_isoformat_timestr(self.latest_visit_at)
        }


class DTableSystemPlugins(models.Model):
    added_by = models.CharField(max_length=255)
    added_time = models.DateTimeField(auto_now_add=True)
    info = models.TextField(default='')
    name = models.CharField(max_length=255, db_index=True)

    class Meta:
        db_table = 'dtable_system_plugin'

    def to_dict(self):
        return {
            'id': self.pk,
            'plugin_name': self.name,
            'info': json.loads(self.info),
            'added_by': email2nickname(self.added_by),
            'added_time': datetime_to_isoformat_timestr(self.added_time),
        }


class DTablePluginsInstallCountManager(models.Manager):
    def create_plugins_install_count(self, plugin_name):
        """
        Creates and saves plugin install count.
        """

        plugins_install_count = self.model(
            plugin_name=plugin_name,
            count=1,
            updated_at=datetime.datetime.now()
        )
        plugins_install_count.save()
        return plugins_install_count


class DTablePluginsInstallCount(models.Model):
    plugin_name = models.CharField(max_length=255, null=False, unique=True)
    count = models.IntegerField(null=False)
    updated_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    objects = DTablePluginsInstallCountManager()

    def to_dict(self):
        return {
            'id': self.pk,
            'plugin_name': self.plugin_name,
            'count': self.count,
            'updated_at': datetime_to_isoformat_timestr(self.updated_at),
            'created_at': datetime_to_isoformat_timestr(self.created_at),
        }

    class Meta:
        db_table = 'dtable_plugins_install_count'


class DTableCommonDatasetManager(models.Manager):

    def get_common_datasets_by_group(self, group_id):
        """
        1. datasets that belong to the group
        2. datasets that the group can access
        """
        datasets = list(self.filter(group_id=group_id))

        group_access_datasets = DTableCommonDatasetGroupAccess.objects.filter(
            group_id=group_id).select_related('dataset')
        datasets.extend([gcd.dataset for gcd in group_access_datasets])
        return datasets


class DTableCommonDataset(models.Model):
    org_id = models.IntegerField(default=-1)
    group_id = models.IntegerField(db_index=True, default=0)
    dtable_uuid = models.UUIDField(db_index=True)
    table_id = models.CharField(max_length=36)
    view_id = models.CharField(max_length=36)
    created_at = models.DateTimeField(auto_now_add=True)
    creator = models.CharField(max_length=255, db_index=True)
    dataset_name = models.CharField(max_length=255, db_index=True)
    is_valid = models.BooleanField(default=True, null=False)

    objects = DTableCommonDatasetManager()

    def to_dict(self):
        return {
            'id': self.pk,
            'org_id': self.org_id,
            'group_id': self.group_id,
            'dtable_uuid': str(self.dtable_uuid),
            'table_id': self.table_id,
            'view_id': self.view_id,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'creator': email2nickname(self.creator),
            'dataset_name': self.dataset_name,
            'is_valid': self.is_valid
        }

    class Meta:
        db_table = 'dtable_common_dataset'
        unique_together = (('org_id', 'dtable_uuid', 'table_id', 'view_id'),
                           ('org_id', 'dataset_name'))

    def can_access_by_user_through_group(self, username):
        """
        user can access this dataset when
        1. user can access dataset's original dtable's owner group, or
        2. user can access dataset's related groups

        user can access a group, means user is member of that group
        """

        # 1. check user can access dataset's original dtable's owner group
        # -> 1. get original dtable which generate current dataset
        # -> 2. get group id which is owner of 1's dtable
        # -> 3. check wether user is member of 2's group
        group_id = self.group_id
        if group_id != -1 and is_group_member(group_id, username):
            return True

        # 2. check user can access dataset's related groups
        # -> 1. get groups id related to current dataset
        # -> 2. for each group id in 1's list, check wether user is member
        related_groups_id = DTableCommonDatasetGroupAccess.objects.get_related_groups_id(dataset=self)
        for group_id in related_groups_id:
            if is_group_member(group_id, username):
                return True

        return False

    def can_access_by_dtable(self, from_dtable=None):
        """
        from_dtable can access this dataset when
        1. from_dtable and this dataset's orignal dtable is owned by same group
        2. from_dtable is owned by target dataset's related group

        """

        # check case 1
        if self.group_id == from_dtable.get_owner_group_id() != -1:
            return True

        # check case 2
        related_groups_id = DTableCommonDatasetGroupAccess.objects.get_related_groups_id(dataset=self)
        return from_dtable.get_owner_group_id() in related_groups_id

    def can_access_by_workspace(self, from_workspace):
        """
        from_workspace can access this dataset when
        1. from_workspace and this dataset's orignal dtable is owned by same group
        2. from_workspace is owned by target dataset's related group

        """

        # check case 1
        if self.group_id == from_workspace.get_group_id():
            return True

        # check case 2
        related_groups_id = DTableCommonDatasetGroupAccess.objects.get_related_groups_id(dataset=self)
        return from_workspace.get_group_id() in related_groups_id

    def can_manage_by_user(self, username, dtable=None):
        """
            user can manage dataset, when
            1. user can manage dataset's original dtable
        """
        return is_group_admin_or_owner(self.group_id, username)


class DTableCommonDatasetGroupAccessManager(models.Manager):

    def get_related_groups_id(self, dataset):
        relation_list = DTableCommonDatasetGroupAccess.objects.filter(dataset=dataset)
        return [relation.group_id for relation in relation_list]


class DTableCommonDatasetGroupAccess(models.Model):
    dataset = models.ForeignKey(DTableCommonDataset, on_delete=models.CASCADE, db_index=True)
    group_id = models.IntegerField(db_index=True)

    objects = DTableCommonDatasetGroupAccessManager()

    class Meta:
        db_table = 'dtable_common_dataset_group_access'


class DTableCommonDatasetSync(models.Model):
    dataset = models.ForeignKey(DTableCommonDataset, on_delete=models.CASCADE, db_index=True)
    dst_dtable_uuid = models.UUIDField(db_index=True)
    dst_table_id = models.CharField(max_length=36, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    creator = models.CharField(max_length=255, db_index=True)
    last_sync_time = models.DateTimeField(db_index=True)
    src_version = models.IntegerField(null=False)
    is_sync_periodically = models.BooleanField(default=False, null=False)
    is_valid = models.BooleanField(default=True, null=False)
    sync_interval = models.CharField(max_length=20, default='per_day')

    class Meta:
        unique_together = (('dst_dtable_uuid', 'dst_table_id'),)
        index_together=(('is_sync_periodically', 'last_sync_time'),)
        db_table = 'dtable_common_dataset_sync'

    def to_dict(self, detail=False):
        data = {
            'id': self.pk,
            'dataset_id': self.dataset.id,
            'dst_dtable_uuid': self.dst_dtable_uuid,
            'dst_table_id': self.dst_table_id,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'creator': self.creator,
            'last_sync_time': datetime_to_isoformat_timestr(self.last_sync_time),
            'src_version': self.src_version,
            'is_sync_periodically': self.is_sync_periodically,
            'is_valid': self.is_valid,
            'sync_interval': self.sync_interval,
        }
        if detail:
            data['dataset_name'] = self.dataset.dataset_name
        return data


class DTableExternalLinksManager(models.Manager):

    def get_dtable_external_link(self, dtable):
        return super(DTableExternalLinksManager, self).filter(dtable=dtable).order_by('-create_at')

    def create_dtable_external_link(self, dtable, username, permission=PERMISSION_READ, token=None, password=None, expire_date=None):
        is_custom = True if token else False
        token = gen_token(max_length=config.SHARE_LINK_TOKEN_LENGTH) if not token else token
        if password:
            password = make_password(password)
        return super(DTableExternalLinksManager, self).create(dtable=dtable,
                                                              token=token,
                                                              creator=username,
                                                              create_at=datetime.datetime.now(),
                                                              permission=permission,
                                                              is_custom=is_custom,
                                                              password=password,
                                                              expire_date=expire_date)

    def check_token_existed(self, token):
        return super(DTableExternalLinksManager, self).filter(token=token).exists()

    def get_dtable_external_links_by_org_id(self, org_id):
        return super(DTableExternalLinksManager, self).filter(
            dtable__deleted=False, dtable__workspace__org_id=org_id
        )

    def get_dtable_external_link_by_org_and_token(self, org_id, token):
        return super(DTableExternalLinksManager, self).filter(
            token = token,
            dtable__deleted=False,
            dtable__workspace__org_id=org_id
        ).select_related('dtable').first()

    def get_count_by_dtable(self, dtable):
        return self.filter(dtable=dtable).count()


class DTableExternalLinks(models.Model):

    PERMISSION_CHOICES = [
        (PERMISSION_READ, 'read only'),
        (PERMISSION_READ_WRITE, 'read and write')
    ]

    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE, db_index=True, db_column='dtable_id')
    creator = models.CharField(max_length=255, null=False)
    token = models.CharField(max_length=100, unique=True)
    permission = models.CharField(max_length=50, null=False, default=PERMISSION_READ, choices=PERMISSION_CHOICES)
    view_cnt = models.IntegerField(default=0)
    create_at = models.DateTimeField()
    is_custom = models.BooleanField(default=False, null=False)
    password = models.CharField(max_length=128, null=True)
    expire_date = models.DateTimeField(null=True)

    objects = DTableExternalLinksManager()

    class Meta:
        db_table = 'dtable_external_link'

    def gen_dtable_external_link(self, token, is_custom=False):
        service_url = DTABLE_WEB_SERVICE_URL.rstrip().rstrip('/')
        if not is_custom:
            link = '%s/dtable/external-links/%s/' % (service_url, token)
        else:
            link = '%s/dtable/external-links/custom/%s/' % (service_url, token)
        return link


    def to_dict(self):
        return {
            'id': self.pk,
            'from_dtable': self.dtable.name,
            'creator': self.creator,
            'creator_name': email2nickname(self.creator),
            'token': self.token,
            'permission': self.permission,
            'create_at': datetime_to_isoformat_timestr(self.create_at),
            'expire_date': datetime_to_isoformat_timestr(self.expire_date),
            'view_cnt': self.view_cnt,
            'url': self.gen_dtable_external_link(self.token, self.is_custom)
        }

    def is_expired(self):
        if self.expire_date is not None and timezone.now() > self.expire_date:
            return True
        else:
            return False

    def is_encrypted(self):
        return self.password is not None

class DTableViewExternalLinksManager(models.Manager):

    def create(self, dtable, creator, table_id, view_id, permission=PERMISSION_READ, token=None, password=None, expire_date=None):
        is_custom = True if token else False
        if password:
            password = make_password(password)
        token = gen_token(max_length=config.SHARE_LINK_TOKEN_LENGTH) if not token else token

        return super(DTableViewExternalLinksManager, self).create(
            dtable=dtable,
            creator=creator,
            table_id=table_id,
            view_id=view_id,
            token=token,
            permission=permission,
            create_at=datetime.datetime.now(),
            is_custom=is_custom,
            password=password,
            expire_date=expire_date,
        )

    def get_view_external_links_by_org_id(self, org_id):
        return super(DTableViewExternalLinksManager, self).filter(
            dtable__deleted=False, dtable__workspace__org_id=org_id
        )

    def get_view_external_link_by_org_and_token(self, org_id, token):
        return super(DTableViewExternalLinksManager, self).filter(
            token = token,
            dtable__deleted=False,
            dtable__workspace__org_id=org_id
        ).select_related('dtable').first()


class DTableViewExternalLinks(models.Model):

    PERMISSION_CHOICES = [
        (PERMISSION_READ, 'read only'),
        (PERMISSION_READ_WRITE, 'read and write')
    ]

    dtable = models.ForeignKey(DTables, on_delete=models.CASCADE, db_index=True, db_column='dtable_id')
    creator = models.CharField(max_length=255, null=False)
    table_id = models.CharField(max_length=36)
    view_id = models.CharField(max_length=36)
    token = models.CharField(max_length=100, unique=True)
    permission = models.CharField(max_length=50, null=False, default=PERMISSION_READ, choices=PERMISSION_CHOICES)
    view_cnt = models.IntegerField(default=0)
    create_at = models.DateTimeField()
    is_custom = models.BooleanField(default=False, null=False)
    password = models.CharField(max_length=128, null=True)
    expire_date = models.DateTimeField(null=True)

    objects = DTableViewExternalLinksManager()

    class Meta:
        db_table = 'dtable_view_external_link'

    def is_expired(self):
        if self.expire_date is not None and timezone.now() > self.expire_date:
            return True
        else:
            return False

    def is_encrypted(self):
        return self.password is not None

    def gen_dtable_external_link(self, token, is_custom=False):
        service_url = DTABLE_WEB_SERVICE_URL.rstrip().rstrip('/')
        if not is_custom:
            link = '%s/dtable/view-external-links/%s/' % (service_url, token)
        else:
            link = '%s/dtable/view-external-links/custom/%s/' % (service_url, token)
        return link

    def to_dict(self):
        return {
            'id': self.pk,
            'from_dtable': self.dtable.name,
            'creator': self.creator,
            'creator_name': email2nickname(self.creator),
            'token': self.token,
            'permission': self.permission,
            'create_at': datetime_to_isoformat_timestr(self.create_at),
            'view_cnt': self.view_cnt,
            'table_id': self.table_id,
            'view_id': self.view_id,
            'url': self.gen_dtable_external_link(self.token, self.is_custom),
            'is_custom': self.is_custom,
            'expire_date': datetime_to_isoformat_timestr(self.expire_date)
        }


class DTableAbuseReport(models.Model):

    ABUSE_TYPE_CHOICES = (
        (COPYRIGHT_ISSUE, 'copyright'),
        (VIRUS_ISSUE, 'virus'),
        (ABUSE_CONTENT_ISSUE, 'abuse_content'),
        (OTHER_ISSUE, 'other'),
    )

    reporter = models.CharField(max_length=255, null=False)
    dtable_uuid = models.CharField(max_length=36, db_index=True)
    external_link_token = models.CharField(max_length=100, db_index=True)
    create_time = models.DateTimeField()
    abuse_type = models.CharField(max_length=255, choices=ABUSE_TYPE_CHOICES)
    description = models.TextField(blank=True, null=True)
    handled = models.BooleanField(default=False, null=False, db_index=True)

    class Meta:
        db_table = 'dtable_abuse_report'

    def to_dict(self):
        is_anonymous = False if seaserv.get_emailuser_with_import(self.reporter) else True
        return {
            'id': self.pk,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'reporter': self.reporter if is_anonymous else email2nickname(self.reporter),
            'external_link_token': self.external_link_token,
            'create_time': datetime_to_isoformat_timestr(self.create_time),
            'abuse_type': self.abuse_type,
            'description': self.description,
            'handled': self.handled,
        }


class UserStarredDTablesManager(models.Manager):

    def get_dtable_uuids_by_email(self, email):
        usds = super(UserStarredDTablesManager, self).filter(email=email)
        return [usd.dtable_uuid for usd in usds]


class UserStarredDTables(models.Model):
    id = models.BigAutoField(primary_key=True)
    email = models.EmailField(db_index=True)
    dtable_uuid = models.CharField(max_length=36, db_index=True)

    objects = UserStarredDTablesManager()

    class Meta:
        db_table = 'user_starred_dtables'
        unique_together = (('email', 'dtable_uuid'),)


class DTableNotifications(models.Model):
    username = models.CharField(max_length=255)
    dtable_uuid = models.CharField(max_length=32, db_index=True)
    msg_type = models.CharField(max_length=40)
    created_at = models.DateTimeField(db_index=True)
    detail = models.TextField()
    seen = models.BooleanField(default=False)

    class Meta:
        db_table = 'dtable_notifications'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'msg_type': self.msg_type,
            'created_at': datetime_to_isoformat_timestr(utc_to_local(self.created_at)),
            'detail': json.loads(self.detail),
            'seen': 1 if self.seen else 0
        }


class DTableNotificationRules(models.Model):

    RUN_CONDITION_CHOICES = [
        (RUN_CONDITION_PER_DAY,  'per_day'),
        (RUN_CONDITION_PER_WEEK, 'per_week'),
        (RUN_CONDITION_PER_MONTH, 'per_month'),
        (RUN_CONDITION_PER_UPDATE, 'per_update')
    ]


    dtable_uuid = models.CharField(max_length=36, db_index=True)
    run_condition = models.CharField(max_length=32, null=False, default=RUN_CONDITION_PER_UPDATE, choices=RUN_CONDITION_CHOICES)
    trigger = models.TextField()
    action = models.TextField()
    creator = models.CharField(max_length=255, null=False)
    ctime = models.DateTimeField()
    last_trigger_time = models.DateTimeField(null=True)
    is_valid = models.BooleanField(default=True)


    class Meta:
        db_table = 'dtable_notification_rules'

    def to_dict(self):
        return {
            'id': self.pk,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'run_condition': self.run_condition,
            'trigger': json.loads(self.trigger),
            'action': json.loads(self.action),
            'creator': email2nickname(self.creator),
            'ctime': utc_datetime_to_isoformat_timestr(self.ctime),
            'last_trigger_time': utc_datetime_to_isoformat_timestr(self.last_trigger_time),
            'is_valid': 1 if self.is_valid else 0
        }

class DTableAutomationRulesManager(models.Manager):

    def get_rule_by_id(self, rule_id):
        try:
            return self.get(id = rule_id)
        except self.model.DoesNotExist:
            return None


class DTableAutomationRules(models.Model):
    RUN_CONDITION_CHOICES = [
        (RUN_CONDITION_PER_DAY,  'per_day'),
        (RUN_CONDITION_PER_WEEK, 'per_week'),
        (RUN_CONDITION_PER_MONTH, 'per_month'),
        (RUN_CONDITION_PER_UPDATE, 'per_update')
    ]

    dtable_uuid = models.CharField(max_length=36, db_index=True)
    run_condition = models.CharField(max_length=32, null=False, default=RUN_CONDITION_PER_UPDATE, choices=RUN_CONDITION_CHOICES)
    trigger = models.TextField()
    actions = models.TextField()
    creator = models.CharField(max_length=255, null=False)
    ctime = models.DateTimeField()
    last_trigger_time = models.DateTimeField(null=True)
    is_valid = models.BooleanField(default=True)
    trigger_count = models.IntegerField(default=0)
    org_id = models.IntegerField(null=True)
    objects = DTableAutomationRulesManager()
    is_pause = models.BooleanField(default=False)

    class Meta:
        db_table = 'dtable_automation_rules'

    def can_run(self):
        if not self.is_valid:
            return False
        if self.is_pause:
            return False
        return True

    def to_dict(self):
        return {
            'id': self.pk,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'run_condition': self.run_condition,
            'trigger': json.loads(self.trigger),
            'actions': json.loads(self.actions),
            'creator': email2nickname(self.creator),
            'ctime': utc_datetime_to_isoformat_timestr(self.ctime),
            'last_trigger_time': utc_datetime_to_isoformat_timestr(self.last_trigger_time),
            'is_valid': self.is_valid,
            'trigger_count': self.trigger_count,
            'is_pause': self.is_pause
        }

class DTableAutomationRulesOrgStatistics(models.Model):
    org_id = models.IntegerField(null=False)
    trigger_date = models.DateField()
    trigger_count = models.IntegerField()
    update_at = models.DateTimeField()

    class Meta:
        db_table = 'org_auto_rules_statistics'

    def to_dict(self):
        org = ccnet_api.get_org_by_id(self.org_id)
        return {
            'org_id': self.org_id,
            'org_name': org.org_name,
            'trigger_date': self.trigger_date.strftime('%Y%m'),
            'trigger_count': self.trigger_count,
            'update_at': utc_datetime_to_isoformat_timestr(self.update_at)
        }


class DTableAutomationRulesUserStatistics(models.Model):
    username = models.CharField(max_length=255, null=False)
    trigger_date = models.DateField()
    trigger_count = models.IntegerField()
    update_at = models.DateTimeField()

    class Meta:
        db_table = 'user_auto_rules_statistics'

    def to_dict(self):
        return {
            'username': self.username,
            'name': email2nickname(self.username),
            'trigger_date': self.trigger_date.strftime('%Y%m'),
            'trigger_count': self.trigger_count,
            'update_at': utc_datetime_to_isoformat_timestr(self.update_at)
        }

class DTableAutomationRulesTaskLog(models.Model):
    rule_id = models.IntegerField(null=False)
    trigger_time = models.DateTimeField()
    run_condition = models.CharField(max_length=255, null=False)
    success = models.BooleanField(default=True)
    org_id = models.IntegerField(null=False)
    dtable_uuid = models.CharField(max_length=36)
    owner = models.CharField(max_length=255)
    warnings = models.TextField()

    class Meta:
        db_table = 'auto_rules_task_log'

    def to_dict(self):
        return {
            'id': self.pk,
            'rule_id': self.rule_id,
            'trigger_time':utc_datetime_to_isoformat_timestr(self.trigger_time),
            'run_condition': self.run_condition,
            'success': self.success,
            'warnings': self.warnings
        }



class DTableOpenedBysManager(models.Manager):

    def is_first_open_by_user(self, dtable_uuid, username):
        return not super(DTableOpenedBysManager, self).filter(dtable_uuid=dtable_uuid, opened_by_user=username).exists()


class DTableOpenedBys(models.Model):
    dtable_uuid = models.CharField(max_length=36)
    opened_by_user = models.CharField(max_length=255)

    objects = DTableOpenedBysManager()

    class Meta:
        db_table = 'dtable_opened_bys'
        indexes = [
            models.Index(fields=['dtable_uuid', 'opened_by_user'])
        ]

class DTableRowsCount(models.Model):
    id = models.BigAutoField(primary_key=True)
    dtable_uuid = models.CharField(max_length=32, null=False, unique=True)
    rows_count = models.IntegerField(default=0)
    rows_count_update_at = models.DateTimeField()
    owner = models.CharField(max_length=255, null=True)
    org_id = models.IntegerField(null=True)

    class Meta:
        db_table = 'dtable_rows_count'


class UserRowsCountManager(models.Manager):

    def get_user_rows_count(self, username):
        urc = super(UserRowsCountManager, self).filter(username=username).first()
        return urc.rows_count if urc else 0


class UserRowsCount(models.Model):
    id = models.BigAutoField(primary_key=True)
    username = models.CharField(max_length=255, null=False, unique=True)
    rows_count = models.IntegerField(default=0)
    rows_count_update_at = models.DateTimeField()

    objects = UserRowsCountManager()

    class Meta:
        db_table = 'user_rows_count'


class OrgRowsCountManager(models.Manager):

    def get_org_rows_count(self, org_id):
        orc = super(OrgRowsCountManager, self).filter(org_id=org_id).first()
        return orc.rows_count if orc else 0


class OrgRowsCount(models.Model):
    id = models.BigAutoField(primary_key=True)
    org_id = models.IntegerField(null=False, unique=True)
    rows_count = models.IntegerField(default=0)
    rows_count_update_at = models.DateTimeField()

    objects = OrgRowsCountManager()

    class Meta:
        db_table = 'org_rows_count'


class Webhooks(models.Model):
    dtable_uuid = models.CharField(max_length=32, db_index=True, null=False)
    url = models.CharField(max_length=2000, null=False)
    settings = models.TextField()
    creator = models.CharField(max_length=255, null=False)
    created_at = models.DateTimeField(auto_now_add=True)
    is_valid = models.BooleanField(default=True)

    class Meta:
        db_table = 'webhooks'

    @property
    def hook_settings(self):
        if not self.settings:
            return None
        try:
            return json.loads(self.settings)
        except:
            pass
        return None

    def to_dict(self):
        result = {
            'id': self.pk,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'url': self.url,
            'creator': self.creator,
            'created_at': self.created_at,
            'is_valid': self.is_valid
        }
        try:
            if self.settings:
                result['settings'] = json.loads(self.settings)
        except:
            pass
        return result


class WebhookJobs(models.Model):
    webhook_id = models.IntegerField(db_index=True, null=False)
    created_at = models.DateTimeField(auto_now_add=True)
    trigger_at = models.DateTimeField()
    status = models.IntegerField(db_index=True, null=False)
    url = models.CharField(max_length=2000, null=False)
    request_headers = models.TextField()
    request_body = models.TextField()
    response_status = models.IntegerField()
    response_body = models.TextField()

    class Meta:
        db_table = 'webhook_jobs'

class IdInOrgTupleManager(models.Manager):
    def add_or_update(self, virtual_id, id_in_org, org_id):
        id_in_org_tuple_query = self.filter(virtual_id=virtual_id)

        if id_in_org == '':
            id_in_org_tuple_query.delete()
            return None

        if id_in_org_tuple_query.exists():
            id_in_org_tuple = id_in_org_tuple_query.first()
            id_in_org_tuple.id_in_org = id_in_org
            id_in_org_tuple.save()
        else:
            id_in_org_tuple = self.create(virtual_id=virtual_id, id_in_org=id_in_org, org_id=org_id)

        return id_in_org_tuple

    def gen_virtual_id2id_in_org_dict(self, virtual_id_list):
        id_in_org_tuples = list(self.filter(virtual_id__in=virtual_id_list))
        email2id_in_org = {}
        for id_tuple in id_in_org_tuples:
            email2id_in_org[id_tuple.virtual_id] = id_tuple.id_in_org
        return email2id_in_org


class IdInOrgTuple(models.Model):
    virtual_id = models.CharField(max_length=255, db_index=True)
    id_in_org = models.CharField(max_length=255, db_index=True)
    org_id = models.IntegerField(db_index=True)
    objects = IdInOrgTupleManager()

    class Meta:
        db_table = 'id_in_org_tuple'

ACCOUNT_TYPE_EMAIL = 'email'
ACCOUNT_TYPE_WECHAT_ROBOT = 'wechat_robot'
ACCOUNT_TYPE_IMAGE_RECOGNITION = 'image_recognition'
ACCOUNT_TYPE_DINGTALK = 'dingtalk_robot'
ACCOUNT_TYPE_SEAFILE = 'seafile'
NOTIFICATION = 'notification'

class BoundThirdPartyAccoutsManager(models.Manager):

    def get_accounts_by_dtable(self, dtable_uuid):
        return self.filter(dtable_uuid=dtable_uuid)

    def get_accounts_by_dtable_and_name(self, dtable_uuid, name):
        try:
            return self.get(dtable_uuid=dtable_uuid, account_name=name)
        except self.model.DoesNotExist:
            return None

    def get_accounts_by_id(self, account_id):
        try:
            return self.get(id = account_id)
        except self.model.DoesNotExist:
            return None

    def get_accounts_by_dtable_and_type(self, dtable_uuid, account_type):
        return self.filter(dtable_uuid=dtable_uuid, account_type=account_type)

ENCRYPT_KEYS = ['password', 'webhook_url', 'api_key', 'secret_key', 'repo_api_token', 'client_secret']
def _encrypt_detail(detail):
    detail_clone = deepcopy(detail)
    cryptor = AESPasswordHasher()
    try:
        encrypted_details = {
            key: cryptor.encode(detail_clone[key])
            for key in ENCRYPT_KEYS if key in detail_clone and detail_clone[key]
        }
        detail_clone.update(encrypted_details)
        return json.dumps(detail_clone)
    except Exception as e:
        logger.error(e)
        return None

def _decrypt_detail(detail):
    detail_clone = deepcopy(detail)
    cryptor = AESPasswordHasher()
    try:
        decrypted_details = {
            key: cryptor.decode(detail_clone[key])
            for key in ENCRYPT_KEYS if key in detail_clone and detail_clone[key]
        }
        detail_clone.update(decrypted_details)
        return detail_clone
    except Exception as e:
        logger.error(e)
        return None


class BoundThirdPartyAccounts(models.Model):
    '''
    Currently the third party account is designed for the message sending in base by
    scripts, the type includes 'email', 'wechat_robot', etc.
    The detail contains the json-like info such as
    {'password': 1111(encrypted), 'username':'xxx@xx.com, 'server':'smtp@126.xxxx'....}
    for email type and
    {'webhook_url':'https://xxxx'(encrypted), ...} for wechat_robot type

    Each base can add multiple third party accounts but should be distinguished by
    account_name.
    '''
    dtable_uuid = models.CharField(max_length=36)
    account_name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=255)
    detail = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    objects = BoundThirdPartyAccoutsManager()

    class Meta:
        db_table = 'bound_third_party_accounts'
        unique_together = (('dtable_uuid', 'account_name'),)


    def to_dict(self, drop_passwd_or_key=False):
        detail_dict = _decrypt_detail(json.loads(self.detail))
        if drop_passwd_or_key:
            if self.account_type == 'email':
                detail_dict.pop('password', None)
                detail_dict.pop('client_secret', None)
            elif self.account_type == 'seafile':
                detail_dict.pop('repo_api_token', None)
        res = {
            'id': self.id,
            'account_name': self.account_name,
            'account_type': self.account_type,
            'detail': detail_dict
        }

        return res


class FoldersManager(models.Manager):
    def get_non_duplicated_name(self, name, workspace_id):
        folders = super(FoldersManager, self).filter(workspace_id=workspace_id, name__startswith=name)
        existed_names = [f.name for f in folders]
        if not existed_names or name not in existed_names:
            return name
        return get_no_duplicate_obj_name(name, existed_names)


class Folders(models.Model):
    name = models.CharField(max_length=255, null=False)
    workspace_id = models.IntegerField(db_index=True, null=False)

    objects = FoldersManager()

    class Meta:
        db_table = 'folders'
        unique_together = [('name', 'workspace_id')]

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'workspace_id': self.workspace_id
        }


class FolderItems(models.Model):
    ITEM_TYPE_CHOICES = (
        (FOLDER_ITEM_DTABLE_GROUP_SHARE, 'DTable_Group_Share'),
        (FOLDER_ITEM_VIEW_GROUP_SHARE, 'View_Group_Share'),
        (FOLDER_ITEM_DTABLE, 'DTable'),
    )

    folder_id = models.IntegerField(null=False)
    item_type = models.CharField(max_length=50, null=False, choices=ITEM_TYPE_CHOICES)
    item_id = models.CharField(max_length=36, null=False)

    class Meta:
        db_table = 'folder_items'
        index_together = [('item_type', 'item_id')]
        unique_together = [('folder_id', 'item_type', 'item_id')]

    def to_dict(self):
        item_id = self.item_id if self.item_type != FOLDER_ITEM_DTABLE else uuid_str_to_36_chars(self.item_id)
        return {
            'folder_id': self.folder_id,
            'item_type': self.item_type,
            'item_id' : item_id
        }

def get_common_user_info(username):
    avatar_url, _, _ = api_avatar_url(username)
    return {
        'email': username,
        'name': email2nickname(username),
        'avatar_url': avatar_url

    }

COMMENT_FROM_BASE = 'base'
COMMENT_FROM_UNIVERSAL_APP = 'universal_app'

class DTableRowComments(models.Model):
    author = models.CharField(max_length=255)
    comment = models.TextField()
    created_at = models.DateTimeField(db_index=True)
    updated_at = models.DateTimeField()
    dtable_uuid = models.CharField(max_length=32, db_index=True)
    row_id = models.CharField(max_length=36, db_index=True)
    detail = models.TextField(null=True)
    resolved = models.BooleanField(default=False)
    comment_from = models.CharField(max_length=20, default=COMMENT_FROM_BASE, db_index=True)

    class Meta:
        db_table = 'dtable_row_comments'

    @property
    def notes(self):
        user_info = get_common_user_info(self.author)
        return {
            'id': self.pk,
            'author': self.author,
            'author_name': user_info.get('name'),
            'author_avatar_url': user_info.get('avatar_url'),
            'comment': self.comment,
            'row_id': self.row_id,
            'dtable_uuid': self.dtable_uuid,
            'created_at': datetime_to_isoformat_timestr(utc_to_local(self.created_at)),
        }

    def to_dict(self):
        return {
            'id': self.pk,
            'author': self.author,
            'comment': self.comment,
            'created_at': datetime_to_isoformat_timestr(utc_to_local(self.created_at)),
            'updated_at': datetime_to_isoformat_timestr(utc_to_local(self.updated_at)),
            'dtable_uuid': self.dtable_uuid,
            'row_id': self.row_id,
            'detail': self.detail,
            'resolved': self.resolved
        }

class DTableRowActivities(models.Model):

    dtable_uuid = models.CharField(max_length=32, db_index=True)
    row_id = models.CharField(max_length=36, db_index=True)
    row_count = models.IntegerField()
    op_user = models.CharField(max_length=100)
    op_type = models.CharField(max_length=100)
    op_time = models.DateTimeField(db_index=True)
    op_app = models.CharField(max_length=100)
    detail = models.TextField(null=True)

    class Meta:
        db_table = 'activities'
        ordering = ['-op_time']

    def to_dict(self):
        return {
            'id': self.pk,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'row_count': self.row_count,
            'op_time': datetime_to_isoformat_timestr(utc_to_local(self.op_time)),
            'row_id': self.row_id,
            'detail': json.loads(self.detail),
            'op_user': self.op_user,
            'op_app': self.op_app,
            'op_type': self.op_type
        }


class DTableOperationLogs(models.Model):
    dtable_uuid = models.CharField(max_length=32, db_index=True)
    op_id = models.BigIntegerField()
    op_time = models.BigIntegerField(db_index=True)
    author = models.CharField(max_length=255)
    app = models.CharField(max_length=255)
    operation = models.TextField(null=True)

    class Meta:
        db_table = 'operation_log'
        ordering = ["-op_id"]

    def to_dict(self):
        return {
            'id': self.pk,
            'dtable_uuid': uuid_str_to_36_chars(self.dtable_uuid),
            'op_id': self.op_id,
            'op_time': self.op_time,
            'operation': self.operation,
            'author': self.author,
            'app': self.app,
        }


class DeleteOperationLog(models.Model):
    dtable_uuid = models.CharField(max_length=32, db_index=True)
    op_id = models.BigIntegerField()
    op_type = models.CharField(max_length=255)
    op_time = models.BigIntegerField(db_index=True)
    operation = models.TextField()
    author = models.CharField(max_length=255)
    app = models.CharField(max_length=255)

    class Meta:
        db_table = 'delete_operation_log'
        unique_together = (('dtable_uuid', 'op_time'), )
        ordering = ['-op_time', ]

    def to_dict(self):
        return {
            'id': self.pk,
            'dtable_uuid': self.dtable_uuid,
            'op_type': self.op_type,
            'op_id': self.op_id,
            'op_time': timestamp_to_isoformat_timestr(self.op_time, divided_by=1000),
            'operation': json.loads(self.operation),
            'author': self.author,
            'app': self.app
        }


class OrgBigDataStorageStatsManager(models.Manager):

    def get_org_big_data_total_rows(self, org_id):
        cache_key = normalize_cache_key(str(org_id), ORG_BIG_DATA_TOTAL_ROWS_PREFIX)
        org_big_data_total_rows = cache.get(cache_key)
        if org_big_data_total_rows:
            return int(org_big_data_total_rows)

        org_big_data_total_rows = 0
        try:
            org_big_data_total_rows = self.get(org_id=org_id).total_rows
        except self.model.DoesNotExist:
            return org_big_data_total_rows
        cache.set(cache_key, org_big_data_total_rows, ORG_BIG_DATA_TOTAL_ROWS_CACHE_TIMEOUT)
        return int(org_big_data_total_rows)

    def get_org_big_data_total_storage(self, org_id):
        cache_key = normalize_cache_key(str(org_id), ORG_BIG_DATA_TOTAL_STORAGE_PREFIX)
        org_big_data_total_storage = cache.get(cache_key)
        if org_big_data_total_storage:
            return int(org_big_data_total_storage)

        org_big_data_total_storage = 0
        try:
            org_big_data_total_storage = self.get(org_id=org_id).total_storage
        except self.model.DoesNotExist:
            return org_big_data_total_storage
        cache.set(cache_key, org_big_data_total_storage, ORG_BIG_DATA_TOTAL_STORAGE_CACHE_TIMEOUT)
        return int(org_big_data_total_storage)


class OrgBigDataStorageStats(models.Model):
    id = models.BigAutoField(primary_key=True)
    org_id = models.IntegerField(unique=True)
    total_rows = models.BigIntegerField()
    total_storage = models.BigIntegerField()

    objects = OrgBigDataStorageStatsManager()

    class Meta:
        db_table = 'org_big_data_storage_stats'

    def to_dict(self):
        return {
            'id': self.pk,
            'org_id': self.org_id,
            'total_rows': self.total_rows,
            'total_storage': self.total_storage
        }


class BigDataStorageStats(models.Model):
    id = models.BigAutoField(primary_key=True)
    dtable_uuid = models.CharField(max_length=36, unique=True)
    org_id = models.IntegerField(default=-1, db_index=True)
    total_rows = models.BigIntegerField()
    total_storage = models.BigIntegerField()

    class Meta:
        db_table = 'big_data_storage_stats'


class DTableGroupOrdersManager(models.Manager):


    def get_group_order_by_username(self, username):
        try:
            return self.get(username = username)
        except self.model.DoesNotExist:
            return None

class DTableGroupOrders(models.Model):
    username = models.CharField(max_length=255, null=False, unique=True)
    detail = models.TextField()

    objects = DTableGroupOrdersManager()


    class Meta:
        db_table = 'dtable_group_orders'

    @property
    def group_ids(self):
        return self.detail and json.loads(self.detail).get('group_ids', []) or []


    def save_group_ids(self, group_ids):
        self.detail = json.dumps({"group_ids": group_ids})
        self.save()

    def flush(self, group_ids):
        ordered_group_ids = self.group_ids
        if sorted(ordered_group_ids) == sorted(group_ids):
            return ordered_group_ids
        group_id_list = []
        for group_id in ordered_group_ids:
            if group_id in group_ids:
                group_id_list.append(group_id)
        for group_id in group_ids:
            if group_id not in ordered_group_ids:
                group_id_list.append(group_id)

        self.save_group_ids(group_id_list)
        return group_id_list

    def move(self, group_id, anchor_group_id=None, append_to_last=False):
        '''
        move group_id ahead of anchor_group_id
        ex:
        group_ids = [2, 3, 4, 5, 6]

        self.move(5, 3)

        return: [2, 5, 3, 4, 6]
        '''
        group_ids = self.group_ids
        try:
            group_ids.pop(group_ids.index(group_id))
            if append_to_last:
                group_ids.append(group_id)
            else:
                group_ids.insert(group_ids.index(anchor_group_id), group_id)
        except:
            error = True
            return None, error

        self.save_group_ids(group_ids)
        return group_ids, None


class DtableDataSyncsManager(models.Manager):
    def get_data_sync_by_uuid(self, dtable_uuid):
        data_syncs = self.filter(dtable_uuid=dtable_uuid)
        return data_syncs

    def add_data_sync(self, dtable_uuid, detail, sync_type):
        data_sync = self.model(
            dtable_uuid=dtable_uuid,
            detail=detail,
            sync_type=sync_type,
            created_at=datetime.datetime.utcnow()
        )
        data_sync.save()
        return data_sync


class DtableDataSyncs(models.Model):
    id = models.BigAutoField(primary_key=True)
    dtable_uuid = models.CharField(max_length=32, db_index=True, null=False)
    detail = models.TextField()
    sync_type = models.CharField(max_length=20)
    created_at = models.DateTimeField()
    is_valid = models.BooleanField(default=True, null=False)
    last_sync_time = models.DateTimeField()
    consecutive_errors_times = models.IntegerField(default=0)
    error_type = models.CharField(max_length=255)

    objects = DtableDataSyncsManager()

    class Meta:
        db_table = 'dtable_data_syncs'

    def to_dict(self):
        return {
            'id': self.pk,
            'dtable_uuid': self.dtable_uuid,
            'detail': self.detail,
            'sync_type': self.sync_type,
            'created_at': datetime_to_isoformat_timestr(utc_to_local(self.created_at)),
            'is_valid': self.is_valid,
            'last_sync_time': datetime_to_isoformat_timestr(self.last_sync_time),
            'consecutive_errors_times': self.consecutive_errors_times,
            'error_type': self.error_type,
        }


class CustomAssetUUIDManager(models.Manager):

    def get_by_uuid(self, asset_uuid):
        return self.filter(uuid=asset_uuid).first()

    def get_by_path(self, dtable_uuid, parent_path, file_name):
        dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, parent_path)
        return self.filter(
            dtable_uuid_parent_path_md5=dtable_uuid_parent_path_md5, file_name=file_name).first()

    def batch_get_by_path(self, dtable_uuid, parent_path, file_names):
        dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, parent_path)
        return self.filter(
            dtable_uuid_parent_path_md5=dtable_uuid_parent_path_md5, file_name__in=file_names)

    def get_or_create_by_path(self, dtable_uuid, parent_path, file_name, uuid=None):
        asset = self.get_by_path(dtable_uuid, parent_path, file_name)
        if not asset:
            dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, parent_path)
            create_dict = dict(
                dtable_uuid=dtable_uuid,
                parent_path=parent_path,
                dtable_uuid_parent_path_md5=dtable_uuid_parent_path_md5,
                file_name=file_name
            )
            if uuid:
                create_dict['uuid'] = uuid
            asset = self.create(**create_dict)
        return asset

    def list_by_path(self, dtable_uuid, parent_path):
        dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, parent_path)
        return self.filter(
            dtable_uuid_parent_path_md5=dtable_uuid_parent_path_md5)

    def rename_by_path(self, dtable_uuid, parent_path, file_name, new_file_name):
        asset = self.get_by_path(dtable_uuid, parent_path, file_name)
        if not asset:
            return None
        asset.file_name = new_file_name
        asset.save(update_fields=['file_name'])
        return asset

    def move_by_path(self, dtable_uuid, parent_path, new_parent_path, file_name):
        asset = self.get_by_path(dtable_uuid, parent_path, file_name)
        if not asset:
            return None
        new_dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, new_parent_path)
        asset.parent_path = new_parent_path
        asset.dtable_uuid_parent_path_md5 = new_dtable_uuid_parent_path_md5
        asset.save()
        return asset

    def copy_by_path(self, dtable_uuid, parent_path, new_parent_path, file_name):
        asset = self.get_by_path(dtable_uuid, parent_path, file_name)
        if not asset:
            return None
        new_dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, new_parent_path)
        return self.create(
            dtable_uuid=uuid_str_to_36_chars(dtable_uuid),
            parent_path=new_parent_path,
            dtable_uuid_parent_path_md5=new_dtable_uuid_parent_path_md5,
            file_name=file_name
        )

    def batch_move_by_dtable_uuid_parent_path(self, dtable_uuid, parent_path, new_parent_path):
        dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, parent_path)
        new_dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, new_parent_path)
        return self.filter(dtable_uuid_parent_path_md5=dtable_uuid_parent_path_md5).update(
            parent_path=new_parent_path, dtable_uuid_parent_path_md5=new_dtable_uuid_parent_path_md5)

    def batch_copy_by_dtable_uuid_parent_path(self, dtable_uuid, parent_path, new_parent_path):
        dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, parent_path)
        new_dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, new_parent_path)
        new_items = []
        for item in self.filter(dtable_uuid_parent_path_md5=dtable_uuid_parent_path_md5):
            new_items.append(self.model(
                dtable_uuid=uuid_str_to_36_chars(dtable_uuid),
                parent_path=new_parent_path,
                dtable_uuid_parent_path_md5=new_dtable_uuid_parent_path_md5,
                file_name=item.file_name
            ))
        return self.bulk_create(new_items)

    def delete_by_path(self, dtable_uuid, parent_path, file_name):
        asset = self.get_by_path(dtable_uuid, parent_path, file_name)
        if not asset:
            return
        asset.delete()
        return

    def batch_delete_by_dtable_uuid_parent_path(self, dtable_uuid, parent_path):
        dtable_uuid_parent_path_md5 = self.model.get_dtable_uuid_parent_path_md5(dtable_uuid, parent_path)
        return self.filter(dtable_uuid_parent_path_md5=dtable_uuid_parent_path_md5).delete()


class CustomAssetUUID(models.Model):
    id = models.BigAutoField(primary_key=True)
    dtable_uuid = models.CharField(max_length=36)
    uuid = models.UUIDField(unique=True, default=uuid.uuid4)
    parent_path = models.TextField()
    dtable_uuid_parent_path_md5 = models.CharField(max_length=100, db_index=True)
    file_name = models.CharField(max_length=1024)
    objects = CustomAssetUUIDManager()

    class Meta:
        db_table = 'custom_asset_uuid'

    @classmethod
    def get_dtable_uuid_parent_path_md5(cls, dtable_uuid, parent_path):
        parent_path = parent_path.strip('/')
        return hashlib.md5((dtable_uuid + '-' + parent_path).encode('utf-8')).hexdigest()


class DTableAssetTrash(models.Model):
    dtable_uuid = models.CharField(max_length=32, db_index=True)
    name = models.CharField(max_length=255, null=False)
    delete_from = models.CharField(max_length=20, null=False)
    item_type = models.CharField(max_length=20, null=False)
    basedir = models.CharField(max_length=4096, null=False)
    commit_id = models.CharField(max_length=40, null=False)
    size = models.BigIntegerField(default=0)
    deleted_at = models.DateTimeField(db_index=True)
    detail = models.TextField()

    SYSTEM = 'system'
    CUSTOM = 'custom'
    FILE = 'file'
    DIR = 'dir'

    class Meta:
        db_table = 'dtable_asset_trash'

    def to_dict(self):
        return {
            'id': self.pk,
            'dtable_uuid': self.dtable_uuid,
            'name': self.name,
            'delete_from': self.delete_from,
            'item_type': self.item_type,
            'basedir': self.basedir,
            'commit_id': self.commit_id,
            'size': self.size,
            'deleted_at': datetime_to_isoformat_timestr(self.deleted_at),
            'detail': self.detail
        }


class StatsAPIGatewayByBase(models.Model):
    dtable_uuid = models.CharField(max_length=32, null=False)
    api_name = models.CharField(max_length=50, null=False)
    count = models.BigIntegerField()
    month = models.DateField(db_index=True)
    updated_at = models.DateTimeField()

    class Meta:
        db_table = 'stats_api_gateway_by_base'
        unique_together = [('dtable_uuid', 'month', 'api_name')]


class StatsAPIGatewayByOwnerManager(models.Manager):

    def get_month_all_count(self, owner_id, month=None):
        """
        month: str, must be in 'YYYY-mm-01' format, default current month
        """
        if not month:
            month = timezone.now().strftime('%Y-%m-01')
        sum_query = self.filter(
            owner_id=owner_id,
            month=month
        ).aggregate(Sum('count'))
        return sum_query['count__sum'] or 0


class StatsAPIGatewayByOwner(models.Model):
    owner_id = models.CharField(max_length=255, null=False)
    api_name = models.CharField(max_length=50, null=False)
    count = models.BigIntegerField()
    month = models.DateField(db_index=True)
    updated_at = models.DateTimeField()

    objects = StatsAPIGatewayByOwnerManager()

    class Meta:
        db_table = 'stats_api_gateway_by_owner'
        unique_together = [('owner_id', 'month', 'api_name')]


class StatsAPIGatewayByTeamManager(models.Manager):

    def get_month_all_count(self, org_id, month=None):
        """
        month: str, must be in 'YYYY-mm-01' format, default current month
        """
        if not month:
            month = timezone.now().strftime('%Y-%m-01')
        sum_query = self.filter(
            org_id=org_id,
            month=month
        ).aggregate(Sum('count'))
        return sum_query['count__sum'] or 0


class StatsAPIGatewayByTeam(models.Model):
    org_id = models.BigIntegerField(null=False)
    api_name = models.CharField(max_length=50, null=False)
    count = models.BigIntegerField()
    month = models.DateField(db_index=True)
    updated_at = models.DateTimeField()

    objects = StatsAPIGatewayByTeamManager()

    class Meta:
        db_table = 'stats_api_gateway_by_team'
        unique_together = [('org_id', 'month', 'api_name')]


class ExceedAPIQuotaTeams(models.Model):
    org_id = models.BigIntegerField()
    owner_id = models.CharField(max_length=255, db_index=True)
    api_limit = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exceed_api_quota_teams'
        unique_together = [('org_id', 'owner_id')]


# # handle signals
from django.dispatch import receiver

@receiver(delete_dtable)
def dtable_deleted_cb(sender, **kwargs):
    dtable_uuid = kwargs['dtable_uuid']
    DTableForms.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableCollectionTables.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableExternalApps.objects.filter(dtable_uuid=dtable_uuid).delete()
    UserStarredDTables.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableCommonDataset.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableCommonDatasetSync.objects.filter(dst_dtable_uuid=dtable_uuid).delete()
    DTableOpenedBys.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableSharePermission.objects.filter(dtable_uuid=dtable_uuid).delete()
    CustomAssetUUID.objects.filter(dtable_uuid=uuid_str_to_36_chars(dtable_uuid)).delete()
    with connection.cursor() as cursor:
        delete_rows_count_sql = "DELETE FROM dtable_rows_count WHERE dtable_uuid=%s"
        cursor.execute(delete_rows_count_sql, [dtable_uuid])

@receiver(group_deleted)
def group_deleted_cb(sender, **kwargs):
    group_id = kwargs['group_id']
    DTableGroupShare.objects.filter(group_id=group_id).delete()
    DTableViewGroupShare.objects.filter(to_group_id=group_id).delete()

@receiver(move_dtable_to_trash)
def move_dtable_to_trash_cb(sender, **kwargs):
    from seahub.dtable_apps.workflow.models import DTableWorkflows

    dtable_uuid = kwargs['dtable_uuid']
    dtable_forms = DTableForms.objects.filter(dtable_uuid=dtable_uuid)
    # delete the record of form share
    DTableFormShare.objects.filter(form__in=dtable_forms).delete()
    DTableAutomationRules.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableNotificationRules.objects.filter(dtable_uuid=dtable_uuid).delete()
    FolderItems.objects.filter(item_id=dtable_uuid).delete()
    dtable_forms.delete()
    DTableCollectionTables.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableWorkflows.objects.filter(dtable_uuid=dtable_uuid).delete()
    DtableDataSyncs.objects.filter(dtable_uuid=dtable_uuid).delete()
    DTableAssetTrash.objects.filter(dtable_uuid=dtable_uuid).delete()
    # clean org big data cache
    from seahub.dtable.utils import clean_org_big_data_cache
    dtable = DTables.objects.filter(uuid=dtable_uuid).select_related('workspace').first()
    clean_org_big_data_cache(dtable.workspace.org_id)

    # re-calc rows of user/org
    try:
        publish_count_rows([dtable_uuid])
    except Exception as e:
        logger.error('delete dtable publish count-rows: %s, error: %s', dtable_uuid, e)


@receiver(restore_dtable_from_trash)
def restore_dtable_from_trash_cb(sender, **kwargs):
    dtable_uuid = kwargs['dtable_uuid']

    # clean org big data cache
    from seahub.dtable.utils import clean_org_big_data_cache
    dtable = DTables.objects.filter(uuid=dtable_uuid).select_related('workspace').first()
    clean_org_big_data_cache(dtable.workspace.org_id)

    try:
        publish_count_rows([dtable_uuid])
    except Exception as e:
        logger.error('recover dtable publish count-rows: %s, error: %s', dtable_uuid, e)


@receiver(org_role_updated)
def clean_org_dtable_advanced_caches(sender, **kwargs):
    org_id = kwargs.get('org_id')

    from seahub.dtable.utils import clean_advanced_customization_dtable_caches

    try:
        clean_advanced_customization_dtable_caches(org_id)
    except Exception as e:
        logger.exception('clean org: %s advanced dtable caches error: %s', org_id, e)

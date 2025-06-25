# -*- coding: utf-8 -*-
from django.core.cache import cache
import datetime
import logging
import uuid
import json

from django.db import models
from django.core.exceptions import ValidationError
from seahub.project.constants import ORG_STORAGE_SIZE_PREFIX, ORG_STORAGE_SIZE_CACHE_TIMEOUT
from seahub.utils.timeutils import timestamp_to_isoformat_timestr, datetime_to_isoformat_timestr
from seahub.utils import gen_token, uuid_str_to_36_chars, normalize_cache_key, get_no_duplicate_obj_name, \
    utf8_normalize, is_valid_uuid
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.project.constants import FOLDER_ITEM_PROJECT_GROUP_SHARE, FOLDER_ITEM_PROJECT

from seahub.utils import normalize_cache_key

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

    def create_workspace(self, owner, org_id):
        try:
            return super(WorkspacesManager, self).get(owner=owner)
        except self.model.DoesNotExist:
            workspace = self.model(owner=owner, org_id=org_id)
            workspace.save()
            return workspace

    def delete_workspaces_by_org_id(self, org_id):
        workspaces = self.list_workspaces_by_org_id(org_id)
        for workspace in workspaces:
            self.delete_workspace(workspace.id)

    def get_deleted_workspaces_by_expire_seconds(self, expire_seconds):
        return super(WorkspacesManager, self).filter(
            deleted=True, delete_time__lt=(datetime.datetime.now() - datetime.timedelta(seconds=expire_seconds)))


class Workspaces(models.Model):
    name = models.CharField(max_length=255, null=True)
    owner = models.CharField(max_length=255, unique=True)
    org_id = models.IntegerField(default=-1, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    delete_time = models.DateTimeField(null=True)

    objects = WorkspacesManager()

    class Meta:
        db_table = 'workspaces'

    def to_dict(self):
        return {
            'id': self.pk,
        }

    def get_group_id(self):
        if '@seafile_group' in self.owner:
            return int(self.owner.split('@')[0])
        return None


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


class ProjectsManager(models.Manager):

    def create_project(self, username, workspace, name, color=None, text_color=None, icon=None, password=None):
        name = utf8_normalize(name)
        project = self.model(workspace=workspace, name=name, creator=username, modifier=username,
                             color=color, text_color=text_color, icon=icon, password=password)
        project.save()
        return project

    def get_project(self, workspace, name, deleted=False):
        try:
            return super(ProjectsManager, self).get(workspace=workspace, name=name, deleted=deleted)
        except self.model.DoesNotExist:
            return None

    def get_project_by_uuid(self, dtable_uuid, include_deleted=True):
        try:
            if not include_deleted:
                return super(ProjectsManager, self).get(uuid=dtable_uuid, deleted=False)
            return super(ProjectsManager, self).get(uuid=dtable_uuid)
        except self.model.DoesNotExist:
            return None
        except ValidationError:  # uuid maybe invalid
            return None

    def get_project_by_query_str(self, query_str, include_deleted=True):

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

    def search_project_in_org(self, org_id, query_str, start, end):
        workspace_ids = Workspaces.objects.filter(org_id=org_id).values('id')
        if is_valid_uuid(query_str):
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, uuid=query_str).order_by('id')[start:end]
        else:
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, name__icontains=query_str).order_by('id')[start:end]

    def get_non_duplicated_name(self, name, workspace_id):
        dtables = super(ProjectsManager, self).filter(deleted=False, name__startswith=name, workspace_id=workspace_id)
        existed_names = [d.name for d in dtables]
        if not existed_names or name not in existed_names:
            return name
        return get_no_duplicate_obj_name(name, existed_names)

    def get_personal_projects_by_username(self, username):
        user_workspace = Workspaces.objects.get_workspace_by_owner(username)
        try:
            return super(ProjectsManager, self).filter(workspace=user_workspace, deleted=False)
        except self.model.DoesNotExist:
            return None


class Projects(models.Model):
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

    objects = ProjectsManager()

    class Meta:
        unique_together = (('workspace', 'name'),)
        db_table = 'projects'

    def to_dict(self, include_deleted=False):
        result = {
            'id': self.pk,
            'workspace_id': self.workspace_id,
            'uuid': str(self.uuid),
            'name': self.project_name,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'updated_at': datetime_to_isoformat_timestr(self.updated_at),
            'color': self.color,
            'text_color': self.text_color,
            'icon': self.icon,
            'is_encrypted': self.is_encrypted(),
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
    def project_name(self):
        if self.deleted:
            return self.name[self.name.find(' ') + 1:]
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
        return False


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
        (FOLDER_ITEM_PROJECT_GROUP_SHARE, 'Project_Group_Share'),
        (FOLDER_ITEM_PROJECT, 'Project'),
    )

    folder_id = models.IntegerField(null=False)
    item_type = models.CharField(max_length=50, null=False, choices=ITEM_TYPE_CHOICES)
    item_id = models.CharField(max_length=36, null=False)

    class Meta:
        db_table = 'folder_items'
        index_together = [('item_type', 'item_id')]
        unique_together = [('folder_id', 'item_type', 'item_id')]

    def to_dict(self):
        item_id = self.item_id if self.item_type != FOLDER_ITEM_PROJECT else uuid_str_to_36_chars(self.item_id)
        return {
            'folder_id': self.folder_id,
            'item_type': self.item_type,
            'item_id': item_id
        }


class ProjectGroupOrdersManager(models.Manager):
    def get_group_order_by_username(self, username):
        try:
            return self.get(username=username)
        except self.model.DoesNotExist:
            return None


class ProjectGroupOrders(models.Model):
    username = models.CharField(max_length=255, null=False, unique=True)
    detail = models.TextField()

    objects = ProjectGroupOrdersManager()

    class Meta:
        db_table = 'project_group_orders'

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


class SitesManager(models.Manager):
    def create(self, username, project, name, url, sitemap_url):
        project = self.model(project=project, name=name, url=url, sitemap_url=sitemap_url, modifier=username, status='pending')
        project.save()
        return project
    
    def modify(self, username, project, site_id, name, url, sitemap_url):
        site = self.filter(project=project, id=site_id).first()
        if not site:
            site = self.model(project=project, name=name, url=url, sitemap_url=sitemap_url, modifier=username, status='pending')
        else:
            site.name = name
            site.url = url
            site.sitemap_url = sitemap_url
        site.save()
        return site


class Sites(models.Model):
    project = models.ForeignKey(Projects, on_delete=models.CASCADE, db_index=True)
    name = models.CharField(max_length=255)
    url = models.CharField(max_length=255)
    sitemap_url = models.CharField(max_length=255)
    modifier = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_crawled_at = models.DateTimeField(null=True)
    status = models.CharField(max_length=20)

    objects = SitesManager()

    class Meta:
        db_table = 'sites'
        unique_together = [('url', 'project')]

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'sitemap_url': self.sitemap_url,
            'modifier': self.modifier,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'last_crawled_at': datetime_to_isoformat_timestr(self.last_crawled_at),
            'status': self.status,
        }

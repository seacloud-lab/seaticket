# -*- coding: utf-8 -*-
from django.core.cache import cache
import datetime
import logging

from django.db import models
from seahub.dtable.constants import ORG_STORAGE_SIZE_PREFIX, ORG_STORAGE_SIZE_CACHE_TIMEOUT


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

    def create_workspace(self, owner, repo_id, org_id):
        try:
            return super(WorkspacesManager, self).get(owner=owner, repo_id=repo_id)
        except self.model.DoesNotExist:
            workspace = self.model(owner=owner, repo_id=repo_id, org_id=org_id)
            workspace.save()
            return workspace

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

    def to_dict(self):
        return {
            'id': self.pk,
            'repo_id': self.repo_id,
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

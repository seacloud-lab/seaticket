# -*- coding: utf-8 -*-
from django.core.cache import cache
import datetime
import logging
import uuid
import json
import time
import hashlib

from django.db import models
from django.core.exceptions import ValidationError
from seahub.project.constants import ORG_STORAGE_SIZE_PREFIX, ORG_STORAGE_SIZE_CACHE_TIMEOUT, CONNECTION_FIELDS
from seahub.utils import get_no_duplicate_obj_name, \
    utf8_normalize, is_valid_uuid
from seahub.api2.utils import get_user_common_info

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

    def create_project(self, username, workspace, name, color=None, text_color=None, icon=None):
        name = utf8_normalize(name)
        project = self.model(workspace=workspace, name=name, creator=username, modifier=username,
                             color=color, text_color=text_color, icon=icon)
        project.save()
        return project

    def get_project(self, workspace, name, deleted=False):
        try:
            return super(ProjectsManager, self).get(workspace=workspace, name=name, deleted=deleted)
        except self.model.DoesNotExist:
            return None

    def get_project_by_uuid(self, project_uuid, include_deleted=True):
        try:
            if not include_deleted:
                return super(ProjectsManager, self).get(uuid=project_uuid, deleted=False)
            return super(ProjectsManager, self).get(uuid=project_uuid)
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

    def delete_project(self, workspace, name):
        try:
            project = super(ProjectsManager, self).get(workspace=workspace, name=name)
            project.delete()
            return True
        except self.model.DoesNotExist:
            return False

    def search_project_in_org(self, org_id, query_str, start, end):
        workspace_ids = Workspaces.objects.filter(org_id=org_id).values('id')
        if is_valid_uuid(query_str):
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, uuid=query_str).order_by('id')[start:end]
        else:
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, name__icontains=query_str).order_by('id')[start:end]

    def get_non_duplicated_name(self, name, workspace_id):
        projects = super(ProjectsManager, self).filter(deleted=False, name__startswith=name, workspace_id=workspace_id)
        existed_names = [d.name for d in projects]
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
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'color': self.color,
            'text_color': self.text_color,
            'icon': self.icon,
            'is_encrypted': self.is_encrypted(),
        }
        if include_deleted:
            result.update({
                'deleted': self.deleted,
                'delete_time': self.delete_time if self.delete_time else '',
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


class DeletedProjects(models.Model):
    project_uuid = models.UUIDField(unique=True, default=uuid.uuid4)

    class Meta:
        db_table = 'deleted_projects'


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

class ProjectConnectionsManager(models.Manager):
    """ Project connections manager
    """

    def create(self, username, project, connection_type, name, config):
        """ create record
        """

        record = self.model(project=project, type=connection_type, name=name, config=config, modifier=username, status='pending')
        record.save()
        return record.to_dict()

    def modify(self, username, project, connection_type, connection_id, name, config):
        """ modify record: if not record, create it
        """

        record = self.filter(project=project, id=connection_id).first()
        if not record:
            record = self.model(project=project, type=connection_type, name=name, config=config, modifier=username, status='pending')
        else:
            record.name = name
            record.config = config
        record.save()
        return record

    def get_records(self, project, connection_type):
        """ get records by project and connection_type
        """

        records = self.filter(project=project, type=connection_type)
        return records

    def is_valid(self, connection_type, records, name, config):
        """ check config is valid
        """

        if isinstance(config, str):
            config = json.loads(config)

        if not records:
            return True

        fields = CONNECTION_FIELDS.get(connection_type, [])
        required_fields = [f for f in fields if f.get('is_required')]

        flag = True
        if required_fields:
            for field in required_fields:
                key = field.get('key', '')
                if not config.get(key, ''):
                    flag = False
                break

        return flag

    def enable_create(self, project, connection_type, name, config):
        """ check enable create
        """

        if not project or not connection_type:
            return False

        records = self.filter(project=project, type=connection_type)
        return self.is_valid(connection_type, records, name, config)

    def enable_modify(self, project, connection_type, connection_id, name, config):
        """ check enable modify
        """

        if not project or not connection_type:
            return False

        connection_id = int(connection_id)
        records = self.filter(project=project, type=connection_type)
        records = [record for record in records if record.id != connection_id]
        return self.is_valid(connection_type, records, name, config)


class ProjectConnections(models.Model):
    """ Project connections table
    """

    project = models.ForeignKey(Projects, on_delete=models.CASCADE, db_index=True)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=255)
    config = models.TextField()
    modifier = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(null=True)
    status = models.CharField(max_length=20)
    indexed_at = models.DateTimeField(null=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)

    objects = ProjectConnectionsManager()

    class Meta:
        db_table = 'project_connection'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'config': self.config,
            'modifier': self.modifier,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'indexed_at': self.indexed_at,
            'status': self.status,
        }


class TicketsManager(models.Manager):

    def list_tickets(self, project_uuid, start, end):
        return self.filter(
            project_uuid=project_uuid, deleted=False).order_by('-number')[start: end]

    def list_tickets_by_username(self, project_uuid, username, start, end):
        return self.filter(
            project_uuid=project_uuid, creator=username, deleted=False).order_by('-number')[start: end]

    def create_ticket(self, project_uuid, username, title, content, status, ticket_type=None):
        for i in range(3):
            try:
                previous_ticket = self.filter(project_uuid=project_uuid).order_by('-number').first()
                number = previous_ticket.number + 1 if previous_ticket else 1
                item = self.create(
                    project_uuid=project_uuid,
                    number=number,
                    creator=username,
                    title=title,
                    content=content,
                    status=status,
                    type=ticket_type,
                )
                return item
            except self.model.MultipleObjectsReturned:
                time.sleep(0.2)
                continue
        return None

    def get_ticket(self, project_uuid, number, deleted=False):
        return self.filter(project_uuid=project_uuid, number=number, deleted=deleted).first()

    def get_previous_ticket_by_username(self, project_uuid, username, deleted=False):
        return self.filter(project_uuid=project_uuid, creator=username, deleted=deleted).order_by('-number').first()


class Tickets(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.UUIDField()
    number = models.IntegerField()
    creator = models.CharField(max_length=255, db_index=True)
    title = models.CharField(max_length=255)
    content = models.TextField()
    status = models.CharField(max_length=50, null=True, db_index=True)
    type = models.CharField(max_length=50, null=True)
    reply_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)
    reply_updated_at = models.DateTimeField(null=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    delete_at = models.DateTimeField(null=True)

    objects = TicketsManager()

    class Meta:
        unique_together = (('project_uuid', 'number'),)
        db_table = 'tickets'

    def to_dict(self, tags_dict={}, participants_dict={}, include_deleted=False):
        result = {
            'project_uuid': str(self.project_uuid),
            'number': self.number,
            'title': self.title,
            'content': self.content,
            'participants': [],
            'tags': [],
            'status': self.status,
            'type': self.type,
            'reply_count': self.reply_count,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'reply_updated_at': self.reply_updated_at,
            'creator': json.dumps(get_user_common_info(self.creator) if self.creator else {})
        }
        if self.id in tags_dict:
            result['tags'] = tags_dict[self.id]
        if self.id in participants_dict:
            result['participants'] = [
                get_user_common_info(participant) for participant in participants_dict[self.id]]
        if include_deleted:
            result.update({
                'deleted': self.deleted,
                'delete_at': self.delete_at if self.delete_at else '',
            })
        return result

class TicketRepliesManager(models.Manager):

    def list_replies(self, ticket_id, start, end):
        return self.filter(
            ticket_id=ticket_id, deleted=False).order_by('number')[start: end]

    def get_replies_count(self, ticket_id):
        return self.filter(
            ticket_id=ticket_id, deleted=False).count()

    def create_reply(self, ticket_id, username, content):
        for i in range(3):
            try:
                previous_reply = self.filter(ticket_id=ticket_id).order_by('-number').first()
                number = previous_reply.number + 1 if previous_reply else 1
                return self.create(
                    ticket_id=ticket_id,
                    number=number,
                    creator=username,
                    content=content,
                )
            except self.model.MultipleObjectsReturned:
                time.sleep(0.2)
                continue
        return None

    def get_reply(self, ticket_id, number, deleted=False):
        return self.filter(ticket_id=ticket_id, number=number, deleted=deleted).first()

    def get_previous_reply_by_username(self, ticket_id, username, deleted=False):
        return self.filter(ticket_id=ticket_id, creator=username, deleted=deleted).order_by('-number').first()

class TicketReplies(models.Model):
    id = models.BigAutoField(primary_key=True)
    ticket_id = models.BigIntegerField()
    number = models.IntegerField()
    creator = models.CharField(max_length=255, db_index=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    delete_at= models.DateTimeField(null=True)

    objects = TicketRepliesManager()

    class Meta:
        unique_together = (('ticket_id', 'number'),)
        db_table = 'ticket_replies'

    def to_dict(self, include_deleted=False):
        result = {
            'number': self.number,
            'content': self.content,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'creator': json.dumps(get_user_common_info(self.creator) if self.creator else {}),
        }
        if include_deleted:
            result.update({
                'deleted': self.deleted,
                'delete_at': self.delete_at if self.delete_at else '',
            })
        return result


class TicketTags(models.Model):
    id = models.BigAutoField(primary_key=True)
    ticket_id = models.BigIntegerField()
    tag_id = models.IntegerField()

    class Meta:
        unique_together = (('ticket_id', 'tag_id'),)
        db_table = 'ticket_tags'


class ProjectTags(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.UUIDField()
    name = models.CharField(max_length=255)
    description = models.TextField()
    color = models.CharField(max_length=50)
    text_color = models.CharField(max_length=50)
    is_predefined = models.BooleanField()

    class Meta:
        unique_together = (('project_uuid', 'name'),)
        db_table = 'project_tags'

    def to_dict(self, tickets_count_dict={}):
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color,
            'text_color': self.text_color,
            'is_predefined': self.is_predefined,
        }
        if self.id in tickets_count_dict:
            result['tickets_count'] = tickets_count_dict[self.id]
        return result


class TicketParticipants(models.Model):
    id = models.BigAutoField(primary_key=True)
    ticket_id = models.BigIntegerField(db_index=True)
    participant = models.CharField(max_length=255, db_index=True)

    class Meta:
        unique_together = (('ticket_id', 'participant'),)
        db_table = 'ticket_participants'


class ProjectFilesManager(models.Manager):
    def save_file(self, project_uuid, file_name, file_size, username):
        file_path = f'/file/project/{project_uuid}/{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m')}/{file_name}'
        file_path_md5 = hashlib.md5(file_path.encode('utf-8')).hexdigest()
        return self.create(
            project_uuid=project_uuid,
            file_path_md5=file_path_md5,
            file_name=file_name,
            file_size=file_size,
            creator=username,
        )

    def get_file(self, project_uuid, file_path):
        file_path = f'/file/project/{project_uuid}/{file_path}'
        file_path_md5 = hashlib.md5(file_path.encode('utf-8')).hexdigest()
        return self.filter(file_path_md5=file_path_md5).first()


class ProjectFiles(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.UUIDField(db_index=True)
    file_path_md5 = models.CharField(max_length=32, unique=True)
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField()
    creator = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ProjectFilesManager()

    class Meta:
        db_table = 'project_files'

    def file_path(self):
        # /file/project/<project_uuid>/<year-month>/file_name
        return f'/file/project/{self.project_uuid}/{self.created_at.strftime("%Y-%m")}/{self.file_name}'

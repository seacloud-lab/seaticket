# -*- coding: utf-8 -*-
from django.core.cache import cache
import datetime
import logging
import uuid
import json
import time
import copy
import random
import string
from copy import deepcopy

from django.db import models
from django.db.models import Q
from django.core.exceptions import ValidationError
from seahub.project.constants import ORG_STORAGE_SIZE_PREFIX, ORG_STORAGE_SIZE_CACHE_TIMEOUT, \
    CONNECTION_FIELDS, TICKET_DEFAULT_DETAILS, CONNECTION_DEFAULT_DETAILS
from seahub.utils import get_no_duplicate_obj_name, uuid_str_to_32_chars, \
    utf8_normalize, is_valid_uuid
from seahub.utils.hasher import AESPasswordHasher

from seahub.utils import normalize_cache_key

logger = logging.getLogger(__name__)


def generate_random_string_lower_digits(length):
    letters_and_digits = string.ascii_lowercase + string.digits
    random_string = ''.join(random.choice(letters_and_digits) for i in range(length))
    return random_string


def generate_views_unique_id(length, folders_views_ids=None):
    if not folders_views_ids:
        return generate_random_string_lower_digits(length)

    while True:
        id = generate_random_string_lower_digits(length)
        if id not in folders_views_ids:
            break

    return id


ENCRYPT_KEYS = ['api_token', 'access_token', 'webhook_secret', 'api_key']


def encrypt_config(config):
    config_clone = deepcopy(config)
    cryptor = AESPasswordHasher()
    encrypted_details = {
        key: cryptor.encode(config_clone[key])
        for key in ENCRYPT_KEYS if key in config_clone and config_clone[key]
    }
    config_clone.update(encrypted_details)
    return json.dumps(config_clone)


def decrypt_config(config):
    config_clone = deepcopy(config)
    cryptor = AESPasswordHasher()
    decrypted_details = {
        key: cryptor.decode(config_clone[key])
        for key in ENCRYPT_KEYS if key in config_clone and config_clone[key]
    }
    config_clone.update(decrypted_details)
    return config_clone



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
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
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

# connections
class ProjectConnectionsManager(models.Manager):
    """ Project connections manager
    """

    def get_connection_by_id(self, connection_id):
        try:
            return self.get(id=connection_id, deleted=False)
        except ProjectConnections.DoesNotExist:
            return None

    def create(self, username, project, connection_type, name, config):
        """ create record
        """
        status = {
            'last_indexed_count': 0,
            'last_index_status': 'pending',
            'total_records': 0,
            'last_sync_count': 0,
            'last_sync_status': 'pending'
        }

        record = self.model(project=project, type=connection_type, name=name, config=encrypt_config(config), modifier=username, status=json.dumps(status))
        record.save()
        return record

    def modify(self, username, project, connection_type, connection_id, name, config, is_active):
        """ modify record: if not record, create it
        """

        record = self.filter(project=project, id=connection_id).first()
        if not record:
            record = self.model(project=project, type=connection_type, name=name, config=config, modifier=username)
        else:
            if is_active is not None:
                record.is_active = is_active
            if name:
                record.name = name
            if config:
                record.config = encrypt_config(config)
        record.save()
        return record

    def get_records(self, project, connection_type):
        """ get records by project and connection_type
        """

        records = self.filter(project=project, type=connection_type)
        return records

    def is_valid(self, connection_type, records, config):
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

    def enable_create(self, project, connection_type, config):
        """ check enable create
        """

        if not project or not connection_type:
            return False

        records = self.filter(project=project, type=connection_type)
        return self.is_valid(connection_type, records, config)

    def enable_modify(self, connection_type, connection_id, config):
        """ check enable modify
        """

        if not connection_type:
            return False

        connection_id = int(connection_id)
        records = self.filter(id=connection_id)
        return self.is_valid(connection_type, records, config)

    def update_status(self, connection_id, status):
        try:
            record = self.get(id=connection_id)
            record.status = json.dumps(status)
            record.save()
            return record
        except ProjectConnections.DoesNotExist:
            return None
    
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
    status = models.TextField()
    indexed_at = models.DateTimeField(null=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    is_active = models.BooleanField(default=True, null=False, db_index=True)

    objects = ProjectConnectionsManager()

    class Meta:
        db_table = 'project_connection'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'config': decrypt_config(json.loads(self.config)),
            'modifier': self.modifier,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'indexed_at': self.indexed_at,
            'status': self.status,
            'is_active': self.is_active,
        }

class ConnectionsView(object):
    
    def __init__(self, name, view_type='table', config={}):
        self.name = name
        self.type = view_type
        self.config = config
        self.details = {}

        self.init_view()            

    def init_view(self):
        self.details = {
            "_id": generate_views_unique_id(4),
            "table_id": '0000',  # by default
            "name": self.name,
            'basic_filters': [
                {'column_key': 'status', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                {'column_key': 'tags', 'filter_predicate': 'has_any_of', 'filter_term': []}
            ],
            "filters": [],
            'sorts': [{ 'column_key': 'created_at', 'sort_type': 'down' }],
            "groupbys": [],
            "filter_conjunction": "Or",
            "hidden_columns": [],
            "type": self.type,
        }
        self.details.update(self.config)

class ConnectionsViewsManager(models.Manager):
		
    def get_record_by_view(self, project_uuid, start, end, view_id, connection_id):
        sorts = []
        view = ConnectionsViews.objects.get_view(project_uuid, connection_id, view_id)
        basic_filters = view.get('basic_filters', [])
        sorts = view.get('sorts', [])

        q = Q(deleted=False) & Q(connection_id=connection_id)

        for basic_filter in basic_filters:
                if basic_filter.get('column_key') == 'status':
                        value = basic_filter['filter_term']
                        if not value:
                                value = ['', 'open', 'completed', 'not_planned', 'duplicate']
                        elif 'open' in value:
                                value = value + ['']
                        q = q & Q(state__in=value)

        if not sorts:
                sorts = [{ 'column_key': 'number', 'sort_type': 'down' }]
        sorts = [f'-{sort["column_key"]}' if sort['sort_type'] == 'down' else sort['column_key'] for sort in sorts]
        
        return self.filter(q).order_by(', '.join(sorts))[start: end]

    def get_record(self, project_uuid, connection_id):
        """
            get record from database, if not record, create it
        """
        project_uuid = uuid_str_to_32_chars(project_uuid)
        record = self.filter(connection_id=connection_id).first()
        
        if not record:
            record = self.create(
                project_uuid=project_uuid,
                connection_id=connection_id,
                details=json.dumps(CONNECTION_DEFAULT_DETAILS)
            )
        return record

    # view op
    def list_views(self, project_uuid, connection_id):
        record = self.get_record(project_uuid, connection_id)
        return json.loads(record.details)

    def get_view(self, project_uuid, connection_id, view_id):
        record = self.get_record(project_uuid, connection_id)
        view_details = json.loads(record.details)
        for v in view_details['views']:
            if v.get('_id') == view_id:
                return v
        return None

    def add_view(self, project_uuid, connection_id, view_name, view_type='table', view_data={}):
        record = self.get_record(project_uuid, connection_id)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        view_name = get_no_duplicate_obj_name(view_name, record.views_names)
        new_view = ConnectionsView(view_name, view_type, view_data)
        details = new_view.details
        view_id = details.get('_id')
        view_details['views'].append(details)
        new_view_nav = { '_id': view_id, 'type': 'view' }
        navigation.append(new_view_nav)
        record.details = json.dumps(view_details)
        record.save()
        return new_view.details

    def update_view(self, project_uuid, connection_id, view_id, view_dict):
        record = self.get_record(project_uuid, connection_id)
        view_dict.pop('_id', '')
        if 'name' in view_dict:
            exist_obj_names = record.views_names
            view_dict['name'] = get_no_duplicate_obj_name(view_dict['name'], exist_obj_names)
        view_details = json.loads(record.details)
        for v in view_details['views']:
            if v.get('_id') == view_id:
                v.update(view_dict)
                break
        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def duplicate_view(self, project_uuid, connection_id, view_id):
        record = self.get_record(project_uuid, connection_id)
        view_details = json.loads(record.details)
        exist_folders_views_ids = record.folders_views_ids
        new_view_id = generate_views_unique_id(4, exist_folders_views_ids)
        duplicate_view = next((copy.deepcopy(view) for view in view_details['views'] if view.get('_id') == view_id), None)
        if not duplicate_view:
            return None

        duplicate_view['_id'] = new_view_id
        view_name = get_no_duplicate_obj_name(duplicate_view['name'], record.views_names)
        duplicate_view['name'] = view_name
        view_details['views'].append(duplicate_view)
        navigation = view_details.get('navigation', [])
        new_view_nav = {'_id': new_view_id, 'type': 'view'}
        navigation.append(new_view_nav)
        record.details = json.dumps(view_details)
        record.save()

        return duplicate_view

    def delete_view(self, project_uuid, connection_id, view_id):
        record = self.get_record(project_uuid, connection_id)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        views = view_details.get('views', [])

        for view in views:
            if view.get('_id') == view_id:
                views.remove(view)
                break
        for nav_item in navigation:

            # delete view not in folders
            if nav_item.get('_id') == view_id:
                navigation.remove(nav_item)
                break

        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def move_view(self, project_uuid, connection_id, source_view_id, source_folder_id, target_view_id, target_folder_id, is_above_folder):
        record = self.get_record(project_uuid, connection_id)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])

        updated_source_nav_list = []
        dragged_id = None

        # find drag source
        if source_folder_id:
            if source_view_id:
                # drag view from folder
                dragged_id = source_view_id
                source_folder = next((folder for folder in navigation if folder.get('_id') == source_folder_id), None)
                if source_folder:
                    updated_source_nav_list = source_folder.get('children', [])
            else:
                # drag folder
                dragged_id = source_folder_id
                updated_source_nav_list = navigation
        elif source_view_id:
            # drag view not in folders
            dragged_id = source_view_id
            updated_source_nav_list = navigation

        # invalid drag source
        if not dragged_id or not updated_source_nav_list:
            return None
        drag_source = next((nav for nav in updated_source_nav_list if nav.get('_id') == dragged_id), None)
        if not drag_source:
            return None

        # remove drag source from navigation
        updated_source_nav_list.remove(drag_source)

        # find drop target
        updated_target_nav_list = navigation
        if target_folder_id and source_view_id and not is_above_folder:
            target_folder = next((folder for folder in navigation if folder.get('_id') == target_folder_id), None)
            if target_folder:
                updated_target_nav_list = target_folder.get('children', [])

        # drag source already exist
        exist_drag_source = next((nav for nav in updated_target_nav_list if nav.get('_id') == drag_source.get('_id')), None)
        if exist_drag_source:
            return None

        # drop drag source to the target position
        target_nav = None
        if target_view_id:
            # move folder/view above view
            target_nav = next((nav for nav in updated_target_nav_list if nav.get('_id') == target_view_id), None)
        elif target_folder_id:
            # move folder/view above folder
            target_nav = next((nav for nav in updated_target_nav_list if nav.get('_id') == target_folder_id), None)

        insert_index = -1
        if target_nav:
            insert_index = updated_target_nav_list.index(target_nav)

        if insert_index > -1:
            updated_target_nav_list.insert(insert_index, drag_source)
        else:
            updated_target_nav_list.append(drag_source)

        record.details = json.dumps(view_details)
        record.save()
        return view_details

class ConnectionsViews(models.Model):
    project_uuid = models.CharField(max_length=32, db_index=True)
    connection_id = models.IntegerField()
    details = models.TextField()


    objects = ConnectionsViewsManager()

    class Meta:
        db_table = 'connection_views'

    @property
    def folders_ids(self):
        details = json.loads(self.details)
        navigation = details.get('navigation', [])
        return [folder.get('_id') for folder in navigation if folder.get('type', None) == 'folder']

    @property
    def folders_names(self):
        details = json.loads(self.details)
        navigation = details.get('navigation', [])
        return [folder.get('name') for folder in navigation if folder.get('type', None) == 'folder']

    @property
    def views_ids(self):
        views = json.loads(self.details)['views']
        return [v.get('_id') for v in views]

    @property
    def views_names(self):
        views = json.loads(self.details)['views']
        return [v.get('name') for v in views]

    @property
    def folders_views_ids(self):
        return self.folders_ids + self.views_ids

class GitHubIssuesRecord(models.Model):
    """ GitHub issues table"""

    issue_id = models.BigIntegerField()
    issue_number = models.IntegerField()
    title = models.TextField(null=True, blank=True)
    body = models.TextField(null=True, blank=True)
    state = models.CharField(max_length=20, null=True, blank=True)
    labels = models.TextField(null=True, blank=True)
    author = models.CharField(max_length=255, null=True, blank=True)
    url = models.CharField(max_length=1024, null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    comments = models.IntegerField(null=True, blank=True)
    connection_id = models.CharField(max_length=64)
    need_index = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)

    objects = ConnectionsViewsManager()

    class Meta:
        db_table = 'github_issues'
        unique_together = [('issue_id', 'connection_id')]

    def to_dict(self):
        return {
            'id': self.id,
            'issue_id': self.issue_id,
            'issue_number': self.issue_number,
            'title': self.title,
            'body': self.body,
            'state': self.state,
            'labels': self.labels,
            'author': self.author,
            'url': self.url,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'closed_at': self.closed_at,
            'comments': self.comments,
            'connection_id': self.connection_id,
            'need_index': self.need_index,
            'deleted': self.deleted,
        }

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
    updated_at = models.DateTimeField(auto_now=True)
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
            'creator': self.creator,
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
        }
        if self.id in tickets_count_dict:
            result['tickets_count'] = tickets_count_dict[self.id]
        return result


class ProjectTypes(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.UUIDField()
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=50)
    text_color = models.CharField(max_length=50)

    class Meta:
        unique_together = (('project_uuid', 'name'),)
        db_table = 'project_types'

    def to_dict(self, tickets_count_dict={}):
        result = {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'text_color': self.text_color,
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


class TicketAssignees(models.Model):
    id = models.BigAutoField(primary_key=True)
    ticket_id = models.BigIntegerField(db_index=True)
    assignee = models.CharField(max_length=255, db_index=True)

    class Meta:
        unique_together = (('ticket_id', 'assignee'),)
        db_table = 'ticket_assignees'


class TicketFolder(object):

    def __init__(self, name, children=[], folders_views_ids=None):
        self.name = name
        self.type = 'folder'
        self.children = children

        self.init_folder(folders_views_ids)

    def init_folder(self, folders_views_ids=None):
        self.folder_json = {
            "_id": generate_views_unique_id(4, folders_views_ids),
            "name": self.name,
            "type": self.type,
            "children": self.children
        }


class TicketView(object):

    def __init__(self, name, view_type='table', config={}, folders_views_ids=None):
        self.name = name
        self.type = view_type
        self.config = config
        self.details = {}

        self.init_view(folders_views_ids)

    def init_view(self, folders_views_ids=None):
        self.details = {
            "_id": generate_views_unique_id(4, folders_views_ids),
            "table_id": '0000',  # by default
            "name": self.name,
            'basic_filters': [
                {'column_key': 'status', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                {'column_key': 'tags', 'filter_predicate': 'has_any_of', 'filter_term': []}
            ],
            "filters": [],
            'sorts': [{ 'column_key': 'created_at', 'sort_type': 'down' }],
            "groupbys": [],
            "filter_conjunction": "Or",
            "hidden_columns": [],
            "type": self.type,
        }
        self.details.update(self.config)


class TicketViewsManager(models.Manager):

    def get_record(self, project_uuid):
        """
            get record from database, if not record, create it
        """
        project_uuid = uuid_str_to_32_chars(project_uuid)
        record = self.filter(project_uuid=project_uuid).first()
        if not record:
            record = self.create(
                project_uuid=project_uuid,
                details=json.dumps(TICKET_DEFAULT_DETAILS)
            )
        return record

    # folder op
    def add_folder(self, project_uuid, folder_name):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        exist_folders_views_ids = record.folders_views_ids
        new_folder = TicketFolder(folder_name, [], exist_folders_views_ids)
        folder_json = new_folder.folder_json
        navigation.append(folder_json)
        record.details = json.dumps(view_details)
        record.save()
        return folder_json

    def update_folder(self, project_uuid, folder_id, folder_dict):
        record = self.get_record(project_uuid)
        folder_dict.pop('_id', '')
        folder_dict.pop('type', '')
        folder_dict.pop('children', '')
        if 'name' in folder_dict:
            exist_obj_names = record.folders_names
            folder_dict['name'] = get_no_duplicate_obj_name(folder_dict['name'], exist_obj_names)
        view_details = json.loads(record.details)
        for folder in view_details['navigation']:
            if folder.get('type', None) == 'folder' and folder.get('_id') == folder_id:
                folder.update(folder_dict)
                break
        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def delete_folder(self, project_uuid, folder_id):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        views = view_details.get('views', [])
        for folder in navigation:
            if folder.get('_id') == folder_id:
                # add views which in the folder into navigation
                if folder.get('children'):
                    navigation.extend(folder.get('children'))

                # remove folder
                navigation.remove(folder)
                break
        record.details = json.dumps(view_details)
        record.save()
        return view_details

    # view op
    def list_views(self, project_uuid):
        record = self.get_record(project_uuid)
        return json.loads(record.details)

    def get_view(self, project_uuid, view_id):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        for v in view_details['views']:
            if v.get('_id') == view_id:
                return v
        return None

    def add_view(self, project_uuid, view_name, view_type='table', view_data={}, folder_id=None):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        view_name = get_no_duplicate_obj_name(view_name, record.views_names)
        exist_folders_views_ids = record.folders_views_ids
        new_view = TicketView(view_name, view_type, view_data, exist_folders_views_ids)
        details = new_view.details
        view_id = details.get('_id')
        view_details['views'].append(details)
        new_view_nav = { '_id': view_id, 'type': 'view' }
        if folder_id:
            folder = next((folder for folder in navigation if folder.get('_id') == folder_id), None)
            if not folder:
                return None
            folderChildren = folder.get('children', [])
            folderChildren.append(new_view_nav)
        else:
            navigation.append(new_view_nav)
        record.details = json.dumps(view_details)
        record.save()
        return new_view.details

    def update_view(self, project_uuid, view_id, view_dict):
        record = self.get_record(project_uuid)
        view_dict.pop('_id', '')
        if 'name' in view_dict:
            exist_obj_names = record.views_names
            view_dict['name'] = get_no_duplicate_obj_name(view_dict['name'], exist_obj_names)
        view_details = json.loads(record.details)
        for v in view_details['views']:
            if v.get('_id') == view_id:
                v.update(view_dict)
                break
        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def duplicate_view(self, project_uuid, view_id, folder_id=None):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        exist_folders_views_ids = record.folders_views_ids
        new_view_id = generate_views_unique_id(4, exist_folders_views_ids)
        duplicate_view = next((copy.deepcopy(view) for view in view_details['views'] if view.get('_id') == view_id), None)
        if not duplicate_view:
            return None

        duplicate_view['_id'] = new_view_id
        view_name = get_no_duplicate_obj_name(duplicate_view['name'], record.views_names)
        duplicate_view['name'] = view_name
        view_details['views'].append(duplicate_view)
        navigation = view_details.get('navigation', [])
        new_view_nav = {'_id': new_view_id, 'type': 'view'}
        if folder_id:
            # add duplicate_view into folder
            folder = next((folder for folder in navigation if folder.get('_id') == folder_id), None)
            if not folder:
                return None
            folderChildren = folder.get('children', [])
            folderChildren.append(new_view_nav)
        else:
            navigation.append(new_view_nav)

        record.details = json.dumps(view_details)
        record.save()

        return duplicate_view

    def delete_view(self, project_uuid, view_id, folder_id=None):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        views = view_details.get('views', [])

        for view in views:
            if view.get('_id') == view_id:
                views.remove(view)
                break
        for nav_item in navigation:
            # delete view from folder
            if folder_id and nav_item.get('_id') == folder_id and nav_item.get('type') == 'folder' and nav_item.get('children'):
                for child in nav_item.get('children'):
                    if child.get('_id') == view_id:
                        nav_item.get('children').remove(child)
                        break
                break

            # delete view not in folders
            if nav_item.get('_id') == view_id:
                navigation.remove(nav_item)
                break

        record.details = json.dumps(view_details)
        record.save()
        return view_details

    def move_view(self, project_uuid, source_view_id, source_folder_id, target_view_id, target_folder_id, is_above_folder):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])

        updated_source_nav_list = []
        dragged_id = None

        # find drag source
        if source_folder_id:
            if source_view_id:
                # drag view from folder
                dragged_id = source_view_id
                source_folder = next((folder for folder in navigation if folder.get('_id') == source_folder_id), None)
                if source_folder:
                    updated_source_nav_list = source_folder.get('children', [])
            else:
                # drag folder
                dragged_id = source_folder_id
                updated_source_nav_list = navigation
        elif source_view_id:
            # drag view not in folders
            dragged_id = source_view_id
            updated_source_nav_list = navigation

        # invalid drag source
        if not dragged_id or not updated_source_nav_list:
            return None
        drag_source = next((nav for nav in updated_source_nav_list if nav.get('_id') == dragged_id), None)
        if not drag_source:
            return None

        # remove drag source from navigation
        updated_source_nav_list.remove(drag_source)

        # find drop target
        updated_target_nav_list = navigation
        if target_folder_id and source_view_id and not is_above_folder:
            target_folder = next((folder for folder in navigation if folder.get('_id') == target_folder_id), None)
            if target_folder:
                updated_target_nav_list = target_folder.get('children', [])

        # drag source already exist
        exist_drag_source = next((nav for nav in updated_target_nav_list if nav.get('_id') == drag_source.get('_id')), None)
        if exist_drag_source:
            return None

        # drop drag source to the target position
        target_nav = None
        if target_view_id:
            # move folder/view above view
            target_nav = next((nav for nav in updated_target_nav_list if nav.get('_id') == target_view_id), None)
        elif target_folder_id:
            # move folder/view above folder
            target_nav = next((nav for nav in updated_target_nav_list if nav.get('_id') == target_folder_id), None)

        insert_index = -1
        if target_nav:
            insert_index = updated_target_nav_list.index(target_nav)

        if insert_index > -1:
            updated_target_nav_list.insert(insert_index, drag_source)
        else:
            updated_target_nav_list.append(drag_source)

        record.details = json.dumps(view_details)
        record.save()
        return view_details


class TicketViews(models.Model):
    project_uuid = models.CharField(max_length=32, db_index=True)
    details = models.TextField()

    objects = TicketViewsManager()

    class Meta:
        db_table = 'ticket_views'

    @property
    def folders_ids(self):
        details = json.loads(self.details)
        navigation = details.get('navigation', [])
        return [folder.get('_id') for folder in navigation if folder.get('type', None) == 'folder']

    @property
    def folders_names(self):
        details = json.loads(self.details)
        navigation = details.get('navigation', [])
        return [folder.get('name') for folder in navigation if folder.get('type', None) == 'folder']

    @property
    def views_ids(self):
        views = json.loads(self.details)['views']
        return [v.get('_id') for v in views]

    @property
    def views_names(self):
        views = json.loads(self.details)['views']
        return [v.get('name') for v in views]

    @property
    def folders_views_ids(self):
        return self.folders_ids + self.views_ids


class TicketsManager(models.Manager):

    def list_tickets_by_view(self, project_uuid, start, end, view_id):
        sorts = []
        view = TicketViews.objects.get_view(project_uuid, view_id)
        basic_filters = view.get('basic_filters', [])
        filters = view.get('filters', [])
        filter_conjunction = view.get('filter_conjunction', 'OR')
        sorts = view.get('sorts', [])

        q = Q(project_uuid=project_uuid) & Q(deleted=False)

        for basic_filter in basic_filters:
            if basic_filter.get('column_key') == 'status':
                value = basic_filter['filter_term']
                if not value:
                    value = ['', 'open', 'completed', 'not_planned', 'duplicate']
                elif 'open' in value:
                    value = value + ['']
                q = q & Q(status__in=value)
            if basic_filter.get('column_key') == 'tags':
                value = basic_filter['filter_term']
                if value:
                    tags = TicketTags.objects.filter(tag_id__in=value)
                    if tags:
                        ticket_ids = [tag.ticket_id for tag in tags]
                        q = q & Q(id__in=ticket_ids)

        if not sorts:
            sorts = [{ 'column_key': 'number', 'sort_type': 'down' }]
        sorts = [f'-{sort["column_key"]}' if sort['sort_type'] == 'down' else sort['column_key'] for sort in sorts]

        return self.filter(q).order_by(', '.join(sorts))[start: end]

    def list_tickets_by_tag(self, project_uuid, tag_id):
        q = Q(project_uuid=project_uuid) & Q(deleted=False)
        tags = TicketTags.objects.filter(tag_id__in=[tag_id])
        if tags:
            ticket_ids = [tag.ticket_id for tag in tags]
            q = q & Q(id__in=ticket_ids)
            return self.filter(q)
        return []

    def list_tickets_by_type(self, project_uuid, type_id):
        return self.filter(project_uuid=project_uuid, type=type_id, deleted=False)

    def list_tickets(self, project_uuid):
        return self.filter(Q(project_uuid=project_uuid) & Q(deleted=False))

    def list_tickets_by_username(self, project_uuid, username, start, end):
        return self.filter(
            project_uuid=project_uuid, creator=username, deleted=False).order_by('-number')[start: end]

    def create_ticket(self, project_uuid, username, title, content, status, type_id=None, ticket_type=None, priority=0):
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
                    type=type_id,
                    priority=priority,
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
    type = models.BigIntegerField(null=True, db_index=True)
    priority = models.SmallIntegerField(default=0)
    reply_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reply_updated_at = models.DateTimeField(null=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    delete_at = models.DateTimeField(null=True)

    objects = TicketsManager()

    class Meta:
        unique_together = (('project_uuid', 'number'),)
        db_table = 'tickets'

    def to_dict(self, tags_dict={}, assignees_dict={}, participants_dict={}, include_deleted=False):
        result = {
            'project_uuid': str(self.project_uuid),
            'number': self.number,
            'title': self.title,
            'content': self.content,
            'participants': [],
            'tags': [],
            'status': self.status,
            'type': self.type,
            'priority': self.priority,
            'reply_count': self.reply_count,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'reply_updated_at': self.reply_updated_at,
            'creator': self.creator,
        }
        if self.id in tags_dict:
            result['tags'] = tags_dict[self.id]
        if self.id in assignees_dict:
            result['assignees'] = assignees_dict[self.id]
        if self.id in participants_dict:
            result['participants'] = participants_dict[self.id]
        if include_deleted:
            result.update({
                'deleted': self.deleted,
                'delete_at': self.delete_at if self.delete_at else '',
            })
        return result

class ChatSessionsManager(models.Manager):
    def create_session(self, project_uuid, session_name, username):
        """Create a new chat session"""
        session_uuid = str(uuid.uuid4())
        session = self.model(
            project_uuid=project_uuid,
            session_uuid=session_uuid,
            username=username,
            session_name=session_name
        )
        session.save()
        return session

    def get_sessions_by_project(self, project_uuid, username):
        """Retrieve all chat sessions of the project"""
        return self.filter(project_uuid=project_uuid, username=username).order_by('-updated_at')

    def get_session_by_uuid(self, session_uuid):
        """According to session_uuid to obtain the session"""
        try:
            return self.get(session_uuid=session_uuid)
        except self.model.DoesNotExist:
            return None


class ChatSessions(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.CharField(max_length=36, db_index=True)
    session_uuid = models.CharField(max_length=36, unique=True, db_index=True)
    username = models.CharField(max_length=255, db_index=True)
    session_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ChatSessionsManager()

    class Meta:
        db_table = 'chat_sessions'

    def to_dict(self):
        return {
            'id': self.id,
            'project_uuid': self.project_uuid,
            'session_uuid': self.session_uuid,
            'username': self.username,
            'session_name': self.session_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class ChatMessagesManager(models.Manager):
    def create_message(self, session_id, username, role, content, sources=''):
        """Create a new chat message"""
        message = self.model(
            session_id=session_id,
            username=username,
            role=role,
            content=content,
            sources=sources
        )
        message.save()
        return message

    def get_messages_by_session(self, session_id):
        """Retrieve all messages of the session"""
        return self.filter(session_id=session_id).order_by('created_at')


class ChatMessages(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]

    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(ChatSessions, on_delete=models.CASCADE, db_index=True)
    username = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField(null=True)
    sources = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ChatMessagesManager()

    class Meta:
        db_table = 'chat_messages'
        indexes = [
            models.Index(fields=['session_id']),
        ]

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'username': self.username,
            'role': self.role,
            'content': self.content,
            'sources': self.sources,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }


class DiscourseForumTopicsRecord(models.Model):
    """ Discourse forum record table"""

    topic_id = models.BigIntegerField()
    title = models.TextField(null=True, blank=True)
    slug = models.TextField(null=True, blank=True)
    views = models.IntegerField(null=True, blank=True)
    category_id = models.IntegerField(null=True, blank=True)
    connection_id = models.CharField(max_length=64)
    bumped_at = models.DateTimeField(null=True, blank=True)
    need_index = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)

    class Meta:
        db_table = 'discourse_topics'

    def to_dict(self):
        return {
            'id': self.id,
            'topic_id': self.topic_id,
            'title': self.title,
            'slug': self.slug,
            'views': self.views,
            'bumped_at': self.bumped_at,
        }


class DiscourseForumRepliesRecord(models.Model):
    """ Discourse forum replies record """

    topic_id = models.BigIntegerField()
    post_number = models.IntegerField()
    content = models.TextField(null=True, blank=True)
    author = models.CharField(max_length=255, null=True, blank=True)
    connection_id = models.CharField(max_length=64)

    class Meta:
        db_table = 'discourse_replies'
        unique_together = [('topic_id', 'post_number', 'connection_id')]

    def to_dict(self):
        return {
            'id': self.id,
            'topic_id': self.topic_id,
            'post_number': self.post_number,
            'content': self.content,
            'author': self.author,
            'connection_id': self.connection_id,
        }


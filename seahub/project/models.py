# -*- coding: utf-8 -*-
from django.core.cache import cache
import logging
import uuid
import json
import copy
import random
import string
from copy import deepcopy
from hashlib import sha1
import hmac

from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from seahub.project.constants import ORG_STORAGE_SIZE_PREFIX, ORG_STORAGE_SIZE_CACHE_TIMEOUT, \
    CONNECTION_FIELDS, TICKET_DEFAULT_DETAILS, CONNECTION_DEFAULT_DETAILS, ConnectionType
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


ENCRYPT_KEYS = ['api_token', 'access_token', 'webhook_secret', 'api_key', 'password']


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

    def search_project_count_in_org(self, org_id, query_str):
        workspace_ids = Workspaces.objects.filter(org_id=org_id).values('id')
        if is_valid_uuid(query_str):
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, uuid=query_str).count()
        else:
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, name__icontains=query_str).count()

    def search_project_in_org(self, org_id, query_str, start, end):
        workspace_ids = Workspaces.objects.filter(org_id=org_id).values('id')
        if is_valid_uuid(query_str):
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, uuid=query_str).order_by('id')[start:end]
        else:
            return super(ProjectsManager, self).filter(
                workspace_id__in=workspace_ids, deleted=False, name__icontains=query_str).order_by('id')[start:end]

    def search_projects_count(self, query_str):
        if is_valid_uuid(query_str):
            return super(ProjectsManager, self).filter(deleted=False, uuid=query_str).count()
        else:
            return super(ProjectsManager, self).filter(deleted=False, name__icontains=query_str).count()

    def search_projects(self, query_str, start, end):
        if is_valid_uuid(query_str):
            return super(ProjectsManager, self).filter(deleted=False, uuid=query_str).order_by('id')[start:end]
        else:
            return super(ProjectsManager, self).filter(deleted=False, name__icontains=query_str).order_by('id')[start:end]

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
    settings = models.TextField(null=True)

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
            'settings': json.loads(self.settings) if self.settings else {},
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
    project_uuid = models.UUIDField(unique=True)

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

    project = models.ForeignKey(Projects, on_delete=models.CASCADE, to_field="uuid", db_column="project_uuid")
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=255)
    config = models.TextField()
    modifier = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_sync_time = models.DateTimeField(null=True)
    status = models.TextField()
    indexed_at = models.DateTimeField(null=True)
    deleted = models.BooleanField(default=False, null=False, db_index=True)
    is_active = models.BooleanField(default=True, null=False, db_index=True)
    last_sync_log = models.TextField(null=True)

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
            'indexed_at': self.indexed_at,
            'last_sync_time': self.last_sync_time,
            'status': self.status,
            'is_active': self.is_active,
        }


class ConnectionsView(object):

    def __init__(self, name, view_type='table', config={}, project_connection_type = ''):
        self.name = name
        self.type = view_type
        self.config = config
        self.details = {}
        self.project_connection_type = project_connection_type

        self.init_view()

    def init_view(self):
        self.details = {
            "_id": generate_views_unique_id(4),
            "table_id": '0000',  # by default
            "name": self.name,
            "filters": [],
            "groupbys": [],
            "filter_conjunction": "Or",
            "hidden_columns": [],
            "type": self.type,
        }
        if self.project_connection_type == ConnectionType.GITHUB_ISSUE.value:
            self.details.update({
                    'basic_filters': [
                        {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': []},
                        {'column_key': 'issue_type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                    ],
                    'sorts': [],
                })
        elif self.project_connection_type == ConnectionType.SITE.value:
            self.details.update({
                    'basic_filters': [],
                    'sorts': [],
                })
        self.details.update(self.config)


class ConnectionsViewsManager(models.Manager):

    def update_init_view_details(self, project_uuid, connection, details):
        connection_type = connection.type
        if connection_type == ConnectionType.GITHUB_ISSUE.value:
            from seahub.project.seadb_api import SeaDBAPI
            from seahub.seadb_models.utils import get_connection_columns
            seadb_api = SeaDBAPI('seaqa-web')
            columns = get_connection_columns(seadb_api, project_uuid, connection)
            views = details.get('views', [])
            for v in views:
                basic_filters = v.get('basic_filters', [])
                for basic_filter in basic_filters:
                    column_key = basic_filter['column_key']

                    # old version column key is status or type
                    if column_key == 'status':
                        column_key = 'state'
                    if column_key == 'type':
                        column_key = 'issue_type'
                    column = next((column for column in columns if column['name'] == column_key), None)
                    if column:
                        column_name = column['name']
                        basic_filter['column_key'] = column['key']
                        if column_name in ['state', 'issue_type']:
                            options = column.get('data', {}).get('options', [])
                            filter_term = basic_filter.get('filter_term', [])
                            new_filter_term = []
                            for option_name in filter_term:
                                option = next((option for option in options if option['name'] == option_name), None)
                                if option:
                                    new_filter_term.append(option['id'])
                            basic_filter['filter_term'] = new_filter_term
                v['basic_filters'] = basic_filters

                sorts = v.get('sorts', [])
                for item in sorts:
                    column_key = item['column_key']
                    column = next((column for column in columns if column['name'] == column_key), None)
                    if column:
                        item['column_key'] = column['key']
                v['sorts'] = sorts

            details['views'] = views
        return details


    def get_record(self, project_uuid, connection):
        """
            get record from database, if not record, create it
        """
        project_uuid = uuid_str_to_32_chars(project_uuid)
        connection_id = connection.id
        connection_type = connection.type

        record = self.filter(connection_id=connection_id).first()

        if not record:
            details = CONNECTION_DEFAULT_DETAILS[connection_type]
            details = self.update_init_view_details(project_uuid, connection, details)
            record = self.create(
                project_uuid=project_uuid,
                connection_id=connection_id,
                details=json.dumps(details)
            )
        return record

    # view op
    def list_views(self, project_uuid, connection):
        record = self.get_record(project_uuid, connection)
        return json.loads(record.details)

    def get_view(self, project_uuid, connection, view_id):
        record = self.get_record(project_uuid, connection)
        view_details = json.loads(record.details)
        for view in view_details['views']:
            if view.get('_id') == view_id:
                return view
        return None

    def add_view(self, project_uuid, connection, view_name, view_type='table', view_data={}):
        record = self.get_record(project_uuid, connection)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        view_name = get_no_duplicate_obj_name(view_name, record.views_names)

        connection_type = connection.type
        new_view = ConnectionsView(view_name, view_type, view_data, connection_type)
        details = new_view.details
        view_id = details.get('_id')
        view_details['views'].append(details)
        new_view_nav = { '_id': view_id, 'type': 'view' }
        navigation.append(new_view_nav)
        view_details = self.update_init_view_details(project_uuid, connection, view_details)
        record.details = json.dumps(view_details)
        record.save()
        return new_view.details

    def update_view(self, view_id, view_dict, record):
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

    def duplicate_view(self, view_id, record):
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

    def delete_view(self, view_id, record):
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

    def move_view(self, record, source_view_id, source_folder_id, target_view_id, target_folder_id, is_above_folder):
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
    project_uuid = models.UUIDField(db_index=True)
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
                {'column_key': 'type', 'filter_predicate': 'is_any_of', 'filter_term': []},
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

    def update_init_view_details(self, project_uuid, details):
        from seahub.project.seadb_api import SeaDBAPI
        from seahub.seadb_models.utils import get_tickets_columns
        seadb_api = SeaDBAPI('seaqa-web')
        columns = get_tickets_columns(seadb_api, project_uuid)
        views = details.get('views', [])
        for v in views:
            basic_filters = v.get('basic_filters', [])
            for basic_filter in basic_filters:
                column_key = basic_filter['column_key']

                column = next((column for column in columns if column['name'] == column_key), None)
                if column:
                    column_name = column['name']
                    basic_filter['column_key'] = column['key']
                    if column_name in ['status', 'type', 'tags']:
                        data = column.get('data', {})
                        if data:
                            options = data.get('options', [])
                            filter_term = basic_filter.get('filter_term', [])
                            new_filter_term = []
                            for option_name in filter_term:
                                option = next((option for option in options if option['name'] == option_name), None)
                                if option:
                                    new_filter_term.append(option['id'])
                            basic_filter['filter_term'] = new_filter_term
            v['basic_filters'] = basic_filters

            sorts = v.get('sorts', [])
            for item in sorts:
                column_key = item['column_key']
                column = next((column for column in columns if column['name'] == column_key), None)
                if column:
                    item['column_key'] = column['key']
            v['sorts'] = sorts
            details['views'] = views
        return details

    def get_record(self, project_uuid):
        """
            get record from database, if not record, create it
        """
        project_uuid = uuid_str_to_32_chars(project_uuid)
        record = self.filter(project_uuid=project_uuid).first()
        if not record:
            details = self.update_init_view_details(project_uuid, TICKET_DEFAULT_DETAILS)
            record = self.create(
                project_uuid=project_uuid,
                details=json.dumps(details)
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
        view_details = self.update_init_view_details(project_uuid, view_details)
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

    def duplicate_view(self, view_id, record, folder_id=None):
        view_details = json.loads(record.details)
        exist_folders_views_ids = record.folders_views_ids
        new_view_id = generate_views_unique_id(4, exist_folders_views_ids)
        duplicate_view = next((copy.deepcopy(view) for view in view_details['views'] if view.get('_id') == view_id), None)
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
    project_uuid = models.UUIDField(db_index=True)
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

class ChatToolCallsManager(models.Manager):
    pass

class ChatToolCalls(models.Model):
    id = models.BigAutoField(primary_key=True)
    session_uuid = models.CharField(max_length=36, null=False, db_index=True)
    message_id = models.CharField(max_length=4, null=False)
    tool_calls = models.TextField()

    objects = ChatToolCallsManager()

    class Meta:
        db_table = 'chat_tool_calls'
        constraints = [
            models.UniqueConstraint(
                fields=['session_uuid', 'message_id'],
                name='uniq_session_uuid_message_id'
            )
        ]

    def to_dict(self):
        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'tool_calls': json.loads(self.tool_calls),
        }

class ChatMessagesManager(models.Manager):
    def create_message(self, session_uuid, message_id, username, role, content, is_agent_mode, sources=''):
        """Create a new chat message"""
        message = self.model(
            session_uuid=session_uuid,
            message_id=message_id,
            username=username,
            role=role,
            content=content,
            sources=sources,
            is_agent_mode=is_agent_mode
        )
        message.save()
        return message

    def get_messages_by_session(self, session_uuid):
        """Retrieve all messages of the session"""
        return self.filter(session_uuid=session_uuid).order_by('created_at')


class ChatMessages(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]

    id = models.BigAutoField(primary_key=True)
    session_uuid = models.CharField(max_length=36, null=False, db_index=True)
    message_id = models.CharField(max_length=4, null=False)
    username = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField(null=True)
    sources = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_agent_mode = models.BooleanField()

    objects = ChatMessagesManager()

    class Meta:
        db_table = 'chat_messages'
        constraints = [
            models.Index(
                fields=['session_uuid', 'message_id'],
                name='idx_session_uuid_message_id'
            )
        ]

    def to_dict(self):
        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'username': self.username,
            'role': self.role,
            'content': self.content,
            'sources': self.sources,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'is_agent_mode': self.is_agent_mode
        }


PERMISSION_READ = 'r'
PERMISSION_READ_WRITE = 'rw'
API_TOKEN_PERMISSION_TUPLE = (
    PERMISSION_READ,
    PERMISSION_READ_WRITE,
)

class ProjectAPITokenManager(models.Manager):
    def add(self, project, app_name, username, permission):
        api_token_obj = self.model(
            project=project,
            app_name=app_name,
            generated_by=username,
            permission=permission
        )
        api_token_obj.token = self.generate_key()
        api_token_obj.save()
        return api_token_obj

    def generate_key(self):
        unique = str(uuid.uuid4())
        return hmac.new(unique.encode('utf-8'), digestmod=sha1).hexdigest()

    def get_by_token(self, token):
        try:
            api_token_obj = self.get(token=token)
            api_token_obj.update_last_access()
            return api_token_obj
        except self.model.DoesNotExist:
            return None

    def get_by_project_and_app_name(self, project, app_name):
        """Check if API token already exists for project and app"""
        try:
            return self.get(project=project, app_name=app_name)
        except self.model.DoesNotExist:
            return None

    def list_by_project(self, project):
        return self.filter(project=project).order_by('-generated_at')


class ProjectAPIToken(models.Model):
    project = models.ForeignKey(Projects, on_delete=models.CASCADE, to_field="uuid", db_column="project_uuid")
    app_name = models.CharField(max_length=255)
    token = models.CharField(max_length=255, unique=True, db_index=True)
    generated_by = models.CharField(max_length=255)
    generated_at = models.DateTimeField(auto_now_add=True)
    last_access = models.DateTimeField(auto_now=True)
    permission = models.CharField(max_length=15)

    objects = ProjectAPITokenManager()

    class Meta:
        db_table = 'project_api_token'
        unique_together = ('project', 'app_name')

    def update_last_access(self):
        self.last_access = timezone.now()
        self.save(update_fields=['last_access'])

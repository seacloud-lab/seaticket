# -*- coding: utf-8 -*-
import logging
import json
import copy
import string
import random

from django.db import models
from seahub.utils import get_no_duplicate_obj_name, uuid_str_to_32_chars


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


class KnowledgeBaseView(object):

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
            "filters": [],
            "groupbys": [],
            "filter_conjunction": "Or",
            "hidden_columns": [],
            "type": self.type,
        }


class KnowledgeBaseViewsManager(models.Manager):

    def update_init_view_details(self, project_uuid, details):
        from seahub.project.seadb_api import SeaDBAPI
        from seahub.seadb_models.utils import get_seadb_table_columns
        from seahub.seadb_models.models import SchemaTables
        seadb_api = SeaDBAPI()
        columns = get_seadb_table_columns(seadb_api, project_uuid, SchemaTables.KNOWLEDGE_BASE.table_name())
        views = details.get('views', [])
        for v in views:
            sorts = v.get('sorts', [])
            for item in sorts:
                column_key = item.get('column_key', '')
                if column_key:
                    column = next((col for col in columns if col['name'] == column_key), None)
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
            from django.utils.translation import gettext as _
            details = {
                'views': [
                    {
                        '_id': '0000',
                        'name': _('All'),
                        'type': 'table',
                        'basic_filters': [],
                        'columns_keys': [],
                        'filter_conjunction': 'Or',
                        'filters': [],
                        'sorts': [{ 'column_key': 'modified_time', 'sort_type': 'down' }],
                        'groupbys': [],
                        'hidden_columns': [],
                    }
                ],
                'navigation': [
                    {'_id': '0000', 'type': 'view'},
                ]
            }
            details = self.update_init_view_details(project_uuid, details)
            record = self.create(
                project_uuid=project_uuid,
                details=json.dumps(details)
            )
        return record

    # view op
    def list_views(self, project_uuid):
        record = self.get_record(project_uuid)
        return json.loads(record.details)

    def get_view(self, project_uuid, view_id):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        for view in view_details['views']:
            if view.get('_id') == view_id:
                return view
        return None

    def add_view(self, project_uuid, view_name, view_type='table', view_data={}):
        record = self.get_record(project_uuid)
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])
        view_name = get_no_duplicate_obj_name(view_name, record.views_names)

        new_view = KnowledgeBaseView(view_name, view_type, view_data)
        details = new_view.details
        view_id = details.get('_id')
        view_details['views'].append(details)
        new_view_nav = { '_id': view_id, 'type': 'view' }
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

    def move_view(self, record, source_view_id, target_view_id):
        view_details = json.loads(record.details)
        navigation = view_details.get('navigation', [])

        if not source_view_id:
            return None

        if target_view_id and target_view_id == source_view_id:
            return view_details

        drag_source = next((nav for nav in navigation if nav.get('_id') == source_view_id), None)
        if not drag_source:
            return None

        navigation.remove(drag_source)

        insert_index = -1
        if target_view_id:
            target_nav = next((nav for nav in navigation if nav.get('_id') == target_view_id), None)
            if target_nav:
                insert_index = navigation.index(target_nav)

        if insert_index > -1:
            navigation.insert(insert_index, drag_source)
        else:
            navigation.append(drag_source)

        record.details = json.dumps(view_details)
        record.save()
        return view_details


class KnowledgeBaseViews(models.Model):
    project_uuid = models.UUIDField(db_index=True)
    details = models.TextField()

    objects = KnowledgeBaseViewsManager()

    class Meta:
        db_table = 'knowledge_base_views'

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

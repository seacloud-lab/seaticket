import logging
import json
import copy
import random
import string
from django.db import models
from copy import deepcopy

from seahub.project.constants import TICKET_DEFAULT_DETAILS
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
                {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
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
        seadb_api = SeaDBAPI()
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
                    if column_name in ['state', 'type', 'tags']:
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
            details = self.update_init_view_details(project_uuid, deepcopy(TICKET_DEFAULT_DETAILS))
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
            folder_children = folder.get('children', [])
            folder_children.append(new_view_nav)
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
            folder_children = folder.get('children', [])
            folder_children.append(new_view_nav)
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

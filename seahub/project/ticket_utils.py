import random
from copy import deepcopy
from datetime import datetime
from django.utils import timezone

from dateutil.relativedelta import relativedelta
from seahub.seadb_models.models import PropertyTypes

TABLE_TICKETS = 'tickets'
TABLE_TICKET_REPLIES = 'ticket_replies'

def time_str_to_utc_time(time_str):
    if time_str.endswith('Z'):
        # python 3.12 can convert but 3.10 not support
        time_str = time_str[:-1] + '+00:00'
    dt = datetime.fromisoformat(time_str)
    return dt.astimezone(timezone.utc)


def generator_base64_code(length=4):
    possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789'
    ids = random.sample(possible, length)
    return ''.join(ids)

def gen_unique_id(id_set, length=4):
    _id = generator_base64_code(length)

    while True:
        if _id not in id_set:
            return _id
        _id = generator_base64_code(length)


def check_ticket_creation_interval(seadb_api, project_uuid, username, deleted=False):
    """Limit ticket creation to once every 30 seconds per creator."""
    previous_ticket_sql = (
        f"SELECT * FROM `{TABLE_TICKETS}` WHERE `creator` = '{username}' "
        f"AND `deleted` = {deleted} ORDER BY _pk DESC LIMIT 1"
    )
    previous_ticket = seadb_api.query_rows(project_uuid, previous_ticket_sql).get('results')

    if previous_ticket:
        created_at = previous_ticket[0].get('created_at')
        created_at = time_str_to_utc_time(created_at) if created_at else None
        if created_at and created_at > timezone.now() - relativedelta(seconds=30):
            return False

    return True

def check_ticket_reply_creation_interval(seadb_api, project_uuid, username, ticket_id, deleted=False):
    """Limit ticket reply creation to once every 30 seconds per creator per ticket."""
    previous_ticket_reply_sql = (
        f"SELECT * FROM `{TABLE_TICKET_REPLIES}` WHERE `creator` = '{username}' "
        f"AND `ticket_id` = {ticket_id} AND `deleted` = {deleted} "
        f"ORDER BY `_pk` DESC LIMIT 1"
    )
    previous_ticket_reply = seadb_api.query_rows(project_uuid, previous_ticket_reply_sql).get('results')

    if previous_ticket_reply:
        created_at = previous_ticket_reply[0].get('created_at')
        created_at = time_str_to_utc_time(created_at) if created_at else None
        if created_at and created_at > timezone.now() - relativedelta(seconds=30):
            return False

    return True


def get_table_by_name(seadb_api, project_uuid, table_name):
    """Fetch a table metadata by its name from SeaDB base metadata."""
    tables = seadb_api.get_base_metadata(project_uuid).get('tables')
    for table in tables or []:
        if table.get('name') == table_name:
            return table
    return None

def get_ticket(seadb_api, project_uuid, ticket_number):
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `_pk` = {ticket_number}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None


def get_tickets(seadb_api, project_uuid):
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `deleted` = False"
    tickets_data = seadb_api.query_rows(project_uuid, sql).get('results')
    return tickets_data

def filter_tickets_by_type(seadb_api, project_uuid, types):
    if not types:
        return []
    types_names = []
    for type_id in types:
        type_option = get_type_option_by_id(seadb_api, project_uuid, type_id)
        types_names.append(type_option.get('name'))
    types_str = ', '.join(f"'{type_name}'" for type_name in types_names)
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `type` IN ({types_str}) AND `deleted` = False"
    ticket_data = seadb_api.query_rows(project_uuid, sql).get('results')
    return ticket_data


def get_ticket_replies(seadb_api, project_uuid, ticket_number, start, end):
    ticket_replies_sql = f"SELECT * FROM `{TABLE_TICKET_REPLIES}` WHERE `ticket_id` = {ticket_number} AND `deleted` = False ORDER BY `_pk` ASC LIMIT {start}, {end}"
    ticket_replies_data = seadb_api.query_rows(project_uuid, ticket_replies_sql).get('results')
    return ticket_replies_data

def get_tickets_table(seadb_api, project_uuid):
    return get_table_by_name(seadb_api, project_uuid, TABLE_TICKETS)

def get_ticket_reply_by_pk(seadb_api, project_uuid, ticket_number, ticket_reply_number):
    sql = f"SELECT * FROM `{TABLE_TICKET_REPLIES}` WHERE `ticket_id` = {ticket_number} AND `_pk` = {ticket_reply_number}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None

def _get_column_by_name(table_meta, column_name):
    for column in (table_meta or {}).get('columns', []):
        if column.get('name') == column_name:
            return column, column.get('key')
    return None, None


def _get_select_column_options(seadb_api, project_uuid, table_name, column_name):
    table_meta = get_table_by_name(seadb_api, project_uuid, table_name)
    if not table_meta:
        return [], None
    column, column_key = _get_column_by_name(table_meta, column_name)
    if not column:
        return [], None
    column_data = column.get('data') or {}
    options = column_data.get('options', []) or []
    return options, column_key

def get_column_key_by_name(seadb_api, project_uuid, table_name, column_name):
    table_meta = get_table_by_name(seadb_api, project_uuid, table_name)
    if not table_meta:
        return None
    column, column_key = _get_column_by_name(table_meta, column_name)
    if not column:
        return None
    return column_key

### status
def get_status_column(seadb_api, project_uuid):
    options, column_key = _get_select_column_options(seadb_api, project_uuid, TABLE_TICKETS, 'status')
    return options, column_key

def get_status_option_by_id(seadb_api, project_uuid, status_id):
    status_options, _ = get_status_column(seadb_api, project_uuid)
    for status_option in status_options:
        if status_option.get('id') == status_id:
            return status_option
    return None

def get_status_option_by_name(seadb_api, project_uuid, status_name):
    status_options, _ = get_status_column(seadb_api, project_uuid)
    for status_option in status_options:
        if status_option.get('name') == status_name:
            return status_option
    return None

### type
def get_type_column(seadb_api, project_uuid):
    options, column_key = _get_select_column_options(seadb_api, project_uuid, TABLE_TICKETS, 'type')
    return options, column_key


def get_type_option_by_id(seadb_api, project_uuid, type_id):
    type_options, _ = get_type_column(seadb_api, project_uuid)
    for type_option in type_options:
        if type_option.get('id') == type_id:
            return type_option
    return None


def get_type_option_by_name(seadb_api, project_uuid, type_name):
    type_options, _ = get_type_column(seadb_api, project_uuid)
    for type_option in type_options:
        if type_option.get('name') == type_name:
            return type_option
    return None


def update_type_option(seadb_api, project_uuid, type_id, update_data):
    type_options, column_key = get_type_column(seadb_api, project_uuid)
    if not column_key:
        return None

    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table:
        return None
    
    option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_id': type_id,
        'update_option_data': update_data,
    }

    for type_option in type_options:
        if type_option.get('id') == type_id:
            if update_data.get('name') != type_option.get('name'):
                option_data['new_option_name'] = update_data.pop('name')
            break
    res = seadb_api.update_column_option(project_uuid, option_data)
    return res.get('success')


def delete_type_option(seadb_api, project_uuid, type_id):
    _, column_key = get_type_column(seadb_api, project_uuid)
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table or not column_key:
        return None
    option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_id': type_id,
    }
    res = seadb_api.delete_column_option(project_uuid, option_data)
    return res.get('success')


def add_type_option(seadb_api, project_uuid, name, color, text_color):
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table:
        return None
    table_id = tickets_table.get('id')
    _, column_key = get_type_column(seadb_api, project_uuid)
    if not column_key:
        return None

    new_option_data = {
        'table_id': table_id,
        'column_key': column_key,
        'option_name': name,
        'option_data': {
            'color': color,
            'text_color': text_color,
        },
    }
    res = seadb_api.add_column_option(project_uuid, new_option_data)
    option_id = res.get('option_id')
    return {
        'id': option_id,
        'name': name,
        'color': color,
        'text_color': text_color,
    }


def update_ticket_type(seadb_api, project_uuid, ticket_id_map):
    """Batch update ticket type (by name)."""
    for ticket_number, type_id in ticket_id_map.items():
        update_data = {
            'pk': ticket_number,
            'row': {'type': type_id},
        }
        seadb_api.update_rows(project_uuid, TABLE_TICKETS, [update_data])


### tags
def get_tags_column(seadb_api, project_uuid):
    options, column_key = _get_select_column_options(seadb_api, project_uuid, TABLE_TICKETS, 'tags')
    return options, column_key


def get_tag_option_by_id(seadb_api, project_uuid, tag_id):
    tag_options, _ = get_tags_column(seadb_api, project_uuid)
    for tag_option in tag_options:
        if tag_option.get('id') == tag_id:
            return tag_option
    return None


def get_tag_ids_by_names(seadb_api, project_uuid, tag_names):
    tag_options, _ = get_tags_column(seadb_api, project_uuid)
    tag_ids = []
    for tag_option in tag_options:
        if tag_option.get('name') in tag_names:
            tag_ids.append(tag_option.get('id'))
    return tag_ids


def update_ticket_tags(seadb_api, project_uuid, ticket_id_map):
    """Batch update ticket tags (by names list)."""
    updates = []
    for ticket_number, tag_ids in ticket_id_map.items():
        updates.append({'pk': ticket_number, 'row': {'tags': tag_ids}})
    if updates:
        seadb_api.update_rows(project_uuid, TABLE_TICKETS, updates)


def add_tag_option(seadb_api, project_uuid, name, color, text_color, description=''):
    """Add a tag option to 'tags' column."""
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table:
        return None
    table_id = tickets_table.get('id')
    _, tags_column_key = get_tags_column(seadb_api, project_uuid)
    if not tags_column_key:
        return None

    new_option_data = {
        'table_id': table_id,
        'column_key': tags_column_key,
        'option_name': name,
        'option_data': {
            'color': color,
            'text_color': text_color,
            'description': description,
        },
    }
    res = seadb_api.add_column_option(project_uuid, new_option_data)
    option_id = res.get('option_id')

    return {
        'id': option_id,
        'name': name,
        'description': description,
        'color': color,
        'text_color': text_color,
    }


def update_tag_option(seadb_api, project_uuid, tag_id, update_data):
    tag_options, column_key = get_tags_column(seadb_api, project_uuid)
    if not column_key:
        return None
    
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table:
        return None
    
    old_tag_name = None
    for tag_option in tag_options:
        if tag_option.get('id') == tag_id:
            if update_data.get('name'):
                old_tag_name = tag_option.pop('name')
            break
    
    option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_id': tag_id,
        'update_option_data': update_data,
    }
    if update_data.get('name') != old_tag_name:
        option_data['new_option_name'] = update_data.get('name')
    res = seadb_api.update_column_option(project_uuid, option_data)
    return res.get('success')


def delete_tag_option(seadb_api, project_uuid, tag_id):
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table:
        return None
    _, column_key = get_tags_column(seadb_api, project_uuid)
    if not column_key:
        return None
    option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_id': tag_id,
    }
    res = seadb_api.delete_column_option(project_uuid, option_data)
    return res.get('success')


def get_ticket_counts_group_by_tag(seadb_api, project_uuid):
    sql = (
        "SELECT tags, COUNT(*) AS count "
        "FROM `tickets` "
        "WHERE `deleted` = False "
        "GROUP BY tags"
    )
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results') or []
    return {row.get('tags')[0]: row.get('count') for row in rows if row.get('tags')}

def get_ticket_counts_group_by_type(seadb_api, project_uuid):
    sql = (
        "SELECT type, COUNT(*) AS count "
        "FROM `tickets` "
        "WHERE `deleted` = False "
        "GROUP BY type"
    )
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results') or []
    return {row.get('type'): row.get('count') for row in rows if row.get('type')}

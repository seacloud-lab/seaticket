import random
from datetime import datetime
from django.contrib.admin import display
from django.utils import timezone

from dateutil.relativedelta import relativedelta
from seahub.project.constants import TICKET_DISPLAY_ALL_COLUMNS

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

def get_ticket(seadb_api, project_uuid, ticket_id):
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `_pk` = {ticket_id}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None


def get_tickets(seadb_api, project_uuid):
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `deleted` = False"
    tickets_data = seadb_api.query_rows(project_uuid, sql).get('results')
    return tickets_data

def filter_tickets_by_type(seadb_api, project_uuid, types):
    return filter_tickets_by_select(seadb_api, project_uuid, 'type', types)

def get_ticket_replies(seadb_api, project_uuid, ticket_id, start, end):
    ticket_replies_sql = f"SELECT * FROM `{TABLE_TICKET_REPLIES}` WHERE `ticket_id` = {ticket_id} AND `deleted` = False ORDER BY `_pk` ASC LIMIT {start}, {end}"
    ticket_replies_data = seadb_api.query_rows(project_uuid, ticket_replies_sql).get('results')
    return ticket_replies_data

def get_tickets_table(seadb_api, project_uuid):
    return get_table_by_name(seadb_api, project_uuid, TABLE_TICKETS)

def get_ticket_reply_by_pk(seadb_api, project_uuid, ticket_id, ticket_reply_number):
    sql = f"SELECT * FROM `{TABLE_TICKET_REPLIES}` WHERE `ticket_id` = {ticket_id} AND `_pk` = {ticket_reply_number}"
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
    cascade_settings = column_data.get('cascade_settings')
    return options, column_key, cascade_settings

def get_column_by_name(seadb_api, project_uuid, table_name, column_name):
    table_meta = get_table_by_name(seadb_api, project_uuid, table_name)
    if not table_meta:
        return None, None
    column, column_key = _get_column_by_name(table_meta, column_name)
    if not column:
        return None, None
    return column, column_key

# universal select column
def _get_tickets_select_column(seadb_api, project_uuid, column_name):
    """Return (options, column_key, cascade_settings) for a select-like column on tickets table."""
    return _get_select_column_options(seadb_api, project_uuid, TABLE_TICKETS, column_name)

def get_select_column(seadb_api, project_uuid, column_name):
    """Return (options, column_key) for a select-like column on tickets table."""
    options, column_key, _ = _get_tickets_select_column(seadb_api, project_uuid, column_name)
    return options, column_key

def get_select_option_by_id(seadb_api, project_uuid, column_name, option_id):
    options, _ = get_select_column(seadb_api, project_uuid, column_name)
    for opt in options:
        if opt.get('id') == option_id:
            return opt
    return None

def get_select_option_by_name(seadb_api, project_uuid, column_name, option_name):
    options, _ = get_select_column(seadb_api, project_uuid, column_name)
    for opt in options:
        if opt.get('name') == option_name:
            return opt
    return None

def add_select_option(seadb_api, project_uuid, column_name, name, option_data):
    """Add an option to a select-like column; option_data is dict stored in option_data."""
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table:
        return None
    options, column_key = get_select_column(seadb_api, project_uuid, column_name)
    if not column_key:
        return None

    new_option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_name': name,
        'option_data': option_data or {},
    }
    res = seadb_api.add_column_option(project_uuid, new_option_data)
    option_id = res.get('option_id')
    # Return merged visible structure
    result = {'id': option_id, 'name': name}
    if option_data:
        result.update(option_data)
    return result

def update_select_option(seadb_api, project_uuid, column_name, option_id, update_data):
    options, column_key = get_select_column(seadb_api, project_uuid, column_name)
    if not column_key:
        return None

    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table:
        return None

    payload = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_id': option_id,
        'update_option_data': update_data or {},
    }

    # handle rename separately per API contract
    for opt in options:
        if opt.get('id') == option_id:
            if update_data and update_data.get('name') is not None and update_data.get('name') != opt.get('name'):
                payload['new_option_name'] = update_data.pop('name')
            break
    res = seadb_api.update_column_option(project_uuid, payload)
    return res.get('success')

def delete_select_option(seadb_api, project_uuid, column_name, option_id):
    options, column_key = get_select_column(seadb_api, project_uuid, column_name)
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table or not column_key:
        return None
    option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_id': option_id,
    }
    res = seadb_api.delete_column_option(project_uuid, option_data)
    return res.get('success')

def batch_delete_select_option(seadb_api, project_uuid, column_name, option_ids):
    options, column_key = get_select_column(seadb_api, project_uuid, column_name)
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table or not column_key:
        return None
    option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_ids': option_ids,
    }
    res = seadb_api.delete_column_option(project_uuid, option_data)
    return res.get('success')

def get_ticket_counts_group_by_column_name(seadb_api, project_uuid, column_name):
    sql = (
        f"SELECT {column_name}, COUNT(*) AS count "
        f"FROM `{TABLE_TICKETS}` "
        "WHERE `deleted` = False "
        f"GROUP BY {column_name}"
    )
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results') or []
    # tags is array; others are scalar strings
    if column_name == 'tags':
        return {row.get('tags')[0]: row.get('count') for row in rows if row.get('tags')}
    return {row.get(column_name): row.get('count') for row in rows if row.get(column_name)}

def filter_tickets_by_select(seadb_api, project_uuid, column_name, option_ids):
    if not option_ids:
        return []
    # map ids to names
    names = []
    for oid in option_ids:
        opt = get_select_option_by_id(seadb_api, project_uuid, column_name, oid)
        if opt:
            names.append(opt.get('name'))
    names_str = ', '.join(f"'{n}'" for n in names)
    display_columns_join = ', '.join(TICKET_DISPLAY_ALL_COLUMNS)
    sql = (
        f"SELECT {display_columns_join} FROM `{TABLE_TICKETS}` "
        f"WHERE `{column_name}` IN ({names_str}) AND `deleted` = False"
    )
    res = seadb_api.query_rows(project_uuid, sql)
    tickets = res.get('results')
    columns = res.get('metadata') or []
    return tickets, columns

### status
def get_status_column(seadb_api, project_uuid):
    options, column_key, _ = _get_select_column_options(seadb_api, project_uuid, TABLE_TICKETS, 'status')
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
    options, column_key = get_select_column(seadb_api, project_uuid, 'type')
    return options, column_key


def get_type_option_by_id(seadb_api, project_uuid, type_id):
    return get_select_option_by_id(seadb_api, project_uuid, 'type', type_id)


def get_type_option_by_name(seadb_api, project_uuid, type_name):
    return get_select_option_by_name(seadb_api, project_uuid, 'type', type_name)


def update_type_option(seadb_api, project_uuid, type_id, update_data):
    return update_select_option(seadb_api, project_uuid, 'type', type_id, update_data)

def add_type_option(seadb_api, project_uuid, name, color, text_color):
    return add_select_option(
        seadb_api,
        project_uuid,
        'type',
        name,
        {'color': color, 'text_color': text_color},
    )


def update_ticket_type(seadb_api, project_uuid, ticket_id_map):
    for ticket_id, type_id in ticket_id_map.items():
        update_data = {
            'pk': ticket_id,
            'row': {'type': type_id},
        }
        seadb_api.update_rows(project_uuid, TABLE_TICKETS, [update_data])


### tags
def get_tags_column(seadb_api, project_uuid):
    options, column_key = get_select_column(seadb_api, project_uuid, 'tags')
    return options, column_key


def get_tag_option_by_id(seadb_api, project_uuid, tag_id):
    return get_select_option_by_id(seadb_api, project_uuid, 'tags', tag_id)


def get_tag_ids_by_names(seadb_api, project_uuid, tag_names):
    tag_options, _ = get_tags_column(seadb_api, project_uuid)
    tag_ids = []
    for tag_option in tag_options:
        if tag_option.get('name') in tag_names:
            tag_ids.append(tag_option.get('id'))
    return tag_ids


def update_ticket_tags(seadb_api, project_uuid, ticket_id_map):
    updates = []
    for ticket_id, tag_ids in ticket_id_map.items():
        updates.append({'pk': ticket_id, 'row': {'tags': tag_ids}})
    if updates:
        seadb_api.update_rows(project_uuid, TABLE_TICKETS, updates)


def add_tag_option(seadb_api, project_uuid, name, color, text_color, description=''):
    return add_select_option(
        seadb_api,
        project_uuid,
        'tags',
        name,
        {'color': color, 'text_color': text_color, 'description': description or ''},
    )

def update_tag_option(seadb_api, project_uuid, tag_id, update_data):
    return update_select_option(seadb_api, project_uuid, 'tags', tag_id, update_data)

def filter_tickets_by_tag(seadb_api, project_uuid, tag_id):
    return filter_tickets_by_select(seadb_api, project_uuid, 'tags', [tag_id])


### substate
def get_substate_column(seadb_api, project_uuid):
    options, column_key, _ = _get_select_column_options(seadb_api, project_uuid, TABLE_TICKETS, 'substate')
    return options, column_key

def get_substate_column_details(seadb_api, project_uuid):
    column, column_key = get_column_by_name(seadb_api, project_uuid, TABLE_TICKETS, 'substate')
    if not column:
        return [], None, {}
    data = (column.get('data') or {})
    options = data.get('options', []) or []
    return options, column_key, data

def get_substate_option_by_id(seadb_api, project_uuid, substate_id):
    return get_select_option_by_id(seadb_api, project_uuid, 'substate', substate_id)

def get_substate_option_by_name(seadb_api, project_uuid, substate_name):
    return get_select_option_by_name(seadb_api, project_uuid, 'substate', substate_name)

def add_substate_option(seadb_api, project_uuid, name, color, text_color):
    return add_select_option(
        seadb_api,
        project_uuid,
        'substate',
        name,
        {'color': color, 'text_color': text_color},
    )

def update_substate_option(seadb_api, project_uuid, substate_id, update_data):
    return update_select_option(seadb_api, project_uuid, 'substate', substate_id, update_data)

def delete_substate_option(seadb_api, project_uuid, substate_id):
    substate_options, column_key, data = get_substate_column_details(seadb_api, project_uuid)
    tickets_table = get_tickets_table(seadb_api, project_uuid)
    if not tickets_table or not column_key:
        return None
    option_data = {
        'table_id': tickets_table.get('id'),
        'column_key': column_key,
        'option_id': substate_id,
    }
    res = seadb_api.delete_column_option(project_uuid, option_data)
    # delete substate id in cascade settings
    cascade_settings = data.get('cascade_settings')
    if cascade_settings:
        for status_id, substate_ids in cascade_settings.items():
            if substate_id in substate_ids:
                substate_ids.remove(substate_id)
            column_data = {
                'table_id': tickets_table.get('id'),
                'column_key': column_key,
                'update_column_data': {
                    'cascade_settings': cascade_settings,
                },
            }
            seadb_api.update_column(project_uuid, column_data)
    return res.get('success')

def filter_tickets_by_substate(seadb_api, project_uuid, substate_ids):
    return filter_tickets_by_select(seadb_api, project_uuid, 'substate', substate_ids)

def get_substate_options_by_status_option_id(seadb_api, project_uuid, status_id):
    options, column_key, data = get_substate_column_details(seadb_api, project_uuid)
    cascade_settings = (data or {}).get('cascade_settings') or {}
    if not cascade_settings:
        return options
    allowed_ids = set(cascade_settings.get(status_id, []))
    return [opt for opt in (options or []) if opt.get('id') in allowed_ids]

# format tickets
def convert_ticket_select_column_name_to_option_id(seadb_api, project_uuid, ticket):
    """In-place convert ticket fields from names to ids for status/type/tags/substate."""
    if not ticket:
        return ticket
    if ticket.get('status'):
        option = get_status_option_by_name(seadb_api, project_uuid, ticket.get('status'))
        if option:
            ticket['status'] = option.get('id')
    if ticket.get('type'):
        option = get_type_option_by_name(seadb_api, project_uuid, ticket.get('type'))
        if option:
            ticket['type'] = option.get('id')
    if ticket.get('tags'):
        ticket['tags'] = get_tag_ids_by_names(seadb_api, project_uuid, ticket.get('tags'))
    if ticket.get('substate'):
        option = get_substate_option_by_name(seadb_api, project_uuid, ticket.get('substate'))
        if option:
            ticket['substate'] = option.get('id')
    return ticket

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


def get_ticket(seadb_api, project_uuid, ticket_id):
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `_pk` = {ticket_id}"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    return rows[0] if rows else None, res.get('metadata')


def get_tickets(seadb_api, project_uuid):
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `deleted` = False"
    tickets_data = seadb_api.query_rows(project_uuid, sql).get('results')
    return tickets_data


def get_ticket_replies(seadb_api, project_uuid, ticket_id, start, end):
    ticket_replies_sql = f"SELECT * FROM `{TABLE_TICKET_REPLIES}` WHERE `ticket_id` = {ticket_id} AND `deleted` = False ORDER BY `_pk` ASC LIMIT {start}, {end}"
    ticket_replies_data = seadb_api.query_rows(project_uuid, ticket_replies_sql).get('results')
    return ticket_replies_data


def get_ticket_reply_by_pk(seadb_api, project_uuid, ticket_id, ticket_reply_number):
    sql = f"SELECT * FROM `{TABLE_TICKET_REPLIES}` WHERE `ticket_id` = {ticket_id} AND `_pk` = {ticket_reply_number}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None


def get_column_from_columns_by_name(columns, column_name):
    for column in columns:
        if column.get('name') == column_name:
            return column
    return None


def add_select_option(seadb_api, project_uuid, table_id, column_key, option_name, option_data):
    """Add an option to a select-like column; option_data is dict stored in option_data."""
    new_option_data = {
        'table_id': table_id,
        'column_key': column_key,
        'option_name': option_name,
        'option_data': option_data or {},
    }
    res = seadb_api.add_column_option(project_uuid, new_option_data)
    option_id = res.get('option_id')
    # Return merged visible structure
    result = {'id': option_id, 'name': option_name}
    if option_data:
        result.update(option_data)
    return result


def update_select_option(seadb_api, project_uuid, table_id, column_key, option, option_id, update_data):
    payload = {
        'table_id': table_id,
        'column_key': column_key,
        'option_id': option_id,
        'update_option_data': update_data or {},
    }

    # handle rename separately per API contract
    if option.get('id') == option_id:
        if update_data and update_data.get('name') is not None and update_data.get('name') != option.get('name'):
            payload['new_option_name'] = update_data.pop('name')
    res = seadb_api.update_column_option(project_uuid, payload)
    return res.get('success')


def get_ticket_counts_group_by_column_name(seadb_api, project_uuid, column_name, column_type='single-select'):
    """
    count single-select and multiple-select column
    """
    sql = (
        f"SELECT {column_name}, COUNT(*) AS count "
        f"FROM `{TABLE_TICKETS}` "
        "WHERE `deleted` = False "
        f"GROUP BY {column_name}"
    )
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results') or []
    metadata = res.get('metadata')
    column = next((column for column in metadata if column['name'] == column_name), None)
    if not column:
        return [], {}
    column_data = (column.get('data') or {})
    options = column_data.get('options', []) or []
    # tags is array; others are scalar strings
    if column_type == 'multiple-select':
        option_name_to_option_count = {row.get(column_name)[0]: row.get('count') for row in rows if row.get(column_name)}
    else:
        option_name_to_option_count = {row.get(column_name): row.get('count') for row in rows if row.get(column_name)}
    for option in options:
        option['tickets_count'] = option_name_to_option_count.get(option.get('name'), 0)
    return options, column


def filter_tickets_by_select(seadb_api, project_uuid, column_name, names):
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


# format tickets
def convert_ticket_select_column_name_to_option_id(columns, ticket):
    """In-place convert ticket fields from names to ids for state/type/tags/substate."""

    if not ticket:
        return ticket
    if ticket.get('state'):
        column = get_column_from_columns_by_name(columns, 'state')
        column_data = column.get('data') or {}
        options = column_data.get('options', []) or []
        for opt in options:
            if opt.get('name') == ticket.get('state'):
                ticket['state'] = opt.get('id')
    if ticket.get('type'):
        column = get_column_from_columns_by_name(columns, 'type')
        column_data = column.get('data') or {}
        options = column_data.get('options', []) or []
        for opt in options:
            if opt.get('name') == ticket.get('type'):
                ticket['type'] = opt.get('id')
    if ticket.get('tags'):
        column = get_column_from_columns_by_name(columns, 'tags')
        column_data = column.get('data') or {}
        options = column_data.get('options', []) or []
        tag_ids = []
        for tag_option in options:
            if tag_option.get('name') in ticket.get('tags'):
                tag_ids.append(tag_option.get('id'))
        ticket['tags'] = tag_ids
    if ticket.get('substate'):
        column = get_column_from_columns_by_name(columns, 'substate')
        column_data = column.get('data') or {}
        options = column_data.get('options', []) or []
        for opt in options:
            if opt.get('name') == ticket.get('substate'):
                ticket['substate'] = opt.get('id')
    return ticket


def get_tickets_by_ids(seadb_api, project_uuid, ticket_ids):
    ticket_ids_str = ",".join(ticket_ids)
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `_pk` IN ({ticket_ids_str})"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows


def batch_delete_select_option(seadb_api, project_uuid, table_id, column_key, option_ids):
    option_data = {
        'table_id': table_id,
        'column_key': column_key,
        'option_ids': option_ids,
    }
    res = seadb_api.delete_column_option(project_uuid, option_data)
    return res.get('success')

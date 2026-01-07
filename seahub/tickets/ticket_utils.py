import json
import logging
import random
from datetime import datetime
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from seahub.settings import AI_CHAT_TICKET_MAX_COMMENTS_NUM
from seahub.profile.models import Profile
from seahub.project.constants import TICKET_DISPLAY_ALL_COLUMNS, ExtraSourceType
from seahub.utils import mq, uuid_str_to_32_chars

TABLE_TICKETS = 'tickets'
TABLE_TICKET_COMMENTS = 'ticket_comments'
logger = logging.getLogger(__name__)

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

def check_ticket_comment_creation_interval(seadb_api, project_uuid, username, ticket_id, deleted=False):
    """Limit ticket comment creation to once every 30 seconds per creator per ticket."""
    previous_ticket_comment_sql = (
        f"SELECT * FROM `{TABLE_TICKET_COMMENTS}` WHERE `creator` = '{username}' "
        f"AND `ticket_id` = {ticket_id} AND `deleted` = {deleted} "
        f"ORDER BY `_pk` DESC LIMIT 1"
    )
    previous_ticket_comment = seadb_api.query_rows(project_uuid, previous_ticket_comment_sql).get('results')

    if previous_ticket_comment:
        created_at = previous_ticket_comment[0].get('created_at')
        created_at = time_str_to_utc_time(created_at) if created_at else None
        if created_at and created_at > timezone.now() - relativedelta(seconds=30):
            return False

    return True


def get_ticket(seadb_api, project_uuid, ticket_id):
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `_pk` = {ticket_id}"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    return rows[0] if rows else None, res.get('metadata')


def get_ticket_comments(seadb_api, project_uuid, ticket_id, start, end):
    ticket_comments_sql = f"SELECT * FROM `{TABLE_TICKET_COMMENTS}` WHERE `ticket_id` = {ticket_id} AND `deleted` = False ORDER BY `_pk` ASC LIMIT {start}, {end}"
    ticket_comments_data = seadb_api.query_rows(project_uuid, ticket_comments_sql).get('results')
    return ticket_comments_data


def get_ticket_comment_by_pk(seadb_api, project_uuid, ticket_id, ticket_comment_number):
    sql = f"SELECT * FROM `{TABLE_TICKET_COMMENTS}` WHERE `ticket_id` = {ticket_id} AND `_pk` = {ticket_comment_number}"
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
        "WHERE (`deleted` = False OR `deleted` is NULL)"
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
        f"WHERE `{column_name}` IN ({names_str}) AND (`deleted` = False OR `deleted` is NULL)"
    )
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
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
    ticket_ids_str = ", ".join([
        str(ticket_id)
        for ticket_id in ticket_ids
    ])
    sql = f"SELECT * FROM `{TABLE_TICKETS}` WHERE `_pk` IN ({ticket_ids_str}) AND (`deleted` = False or `deleted` IS NULL)"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows

def get_tickets_comments_by_ids(seadb_api, project_uuid, ticket_ids, max_records_for_each_id):
    ticket_ids_str = ', '.join([
        str(ticket_id)
        for ticket_id in ticket_ids
    ])
    ticket_comments_sql = f"SELECT * FROM `{TABLE_TICKET_COMMENTS}` WHERE `ticket_id` in ({ticket_ids_str}) AND (`deleted` = False or `deleted` IS NULL) ORDER BY `_pk` ASC LIMIT 0, {len(ticket_ids) * max_records_for_each_id}"
    ticket_comments_data = seadb_api.query_rows(project_uuid, ticket_comments_sql).get('results')
    result = {}
    for ticket_comment in ticket_comments_data:
        if ticket_comment['ticket_id'] not in result:
            result[ticket_comment['ticket_id']] = [ticket_comment]
        elif len(result[ticket_comment['ticket_id']]) < max_records_for_each_id:
            result[ticket_comment['ticket_id']].append(ticket_comment)
    return result

def get_deleted_tickets_ids(seadb_api, project_uuid):
    sql = f"SELECT _pk FROM `{TABLE_TICKETS}` WHERE `deleted` = True"
    results = seadb_api.query_rows(project_uuid, sql).get('results')
    ticket_ids = []
    for result in results:
        ticket_ids.append(result['_pk'])
    return ticket_ids

def delete_ticket_comments_by_ids(seadb_api, project_uuid, ticket_ids):
    ticket_ids_str = ", ".join(map(str, ticket_ids))
    sql = f"DELETE FROM `{TABLE_TICKET_COMMENTS}` WHERE `ticket_id` IN ({ticket_ids_str})"
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


def get_whole_tickets_data(seadb_api, project_uuid, ticket_ids):
    """
    Build a json from a ticket and its comments.

    Args:
    - project_uuid
    - ticket_ids

    Returns:
    [
        {
            "type": "ticket",
            "record_id": ...,
            "state": ...,
            "title": ...,
            "content": ...,
            "created_time": ...,
            "comments": [
                {
                    "nickname": ...,
                    "content": ...,
                    "replied_at": ...,
                },
                ...
            ]
        },
        # {...}
    ]
    """

    tickets = get_tickets_by_ids(seadb_api, project_uuid, ticket_ids)
    ticket_ids_comments_map = get_tickets_comments_by_ids(seadb_api, project_uuid, ticket_ids, AI_CHAT_TICKET_MAX_COMMENTS_NUM)
    all_comments_users = []
    for ticket_comments in ticket_ids_comments_map.values():
        for ticket_comment in ticket_comments:
            all_comments_users.append(ticket_comment.get('creator'))
    all_comments_users = set(all_comments_users)

    all_comments_users_profile = Profile.objects.filter(user__in=all_comments_users)

    nickname_map = {
        user_profile.user: user_profile.nickname
        for user_profile in all_comments_users_profile
    }
    result = []
    for ticket in tickets:
        created_time = ticket.get('created_time')
        created_time = time_str_to_utc_time(created_time).isoformat()
        whole_ticket_data = {
            'type': ExtraSourceType.value,
            'record_id': int(ticket['_pk']),
            'state': ticket.get('state'),
            'title': ticket.get('title'),
            'content': ticket.get('content'),
            'created_time': created_time,
            'comments': []
        }
        for ticket_comment in ticket_ids_comments_map.get(ticket['_pk'], []):
            nickname = nickname_map.get(ticket_comment.get('creator'))
            commented_at = ticket_comment.get('created_time')
            commented_at = time_str_to_utc_time(commented_at).isoformat()
            whole_ticket_data['comments'].append({
                'nickname': nickname,
                'content': ticket_comment.get('content'),
                'commented_at': commented_at
            })
        result.append(whole_ticket_data)
    return result


def send_ticket_update_msg(project_uuid):
    try:
        msg_content = json.dumps({'project_uuid': uuid_str_to_32_chars(project_uuid)})
        if mq.publish('ticket_update', msg_content) > 0:
            logger.debug('Publish ticket_update event: %s' % msg_content)
        else:
            logger.info('No one subscribed to ticket_update channel, event (%s) has not been send' % msg_content)
    except Exception as e:
        logger.error('send ticket update msg failed, error: %s', e)

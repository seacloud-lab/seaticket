import json
import logging
import random
from datetime import datetime
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from seahub.seadb_models.models import TicketActivitiesTable
from seahub.settings import AI_CHAT_TICKET_MAX_COMMENTS_NUM
from seahub.profile.models import Profile
from seahub.project.constants import TICKET_DISPLAY_ALL_COLUMNS, ExtraSourceType
from seahub.utils import mq, uuid_str_to_32_chars
from seahub.seadb_models.models import DiscourseTopicsTable
from seahub.seadb_models.utils import list_connection_record_titles
from seahub.project.models import ProjectConnections
from seahub.project.constants import ConnectionType

TABLE_TICKETS = 'tickets'
TABLE_TICKET_COMMENTS = 'ticket_comments'
logger = logging.getLogger(__name__)

def build_linked_record_titles_map(seadb_api, project_uuid, tickets, columns):
    linked_record_titles = {}
    if not tickets or not columns:
        return linked_record_titles

    lcr_column = None
    for c in (columns or []):
        if not isinstance(c, dict):
            continue
        if c.get('name') == 'linked_connection_records':
            lcr_column = c
            break
    lcr_key = (lcr_column or {}).get('key') or 'linked_connection_records'

    conn_id_to_record_ids = {}
    for ticket in (tickets or []):
        lcrs = ticket.get(lcr_key) or []
        if not isinstance(lcrs, list):
            continue
        for linked_key in lcrs:
            if not isinstance(linked_key, str) or '_' not in linked_key:
                continue
            connection_id_str, record_id_str = linked_key.split('_', 1)
            if not connection_id_str or not record_id_str:
                continue
            try:
                connection_id = int(connection_id_str)
                record_id = int(record_id_str)
            except Exception:
                continue
            conn_id_to_record_ids.setdefault(connection_id, set()).add(record_id)

    if not conn_id_to_record_ids:
        return linked_record_titles

    for connection_id, record_ids_set in conn_id_to_record_ids.items():
        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection:
            continue
        records = list_connection_record_titles(
            seadb_api, project_uuid, connection_id, connection.type, list(record_ids_set)
        )
        for record in (records or []):
            record_pk = record.get('_pk')
            if record_pk is None:
                continue
            linked_record_titles[f'{connection_id}_{record_pk}'] = record.get('title') or ''

    return linked_record_titles


def build_linked_record_titles_map_for_keys(seadb_api, project_uuid, lcr_keys):
    linked_record_titles = {}
    keys = lcr_keys or []
    if not isinstance(keys, list) or not keys:
        return linked_record_titles

    conn_id_to_record_ids = {}
    for linked_key in keys:
        if not isinstance(linked_key, str) or '_' not in linked_key:
            continue
        connection_id_str, record_id_str = linked_key.split('_', 1)
        if not connection_id_str or not record_id_str:
            continue
        try:
            connection_id = int(connection_id_str)
            record_id = int(record_id_str)
        except Exception:
            continue
        conn_id_to_record_ids.setdefault(connection_id, set()).add(record_id)

    if not conn_id_to_record_ids:
        return linked_record_titles

    for connection_id, record_ids_set in conn_id_to_record_ids.items():
        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection:
            continue
        records = list_connection_record_titles(
            seadb_api, project_uuid, connection_id, connection.type, list(record_ids_set)
        )
        for record in (records or []):
            record_pk = record.get('_pk')
            if record_pk is None:
                continue
            linked_record_titles[f'{connection_id}_{record_pk}'] = record.get('title') or ''

    return linked_record_titles

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

def get_deleted_tickets(seadb_api, project_uuid):
    sql = f"SELECT _pk, `linked_connection_records` FROM `{TABLE_TICKETS}` WHERE `deleted` = True"
    results = seadb_api.query_rows(project_uuid, sql).get('results')
    tickets = []
    for result in results:
        tickets.append({
            'ticket_id': result['_pk'],
            'linked_connection_records': result['linked_connection_records'],
        })
    return tickets

def delete_ticket_comments_by_ids(seadb_api, project_uuid, ticket_ids):
    ticket_ids_str = ", ".join(map(str, ticket_ids))
    sql = f"DELETE FROM `{TABLE_TICKET_COMMENTS}` WHERE `ticket_id` IN ({ticket_ids_str})"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows


def delete_ticket_activities_by_ids(seadb_api, project_uuid, ticket_ids):
    ticket_ids_str = ", ".join(map(str, ticket_ids))
    sql = (
        f"DELETE FROM `{TicketActivitiesTable.gen_table_name()}` "
        f"WHERE `ticket_id` IN ({ticket_ids_str})"
    )
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
            'type': ExtraSourceType.TICKET.value,
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


def compare_ticket_changes(old_ticket, new_data):
    """ compare ticket changes, return changes list

    Returns:
        list of (activity_type, field_name, old_value, new_value)
    """
    changes = []

    # title changed
    if 'title' in new_data and new_data['title'] != old_ticket.get('title'):
        changes.append(('title_changed', 'title', old_ticket.get('title'), new_data['title']))

    # state changed
    if 'state' in new_data and new_data['state'] != old_ticket.get('state'):
        changes.append(('state_changed', 'state', old_ticket.get('state'), new_data['state']))

    # substate changed
    if 'substate' in new_data and new_data['substate'] != old_ticket.get('substate'):
        changes.append(('substate_changed', 'substate', old_ticket.get('substate'), new_data['substate']))

    # type changed
    if 'type' in new_data and new_data['type'] != old_ticket.get('type'):
        changes.append(('type_changed', 'type', old_ticket.get('type'), new_data['type']))

    # priority changed
    if 'priority' in new_data and new_data['priority'] != old_ticket.get('priority'):
        changes.append(('priority_changed', 'priority', old_ticket.get('priority'), new_data['priority']))

    # tags changed
    if 'tags' in new_data:
        old_tags = set(old_ticket.get('tags') or [])
        new_tags = set(new_data['tags'] or [])
        added = new_tags - old_tags
        removed = old_tags - new_tags
        if added:
            changes.append(('tags_added', 'tags', None, list(added)))
        if removed:
            changes.append(('tags_removed', 'tags', list(removed), None))

    # assignees changed
    if 'assignees' in new_data:
        old_assignees = set(old_ticket.get('assignees') or [])
        new_assignees = set(new_data['assignees'] or [])
        added = new_assignees - old_assignees
        removed = old_assignees - new_assignees
        if added:
            changes.append(('assignees_added', 'assignees', None, list(added)))
        if removed:
            changes.append(('assignees_removed', 'assignees', list(removed), None))

    return changes


def record_ticket_activities(seadb_api, project_uuid, ticket_id, creator, changes):
    if not changes:
        return []

    rows = []
    now = datetime.now(timezone.utc).isoformat()
    for activity_type, field_name, old_value, new_value in changes:
        detail = json.dumps({
            'field_name': field_name,
            'old_value': old_value,
            'new_value': new_value,
        })
        rows.append({
            'ticket_id': ticket_id,
            'activity_type': activity_type,
            'detail': detail,
            'creator': creator,
            'created_time': now,
        })

    if not rows:
        return []

    res = seadb_api.insert_rows(project_uuid, TicketActivitiesTable.gen_table_name(), rows)
    pks = res.get('pks', [])

    # Build activity list with the returned pks
    activities = []
    for i, (activity_type, field_name, old_value, new_value) in enumerate(changes):
        activity = {
            'id': pks[i] if i < len(pks) else None,
            'ticket_id': ticket_id,
            'activity_type': activity_type,
            'field_name': field_name,
            'old_value': old_value,
            'new_value': new_value,
            'creator': creator,
            'created_time': now,
        }
        activities.append(activity)

    return activities


def get_ticket_activities(seadb_api, project_uuid, ticket_id, start=0, limit=50):
    sql = (
        f"SELECT * FROM `{TicketActivitiesTable.gen_table_name()}` "
        f"WHERE `ticket_id` = {ticket_id} "
        f"ORDER BY `created_time` ASC "
        f"LIMIT {limit} OFFSET {start}"
    )
    res = seadb_api.query_rows(project_uuid, sql)
    return res.get('results', [])


def check_update_ticket_lcr(seadb_api, project_uuid, ticket_lcr_diff):
    claim_by_pair = {} # {(conn_id, record_id) : ticket_id}
    added_by_conn = {} # {conn_id : record_ids}
    removed_by_conn = {} # {conn_id : (ticket_id, record_ids)}

    for tpk, (added_items, removed_items) in ticket_lcr_diff.items():
        # format: {conn_id:[record_id, ...]}
        for item in added_items:
            conn_id, rid = item.split('_', 1)
            pair = (int(conn_id), int(rid))
            existed = claim_by_pair.get(pair)
            if existed and int(existed) != int(tpk):
                error_msg = 'This record is already linked to a ticket.'
                return False, error_msg, None
            claim_by_pair[pair] = int(tpk)
            added_by_conn.setdefault(int(conn_id), set()).add(int(rid))

        for item in removed_items:
            conn_id, rid = item.split('_', 1)
            if conn_id is None or rid is None:
                continue
            removed_by_conn.setdefault(int(conn_id), []).append((int(tpk), {int(rid)}))    

    # validate connections belong to this project
    conn_ids = set(added_by_conn.keys()) | set(removed_by_conn.keys())
    connection_id_map = {}
    for conn_id in conn_ids:
        connection = ProjectConnections.objects.get_connection_by_id(conn_id)
        if not connection or str(getattr(connection.project, 'uuid', '')) != str(project_uuid):
            error_msg = 'Connection not found.'
            return False, error_msg, None
        connection_id_map[conn_id] = connection

    # check added_by_conn
    for conn_id, record_ids in added_by_conn.items():
        connection = connection_id_map.get(conn_id)
        if connection.type != ConnectionType.DISCOURSE_FORUM.value:
            continue
        topics_table_name = DiscourseTopicsTable.gen_table_name(conn_id)
        ids_sql = f"({', '.join(str(i) for i in record_ids)})"
        try:
            sql = f"SELECT _pk, `{DiscourseTopicsTable.linked_ticket.name}` FROM `{topics_table_name}` WHERE _pk IN {ids_sql}"
            res = seadb_api.query_rows(project_uuid, sql)
            rows = res.get('results') or []
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return False, error_msg, None

        existed_ids = set()
        for r in rows:
            existed_ids.add(int(r.get('_pk')))

        missing_ids = set(record_ids) - existed_ids
        if missing_ids:
            error_msg = 'Linked record not found.'
            return False, error_msg, None

        for r in rows:
            rid = int(r.get('_pk'))
            desired_ticket = claim_by_pair.get((conn_id, rid))
            if desired_ticket is None:
                continue
            existed_linked = r.get(DiscourseTopicsTable.linked_ticket.name)
            if existed_linked and int(existed_linked) not in (None, int(desired_ticket)):
                error_msg = 'This record is already linked to a ticket.'
                return False, error_msg, None
    return added_by_conn, removed_by_conn, claim_by_pair


def update_tickets_lcr(seadb_api, project_uuid, added_by_conn, removed_by_conn, claim_by_pair):
    conn_ids = set(added_by_conn.keys()) | set(removed_by_conn.keys())
    if not conn_ids:
        return

    connection_id_map = {}
    for conn_id in conn_ids:
        connection = ProjectConnections.objects.get_connection_by_id(conn_id)
        if connection.type != ConnectionType.DISCOURSE_FORUM.value:
            continue
        connection_id_map[conn_id] = connection

    # update added_by_conn
    for conn_id, record_ids in added_by_conn.items():
        if conn_id not in connection_id_map:
            continue
        topics_table_name = DiscourseTopicsTable.gen_table_name(conn_id)
        update_topic_rows = []
        for rid in record_ids:
            desired_ticket = claim_by_pair.get((conn_id, int(rid)))
            if desired_ticket is None:
                continue
            update_topic_rows.append({
                'pk': int(rid),
                'row': {
                    DiscourseTopicsTable.linked_ticket.name: int(desired_ticket)
                }
            })
        if update_topic_rows:
            seadb_api.update_rows(project_uuid, topics_table_name, update_topic_rows)

    # update removed_by_conn
    for conn_id, ticket_removed_list in removed_by_conn.items():
        if conn_id not in connection_id_map:
            continue
        topics_table_name = DiscourseTopicsTable.gen_table_name(conn_id)
        all_removed_ids = set()
        for ticket_id, ids_set in ticket_removed_list:
            all_removed_ids |= set(ids_set)
        if not all_removed_ids:
            continue
        ids_sql = f"({', '.join(str(i) for i in all_removed_ids)})"
        sql = f"SELECT _pk, `{DiscourseTopicsTable.linked_ticket.name}` FROM `{topics_table_name}` WHERE _pk IN {ids_sql}"
        res = seadb_api.query_rows(project_uuid, sql)
        rows = res.get('results') or []

        linked_ticket_by_pk = {}
        for r in rows:
            if r.get('_pk') is not None:
                linked_ticket_by_pk[int(r.get('_pk'))] = r.get(DiscourseTopicsTable.linked_ticket.name)

        clear_rows = []
        for tpk, ids_set in ticket_removed_list:
            for rid in ids_set:
                existed = linked_ticket_by_pk.get(int(rid))
                if existed and int(existed) == int(tpk):
                    clear_rows.append({
                        'pk': int(rid),
                        'row': {
                            DiscourseTopicsTable.linked_ticket.name: None
                            }
                    })
        if clear_rows:
            seadb_api.update_rows(project_uuid, topics_table_name, clear_rows)

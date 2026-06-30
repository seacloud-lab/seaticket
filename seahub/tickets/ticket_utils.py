import json
import logging
import random
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE, ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.profile.models import Profile
from seahub.project.constants import TICKET_DISPLAY_ALL_COLUMNS, ExtraSourceType
from seahub.utils import mq, uuid_str_to_32_chars, time_str_to_utc_time
from seahub.seadb_models.utils import get_connection_records_by_pks
from seahub.project.models import ProjectConnections, Projects
from seahub.project.utils import LINKED_TICKET_SUPPORT_TYPES
from seahub.project.utils import get_current_table_metadata
from seahub.project.constants import ConnectionType
from seahub.seadb_models.utils import get_connection_table_name
from seahub.portal.portal_utils import get_portal_issue
from seahub.seadb_models.models import SchemaTables

class TicketLinkValidationError(Exception):
    """Ticket link validation error"""
    pass


class TicketCloseValidationError(Exception):
    pass


@dataclass
class TicketLinkSyncPlan:
    """Ticket link sync plan"""
    # {connection_id: {record_id: ticket_id}}
    records_to_link: Dict[int, Dict[int, int]] = field(default_factory=dict)
    records_to_unlink: Dict[int, Dict[int, int]] = field(default_factory=dict)
    # portal issue ids to link: [issue_id, ...]
    portal_issue_ids: List[int] = field(default_factory=list)


TABLE_TICKETS = SchemaTables.TICKETS.table_name()
TABLE_TICKET_COMMENTS = SchemaTables.TICKET_COMMENTS.table_name()

logger = logging.getLogger(__name__)
TICKET_CLOSE_CONFIRM_FIELD = 'confirm_close_linked_github_issues'
TICKET_CLOSE_WARNING_TYPE = 'open_linked_github_issues'

_COMMENTS_OMITTED_NOTICE = '[comments omitted due to content limit]'
_MORE_COMMENTS_OMITTED_NOTICE = '[more comments omitted due to content limit]'

TICKET_SUBSTATE_TO_GITHUB_STATE_REASON = {
    'completed': 'completed',
    'not planned': 'not_planned',
    'duplicate': 'duplicate',
}


def validate_linked_connection_records(linked_connection_records):
    if not linked_connection_records:
        return
    for record in linked_connection_records:
        if not isinstance(record, str):
            raise TicketLinkValidationError('linked_connection_records invalid.')
        parts = record.split('_', 1)
        if len(parts) != 2:
            raise TicketLinkValidationError('linked_connection_records invalid.')
        connection_id, record_id = parts
        if not connection_id or not record_id:
            raise TicketLinkValidationError('linked_connection_records invalid.')
        if connection_id != 'portal':
            try:
                int(connection_id)
            except Exception:
                raise TicketLinkValidationError('linked_connection_records invalid.')
        try:
            int(record_id)
        except Exception:
            raise TicketLinkValidationError('linked_connection_records invalid.')


def build_linked_record_titles_map(seadb_api, project_uuid, tickets, columns):
    if not tickets or not columns:
        return {}

    # Find the linked_connection_records column and get its key
    lcr_column = None
    for c in (columns or []):
        if not isinstance(c, dict):
            continue
        if c.get('name') == 'linked_connection_records':
            lcr_column = c
            break
    lcr_key = (lcr_column or {}).get('key') or 'linked_connection_records'

    # Collect all linked keys from all tickets
    all_keys = []
    for ticket in (tickets or []):
        lcrs = ticket.get(lcr_key) or []
        if not isinstance(lcrs, list):
            continue
        all_keys.extend(lcrs)

    return build_linked_record_titles_map_for_keys(seadb_api, project_uuid, all_keys)


def build_linked_record_titles_map_for_keys(seadb_api, project_uuid, lcr_keys):
    linked_record_titles = {}
    keys = lcr_keys or []
    if not isinstance(keys, list) or not keys:
        return linked_record_titles

    conn_id_to_record_ids = {}
    portal_issue_ids = []
    for linked_key in keys:
        connection_id_str, record_id_str = linked_key.split('_', 1)
        # Handle portal_ prefix
        if connection_id_str == 'portal':
            portal_issue_ids.append(int(record_id_str))
            continue

        connection_id = int(connection_id_str)
        record_id = int(record_id_str)
        conn_id_to_record_ids.setdefault(connection_id, set()).add(record_id)

    # Query portal issue titles
    if portal_issue_ids:
        try:
            ids_str = ','.join([str(i) for i in portal_issue_ids])
            sql = f"SELECT _pk, title FROM `{SchemaTables.PORTAL_ISSUES.table_name()}` WHERE `_pk` IN ({ids_str})"
            res = seadb_api.query_rows(project_uuid, sql)
            for row in (res.get('results') or []):
                _pk = row.get('_pk')
                linked_record_titles[f'portal_{_pk}'] = row.get('title') or ''
        except Exception as e:
            logger.error(f'Error querying portal issue titles: {e}')


    for connection_id, record_ids_set in conn_id_to_record_ids.items():
        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection:
            continue
        records = get_connection_records_by_pks(
            seadb_api, project_uuid, connection_id, connection.type, list(record_ids_set)
        )
        for record in (records or []):
            record_pk = record.get('_pk')
            linked_record_titles[f'{connection_id}_{record_pk}'] = record.get('title') or ''

    return linked_record_titles


def build_linked_records_info_for_keys(seadb_api, project_uuid, lcr_keys):
    linked_records_info = {}
    keys = lcr_keys or []
    if not isinstance(keys, list) or not keys:
        return linked_records_info

    conn_id_to_record_ids = {}
    portal_issue_ids = []
    for linked_key in keys:
        connection_id_str, record_id_str = linked_key.split('_', 1)
        # Handle portal_ prefix
        if connection_id_str == 'portal':
            portal_issue_ids.append(int(record_id_str))
            continue
        connection_id = int(connection_id_str)
        record_id = int(record_id_str)
        conn_id_to_record_ids.setdefault(connection_id, set()).add(record_id)
    
    # Query portal issue titles
    if portal_issue_ids:
        try:
            ids_str = ','.join([str(i) for i in portal_issue_ids])
            sql = f"SELECT _pk, title FROM `{SchemaTables.PORTAL_ISSUES.table_name()}` WHERE `_pk` IN ({ids_str})"
            res = seadb_api.query_rows(project_uuid, sql)
            for row in (res.get('results') or []):
                _pk = row.get('_pk')
                linked_records_info[f'portal_{_pk}'] = row
        except Exception as e:
            logger.error(f'Error querying portal issue titles: {e}')

    for connection_id, record_ids_set in conn_id_to_record_ids.items():
        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection:
            continue
        records = get_connection_records_by_pks(
            seadb_api, project_uuid, connection_id, connection.type, list(record_ids_set)
        )
        for record in (records or []):
            record_pk = record.get('_pk')
            record['connection_type'] = connection.type
            linked_records_info[f'{connection_id}_{record_pk}'] = record

    return linked_records_info


def _parse_linked_connection_record_keys(linked_connection_records):
    """Parse ``linked_connection_records`` keys into connection/record id groups.

    Each key has the form ``{connection_id}_{record_id}`` (e.g. ``12_345``).
    Portal links (``portal_{issue_id}``) are skipped.

    Returns:
        dict[int, set[int]]: ``connection_id`` -> set of ``record_id``.
    """
    conn_id_to_record_ids = {}
    for linked_key in (linked_connection_records or []):
        if not isinstance(linked_key, str):
            continue
        try:
            connection_id_str, record_id_str = linked_key.split('_', 1)
        except ValueError:
            continue
        if connection_id_str == 'portal':
            continue
        try:
            connection_id = int(connection_id_str)
            record_id = int(record_id_str)
        except (TypeError, ValueError):
            continue
        conn_id_to_record_ids.setdefault(connection_id, set()).add(record_id)
    return conn_id_to_record_ids


def _is_github_issue_closed(issue_state):
    if issue_state in (None, ''):
        return False
    issue_state = str(issue_state).strip().lower()
    return issue_state in ('closed', '0002')


def collect_open_linked_github_issues(seadb_api, project_uuid, ticket_id, linked_connection_records):
    """Collect still-open GitHub issues linked to a single ticket. 
    Only connections of type github_issue are considered; closed issues are omitted.
    """
    open_issues = []
    conn_id_to_record_ids = _parse_linked_connection_record_keys(linked_connection_records)
    for connection_id, record_ids in conn_id_to_record_ids.items():
        connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not connection or connection.type != ConnectionType.GITHUB_ISSUE.value:
            continue
        records = get_connection_records_by_pks(
            seadb_api, project_uuid, connection_id, connection.type, list(record_ids)
        )
        for record in (records or []):
            issue_state = record.get('state')
            if _is_github_issue_closed(issue_state):
                continue
            record_pk = record.get('_pk')
            if record_pk is None:
                continue
            open_issues.append({
                'connection_id': int(connection_id),
                'record_pk': int(record_pk),
                'title': record.get('title') or '',
                'state': issue_state,
            })
    return open_issues


def collect_open_linked_github_issues_for_tickets(seadb_api, project_uuid, ticket_payloads):
    """Batch variant of func: collect_open_linked_github_issues.
    ticket_payloads: List of dicts with ticket_id, optional ticket_title, and linked_connection_records.
    Returns:
        list[dict]: Tickets that still have open linked issues, each with ticket_id, ticket_title, and open_github_issues.
    """
    grouped_open_issues = []
    for payload in (ticket_payloads or []):
        ticket_id = payload.get('ticket_id')
        if ticket_id is None:
            continue
        linked_connection_records = payload.get('linked_connection_records') or []
        open_issues = collect_open_linked_github_issues(
            seadb_api,
            project_uuid,
            ticket_id,
            linked_connection_records,
        )
        if not open_issues:
            continue
        grouped_open_issues.append({
            'ticket_id': int(ticket_id),
            'ticket_title': payload.get('ticket_title') or '',
            'open_github_issues': open_issues,
        })
    return grouped_open_issues


def build_ticket_close_warning_response(grouped_open_issues):
    """Build the 409 response body when closing tickets with open linked GitHub issues.

    The client should show a confirmation dialog and retry with
    ``confirm_close_linked_github_issues`` set to true.
    """
    response = {
        'error_msg': 'Some linked GitHub issues are still open.',
        'warning_type': TICKET_CLOSE_WARNING_TYPE,
        'confirm_field': TICKET_CLOSE_CONFIRM_FIELD,
        'tickets': grouped_open_issues or [],
    }
    return response


def get_ticket_table_columns(seadb_api, project_uuid):
    """Return column definitions for the project tickets table."""
    base_metadata = seadb_api.get_base_metadata(project_uuid)
    tables = (base_metadata or {}).get('tables') or []
    ticket_meta = get_current_table_metadata(tables, TABLE_TICKETS)
    return (ticket_meta or {}).get('columns') or []


def normalize_substate_name(substate, ticket_columns):
    """Resolve a ticket substate value to its display name.

    If ``substate`` is a select option id, look up the matching option name;
    otherwise return the trimmed string as-is.
    """
    if not substate:
        return ''
    target = str(substate).strip()
    if not target:
        return ''
    substate_column = get_column_from_columns_by_name(ticket_columns, SchemaTables.TICKETS.column.substate.name) or {}
    options = ((substate_column.get('data') or {}).get('options') or [])
    for option in options:
        option_id = str(option.get('id') or '').strip()
        option_name = str(option.get('name') or '').strip()
        if target == option_id:
            return option_name
    return target


def map_ticket_substate_to_github_state_reason(substate, ticket_columns):
    """Map ticket substate to GitHub ``state_reason`` when closing an issue.

    Raises:
        TicketCloseValidationError: If the substate cannot be mapped.
    """
    substate_name = normalize_substate_name(substate, ticket_columns)
    normalized_substate_name = substate_name.strip().lower()
    if normalized_substate_name in ('completed', 'not_planned', 'duplicate', 'reopened'):
        return normalized_substate_name
    state_reason = TICKET_SUBSTATE_TO_GITHUB_STATE_REASON.get(normalized_substate_name)
    if state_reason:
        return state_reason
    raise TicketCloseValidationError('substate cannot map to github state_reason.')


def close_linked_github_issues(seadb_api, project_uuid, ticket_close_payloads):
    """Close all open linked GitHub issues for the given ticket close payloads.

    Args:
        ticket_close_payloads: List of dicts with ``state_reason`` and
            ``open_github_issues`` (from the warning/confirmation flow).
            Any failure from :func:`update_github_issue_record` propagates.
    """
    from seahub.project.connections import update_github_issue_record

    for payload in (ticket_close_payloads or []):
        state_reason = payload.get('state_reason')
        open_github_issues = payload.get('open_github_issues') or []
        # The GitHub REST API does not natively support a single batch 
        # or bulk PATCH endpoint for updating multiple issues at once.
        for issue in open_github_issues:
            update_github_issue_record(
                project_uuid,
                issue.get('connection_id'),
                issue.get('record_pk'),
                state='closed',
                state_reason=state_reason,
                seadb_api=seadb_api,
            )


def build_linked_ticket_titles_map(seadb_api, project_uuid, records, columns, column_name='linked_ticket'):
    """
    Returns:
        Dict mapping ticket_id (as string) to ticket title
    """

    ticket_pk_to_ticket_title = {}

    if not records or not columns:
        return ticket_pk_to_ticket_title

    # Find the linked ticket column and get its key
    linked_ticket_column = None
    for c in (columns or []):
        if not isinstance(c, dict):
            continue
        if c.get('name') == column_name:
            linked_ticket_column = c
            break
    linked_ticket_key = (linked_ticket_column or {}).get('key') or column_name

    # Collect all ticket IDs from records
    ticket_ids = set()
    for record in (records or []):
        v = record.get(linked_ticket_key)
        if v is None or v == '':
            continue
        try:
            ticket_ids.add(int(v))
        except Exception:
            continue

    # Query ticket titles if we have any IDs
    if ticket_ids:
        ticket_ids_str = ','.join([str(i) for i in ticket_ids])
        sql = f"SELECT _pk, title FROM `{TABLE_TICKETS}` WHERE `_pk` IN ({ticket_ids_str})"
        try:
            res = seadb_api.query_rows(project_uuid, sql)
            for row in (res.get('results') or []):
                _pk = row.get('_pk')
                if _pk is None:
                    continue
                ticket_pk_to_ticket_title[str(_pk)] = row.get('title') or ''
        except Exception as e:
            logger.error(f'Error querying linked ticket titles: {e}')
            ticket_pk_to_ticket_title = {}

    return ticket_pk_to_ticket_title


def get_ticket_title(seadb_api, project_uuid, ticket_id):
    if not ticket_id:
        return ''
    try:
        sql = f"SELECT `title` FROM `{TABLE_TICKETS}` WHERE `_pk` = {ticket_id}"
        res = seadb_api.query_rows(project_uuid, sql)
        rows = res.get('results')
        ticket = rows[0] if rows else None
        title = ticket.get('title') or ''
    except Exception as e:
        logger.error(f'Error querying ticket title: {e}')
        title = ''
    return title


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
    previous_ticket_sql = f"SELECT `_pk`, `created_time` FROM `{TABLE_TICKETS}` WHERE `creator` = '{username}' AND `deleted` = {deleted} ORDER BY `_pk` DESC LIMIT 1"
    previous_ticket = seadb_api.query_rows(project_uuid, previous_ticket_sql).get('results')

    if previous_ticket:
        created_at = previous_ticket[0].get('created_at')
        created_at = time_str_to_utc_time(created_at) if created_at else None
        if created_at and created_at > timezone.now() - relativedelta(seconds=30):
            return False

    return True

def check_ticket_comment_creation_interval(seadb_api, project_uuid, username, ticket_id, deleted=False):
    """Limit ticket comment creation to once every 30 seconds per creator per ticket."""
    previous_ticket_comment_sql = f"SELECT `_pk`, `created_time` FROM `{TABLE_TICKET_COMMENTS}` WHERE `creator` = '{username}' AND `ticket_id` = {ticket_id} AND `deleted` = {deleted} ORDER BY `_pk` DESC LIMIT 1"
    previous_ticket_comment = seadb_api.query_rows(project_uuid, previous_ticket_comment_sql).get('results')
    if previous_ticket_comment:
        created_at = previous_ticket_comment[0].get('created_time')
        created_at = time_str_to_utc_time(created_at) if created_at else None
        if created_at and created_at > timezone.now() - relativedelta(seconds=30):
            return False

    return True

def get_ticket(seadb_api, project_uuid, ticket_id):
    sql = f"SELECT `_pk`, `title`, `content`, `state`, `substate`, `type`, `tags`, `assignees`, `participants`, `linked_connection_records`, `priority`, `creator`, `created_time`, `modified_time`, `due_date` FROM `{TABLE_TICKETS}` WHERE `_pk` = {ticket_id}"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    return rows[0] if rows else None, res.get('metadata')


def get_ticket_comments(seadb_api, project_uuid, ticket_id, start, end):
    ticket_comments_sql = f"SELECT `_pk`, `content`, `creator`, `created_time`, `modified_time`, `via_agent` FROM `{TABLE_TICKET_COMMENTS}` WHERE `ticket_id` = {ticket_id} AND `deleted` = False ORDER BY `_pk` ASC LIMIT {start}, {end}"
    ticket_comments_data = seadb_api.query_rows(project_uuid, ticket_comments_sql).get('results')
    return ticket_comments_data


def get_ticket_comment_by_pk(seadb_api, project_uuid, ticket_id, ticket_comment_number):
    sql = f"SELECT `_pk`, `content`, `creator`, `created_time`, `modified_time`, `via_agent` FROM `{TABLE_TICKET_COMMENTS}` WHERE `ticket_id` = {ticket_id} AND `_pk` = {ticket_comment_number}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None


def get_column_from_columns_by_name(columns, column_name):
    for column in columns:
        if column.get('name') == column_name:
            return column
    return None


def get_option_id_by_name(columns, column_name, option_name, case_insensitive=False):
    """Look up the option id for a given option name in a select column.

    Returns the option id if found, otherwise returns option_name as-is.
    """
    if not columns or not option_name:
        return option_name
    column = get_column_from_columns_by_name(columns, column_name)
    if not column:
        return option_name
    options = (column.get('data') or {}).get('options') or []
    for opt in options:
        name = opt.get('name') or ''
        target = option_name
        if case_insensitive:
            name = name.lower()
            target = target.lower()
        if name == target:
            return opt.get('id', option_name)
    return option_name


def build_tag_id_to_name_map(seadb_api, project_uuid, tag_ids):
    unique_tag_ids = set()
    for tag_id in (tag_ids or []):
        if tag_id in (None, ''):
            continue
        try:
            unique_tag_ids.add(int(tag_id))
        except (TypeError, ValueError):
            continue

    if not unique_tag_ids:
        return {}

    tag_ids_str = ', '.join(str(tag_id) for tag_id in sorted(unique_tag_ids))
    sql = f"SELECT `_pk`, `name` FROM `{SchemaTables.TAG.table_name()}` WHERE `_pk` IN ({tag_ids_str})"
    rows = seadb_api.query_rows(project_uuid, sql).get('results') or []
    return {
        str(row.get('_pk')): row.get('name') or row.get('_pk')
        for row in rows
        if row.get('_pk') is not None
    }


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


# format records
def convert_select_field_names_to_option_ids(columns, record, field_names=None):
    """In-place convert select field values from option names to option ids."""

    if not record:
        return record

    field_names = field_names or ('state', 'type', 'substate')
    for field_name in field_names:
        field_value = record.get(field_name)
        if not field_value:
            continue

        column = get_column_from_columns_by_name(columns, field_name)
        if not column:
            continue

        column_data = column.get('data') or {}
        options = column_data.get('options', []) or []
        for option in options:
            if option.get('name') == field_value:
                record[field_name] = option.get('id')
                break

    return record


def get_tickets_by_ids(seadb_api, project_uuid, ticket_ids):
    ticket_ids_str = ", ".join([
        str(ticket_id)
        for ticket_id in ticket_ids
    ])
    sql = f"SELECT `_pk`, `state`, `title`, `content`, `created_time` FROM `{TABLE_TICKETS}` WHERE `_pk` IN ({ticket_ids_str}) AND (`deleted` = False or `deleted` IS NULL)"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows

def _truncate_content_with_ellipsis(content, max_length):
    content = content or ''
    if max_length <= 0:
        return ''
    if len(content) <= max_length:
        return content
    if max_length <= 3:
        return '.' * max_length
    return content[:max_length - 3] + '...'


def _build_ticket_comment_notice(content):
    return {
        'creator': None,
        'content': content,
        'created_time': None,
    }


def get_tickets_comments_by_ids(seadb_api, project_uuid, ticket_ids):
    if not ticket_ids:
        return {}

    ticket_ids_str = ', '.join(str(ticket_id) for ticket_id in ticket_ids)
    ticket_comments_sql = (
        f"SELECT `_pk`, `ticket_id`, `creator`, `content`, `created_time` FROM `{TABLE_TICKET_COMMENTS}` "
        f"WHERE `ticket_id` in ({ticket_ids_str}) AND (`deleted` = False or `deleted` IS NULL) "
        f"ORDER BY `ticket_id` ASC, `_pk` ASC"
    )
    ticket_comments_data = seadb_api.query_rows(project_uuid, ticket_comments_sql).get('results', [])
    result = {}
    for comment in ticket_comments_data:
        ticket_id = comment['ticket_id']
        if ticket_id not in result:
            result[ticket_id] = [comment]
        else:
            result[ticket_id].append(comment)
    return result


def _get_selected_ticket_comments_for_attachment(ticket_comments, body_content_length, limit_for_each_id):
    if body_content_length >= ATTACHMENT_CONTENT_MAX_SIZE:
        return [_build_ticket_comment_notice(_COMMENTS_OMITTED_NOTICE)]

    if not ticket_comments:
        return []

    first_comment = ticket_comments[0]
    remaining_size = ATTACHMENT_CONTENT_MAX_SIZE - body_content_length
    first_content = first_comment.get('content', '') or ''
    if len(first_content) > remaining_size:
        truncated_content = _truncate_content_with_ellipsis(first_content, remaining_size)
        selected_comments = []
        if truncated_content:
            selected_comments.append({
                **first_comment,
                'content': truncated_content,
            })
        selected_comments.append(_build_ticket_comment_notice(_MORE_COMMENTS_OMITTED_NOTICE))
        return selected_comments

    latest_comments = ticket_comments[-limit_for_each_id:] if limit_for_each_id > 0 else []
    comments_by_pk = {
        comment['_pk']: comment
        for comment in latest_comments
    }
    comments_by_pk[first_comment['_pk']] = first_comment
    comments = [comments_by_pk[pk] for pk in sorted(comments_by_pk)]

    selected_comments = []
    total_content_size = body_content_length
    for comment in comments:
        content = comment.get('content', '') or ''
        remaining_size = ATTACHMENT_CONTENT_MAX_SIZE - total_content_size
        if remaining_size <= 0:
            break

        if len(content) > remaining_size:
            truncated_content = _truncate_content_with_ellipsis(content, remaining_size)
            if truncated_content:
                selected_comments.append({
                    **comment,
                    'content': truncated_content,
                })
            selected_comments.append(_build_ticket_comment_notice(_MORE_COMMENTS_OMITTED_NOTICE))
            break

        selected_comments.append(comment)
        total_content_size += len(content)

    return selected_comments

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
    sql = f"DELETE FROM `{SchemaTables.TICKET_ACTIVITIES.table_name()}` WHERE `ticket_id` IN ({ticket_ids_str})"
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
    all_comments_users = set()
    ticket_ids_comments_map = get_tickets_comments_by_ids(seadb_api, project_uuid, ticket_ids)
    for ticket in tickets:
        full_content = ticket.get('content', '') or ''
        ticket_comments = _get_selected_ticket_comments_for_attachment(
            ticket_ids_comments_map.get(ticket['_pk'], []), len(full_content), ATTACHMENT_ISSUE_MAX_COMMENTS,
        )
        ticket_ids_comments_map[ticket['_pk']] = ticket_comments
        for comment in ticket_comments:
            creator = comment.get('creator')
            if creator:
                all_comments_users.add(creator)

    all_comments_users_profile = Profile.objects.filter(user__in=all_comments_users)

    nickname_map = {
        user_profile.user: user_profile.nickname
        for user_profile in all_comments_users_profile
    }
    result = []
    for ticket in tickets:
        created_time = ticket.get('created_time')
        created_time = time_str_to_utc_time(created_time).isoformat()
        full_content = ticket.get('content', '') or ''
        whole_ticket_data = {
            'type': ExtraSourceType.TICKET.value,
            'record_id': int(ticket['_pk']),
            'state': ticket.get('state'),
            'title': ticket.get('title'),
            'content': full_content[:ATTACHMENT_CONTENT_MAX_SIZE],
            'created_time': created_time,
            'comments': []
        }
        comments = ticket_ids_comments_map.get(ticket['_pk'], [])
        for comment in comments:
            content = comment.get('content', '')
            nickname = nickname_map.get(comment.get('creator'))
            commented_at = comment.get('created_time')
            commented_at = time_str_to_utc_time(commented_at).isoformat() if commented_at else None
            whole_ticket_data['comments'].append({
                'nickname': nickname,
                'content': content,
                'commented_at': commented_at
            })
        result.append(whole_ticket_data)
    return result


def send_ticket_update_msg(project_uuid, added=0, deleted=0, updated=0):
    try:
        normalized_project_uuid = uuid_str_to_32_chars(project_uuid)
        added_count = int(added or 0)
        deleted_count = int(deleted or 0)
        updated_count = int(updated or 0)

        msg_content = json.dumps({
            'project_uuid': normalized_project_uuid,
            'added': added_count,
            'deleted': deleted_count,
            'updated': updated_count,
        })

        if mq.publish('ticket_update', msg_content) > 0:
            logger.debug('Publish ticket_update event: %s' % msg_content)
        else:
            logger.info('No one subscribed to ticket_update channel, event (%s) has not been send' % msg_content)

        Projects.objects.filter(uuid=normalized_project_uuid).update(
            last_ticket_active_time=datetime.now(timezone.utc).isoformat()
        )
    except Exception as e:
        logger.error('send ticket update msg failed, error: %s', e)

def send_data_update_msg(project_uuid, record_id, event=None):
    try:
        msg_content = json.dumps({
            'event': event,
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'source_type': ExtraSourceType.TICKET.value,
            'record_id': record_id,
        })
        if mq.publish('data_events', msg_content) > 0:
            logger.debug('Publish data_update event: %s' % msg_content)
        else:
            logger.info('No one subscribed to data_update channel, event (%s) has not been send' % msg_content)
    except Exception as e:
        logger.error('send data update msg failed, error: %s', e)


def compare_ticket_changes(old_ticket, new_data):
    """ compare ticket changes, return changes list

    Returns:
        list of (activity_type, field_name, old_value, new_value)
    """
    changes = []

    # title changed
    if 'title' in new_data and new_data['title'] != old_ticket.get('title'):
        changes.append(('title_changed', 'title', old_ticket.get('title'), new_data['title']))

    state_changed = 'state' in new_data and new_data['state'] != old_ticket.get('state')
    substate_changed = 'substate' in new_data and new_data['substate'] != old_ticket.get('substate')
    if state_changed and substate_changed:
        changes.append((
            'state_substate_changed',
            'state_substate',
            {'state': old_ticket.get('state'), 'substate': old_ticket.get('substate')},
            {'state': new_data.get('state'), 'substate': new_data.get('substate')}
        ))
    else:
        # state changed
        if state_changed:
            changes.append(('state_changed', 'state', old_ticket.get('state'), new_data['state']))

        # substate changed
        if substate_changed:
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
        changes.append(('tags_changed', 'tags', list(old_tags), list(new_tags)))

    # assignees changed
    if 'assignees' in new_data:
        old_assignees = set(old_ticket.get('assignees') or [])
        new_assignees = set(new_data['assignees'] or [])
        changes.append(('assignees_changed', 'assignees', list(old_assignees), list(new_assignees)))

    return changes

def record_create_task_activities(seadb_api, project_uuid, connection_id, task, creator = 'system'):
    if not task:
        return []
    now = datetime.now(timezone.utc).isoformat()
    event_type = 'general_task_added'
    
    task_id = task.get('_pk', 0)
    task_title = task.get('title', '')
    linked_ticket = task.get('linked_ticket')
    old_value = None
    new_value = {'title': task_title}
    
    activity_rows = [{
        'ticket_id': linked_ticket,
        'activity_type': event_type,
        'detail': json.dumps({
            'connection_id': connection_id,
            'record_id': task_id,
            'task_title': task_title,
            'old_value': old_value,
            'new_value': new_value,
        }),
        'creator': creator,
        'created_time': now,
    }]

    res = seadb_api.insert_rows(project_uuid, SchemaTables.TICKET_ACTIVITIES.table_name(), activity_rows)
    pks = res.get('pks', [])

    # Build activity list with the returned pks
    activities = []
    for i, activity_row in enumerate(activity_rows):
        activity = {
            'id': pks[i] if i < len(pks) else None,
            'connection_id': connection_id,
            'record_id': task_id,
            'ticket_id': linked_ticket,
            'activity_type': event_type,
            'field_key': event_type,
            'old_value': old_value,
            'new_value': new_value,
            'creator': creator,
            'created_time': now,
            'task_title': task_title,
        }
        activities.append(activity)
    return activities


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

    res = seadb_api.insert_rows(project_uuid, SchemaTables.TICKET_ACTIVITIES.table_name(), rows)
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
    sql = f"SELECT `_pk`, `activity_type`, `detail`, `creator`, `created_time` FROM `{SchemaTables.TICKET_ACTIVITIES.table_name()}` WHERE `ticket_id` = {ticket_id} ORDER BY `created_time` ASC LIMIT {limit} OFFSET {start}"
    res = seadb_api.query_rows(project_uuid, sql)
    return res.get('results', [])


def check_ticket_link_changes(seadb_api, project_uuid, ticket_link_diff):
    """
    Validate the legality of ticket link record changes.

    Args:
        seadb_api: SeaDB API instance
        project_uuid: project UUID
        ticket_link_diff: {ticket_id: (added_keys, removed_keys)}
            key format is "connection_id_record_id" or "portal_issue_id"

    Returns:
        TicketLinkSyncPlan: Validated sync plan

    Raises:
        TicketLinkValidationError: Validation failed
    """
    sync_plan = TicketLinkSyncPlan()

    for ticket_id, (added_items, removed_items) in ticket_link_diff.items():
        ticket_id = int(ticket_id)

        # Parse added items
        for item in added_items:
            conn_id, rid = item.split('_', 1)

            # Handle portal_ prefix
            if conn_id == 'portal':
                rid = int(rid)
                # Check if portal issue exists and is not already linked
                try:
                    portal_issue, _ = get_portal_issue(seadb_api, project_uuid, rid)
                    if not portal_issue:
                        raise TicketLinkValidationError('Portal issue not found.')
                    if portal_issue.get('linked_ticket'):
                        raise TicketLinkValidationError('This portal issue is already linked to a ticket.')
                except TicketLinkValidationError:
                    raise
                except Exception as e:
                    logger.exception(e)
                    raise TicketLinkValidationError('Internal Server Error')
                sync_plan.portal_issue_ids.append(rid)
                # Store ticket_id mapping for portal issues using 'portal' as key
                sync_plan.records_to_link.setdefault('portal', {})[rid] = ticket_id
                continue

            conn_id, rid = int(conn_id), int(rid)

            # Check if there is a conflict in the same batch (a record is linked to multiple tickets)
            existing_ticket = sync_plan.records_to_link.get(conn_id, {}).get(rid)
            if existing_ticket is not None and existing_ticket != ticket_id:
                raise TicketLinkValidationError('This record is already linked to a ticket.')

            sync_plan.records_to_link.setdefault(conn_id, {})[rid] = ticket_id

        # Parse removed items
        for item in removed_items:
            conn_id, rid = item.split('_', 1)
            if conn_id is None or rid is None:
                continue
            # Handle portal_ prefix for removal
            if conn_id == 'portal':
                rid = int(rid)
                sync_plan.records_to_unlink.setdefault('portal', {})[rid] = ticket_id
                continue
            conn_id, rid = int(conn_id), int(rid)
            sync_plan.records_to_unlink.setdefault(conn_id, {})[rid] = ticket_id

    # Check if the connection belongs to this project
    all_conn_ids = set(sync_plan.records_to_link.keys()) | set(sync_plan.records_to_unlink.keys())
    # Exclude 'portal' key which is not a connection id
    all_conn_ids.discard('portal')
    if not all_conn_ids:
        return sync_plan, None

    connections = ProjectConnections.objects.filter(id__in=all_conn_ids)
    connection_id_map = {c.id: c for c in connections}

    for conn_id in all_conn_ids:
        connection = connection_id_map.get(conn_id)
        if not connection or str(connection.project_uuid) != str(project_uuid):
            raise TicketLinkValidationError('Connection not found.')

    # Check if the connection records exist and are occupied
    for conn_id, record_ticket_map in sync_plan.records_to_link.items():
        connection = connection_id_map.get(conn_id)
        if connection.type not in LINKED_TICKET_SUPPORT_TYPES:
            continue

        table_name = get_connection_table_name(connection.type, conn_id)
        if not table_name:
            continue

        record_ids = list(record_ticket_map.keys())
        ids_sql = f"({', '.join(str(i) for i in record_ids)})"

        try:
            sql = f"SELECT _pk, `linked_ticket` FROM `{table_name}` WHERE _pk IN {ids_sql}"
            res = seadb_api.query_rows(project_uuid, sql)
            rows = res.get('results') or []
        except Exception as e:
            logger.exception(e)
            raise TicketLinkValidationError('Internal Server Error')

        # Check if the records exist
        existed_ids = {int(r.get('_pk')) for r in rows}
        missing_ids = set(record_ids) - existed_ids
        if missing_ids:
            raise TicketLinkValidationError('Linked record not found.')

        # Check if the records are occupied by other tickets
        for r in rows:
            rid = int(r.get('_pk'))
            desired_ticket = record_ticket_map.get(rid)
            if desired_ticket is None:
                continue
            existed_linked = r.get('linked_ticket')
            if existed_linked and int(existed_linked) not in (None, int(desired_ticket)):
                raise TicketLinkValidationError('This record is already linked to a ticket.')

    return sync_plan, connections


def sync_links_in_connection(seadb_api, project_uuid, sync_plan, connections):
    """
    Sync ticket links in connection tables (Discourse topics, GitHub issues, emails) and portal issues.

    Args:
        seadb_api: SeaDB API instance
        project_uuid: project UUID
        sync_plan: TicketLinkSyncPlan instance
        connections: list of ProjectConnections
        now_datetime: current datetime string (required for portal issues)
    """
    # Sync connection records
    if connections:
        # Get connections that support linked_ticket
        connection_map = {c.id: c for c in connections}
        supported_conn_ids = {
            c.id for c in connections
            if c.type in LINKED_TICKET_SUPPORT_TYPES
        }

        # Sync added links: set linked_ticket to the corresponding ticket ID
        for conn_id, record_ticket_map in sync_plan.records_to_link.items():
            if conn_id not in supported_conn_ids:
                continue
            connection = connection_map.get(conn_id)
            table_name = get_connection_table_name(connection.type, conn_id)
            if not table_name:
                continue
            update_rows = [
                {
                    'pk': rid,
                    'row': {'linked_ticket': ticket_id}
                }
                for rid, ticket_id in record_ticket_map.items()
            ]
            if update_rows:
                seadb_api.update_rows(project_uuid, table_name, update_rows)

        # Sync removed links: clear linked_ticket
        for conn_id, record_ticket_map in sync_plan.records_to_unlink.items():
            if conn_id not in supported_conn_ids:
                continue

            connection = connection_map.get(conn_id)
            table_name = get_connection_table_name(connection.type, conn_id)
            if not table_name:
                continue

            record_ids = list(record_ticket_map.keys())
            ids_sql = f"({', '.join(str(i) for i in record_ids)})"

            # Query the current link status
            sql = f"SELECT _pk, `linked_ticket` FROM `{table_name}` WHERE _pk IN {ids_sql}"
            res = seadb_api.query_rows(project_uuid, sql)
            rows = res.get('results') or []

            current_linked = {
                int(r.get('_pk')): r.get('linked_ticket')
                for r in rows if r.get('_pk') is not None
            }

            # Only clear the links that actually point to the current ticket
            clear_rows = []
            for rid, expected_ticket_id in record_ticket_map.items():
                actual_linked = current_linked.get(rid)
                if actual_linked and int(actual_linked) == expected_ticket_id:
                    clear_rows.append({
                        'pk': rid,
                        'row': {'linked_ticket': None}
                    })

            if clear_rows:
                seadb_api.update_rows(project_uuid, table_name, clear_rows)

    # Sync portal issues
    if sync_plan.portal_issue_ids or sync_plan.records_to_unlink.get('portal'):
        # Sync added links
        if sync_plan.portal_issue_ids:
            for portal_issue_id in sync_plan.portal_issue_ids:
                try:
                    portal_issue, _ = get_portal_issue(seadb_api, project_uuid, portal_issue_id)
                    if not portal_issue:
                        continue
                    if not portal_issue.get('linked_ticket'):
                        ticket_id = sync_plan.records_to_link.get('portal', {}).get(portal_issue_id)
                        if ticket_id:
                            seadb_api.update_rows(project_uuid, SchemaTables.PORTAL_ISSUES.table_name(), [{
                                'pk': int(portal_issue_id),
                                'row': {
                                    'linked_ticket': int(ticket_id),
                                }
                            }])
                except Exception as e:
                    logger.error(f'Failed to update portal issue link: {e}')

        # Sync removed links
        portal_unlink_map = sync_plan.records_to_unlink.get('portal', {})
        if portal_unlink_map:
            for portal_issue_id, expected_ticket_id in portal_unlink_map.items():
                try:
                    portal_issue, _ = get_portal_issue(seadb_api, project_uuid, portal_issue_id)
                    if not portal_issue:
                        continue
                    if portal_issue.get('linked_ticket'):
                        actual_linked = int(portal_issue.get('linked_ticket'))
                        if actual_linked == expected_ticket_id:
                            seadb_api.update_rows(project_uuid, SchemaTables.PORTAL_ISSUES.table_name(), [{
                                'pk': int(portal_issue_id),
                                'row': {
                                    'linked_ticket': None,
                                }
                            }])
                except Exception as e:
                    logger.error(f'Failed to unlink portal issue: {e}')

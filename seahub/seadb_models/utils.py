import datetime
import json
import logging
from copy import deepcopy

from seahub.project.constants import ConnectionType, ExtraSourceType, CONNECTION_DISPLAY_ALL_COLUMNS, \
    CONNECTION_MUST_RETURN_COLUMNS, TICKET_DISPLAY_ALL_COLUMNS, KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS, \
    PORTAL_ISSUE_DISPLAY_ALL_COLUMNS
from seahub.project.view_utils import view_data_2_sql, SQLGenerator, SQLGeneratorOptionInvalidError

from seahub.seadb_models.schema_loader import get_seadb_table_schemas

logger = logging.getLogger(__name__)


def ensure_general_task_column_options(seadb_api, project_uuid, connection_id, tasks):
    if not tasks:
        return

    table_name = get_table_name('GeneralTaskTable', connection_id)
    metadata = seadb_api.get_base_metadata(project_uuid)
    table_info = get_current_table_metadata(metadata.get('tables') or [], table_name)
    if not table_info:
        return

    table_id = table_info.get('id')
    columns = table_info.get('columns') or []
    column_name_to_meta = {column.get('name'): column for column in columns}
    target_columns = [
        get_column_name('GeneralTaskTable', 'status'),
        get_column_name('GeneralTaskTable', 'size'),
        get_column_name('GeneralTaskTable', 'priority'),
    ]

    desired_values = {column_name: set() for column_name in target_columns}
    for task in tasks:
        for column_name in target_columns:
            value = task.get(column_name)
            if isinstance(value, list):
                for item in value:
                    if item:
                        desired_values[column_name].add(str(item))
            elif value:
                desired_values[column_name].add(str(value))

    for column_name in target_columns:
        column_meta = column_name_to_meta.get(column_name)
        if not column_meta:
            continue
        column_key = column_meta.get('key')
        old_option_names = {
            option.get('name')
            for option in ((column_meta.get('data') or {}).get('options') or [])
            if option.get('name')
        }
        for option_name in desired_values[column_name] - old_option_names:
            seadb_api.add_column_option(project_uuid, {
                'table_id': table_id,
                'column_key': column_key,
                'option_name': option_name,
            })


def build_general_task_row_data(task, sync_time=None):
    now = sync_time or datetime.datetime.now(datetime.UTC).isoformat()
    others = task.get('others')
    if isinstance(others, (dict, list)):
        others = json.dumps(others, ensure_ascii=False)
    elif others is None:
        others = ''
    else:
        others = str(others)

    assignees = task.get('assignees')
    if not isinstance(assignees, list):
        assignees = []
    participants = task.get('participants')
    if not isinstance(participants, list):
        participants = []
    return {
        get_column_name('GeneralTaskTable', 'source_task_id'): str(task.get('task_id')).strip(),
        get_column_name('GeneralTaskTable', 'url'): str(task.get('url') or '').strip(),
        get_column_name('GeneralTaskTable', 'title'): task.get('title', ''),
        get_column_name('GeneralTaskTable', 'status'): task.get('status'),
        get_column_name('GeneralTaskTable', 'size'): task.get('size'),
        get_column_name('GeneralTaskTable', 'priority'): task.get('priority'),
        get_column_name('GeneralTaskTable', 'assignees'): assignees,
        get_column_name('GeneralTaskTable', 'participants'): participants,
        get_column_name('GeneralTaskTable', 'version'): task.get('version', ''),
        get_column_name('GeneralTaskTable', 'others'): others,
        get_column_name('GeneralTaskTable', 'content'): task.get('description') or task.get('content') or '',
        get_column_name('GeneralTaskTable', 'due_date'): task.get('due_date'),
        get_column_name('GeneralTaskTable', 'modified_time'): task.get('modified_time') or now,
        get_column_name('GeneralTaskTable', 'created_time'): task.get('created_time') or now,
        get_column_name('GeneralTaskTable', 'sync_time'): now,
        get_column_name('GeneralTaskTable', 'record_modified_time'): now,
        get_column_name('GeneralTaskTable', 'deleted'): bool(task.get('deleted', False)),
    }


def get_current_table_metadata(tables, table_name):
    for table in tables:
        if table['name'] == table_name:
            return table
    return None

SCHEMA_TABLE_NAME_CONNECTION = {
    ConnectionType.GITHUB_ISSUE.value: 'GithubIssuesTable',
    ConnectionType.DISCOURSE_FORUM.value: 'DiscourseTopicsTable',
    ConnectionType.SITE.value: 'WebCrawlTable',
    ConnectionType.SEAFILE.value: 'SeafileTable',
    ConnectionType.EMAIL.value: 'ThreadTable',
    ConnectionType.NOTION.value: 'NotionTable',
}


def _resolve_table_name(table_name_schema, connection_id=None):
    if '{connection_id}' in table_name_schema:
        if connection_id is None:
            raise ValueError(f'connection_id is required for table name: {table_name_schema}')
        return table_name_schema.format(connection_id=connection_id)
    return table_name_schema


def _normalize_index(index_item):
    if isinstance(index_item, str):
        return [index_item]
    if isinstance(index_item, list):
        return index_item
    raise ValueError(f'Invalid index config: {index_item}')


def get_table_name(schema_table_name, connection_id=None):
    schema = get_seadb_table_schemas()
    tables = schema.get('tables') or {}
    table_schema = tables.get(schema_table_name) or {}
    table_name_schema = table_schema.get('table_name')
    if table_name_schema:
        return _resolve_table_name(table_name_schema, connection_id)
    return ''


def get_column_name(schema_table_name, column_name):
    """Return the column_name defined in YAML schema, or empty string if column not found. O(1) dict lookup."""
    schema = get_seadb_table_schemas()
    tables = schema.get('tables') or {}
    table_schema = tables.get(schema_table_name) or {}
    columns = table_schema.get('columns') or {}
    if column_name in columns:
        return column_name
    return ''


def get_column_data(schema_table_name, column_name):
    """Return the column_data config for the specified column from YAML schema. O(1) dict lookup."""
    schema = get_seadb_table_schemas()
    tables = schema.get('tables') or {}
    table_schema = tables.get(schema_table_name) or {}
    columns = table_schema.get('columns') or {}
    col = columns.get(column_name)
    if col:
        return col.get('column_data') or {}
    return {}


def init_seadb_tables_from_schema(schema_key, seadb_api, project_uuid, connection_id=None):
    schema = get_seadb_table_schemas()
    table_defs = schema.get('tables') or {}
    init_groups = schema.get('init_groups') or {}
    schema_table_names = init_groups.get(schema_key, [])
    for schema_table_name in schema_table_names:
        table_schema = table_defs.get(schema_table_name) or {}
        table_name = _resolve_table_name(table_schema.get('table_name', ''), connection_id)
        res = seadb_api.create_table(project_uuid, table_name)
        table_id = res['table_id']

        cascade = table_schema.get('cascade') or {}
        source_column = cascade.get('source_column')
        target_column = cascade.get('target_column')
        source_column_key = None

        for column_name, column in table_schema.get('columns', {}).items():
            mapped_column = deepcopy(column)
            mapped_column['column_name'] = column_name
            if column_name == target_column and source_column_key:
                mapped_column.setdefault('column_data', {})
                mapped_column['column_data']['cascade_column_key'] = source_column_key

            added_column = seadb_api.add_column(project_uuid, table_id, mapped_column)
            if column_name == source_column:
                source_column_key = added_column['column_key']

        for index_item in table_schema.get('indexes', []):
            seadb_api.create_column_index(project_uuid, table_id, _normalize_index(index_item))

def ensure_portal_issues_seadb_table(seadb_api, project_uuid):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []

    portal_issues_table_name = get_table_name('PortalIssuesTable')

    portal_issues_table = get_current_table_metadata(tables_metadata, portal_issues_table_name)

    if not portal_issues_table:
        init_seadb_tables_from_schema('init_portal_issues_seadb_table', seadb_api, project_uuid)


def init_general_task_seadb_table(seadb_api, project_uuid, connection_id):
    schema = get_seadb_table_schemas()
    table_defs = (schema.get('tables') or {})

    general_task_schema = table_defs.get('GeneralTaskTable') or {}
    table_name = get_table_name('GeneralTaskTable', connection_id)
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    for column_name, column_schema in (general_task_schema.get('columns') or {}).items():
        mapped_column = {
            'column_name': column_name,
            'column_type': column_schema.get('column_type'),
        }
        if column_schema.get('column_data'):
            mapped_column['column_data'] = column_schema.get('column_data')
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    for index_item in general_task_schema.get('indexes', []):
        seadb_api.create_column_index(project_uuid, table_id, _normalize_index(index_item))

    task_user_schema = table_defs.get('GeneralTaskUserTable') or {}
    task_user_table_name = get_table_name('GeneralTaskUserTable', connection_id)
    res = seadb_api.create_table(project_uuid, task_user_table_name)
    table_id = res['table_id']
    for column_name, column_schema in (task_user_schema.get('columns') or {}).items():
        mapped_column = {
            'column_name': column_name,
            'column_type': column_schema.get('column_type'),
        }
        if column_schema.get('column_data'):
            mapped_column['column_data'] = column_schema.get('column_data')
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    for index_item in task_user_schema.get('indexes', []):
        seadb_api.create_column_index(project_uuid, table_id, _normalize_index(index_item))

def get_connection_table_name(connection_type, connection_id):
    schema_table_name = SCHEMA_TABLE_NAME_CONNECTION.get(connection_type)
    if not schema_table_name:
        return ''
    return get_table_name(schema_table_name, connection_id=connection_id)

def get_connection_columns(seadb_api, project_uuid, connection):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_name = get_connection_table_name(connection.type, connection.id)
    table_metadata = get_current_table_metadata(tables_metadata, str(table_name))
    if not table_metadata:
        return []
    columns = table_metadata.get('columns') or []
    return columns

def get_seadb_table_columns(seadb_api, project_uuid, table_name):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, table_name)
    if not table_metadata:
        return []
    columns = table_metadata.get('columns') or []
    return columns

def list_tickets_view_records(seadb_api, project_uuid, view, username, start, limit):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'tickets')
    if not table_metadata:
        return [], []
    columns = table_metadata.get('columns') or []
    if not columns:
        return [], []
    view_copy = view.copy()
    display_columns = []
    for column in columns:
        name = column['name']
        if name in TICKET_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)
    try:
        sql = view_data_2_sql('tickets', display_columns, view_copy, username, start, limit)
    except SQLGeneratorOptionInvalidError as e:
        e.columns = display_columns
        raise
    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection tickets: {e}')
        records = []
    return records, display_columns


def list_tickets_by_link_search(seadb_api, project_uuid, search_text, start, end):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'tickets')
    if not table_metadata:
        return [], []
    columns = table_metadata.get('columns') or []
    if not columns:
        return [], []
    display_columns = []
    for column in columns:
        name = column['name']
        if name in TICKET_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)
    display_columns_names = [column['name'] for column in display_columns]
    column_join = ', '.join(['`%s`' % column_name for column_name in display_columns_names])
    sql = f'SELECT {column_join} FROM `tickets` WHERE `title` ILIKE "%{search_text}%" AND (`deleted` = False OR `deleted` IS NULL) LIMIT {start}, {end}'
    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection tickets: {e}')
        records = []
    return records, display_columns


def list_tickets_by_search(seadb_api, project_uuid, search_text, start, end):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'tickets')
    if not table_metadata:
        return []

    sql = f'SELECT `_pk`, `title` FROM `tickets` WHERE `title` ILIKE "%{search_text}%" AND (`deleted` = False OR `deleted` IS NULL) LIMIT {start}, {end}'
    ticket_data = seadb_api.query_rows(project_uuid, sql).get('results')
    return ticket_data


def list_my_tickets(seadb_api, project_uuid, username, ticket_state, start, limit, view_config={}):
    columns = get_seadb_table_columns(seadb_api, project_uuid, 'tickets')
    all_columns_names = TICKET_DISPLAY_ALL_COLUMNS.copy()
    if ticket_state == 'open':
        all_columns_names = [column_name for column_name in all_columns_names if column_name != 'closed_time']

    display_columns = []
    for column in columns:
        name = column['name']
        if name in all_columns_names:
            display_columns.append(column)

    view_copy = view_config.copy()
    sorts = view_copy.get('sorts', [])
    if not sorts:
        sorts = [{ 'column_name': 'modified_time', 'sort_type': 'down' }]
    view_copy['sorts'] = sorts
    basic_filters = view_copy.get('basic_filters', [])
    if not basic_filters:
        basic_filters = []
    basic_filters.append({
        'column_name': 'state',
        'filter_predicate': 'is',
        'filter_term': '0001' if ticket_state == 'open' else '0002',
    })
    basic_filters.append({
        'column_name': 'participants',
        'filter_predicate': 'include_me',
    })

    view_copy['basic_filters'] = basic_filters
    try:
        sql = view_data_2_sql('tickets', display_columns, view_copy, username, start, limit)
    except SQLGeneratorOptionInvalidError as e:
        e.columns = display_columns
        raise

    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results')
    except Exception as e:
        logger.error(f'SeaDB query error for connection tickets: {e}')
        records = []
    return records, display_columns


def list_trash_tickets(seadb_api, project_uuid, start, limit):
    query_fields = ", ".join(TICKET_DISPLAY_ALL_COLUMNS)
    sql =  f"SELECT {query_fields} FROM `tickets` WHERE deleted = True LIMIT {limit} OFFSET {start}"
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    records = res.get('results', [])
    columns = get_seadb_table_columns(seadb_api, project_uuid, 'tickets')
    display_columns = []
    for column in columns:
        name = column['name']
        if name in TICKET_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)
    return records, display_columns


def list_trash_portal_issues(seadb_api, project_uuid, start, limit):
    query_fields = ", ".join(PORTAL_ISSUE_DISPLAY_ALL_COLUMNS)
    sql = f"SELECT {query_fields} FROM `portal_issues` WHERE deleted = True LIMIT {limit} OFFSET {start}"
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    records = res.get('results', [])
    columns = get_seadb_table_columns(seadb_api, project_uuid, get_table_name('PortalIssuesTable'))
    display_columns = []
    for column in columns:
        name = column['name']
        if name in PORTAL_ISSUE_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)
    return records, display_columns


def list_my_portal_issues(seadb_api, project_uuid, username, issue_state, start, limit, view_config={}):
    columns = get_seadb_table_columns(seadb_api, project_uuid, get_table_name('PortalIssuesTable'))

    display_columns = []
    for column in columns:
        name = column['name']
        if name in PORTAL_ISSUE_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)

    view_copy = view_config.copy()
    sorts = view_copy.get('sorts', [])
    if not sorts:
        sorts = [{ 'column_name': 'created_time', 'sort_type': 'down' }]
    view_copy['sorts'] = sorts
    basic_filters = view_copy.get('basic_filters', [])
    if not basic_filters:
        basic_filters = []
    basic_filters.append({
        'column_name': 'state',
        'filter_predicate': 'is',
        'filter_term': '0001' if issue_state == 'open' else '0002',
    })

    view_copy['basic_filters'] = basic_filters
    try:
        sql = view_data_2_sql('portal_issues', display_columns, view_copy, username, start, limit)
    except SQLGeneratorOptionInvalidError as e:
        e.columns = display_columns
        raise

    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results') or []
    except Exception as e:
        logger.error(f'SeaDB query error for portal issues: {e}')
        records = []
    return records, display_columns

def list_portal_issues_view_records(seadb_api, project_uuid, view, username, start, limit):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'portal_issues')
    if not table_metadata:
        return [], []
    columns = table_metadata.get('columns') or []
    if not columns:
        return [], []
    view_copy = view.copy()
    display_columns = []
    for column in columns:
        name = column['name']
        if name in PORTAL_ISSUE_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)
    try:
        sql = view_data_2_sql('portal_issues', display_columns, view_copy, username, start, limit)
    except SQLGeneratorOptionInvalidError as e:
        e.columns = display_columns
        raise
    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for portal issues: {e}')
        records = []
    return records, display_columns

def list_connection_view_records(seadb_api, project_uuid, connection, view, start, limit, username=''):
    connection_type = connection.type
    table_name = get_connection_table_name(connection.type, connection.id)
    columns = get_connection_columns(seadb_api, project_uuid, connection)

    if not columns:
        return [], []

    display_names = set(CONNECTION_DISPLAY_ALL_COLUMNS[connection_type])
    extra_query_names = set(CONNECTION_MUST_RETURN_COLUMNS.get(connection_type, []))
    display_all_columns = []
    extra_query_columns = []

    for column in columns:
        name = column['name']
        if name in display_names:
            display_all_columns.append(column)
        elif name in extra_query_names:
            extra_query_columns.append(column)

    all_columns = display_all_columns + extra_query_columns
    view_copy = view.copy()

    try:
        sql = view_data_2_sql(table_name, all_columns, view_copy, username, start, limit)
    except SQLGeneratorOptionInvalidError as e:
        e.columns = all_columns
        raise

    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection {table_name}: {e}')
        records = []
    return records, display_all_columns + extra_query_columns


def list_connection_view_records_with_columns(seadb_api, project_uuid, connection, view, column_names, start, limit, username=''):
    table_name = get_connection_table_name(connection.type, connection.id)
    columns = get_connection_columns(seadb_api, project_uuid, connection)

    if not columns:
        return []

    view_copy = view.copy()
    sql_generator = SQLGenerator(table_name, columns, view_copy, username, start, limit)
    sql_generator.column_names = column_names
    sql = sql_generator.to_sql()
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection {table_name}: {e}')
        records = []
    return records

def list_portal_issue_comments_records(seadb_api, project_uuid, _pk):
    issues_table_name = get_table_name('PortalIssuesTable')
    comments_table_name = get_table_name('PortalIssueCommentsTable')
    issue_query_fields = ', '.join(PORTAL_ISSUE_DISPLAY_ALL_COLUMNS)
    issues_sql = f"SELECT {issue_query_fields} FROM `{issues_table_name}` WHERE _pk = {_pk} AND (`deleted` = False OR `deleted` IS NULL)"
    try:
        from seahub.tickets.ticket_utils import get_ticket_title
        issues_res = seadb_api.query_rows(project_uuid, issues_sql)
        issue = issues_res.get('results')[0]
        column_metadata = issues_res.get('metadata')
        comments_sql = f"SELECT _pk, content, created_time, modified_time, creator FROM `{comments_table_name}` WHERE issue_id = {_pk} AND deleted = False ORDER BY _pk ASC"
        comments_res = seadb_api.query_rows(project_uuid, comments_sql)
        comments_records = comments_res.get('results', [])
        issue['comments'] = comments_records
        linked_ticket = issue.get('linked_ticket')
        linked_ticket_title = get_ticket_title(seadb_api, project_uuid, linked_ticket)
    except Exception as e:
        issue = {}
        column_metadata = []
        linked_ticket_title = ''
        logger.error(f'SeaDB query error for portal issues {issues_table_name}: {e}')
    return issue, column_metadata, linked_ticket_title


def list_discourse_forum_replies_records(seadb_api, project_uuid, connection_id, _pk):
    topics_table_name = get_table_name('DiscourseTopicsTable', connection_id=connection_id)
    replies_table_name = get_table_name('DiscourseRepliesTable', connection_id=connection_id)
    topics_sql = f"SELECT `title`, `topic_id`, `created_time`, `slug`, `linked_ticket`, `outdated`, `resolved` FROM `{topics_table_name}` WHERE _pk = {_pk} AND (`deleted` = False OR `deleted` IS NULL)"
    try:
        from seahub.tickets.ticket_utils import get_ticket_title
        topics_res = seadb_api.query_rows(project_uuid, topics_sql)
        topic_record = topics_res.get('results')[0]
        column_metadata = topics_res.get('metadata')
        topic_id = topic_record.get('topic_id')
        replies_sql = f"SELECT author,content,modified_time FROM `{replies_table_name}` WHERE topic_id = {topic_id} ORDER BY post_number ASC"
        replies_res = seadb_api.query_rows(project_uuid, replies_sql)
        replies_records = replies_res.get('results')
        topic_record['replies'] = replies_records
        linked_ticket = topic_record.get('linked_ticket')
        linked_ticket_title = get_ticket_title(seadb_api, project_uuid, linked_ticket)
    except Exception as e:
        topic_record = {}
        column_metadata = []
        linked_ticket_title = ''
        logger.error(f'SeaDB query error for discourse topics {topics_table_name}: {e}')
    return topic_record, column_metadata, linked_ticket_title


def list_discourse_topics(seadb_api, project_uuid, connection_id, pks):
    topics_table_name = get_table_name('DiscourseTopicsTable', connection_id=connection_id)
    pks_str = ','.join([str(pk) for pk in pks])
    topics_sql = f"SELECT _pk, title, topic_id, created_time FROM `{topics_table_name}` WHERE _pk IN ({pks_str})"
    try:
        topics_res = seadb_api.query_rows(project_uuid, topics_sql)
        topics_records = topics_res.get('results', [])
    except Exception as e:
        topics_records = []
        logger.error(f'SeaDB query error for discourse topics {topics_table_name}: {e}')
    return topics_records


def get_connection_records_by_pks(seadb_api, project_uuid, connection_id, connection_type, pks):
    if not pks:
        return []

    pks_str = ','.join([str(pk) for pk in pks])

    sql = ''
    if connection_type == ConnectionType.GITHUB_ISSUE.value:
        table_name = get_table_name('GithubIssuesTable', connection_id=connection_id)
        sql = f"SELECT _pk, title, state FROM `{table_name}` WHERE _pk IN ({pks_str})"
    elif connection_type == ConnectionType.DISCOURSE_FORUM.value:
        table_name = get_table_name('DiscourseTopicsTable', connection_id=connection_id)
    elif connection_type == ConnectionType.SITE.value:
        table_name = get_table_name('WebCrawlTable', connection_id=connection_id)
    elif connection_type == ConnectionType.SEAFILE.value:
        table_name = get_table_name('SeafileTable', connection_id=connection_id)
    elif connection_type == ConnectionType.EMAIL.value:
        table_name = get_table_name('ThreadTable', connection_id=connection_id)
    elif connection_type == ConnectionType.GENERAL_TASK.value:
        table_name = get_table_name('GeneralTaskTable', connection_id=connection_id)
    else:
        return []

    if not sql:
        sql = f"SELECT _pk, title FROM `{table_name}` WHERE _pk IN ({pks_str})"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for record titles {table_name}: {e}')
        records = []
    return records


def get_issue_record_by_pk(seadb_api, project_uuid, connection_id, _pk):
    issue_table_name = get_table_name('GithubIssuesTable', connection_id=connection_id)
    issue_sql = f"SELECT _pk, title, author, content, created_time, issue_id, issue_number, state, state_reason, labels, issue_type, `url`, `linked_ticket`, `outdated`  FROM `{issue_table_name}` WHERE _pk = {_pk}"
    try:
        issue_res = seadb_api.query_rows(project_uuid, issue_sql)
        issue_record = issue_res.get('results')[0]
        column_metadata = issue_res.get('metadata')
    except Exception as e:
        logger.error(f'SeaDB query error for issue details {issue_table_name}: {e}')
        issue_record = {}
        column_metadata = []
    return issue_record, column_metadata


def list_github_issue_record_details(seadb_api, project_uuid, connection_id, _pk):
    """Query GitHub issue comments from SeaDB"""
    comments_table_name = get_table_name('GithubIssueCommentsTable', connection_id=connection_id)
    from seahub.tickets.ticket_utils import get_ticket_title
    try:
        issue_record, column_metadata = get_issue_record_by_pk(seadb_api, project_uuid, connection_id, _pk)
        issue_id = issue_record.get('issue_id')
        issue_record.pop('issue_id')
        issue_record.pop('issue_number')
        comments_sql = f"SELECT author, content, created_time, comment_id FROM `{comments_table_name}` WHERE issue_id = {issue_id} ORDER BY comment_id ASC"
        comments_res = seadb_api.query_rows(project_uuid, comments_sql)
        comments_record = comments_res.get('results', [])
        issue_record['comments'] = comments_record
        linked_ticket = issue_record.get('linked_ticket')
        linked_ticket_title = get_ticket_title(seadb_api, project_uuid, linked_ticket)
    except Exception as e:
        logger.error(f'SeaDB query error for issue details {comments_table_name}: {e}')
        issue_record = {}
        column_metadata = []
        linked_ticket_title = ''
    return issue_record, column_metadata, linked_ticket_title


def list_seafile_record_details(seadb_api, project_uuid, connection_id, _pk):
    seafile_table_name = get_table_name('SeafileTable', connection_id=connection_id)
    sql = f"SELECT `path`, `title`, `modified_time`, `content` FROM `{seafile_table_name}` WHERE _pk = {_pk}"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        record = res.get('results')[0]
        column_metadata = res.get('metadata')
    except Exception as e:
        logger.error(f'SeaDB query error for seafile details {seafile_table_name}: {e}')
        record = {}
        column_metadata = []
    return record, column_metadata, ''


def list_general_task_record_details(seadb_api, project_uuid, connection_id, _pk):
    general_task_table_name = get_table_name('GeneralTaskTable', connection_id)
    from seahub.tickets.ticket_utils import get_ticket_title
    sql = (
        f"SELECT `_pk`, `title`, `status`, `size`, `priority`, `assignees`, `participants`, `others`, "
        f"`content`, `url`, `due_date`, `modified_time`, `created_time`, `ai_summary`, `ai_processed_time`, "
        f"`linked_ticket`, `outdated`, `version` FROM `{general_task_table_name}` WHERE _pk = {_pk}"
    )
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        record = res.get('results')[0]
        column_metadata = res.get('metadata')
        linked_ticket = record.get('linked_ticket')
        linked_ticket_title = get_ticket_title(seadb_api, project_uuid, linked_ticket)
    except Exception as e:
        logger.error(f'SeaDB query error for general task details {general_task_table_name}: {e}')
        record = {}
        column_metadata = []
        linked_ticket_title = ''
    return record, column_metadata, linked_ticket_title


def list_site_record_details(seadb_api, project_uuid, connection_id, _pk):
    site_table_name = get_table_name('WebCrawlTable', connection_id=connection_id)
    sql = f"SELECT `title`, `url`, `modified_time` FROM `{site_table_name}` WHERE _pk = {_pk}"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        record = res.get('results')[0]
        column_metadata = res.get('metadata')
    except Exception as e:
        logger.error(f'SeaDB query error for site details {site_table_name}: {e}')
        record = {}
        column_metadata = []
    return record, column_metadata, ''


def list_email_record_details(seadb_api, project_uuid, connection_id, _pk):
    email_table_name = get_table_name('EmailTable', connection_id=connection_id)
    thread_table_name = get_table_name('ThreadTable', connection_id=connection_id)
    from seahub.tickets.ticket_utils import get_ticket_title
    try:
        thread_sql = f"SELECT `title`, `modified_time`, `linked_ticket`, `outdated`, `tags`, `unread` FROM `{thread_table_name}` WHERE _pk = {_pk}"
        thread_res = seadb_api.query_rows(project_uuid, thread_sql)
        thread_record = thread_res.get('results')[0]
        column_metadata = thread_res.get('metadata')
        email_sql = f"""
        SELECT 
        email_from, email_to, title, cc, text_content as content, modified_time, is_sender, html_content, email_id, origin_thread_id, attachments, _pk
        FROM `{email_table_name}` WHERE thread_id = {_pk} ORDER BY modified_time ASC
        """
        email_res = seadb_api.query_rows(project_uuid, email_sql)
        email_record = email_res.get('results', [])
        thread_record['emails'] = email_record
        linked_ticket = thread_record.get('linked_ticket')
        linked_ticket_title = get_ticket_title(seadb_api, project_uuid, linked_ticket)
    except Exception as e:
        logger.error(f'SeaDB query error for email details {thread_table_name} or {email_table_name}: {e}')
        thread_record = {}
        column_metadata = []
        linked_ticket_title = ''
    return thread_record, column_metadata, linked_ticket_title


def list_knowledge_base_records(seadb_api, project_uuid, view, start, limit, username):
    knowledge_base_table_name = get_table_name('KnowledgeBaseTable')
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, knowledge_base_table_name)
    if not table_metadata:
        init_seadb_tables_from_schema('init_knowledge_base_seadb_table', seadb_api, project_uuid)
        metadata = seadb_api.get_base_metadata(project_uuid)
        tables_metadata = metadata.get('tables') or []
        table_metadata = get_current_table_metadata(tables_metadata, knowledge_base_table_name)
    columns = table_metadata.get('columns') or []
    view_copy = view.copy()
    display_columns = []
    for column in columns:
        name = column['name']
        if name in KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)

    try:
        sql = view_data_2_sql(knowledge_base_table_name, display_columns, view_copy, username, start, limit)
    except SQLGeneratorOptionInvalidError as e:
        e.columns = display_columns
        raise
    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for knowledge base : {e}')
        records = []
    return records, display_columns


def list_documents_by_search(seadb_api, project_uuid, documents_connection_id_type_map, search_text, limit):
    knowledge_base_table_name = get_table_name('KnowledgeBaseTable')
    search_tables = [
        {
            'name': knowledge_base_table_name,
            'type': 'knowledge_base',
            'fields': ['_pk', 'title']
        }
    ]

    for connection_id, connection_type in documents_connection_id_type_map.items():
        if connection_type == ConnectionType.SITE.value:
            search_tables.append({
                'name': get_table_name('WebCrawlTable', connection_id=connection_id),
                'type': ConnectionType.SITE.value,
                'connection_id': connection_id,
                'fields': ['_pk', 'title', 'url']
            })
        elif connection_type == ConnectionType.SEAFILE.value:
            search_tables.append({
                'name': get_table_name('SeafileTable', connection_id=connection_id),
                'type': ConnectionType.SEAFILE.value,
                'connection_id': connection_id,
                'fields': ['_pk', 'title', 'path']
            })

    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []

    results = []
    for table in search_tables:
        if len(results) >= limit:
            break

        table_metadata = get_current_table_metadata(tables_metadata, table['name'])
        if not table_metadata:
            continue

        fields_str = ''
        for field in table['fields']:
            fields_str += f'`{field}`, '
        if not fields_str:
            continue
        fields_str = fields_str[:-2]

        sql = f'SELECT {fields_str} FROM `{table["name"]}` WHERE `title` ILIKE "%{search_text}%" AND (`deleted` = False OR `deleted` IS NULL) LIMIT 0, {limit - len(results)}'

        for result in seadb_api.query_rows(project_uuid, sql).get('results', []):
            result['type'] = table['type']
            if 'connection_id' in table:
                result['connection_id'] = table['connection_id']
            results.append(result)

    return results


def get_title_and_ai_summary_by_pks(seadb_api, project_uuid, source_type, pks, connection_id=None):
    table_name = ''
    if source_type == ConnectionType.GITHUB_ISSUE.value:
        table_name = get_table_name('GithubIssuesTable', connection_id=connection_id)
    elif source_type == ConnectionType.DISCOURSE_FORUM.value:
        table_name = get_table_name('DiscourseTopicsTable', connection_id=connection_id)
    elif source_type == ConnectionType.SITE.value:
        table_name = get_table_name('WebCrawlTable', connection_id=connection_id)
    elif source_type == ConnectionType.SEAFILE.value:
        table_name = get_table_name('SeafileTable', connection_id=connection_id)
    elif source_type == ConnectionType.EMAIL.value:
        table_name = get_table_name('ThreadTable', connection_id=connection_id)
    elif source_type == ConnectionType.GENERAL_TASK.value:
        table_name = get_table_name('GeneralTaskTable', connection_id=connection_id)
    elif source_type == ExtraSourceType.KNOWLEDGE_BASE.value:
        table_name = get_table_name('KnowledgeBaseTable')
    elif source_type == ExtraSourceType.TICKET.value:
        table_name = get_table_name('TicketsTable')
    elif source_type == ExtraSourceType.PORTAL_ISSUE.value:
        table_name = get_table_name('PortalIssuesTable')

    sql = f"SELECT `_pk`, `title`, `ai_summary` FROM `{table_name}` WHERE `_pk` IN ({','.join([str(pk) for pk in pks])})"
    results = {}
    for result in seadb_api.query_rows(project_uuid, sql).get('results', []):
        results[result['_pk']] = {
            get_column_name('GeneralTaskTable', 'title'): result['title'],
            'ai_summary': result['ai_summary']
        }
    return results


def retrieve_vector_search_rerank_data(seadb_api, project_uuid, results):
    conn_id_type_map = {}
    conn_id_pks_map = {}
    kb_pks = []
    tk_pks = []
    portal_issue_pks = []

    for result in results:
        if result['type'] == ExtraSourceType.TICKET.value:
            tk_pks.append(int(result['_id']))
        elif result['type'] == ExtraSourceType.KNOWLEDGE_BASE.value:
            kb_pks.append(int(result['_id']))
        elif result['type'] == ExtraSourceType.PORTAL_ISSUE.value:
            portal_issue_pks.append(int(result['_id']))
        else:
            connection_id = int(result['connection_id'])
            if connection_id not in conn_id_type_map:
                conn_id_type_map[connection_id] = result['type']
                conn_id_pks_map[connection_id] = []
            conn_id_pks_map[connection_id].append(int(result['_id']))

    conn_id_pk_title_summary_map = {}
    for connection_id, connection_type in conn_id_type_map.items():
        pk_title_summary_map = get_title_and_ai_summary_by_pks(seadb_api, project_uuid, connection_type, list(set(conn_id_pks_map[connection_id])), connection_id)
        if pk_title_summary_map:
            conn_id_pk_title_summary_map[connection_id] = pk_title_summary_map
    tk_pk_title_summary_map = get_title_and_ai_summary_by_pks(seadb_api, project_uuid, ExtraSourceType.TICKET.value, list(set(tk_pks))) if tk_pks else {}
    kb_pk_title_summary_map = get_title_and_ai_summary_by_pks(seadb_api, project_uuid, ExtraSourceType.KNOWLEDGE_BASE.value, list(set(kb_pks))) if kb_pks else {}
    portal_issue_pk_title_summary_map = get_title_and_ai_summary_by_pks(
        seadb_api, project_uuid, ExtraSourceType.PORTAL_ISSUE.value, list(set(portal_issue_pks))
    ) if portal_issue_pks else {}

    new_results_map = {}
    for result in results:
        connection_id = None
        record_id = None
        title_summary = {}
        if result['type'] in ConnectionType and \
            int(result['connection_id']) in conn_id_pk_title_summary_map and \
            int(result['_id']) in conn_id_pk_title_summary_map[int(result['connection_id'])]:
            connection_id = int(result['connection_id'])
            record_id = int(result['_id'])
            title_summary = conn_id_pk_title_summary_map[connection_id][record_id]
        elif result['type'] == ExtraSourceType.KNOWLEDGE_BASE.value and int(result['_id']) in kb_pk_title_summary_map:
            connection_id = ExtraSourceType.KNOWLEDGE_BASE.value
            record_id = int(result['_id'])
            title_summary = kb_pk_title_summary_map[record_id]
        elif result['type'] == ExtraSourceType.TICKET.value and int(result['_id']) in tk_pk_title_summary_map:
            connection_id = ExtraSourceType.TICKET.value
            record_id = int(result['_id'])
            title_summary = tk_pk_title_summary_map[record_id]
        elif result['type'] == ExtraSourceType.PORTAL_ISSUE.value and int(result['_id']) in portal_issue_pk_title_summary_map:
            connection_id = ExtraSourceType.PORTAL_ISSUE.value
            record_id = int(result['_id'])
            title_summary = portal_issue_pk_title_summary_map[record_id]
        else:
            continue
        if connection_id not in new_results_map:
            new_results_map[connection_id] = {}

        if 'snippet' in result:
            existing_record = new_results_map[connection_id].get(record_id)
            if existing_record:
                snippets = existing_record.get('snippets', [])
            else:
                snippets = []
            result['snippets'] = snippets
            result['snippets'].append(result['snippet'])
            result.pop('snippet', None)

        result.update(title_summary)
        result['content'] = '\n.................\n'.join(result.get('snippets')) if result.get('snippets') else result['ai_summary']
        new_results_map[connection_id][record_id] = result

    return [
        result
        for pk_result in new_results_map.values()
        for result in pk_result.values()
    ]


def list_notion_record_details(seadb_api, project_uuid, connection_id, _pk):
    notion_table_name = get_table_name('NotionTable', connection_id=connection_id)
    sql = f"SELECT title, content, created_time, modified_time, creator, page_id  FROM `{notion_table_name}` WHERE _pk = {_pk}"
    try:
        notion_res = seadb_api.query_rows(project_uuid, sql)
        notion_record = notion_res.get('results')[0]
        column_metadata = notion_res.get('metadata')
    except Exception as e:
        logger.error(f'SeaDB query error for notion details {notion_table_name}: {e}')
        notion_record = {}
        column_metadata = []
    return notion_record, column_metadata, ''

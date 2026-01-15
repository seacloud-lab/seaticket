import logging

from seahub.project.constants import ConnectionType, CONNECTION_DISPLAY_ALL_COLUMNS, \
    CONNECTION_MUST_RETURN_COLUMNS, TICKET_DISPLAY_ALL_COLUMNS, KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS
from seahub.project.view_utils import view_data_2_sql, SQLGenerator
from seahub.project.utils import get_current_table_metadata
from seahub.seadb_models.models import WebCrawlTable, DiscourseTopicsTable, DiscourseRepliesTable, GithubIssuesTable, \
    GithubIssueCommentsTable, SeafileTable, TicketsTable, TicketCommentsTable, EmailTable, ThreadTable, \
    KnowledgeBaseTable, ProjectTagsTable, PropertyTypes

logger = logging.getLogger(__name__)


def fetch_records_by_table_batch(seadb_api, project_uuid, table_name, pks):
    """Batch fetch records by table name and primary keys.

    Returns:
        dict: {_pk: record_dict}
    """
    if not table_name or not pks:
        return {}

    try:
        pks_str = ','.join(map(str, pks))
        sql = (
            f"SELECT * FROM `{table_name}` WHERE _pk IN ({pks_str}) "
            "AND (`deleted` = False OR `deleted` IS NULL)"
        )
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
        return {record.get('_pk'): record for record in records}
    except Exception as e:
        logger.error(f'Error batch querying `{table_name}`: {e}')
        return {}


def fetch_tickets_batch(seadb_api, project_uuid, ticket_pks):
    return fetch_records_by_table_batch(seadb_api, project_uuid, 'tickets', ticket_pks)


def fetch_issue_type_connection_records_batch(seadb_api, project_uuid, connection_id, connection_type, pks):
    table_name = None
    if connection_type == ConnectionType.GITHUB_ISSUE.value:
        table_name = GithubIssuesTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.DISCOURSE_FORUM.value:
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.EMAIL.value:
        table_name = ThreadTable.gen_table_name(connection_id)
    else:
        logger.warning(f'Unsupported issue connection type: {connection_type}')
        return {}

    return fetch_records_by_table_batch(seadb_api, project_uuid, table_name, pks)


def init_site_seadb_table(seadb_api, project_uuid, connection_id):
    site_table_name = WebCrawlTable.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, site_table_name)
    table_id = res['table_id']
    web_crawl_table = WebCrawlTable
    for column in web_crawl_table.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data

        seadb_api.add_column(project_uuid, table_id, mapped_column)

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            web_crawl_table.url.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            web_crawl_table.modified_time.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            web_crawl_table.deleted.name,
        ]
    )

def init_github_issues_seadb_table(seadb_api, project_uuid, connection_id):
    github_issues_table = GithubIssuesTable
    issues_table_name = github_issues_table.gen_table_name(connection_id)
    github_issue_comments_table = GithubIssueCommentsTable
    res = seadb_api.create_table(project_uuid, issues_table_name)
    table_id = res['table_id']
    for column in github_issues_table.get_fields():

        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }

        if column.data:
            mapped_column['column_data'] = column.data

        seadb_api.add_column(project_uuid, table_id, mapped_column)

    # add columns index
    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.issue_id.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.state.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.state_reason.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.labels.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.title.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.author.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.created_time.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.closed_time.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.deleted.name
        ],
    )

    comments_table_name = github_issue_comments_table.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, comments_table_name)
    table_id = res['table_id']
    for column in github_issue_comments_table.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issue_comments_table.issue_id.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issue_comments_table.comment_id.name
        ],
    )


def init_discourse_forum_seadb_table(seadb_api, project_uuid, connection_id):
    """Initialize SeaDB tables for Discourse Forum connection"""
    # Create topics table
    discourse_topics_table = DiscourseTopicsTable
    topics_table_name = discourse_topics_table.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, topics_table_name)
    topics_table_id = res['table_id']
    for column in discourse_topics_table.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, topics_table_id, mapped_column)
    # Create topic columns index for seadb
    seadb_api.create_column_index(
        project_uuid,
        topics_table_id,
        [
            discourse_topics_table.topic_id.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        topics_table_id,
        [
            discourse_topics_table.sync_time.name
        ],
    )

    seadb_api.create_column_index(
        project_uuid,
        topics_table_id,
        [
            discourse_topics_table.deleted.name
        ],
    )

    # Create replies table
    discourse_replies_table = DiscourseRepliesTable
    replies_table_name = discourse_replies_table.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, replies_table_name)
    replies_table_id = res['table_id']
    for column in discourse_replies_table.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, replies_table_id, mapped_column)

    # Create replies table index for seadb
    seadb_api.create_column_index(
        project_uuid,
        replies_table_id,
        [
            discourse_replies_table.topic_id.name
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        replies_table_id,
        [
            discourse_replies_table.post_number.name
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        replies_table_id,
        [
            discourse_replies_table.modified_time.name,
        ]
    )


def init_seafile_seadb_table(seadb_api, project_uuid, connection_id):
    seafile_table_name = SeafileTable.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, seafile_table_name)
    table_id = res['table_id']
    for column in SeafileTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            SeafileTable.path.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            SeafileTable.title.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            SeafileTable.deleted.name,
        ]
    )


def init_ticket_seadb_table(seadb_api, project_uuid):
    """Initialize SeaDB tables for Ticket"""
    # Create tickets table
    res = seadb_api.create_table(project_uuid, 'tickets')
    tickets_table_id = res['table_id']
    status_column_key = None
    for column in TicketsTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column["column_data"] = column.data
        if column.name == 'substate' and status_column_key:
            mapped_column['column_data']['cascade_column_key'] = status_column_key
        added_column = seadb_api.add_column(project_uuid, tickets_table_id, mapped_column)
        if column.name == TicketsTable.state.name:
            status_column_key = added_column['column_key']
    # Create tickets table index for seadb
    ticket_index_columns = [
        TicketsTable.priority.name,
        TicketsTable.state.name,
        TicketsTable.substate.name,
        TicketsTable.type.name,
        TicketsTable.assignees.name,
        TicketsTable.participants.name,
        TicketsTable.creator.name,
        TicketsTable.deleted.name,
    ]
    for column in ticket_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            tickets_table_id,
            [column],
        )

    # Create comments table
    res = seadb_api.create_table(project_uuid, 'ticket_comments')
    comments_table_id = res['table_id']
    for column in TicketCommentsTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column["column_data"] = column.data
        seadb_api.add_column(project_uuid, comments_table_id, mapped_column)

    # Create comments table index for seadb
    ticket_comments_index_columns = [
        TicketCommentsTable.ticket_id.name,
        TicketCommentsTable.creator.name,
        TicketCommentsTable.deleted.name,
    ]
    for column in ticket_comments_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            comments_table_id,
            [column],
        )


def init_email_seadb_table(seadb_api, project_uuid, connection_id):
    table_name = EmailTable.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    for column in EmailTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    index_column_names = [EmailTable.title.name, EmailTable.email_from.name, EmailTable.sync_time.name, EmailTable.is_sender.name]

    for column_name in index_column_names:
        seadb_api.create_column_index(
            project_uuid,
            table_id,
            [
                column_name,
            ]
        )

    # thread table
    table_name = ThreadTable.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    for column in ThreadTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    index_column_names = [
        ThreadTable.title.name,
        ThreadTable.modified_time.name,
        ThreadTable.deleted.name,
        ThreadTable.sync_time.name
    ]

    for column_name in index_column_names:
        seadb_api.create_column_index(
            project_uuid,
            table_id,
            [
                column_name,
            ]
        )


def init_knowledge_base_seadb_table(seadb_api, project_uuid):
    table_name = KnowledgeBaseTable.gen_table_name()
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    for column in KnowledgeBaseTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            KnowledgeBaseTable.creator.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            KnowledgeBaseTable.created_time.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            KnowledgeBaseTable.last_modifier.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            KnowledgeBaseTable.modified_time.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            KnowledgeBaseTable.deleted.name,
        ]
    )


def init_project_tags_seadb_table(seadb_api, project_uuid):
    table_name = ProjectTagsTable.gen_table_name()
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    for column in ProjectTagsTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            ProjectTagsTable.ticket_id.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            ProjectTagsTable.knowledge_id.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            ProjectTagsTable.tags.name,
        ]
    )

def get_connection_table_name(connection):
    connection_id = connection.id
    connection_type = connection.type
    table_name = ''
    if connection_type == ConnectionType.GITHUB_ISSUE.value:
        table_name = GithubIssuesTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.DISCOURSE_FORUM.value:
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.SITE.value:
        table_name = WebCrawlTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.SEAFILE.value:
        table_name = SeafileTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.EMAIL.value:
        table_name = ThreadTable.gen_table_name(connection_id)

    return table_name

def get_connection_columns(seadb_api, project_uuid, connection):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_name = get_connection_table_name(connection)
    table_metadata = get_current_table_metadata(tables_metadata, str(table_name))
    if not table_metadata:
        return []
    columns = table_metadata.get('columns') or []
    return columns

def get_tickets_columns(seadb_api, project_uuid):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'tickets')
    if not table_metadata:
        return []
    columns = table_metadata.get('columns') or []
    return columns

def list_tickets_view_records(seadb_api, project_uuid, view, username, start, limit, join_config=None):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'tickets')
    if not table_metadata:
        return []
    columns = table_metadata.get('columns') or []
    view_copy = view.copy()
    display_columns = []
    for column in columns:
        name = column['name']
        if name in TICKET_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)

    # If columns come from joined tables (e.g. project_tags.tags), they won't exist in
    # tickets table metadata. But SQL generation relies on the provided columns list
    # to decide which fields to SELECT.
    if join_config:
        join_column_sources = join_config.get('column_sources') or {}
        join_column_map = join_config.get('join_column_map') or {}
        extra_column_names = set()
        for col_name, source in join_column_sources.items():
            if source == 'join':
                extra_column_names.add(col_name)
        extra_column_names.update(join_column_map.keys())

        existing_names = {c.get('name') for c in display_columns}
        for col_name in extra_column_names:
            if col_name in existing_names:
                continue
            if col_name not in TICKET_DISPLAY_ALL_COLUMNS:
                continue
            # Provide a minimal column schema so filters can be translated to SQL.
            # `tags` is treated as a multiple-select like field.
            col_type = PropertyTypes.MULTIPLE_SELECT if col_name == 'tags' else PropertyTypes.TEXT
            display_columns.append({'name': col_name, 'key': col_name, 'type': col_type})

    if join_config:
        view_copy['join_config'] = join_config
    sql = view_data_2_sql('tickets', display_columns, view_copy, username, start, limit)

    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
        columns_metadata = res.get('metadata', {})
    except Exception as e:
        logger.error(f'SeaDB query error for knowledge base: {e}')
        logger.error(f'SeaDB query error for connection tickets: {e}')
        columns_metadata = {}
        records = []

    return records, columns_metadata


def list_tickets_by_search(seadb_api, project_uuid, search_text, start, end):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'tickets')
    if not table_metadata:
        return []

    sql = f'SELECT `_pk`, `title` FROM `tickets` WHERE `title` ILIKE "%{search_text}%" AND (`deleted` = False OR `deleted` IS NULL) LIMIT {start}, {end}'
    ticket_data = seadb_api.query_rows(project_uuid, sql).get('results')
    return ticket_data


def list_my_tickets(seadb_api, project_uuid, username, ticket_state, start, limit, view_config={}, join_config=None):
    columns = get_tickets_columns(seadb_api, project_uuid)
    all_columns_names = TICKET_DISPLAY_ALL_COLUMNS.copy()
    if ticket_state == 'open':
        all_columns_names = [column_name for column_name in all_columns_names if column_name != TicketsTable.closed_time.name]

    display_columns = []
    for column in columns:
        name = column['name']
        if name in all_columns_names:
            display_columns.append(column)

    # If columns come from joined tables (e.g. project_tags.tags), they won't exist in
    # tickets table metadata. But SQL generation relies on the provided columns list
    # to decide which fields to SELECT.
    if join_config:
        join_column_sources = join_config.get('column_sources') or {}
        join_column_map = join_config.get('join_column_map') or {}
        extra_column_names = set()
        for col_name, source in join_column_sources.items():
            if source == 'join':
                extra_column_names.add(col_name)
        extra_column_names.update(join_column_map.keys())

        existing_names = {c.get('name') for c in display_columns}
        for col_name in extra_column_names:
            if col_name in existing_names:
                continue
            if col_name not in all_columns_names:
                continue
            # Provide a minimal column schema so filters can be translated to SQL.
            # `tags` is treated as a multiple-select like field.
            col_type = PropertyTypes.MULTIPLE_SELECT if col_name == 'tags' else PropertyTypes.TEXT
            display_columns.append({'name': col_name, 'key': col_name, 'type': col_type})

    view_copy = view_config.copy()
    sorts = view_copy.get('sorts', [])
    if not sorts:
        sorts = [{ 'column_name': TicketsTable.modified_time.name, 'sort_type': 'down' }]
    view_copy['sorts'] = sorts
    basic_filters = view_copy.get('basic_filters', [])
    if not basic_filters:
        basic_filters = []
    basic_filters.append({
        'column_name': TicketsTable.state.name,
        'filter_predicate': 'is',
        'filter_term': '0001' if ticket_state == 'open' else '0002',
    })
    basic_filters.append({
        'column_name': TicketsTable.participants.name,
        'filter_predicate': 'include_me',
    })

    view_copy['basic_filters'] = basic_filters

    if join_config:
        view_copy['join_config'] = join_config

    sql = view_data_2_sql('tickets', display_columns, view_copy, username, start, limit)
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    records = res.get('results')
    columns_metadata = res.get('metadata', {})
    return records, columns_metadata


def list_trash_tickets(seadb_api, project_uuid, start, limit, join_config=None):
    base_alias = 't'
    join_alias = 'pt'
    join_table = None
    join_on_condition = None
    use_comma_join = False
    column_sources = {}
    join_column_map = {}

    if join_config and join_config.get('enable', True):
        join_table = join_config.get('join_table')
        base_column = join_config.get('base_column')
        join_column = join_config.get('join_column')
        base_alias = join_config.get('base_alias') or base_alias
        join_alias = join_config.get('join_alias') or join_alias
        join_type = (join_config.get('join_type') or 'LEFT JOIN').strip().upper()
        use_comma_join = join_type in ('INNER JOIN', 'JOIN')
        if join_table and base_column and join_column:
            join_on_condition = f"{base_alias}.`{base_column}` = {join_alias}.`{join_column}`"
        column_sources = join_config.get('column_sources') or {}
        join_column_map = join_config.get('join_column_map') or {}

    select_exprs = []
    for col_name in TICKET_DISPLAY_ALL_COLUMNS:
        source = column_sources.get(col_name) or 'base'
        if source == 'join' and join_table:
            join_col = join_column_map.get(col_name) or col_name
            select_exprs.append(f"{join_alias}.`{join_col}`")
        else:
            select_exprs.append(f"{base_alias}.`{col_name}`")
    query_fields = ", ".join(select_exprs)

    if join_table and join_on_condition:
        if use_comma_join:
            from_clause = f"`tickets` {base_alias}, `{join_table}` {join_alias}"
            where_clause = f"WHERE {base_alias}.`deleted` = True AND ({join_on_condition})"
        else:
            from_clause = f"`tickets` AS {base_alias} {join_config.get('join_type') or 'LEFT JOIN'} `{join_table}` AS {join_alias} ON {join_on_condition}"
            where_clause = f"WHERE {base_alias}.`deleted` = True"
    else:
        from_clause = f"`tickets` {base_alias}"
        where_clause = f"WHERE {base_alias}.`deleted` = True"

    sql = f"SELECT {query_fields} FROM {from_clause} {where_clause} LIMIT {limit} OFFSET {start}"
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    records = res.get('results', [])
    columns_metadata = res.get('metadata', {})

    # Normalize tags from option names to option ids for frontend TagsFormatter.
    if records:
        try:
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            tables_metadata = base_metadata.get('tables') or []
            project_tags_meta = get_current_table_metadata(tables_metadata, 'project_tags')
            tags_col = None
            if project_tags_meta:
                for c in (project_tags_meta.get('columns') or []):
                    if c.get('name') == 'tags':
                        tags_col = c
                        break
            options = ((tags_col or {}).get('data') or {}).get('options', []) or []
            name_to_id = {opt.get('name'): opt.get('id') for opt in options if opt.get('name') and opt.get('id')}
            if name_to_id:
                for r in records:
                    tags = r.get('tags')
                    if not isinstance(tags, list) or not tags:
                        continue
                    r['tags'] = [name_to_id.get(t, t) for t in tags if t is not None]
        except Exception:
            pass
    return records, columns_metadata


def list_connection_view_records(seadb_api, project_uuid, connection, view, start, limit, username=''):
    connection_type = connection.type
    table_name = get_connection_table_name(connection)
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

    view_copy = view.copy()
    sql = view_data_2_sql(table_name, display_all_columns + extra_query_columns, view_copy, username, start, limit)
    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection {table_name}: {e}')
        records = []
    return records, display_all_columns + extra_query_columns


def list_connection_view_records_with_columns(seadb_api, project_uuid, connection, view, column_names, start, limit, username=''):
    table_name = get_connection_table_name(connection)
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


def list_discourse_forum_replies_records(seadb_api, project_uuid, connection_id, _pk):
    topics_table_name = DiscourseTopicsTable.gen_table_name(connection_id)
    replies_table_name = DiscourseRepliesTable.gen_table_name(connection_id)
    topics_sql = f"SELECT title, topic_id, created_time, `slug` FROM `{topics_table_name}` WHERE _pk = {_pk} AND (`deleted` = False OR `deleted` IS NULL)"
    try:
        topics_res = seadb_api.query_rows(project_uuid, topics_sql)
        topic_record = topics_res.get('results')[0]
        topic_id = topic_record.get('topic_id')
        replies_sql = f"SELECT author,content,modified_time FROM `{replies_table_name}` WHERE topic_id = {topic_id} ORDER BY post_number ASC"
        replies_res = seadb_api.query_rows(project_uuid, replies_sql)
        replies_records = replies_res.get('results')
        topic_record['replies'] = replies_records
    except Exception as e:
        topic_record = {}
        logger.error(f'SeaDB query error for discourse topics {topics_table_name}: {e}')
    return topic_record


def list_github_issue_record_details(seadb_api, project_uuid, connection_id, _pk):
    """Query GitHub issue comments from SeaDB"""
    issue_table_name = GithubIssuesTable.gen_table_name(connection_id)
    comments_table_name = GithubIssueCommentsTable.gen_table_name(connection_id)
    issue_sql = f"SELECT title, author, content, created_time, issue_id, `url` FROM `{issue_table_name}` WHERE _pk = {_pk}"
    try:
        issue_res = seadb_api.query_rows(project_uuid, issue_sql)
        issue_record = issue_res.get('results')[0]
        issue_id = issue_res.get('results')[0].get('issue_id')
        issue_record.pop('issue_id')
        comments_sql = f"SELECT author, content, created_time FROM `{comments_table_name}` WHERE issue_id = {issue_id} ORDER BY comment_id ASC"
        comments_res = seadb_api.query_rows(project_uuid, comments_sql)
        comments_record = comments_res.get('results', [])
        issue_record['comments'] = comments_record
    except Exception as e:
        logger.error(f'SeaDB query error for issue details {issue_table_name} or {comments_table_name}: {e}')
        issue_record = {}
    return issue_record


def list_seafile_record_details(seadb_api, project_uuid, connection_id, _pk):
    seafile_table_name = SeafileTable.gen_table_name(connection_id)
    sql = f"SELECT `path`, `title`, `modified_time`, `content` FROM `{seafile_table_name}` WHERE _pk = {_pk}"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        record = res.get('results')[0]
    except Exception as e:
        logger.error(f'SeaDB query error for seafile details {seafile_table_name}: {e}')
        record = {}
    return record

def list_site_record_details(seadb_api, project_uuid, connection_id, _pk):
    site_table_name = WebCrawlTable.gen_table_name(connection_id)
    sql = f"SELECT `{WebCrawlTable.title.name}`, `{WebCrawlTable.url.name}`, `{WebCrawlTable.modified_time.name}` FROM `{site_table_name}` WHERE _pk = {_pk}"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        record = res.get('results')[0]
    except Exception as e:
        logger.error(f'SeaDB query error for site details {site_table_name}: {e}')
        record = {}
    return record


def list_email_record_details(seadb_api, project_uuid, connection_id, _pk):
    email_table_name = EmailTable.gen_table_name(connection_id)
    thread_table_name = ThreadTable.gen_table_name(connection_id)
    try:
        thread_sql = f"SELECT title, modified_time FROM `{thread_table_name}` WHERE _pk = {_pk}"
        thread_res = seadb_api.query_rows(project_uuid, thread_sql)
        thread_record = thread_res.get('results')[0]
        email_sql = f"SELECT email_from, email_to, title, cc, content, modified_time, is_sender, html_content FROM `{email_table_name}` WHERE thread_id = {_pk} ORDER BY {EmailTable.modified_time.name} ASC"
        email_res = seadb_api.query_rows(project_uuid, email_sql)
        email_record = email_res.get('results', [])
        thread_record['emails'] = email_record
    except Exception as e:
        logger.error(f'SeaDB query error for email details {thread_table_name} or {email_table_name}: {e}')
        thread_record = {}
    return thread_record


def list_knowledge_base_records(seadb_api, project_uuid, view, start, limit, username, join_config=None):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, KnowledgeBaseTable.gen_table_name())
    if not table_metadata:
        init_knowledge_base_seadb_table(seadb_api, project_uuid)
        metadata = seadb_api.get_base_metadata(project_uuid)
        tables_metadata = metadata.get('tables') or []
        table_metadata = get_current_table_metadata(tables_metadata, KnowledgeBaseTable.gen_table_name())
    columns = table_metadata.get('columns') or []
    view_copy = view.copy()
    display_columns = []
    for column in columns:
        name = column['name']
        if name in KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)

    if join_config:
        join_column_sources = join_config.get('column_sources') or {}
        join_column_map = join_config.get('join_column_map') or {}
        extra_column_names = set()
        for col_name, source in join_column_sources.items():
            if source == 'join':
                extra_column_names.add(col_name)
        extra_column_names.update(join_column_map.keys())

        existing_names = {c.get('name') for c in display_columns}
        for col_name in extra_column_names:
            if col_name in existing_names:
                continue
            if col_name not in KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS:
                continue
            # Provide a minimal column schema so filters can be translated to SQL.
            # `tags` is treated as a multiple-select like field.
            col_type = PropertyTypes.MULTIPLE_SELECT if col_name == 'tags' else PropertyTypes.TEXT
            display_columns.append({'name': col_name, 'key': col_name, 'type': col_type})

    if join_config:
        view_copy['join_config'] = join_config
    sql = view_data_2_sql(KnowledgeBaseTable.gen_table_name(), display_columns, view_copy, username, start, limit)
    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
        columns_metadata = res.get('metadata', {})
    except Exception as e:
        logger.error(f'SeaDB query error for knowledge base : {e}')
        records = []
        columns_metadata = {}

    # Normalize tags from option names to option ids for frontend TagsFormatter.
    if records:
        try:
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            tables_metadata = base_metadata.get('tables') or []
            project_tags_meta = get_current_table_metadata(tables_metadata, 'project_tags')
            tags_col = None
            if project_tags_meta:
                for c in (project_tags_meta.get('columns') or []):
                    if c.get('name') == 'tags':
                        tags_col = c
                        break
            options = ((tags_col or {}).get('data') or {}).get('options', []) or []
            name_to_id = {opt.get('name'): opt.get('id') for opt in options if opt.get('name') and opt.get('id')}
            if name_to_id:
                for r in records:
                    tags = r.get('tags')
                    if not isinstance(tags, list) or not tags:
                        continue
                    r['tags'] = [name_to_id.get(t, t) for t in tags if t is not None]
        except Exception:
            pass
    return records, columns_metadata

def list_trash_knowledge_base(seadb_api, project_uuid, start, limit, join_config=None):
    base_alias = 't'
    join_alias = 'pt'
    join_table = None
    join_on_condition = None
    use_comma_join = False
    column_sources = {}
    join_column_map = {}

    if join_config and join_config.get('enable', True):
        join_table = join_config.get('join_table')
        base_column = join_config.get('base_column')
        join_column = join_config.get('join_column')
        base_alias = join_config.get('base_alias') or base_alias
        join_alias = join_config.get('join_alias') or join_alias
        join_type = (join_config.get('join_type') or 'LEFT JOIN').strip().upper()
        use_comma_join = join_type in ('INNER JOIN', 'JOIN')
        if join_table and base_column and join_column:
            join_on_condition = f"{base_alias}.`{base_column}` = {join_alias}.`{join_column}`"
        column_sources = join_config.get('column_sources') or {}
        join_column_map = join_config.get('join_column_map') or {}

    select_exprs = []
    for col_name in KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS:
        source = column_sources.get(col_name) or 'base'
        if source == 'join' and join_table:
            join_col = join_column_map.get(col_name) or col_name
            select_exprs.append(f"{join_alias}.`{join_col}` AS `{col_name}`")
        else:
            select_exprs.append(f"{base_alias}.`{col_name}`")
    query_fields = ", ".join(select_exprs)

    if join_table and join_on_condition:
        if use_comma_join:
            from_clause = f"`knowledge_base` {base_alias}, `{join_table}` {join_alias}"
            where_clause = f"WHERE {base_alias}.`deleted` = True AND ({join_on_condition})"
        else:
            from_clause = f"`knowledge_base` AS {base_alias} {join_config.get('join_type') or 'LEFT JOIN'} `{join_table}` AS {join_alias} ON {join_on_condition}"
            where_clause = f"WHERE {base_alias}.`deleted` = True"
    else:
        from_clause = f"`knowledge_base` {base_alias}"
        where_clause = f"WHERE {base_alias}.`deleted` = True"

    sql = f"SELECT {query_fields} FROM {from_clause} {where_clause} LIMIT {limit} OFFSET {start}"
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    records = res.get('results', [])
    columns_metadata = res.get('metadata', {})
    return records, columns_metadata

def list_documents_by_search(seadb_api, project_uuid, documents_connection_id_type_map, search_text, limit):
    search_tables = [
        {
            'name': KnowledgeBaseTable.gen_table_name(),
            'type': 'knowledge_base',
            'fields': ['_pk', 'title']
        }
    ]

    for connection_id, connection_type in documents_connection_id_type_map.items():
        if connection_type == ConnectionType.SITE.value:
            search_tables.append({
                'name': WebCrawlTable.gen_table_name(connection_id),
                'type': ConnectionType.SITE.value,
                'connection_id': connection_id,
                'fields': ['_pk', 'title', 'url']
            })
        elif connection_type == ConnectionType.SEAFILE.value:
            search_tables.append({
                'name': SeafileTable.gen_table_name(connection_id),
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

        for result in seadb_api.query_rows(project_uuid, sql).get('results'):
            result['type'] = table['type']
            if 'connection_id' in table:
                result['connection_id'] = table['connection_id']
            results.append(result)

    return results


def get_tag_counts_by_link_type(seadb_api, project_uuid, link_type):
    if link_type == 'tickets':
        sql = (
            "SELECT pt.`tags`, COUNT(*) AS count "
            "FROM `project_tags` pt, `tickets` t "
            "WHERE pt.`ticket_id` = t.`_pk` AND (t.`deleted` = False OR t.`deleted` is NULL) "
            "GROUP BY pt.`tags`"
        )
    elif link_type == 'knowledge_base':
        sql = (
            "SELECT pt.`tags`, COUNT(*) AS count "
            "FROM `project_tags` pt, `knowledge_base` kb "
            "WHERE pt.`knowledge_id` = kb.`_pk` AND (kb.`deleted` = False OR kb.`deleted` is NULL) "
            "GROUP BY pt.`tags`"
        )
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results') or []
    metadata = res.get('metadata')
    column = next((column for column in metadata if column['name'] == 'tags'), None)
    if not column:
        return [], {}
    column_data = (column.get('data') or {})
    options = column_data.get('options', []) or []
    # tags is array; others are scalar strings
    option_name_to_option_count = {row.get('project_tags.tags')[0]: row.get('count') for row in rows if row.get('project_tags.tags')}
    if link_type == 'tickets':
        for option in options:
            option['tickets_count'] = option_name_to_option_count.get(option.get('name'), 0)
    elif link_type == 'knowledge_base':
        for option in options:
            option['records_count'] = option_name_to_option_count.get(option.get('name'), 0)
    return options, column

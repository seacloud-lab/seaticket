import logging

from seahub.project.constants import ConnectionType, CONNECTION_DISPLAY_ALL_COLUMNS, \
    CONNECTION_MUST_RETURN_COLUMNS, TICKET_DISPLAY_ALL_COLUMNS, KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS
from seahub.project.view_utils import view_data_2_sql, SQLGenerator
from seahub.project.utils import get_current_table_metadata
from seahub.seadb_models.models import WebCrawlTable, DiscourseTopicsTable, DiscourseRepliesTable, GithubIssuesTable, \
    GithubIssueCommentsTable, SeafileTable, TicketsTable, TicketRepliesTable, EmailTable, KnowledgeBaseTable

logger = logging.getLogger(__name__)


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
            github_issues_table.closed_at.name
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

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            github_issues_table.deleted.name
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
        if column.name == 'status':
            status_column_key = added_column['column_key']
    # Create tickets table index for seadb
    ticket_index_columns = [
        TicketsTable.priority.name,
        TicketsTable.state.name,
        TicketsTable.substate.name,
        TicketsTable.type.name,
        TicketsTable.tags.name,
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

    # Create replies table
    res = seadb_api.create_table(project_uuid, 'ticket_replies')
    replies_table_id = res['table_id']
    for column in TicketRepliesTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column["column_data"] = column.data
        seadb_api.add_column(project_uuid, replies_table_id, mapped_column)

    # Create replies table index for seadb
    ticket_replies_index_columns = [
        TicketRepliesTable.ticket_id.name,
        TicketRepliesTable.creator.name,
        TicketRepliesTable.deleted.name,
    ]
    for column in ticket_replies_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            replies_table_id,
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

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            EmailTable.title.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            EmailTable.email_from.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            EmailTable.deleted.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            EmailTable.sync_time.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            EmailTable.is_sender.name,
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
        table_name = EmailTable.gen_table_name(connection_id)

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

def list_tickets_view_records(seadb_api, project_uuid, view, username, start, limit):
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
    sql = view_data_2_sql('tickets', display_columns, view_copy, username, start, limit, include_deleted=True)
    try:
        res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection tickets: {e}')
        records = []
    return records, display_columns


def list_tickets_by_search(seadb_api, project_uuid, search_text, start, end, username=''):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, 'tickets')
    if not table_metadata:
        return []
    for column in (table_metadata or {}).get('columns', []):
        if column.get('name') == 'title':
            title_column = column
        if column.get('name') == 'priority':
            priority_column = column

    view = {
            'basic_filters': [],
            'filters': [
                {'column_key': title_column.get('key'), 'filter_predicate': 'contains', 'filter_term': search_text}
            ] if search_text else [],
            'filter_conjunction': 'Or',
            'sorts': [
                {'column_key': priority_column.get('key'), 'sort_type': 'down'}
            ]
        }

    columns = table_metadata.get('columns') or []
    display_columns = [column for column in columns if column['name'] in ['_pk', 'title']]
    sql = view_data_2_sql('tickets', display_columns, view, username, start, end, include_deleted=True)
    ticket_data = seadb_api.query_rows(project_uuid, sql).get('results')
    return ticket_data

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
    return records, display_all_columns


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


def list_discourse_forum_replies_records(seadb_api, project_uuid, topics_table_name, replies_table_name, _pk):
    topics_sql = f"SELECT * FROM `{topics_table_name}` WHERE _pk = {_pk}"
    try:
        topics_res = seadb_api.query_rows(project_uuid, topics_sql)
        topic_id = topics_res.get('results')[0].get('topic_id')
        replies_sql = f"SELECT author,content,modified_time FROM `{replies_table_name}` WHERE topic_id = {topic_id} ORDER BY post_number ASC"
        replies_res = seadb_api.query_rows(project_uuid, replies_sql)
        records = replies_res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for discourse topics {topics_table_name}: {e}')
        records = []
    return records


def list_github_issue_record_details(seadb_api, project_uuid, issue_table_name, comments_table_name, _pk):
    """Query GitHub issue comments from SeaDB"""
    issue_sql = f"SELECT author, content, created_time, issue_id FROM `{issue_table_name}` WHERE _pk = {_pk}"
    try:
        issue_res = seadb_api.query_rows(project_uuid, issue_sql)
        issue_record = issue_res.get('results', [])
        issue_id = issue_record[0].get('issue_id')
        comments_sql = f"SELECT author, content, created_time, issue_id FROM `{comments_table_name}` WHERE issue_id = {issue_id} ORDER BY comment_id ASC"
        comments_res = seadb_api.query_rows(project_uuid, comments_sql)
        comments_record = comments_res.get('results', [])
        issue_record.extend(comments_record)
    except Exception as e:
        logger.error(f'SeaDB query error for issue details {issue_table_name} or {comments_table_name}: {e}')
        issue_record = []
    return issue_record


def list_seafile_record_details(seadb_api, project_uuid, seafile_table_name, _pk):
    sql = f"SELECT `path`, `title`, `modified_time`, `content` FROM `{seafile_table_name}` WHERE _pk = {_pk}"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        record = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for seafile details {seafile_table_name}: {e}')
        record = []
    return record


def list_knowledge_base_records(seadb_api, project_uuid, view, start, limit, username):
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
    sql = view_data_2_sql(KnowledgeBaseTable.gen_table_name(), display_columns, view_copy, username, start, limit,
                          include_deleted=False)
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for knowledge base : {e}')
        records = []
    return records, display_columns

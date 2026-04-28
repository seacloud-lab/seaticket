import logging

from seahub.project.constants import ConnectionType, ExtraSourceType, CONNECTION_DISPLAY_ALL_COLUMNS, \
    CONNECTION_MUST_RETURN_COLUMNS, TICKET_DISPLAY_ALL_COLUMNS, KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS, \
    PORTAL_ISSUE_DISPLAY_ALL_COLUMNS
from seahub.project.view_utils import view_data_2_sql, SQLGenerator, SQLGeneratorOptionInvalidError
from seahub.project.utils import get_current_table_metadata
from seahub.seadb_models.models import WebCrawlTable, DiscourseTopicsTable, DiscourseRepliesTable, GithubIssuesTable, \
    GithubIssueCommentsTable, SeafileTable, TicketsTable, TicketCommentsTable, TicketActivitiesTable, EmailTable, ThreadTable, \
    KnowledgeBaseTable, TagTable, AgentRunsTable, AgentActionsTable, NotionTable, PortalIssuesTable, PortalIssueCommentsTable

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

    site_index_columns = [
        web_crawl_table.url.name,
        web_crawl_table.modified_time.name,
        web_crawl_table.deleted.name,
        web_crawl_table.ai_processed_time.name,
        web_crawl_table.record_modified_time.name,
    ]
    for column in site_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            table_id,
            [
                column,
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
    issue_index_columns = [
        github_issues_table.issue_id.name,
        github_issues_table.state.name,
        github_issues_table.state_reason.name,
        github_issues_table.labels.name,
        github_issues_table.title.name,
        github_issues_table.author.name,
        github_issues_table.created_time.name,
        github_issues_table.closed_time.name,
        github_issues_table.deleted.name,
        github_issues_table.linked_ticket.name,
        github_issues_table.ai_processed_time.name,
        github_issues_table.record_modified_time.name,
    ]
    for column_name in issue_index_columns:
        seadb_api.create_column_index(project_uuid, table_id, [column_name])

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

    issue_comment_index_columns = [
        github_issue_comments_table.issue_id.name,
        github_issue_comments_table.comment_id.name
    ]
    for column_name in issue_comment_index_columns:
        seadb_api.create_column_index(project_uuid, table_id, [column_name])


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
    topic_index_columns = [
        discourse_topics_table.topic_id.name,
        discourse_topics_table.sync_time.name,
        discourse_topics_table.deleted.name,
        discourse_topics_table.linked_ticket.name,
        discourse_topics_table.ai_processed_time.name,
        discourse_topics_table.record_modified_time.name,
    ]
    for column_name in topic_index_columns:
        seadb_api.create_column_index(project_uuid, topics_table_id, [column_name])

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
    discourse_replies_index_columns = [
        discourse_replies_table.topic_id.name,
        discourse_replies_table.post_number.name,
        discourse_replies_table.modified_time.name,
    ]
    for column_name in discourse_replies_index_columns:
        seadb_api.create_column_index(project_uuid, replies_table_id, [column_name])


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

    seafile_index_columns = [
        SeafileTable.path.name,
        SeafileTable.title.name,
        SeafileTable.deleted.name,
        SeafileTable.ai_processed_time.name,
        SeafileTable.record_modified_time.name,
    ]
    for column_name in seafile_index_columns:
        seadb_api.create_column_index(project_uuid, table_id, [column_name])


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
        TicketsTable.due_date.name,
        TicketsTable.ai_processed_time.name,
        TicketsTable.modified_time.name,
    ]
    for column_name in ticket_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            tickets_table_id,
            [column_name],
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
    for column_name in ticket_comments_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            comments_table_id,
            [column_name],
        )

    # Create ticket_activities table
    res = seadb_api.create_table(project_uuid, TicketActivitiesTable.gen_table_name())
    activities_table_id = res['table_id']
    for column in TicketActivitiesTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, activities_table_id, mapped_column)

    # Create ticket_activities table index for seadb
    ticket_activities_index_columns = [
        TicketActivitiesTable.ticket_id.name,
        TicketActivitiesTable.created_time.name,
    ]
    for column in ticket_activities_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            activities_table_id,
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

    index_column_names = [
        EmailTable.title.name,
        EmailTable.email_from.name, 
        EmailTable.sync_time.name, 
        EmailTable.is_sender.name
    ]

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
        ThreadTable.sync_time.name,
        ThreadTable.linked_ticket.name,
        ThreadTable.ai_processed_time.name,
        ThreadTable.record_modified_time.name,
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

    index_column_names = [KnowledgeBaseTable.creator.name, KnowledgeBaseTable.created_time.name,
                          KnowledgeBaseTable.last_modifier.name, KnowledgeBaseTable.modified_time.name,
                          KnowledgeBaseTable.deleted.name, KnowledgeBaseTable.ai_processed_time.name
                          ]
    for column_name in index_column_names:
        seadb_api.create_column_index(
            project_uuid,
            table_id,
            [
                column_name,
            ]
        )


def init_tag_seadb_table(seadb_api, project_uuid):
    table_name = TagTable.gen_table_name()
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    for column in TagTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    index_column_names = [TagTable.name.name]
    for column_name in index_column_names:
        seadb_api.create_column_index(
            project_uuid,
            table_id,
            [
                column_name,
            ]
        )

def init_portal_issues_seadb_table(seadb_api, project_uuid):
    """Initialize SeaDB table for portal issues (issues submitted via support portal)"""
    # Create portal_issues table
    table_name = PortalIssuesTable.gen_table_name()
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    status_column_key = None
    for column in PortalIssuesTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        if column.name == 'substate' and status_column_key:
            mapped_column['column_data']['cascade_column_key'] = status_column_key
        added_column = seadb_api.add_column(project_uuid, table_id, mapped_column)
        if column.name == PortalIssuesTable.state.name:
            status_column_key = added_column['column_key']

    # Create portal_issues table indexes (matching tickets pattern)
    portal_issues_index_columns = [
        PortalIssuesTable.priority.name,
        PortalIssuesTable.state.name,
        PortalIssuesTable.substate.name,
        PortalIssuesTable.type.name,
        PortalIssuesTable.assignees.name,
        PortalIssuesTable.participants.name,
        PortalIssuesTable.creator.name,
        PortalIssuesTable.deleted.name,
        PortalIssuesTable.due_date.name,
        PortalIssuesTable.ai_processed_time.name,
        PortalIssuesTable.modified_time.name
    ]
    for column in portal_issues_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            table_id,
            [column],
        )

    # Create portal_issue_comments table
    res = seadb_api.create_table(project_uuid, PortalIssueCommentsTable.gen_table_name())
    comments_table_id = res['table_id']
    for column in PortalIssueCommentsTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, comments_table_id, mapped_column)

    # Create portal_issue_comments table indexes
    portal_issue_comments_index_columns = [
        PortalIssueCommentsTable.issue_id.name,
        PortalIssueCommentsTable.creator.name,
        PortalIssueCommentsTable.deleted.name,
    ]
    for column in portal_issue_comments_index_columns:
        seadb_api.create_column_index(
            project_uuid,
            comments_table_id,
            [column],
        )

def ensure_portal_issues_seadb_table(seadb_api, project_uuid):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []

    portal_issues_table_name = PortalIssuesTable.gen_table_name()

    portal_issues_table = get_current_table_metadata(tables_metadata, portal_issues_table_name)

    if not portal_issues_table:
        init_portal_issues_seadb_table(seadb_api, project_uuid)

def init_agent_seadb_table(seadb_api, project_uuid):
    """Initialize SeaDB tables for Agent runs and actions"""
    # Create agent_runs table
    res = seadb_api.create_table(project_uuid, AgentRunsTable.gen_table_name())
    runs_table_id = res['table_id']
    for column in AgentRunsTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, runs_table_id, mapped_column)

    # Create agent_runs index
    seadb_api.create_column_index(
        project_uuid,
        runs_table_id,
        [AgentRunsTable.started_at.name],
    )

    # Create agent_actions table
    res = seadb_api.create_table(project_uuid, AgentActionsTable.gen_table_name())
    actions_table_id = res['table_id']
    for column in AgentActionsTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, actions_table_id, mapped_column)

    # Create agent_actions index
    seadb_api.create_column_index(
        project_uuid,
        actions_table_id,
        [AgentActionsTable.run_id.name, AgentActionsTable.created_at.name],
    )


def init_notion_seadb_table(seadb_api, project_uuid, connection_id):
    table_name = NotionTable.gen_table_name(connection_id)
    res = seadb_api.create_table(project_uuid, table_name)
    table_id = res['table_id']
    for column in NotionTable.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
        if column.data:
            mapped_column['column_data'] = column.data
        seadb_api.add_column(project_uuid, table_id, mapped_column)

    index_column_names = [
        NotionTable.title.name,
        NotionTable.modified_time.name,
        NotionTable.deleted.name,
        NotionTable.sync_time.name,
        NotionTable.page_id.name,
        NotionTable.ai_processed_time.name,
        NotionTable.record_modified_time.name,
    ]

    for column_name in index_column_names:
        seadb_api.create_column_index(
            project_uuid,
            table_id,
            [
                column_name,
            ]
        )


def get_connection_table_name(connection_type, connection_id):
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
    elif connection_type == ConnectionType.NOTION.value:
        table_name = NotionTable.gen_table_name(connection_id)

    return table_name

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
        all_columns_names = [column_name for column_name in all_columns_names if column_name != TicketsTable.closed_time.name]

    display_columns = []
    for column in columns:
        name = column['name']
        if name in all_columns_names:
            display_columns.append(column)

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
    columns = get_seadb_table_columns(seadb_api, project_uuid, PortalIssuesTable.gen_table_name())
    display_columns = []
    for column in columns:
        name = column['name']
        if name in PORTAL_ISSUE_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)
    return records, display_columns


def list_my_portal_issues(seadb_api, project_uuid, username, issue_state, start, limit, view_config={}):
    columns = get_seadb_table_columns(seadb_api, project_uuid, PortalIssuesTable.gen_table_name())

    display_columns = []
    for column in columns:
        name = column['name']
        if name in PORTAL_ISSUE_DISPLAY_ALL_COLUMNS:
            display_columns.append(column)

    view_copy = view_config.copy()
    sorts = view_copy.get('sorts', [])
    if not sorts:
        sorts = [{ 'column_name': PortalIssuesTable.created_time.name, 'sort_type': 'down' }]
    view_copy['sorts'] = sorts
    basic_filters = view_copy.get('basic_filters', [])
    if not basic_filters:
        basic_filters = []
    basic_filters.append({
        'column_name': PortalIssuesTable.participants.name,
        'filter_predicate': 'include_me',
    })
    basic_filters.append({
        'column_name': PortalIssuesTable.state.name,
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
        records = res.get('results')
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
    issues_table_name = PortalIssuesTable.gen_table_name()
    comments_table_name = PortalIssueCommentsTable.gen_table_name()
    issues_sql = f"SELECT * FROM `{issues_table_name}` WHERE _pk = {_pk} AND (`deleted` = False OR `deleted` IS NULL)"
    try:
        from seahub.tickets.ticket_utils import get_ticket_title
        issues_res = seadb_api.query_rows(project_uuid, issues_sql)
        issue = issues_res.get('results')[0]
        column_metadata = issues_res.get('metadata')
        comments_sql = f"SELECT _pk, content, created_time, modified_time, creator FROM `{comments_table_name}` WHERE issue_id = {_pk} AND deleted = False ORDER BY _pk ASC"
        comments_res = seadb_api.query_rows(project_uuid, comments_sql)
        comments_records = comments_res.get('results', [])
        issue['comments'] = []
        for comment in comments_records:
            issue['comments'].append({
                'id': comment.get('_pk'),
                'number': comment.get('_pk'),
                'content': comment.get('content'),
                'created_time': comment.get('created_time'),
                'modified_time': comment.get('modified_time'),
                'creator': comment.get('creator'),
            })
        linked_ticket = issue.get('linked_ticket')
        linked_ticket_title = get_ticket_title(seadb_api, project_uuid, linked_ticket)
    except Exception as e:
        issue = {}
        column_metadata = []
        linked_ticket_title = ''
        logger.error(f'SeaDB query error for portal issues {issues_table_name}: {e}')
    return issue, column_metadata, linked_ticket_title


def list_discourse_forum_replies_records(seadb_api, project_uuid, connection_id, _pk):
    topics_table_name = DiscourseTopicsTable.gen_table_name(connection_id)
    replies_table_name = DiscourseRepliesTable.gen_table_name(connection_id)
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
    topics_table_name = DiscourseTopicsTable.gen_table_name(connection_id)
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
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        sql = f"SELECT _pk, title, state FROM `{table_name}` WHERE _pk IN ({pks_str})"
    elif connection_type == ConnectionType.DISCOURSE_FORUM.value:
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.SITE.value:
        table_name = WebCrawlTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.SEAFILE.value:
        table_name = SeafileTable.gen_table_name(connection_id)
    elif connection_type == ConnectionType.EMAIL.value:
        table_name = ThreadTable.gen_table_name(connection_id)
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
    issue_table_name = GithubIssuesTable.gen_table_name(connection_id)
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
    comments_table_name = GithubIssueCommentsTable.gen_table_name(connection_id)
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
    seafile_table_name = SeafileTable.gen_table_name(connection_id)
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


def list_site_record_details(seadb_api, project_uuid, connection_id, _pk):
    site_table_name = WebCrawlTable.gen_table_name(connection_id)
    sql = f"SELECT `{WebCrawlTable.title.name}`, `{WebCrawlTable.url.name}`, `{WebCrawlTable.modified_time.name}` FROM `{site_table_name}` WHERE _pk = {_pk}"
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
    email_table_name = EmailTable.gen_table_name(connection_id)
    thread_table_name = ThreadTable.gen_table_name(connection_id)
    from seahub.tickets.ticket_utils import get_ticket_title
    try:
        thread_sql = f"SELECT `title`, `modified_time`, `linked_ticket`, `outdated`, `tags`, `unread` FROM `{thread_table_name}` WHERE _pk = {_pk}"
        thread_res = seadb_api.query_rows(project_uuid, thread_sql)
        thread_record = thread_res.get('results')[0]
        column_metadata = thread_res.get('metadata')
        email_sql = f"""
        SELECT 
        email_from, email_to, title, cc, text_content as content, modified_time, is_sender, html_content, email_id, origin_thread_id, attachments, _pk
        FROM `{email_table_name}` WHERE thread_id = {_pk} ORDER BY {EmailTable.modified_time.name} ASC
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

    try:
        sql = view_data_2_sql(KnowledgeBaseTable.gen_table_name(), display_columns, view_copy, username, start, limit)
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

        for result in seadb_api.query_rows(project_uuid, sql).get('results', []):
            result['type'] = table['type']
            if 'connection_id' in table:
                result['connection_id'] = table['connection_id']
            results.append(result)

    return results


def get_title_and_ai_summary_by_pks(seadb_api, project_uuid, source_type, pks, connection_id=None):
    if source_type == ConnectionType.GITHUB_ISSUE.value:
        table_name = GithubIssuesTable.gen_table_name(connection_id)
    elif source_type == ConnectionType.DISCOURSE_FORUM.value:
        table_name = DiscourseTopicsTable.gen_table_name(connection_id)
    elif source_type == ConnectionType.SITE.value:
        table_name = WebCrawlTable.gen_table_name(connection_id)
    elif source_type == ConnectionType.SEAFILE.value:
        table_name = SeafileTable.gen_table_name(connection_id)
    elif source_type == ConnectionType.EMAIL.value:
        table_name = ThreadTable.gen_table_name(connection_id)
    elif source_type == ExtraSourceType.KNOWLEDGE_BASE.value:
        table_name = KnowledgeBaseTable.gen_table_name()
    elif source_type == ExtraSourceType.TICKET.value:
        table_name = TicketsTable.gen_table_name()
    elif source_type == ExtraSourceType.PORTAL_ISSUE.value:
        table_name = PortalIssuesTable.gen_table_name()

    sql = f"SELECT `_pk`, `title`, `ai_summary` FROM `{table_name}` WHERE `_pk` IN ({','.join([str(pk) for pk in pks])})"
    results = {}
    for result in seadb_api.query_rows(project_uuid, sql).get('results', []):
        results[result['_pk']] = {
            'title': result['title'],
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
    notion_table_name = NotionTable.gen_table_name(connection_id)
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

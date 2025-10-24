import logging

from seahub.project.constants import ConnectionType, CONNECTION_DISPLAY_ALL_COLUMNS, \
    CONNECTION_MUST_RETURN_COLUMNS
from seahub.project.view_utils import view_data_2_sql
from seahub.project.utils import get_current_table_metadata
from seahub.seadb_models.models import WebCrawlTable, DiscourseTopicsTable, DiscourseRepliesTable, GithubIssuesTable, \
    GithubIssueCommentsTable, SeafileTable

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
            web_crawl_table.updated_at.name,
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
            github_issues_table.created_at.name
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
            discourse_topics_table.updated_at.name
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
            discourse_replies_table.updated_at.name,
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
            SeafileTable.filename.name,
        ]
    )

    seadb_api.create_column_index(
        project_uuid,
        table_id,
        [
            SeafileTable.deleted.name,
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

def list_connection_view_records(seadb_api, project_uuid, connection, view, start, limit):
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
    sql = view_data_2_sql(table_name, display_all_columns + extra_query_columns, view_copy, start, limit)
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection {table_name}: {e}')
        records = []
    return records, display_all_columns


def list_discourse_forum_replies_records(seadb_api, project_uuid, topics_table_name, replies_table_name, _pk, username=None):
    topics_sql = f"SELECT * FROM `{topics_table_name}` WHERE _pk = {_pk}"
    try:
        topics_res = seadb_api.query_rows(project_uuid, topics_sql)
        topic_id = topics_res.get('results')[0].get('topic_id')
        replies_sql = f"SELECT author,content,updated_at FROM `{replies_table_name}` WHERE topic_id = {topic_id} ORDER BY post_number ASC"
        replies_res = seadb_api.query_rows(project_uuid, replies_sql)
        records = replies_res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for discourse topics {topics_table_name}: {e}')
        records = []
    return records


def list_github_issue_record_details(seadb_api, project_uuid, issue_table_name, comments_table_name, _pk, username=None):
    """Query github issue comments from SeaDB"""
    issue_sql = f"SELECT author, body, created_at, issue_id FROM `{issue_table_name}` WHERE _pk = {_pk}"
    try:
        issue_res = seadb_api.query_rows(project_uuid, issue_sql)
        issue_record = issue_res.get('results', [])
        issue_id = issue_record[0].get('issue_id')
        comments_sql = f"SELECT author, body, created_at, issue_id FROM `{comments_table_name}` WHERE issue_id = {issue_id} ORDER BY comment_id ASC"
        comments_res = seadb_api.query_rows(project_uuid, comments_sql)
        comments_record = comments_res.get('results', [])
        issue_record.extend(comments_record)
    except Exception as e:
        logger.error(f'SeaDB query error for issue details {issue_table_name} or {comments_table_name}: {e}')
        issue_record = []
    return issue_record

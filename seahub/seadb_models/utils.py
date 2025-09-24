import logging

from seahub.project.view_utils import view_data_2_sql
from seahub.project.utils import get_current_table_metadata
from seahub.seadb_models.models import WebCrawlTable, DiscourseTopicsTable, DiscourseRepliesTable


logger = logging.getLogger(__name__)


def init_site_seadb_table(seadb_api, project_uuid, connection_id):
    res = seadb_api.create_table(project_uuid, connection_id)
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


def init_discourse_forum_seadb_table(seadb_api, project_uuid, connection_id):
    """Initialize SeaDB tables for Discourse Forum connection"""
    # Create topics table
    topics_table_name = f"{connection_id}_ds_topics"
    res = seadb_api.create_table(project_uuid, topics_table_name)
    topics_table_id = res['table_id']
    discourse_topics_table = DiscourseTopicsTable
    for column in discourse_topics_table.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
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
    replies_table_name = f"{connection_id}_ds_replies"
    res = seadb_api.create_table(project_uuid, replies_table_name)
    replies_table_id = res['table_id']
    discourse_replies_table = DiscourseRepliesTable
    for column in discourse_replies_table.get_fields():
        mapped_column = {
            'column_name': column.name,
            'column_type': column.type,
        }
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


def list_seadb_table_records(seadb_api, project_uuid, connection_id, start=0, limit=1000, username=None):
    sql = f"SELECT * FROM `{connection_id}` ORDER BY last_modified DESC LIMIT {limit} OFFSET {start}"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection {connection_id}: {e}')
        records = []
    return records


def list_connection_view_records(seadb_api, project_uuid, connection_id, view, start, limit, username):
    metadata = seadb_api.get_base_metadata(project_uuid)
    tables_metadata = metadata.get('tables') or []
    table_metadata = get_current_table_metadata(tables_metadata, str(connection_id))
    if not table_metadata:
        return []
    columns = table_metadata.get('columns') or []
    view_copy = view.copy()
    hidden_columns = view_copy.get('hidden_columns', [])
    sql = view_data_2_sql(connection_id, columns, hidden_columns, view_copy, start, limit, username)
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for connection {connection_id}: {e}')
        records = []
    return records


def list_discourse_forum_topics_records(seadb_api, project_uuid, connection_id, start=0, limit=1000, username=None):
    """Query discourse forum topics from SeaDB"""
    topics_table_name = f"{connection_id}_ds_topics"
    sql = f"SELECT * FROM `{topics_table_name}` ORDER BY bumped_at DESC LIMIT {limit} OFFSET {start}"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for discourse topics {connection_id}: {e}')
        records = []
    return records


def list_discourse_forum_replies_records(seadb_api, project_uuid, connection_id, topic_id, username=None):
    """Query discourse forum replies from SeaDB"""
    replies_table_name = f"{connection_id}_ds_replies"
    sql = f"SELECT * FROM `{replies_table_name}` WHERE topic_id = {topic_id} ORDER BY post_number ASC"
    try:
        res = seadb_api.query_rows(project_uuid, sql)
        records = res.get('results', [])
    except Exception as e:
        logger.error(f'SeaDB query error for discourse replies {connection_id}: {e}')
        records = []
    return records

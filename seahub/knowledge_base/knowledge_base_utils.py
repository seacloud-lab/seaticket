import logging
import json
from datetime import datetime
from django.utils import timezone
from seahub.profile.models import Profile
from seahub.project.constants import KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS, ExtraSourceType
from seahub.utils import mq
from seahub.utils import uuid_str_to_32_chars, time_str_to_utc_time
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE

from seahub.seadb_models.utils import get_table_name_from_schema, get_column_name_from_schema, get_column_data_from_schema

from seahub.seadb_models.models import SchemaTableNames

logger = logging.getLogger(__name__)

TABLE_KNOWLEDGE_BASE = get_table_name_from_schema(SchemaTableNames.KNOWLEDGE_BASE, )


def get_knowledge_base_record_by_pk(seadb_api, project_uuid, record_id):
    sql = "SELECT `_pk`, `title`, `content`, `tags`, `creator`, `last_modifier`, " \
        f"`created_time`, `modified_time` FROM `{TABLE_KNOWLEDGE_BASE}` WHERE `_pk` = {record_id}"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    columns = res.get('metadata') or []
    return (rows[0] if rows else None), columns

def get_knowledge_base_records_by_pks(seadb_api, project_uuid, record_ids):
    record_ids_str = ', '.join([
        str(record_id)
        for record_id in record_ids
    ])
    sql = "SELECT `_pk`, `title`, `content`, `tags`, `creator`, `last_modifier`, `created_time`, " \
        f"`modified_time` FROM `{TABLE_KNOWLEDGE_BASE}` WHERE `_pk` IN ({record_ids_str}) AND (`deleted` = False OR `deleted` IS NULL)"
    return seadb_api.query_rows(project_uuid, sql).get('results', [])


def get_kb_counts_group_by_column_name(seadb_api, project_uuid, column_name, column_type='single-select'):
    """
    count single-select and multiple-select column for knowledge base
    """
    sql = (
        f"SELECT {column_name}, COUNT(*) AS count "
        f"FROM `{TABLE_KNOWLEDGE_BASE}` "
        f"WHERE (`deleted` = False OR `deleted` is NULL) "
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
        option['records_count'] = option_name_to_option_count.get(option.get('name'), 0)
    return options, column


def filter_kb_by_select(seadb_api, project_uuid, column_name, names):
    """
    Filter knowledge base records by select column values
    """
    names_str = ', '.join(f"'{n}'" for n in names)
    display_columns_join = ', '.join(KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS)
    sql = (
        f"SELECT {display_columns_join} FROM `{TABLE_KNOWLEDGE_BASE}` "
        f"WHERE `{column_name}` IN ({names_str}) AND (`deleted` = False OR `deleted` is NULL)"
    )
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    records = res.get('results')
    columns = res.get('metadata') or []
    return records, columns


def send_knowledge_base_update_msg(project_uuid):
    try:
        msg_content = json.dumps({'project_uuid': uuid_str_to_32_chars(project_uuid)})
        if mq.publish('knowledge_base_update', msg_content) > 0:
            logger.debug('Publish metadata_update event: %s' % msg_content)
        else:
            logger.info('No one subscribed to metadata_update channel, event (%s) has not been send' % msg_content)
    except Exception as e:
        logger.error('send knowledge base update msg failed, error: %s', e)

def get_whole_knowledge_bases_data(seadb_api, project_uuid, record_ids):
    """
    Build a json from kbs.

    Args:
    - project_uuid
    - record_ids

    Returns:
    [
        {
            "type": "knowledge_base",
            "record_id": ...,
            "title": ...,
            "content": ...,
            "tags": ...,
            "creator": ...,
            "created_time": ...,
            "last_modifier": ...,
            "modified_time": ...
        },
        # {...}
    ]
    """

    knowledge_bases = get_knowledge_base_records_by_pks(seadb_api, project_uuid, record_ids)
    all_relative_users = set()
    for kb in knowledge_bases:
        all_relative_users.add(kb['creator'])
        all_relative_users.add(kb['last_modifier'])

    all_relative_users_profile = Profile.objects.filter(user__in=all_relative_users)

    nickname_map = {
        user_profile.user: user_profile.nickname
        for user_profile in all_relative_users_profile
    }

    result = [{
            'type': ExtraSourceType.KNOWLEDGE_BASE.value,
            'record_id': kb['_pk'],
            'title': kb['title'],
            'content': kb['content'][:ATTACHMENT_CONTENT_MAX_SIZE],
            'tags': kb['tags'],
            'creator': nickname_map.get(kb['creator']),
            'created_time': time_str_to_utc_time(kb['created_time']).isoformat(),
            'last_modifier': nickname_map.get(kb['last_modifier']),
            'modified_time': time_str_to_utc_time(kb['modified_time']).isoformat(),
        }
        for kb in knowledge_bases
    ]
    return result

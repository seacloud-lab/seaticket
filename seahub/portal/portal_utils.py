import json
import logging
from datetime import datetime

from django.utils import timezone
from dateutil.relativedelta import relativedelta

from seahub.project.constants import PORTAL_ISSUE_DISPLAY_ALL_COLUMNS
from seahub.utils import mq, uuid_str_to_32_chars, time_str_to_utc_time


from seahub.seadb_models.utils import get_table_name, get_seadb_column_name, get_seadb_column_data
PORTAL_ISSUE_COMMENT_COLUMNS = ['_pk', 'issue_id', 'content', 'creator', 'created_time', 'modified_time', 'deleted']
logger = logging.getLogger(__name__)


def get_portal_issue(seadb_api, project_uuid, issue_id):
    display_columns_join = ', '.join(PORTAL_ISSUE_DISPLAY_ALL_COLUMNS)
    sql = f"SELECT {display_columns_join} FROM `{get_table_name('PortalIssuesTable', )}` WHERE `_pk` = {issue_id}"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    return rows[0] if rows else None, res.get('metadata')

def get_portal_issues(seadb_api, project_uuid, issue_ids):
    display_columns_join = ', '.join(PORTAL_ISSUE_DISPLAY_ALL_COLUMNS)
    issue_ids_str = ','.join(map(str, issue_ids))
    sql = f"SELECT {display_columns_join} FROM `{get_table_name('PortalIssuesTable', )}` WHERE `_pk` IN ({issue_ids_str})"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    return rows, res.get('metadata')

def get_portal_issue_comments(seadb_api, project_uuid, issue_id, start, end):
    comment_columns_join = ', '.join(PORTAL_ISSUE_COMMENT_COLUMNS)
    issue_comments_sql = f"SELECT {comment_columns_join} FROM `{get_table_name('PortalIssueCommentsTable', )}` WHERE `issue_id` = {issue_id} AND `deleted` = False ORDER BY `_pk` ASC LIMIT {start}, {end}"
    issue_comments_data = seadb_api.query_rows(project_uuid, issue_comments_sql).get('results')
    return issue_comments_data

def get_portal_issue_comment_by_pk(seadb_api, project_uuid, issue_id, comment_id):
    comment_columns_join = ', '.join(PORTAL_ISSUE_COMMENT_COLUMNS)
    sql = f"SELECT {comment_columns_join} FROM `{get_table_name('PortalIssueCommentsTable', )}` WHERE `issue_id` = {issue_id} AND `_pk` = {comment_id}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None


def get_portal_issue_counts_group_by_column_name(seadb_api, project_uuid, column_name, column_type='single-select'):
    sql = (
        f"SELECT {column_name}, COUNT(*) AS count "
        f"FROM `{get_table_name('PortalIssuesTable', )}` "
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
        option['issues_count'] = option_name_to_option_count.get(option.get('name'), 0)
    return options, column


def filter_portal_issues_by_select(seadb_api, project_uuid, column_name, names):
    names_str = ', '.join(f"'{n}'" for n in names)
    display_columns_join = ', '.join(PORTAL_ISSUE_DISPLAY_ALL_COLUMNS)
    sql = (
        f"SELECT {display_columns_join} FROM `{get_table_name('PortalIssuesTable', )}` "
        f"WHERE `{column_name}` IN ({names_str}) AND (`deleted` = False OR `deleted` is NULL)"
    )
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    issues = res.get('results')
    columns = res.get('metadata') or []
    return issues, columns


def check_portal_issue_comment_creation_interval(seadb_api, project_uuid, username, issue_id, deleted=False):
    """Limit portal issue comment creation to once every 30 seconds per creator per issue."""
    previous_comment_sql = (
        f"SELECT `_pk`, `created_time` FROM `{get_table_name('PortalIssueCommentsTable', )}` WHERE `creator` = '{username}' "
        f"AND `issue_id` = {issue_id} AND `deleted` = {deleted} "
        f"ORDER BY `_pk` DESC LIMIT 1"
    )
    previous_comment = seadb_api.query_rows(project_uuid, previous_comment_sql).get('results')
    if previous_comment:
        created_at = previous_comment[0].get('created_time')
        created_at = time_str_to_utc_time(created_at) if created_at else None
        if created_at and created_at > timezone.now() - relativedelta(seconds=30):
            return False

    return True


def send_portal_issue_update_msg(project_uuid, added=0, deleted=0, updated=0):
    try:
        normalized_project_uuid = uuid_str_to_32_chars(project_uuid)
        msg_content = json.dumps({
            'project_uuid': normalized_project_uuid,
            'added': int(added or 0),
            'deleted': int(deleted or 0),
            'updated': int(updated or 0),
        })

        if mq.publish('portal_issue_update', msg_content) > 0:
            logger.debug('Publish portal_issue_update event: %s', msg_content)
        else:
            logger.info('No one subscribed to portal_issue_update channel, event (%s) has not been send', msg_content)
    except Exception as e:
        logger.error('send portal issue update msg failed, error: %s', e)

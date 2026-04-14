from seahub.project.constants import PORTAL_ISSUE_DISPLAY_ALL_COLUMNS


TABLE_PORTAL_ISSUES = 'portal_issues'
TABLE_PORTAL_ISSUE_COMMENTS = 'portal_issue_comments'


def get_portal_issue(seadb_api, project_uuid, issue_id):
    sql = f"SELECT * FROM `{TABLE_PORTAL_ISSUES}` WHERE `_pk` = {issue_id}"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    return rows[0] if rows else None, res.get('metadata')

def get_portal_issues(seadb_api, project_uuid, issue_ids):
    issue_ids_str = ','.join(map(str, issue_ids))
    sql = f"SELECT * FROM `{TABLE_PORTAL_ISSUES}` WHERE `_pk` IN ({issue_ids_str})"
    res = seadb_api.query_rows(project_uuid, sql)
    rows = res.get('results')
    return rows, res.get('metadata')

def get_portal_issue_comments(seadb_api, project_uuid, issue_id, start, end):
    issue_comments_sql = f"SELECT * FROM `{TABLE_PORTAL_ISSUE_COMMENTS}` WHERE `issue_id` = {issue_id} AND `deleted` = False ORDER BY `_pk` ASC LIMIT {start}, {end}"
    issue_comments_data = seadb_api.query_rows(project_uuid, issue_comments_sql).get('results')
    return issue_comments_data

def get_portal_issue_comment_by_pk(seadb_api, project_uuid, issue_id, comment_number):
    sql = f"SELECT * FROM `{TABLE_PORTAL_ISSUE_COMMENTS}` WHERE `issue_id` = {issue_id} AND `_pk` = {comment_number}"
    rows = seadb_api.query_rows(project_uuid, sql).get('results')
    return rows[0] if rows else None


def get_portal_issue_counts_group_by_column_name(seadb_api, project_uuid, column_name, column_type='single-select'):
    sql = (
        f"SELECT {column_name}, COUNT(*) AS count "
        f"FROM `{TABLE_PORTAL_ISSUES}` "
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
        f"SELECT {display_columns_join} FROM `{TABLE_PORTAL_ISSUES}` "
        f"WHERE `{column_name}` IN ({names_str}) AND (`deleted` = False OR `deleted` is NULL)"
    )
    res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
    issues = res.get('results')
    columns = res.get('metadata') or []
    return issues, columns
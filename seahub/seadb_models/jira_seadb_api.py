import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import SchemaTables
from seahub.settings import ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.project.constants import ConnectionType

logger = logging.getLogger(__name__)


class JiraSeaDBAPI:
    def __init__(self, base_id, username='', timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(username=username, timeout=timeout)

    def get_issues_by_pks(self, connection_id, _pks):
        _pks_str = ', '.join([str(_pk) for _pk in _pks])
        table_name = SchemaTables.JIRA_ISSUES.table_name(connection_id)
        sql = "SELECT `_pk`, `issue_id`, `title`, `content`, `status`, `url`, `created_time` " \
            f"FROM `{table_name}` WHERE `_pk` in ({_pks_str})"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])

    def get_comments_by_issue_ids(self, connection_id, issue_ids, limit_for_each_id):
        if not issue_ids:
            return {}
        issue_ids_str = ', '.join([str(issue_id) for issue_id in issue_ids])
        table_name = SchemaTables.JIRA_ISSUE_COMMENTS.table_name(connection_id)
        sql = "SELECT `issue_id`, `author`, `content`, `created_time` " \
            f"FROM `{table_name}` WHERE `issue_id` in ({issue_ids_str}) ORDER BY `issue_id` ASC, `created_time` ASC LIMIT {len(issue_ids) * limit_for_each_id}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        comments = response.get('results', [])
        result = {}
        for comment in comments:
            issue_id = comment['issue_id']
            if issue_id not in result:
                result[issue_id] = [comment]
            elif len(result[issue_id]) < limit_for_each_id:
                result[issue_id].append(comment)
        return result

    def get_whole_jira_issue_data(self, connection_ids_pks):
        connection_ids_pks_map = {}
        for connection_id_pk in connection_ids_pks:
            connection_id = connection_id_pk['connection_id']
            record_id = connection_id_pk['record_id']
            if connection_id not in connection_ids_pks_map:
                connection_ids_pks_map[connection_id] = [record_id]
            else:
                connection_ids_pks_map[connection_id].append(record_id)

        result = []
        for connection_id, _pks in connection_ids_pks_map.items():
            issues = self.get_issues_by_pks(connection_id, _pks)
            issue_ids = [issue['issue_id'] for issue in issues if issue.get('issue_id') is not None]
            comments_map = self.get_comments_by_issue_ids(connection_id, issue_ids, ATTACHMENT_ISSUE_MAX_COMMENTS)

            for issue_data in issues:
                issue_id = issue_data.get('issue_id')
                whole_issue_data = {
                    'type': ConnectionType.JIRA_ISSUE.value,
                    'connection_id': int(connection_id),
                    'record_id': int(issue_data['_pk']),
                    'status': issue_data.get('status'),
                    'title': issue_data.get('title'),
                    'content': issue_data.get('content'),
                    'url': issue_data.get('url'),
                    'created_at': issue_data.get('created_time'),
                    'comments': []
                }

                for comment in comments_map.get(issue_id, []):
                    whole_issue_data['comments'].append({
                        'author': comment.get('author'),
                        'content': comment.get('content'),
                        'created_time': comment.get('created_time')
                    })

                result.append(whole_issue_data)
        return result

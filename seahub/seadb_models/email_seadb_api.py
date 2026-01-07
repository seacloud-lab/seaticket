import logging

from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import EmailTable, ThreadTable
from seahub.settings import AI_CHAT_GITHUB_ISSUE_MAX_COMMENTS_NUM
from seahub.project.constants import ConnectionType

logger = logging.getLogger(__name__)


class EmailSeaDBAPI:
    def __init__(self, base_id, username='', timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(username=username, timeout=timeout)

    def get_issue_by_pk(self, connection_id, _pk):
        """Retrieve issue for the specified _pk."""
        table_name = EmailTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_emails_by_thread_id(self, connection_id, thread_id, limit=None):
        table_name = EmailTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `thread_id` = {thread_id} ORDER BY {EmailTable.modified_time.name} ASC "
        if limit is not None:
            sql += f" LIMIT {limit}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_thread_by_pk(self, connection_id, _pk):
        table_name = ThreadTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_threads_by_pks(self, connection_id, _pks):
        _pks_str = ', '.join([
            str(_pk)
            for _pk in _pks
        ])
        table_name = ThreadTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `_pk` in ({_pks_str})"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])

    def get_emails_by_thread_ids(self, connection_id, thread_ids, limit_for_each_id):
        thread_ids_str = ', '.join([
            str(thread_id)
            for thread_id in thread_ids
        ])
        table_name = EmailTable.gen_table_name(connection_id)
        sql = f"SELECT * FROM `{table_name}` WHERE `thread_id` in ({thread_ids_str}) ORDER BY {EmailTable.modified_time.name} ASC LIMIT 0, {len(thread_ids) * limit_for_each_id}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        emails = response.get('results', [])
        result = {}
        for email in emails:
            thread_id = email['thread_id']
            if thread_id not in result:
                result[thread_id] = [email]
            elif len(result[thread_id]) < limit_for_each_id:
                result[thread_id].append(email)
        return result

    def get_whole_email_data(self, connection_ids_pks):
        """
        Build a dict object from an email thread and its emails.

        Args:
        - connection_ids_pks: [{"connection_id": ..., "record_id": ...}]

        Returns:
        [
            {
                "type": "email",
                "connection_id": ...,
                "record_id": ...,
                "title": ...,
                "created_at": ...,
                "emails": [
                    {
                        "from": ...,
                        "to": ...,
                        "content": ...,
                        "modified_time": ...,
                    },
                    ...
                ]
            },
            # {...}
        ]
        """
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
            threads = self.get_threads_by_pks(connection_id, _pks)
            threads_emails_map = self.get_emails_by_thread_ids(connection_id, _pks, AI_CHAT_GITHUB_ISSUE_MAX_COMMENTS_NUM)

            for thread_data in threads:
                whole_thread_data = {
                    'type': ConnectionType.EMAIL.value,
                    'connection_id': int(connection_id),
                    'record_id': int(thread_data['_pk']),
                    'title': thread_data.get('title'),
                    'created_at': thread_data.get('modified_time'),
                    'emails': []
                }

                for email in threads_emails_map.get(thread_data['_pk'], []):
                    whole_thread_data['emails'].append({
                        'from': email.get('email_from'),
                        'to': email.get('email_to'),
                        'content': email.get('content'),
                        'modified_time': email.get('modified_time')
                    })

                result.append(whole_thread_data)
        return result

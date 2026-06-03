import logging
import datetime

from email.utils import formataddr

from seahub.project.seadb_api import SeaDBAPI
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE, ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.project.constants import ConnectionType

from seahub.seadb_models.utils import get_table_name_from_schema, get_column_name_from_schema, get_column_data_from_schema

from seahub.seadb_models.models import SchemaTableNames

logger = logging.getLogger(__name__)


class EmailSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_email_by_pk(self, connection_id, _pk):
        table_name = get_table_name_from_schema(SchemaTableNames.EMAIL, connection_id)
        sql = "SELECT `_pk`, `thread_id`, `title`, `email_from`, `message_id`, `origin_thread_id`, attachments " \
              f"FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        result = response.get('results', [])
        return result[0] if result else {}

    def get_emails_by_thread_id(self, connection_id, thread_id, limit=None):
        table_name = get_table_name_from_schema(SchemaTableNames.EMAIL, connection_id)
        sql = "SELECT `_pk`, `thread_id`, `title`, `email_from`, `email_to`, `cc`, `content`, " \
            f"`modified_time`, `is_sender`, `message_id`, `origin_thread_id`, `email_id` FROM `{table_name}` WHERE `thread_id` = {thread_id} ORDER BY `modified_time` ASC"
        if limit is not None:
            sql += f" LIMIT {limit}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_thread_by_pk(self, connection_id, _pk):
        table_name = get_table_name_from_schema(SchemaTableNames.THREAD, connection_id)
        sql = "SELECT `_pk`, `title`, `linked_ticket` " \
            f"FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        result = response.get('results', [])
        return result[0] if result else {}

    def get_threads_by_pks(self, connection_id, _pks):
        _pks_str = ', '.join([
            str(_pk)
            for _pk in _pks
        ])
        table_name = get_table_name_from_schema(SchemaTableNames.THREAD, connection_id)
        sql = "SELECT `_pk`, `title`, `modified_time` " \
            f"FROM `{table_name}` WHERE `_pk` in ({_pks_str})"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])

    def get_emails_by_thread_ids(self, connection_id, thread_ids, limit_for_each_id):
        thread_ids_str = ', '.join([
            str(thread_id)
            for thread_id in thread_ids
        ])
        table_name = get_table_name_from_schema(SchemaTableNames.EMAIL, connection_id)
        sql = "SELECT `thread_id`, `email_from`, `email_to`, `content`, `modified_time` " \
            f"FROM `{table_name}` WHERE `thread_id` in ({thread_ids_str}) ORDER BY `modified_time` ASC LIMIT 0, {len(thread_ids) * limit_for_each_id}"
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
            threads_emails_map = self.get_emails_by_thread_ids(connection_id, _pks, ATTACHMENT_ISSUE_MAX_COMMENTS)

            for thread_data in threads:
                whole_thread_data = {
                    'type': ConnectionType.EMAIL.value,
                    'connection_id': int(connection_id),
                    'record_id': int(thread_data['_pk']),
                    'title': thread_data.get('title'),
                    'created_at': thread_data.get('modified_time'),
                    'emails': []
                }

                total_content_size = 0
                for email in threads_emails_map.get(thread_data['_pk'], []):
                    content = email.get('content', '') or ''
                    total_content_size += len(content)

                    # break if exceed maximum content size
                    if total_content_size > ATTACHMENT_CONTENT_MAX_SIZE:
                        break

                    whole_thread_data['emails'].append({
                        'from': email.get('email_from'),
                        'to': email.get('email_to'),
                        'content': content,
                        'modified_time': email.get('modified_time')
                    })
                result.append(whole_thread_data)
        return result

    def save_reply_email(self, project_uuid, connection_id, thread_id, email_data):
        now = datetime.datetime.now(datetime.UTC).isoformat()
        email_table_name = get_table_name_from_schema(SchemaTableNames.EMAIL, connection_id)
        thread_table_name = get_table_name_from_schema(SchemaTableNames.THREAD, connection_id)

        sender_name = email_data.get('sender_name', '')
        sender_email = email_data['sender_email']

        email_row = {
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'email_from'): formataddr((sender_name, sender_email)) if sender_name else sender_email,
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'email_to'): email_data.get('email_to', ''),
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'title'): email_data.get('subject', ''),
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'cc'): email_data.get('cc') or '',
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'content'): email_data.get('content', ''),
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'text_content'): email_data.get('content', ''),
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'html_content'): email_data.get('html_content') or '',
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'reply_to_message_id'): email_data.get('reply_to_message_id') or '',
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'is_sender'): True,
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'deleted'): False,
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'thread_id'): thread_id,
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'message_id'): email_data.get('message_id') or '',
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'origin_thread_id'): email_data.get('origin_thread_id') or '',
            get_column_name_from_schema(SchemaTableNames.EMAIL, 'email_id'): email_data.get('email_id') or '',
        }

        result = self.seadb_api.insert_rows(project_uuid, email_table_name, [email_row])
        pks = result.get('pks', [])
        self.seadb_api.update_rows(project_uuid, thread_table_name, [{
            'pk': int(thread_id),
            'row': {
                get_column_name_from_schema(SchemaTableNames.THREAD, 'modified_time'): now,
                get_column_name_from_schema(SchemaTableNames.THREAD, 'record_modified_time'): now,
                get_column_name_from_schema(SchemaTableNames.THREAD, 'unread'): False,
            }
        }])
        return pks[0] if pks else None

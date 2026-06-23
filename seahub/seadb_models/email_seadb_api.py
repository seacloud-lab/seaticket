import logging
import datetime

from email.utils import formataddr

from seahub.project.seadb_api import SeaDBAPI
from seahub.settings import ATTACHMENT_CONTENT_MAX_SIZE, ATTACHMENT_ISSUE_MAX_COMMENTS
from seahub.project.constants import ConnectionType
from seahub.seadb_models.models import SchemaTables

logger = logging.getLogger(__name__)

_MORE_EMAILS_OMITTED_NOTICE = '[more emails omitted due to content limit]'


def _truncate_content_with_ellipsis(content, max_length):
    content = content or ''
    if max_length <= 0:
        return ''
    if len(content) <= max_length:
        return content
    if max_length <= 3:
        return '.' * max_length
    return content[:max_length - 3] + '...'


def _build_email_notice(content):
    return {
        'email_from': None,
        'email_to': None,
        'cc': None,
        'content': content,
        'modified_time': None,
    }


class EmailSeaDBAPI:
    def __init__(self, base_id, timeout=30, seadb_api=None):
        self.base_id = base_id
        self.seadb_api = seadb_api or SeaDBAPI(timeout=timeout)

    def get_email_by_pk(self, connection_id, _pk):
        table_name = SchemaTables.EMAIL.table_name(connection_id)
        sql = "SELECT `_pk`, `thread_id`, `title`, `email_from`, `message_id`, `origin_thread_id`, attachments " \
              f"FROM `{table_name}` WHERE `_pk` = {_pk}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        result = response.get('results', [])
        return result[0] if result else {}

    def get_emails_by_thread_id(self, connection_id, thread_id, limit=None):
        table_name = SchemaTables.EMAIL.table_name(connection_id)
        sql = "SELECT `_pk`, `thread_id`, `title`, `email_from`, `email_to`, `cc`, `content`, " \
            f"`modified_time`, `is_sender`, `message_id`, `origin_thread_id`, `email_id` FROM `{table_name}` WHERE `thread_id` = {thread_id} ORDER BY `modified_time` ASC"
        if limit is not None:
            sql += f" LIMIT {limit}"
        response = self.seadb_api.query_rows(self.base_id, sql)
        if response and 'results' in response:
            return response['results']
        return []

    def get_thread_by_pk(self, connection_id, _pk):
        table_name = SchemaTables.THREAD.table_name(connection_id)
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
        table_name = SchemaTables.THREAD.table_name(connection_id)
        sql = "SELECT `_pk`, `title`, `modified_time` " \
            f"FROM `{table_name}` WHERE `_pk` in ({_pks_str})"
        response = self.seadb_api.query_rows(self.base_id, sql)
        return response.get('results', [])

    def _get_first_thread_email_by_id(self, connection_id, thread_id):
        table_name = SchemaTables.EMAIL.table_name(connection_id)
        first_email_sql = "SELECT `message_id`, `thread_id`, `email_from`, `email_to`, `cc`, `content`, `modified_time` " \
            f"FROM `{table_name}` WHERE `thread_id` = {thread_id} ORDER BY `modified_time` ASC LIMIT 1"
        first_emails = self.seadb_api.query_rows(self.base_id, first_email_sql).get('results', [])
        return first_emails[0] if first_emails else None

    def _get_latest_thread_emails_by_id(self, connection_id, thread_id, limit_for_each_id):
        table_name = SchemaTables.EMAIL.table_name(connection_id)
        latest_emails_sql = "SELECT `message_id`, `thread_id`, `email_from`, `email_to`, `cc`, `content`, `modified_time` " \
            f"FROM `{table_name}` WHERE `thread_id` = {thread_id} ORDER BY `modified_time` DESC LIMIT {limit_for_each_id}"
        return self.seadb_api.query_rows(self.base_id, latest_emails_sql).get('results', [])

    def _get_selected_thread_emails_for_attachment(self, connection_id, thread_id, limit_for_each_id):
        first_email = self._get_first_thread_email_by_id(connection_id, thread_id)
        if not first_email:
            return []

        first_content = first_email.get('content', '') or ''
        if len(first_content) > ATTACHMENT_CONTENT_MAX_SIZE:
            selected_emails = []
            truncated_content = _truncate_content_with_ellipsis(first_content, ATTACHMENT_CONTENT_MAX_SIZE)
            if truncated_content:
                selected_emails.append({
                    **first_email,
                    'content': truncated_content,
                })
            selected_emails.append(_build_email_notice(_MORE_EMAILS_OMITTED_NOTICE))
            return selected_emails

        latest_emails = self._get_latest_thread_emails_by_id(connection_id, thread_id, limit_for_each_id)
        emails_by_key = {}
        for email in latest_emails:
            key = (
                email.get('message_id') or '',
                email.get('modified_time') or '',
                email.get('email_from') or '',
                email.get('email_to') or '',
                email.get('content') or '',
            )
            emails_by_key[key] = email
        first_key = (
            first_email.get('message_id') or '',
            first_email.get('modified_time') or '',
            first_email.get('email_from') or '',
            first_email.get('email_to') or '',
            first_email.get('content') or '',
        )
        emails_by_key[first_key] = first_email
        emails = sorted(
            emails_by_key.values(),
            key=lambda email: (email.get('modified_time') or '', email.get('message_id') or ''),
        )

        selected_emails = []
        total_content_size = 0
        for email in emails:
            content = email.get('content', '') or ''
            remaining_size = ATTACHMENT_CONTENT_MAX_SIZE - total_content_size
            if remaining_size <= 0:
                break

            if len(content) > remaining_size:
                truncated_content = _truncate_content_with_ellipsis(content, remaining_size)
                if truncated_content:
                    selected_emails.append({
                        **email,
                        'content': truncated_content,
                    })
                selected_emails.append(_build_email_notice(_MORE_EMAILS_OMITTED_NOTICE))
                break

            selected_emails.append(email)
            total_content_size += len(content)

        return selected_emails

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
            for thread_data in threads:
                whole_thread_data = {
                    'type': ConnectionType.EMAIL.value,
                    'connection_id': int(connection_id),
                    'record_id': int(thread_data['_pk']),
                    'title': thread_data.get('title'),
                    'created_at': thread_data.get('modified_time'),
                    'emails': []
                }

                emails = self._get_selected_thread_emails_for_attachment(
                    connection_id, thread_data['_pk'], ATTACHMENT_ISSUE_MAX_COMMENTS,
                )
                for email in emails:
                    whole_thread_data['emails'].append({
                        'from': email.get('email_from'),
                        'to': email.get('email_to'),
                        'content': email.get('content', '') or '',
                        'modified_time': email.get('modified_time')
                    })
                result.append(whole_thread_data)
        return result

    def save_reply_email(self, project_uuid, connection_id, thread_id, email_data):
        now = datetime.datetime.now(datetime.UTC).isoformat()
        email_table_name = SchemaTables.EMAIL.table_name(connection_id)
        thread_table_name = SchemaTables.THREAD.table_name(connection_id)

        sender_name = email_data.get('sender_name', '')
        sender_email = email_data['sender_email']

        email_row = {
            SchemaTables.EMAIL.column.email_from.name: formataddr((sender_name, sender_email)) if sender_name else sender_email,
            SchemaTables.EMAIL.column.email_to.name: email_data.get('email_to', ''),
            SchemaTables.EMAIL.column.title.name: email_data.get('subject', ''),
            SchemaTables.EMAIL.column.cc.name: email_data.get('cc') or '',
            SchemaTables.EMAIL.column.content.name: email_data.get('content', ''),
            SchemaTables.EMAIL.column.text_content.name: email_data.get('content', ''),
            SchemaTables.EMAIL.column.html_content.name: email_data.get('html_content') or '',
            SchemaTables.EMAIL.column.reply_to_message_id.name: email_data.get('reply_to_message_id') or '',
            SchemaTables.EMAIL.column.is_sender.name: True,
            SchemaTables.EMAIL.column.deleted.name: False,
            SchemaTables.EMAIL.column.thread_id.name: thread_id,
            SchemaTables.EMAIL.column.message_id.name: email_data.get('message_id') or '',
            SchemaTables.EMAIL.column.origin_thread_id.name: email_data.get('origin_thread_id') or '',
            SchemaTables.EMAIL.column.email_id.name: email_data.get('email_id') or '',
        }

        result = self.seadb_api.insert_rows(project_uuid, email_table_name, [email_row])
        pks = result.get('pks', [])
        self.seadb_api.update_rows(project_uuid, thread_table_name, [{
            'pk': int(thread_id),
            'row': {
                SchemaTables.THREAD.column.modified_time.name: now,
                SchemaTables.THREAD.column.record_modified_time.name: now,
                SchemaTables.THREAD.column.unread.name: False,
            }
        }])
        return pks[0] if pks else None

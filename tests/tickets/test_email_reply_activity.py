import json
from unittest.mock import Mock

from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.models import SchemaTables
from seahub.tickets.ticket_utils import record_email_reply_activity


class TestRecordEmailReplyActivity:
    def test_records_activity_for_linked_thread(self):
        seadb_api = Mock()
        seadb_api.insert_rows.return_value = {'pks': [1]}
        thread = {'_pk': 10, 'title': 'Export fails', 'linked_ticket': 5}

        pk = record_email_reply_activity(seadb_api, 'project-uuid', 3, thread)

        assert pk == 1
        project_uuid, table_name, rows = seadb_api.insert_rows.call_args.args
        assert project_uuid == 'project-uuid'
        assert table_name == SchemaTables.TICKET_ACTIVITIES.table_name()
        row = rows[0]
        assert row['ticket_id'] == 5
        assert row['activity_type'] == 'email_message_added'
        detail = json.loads(row['detail'])
        assert detail['connection_id'] == 3
        assert detail['record_id'] == 10
        assert detail['thread_id'] == 10
        assert detail['thread_title'] == 'Export fails'

    def test_skips_unlinked_thread(self):
        seadb_api = Mock()
        thread = {'_pk': 10, 'title': 'Export fails', 'linked_ticket': None}

        assert record_email_reply_activity(seadb_api, 'project-uuid', 3, thread) is None
        seadb_api.insert_rows.assert_not_called()


class TestSaveReplyEmailActivity:
    def test_records_activity_for_linked_thread(self):
        seadb_api = Mock()
        seadb_api.query_rows.return_value = {
            'results': [{'_pk': 10, 'title': 'Export fails', 'linked_ticket': 5}]
        }
        seadb_api.insert_rows.return_value = {'pks': [99]}
        api = EmailSeaDBAPI('project-uuid', seadb_api=seadb_api)

        pk = api.save_reply_email('project-uuid', 3, 10, {
            'sender_email': 'support@example.com',
            'email_to': 'customer@example.com',
            'subject': 'Re: Export fails',
            'content': 'We are looking into it.',
            'reply_to_message_id': '<m1>',
            'message_id': '<m2>',
        })

        assert pk == 99
        inserted_tables = [call.args[1] for call in seadb_api.insert_rows.call_args_list]
        assert SchemaTables.TICKET_ACTIVITIES.table_name() in inserted_tables

    def test_skips_activity_for_unlinked_thread(self):
        seadb_api = Mock()
        seadb_api.query_rows.return_value = {
            'results': [{'_pk': 10, 'title': 'Export fails', 'linked_ticket': None}]
        }
        seadb_api.insert_rows.return_value = {'pks': [99]}
        api = EmailSeaDBAPI('project-uuid', seadb_api=seadb_api)

        api.save_reply_email('project-uuid', 3, 10, {
            'sender_email': 'support@example.com',
            'email_to': 'customer@example.com',
            'subject': 'Re: Export fails',
            'content': 'We are looking into it.',
            'reply_to_message_id': '<m1>',
            'message_id': '<m2>',
        })

        inserted_tables = [call.args[1] for call in seadb_api.insert_rows.call_args_list]
        assert SchemaTables.TICKET_ACTIVITIES.table_name() not in inserted_tables

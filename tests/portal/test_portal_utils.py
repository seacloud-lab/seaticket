from seahub.seadb_models.utils import strip_portal_issue_internal_columns


class TestStripPortalIssueInternalColumns:

    def test_removes_customer_id_from_records_and_columns(self):
        records = [{'_pk': 1, 'customer_id': 7}, {'_pk': 2}]
        columns = [
            {'name': '_pk', 'key': '_pk'},
            {'name': 'customer_id', 'key': '9dK2'},
        ]

        filtered_columns = strip_portal_issue_internal_columns(records, columns)

        assert records == [{'_pk': 1}, {'_pk': 2}]
        assert [column['name'] for column in filtered_columns] == ['_pk']

    def test_handles_empty_input(self):
        assert strip_portal_issue_internal_columns([], []) == []

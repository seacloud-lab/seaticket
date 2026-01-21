from unittest.mock import Mock, patch

from seahub.project.search import SearchTickectsAndDocumentsView


class TestSearchTickectsAndDocumentsView:

    def test_get_feature_not_enabled(self, factory, user):
        request = factory.get('/api/v1/project/p1/search-tickets-and-documents/', {})
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            resp = SearchTickectsAndDocumentsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_get_project_not_found(self, factory, user):
        request = factory.get('/api/v1/project/p1/search-tickets-and-documents/', {})
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.search.Projects.objects.get_project_by_uuid', return_value=None):
            resp = SearchTickectsAndDocumentsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, user):
        request = factory.get('/api/v1/project/p1/search-tickets-and-documents/', {})
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.search.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.search.check_project_permission', return_value=False):
            resp = SearchTickectsAndDocumentsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_get_success_merges_tickets_and_documents(self, factory, user):
        request = factory.get('/api/v1/project/p1/search-tickets-and-documents/', {'query': 'hello'})
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        seadb = Mock()

        tickets = [{'_pk': 1, 'title': 't1'}, {'_pk': 2, 'title': 't2'}]
        documents = [{'_pk': 10, 'title': 'd1', 'type': 'site', 'connection_id': 3}]

        filter_qs = Mock()
        filter_qs.values_list.return_value = [(3, 'site')]

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.search.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.search.check_project_permission', return_value=True), \
                patch('seahub.project.search.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.search.list_tickets_by_search', return_value=tickets) as ticket_mock, \
                patch('seahub.project.search.ProjectConnections.objects.filter', return_value=filter_qs), \
                patch('seahub.project.search.list_documents_by_search', return_value=documents) as doc_mock:
            resp = SearchTickectsAndDocumentsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert len(resp.data['results']) == 3
        assert resp.data['results'][0]['type'] == 'ticket'
        assert resp.data['results'][2]['type'] in ('site', 'seafile', 'kb')

        # query provided => limit starts at 50
        ticket_mock.assert_called_once_with(seadb, 'p1', 'hello', 0, 50)
        # documents limit should be reduced by ticket count
        doc_mock.assert_called_once()
        assert doc_mock.call_args[0][-1] == 48

    def test_get_success_no_query_uses_limit_100(self, factory, user):
        request = factory.get('/api/v1/project/p1/search-tickets-and-documents/', {})
        request.user = user

        project = Mock()
        project.uuid = 'p1'
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        seadb = Mock()

        filter_qs = Mock()
        filter_qs.values_list.return_value = []

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.search.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.search.check_project_permission', return_value=True), \
                patch('seahub.project.search.SeaDBAPI', return_value=seadb), \
                patch('seahub.project.search.list_tickets_by_search', return_value=[]) as ticket_mock, \
                patch('seahub.project.search.ProjectConnections.objects.filter', return_value=filter_qs), \
                patch('seahub.project.search.list_documents_by_search', return_value=[]) as doc_mock:
            resp = SearchTickectsAndDocumentsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 200
        ticket_mock.assert_called_once_with(seadb, 'p1', '', 0, 100)
        doc_mock.assert_called_once_with(seadb, 'p1', {}, '', 100)

    def test_get_internal_error(self, factory, user):
        request = factory.get('/api/v1/project/p1/search-tickets-and-documents/', {'query': 'x'})
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.search.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.search.check_project_permission', return_value=True), \
                patch('seahub.project.search.SeaDBAPI', side_effect=Exception('boom')):
            resp = SearchTickectsAndDocumentsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 500

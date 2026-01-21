import json
from unittest.mock import Mock, patch

from seahub.portal.apis import (
    PortalTicketsView,
    PortalMyTicketsView,
    PortalTicketTypesView,
    PortalTicketTagsView,
)


class TestPortalTicketsView:

    def test_post_feature_not_enabled(self, factory, user):
        request = factory.post('/api/v1/portal/p1/tickets/', data={}, format='multipart')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_missing_title(self, factory, user):
        request = factory.post('/api/v1/portal/p1/tickets/', data={'content': json.dumps({'text': 'x'})}, format='multipart')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_invalid_content_json(self, factory, user):
        request = factory.post('/api/v1/portal/p1/tickets/', data={'title': 't', 'content': '{'}, format='multipart')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_project_not_found(self, factory, user):
        data = {'title': 't', 'content': json.dumps({'text': 'x'})}
        request = factory.post('/api/v1/portal/p1/tickets/', data=data, format='multipart')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=None):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_permission_denied(self, factory, user):
        data = {'title': 't', 'content': json.dumps({'text': 'x'})}
        request = factory.post('/api/v1/portal/p1/tickets/', data=data, format='multipart')
        request.user = user

        project = Mock()
        project.workspace = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.portal.apis.check_same_org_permission', return_value=False):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 403

    def test_post_creation_interval(self, factory, user):
        data = {'title': 't', 'content': json.dumps({'text': 'x'})}
        request = factory.post('/api/v1/portal/p1/tickets/', data=data, format='multipart')
        request.user = user

        project = Mock()
        project.workspace = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.portal.apis.check_same_org_permission', return_value=True), \
                patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=False):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 429

    def test_post_upload_files_failed(self, factory, user):
        content = {'text': 'x', 'images': ['http://x/a.png']}
        data = {'title': 't', 'content': json.dumps(content)}
        request = factory.post('/api/v1/portal/p1/tickets/', data=data, format='multipart')
        request.user = user

        project = Mock()
        project.workspace = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.portal.apis.check_same_org_permission', return_value=True), \
                patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=True), \
                patch('seahub.portal.apis.upload_files_to_s3', side_effect=Exception('boom')):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 500

    def test_post_success(self, factory, user):
        content = {'text': 'x', 'images': ['http://x/a.png']}
        data = {'title': 't', 'content': json.dumps(content), 'priority': '3', 'tags': json.dumps(['a'])}
        request = factory.post('/api/v1/portal/p1/tickets/', data=data, format='multipart')
        request.user = user

        project = Mock()
        project.workspace = Mock()

        seadb_api = Mock()
        seadb_api.insert_rows.return_value = {'pks': [1]}

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.portal.apis.check_same_org_permission', return_value=True), \
                patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=True), \
                patch('seahub.portal.apis.upload_files_to_s3', return_value={'http://x/a.png': 's3://a'}), \
                patch('seahub.portal.apis.replace_file_url_in_content', return_value='x'):
            resp = PortalTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 201
        assert resp.data['ticket']['_pk'] == 1


class TestPortalMyTicketsView:

    def test_post_start_invalid(self, factory, user):
        request = factory.post('/api/v1/portal/p1/my-tickets/', data={'start': '-1'}, format='multipart')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = PortalMyTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 400

    def test_post_project_not_found(self, factory, user):
        request = factory.post('/api/v1/portal/p1/my-tickets/', data={}, format='multipart')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=None):
            resp = PortalMyTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_success_appends_creator_filter(self, factory, user):
        request = factory.post(
            '/api/v1/portal/p1/my-tickets/',
            data={'view_id': 'open', 'config': json.dumps({'basic_filters': []})},
            format='multipart'
        )
        request.user = user

        project = Mock()
        project.workspace = Mock()

        seadb_api = Mock()

        def _list_my_tickets(_seadb, _project_uuid, _username, _state, _start, _limit, view_config):
            assert any(f.get('column_name') == 'creator' for f in view_config.get('basic_filters', []))
            return ([{'_pk': 1}], ['c1'])

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.portal.apis.check_same_org_permission', return_value=True), \
                patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.list_my_tickets', side_effect=_list_my_tickets):
            resp = PortalMyTicketsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert resp.data['tickets'][0]['_pk'] == 1


class TestPortalTicketTypesView:

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/portal/p1/ticket/types/')
        request.user = user

        project = Mock()
        project.workspace = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.portal.apis.check_same_org_permission', return_value=True), \
                patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.get_ticket_counts_group_by_column_name', return_value=([{'name': 'bug'}], None)):
            resp = PortalTicketTypesView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert resp.data['types'][0]['name'] == 'bug'


class TestPortalTicketTagsView:

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/portal/p1/ticket/tags/')
        request.user = user

        project = Mock()
        project.workspace = Mock()

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.portal.apis.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.portal.apis.check_same_org_permission', return_value=True), \
                patch('seahub.portal.apis.SeaDBAPI', return_value=Mock()), \
                patch('seahub.portal.apis.get_ticket_counts_group_by_column_name', return_value=([{'name': 'a'}], None)):
            resp = PortalTicketTagsView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 200
        assert resp.data['tags'][0]['name'] == 'a'

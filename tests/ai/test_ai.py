import json
from unittest.mock import Mock, patch

from seahub.project.ai import (
    ConvertRecordToTicket,
    EmbeddingAnalysisView,
    EmbeddingAnalysisTaskStatusView,
    RelatedRecordsView,
)
from seahub.utils.events import TaskConflictError


class TestConvertRecordToTicket:

    def test_post_feature_not_enabled(self, factory, user):
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data={}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 403

    def test_post_missing_connection_id(self, factory, user):
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data={}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 400

    def test_post_permission_denied(self, factory, user):
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': 'p1'}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=False):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 403

    def test_post_ai_quota_exceed(self, factory, user):
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': 'p1'}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=True), \
                patch('seahub.project.ai.check_ai_limit', return_value=True):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 402

    def test_post_connection_not_found(self, factory, user):
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': 'p1'}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=True), \
                patch('seahub.project.ai.check_ai_limit', return_value=False), \
                patch('seahub.project.ai.ProjectConnections.objects.get_connection_by_id', return_value=None):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 404

    def test_post_record_detail_not_found(self, factory, user):
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': 'p1'}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        connection = Mock()
        connection.type = 'site'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=True), \
                patch('seahub.project.ai.check_ai_limit', return_value=False), \
                patch('seahub.project.ai.ProjectConnections.objects.get_connection_by_id', return_value=connection):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 404

    def test_post_ai_service_error(self, factory, user):
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': 'p1'}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        connection = Mock()
        connection.type = 'github_issue'

        github_api = Mock()
        github_api.get_issue_by_pk.return_value = [{'title': 't', 'content': 'c', 'issue_id': 1}]
        github_api.get_comments_by_issue_id.return_value = []

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=True), \
                patch('seahub.project.ai.check_ai_limit', return_value=False), \
                patch('seahub.project.ai.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.ai.GitHubSeaDBAPI', return_value=github_api), \
                patch('seahub.project.ai.convert_record_to_ticket', side_effect=Exception('ai down')):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 500

    def test_post_success_returns_title_and_content(self, factory, user):
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': 'p1'}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        connection = Mock()
        connection.type = 'github_issue'

        github_api = Mock()
        github_api.get_issue_by_pk.return_value = [{'title': 't', 'content': 'c', 'issue_id': 1}]
        github_api.get_comments_by_issue_id.return_value = []

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=True), \
                patch('seahub.project.ai.check_ai_limit', return_value=False), \
                patch('seahub.project.ai.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.project.ai.GitHubSeaDBAPI', return_value=github_api), \
                patch('seahub.project.ai.convert_record_to_ticket', return_value=('ai-title', 'ai-content')):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['title'] == 'ai-title'
        assert resp.data['content'] == 'ai-content'


class TestEmbeddingAnalysisView:

    def test_post_missing_project_uuid(self, factory, user):
        request = factory.post('/api/v1/ai/embedding-analysis/', data={}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            resp = EmbeddingAnalysisView.as_view()(request)

        assert resp.status_code == 400

    def test_post_task_conflict(self, factory, user):
        payload = {'project_uuid': 'p1', 'connection_ids': [1]}
        request = factory.post('/api/v1/ai/embedding-analysis/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=True), \
                patch('seahub.project.ai.submit_embedding_analysis_task', side_effect=TaskConflictError('conflict')):
            resp = EmbeddingAnalysisView.as_view()(request)

        assert resp.status_code == 409

    def test_post_success_returns_task_id(self, factory, user):
        payload = {'project_uuid': 'p1', 'connection_ids': [1]}
        request = factory.post('/api/v1/ai/embedding-analysis/', data=payload, format='json')
        request.user = user

        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = 'owner@auth.local'

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=project), \
                patch('seahub.project.ai.check_project_permission', return_value=True), \
                patch('seahub.project.ai.submit_embedding_analysis_task', return_value='task-1'):
            resp = EmbeddingAnalysisView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['task_id'] == 'task-1'


class TestEmbeddingAnalysisTaskStatusView:

    def test_get_success(self, factory, user):
        request = factory.get('/api/v1/ai/embedding-analysis-task-status/task-1/')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.get_embedding_analysis_task_status', return_value={'status': 'done'}):
            resp = EmbeddingAnalysisTaskStatusView.as_view()(request, task_id='task-1')

        assert resp.status_code == 200
        assert resp.data['status'] == 'done'


class TestRelatedRecordsView:

    def test_post_project_not_found(self, factory, user):
        request = factory.post('/api/v1/ai/related-records/', data={'project_uuid': 'p1'}, format='json')
        request.user = user

        with patch('seahub.utils.decorators.is_org_context', return_value=True), \
                patch('seahub.project.ai.Projects.objects.get_project_by_uuid', return_value=None):
            view = RelatedRecordsView()
            drf_request = view.initialize_request(request)
            result = view.post(drf_request)
            resp = result[1] if isinstance(result, tuple) else result

        assert resp.status_code == 404

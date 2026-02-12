from unittest.mock import Mock, patch
from seahub.project.ai import (
    ConvertRecordToTicket,
    EmbeddingAnalysisView,
    EmbeddingAnalysisTaskStatusView,
    RelatedRecordsView,
)
from seahub.utils.events import TaskConflictError


class TestConvertRecordToTicket:

    def test_post_feature_not_enabled(self, factory, no_org_user):
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data={}, format='json')
        request.user = no_org_user

        resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 403

    def test_post_missing_connection_id(self, factory, project_creator):
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data={}, format='json')
        request.user = project_creator

        resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 400

    def test_post_permission_denied(self, factory, no_org_user, real_project):
        project = real_project
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': project.uuid}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = no_org_user

        resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 403

    def test_post_ai_quota_exceed(self, factory, project_creator, real_project):
        project = real_project
        payload = {'connection_id': 1, 'record_id': 2, 'project_uuid': project.uuid}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = project_creator

        with patch('seahub.project.ai.check_ai_limit', return_value=True):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 402

    def test_post_connection_not_found(self, factory, project_creator, real_project):
        project = real_project
        payload = {'connection_id': -1, 'record_id': 2, 'project_uuid': project.uuid}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = project_creator

        with patch('seahub.project.ai.check_ai_limit', return_value=False):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 404

    def test_post_record_detail_not_found(self, factory, project_creator, real_project, site_connection):
        project = real_project
        payload = {'connection_id': site_connection.id, 'record_id': 2, 'project_uuid': project.uuid}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = project_creator

        with patch('seahub.project.ai.check_ai_limit', return_value=False):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 404

    def test_post_ai_service_error(self, factory, project_creator, real_project, github_issue_connection):
        project = real_project
        payload = {'connection_id': github_issue_connection.id, 'record_id': 2, 'project_uuid': project.uuid}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = project_creator

        github_api = Mock()
        github_api.get_issue_by_pk.return_value = [{'title': 't', 'content': 'c', 'issue_id': 1}]
        github_api.get_comments_by_issue_id.return_value = []

        with patch('seahub.project.ai.check_ai_limit', return_value=False), \
                patch('seahub.project.ai.GitHubSeaDBAPI', return_value=github_api), \
                patch('seahub.project.ai.convert_record_to_ticket', side_effect=Exception('ai down')):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 500

    def test_post_success_returns_title_and_content(self, factory, project_creator, real_project, github_issue_connection):
        project = real_project
        payload = {'connection_id': github_issue_connection.id, 'record_id': 2, 'project_uuid': project.uuid}
        request = factory.post('/api/v1/ai/convert-record-to-ticket/', data=payload, format='json')
        request.user = project_creator

        github_api = Mock()
        github_api.get_issue_by_pk.return_value = [{'title': 't', 'content': 'c', 'issue_id': 1}]
        github_api.get_comments_by_issue_id.return_value = []

        with patch('seahub.project.ai.check_ai_limit', return_value=False), \
                patch('seahub.project.ai.GitHubSeaDBAPI', return_value=github_api), \
                patch('seahub.project.ai.convert_record_to_ticket', return_value=('ai-title', 'ai-content')):
            resp = ConvertRecordToTicket.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['title'] == 'ai-title'
        assert resp.data['content'] == 'ai-content'


class TestEmbeddingAnalysisView:

    def test_post_missing_project_uuid(self, factory, project_creator):
        request = factory.post('/api/v1/ai/embedding-analysis/', data={}, format='json')
        request.user = project_creator

        resp = EmbeddingAnalysisView.as_view()(request)

        assert resp.status_code == 400

    def test_post_task_conflict(self, factory, project_creator, real_project):
        project = real_project
        payload = {'project_uuid': project.uuid, 'connection_ids': [1]}
        request = factory.post('/api/v1/ai/embedding-analysis/', data=payload, format='json')
        request.user = project_creator

        with patch('seahub.project.ai.submit_embedding_analysis_task', side_effect=TaskConflictError('conflict')):
            resp = EmbeddingAnalysisView.as_view()(request)

        assert resp.status_code == 409

    def test_post_success_returns_task_id(self, factory, project_creator, real_project):
        project = real_project
        payload = {'project_uuid': project.uuid, 'connection_ids': [1]}
        request = factory.post('/api/v1/ai/embedding-analysis/', data=payload, format='json')
        request.user = project_creator

        with patch('seahub.project.ai.submit_embedding_analysis_task', return_value='task-1'):
            resp = EmbeddingAnalysisView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['task_id'] == 'task-1'


class TestEmbeddingAnalysisTaskStatusView:

    def test_get_success(self, factory, project_creator):
        request = factory.get('/api/v1/ai/embedding-analysis-task-status/task-1/')
        request.user = project_creator

        with patch('seahub.project.ai.get_embedding_analysis_task_status', return_value={'status': 'done'}):
            resp = EmbeddingAnalysisTaskStatusView.as_view()(request, task_id='task-1')

        assert resp.status_code == 200
        assert resp.data['status'] == 'done'


class TestRelatedRecordsView:

    def test_post_project_not_found(self, factory, project_creator):
        request = factory.post('/api/v1/ai/related-records/', data={'project_uuid': '00000000-0000-0000-0000-000000000000'}, format='json')
        request.user = project_creator

        view = RelatedRecordsView()
        drf_request = view.initialize_request(request)
        result = view.post(drf_request)
        resp = result[1] if isinstance(result, tuple) else result

        assert resp.status_code == 404

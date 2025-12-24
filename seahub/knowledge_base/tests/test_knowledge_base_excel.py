# -*- coding: utf-8 -*-
"""
Unit tests for knowledge_base_excel API endpoints.
"""

from unittest.mock import Mock, patch


def get_kb_convert_view_url(project_uuid):
    return f'/api/v1/project/{project_uuid}/knowledge-bases/convert-view-to-excel/'


def get_kb_io_status_url():
    return '/api/v1/kb-io-status/'


def get_kb_export_url(project_uuid):
    return f'/api/v1/project/{project_uuid}/knowledge-bases/export-excel/'


class TestKnowledgeBaseConvertViewToExcel:
    def test_get_missing_view_id_returns_400(self, api_client, project_uuid):
        url = get_kb_convert_view_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 400
        assert 'view_id invalid' in resp.data['error_msg']

    def test_get_project_not_found_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_none_excel
    ):
        url = get_kb_convert_view_url(project_uuid)
        params = {'view_id': '0000'}

        resp = api_client.get(url, params)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client, project_uuid, mock_get_project_by_uuid_excel,
        mock_check_permission_denied_excel
    ):
        url = get_kb_convert_view_url(project_uuid)
        params = {'view_id': '0000'}

        resp = api_client.get(url, params)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_convert_error_returns_500(
        self, api_client, project_uuid, mock_get_project_by_uuid_excel,
        mock_check_permission_granted_excel, mock_convert_kb_view_to_excel
    ):
        mock_convert_kb_view_to_excel.side_effect = Exception('boom')
        url = get_kb_convert_view_url(project_uuid)
        params = {'view_id': '0000'}

        resp = api_client.get(url, params)

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_get_success_returns_task_id(
        self, api_client, project_uuid, mock_get_project_by_uuid_excel,
        mock_check_permission_granted_excel, mock_convert_kb_view_to_excel
    ):
        url = get_kb_convert_view_url(project_uuid)
        params = {'view_id': '0000'}

        resp = api_client.get(url, params)

        assert resp.status_code == 200
        assert resp.data == {'task_id': 'task-123'}
        mock_convert_kb_view_to_excel.assert_called_once()


class TestKnowledgeBaseIOStatus:
    def test_get_missing_task_id_returns_400(self, api_client):
        url = get_kb_io_status_url()

        resp = api_client.get(url)

        assert resp.status_code == 400
        assert 'task_id invalid' in resp.data['error_msg']

    def test_get_json_error_returns_500(self, api_client, mock_query_kb_task_status):
        mock_resp = Mock()
        mock_resp.json.side_effect = ValueError('bad json')
        mock_query_kb_task_status.return_value = mock_resp

        url = get_kb_io_status_url()
        params = {'task_id': 'task-1'}

        resp = api_client.get(url, params)

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_get_status_500_returns_remote_message(
        self, api_client, mock_query_kb_task_status
    ):
        mock_resp = Mock()
        mock_resp.json.return_value = {'error_msg': 'server fail'}
        mock_resp.status_code = 500
        mock_resp.ok = False
        mock_query_kb_task_status.return_value = mock_resp

        url = get_kb_io_status_url()
        params = {'task_id': 'task-2'}

        resp = api_client.get(url, params)

        assert resp.status_code == 500
        assert 'server fail' in resp.data['error_msg']

    def test_get_not_ok_returns_status_code(
        self, api_client, mock_query_kb_task_status
    ):
        mock_resp = Mock()
        mock_resp.json.return_value = {'error_msg': 'not ready'}
        mock_resp.status_code = 404
        mock_resp.ok = False
        mock_query_kb_task_status.return_value = mock_resp

        url = get_kb_io_status_url()
        params = {'task_id': 'task-3'}

        resp = api_client.get(url, params)

        assert resp.status_code == 404
        assert 'not ready' in resp.data['error_msg']

    def test_get_success_returns_task_status(
        self, api_client, mock_query_kb_task_status
    ):
        mock_resp = Mock()
        mock_resp.json.return_value = {'task_id': 'task-4', 'status': 'ready'}
        mock_resp.status_code = 200
        mock_resp.ok = True
        mock_query_kb_task_status.return_value = mock_resp

        url = get_kb_io_status_url()
        params = {'task_id': 'task-4'}

        resp = api_client.get(url, params)

        assert resp.status_code == 200
        assert resp.data == {'task_id': 'task-4', 'status': 'ready'}


class TestKnowledgeBaseExportExcel:
    def test_get_missing_task_id_returns_400(self, api_client, project_uuid):
        url = get_kb_export_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 400
        assert 'task_id invalid' in resp.data['error_msg']

    def test_get_missing_view_id_returns_400(self, api_client, project_uuid):
        url = get_kb_export_url(project_uuid)
        params = {'task_id': 'task-1'}

        resp = api_client.get(url, params)

        assert resp.status_code == 400
        assert 'view_id invalid' in resp.data['error_msg']

    def test_get_project_not_found_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_none_excel
    ):
        url = get_kb_export_url(project_uuid)
        params = {'task_id': 'task-1', 'view_id': '0000'}

        resp = api_client.get(url, params)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client, project_uuid, mock_get_project_by_uuid_excel,
        mock_check_permission_denied_excel
    ):
        url = get_kb_export_url(project_uuid)
        params = {'task_id': 'task-1', 'view_id': '0000'}

        resp = api_client.get(url, params)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_view_not_found_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_excel,
        mock_check_permission_granted_excel
    ):
        with patch(
            'seahub.knowledge_base.knowledge_base_excel.KnowledgeBaseViews.objects.get_view',
            return_value=None
        ):
            url = get_kb_export_url(project_uuid)
            params = {'task_id': 'task-1', 'view_id': '0000'}

            resp = api_client.get(url, params)

        assert resp.status_code == 404
        assert 'View not found' in resp.data['error_msg']

    def test_get_file_missing_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_excel,
        mock_check_permission_granted_excel, mock_get_view_excel
    ):
        url = get_kb_export_url(project_uuid)
        params = {'task_id': 'task-1', 'view_id': '0000'}

        with patch(
            'seahub.knowledge_base.knowledge_base_excel.os.path.isfile',
            return_value=False
        ):
            resp = api_client.get(url, params)

        assert resp.status_code == 404
        assert 'not found' in resp.data['error_msg']

    def test_get_success_returns_file_response(
        self, api_client, project_uuid, mock_get_project_by_uuid_excel,
        mock_check_permission_granted_excel, mock_get_view_excel, tmp_path
    ):
        excel_name = 'Test Project_knowledge_base_All.xlsx'
        project_folder = tmp_path / project_uuid
        project_folder.mkdir()
        (project_folder / excel_name).write_bytes(b'data')

        url = get_kb_export_url(project_uuid)
        params = {'task_id': 'task-1', 'view_id': '0000'}
        with patch(
            'seahub.knowledge_base.knowledge_base_excel.TEMP_EXPORT_VIEW_DIR',
            str(tmp_path)
        ):
            resp = api_client.get(url, params)

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/ms-excel'
        assert 'attachment;filename*=UTF-8' in resp['Content-Disposition']

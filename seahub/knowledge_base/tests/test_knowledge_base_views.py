# -*- coding: utf-8 -*-
"""
Unit tests for knowledge_base_views API endpoints.
"""

import pytest
from unittest.mock import patch, Mock


# URL helper constructors ------------------------------------------------------

def get_kb_views_url(project_uuid):
    return f'/api/v2.1/project/{project_uuid}/knowledge-base-views/'


def get_kb_view_url(project_uuid, view_id):
    return f'/api/v2.1/project/{project_uuid}/knowledge-base-views/{view_id}/'


def get_kb_move_views_url(project_uuid):
    return f'/api/v2.1/project/{project_uuid}/knowledge-base-move-views/'


def get_kb_duplicate_views_url(project_uuid):
    return f'/api/v2.1/project/{project_uuid}/knowledge-base-duplicate-views/'


# KnowledgeBaseViewsAPI.get --------------------------------------------------

class TestKnowledgeBaseViewsGet:
    def test_get_project_not_found_returns_404(self, api_client, project_uuid, mock_get_project_by_uuid_none_views):
        url = get_kb_views_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_denied_views
    ):
        url = get_kb_views_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_internal_error_returns_500(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views
    ):
        url = get_kb_views_url(project_uuid)
        with patch(
            'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.list_views',
            side_effect=Exception('boom')
        ):
            resp = api_client.get(url)

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_get_success_returns_views(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_list_views
    ):
        url = get_kb_views_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 200
        assert resp.data == mock_list_views.return_value
        assert resp.data['views'][0]['name'] == 'All'


# KnowledgeBaseViewsAPI.post -------------------------------------------------

class TestKnowledgeBaseViewsPost:
    def test_post_missing_name_returns_400(self, api_client, project_uuid):
        url = get_kb_views_url(project_uuid)
        data = {'type': 'table'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 400
        assert 'view name is invalid' in resp.data['error_msg']

    def test_post_project_not_found_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_none_views
    ):
        url = get_kb_views_url(project_uuid)
        data = {'name': 'New view'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_post_permission_denied_returns_403(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_denied_views
    ):
        url = get_kb_views_url(project_uuid)
        data = {'name': 'New view'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_post_record_missing_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views_none
    ):
        url = get_kb_views_url(project_uuid)
        data = {'name': 'New view'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 404
        assert 'The views does not exists' in resp.data['error_msg']

    def test_post_success_returns_view(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views, mock_add_view
    ):
        url = get_kb_views_url(project_uuid)
        data = {'name': 'New view'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['view'] == mock_add_view.return_value


# KnowledgeBaseViewView.get --------------------------------------------------

class TestKnowledgeBaseViewDetailGet:
    def test_get_project_not_found_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_none_views
    ):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_denied_views
    ):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_record_missing_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views_none
    ):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'The views does not exists' in resp.data['error_msg']

    def test_get_success_returns_view(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views,
        mock_get_view, mock_views_record
    ):
        mock_views_record.views_ids = ['0000']
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.get(url)

        assert resp.status_code == 200
        assert resp.data['view'] == mock_get_view.return_value


# KnowledgeBaseViewView.put --------------------------------------------------

class TestKnowledgeBaseViewDetailPut:
    def test_put_missing_data_returns_400(self, api_client, project_uuid):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.put(url, {}, format='json')

        assert resp.status_code == 400
        assert 'view_data is invalid' in resp.data['error_msg']

    def test_put_view_not_found_returns_400(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views, mock_views_record
    ):
        mock_views_record.views_ids = ['0000']
        url = get_kb_view_url(project_uuid, 'missing')
        data = {'view_data': {'name': 'Updated'}}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 400
        assert 'does not exists' in resp.data['error_msg']

    def test_put_success_returns_true(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views, mock_views_record
    ):
        mock_views_record.views_ids = ['0000']
        with patch(
            'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.update_view',
            return_value={'views': []}
        ) as mock:
            url = get_kb_view_url(project_uuid, '0000')
            data = {'view_data': {'name': 'Updated'}}

            resp = api_client.put(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['success'] is True
        mock.assert_called_once()


# KnowledgeBaseViewView.delete -----------------------------------------------

class TestKnowledgeBaseViewDetailDelete:
    def test_delete_view_not_found_returns_400(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views, mock_views_record
    ):
        mock_views_record.views_ids = ['0000']
        url = get_kb_view_url(project_uuid, 'missing')

        resp = api_client.delete(url)

        assert resp.status_code == 400
        assert 'does not exists' in resp.data['error_msg']

    def test_delete_success_returns_true(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views,
        mock_views_record
    ):
        mock_views_record.views_ids = ['0000']
        with patch(
            'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.delete_view',
            return_value={'views': []}
        ) as mock:
            url = get_kb_view_url(project_uuid, '0000')

            resp = api_client.delete(url)

        assert resp.status_code == 200
        assert resp.data['success'] is True
        mock.assert_called_once()


# KnowledgeBaseViewsDuplicateView.post --------------------------------------

class TestKnowledgeBaseViewsDuplicate:
    def test_duplicate_missing_view_id_returns_400(self, api_client, project_uuid):
        url = get_kb_duplicate_views_url(project_uuid)

        resp = api_client.post(url, {}, format='json')

        assert resp.status_code == 400
        assert 'view_id invalid' in resp.data['error_msg']

    def test_duplicate_view_not_found_returns_404(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views, mock_views_record
    ):
        mock_views_record.views_ids = ['0000']
        url = get_kb_duplicate_views_url(project_uuid)
        data = {'view_id': 'missing'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 404
        assert 'does not exists' in resp.data['error_msg']

    def test_duplicate_success_returns_view(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views,
        mock_views_record, mock_duplicate_view
    ):
        mock_views_record.views_ids = ['0000']
        url = get_kb_duplicate_views_url(project_uuid)
        data = {'view_id': '0000'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['view'] == mock_duplicate_view.return_value


# KnowledgeBaseViewsMoveView.post -------------------------------------------

class TestKnowledgeBaseViewsMove:
    def test_move_missing_source_returns_400(self, api_client, project_uuid):
        url = get_kb_move_views_url(project_uuid)
        data = {'target_view_id': 'target'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 400
        assert 'source_view_id is invalid' in resp.data['error_msg']

    def test_move_missing_target_returns_400(self, api_client, project_uuid):
        url = get_kb_move_views_url(project_uuid)
        data = {'source_view_id': 'source'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 400
        assert 'target_view_id is invalid' in resp.data['error_msg']

    def test_move_success_returns_navigation(
        self, api_client, project_uuid, mock_get_project_by_uuid_views,
        mock_check_permission_granted_views, mock_get_record_views,
        mock_views_record, mock_move_view
    ):
        mock_views_record.views_ids = ['source', 'target']
        mock_views_record.folders_views_ids = ['source', 'target']
        url = get_kb_move_views_url(project_uuid)
        data = {'source_view_id': 'source', 'target_view_id': 'target'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['navigation'] == mock_move_view.return_value['navigation']
        mock_move_view.assert_called_once()

# -*- coding: utf-8 -*-
"""
Unit tests for Knowledge Base API endpoints.
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse


def get_knowledge_bases_url(project_uuid):
    """Get URL for knowledge bases list/create/delete endpoint."""
    return f'/api/v1/project/{project_uuid}/knowledge-bases/'


def get_knowledge_base_url(project_uuid, knowledge_id):
    """Get URL for single knowledge base endpoint."""
    return f'/api/v1/project/{project_uuid}/knowledge-bases/{knowledge_id}/'


# ============================================================================
# KnowledgeBasesAPIView.post Tests (Create)
# ============================================================================

class TestKnowledgeBasesPost:
    """Tests for POST /api/v1/project/{project_uuid}/knowledge-bases/"""

    def test_post_non_org_context_returns_403(
        self, api_client, project_uuid, mock_org_context_false
    ):
        """Test that non-org context returns 403 Forbidden."""
        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title', 'content': {'text': 'Test Content'}}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 403
        assert 'Feature is not enabled' in response.data['error_msg']

    def test_post_project_not_found_returns_404(
        self, api_client, project_uuid, mock_org_context, mock_get_project_by_uuid_none
    ):
        """Test that non-existent project returns 404."""
        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Q', 'content': {'text': 'Test A'}}

        response = api_client.post(url, data, format='json')

        print(f'[DEBUG]: response.data["error_msg"]: {response.data["error_msg"]}')
        assert response.status_code == 404
        assert 'not found' in response.data['error_msg']

    def test_post_permission_denied_returns_403(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_denied
    ):
        """Test that permission denied returns 403."""
        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title', 'content': {'text': 'Test Content'}}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 403
        assert 'Permission denied' in response.data['error_msg']

    def test_post_missing_title_returns_400(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted
    ):
        """Test that missing title returns 400."""
        url = get_knowledge_bases_url(project_uuid)
        data = {'content': {'text': 'Test Content'}}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 400
        assert 'title invalid' in response.data['error_msg']

    def test_post_missing_content_returns_400(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted
    ):
        """Test that missing content returns 400."""
        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title'}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 400
        assert 'content invalid' in response.data['error_msg']

    def test_post_empty_content_returns_400(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted
    ):
        """Test that empty content returns 400."""
        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title', 'content': '   '}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 400
        assert 'content invalid' in response.data['error_msg']

    def test_post_content_as_dict_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted, mock_seadb_api
    ):
        """Test that content as dict with 'text' field succeeds."""
        mock_seadb_api.insert_rows.return_value = {'pks': [1]}

        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title', 'content': {'text': 'Test Content Text'}}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 201
        assert 'row' in response.data
        assert response.data['row']['title'] == 'Test Title'

    def test_post_content_as_json_string_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted, mock_seadb_api
    ):
        """Test that content as JSON string with 'text' field succeeds."""
        mock_seadb_api.insert_rows.return_value = {'pks': [1]}

        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title', 'content': json.dumps({'text': 'Test Content Text'})}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 201
        assert 'row' in response.data

    def test_post_seadb_exception_returns_500(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted, mock_seadb_api
    ):
        """Test that SeaDBAPI exception returns 500."""
        mock_seadb_api.insert_rows.side_effect = Exception('Database error')

        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title', 'content': {'text': 'Test Content'}}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 500
        assert 'Internal Server Error' in response.data['error_msg']

    def test_post_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted, mock_seadb_api
    ):
        """Test successful knowledge base record creation."""
        mock_seadb_api.insert_rows.return_value = {'pks': [123]}

        url = get_knowledge_bases_url(project_uuid)
        data = {'title': 'Test Title', 'content': {'text': 'Test Content'}}

        response = api_client.post(url, data, format='json')

        assert response.status_code == 201
        assert 'row' in response.data
        assert response.data['row']['_pk'] == 123
        assert response.data['row']['title'] == 'Test Title'
        assert response.data['row']['content'] == 'Test Content'
        mock_seadb_api.insert_rows.assert_called_once()


# ============================================================================
# KnowledgeBasesAPIView.get Tests (List)
# ============================================================================

class TestKnowledgeBasesGet:
    """Tests for GET /api/v1/project/{project_uuid}/knowledge-bases/"""

    def test_get_non_org_context_returns_403(
        self, api_client, project_uuid, mock_org_context_false
    ):
        """Test that non-org context returns 403 Forbidden."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url, {'view_id': '0000'})

        assert response.status_code == 403
        assert 'Feature is not enabled' in response.data['error_msg']

    def test_get_invalid_start_uses_default(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_knowledge_base_views, mock_list_knowledge_base_records
    ):
        """Test that invalid start parameter uses default value."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url, {'view_id': '0000', 'start': 'invalid'})

        assert response.status_code == 200

    def test_get_negative_start_returns_400(
        self, api_client, project_uuid, mock_org_context
    ):
        """Test that negative start returns 400."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url, {'view_id': '0000', 'start': -1})

        assert response.status_code == 400
        assert 'start invalid' in response.data['error_msg']

    def test_get_negative_limit_returns_400(
        self, api_client, project_uuid, mock_org_context
    ):
        """Test that negative limit returns 400."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url, {'view_id': '0000', 'limit': -1})

        assert response.status_code == 400
        assert 'limit invalid' in response.data['error_msg']

    def test_get_missing_view_id_returns_400(
        self, api_client, project_uuid, mock_org_context
    ):
        """Test that missing view_id returns 400."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url)

        assert response.status_code == 400
        assert 'view_id is invalid' in response.data['error_msg']

    def test_get_project_not_found_returns_404(
        self, api_client, project_uuid, mock_org_context, mock_get_project_by_uuid_none
    ):
        """Test that non-existent project returns 404."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url, {'view_id': '0000'})

        assert response.status_code == 404
        assert 'Project not found' in response.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_denied
    ):
        """Test that permission denied returns 403."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url, {'view_id': '0000'})

        assert response.status_code == 403
        assert 'Permission denied' in response.data['error_msg']

    def test_get_seadb_exception_returns_500(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted, mock_knowledge_base_views
    ):
        """Test that SeaDBAPI exception returns 500."""
        with patch('seahub.knowledge_base.knowledge_base.list_knowledge_base_records',
                   side_effect=Exception('Database error')):
            url = get_knowledge_bases_url(project_uuid)

            response = api_client.get(url, {'view_id': '0000'})

            assert response.status_code == 500
            assert 'Internal Server Error' in response.data['error_msg']

    def test_get_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_knowledge_base_views, mock_list_knowledge_base_records
    ):
        """Test successful knowledge base records retrieval."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.get(url, {'view_id': '0000', 'start': 0, 'limit': 100})

        assert response.status_code == 200
        assert 'records' in response.data
        assert 'columns' in response.data
        assert len(response.data['records']) == 2


# ============================================================================
# KnowledgeBasesAPIView.delete Tests (Batch Delete)
# ============================================================================

class TestKnowledgeBasesDelete:
    """Tests for DELETE /api/v1/project/{project_uuid}/knowledge-bases/"""

    def test_delete_non_org_context_returns_403(
        self, api_client, project_uuid, mock_org_context_false
    ):
        """Test that non-org context returns 403 Forbidden."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {'record_ids': [1, 2]}, format='json')

        assert response.status_code == 403
        assert 'Feature is not enabled' in response.data['error_msg']

    def test_delete_missing_record_ids_returns_400(
        self, api_client, project_uuid, mock_org_context
    ):
        """Test that missing record_ids returns 400."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {}, format='json')

        assert response.status_code == 400
        assert 'record_ids is required' in response.data['error_msg']

    def test_delete_record_ids_not_list_returns_400(
        self, api_client, project_uuid, mock_org_context
    ):
        """Test that record_ids not being a list returns 400."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {'record_ids': 'not_a_list'}, format='json')

        assert response.status_code == 400
        assert 'record_ids must be a list' in response.data['error_msg']

    def test_delete_record_ids_non_integer_returns_400(
        self, api_client, project_uuid, mock_org_context
    ):
        """Test that record_ids containing non-integers returns 400."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {'record_ids': ['a', 'b']}, format='json')

        assert response.status_code == 400
        assert 'record_ids must be a list of integers' in response.data['error_msg']

    def test_delete_project_not_found_returns_404(
        self, api_client, project_uuid, mock_org_context, mock_get_project_by_uuid_none
    ):
        """Test that non-existent project returns 404."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {'record_ids': [1, 2]}, format='json')

        assert response.status_code == 404
        assert 'not found' in response.data['error_msg']

    def test_delete_permission_denied_returns_403(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_denied
    ):
        """Test that permission denied returns 403."""
        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {'record_ids': [1, 2]}, format='json')

        assert response.status_code == 403
        assert 'Permission denied' in response.data['error_msg']

    def test_delete_seadb_exception_returns_500(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted, mock_seadb_api
    ):
        """Test that SeaDBAPI exception returns 500."""
        mock_seadb_api.update_rows.side_effect = Exception('Database error')

        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {'record_ids': [1, 2]}, format='json')

        assert response.status_code == 500
        assert 'Internal Server Error' in response.data['error_msg']

    def test_delete_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted, mock_seadb_api
    ):
        """Test successful batch delete of knowledge base records."""
        mock_seadb_api.update_rows.return_value = None

        url = get_knowledge_bases_url(project_uuid)

        response = api_client.delete(url, {'record_ids': [1, 2, 3]}, format='json')

        assert response.status_code == 200
        assert response.data['success'] is True
        mock_seadb_api.update_rows.assert_called_once()


# ============================================================================
# KnowledgeBaseAPIView.get Tests (Get Single)
# ============================================================================

class TestKnowledgeBaseGet:
    """Tests for GET /api/v1/project/{project_uuid}/knowledge-bases/{knowledge_id}/"""

    def test_get_non_org_context_returns_403(
        self, api_client, project_uuid, mock_org_context_false
    ):
        """Test that non-org context returns 403 Forbidden."""
        url = get_knowledge_base_url(project_uuid, 1)

        response = api_client.get(url)

        assert response.status_code == 403
        assert 'Feature is not enabled' in response.data['error_msg']

    def test_get_project_not_found_returns_404(
        self, api_client, project_uuid, mock_org_context, mock_get_project_by_uuid_none
    ):
        """Test that non-existent project returns 404."""
        url = get_knowledge_base_url(project_uuid, 1)

        response = api_client.get(url)

        assert response.status_code == 404
        assert 'Project not found' in response.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_denied
    ):
        """Test that permission denied returns 403."""
        url = get_knowledge_base_url(project_uuid, 1)

        response = api_client.get(url)

        assert response.status_code == 403
        assert 'Permission denied' in response.data['error_msg']

    def test_get_seadb_exception_returns_500(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted
    ):
        """Test that SeaDBAPI exception returns 500."""
        with patch('seahub.knowledge_base.knowledge_base.get_knowledge_base_record_by_pk',
                   side_effect=Exception('Database error')):
            url = get_knowledge_base_url(project_uuid, 1)

            response = api_client.get(url)

            assert response.status_code == 500
            assert 'Internal Server Error' in response.data['error_msg']

    def test_get_record_not_found_returns_404(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_get_knowledge_base_record_by_pk_none
    ):
        """Test that non-existent record returns 404."""
        url = get_knowledge_base_url(project_uuid, 999)

        response = api_client.get(url)

        assert response.status_code == 404
        assert 'Knowledge base record not found' in response.data['error_msg']

    def test_get_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_get_knowledge_base_record_by_pk
    ):
        """Test successful single knowledge base record retrieval."""
        url = get_knowledge_base_url(project_uuid, 1)

        response = api_client.get(url)
        print("Response data:", response.data)

        assert response.status_code == 200
        assert 'record' in response.data
        assert response.data['record']['_pk'] == 1
        assert response.data['record']['title'] == 'Test Title'


# ============================================================================
# KnowledgeBaseAPIView.put Tests (Update)
# ============================================================================

class TestKnowledgeBasePut:
    """Tests for PUT /api/v1/project/{project_uuid}/knowledge-bases/{knowledge_id}/"""

    def test_put_non_org_context_returns_403(
        self, api_client, project_uuid, mock_org_context_false
    ):
        """Test that non-org context returns 403 Forbidden."""
        url = get_knowledge_base_url(project_uuid, 1)
        data = {'title': 'Updated Q', 'content': {'text': 'Updated A'}}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 403
        assert 'Feature is not enabled' in response.data['error_msg']

    def test_put_project_not_found_returns_404(
        self, api_client, project_uuid, mock_org_context, mock_get_project_by_uuid_none
    ):
        """Test that non-existent project returns 404."""
        url = get_knowledge_base_url(project_uuid, 1)
        data = {'title': 'Updated Title', 'content': {'text': 'Updated Content'}}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 404
        assert 'not found' in response.data['error_msg']

    def test_put_permission_denied_returns_403(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_denied
    ):
        """Test that permission denied returns 403."""
        url = get_knowledge_base_url(project_uuid, 1)
        data = {'title': 'Updated Q', 'content': {'text': 'Updated A'}}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 403
        assert 'Permission denied' in response.data['error_msg']

    def test_put_invalid_content_returns_400(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted
    ):
        """Test that invalid content (empty/whitespace) returns 400."""
        url = get_knowledge_base_url(project_uuid, 1)
        data = {'title': 'Updated Q', 'content': '   '}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 400
        assert 'content invalid' in response.data['error_msg']

    def test_put_record_not_found_returns_404(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_seadb_api, mock_get_knowledge_base_record_by_pk_none
    ):
        """Test that non-existent record returns 404."""
        url = get_knowledge_base_url(project_uuid, 999)
        data = {'title': 'Updated Title', 'content': {'text': 'Updated Content'}}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 404
        assert 'Knowledge base record not found' in response.data['error_msg']

    def test_put_seadb_exception_returns_500(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_seadb_api, mock_get_knowledge_base_record_by_pk
    ):
        """Test that SeaDBAPI exception returns 500."""
        mock_seadb_api.update_rows.side_effect = Exception('Database error')

        url = get_knowledge_base_url(project_uuid, 1)
        data = {'title': 'Updated Title', 'content': {'text': 'Updated Content'}}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 500
        assert 'Internal Server Error' in response.data['error_msg']

    def test_put_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_seadb_api, mock_get_knowledge_base_record_by_pk
    ):
        """Test successful knowledge base record update."""
        mock_seadb_api.update_rows.return_value = None

        url = get_knowledge_base_url(project_uuid, 1)
        data = {'title': 'Updated Title', 'content': {'text': 'Updated Content'}}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 200
        assert 'row' in response.data
        assert response.data['row']['title'] == 'Updated Title'
        assert response.data['row']['content'] == 'Updated Content'
        mock_seadb_api.update_rows.assert_called_once()

    def test_put_content_as_dict_success(
        self, api_client, project_uuid, mock_org_context,
        mock_get_project_by_uuid, mock_check_permission_granted,
        mock_seadb_api, mock_get_knowledge_base_record_by_pk
    ):
        """Test that content as dict with 'text' field succeeds on update."""
        mock_seadb_api.update_rows.return_value = None

        url = get_knowledge_base_url(project_uuid, 1)
        data = {'title': 'Updated Title', 'content': {'text': 'Updated Content Text'}}

        response = api_client.put(url, data, format='json')

        assert response.status_code == 200
        assert 'row' in response.data

# -*- coding: utf-8 -*-
"""
Unit tests for knowledge_base_tags API endpoints.
"""

from copy import deepcopy
from unittest.mock import patch


def get_kb_tags_url(project_uuid):
    """Return the knowledge base tags endpoint URL."""
    return f'/api/v1/project/{project_uuid}/tags/'


def get_kb_tag_url(project_uuid, tag_id):
    """Return the URL for a specific knowledge base tag."""
    return f'/api/v1/project/{project_uuid}/tags/{tag_id}/'


# Fixtures defined in conftest.py ------------------------------------------------

# KnowledgeBaseTagsAPIView.get --------------------------------------------------

class TestKnowledgeBaseTagsGet:
    """Tests GET /knowledge-base/tags/"""

    def test_get_non_org_returns_403(self, api_client, project_uuid, mock_org_context_tags_false):
        url = get_kb_tags_url(project_uuid) + '?link_type=knowledge_base'
        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Feature is not enabled' in resp.data['error_msg']

    def test_get_project_not_found_404(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_none_tags
    ):
        url = get_kb_tags_url(project_uuid) + '?link_type=knowledge_base'
        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_403(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_denied_tags
    ):
        url = get_kb_tags_url(project_uuid) + '?link_type=knowledge_base'
        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_internal_error_returns_500(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_seadb_api_tags
    ):
        url = get_kb_tags_url(project_uuid) + '?link_type=knowledge_base'
        with patch(
            'seahub.project_tags.project_tags.get_tag_counts_by_link_type',
            side_effect=Exception('db error')
        ):
            resp = api_client.get(url)

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']
        mock_seadb_api_tags.assert_called_once()

    def test_get_success(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_kb_counts
    ):
        url = get_kb_tags_url(project_uuid) + '?link_type=knowledge_base'
        resp = api_client.get(url)

        assert resp.status_code == 200
        assert resp.data['tags'] == [{'id': 'TAG1', 'name': 'Tag1', 'records_count': 2}]
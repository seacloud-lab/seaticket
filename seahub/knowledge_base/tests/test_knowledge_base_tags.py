# -*- coding: utf-8 -*-
"""
Unit tests for knowledge_base_tags API endpoints.
"""

from copy import deepcopy
from unittest.mock import patch


def get_kb_tags_url(project_uuid):
    """Return the knowledge base tags endpoint URL."""
    return f'/api/v1/project/{project_uuid}/knowledge-base/tags/'


def get_kb_tag_url(project_uuid, tag_id):
    """Return the URL for a specific knowledge base tag."""
    return f'/api/v1/project/{project_uuid}/knowledge-base/tags/{tag_id}/'


# Fixtures defined in conftest.py ------------------------------------------------

# KnowledgeBaseTagsAPIView.get --------------------------------------------------

class TestKnowledgeBaseTagsGet:
    """Tests GET /knowledge-base/tags/"""

    def test_get_non_org_returns_403(self, api_client, project_uuid, mock_org_context_tags_false):
        url = get_kb_tags_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Feature is not enabled' in resp.data['error_msg']

    def test_get_project_not_found_404(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_none_tags
    ):
        url = get_kb_tags_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_403(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_denied_tags
    ):
        url = get_kb_tags_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_internal_error_returns_500(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_seadb_api_tags
    ):
        url = get_kb_tags_url(project_uuid)
        with patch(
            'seahub.knowledge_base.knowledge_base_tags.get_kb_counts_group_by_column_name',
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
        url = get_kb_tags_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 200
        assert resp.data['tags'] == {'Tag1': 2}


# KnowledgeBaseTagsAPIView.post -------------------------------------------------

class TestKnowledgeBaseTagsPost:
    """Tests POST /knowledge-base/tags/"""

    def test_post_non_org_returns_403(self, api_client, project_uuid, mock_org_context_tags_false):
        url = get_kb_tags_url(project_uuid)
        resp = api_client.post(url, {}, format='json')

        assert resp.status_code == 403
        assert 'Feature is not enabled' in resp.data['error_msg']

    def test_post_missing_name_returns_400(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_granted_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {'color': '#fff', 'text_color': '#000'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 400
        assert 'name invalid' in resp.data['error_msg']

    def test_post_missing_color_returns_400(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_granted_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {'name': 'New Tag', 'text_color': '#000'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 400
        assert 'color invalid' in resp.data['error_msg']

    def test_post_missing_text_color_returns_400(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_granted_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {'name': 'New Tag', 'color': '#fff'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 400
        assert 'text_color invalid' in resp.data['error_msg']

    def test_post_project_not_found_404(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_none_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {'name': 'New Tag', 'color': '#fff', 'text_color': '#000'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_post_permission_denied_403(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_denied_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {'name': 'New Tag', 'color': '#fff', 'text_color': '#000'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_post_tag_exists_returns_400(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {'name': 'Tag1', 'color': '#fff', 'text_color': '#000'}
        base_metadata = {'tables': [deepcopy(mock_get_current_table_metadata.return_value)]}
        mock_seadb_api_tags.get_base_metadata.return_value = base_metadata

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 400
        assert 'already exists' in resp.data['error_msg']

    def test_post_internal_error_returns_500(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {'name': 'New Tag', 'color': '#fff', 'text_color': '#000'}
        base_metadata = {'tables': [deepcopy(mock_get_current_table_metadata.return_value)]}
        mock_seadb_api_tags.get_base_metadata.return_value = base_metadata
        with patch(
            'seahub.knowledge_base.knowledge_base_tags.add_select_option',
            side_effect=Exception('insert failed')
        ):
            resp = api_client.post(url, data, format='json')

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_post_success(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_add_select_option, mock_seadb_api_tags
    ):
        url = get_kb_tags_url(project_uuid)
        data = {
            'name': 'New Tag',
            'color': '#ffffff',
            'text_color': '#000000',
            'description': 'desc',
        }
        table_meta = deepcopy(mock_get_current_table_metadata.return_value)
        table_meta['columns'][0]['data']['options'] = []
        mock_seadb_api_tags.get_base_metadata.return_value = {'tables': [table_meta]}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 201
        assert 'tag' in resp.data
        assert resp.data['tag']['name'] == 'Tag1'


# KnowledgeBaseTagsAPIView.delete ----------------------------------------------

class TestKnowledgeBaseTagsDelete:
    """Tests DELETE /knowledge-base/tags/"""

    def test_delete_non_org_returns_403(self, api_client, project_uuid, mock_org_context_tags_false):
        url = get_kb_tags_url(project_uuid)

        resp = api_client.delete(url, {}, format='json')

        assert resp.status_code == 403
        assert 'Feature is not enabled' in resp.data['error_msg']

    def test_delete_missing_ids_returns_400(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_granted_tags
    ):
        url = get_kb_tags_url(project_uuid)

        resp = api_client.delete(url, {}, format='json')

        assert resp.status_code == 400
        assert 'tag_ids invalid' in resp.data['error_msg']

    def test_delete_project_not_found_404(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_none_tags
    ):
        url = get_kb_tags_url(project_uuid)
        payload = {'tag_ids': ['TAG1']}

        resp = api_client.delete(url, payload, format='json')

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_delete_permission_denied_403(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_denied_tags
    ):
        url = get_kb_tags_url(project_uuid)
        payload = {'tag_ids': ['TAG1']}

        resp = api_client.delete(url, payload, format='json')

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_delete_internal_error_returns_500(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tags_url(project_uuid)
        payload = {'tag_ids': ['TAG1']}
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }
        with patch(
            'seahub.knowledge_base.knowledge_base_tags.batch_delete_select_option',
            side_effect=Exception('delete failed')
        ):
            resp = api_client.delete(url, payload, format='json')

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_delete_success(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_batch_delete_select_option, mock_seadb_api_tags
    ):
        url = get_kb_tags_url(project_uuid)
        payload = {'tag_ids': ['TAG1']}
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }

        resp = api_client.delete(url, payload, format='json')

        assert resp.status_code == 200
        assert resp.data['success'] is True
        mock_batch_delete_select_option.assert_called_once()


# KnowledgeBaseTagAPIView.get ---------------------------------------------------

class TestKnowledgeBaseTagGet:
    """Tests GET /knowledge-base/tags/{tag_id}/"""

    def test_get_non_org_returns_403(self, api_client, project_uuid, mock_org_context_tags_false):
        url = get_kb_tag_url(project_uuid, 'TAG1')

        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Feature is not enabled' in resp.data['error_msg']

    def test_get_project_not_found(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_none_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_denied_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')

        resp = api_client.get(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_tag_not_found(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'MISS')
        table_meta = deepcopy(mock_get_current_table_metadata.return_value)
        table_meta['columns'][0]['data']['options'] = []
        mock_seadb_api_tags.get_base_metadata.return_value = {'tables': [table_meta]}

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'not found' in resp.data['error_msg']

    def test_get_internal_error(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_filter_kb_by_select, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }
        mock_filter_kb_by_select.side_effect = Exception('filter error')

        resp = api_client.get(url)

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_get_success(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_filter_kb_by_select, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }

        resp = api_client.get(url)

        assert resp.status_code == 200
        assert 'records' in resp.data
        assert 'columns' in resp.data


# KnowledgeBaseTagAPIView.put ---------------------------------------------------

class TestKnowledgeBaseTagPut:
    """Tests PUT /knowledge-base/tags/{tag_id}/"""

    def test_put_non_org_returns_403(self, api_client, project_uuid, mock_org_context_tags_false):
        url = get_kb_tag_url(project_uuid, 'TAG1')

        resp = api_client.put(url, {}, format='json')

        assert resp.status_code == 403
        assert 'Feature is not enabled' in resp.data['error_msg']

    def test_put_invalid_name_returns_400(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_granted_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        data = {'name': '   '}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 400
        assert 'name invalid' in resp.data['error_msg']

    def test_put_invalid_color_returns_400(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_granted_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        data = {'color': '   '}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 400
        assert 'color invalid' in resp.data['error_msg']

    def test_put_invalid_text_color_returns_400(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_granted_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        data = {'text_color': '   '}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 400
        assert 'text_color invalid' in resp.data['error_msg']

    def test_put_project_not_found(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_none_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        data = {'name': 'Tag1'}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_put_permission_denied(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_denied_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        data = {'name': 'Tag1'}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_put_tag_not_found(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'MISS')
        table_meta = deepcopy(mock_get_current_table_metadata.return_value)
        table_meta['columns'][0]['data']['options'] = []
        mock_seadb_api_tags.get_base_metadata.return_value = {'tables': [table_meta]}
        data = {'name': 'Tag1'}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 404
        assert 'not found' in resp.data['error_msg']

    def test_put_internal_error(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_update_select_option, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }
        mock_update_select_option.side_effect = Exception('update failed')
        data = {'name': 'New Name', 'color': '#fff', 'text_color': '#000', 'description': 'd'}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_put_success(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_update_select_option, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }
        data = {'name': 'New Name', 'description': 'Desc', 'color': '#fff', 'text_color': '#000'}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['success'] is True
        mock_update_select_option.assert_called_once()


# KnowledgeBaseTagAPIView.delete ------------------------------------------------

class TestKnowledgeBaseTagDelete:
    """Tests DELETE /knowledge-base/tags/{tag_id}/"""

    def test_delete_non_org_returns_403(self, api_client, project_uuid, mock_org_context_tags_false):
        url = get_kb_tag_url(project_uuid, 'TAG1')

        resp = api_client.delete(url)

        assert resp.status_code == 403
        assert 'Feature is not enabled' in resp.data['error_msg']

    def test_delete_project_not_found(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_none_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')

        resp = api_client.delete(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_delete_permission_denied(
        self, api_client, project_uuid, mock_org_context_tags,
        mock_get_project_by_uuid_tags, mock_check_permission_denied_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')

        resp = api_client.delete(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_delete_tag_not_found(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'MISS')
        table_meta = deepcopy(mock_get_current_table_metadata.return_value)
        table_meta['columns'][0]['data']['options'] = []
        mock_seadb_api_tags.get_base_metadata.return_value = {'tables': [table_meta]}

        resp = api_client.delete(url)

        assert resp.status_code == 404
        assert 'tag not found' in resp.data['error_msg']

    def test_delete_internal_error(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }
        mock_seadb_api_tags.delete_column_option.side_effect = Exception('delete failed')

        resp = api_client.delete(url)

        assert resp.status_code == 500
        assert 'Internal Server Error' in resp.data['error_msg']

    def test_delete_success(
        self, api_client, project_uuid, mock_org_context_tags, mock_get_project_by_uuid_tags,
        mock_check_permission_granted_tags, mock_get_current_table_metadata,
        mock_get_column_from_columns_by_name, mock_seadb_api_tags
    ):
        url = get_kb_tag_url(project_uuid, 'TAG1')
        mock_seadb_api_tags.get_base_metadata.return_value = {
            'tables': [deepcopy(mock_get_current_table_metadata.return_value)]
        }

        resp = api_client.delete(url)

        assert resp.status_code == 200
        assert resp.data['success'] is True
        mock_seadb_api_tags.delete_column_option.assert_called_once()
# -*- coding: utf-8 -*-
"""
Unit tests for knowledge_base_views API endpoints.
"""

from seahub.knowledge_base.models import KnowledgeBaseViews


# URL helper constructors ------------------------------------------------------

def get_kb_views_url(project_uuid):
    return f'/api/v1/project/{project_uuid}/knowledge-base-views/'


def get_kb_view_url(project_uuid, view_id):
    return f'/api/v1/project/{project_uuid}/knowledge-base-views/{view_id}/'


def get_kb_move_views_url(project_uuid):
    return f'/api/v1/project/{project_uuid}/knowledge-base-move-views/'


def get_kb_duplicate_views_url(project_uuid):
    return f'/api/v1/project/{project_uuid}/knowledge-base-duplicate-views/'


# KnowledgeBaseViewsAPI.get --------------------------------------------------

class TestKnowledgeBaseViewsGet:
    def test_get_project_not_found_returns_404(self, api_client, missing_project_uuid):
        url = get_kb_views_url(missing_project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client_other, project_uuid
    ):
        url = get_kb_views_url(project_uuid)

        resp = api_client_other.get(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_success_returns_views(
        self, api_client, project_uuid
    ):
        url = get_kb_views_url(project_uuid)

        resp = api_client.get(url)

        assert resp.status_code == 200
        assert 'views' in resp.data
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
        self, api_client, missing_project_uuid
    ):
        url = get_kb_views_url(missing_project_uuid)
        data = {'name': 'New view'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_post_permission_denied_returns_403(
        self, api_client_other, project_uuid
    ):
        url = get_kb_views_url(project_uuid)
        data = {'name': 'New view'}

        resp = api_client_other.post(url, data, format='json')

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_post_creates_record_if_missing(
        self, api_client, project_uuid
    ):
        url = get_kb_views_url(project_uuid)
        data = {'name': 'New view'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 200

    def test_post_success_returns_view(
        self, api_client, project_uuid
    ):
        url = get_kb_views_url(project_uuid)
        data = {'name': 'New view'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['view']['name'] == 'New view'


# KnowledgeBaseViewView.get --------------------------------------------------

class TestKnowledgeBaseViewDetailGet:
    def test_get_project_not_found_returns_404(
        self, api_client, missing_project_uuid
    ):
        url = get_kb_view_url(missing_project_uuid, '0000')

        resp = api_client.get(url)

        assert resp.status_code == 404
        assert 'Project not found' in resp.data['error_msg']

    def test_get_permission_denied_returns_403(
        self, api_client_other, project_uuid
    ):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client_other.get(url)

        assert resp.status_code == 403
        assert 'Permission denied' in resp.data['error_msg']

    def test_get_creates_record_if_missing(
        self, api_client, project_uuid
    ):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.get(url)

        assert resp.status_code == 200

    def test_get_success_returns_view(
        self, api_client, project_uuid
    ):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.get(url)

        assert resp.status_code == 200
        assert resp.data['view']['_id'] == '0000'


# KnowledgeBaseViewView.put --------------------------------------------------

class TestKnowledgeBaseViewDetailPut:
    def test_put_missing_data_returns_400(self, api_client, project_uuid):
        url = get_kb_view_url(project_uuid, '0000')

        resp = api_client.put(url, {}, format='json')

        assert resp.status_code == 400
        assert 'view_data is invalid' in resp.data['error_msg']

    def test_put_view_not_found_returns_400(
        self, api_client, project_uuid
    ):
        url = get_kb_view_url(project_uuid, 'missing')
        data = {'view_data': {'name': 'Updated'}}

        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 400
        assert 'does not exists' in resp.data['error_msg']

    def test_put_success_returns_true(
        self, api_client, project_uuid
    ):
        url = get_kb_view_url(project_uuid, '0000')
        data = {'view_data': {'name': 'Updated'}}
        resp = api_client.put(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['success'] is True
        view = KnowledgeBaseViews.objects.get_view(project_uuid, '0000')
        assert view.get('name') == 'Updated'


# KnowledgeBaseViewView.delete -----------------------------------------------

class TestKnowledgeBaseViewDetailDelete:
    def test_delete_view_not_found_returns_400(
        self, api_client, project_uuid
    ):
        url = get_kb_view_url(project_uuid, 'missing')

        resp = api_client.delete(url)

        assert resp.status_code == 400
        assert 'does not exists' in resp.data['error_msg']

    def test_delete_success_returns_true(
        self, api_client, project_uuid
    ):
        new_view = KnowledgeBaseViews.objects.add_view(project_uuid, 'ToDelete', 'table', {})
        url = get_kb_view_url(project_uuid, new_view.get('_id'))
        resp = api_client.delete(url)

        assert resp.status_code == 200
        assert resp.data['success'] is True


# KnowledgeBaseViewsDuplicateView.post --------------------------------------

class TestKnowledgeBaseViewsDuplicate:
    def test_duplicate_missing_view_id_returns_400(self, api_client, project_uuid):
        url = get_kb_duplicate_views_url(project_uuid)

        resp = api_client.post(url, {}, format='json')

        assert resp.status_code == 400
        assert 'view_id invalid' in resp.data['error_msg']

    def test_duplicate_view_not_found_returns_404(
        self, api_client, project_uuid
    ):
        url = get_kb_duplicate_views_url(project_uuid)
        data = {'view_id': 'missing'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 404
        assert 'does not exists' in resp.data['error_msg']

    def test_duplicate_success_returns_view(
        self, api_client, project_uuid
    ):
        url = get_kb_duplicate_views_url(project_uuid)
        data = {'view_id': '0000'}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 200
        assert resp.data['view']['_id'] != '0000'


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
        self, api_client, project_uuid
    ):
        source_view = KnowledgeBaseViews.objects.add_view(project_uuid, 'Source', 'table', {})
        target_view = KnowledgeBaseViews.objects.add_view(project_uuid, 'Target', 'table', {})
        url = get_kb_move_views_url(project_uuid)
        data = {'source_view_id': source_view.get('_id'), 'target_view_id': target_view.get('_id')}

        resp = api_client.post(url, data, format='json')

        assert resp.status_code == 200
        nav = resp.data['navigation']
        nav_ids = [item.get('_id') for item in nav]
        assert source_view.get('_id') in nav_ids
        assert target_view.get('_id') in nav_ids
        assert nav_ids.index(source_view.get('_id')) < nav_ids.index(target_view.get('_id'))

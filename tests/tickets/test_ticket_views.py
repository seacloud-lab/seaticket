import json
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import Mock, patch

import pytest
from rest_framework.test import APIRequestFactory

from seahub.project.models import Workspaces, Projects
from seahub.tickets.models import TicketViews

from seahub.tickets.ticket_views import (
    TicketFolders,
    TicketViewsAPI,
    TicketViewView,
    TicketViewsDuplicateView,
    TicketViewsMoveView,
)


def test_post_folder_missing_name(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-folders/', data={})
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_post_folder_project_not_found(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-folders/', data={'name': 'folder1'})
    request.user = user

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_post_folder_permission_denied(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-folders/', data={'name': 'folder1'})
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_post_folder_record_not_exists(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-folders/', data={'name': 'folder1'})
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_post_folder_success(factory, user):
    request = factory.post(
        '/api/v1/projects/p1/ticket-folders/', data={'name': 'folder1'}
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    record = Mock()

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.add_folder', return_value={'_id': 'f1', 'name': 'folder1'}):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert 'folder' in resp.data


def test_put_folder_missing_folder_id(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-folders/',
        data={'folder_data': {'name': 'n'}},
        format='json',
    )
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_put_folder_invalid_folder_data_reserved_keys(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-folders/',
        data={'folder_id': 'f1', 'folder_data': {'_id': 'x'}},
        format='json',
    )
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_put_folder_not_exists(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-folders/',
        data={'folder_id': 'f1', 'folder_data': {'name': 'n'}},
        format='json',
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_put_folder_success(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-folders/',
        data={'folder_id': 'f1', 'folder_data': {'name': 'n'}},
        format='json',
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.folders_ids = ['f1']

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.update_folder', return_value=True):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_delete_folder_missing_folder_id(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-folders/', data={}, format='json')
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_delete_folder_not_exists(factory, user):
    request = factory.delete(
        '/api/v1/projects/p1/ticket-folders/', data={'folder_id': 'f1'}, format='json'
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_delete_folder_success(factory, user):
    request = factory.delete(
        '/api/v1/projects/p1/ticket-folders/', data={'folder_id': 'f1'}, format='json'
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.folders_ids = ['f1']

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.delete_folder', return_value=True):
        resp = TicketFolders.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_get_views_project_not_found(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-views/')
    request.user = user

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_get_views_success(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-views/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.list_views', return_value=[{'id': 'v1', 'name': 'view1'}]):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert isinstance(resp.data, list)


def test_get_views_permission_denied(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-views/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_get_views_internal_server_error(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-views/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.list_views', side_effect=Exception('err')):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 500


def test_post_view_missing_name(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-views/', data={}, format='json')
    request.user = user

    resp = TicketViewsAPI.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_post_view_project_not_found(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json')
    request.user = user

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_post_view_permission_denied(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_post_view_record_not_exists(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_post_view_folder_not_exists(factory, user):
    request = factory.post(
        '/api/v1/projects/p1/ticket-views/',
        data={'name': 'view1', 'folder_id': 'f1'},
        format='json',
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    record = Mock()
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400


def test_post_view_success(factory, user):
    request = factory.post(
        '/api/v1/projects/p1/ticket-views/', data={'name': 'view1'}, format='json'
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    record = Mock()
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.add_view', return_value={'id': 'v1'}):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert 'view' in resp.data


def test_get_view_record_not_exists(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-views/v1/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
        resp = TicketViewView.as_view()(request, project_uuid='p1', view_id='v1')

    assert resp.status_code == 404


def test_get_view_success(factory, user):
    request = factory.get('/api/v1/projects/p1/ticket-views/v1/')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    record = Mock()

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_view', return_value={'id': 'v1'}):
        resp = TicketViewView.as_view()(request, project_uuid='p1', view_id='v1')

    assert resp.status_code == 200
    assert 'view' in resp.data


def test_put_view_missing_view_data(factory, user):
    request = factory.put('/api/v1/projects/p1/ticket-views/v1/', data={}, format='json')
    request.user = user

    resp = TicketViewView.as_view()(request, project_uuid='p1', view_id='v1')
    assert resp.status_code == 400


def test_put_view_id_not_exists(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-views/v1/',
        data={'view_data': {'name': 'n'}},
        format='json',
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.views_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
        resp = TicketViewView.as_view()(request, project_uuid='p1', view_id='v1')

    assert resp.status_code == 400


def test_put_view_success(factory, user):
    request = factory.put(
        '/api/v1/projects/p1/ticket-views/v1/',
        data={'view_data': {'name': 'n'}},
        format='json',
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.views_ids = ['v1']

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.update_view', return_value=True):
        resp = TicketViewView.as_view()(request, project_uuid='p1', view_id='v1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_delete_view_id_not_exists(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-views/v1/', data={}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.views_ids = []
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
        resp = TicketViewView.as_view()(request, project_uuid='p1', view_id='v1')

    assert resp.status_code == 400


def test_delete_view_success(factory, user):
    request = factory.delete('/api/v1/projects/p1/ticket-views/v1/', data={}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'
    record = Mock()
    record.views_ids = ['v1']
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.delete_view', return_value=True):
        resp = TicketViewView.as_view()(request, project_uuid='p1', view_id='v1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_post_duplicate_missing_view_id(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-views/duplicate/', data={})
    request.user = user

    resp = TicketViewsDuplicateView.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_post_duplicate_success(factory, user):
    request = factory.post(
        '/api/v1/projects/p1/ticket-views/duplicate/',
        data={'view_id': 'v1'},
        format='json',
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    record = Mock()
    record.views_ids = ['v1']
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.duplicate_view', return_value={'id': 'v2'}):
        resp = TicketViewsDuplicateView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 200
    assert 'view' in resp.data


def test_post_duplicate_view_id_not_exists(factory, user):
    request = factory.post(
        '/api/v1/projects/p1/ticket-views/duplicate/',
        data={'view_id': 'v9'},
        format='json',
    )
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    record = Mock()
    record.views_ids = ['v1']
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
        resp = TicketViewsDuplicateView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 404


def test_post_move_missing_source(factory, user):
    request = factory.post('/api/v1/projects/p1/ticket-views/move/', data={})
    request.user = user

    resp = TicketViewsMoveView.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_post_move_missing_target(factory, user):
    data = {'source_view_id': 'v1'}
    request = factory.post('/api/v1/projects/p1/ticket-views/move/', data=data, format='json')
    request.user = user

    resp = TicketViewsMoveView.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_post_move_success(factory):
    """使用真实 MySQL 记录，避免 seadb 依赖，仅 mock 权限检查。"""
    owner = f"owner_{uuid4().hex[:6]}@example.com"
    workspace = Workspaces.objects.create(owner=owner, org_id=1)
    project = Projects.objects.create_project(username=owner, workspace=workspace, name="proj-move")

    details = {
        "navigation": [
            {"_id": "v1", "type": "view"},
            {"_id": "v2", "type": "view"},
        ],
        "views": [
            {"_id": "v1", "name": "view1", "type": "table"},
            {"_id": "v2", "name": "view2", "type": "table"},
        ],
    }
    TicketViews.objects.create(project_uuid=project.uuid, details=json.dumps(details))

    data = {
        "source_view_id": "v1",
        "target_view_id": "v2",
        "is_above_folder": False,
    }
    request = factory.post(f"/api/v1/projects/{project.uuid}/ticket-views/move/", data=data, format="json")
    request.user = SimpleNamespace(id=1, username=owner, is_authenticated=True, is_active=True)

    with patch("seahub.tickets.ticket_views.check_project_permission", return_value=True):
        resp = TicketViewsMoveView.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert resp.data["navigation"] == [{"_id": "v1", "type": "view"}, {"_id": "v2", "type": "view"}]


def test_post_move_not_allowed_drag_folder_into_folder(factory, user):
    data = {
        'source_folder_id': 'f1',
        'target_view_id': 'v2',
        'target_folder_id': 'f2',
    }
    request = factory.post('/api/v1/projects/p1/ticket-views/move/', data=data, format='json')
    request.user = user

    resp = TicketViewsMoveView.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400

def test_post_move_source_view_id_not_exists(factory, user):
    data = {
        'source_view_id': 'v9',
        'target_view_id': 'v2',
    }
    request = factory.post('/api/v1/projects/p1/ticket-views/move/', data=data, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    record = Mock()
    record.views_ids = ['v2']
    record.folders_ids = []

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=record):
        resp = TicketViewsMoveView.as_view()(request, project_uuid='p1')

    assert resp.status_code == 400

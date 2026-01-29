import pytest
from django.urls import reverse
from unittest.mock import Mock, patch

from seahub.tickets.ticket_views import TicketFolders, TicketViewsAPI, TicketViewView, \
    TicketViewsDuplicateView, TicketViewsMoveView


FAKE_UUID = "11111111-1111-1111-1111-111111111111"


def test_post_folder_missing_name(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={})
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid=FAKE_UUID)
    assert resp.status_code == 400


def test_post_folder_project_not_found(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={'name': 'folder1'})
    request.user = user

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
        resp = TicketFolders.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 404


def test_post_folder_permission_denied(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={'name': 'folder1'})
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
        resp = TicketFolders.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 403


def test_post_folder_record_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={'name': 'folder1'})
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
        resp = TicketFolders.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 404


@pytest.mark.django_db
def test_post_folder_success(factory, auth_user, real_project, ticket_views_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': project.uuid})
    request = factory.post(url, data={'name': 'folder1'})
    request.user = auth_user

    resp = TicketFolders.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert 'folder' in resp.data


def test_put_folder_missing_folder_id(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.put(url, data={'folder_data': {'name': 'n'}}, format='json')
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_put_folder_invalid_folder_data_reserved_keys(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.put(
        url,
        data={'folder_id': 'f1', 'folder_data': {'_id': 'x'}},
        format='json',
    )
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_put_folder_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.put(
        url,
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
        resp = TicketFolders.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 400


@pytest.mark.django_db
def test_put_folder_success(factory, auth_user, real_project, ticket_views_folder_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': project.uuid})
    request = factory.put(
        url,
        data={'folder_id': 'f1', 'folder_data': {'name': 'n'}},
        format='json',
    )
    request.user = auth_user

    resp = TicketFolders.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_delete_folder_missing_folder_id(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.delete(url, data={}, format='json')
    request.user = user

    resp = TicketFolders.as_view()(request, project_uuid='p1')
    assert resp.status_code == 400


def test_delete_folder_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': FAKE_UUID})
    request = factory.delete(url, data={'folder_id': 'f1'}, format='json')
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


@pytest.mark.django_db
def test_delete_folder_success(factory, auth_user, real_project, ticket_views_folder_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-folders', kwargs={'project_uuid': project.uuid})
    request = factory.delete(url, data={'folder_id': 'f1'}, format='json')
    request.user = auth_user

    resp = TicketFolders.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_get_views_project_not_found(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.get(url)
    request.user = user

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
        resp = TicketViewsAPI.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 404


@pytest.mark.django_db
def test_get_views_success(factory, auth_user, real_project, ticket_views_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': project.uuid})
    request = factory.get(url)
    request.user = auth_user

    resp = TicketViewsAPI.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert isinstance(resp.data, dict)
    assert 'views' in resp.data
    assert 'navigation' in resp.data
    assert isinstance(resp.data['views'], list)


def test_get_views_permission_denied(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.get(url)
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
        resp = TicketViewsAPI.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 403


def test_get_views_internal_server_error(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.get(url)
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.list_views', side_effect=Exception('err')):
        resp = TicketViewsAPI.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 500


def test_post_view_missing_name(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={}, format='json')
    request.user = user

    resp = TicketViewsAPI.as_view()(request, project_uuid=FAKE_UUID)
    assert resp.status_code == 400


def test_post_view_project_not_found(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={'name': 'view1'}, format='json')
    request.user = user

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=None):
        resp = TicketViewsAPI.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 404


def test_post_view_permission_denied(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={'name': 'view1'}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=False):
        resp = TicketViewsAPI.as_view()(request, project_uuid='p1')

    assert resp.status_code == 403


def test_post_view_record_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={'name': 'view1'}, format='json')
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
        resp = TicketViewsAPI.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 404


def test_post_view_folder_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(
        url,
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
        resp = TicketViewsAPI.as_view()(request, project_uuid=FAKE_UUID)

    assert resp.status_code == 400


@pytest.mark.django_db
def test_post_view_success(factory, auth_user, real_project, ticket_views_record, mock_seadb):
    _, project = real_project
    url = reverse('api-v1-project-ticket-views', kwargs={'project_uuid': project.uuid})
    request = factory.post(url, data={'name': 'view1'}, format='json')
    request.user = auth_user

    resp = TicketViewsAPI.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert 'view' in resp.data


def test_get_view_record_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-view', kwargs={'project_uuid': FAKE_UUID, 'view_id': 'v1'})
    request = factory.get(url)
    request.user = user

    project = Mock()
    project.workspace = Mock()
    project.workspace.owner = 'owner@auth.local'

    with patch('seahub.tickets.ticket_views.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.tickets.ticket_views.check_project_permission', return_value=True), \
            patch('seahub.tickets.ticket_views.TicketViews.objects.get_record', return_value=None):
        resp = TicketViewView.as_view()(request, project_uuid=FAKE_UUID, view_id='v1')

    assert resp.status_code == 404


@pytest.mark.django_db
def test_get_view_success(factory, auth_user, real_project, ticket_views_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-view', kwargs={'project_uuid': project.uuid, 'view_id': 'v1'})
    request = factory.get(url)
    request.user = auth_user

    resp = TicketViewView.as_view()(request, project_uuid=str(project.uuid), view_id='v1')

    assert resp.status_code == 200
    assert 'view' in resp.data


def test_put_view_missing_view_data(factory, user):
    url = reverse('api-v1-project-ticket-view', kwargs={'project_uuid': FAKE_UUID, 'view_id': 'v1'})
    request = factory.put(url, data={}, format='json')
    request.user = user

    resp = TicketViewView.as_view()(request, project_uuid=FAKE_UUID, view_id='v1')
    assert resp.status_code == 400


def test_put_view_id_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-view', kwargs={'project_uuid': FAKE_UUID, 'view_id': 'v1'})
    request = factory.put(
        url,
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
        resp = TicketViewView.as_view()(request, project_uuid=FAKE_UUID, view_id='v1')

    assert resp.status_code == 400


@pytest.mark.django_db
def test_put_view_success(factory, auth_user, real_project, ticket_views_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-view', kwargs={'project_uuid': project.uuid, 'view_id': 'v1'})
    request = factory.put(
        url,
        data={'view_data': {'name': 'n'}},
        format='json',
    )
    request.user = auth_user

    resp = TicketViewView.as_view()(request, project_uuid=str(project.uuid), view_id='v1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_delete_view_id_not_exists(factory, user):
    url = reverse('api-v1-project-ticket-view', kwargs={'project_uuid': FAKE_UUID, 'view_id': 'v1'})
    request = factory.delete(url, data={}, format='json')
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
        resp = TicketViewView.as_view()(request, project_uuid=FAKE_UUID, view_id='v1')

    assert resp.status_code == 400


@pytest.mark.django_db
def test_delete_view_success(factory, auth_user, real_project, ticket_views_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-view', kwargs={'project_uuid': project.uuid, 'view_id': 'v1'})
    request = factory.delete(url, data={}, format='json')
    request.user = auth_user

    resp = TicketViewView.as_view()(request, project_uuid=str(project.uuid), view_id='v1')

    assert resp.status_code == 200
    assert resp.data['success'] is True


def test_post_duplicate_missing_view_id(factory, user):
    url = reverse('api-v1-project-ticket-view-duplicate', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={})
    request.user = user

    resp = TicketViewsDuplicateView.as_view()(request, project_uuid=FAKE_UUID)
    assert resp.status_code == 400


@pytest.mark.django_db
def test_post_duplicate_success(factory, auth_user, real_project, ticket_views_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-view-duplicate', kwargs={'project_uuid': project.uuid})
    request = factory.post(
        url,
        data={'view_id': 'v1'},
        format='json',
    )
    request.user = auth_user

    resp = TicketViewsDuplicateView.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert 'view' in resp.data


@pytest.mark.django_db
def test_post_duplicate_view_id_not_exists(factory, auth_user, real_project, ticket_views_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-view-duplicate', kwargs={'project_uuid': project.uuid})
    request = factory.post(
        url,
        data={'view_id': 'v9'},
        format='json',
    )
    request.user = auth_user

    resp = TicketViewsDuplicateView.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 404


def test_post_move_missing_source(factory, user):
    url = reverse('api-v1-project-ticket-views-move', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data={})
    request.user = user

    resp = TicketViewsMoveView.as_view()(request, project_uuid=FAKE_UUID)
    assert resp.status_code == 400


def test_post_move_missing_target(factory, user):
    data = {'source_view_id': 'v1'}
    url = reverse('api-v1-project-ticket-views-move', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data=data, format='json')
    request.user = user

    resp = TicketViewsMoveView.as_view()(request, project_uuid=FAKE_UUID)
    assert resp.status_code == 400


@pytest.mark.django_db
def test_post_move_success(factory, auth_user, real_project, ticket_views_move_record):
    _, project = real_project
    url = reverse('api-v1-project-ticket-views-move', kwargs={'project_uuid': project.uuid})

    data = {
        "source_view_id": "v1",
        "target_view_id": "v2",
        "is_above_folder": False,
    }
    request = factory.post(url, data=data, format="json")
    request.user = auth_user

    resp = TicketViewsMoveView.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 200
    assert resp.data["navigation"] == [{"_id": "v1", "type": "view"}, {"_id": "v2", "type": "view"}]


def test_post_move_not_allowed_drag_folder_into_folder(factory, user):
    data = {
        'source_folder_id': 'f1',
        'target_view_id': 'v2',
        'target_folder_id': 'f2',
    }
    url = reverse('api-v1-project-ticket-views-move', kwargs={'project_uuid': FAKE_UUID})
    request = factory.post(url, data=data, format='json')
    request.user = user

    resp = TicketViewsMoveView.as_view()(request, project_uuid=FAKE_UUID)
    assert resp.status_code == 400

@pytest.mark.django_db
def test_post_move_source_view_id_not_exists(factory, auth_user, real_project, ticket_views_move_record):
    data = {
        'source_view_id': 'v9',
        'target_view_id': 'v2',
    }
    _, project = real_project
    url = reverse('api-v1-project-ticket-views-move', kwargs={'project_uuid': project.uuid})
    request = factory.post(url, data=data, format='json')
    request.user = auth_user

    resp = TicketViewsMoveView.as_view()(request, project_uuid=str(project.uuid))

    assert resp.status_code == 400

# -*- coding: utf-8 -*-

from seahub.project.connections_views import (
    ConnectionViewsAPI,
    ConnectionViewAPI,
    ConnectionViewsDuplicateView,
    ConnectionViewsMoveView,
)
from seahub.project.models import ConnectionsViews


class TestConnectionViewsAPI:

    def test_get_project_not_found(self, factory, project_creator):
        request = factory.get('/api/v1/project/p1/connections/1/views/')
        request.user = project_creator

        resp = ConnectionViewsAPI.as_view()(request, project_uuid='p1', connection_id='1')

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/")
        request.user = auth_user

        resp = ConnectionViewsAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 403

    def test_get_connection_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/9999/views/")
        request.user = project_creator

        resp = ConnectionViewsAPI.as_view()(request, project_uuid=str(project.uuid), connection_id='9999')

        assert resp.status_code == 404

    def test_get_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/")
        request.user = project_creator

        resp = ConnectionViewsAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 200
        assert 'views' in resp.data
        assert resp.data['views'][0]['name'] == 'All'

    def test_post_missing_name(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/", data={}, format='json')
        request.user = project_creator

        resp = ConnectionViewsAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 400

    def test_post_project_not_found(self, factory, project_creator, connection_factory):
        connection = connection_factory()
        request = factory.post('/api/v1/project/p1/connections/1/views/', data={'name': 'v1'}, format='json')
        request.user = project_creator

        resp = ConnectionViewsAPI.as_view()(request, project_uuid='p1', connection_id=str(connection.id))

        assert resp.status_code == 404

    def test_post_connection_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/9999/views/", data={'name': 'v1'}, format='json')
        request.user = project_creator

        resp = ConnectionViewsAPI.as_view()(request, project_uuid=str(project.uuid), connection_id='9999')

        assert resp.status_code == 404

    def test_post_permission_denied(self, factory, auth_user, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/", data={'name': 'v1'}, format='json')
        request.user = auth_user

        resp = ConnectionViewsAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 403

    def test_post_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/", data={'name': 'v1'}, format='json')
        request.user = project_creator

        resp = ConnectionViewsAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 200
        assert resp.data['view']['name'] == 'v1'


class TestConnectionViewAPI:

    def test_get_project_not_found(self, factory, project_creator):
        request = factory.get('/api/v1/project/p1/connections/1/views/0000/')
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid='p1', connection_id='1', view_id='0000')

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/0000/")
        request.user = auth_user

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='0000')

        assert resp.status_code == 403

    def test_get_connection_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/9999/views/0000/")
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id='9999', view_id='0000')

        assert resp.status_code == 404

    def test_get_view_not_found(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/missing/")
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='missing')

        assert resp.status_code == 404

    def test_get_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.get(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/0000/")
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='0000')

        assert resp.status_code == 200
        assert resp.data['view']['_id'] == '0000'

    def test_put_missing_view_data(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.put(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/0000/", data={}, format='json')
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='0000')

        assert resp.status_code == 400

    def test_put_view_not_found(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/missing/",
            data={'view_data': {'name': 'Updated'}},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='missing')

        assert resp.status_code == 400

    def test_put_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.put(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/0000/",
            data={'view_data': {'name': 'Updated'}},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='0000')

        assert resp.status_code == 200
        assert resp.data['success'] is True
        view = ConnectionsViews.objects.get_view(str(project.uuid), connection, '0000')
        assert view.get('name') == 'Updated'

    def test_delete_missing_view_id(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.delete(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views//")
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='')

        assert resp.status_code == 400

    def test_delete_view_not_found(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.delete(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/missing/")
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id='missing')

        assert resp.status_code == 400

    def test_delete_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        new_view = ConnectionsViews.objects.add_view(str(project.uuid), connection, 'ToDelete', 'table', {})
        request = factory.delete(f"/api/v1/project/{project.uuid}/connections/{connection.id}/views/{new_view.get('_id')}/")
        request.user = project_creator

        resp = ConnectionViewAPI.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id), view_id=new_view.get('_id'))

        assert resp.status_code == 200
        assert resp.data['success'] is True
        record = ConnectionsViews.objects.get_record(str(project.uuid), connection)
        assert new_view.get('_id') not in record.views_ids


class TestConnectionViewsDuplicateView:

    def test_post_missing_view_id(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(f"/api/v1/project/{project.uuid}/connections/{connection.id}/duplicate-views/", data={}, format='json')
        request.user = project_creator

        resp = ConnectionViewsDuplicateView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 400

    def test_post_view_not_found(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/duplicate-views/",
            data={'view_id': 'missing'},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewsDuplicateView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 404

    def test_post_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/duplicate-views/",
            data={'view_id': '0000'},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewsDuplicateView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 200
        assert resp.data['view']['_id'] != '0000'


class TestConnectionViewsMoveView:

    def test_post_missing_source(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/move-views/",
            data={'target_view_id': '0000'},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewsMoveView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 400

    def test_post_missing_target(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/move-views/",
            data={'source_view_id': '0000'},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewsMoveView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 400

    def test_post_source_view_not_found(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/move-views/",
            data={'source_view_id': 'missing', 'target_view_id': '0000'},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewsMoveView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 400

    def test_post_target_view_not_found(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/move-views/",
            data={'source_view_id': '0000', 'target_view_id': 'missing'},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewsMoveView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 400

    def test_post_success(self, factory, project_creator, real_project, connection_factory):
        project = real_project
        connection = connection_factory()
        source_view = ConnectionsViews.objects.add_view(str(project.uuid), connection, 'Source', 'table', {})
        target_view = ConnectionsViews.objects.add_view(str(project.uuid), connection, 'Target', 'table', {})
        request = factory.post(
            f"/api/v1/project/{project.uuid}/connections/{connection.id}/move-views/",
            data={'source_view_id': source_view.get('_id'), 'target_view_id': target_view.get('_id')},
            format='json',
        )
        request.user = project_creator

        resp = ConnectionViewsMoveView.as_view()(request, project_uuid=str(project.uuid), connection_id=str(connection.id))

        assert resp.status_code == 200
        nav = resp.data['navigation']
        nav_ids = [item.get('_id') for item in nav]
        assert source_view.get('_id') in nav_ids
        assert target_view.get('_id') in nav_ids
        assert nav_ids.index(source_view.get('_id')) < nav_ids.index(target_view.get('_id'))

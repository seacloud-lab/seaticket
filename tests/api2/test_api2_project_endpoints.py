from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from seahub.api2.endpoints.project import (
    ProjectsView,
    ProjectView,
    SearchView,
    TrashProjectView,
    TrashProjectsView,
    WorkspacesView,
)
from seahub.project.models import Projects


@pytest.mark.django_db
class TestWorkspacesView:

    def test_get_detail_invalid(self, factory, project_creator):
        request = factory.get('/api/v1/workspaces/', {'detail': 'x'})
        request.user = project_creator

        resp = WorkspacesView.as_view()(request)

        assert resp.status_code == 400

    def test_get_detail_false_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get('/api/v1/workspaces/', {'detail': 'false'})
        request.user = project_creator

        resp = WorkspacesView.as_view()(request)

        assert resp.status_code == 200
        assert 'workspace_list' in resp.data
        assert any(w.get('type') == 'personal' for w in resp.data['workspace_list'])
        assert project.workspace.id in [w.get('id') for w in resp.data['workspace_list']]


@pytest.mark.django_db
class TestProjectsView:

    def test_post_permission_denied(self, factory, project_creator):
        request = factory.post('/api/v1/projects/', data={'name': 'p1'}, format='multipart')
        user_dict = dict(project_creator.__dict__)
        user_dict['permissions'] = SimpleNamespace(can_add_project=lambda: False)
        request.user = SimpleNamespace(**user_dict)

        resp = ProjectsView.as_view()(request)

        assert resp.status_code == 403

    def test_post_workspace_not_found(self, factory, project_creator):
        request = factory.post('/api/v1/projects/', data={'workspace_id': 999999, 'name': 'p1'}, format='multipart')
        request.user = project_creator

        resp = ProjectsView.as_view()(request)

        assert resp.status_code == 404

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        workspace = project.workspace
        request = factory.post(
            '/api/v1/projects/',
            data={'workspace_id': workspace.id, 'name': 'new-proj'},
            format='multipart',
        )
        request.user = project_creator

        seadb = MagicMock()

        with patch('seahub.api2.endpoints.project.SeaDBAPI', return_value=seadb), \
                patch('seahub.api2.endpoints.project.init_ticket_seadb_table'), \
                patch('seahub.api2.endpoints.project.init_knowledge_base_seadb_table'), \
                patch('seahub.api2.endpoints.project.init_tag_seadb_table'):
            resp = ProjectsView.as_view()(request)

        assert resp.status_code == 201
        assert 'project' in resp.data


@pytest.mark.django_db
class TestProjectView:

    def test_put_name_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 400

    def test_put_workspace_not_found(self, factory, project_creator):
        request = factory.put('/api/v1/workspace/999999/project/', data={'name': 'x'}, format='json')
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id='999999')

        assert resp.status_code == 404

    def test_put_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name, 'new_name': 'x'},
            format='json',
        )
        request.user = auth_user

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 403

    def test_put_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name, 'new_name': 'renamed'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 200
        assert 'project' in resp.data

    def test_delete_name_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 400

    def test_delete_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 200
        assert resp.data.get('success') is True


@pytest.mark.django_db
class TestSearchView:

    def test_post_project_uuid_invalid(self, factory, project_creator):
        request = factory.post('/api/v1/search/', data={'workspace_id': 1, 'query': 'x'}, format='json')
        request.user = project_creator

        resp = SearchView.as_view()(request)

        assert resp.status_code == 400

    def test_post_permission_denied(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.post(
            '/api/v1/search/',
            data={'project_uuid': project.uuid, 'workspace_id': project.workspace.id, 'query': 'x', 'connection_ids': [1]},
            format='json',
        )
        request.user = no_org_user

        resp = SearchView.as_view()(request)

        assert resp.status_code == 403

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            '/api/v1/search/',
            data={'project_uuid': project.uuid, 'workspace_id': project.workspace.id, 'query': 'x', 'connection_ids': [1]},
            format='json',
        )
        request.user = project_creator

        with patch('seahub.api2.endpoints.project.search', return_value=[{'id': 1}]):
            resp = SearchView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data == {'results': [{'id': 1}]}


@pytest.mark.django_db
class TestTrashProjectsView:

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        Projects.objects.filter(id=project.id).update(deleted=True)

        request = factory.get('/api/v1/trash-projects/')
        request.user = project_creator

        resp = TrashProjectsView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data['count'] >= 1
        assert isinstance(resp.data.get('trash_project_list'), list)


@pytest.mark.django_db
class TestTrashProjectView:

    def test_put_project_not_found(self, factory, project_creator):
        request = factory.put('/api/v1/trash-projects/p1/', data={}, format='json')
        request.user = project_creator

        resp = TrashProjectView.as_view()(request, project_uuid='00000000-0000-0000-0000-000000000000')

        assert resp.status_code == 404

    def test_put_permission_denied(self, factory, project_creator, real_project):
        project = real_project
        Projects.objects.filter(id=project.id).update(deleted=True)

        request = factory.put(f'/api/v1/trash-projects/{project.uuid}/', data={}, format='json')
        request.user = SimpleNamespace(**{**project_creator.__dict__, 'username': 'other@example.com'})

        resp = TrashProjectView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 403

    def test_put_success(self, factory, project_creator, real_project):
        project = real_project
        Projects.objects.filter(id=project.id).update(deleted=True)

        request = factory.put(f'/api/v1/trash-projects/{project.uuid}/', data={}, format='json')
        request.user = project_creator

        resp = TrashProjectView.as_view()(request, project_uuid=project.uuid)

        assert resp.status_code == 200
        assert resp.data.get('success') is True

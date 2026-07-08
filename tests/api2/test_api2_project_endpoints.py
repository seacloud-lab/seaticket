from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.parse import quote

import pytest
from django.urls import Resolver404, resolve

from seahub.api2.endpoints.project import (
    WebpageRelatedInformationView,
    ProjectsView,
    ProjectView,
    SearchView,
    TrashProjectView,
    TrashProjectsView,
    WorkspacesView,
    extract_fields_from_url,
)
from seahub.constants import PERMISSION_READ_WRITE
from seahub.organizations.models import OrgGroup
from seahub.project.constants import ConnectionType
from seahub.project.models import Projects, Workspaces
from seahub.utils import uuid_str_to_32_chars


def test_trash_project_route_accepts_36_char_project_uuid(real_project):
    match = resolve(f'/api/v1/trash-projects/{str(real_project.uuid)}/')

    assert match.url_name == 'api-v1-trash-project'
    assert match.kwargs['project_uuid'] == str(real_project.uuid)


def test_trash_project_route_rejects_32_project_uuid(real_project):
    route = f'/api/v1/trash-projects/{uuid_str_to_32_chars(str(real_project.uuid))}/'
    with pytest.raises(Resolver404):
        resolve(route)


@pytest.mark.django_db
class TestWorkspacesView:
    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.get('/api/v1/workspaces/')
        request.user = project_creator

        resp = WorkspacesView.as_view()(request)

        assert resp.status_code == 200
        assert 'workspace_list' in resp.data
        personal_workspace = next((w for w in resp.data['workspace_list'] if w.get('id') == project.workspace.id), None)
        assert personal_workspace is not None
        assert personal_workspace.get('type') == 'personal'
        assert any(p.get('id') == project.id for p in personal_workspace.get('projects', []))

    def test_get_non_org_context_returns_403(self, factory, no_org_user):
        request = factory.get('/api/v1/workspaces/')
        request.user = no_org_user

        resp = WorkspacesView.as_view()(request)

        assert resp.status_code == 403

    def test_get_auto_creates_personal_workspace_when_missing(self, factory, auth_user):
        request = factory.get('/api/v1/workspaces/')
        request.user = auth_user
        assert not Workspaces.objects.filter(owner=auth_user.username).exists()

        resp = WorkspacesView.as_view()(request)

        assert resp.status_code == 200
        workspace = Workspaces.objects.get(owner=auth_user.username)
        assert any(w.get('type') == 'personal' and w.get('id') == workspace.id for w in resp.data['workspace_list'])


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
                patch('seahub.api2.endpoints.project.init_seadb_tables_from_schema'):
            resp = ProjectsView.as_view()(request)

        assert resp.status_code == 201
        assert 'project' in resp.data
        assert Projects.objects.filter(workspace=workspace, name='new-proj', deleted=False).exists()


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
        assert resp.data['project']['name'] == 'renamed'
        project.refresh_from_db()
        assert project.name == 'renamed'

    def test_put_move_project_to_target_workspace_success(self, factory, project_creator, real_project):
        project = real_project
        target_group = OrgGroup.objects.create_org_group(1, 'target-group', project_creator.username)
        target_workspace = Workspaces.objects.create(owner=f'{target_group.group_id}@seafile_group', org_id=1)
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name, 'workspace_id': target_workspace.id},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 200
        assert resp.data['project']['workspace_id'] == target_workspace.id
        project.refresh_from_db()
        assert project.workspace_id == target_workspace.id

    def test_put_workspace_id_invalid(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name, 'workspace_id': 'bad-id'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 400

    def test_put_target_workspace_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name, 'workspace_id': 999999},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 404

    def test_put_target_workspace_permission_denied(self, factory, project_creator, real_project):
        project = real_project
        other_username = 'other-admin@example.com'
        target_group = OrgGroup.objects.create_org_group(1, 'other-group', other_username)
        target_workspace = Workspaces.objects.create(owner=f'{target_group.group_id}@seafile_group', org_id=1)
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name, 'workspace_id': target_workspace.id},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 403

    def test_put_target_workspace_cross_org_denied(self, factory, project_creator, real_project):
        project = real_project
        target_workspace = Workspaces.objects.create(owner='cross-org-owner@example.com', org_id=2)
        request = factory.put(
            f'/api/v1/workspace/{project.workspace.id}/project/',
            data={'name': project.name, 'workspace_id': target_workspace.id},
            format='json',
        )
        request.user = project_creator

        resp = ProjectView.as_view()(request, workspace_id=str(project.workspace.id))

        assert resp.status_code == 403

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
        project.refresh_from_db()
        assert project.deleted is True
        assert project.name.startswith(f'_(deleted_{project.id}) ')


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

        with patch('seahub.api2.endpoints.project.keyword_search', return_value=[{
            'type': 'test_type',
            '_id': 1,
            'title': 'test_doc_title',
            'content': 'test doc content',
            'modified_time': '2026-03-27T17-45-00'
        }]):
            resp = SearchView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data == {'results': [{
            'type': 'test_type',
            '_id': 1,
            'title': 'test_doc_title',
            'content': 'test doc content',
            'modified_time': '2026-03-27T17-45-00'
        }]}
        assert Projects.objects.filter(uuid=project.uuid).exists()

    def test_post_semantic_search_supports_portal_issue(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            '/api/v1/search/',
            data={
                'project_uuid': project.uuid,
                'workspace_id': project.workspace.id,
                'query': 'x',
                'extra_sources': ['portal_issue'],
                'search_type': 'semantic_search',
            },
            format='json',
        )
        request.user = project_creator

        reranked_results = [{
            'type': 'portal_issue',
            '_id': 9,
            'title': 'portal issue title',
            'content': 'portal issue content',
            'modified_time': '2026-03-27T17-45-00'
        }]

        with patch('seahub.api2.endpoints.project.vector_search_with_text', return_value=[{
            'type': 'portal_issue',
            '_id': 9,
            'modified_time': '2026-03-27T17-45-00'
        }]), \
                patch('seahub.api2.endpoints.project.retrieve_vector_search_rerank_data', return_value=reranked_results), \
                patch('seahub.api2.endpoints.project.rank_vector_search_results', return_value=reranked_results):
            resp = SearchView.as_view()(request)

        assert resp.status_code == 200
        assert resp.data == {'results': reranked_results}


@pytest.mark.django_db
class TestWebpageRelatedInformationView:

    def test_extract_fields_from_url(self):
        parts = extract_fields_from_url(
            'https://example.com/workspace/10/project/my%20project/connections/11/records/12?foo=bar'
        )
        assert parts == {'workspace_id': 10, 'project_name': 'my project', 'connection_id': 11, 'record_id': 12}

    def test_current_server_branch_checks_permission(self, factory, auth_user, real_project):
        project = real_project
        workspace = project.workspace
        request = factory.get(
            '/api/v1/webpage-related-information/',
            data={'webpage': f'https://example.com/workspace/{workspace.id}/project/{quote(project.name)}/connections/1/records/2?foo=bar'},
        )
        request.user = auth_user

        with patch('seahub.api2.endpoints.project.is_current_server', return_value=True), \
                patch('seahub.api2.endpoints.project.Workspaces.objects.get_workspace_by_id', return_value=workspace), \
                patch('seahub.api2.endpoints.project.Projects.objects.get_project', return_value=project) as get_project, \
                patch('seahub.api2.endpoints.project.ProjectConnections.objects.get_connection_by_id', return_value=SimpleNamespace(project_uuid=project.uuid)) as get_connection:
            resp = WebpageRelatedInformationView.as_view()(request)

        assert resp.status_code == 403
        get_project.assert_not_called()
        get_connection.assert_not_called()

    def test_current_server_branch_returns_related_info(self, factory, project_creator, real_project):
        project = real_project
        workspace = project.workspace
        request = factory.get(
            '/api/v1/webpage-related-information/',
            data={'webpage': f'https://example.com/workspace/{workspace.id}/project/{quote(project.name)}/connections/1/records/2?foo=bar'},
        )
        request.user = project_creator

        connection = SimpleNamespace(project_uuid=project.uuid, type=ConnectionType.GITHUB_ISSUE.value)

        with patch('seahub.api2.endpoints.project.is_current_server', return_value=True), \
                patch('seahub.api2.endpoints.project.Workspaces.objects.get_workspace_by_id', return_value=workspace), \
                patch('seahub.api2.endpoints.project.Projects.objects.get_project', return_value=project), \
                patch('seahub.api2.endpoints.project.ProjectConnections.objects.get_connection_by_id', return_value=connection), \
                patch('seahub.api2.endpoints.project.SeaDBAPI'), \
                patch('seahub.api2.endpoints.project.get_connection_record_by_pk', return_value=({'_pk': 2}, [], 'linked title')):
            resp = WebpageRelatedInformationView.as_view()(request)

        assert resp.status_code == 200
        related_info = resp.data['related_info'][str(project.uuid)]
        assert related_info['connection_type'] == ConnectionType.GITHUB_ISSUE.value
        assert related_info['connection_id'] == 1

    def test_external_branch_returns_related_info(self, factory, project_creator, real_project):
        project = real_project
        workspace = project.workspace
        request = factory.get(
            '/api/v1/webpage-related-information/',
            data={'webpage': 'https://github.com/seafile-ltd/seahub/issues/12'},
        )
        request.user = project_creator

        connection_row = [{
            'owner': project_creator.username,
            'color': project.color,
            'icon': project.icon,
            'name': project.name,
            'text_color': project.text_color,
            'uuid': project.uuid,
            'workspace_id': workspace.id,
            'connection_id': 8,
            'workspace_deleted': False,
            'project_deleted': False,
            'connection_deleted': False,
        }]

        with patch('seahub.api2.endpoints.project.is_current_server', return_value=False), \
                patch('seahub.api2.endpoints.project.get_org_project_connections_by_prefix_url', return_value=connection_row), \
                patch('seahub.api2.endpoints.project.SeaDBAPI'), \
                patch('seahub.api2.endpoints.project.get_issue_record_by_issue_number', return_value=({'_pk': 12}, [], 'linked title')):
            resp = WebpageRelatedInformationView.as_view()(request)

        assert resp.status_code == 200
        related_info = resp.data['related_info'][str(project.uuid)]
        assert related_info['connection_type'] == ConnectionType.GITHUB_ISSUE.value
        assert related_info['connection_id'] == 8

    def test_external_discourse_branch_returns_related_info(self, factory, project_creator, real_project):
        project = real_project
        workspace = project.workspace
        reply_request = factory.get(
            '/api/v1/webpage-related-information/',
            data={'webpage': 'https://forum.seafile.com/t/cant-delete-folder/17808'},
        )
        reply_request.user = project_creator

        topic_request = factory.get(
            '/api/v1/webpage-related-information/',
            data={'webpage': 'https://forum.seafile.com/t/cant-delete-folder/17808/3/'},
        )
        topic_request.user = project_creator

        connection_row = [{
            'owner': project_creator.username,
            'color': project.color,
            'icon': project.icon,
            'name': project.name,
            'text_color': project.text_color,
            'uuid': project.uuid,
            'workspace_id': workspace.id,
            'connection_id': 8,
            'workspace_deleted': False,
            'project_deleted': False,
            'connection_deleted': False,
        }]

        with patch('seahub.api2.endpoints.project.is_current_server', return_value=False), \
                patch('seahub.api2.endpoints.project.get_org_project_connections_by_prefix_url', return_value=connection_row), \
                patch('seahub.api2.endpoints.project.SeaDBAPI'), \
                patch('seahub.api2.endpoints.project.get_issue_record_by_issue_number', return_value=({'_pk': 12}, [], 'linked title')):
            reply_resp = WebpageRelatedInformationView.as_view()(reply_request)
        
        with patch('seahub.api2.endpoints.project.is_current_server', return_value=False), \
                patch('seahub.api2.endpoints.project.get_org_project_connections_by_prefix_url', return_value=connection_row), \
                patch('seahub.api2.endpoints.project.SeaDBAPI'), \
                patch('seahub.api2.endpoints.project.get_issue_record_by_issue_number', return_value=({'_pk': 12}, [], 'linked title')):
            topic_resp = WebpageRelatedInformationView.as_view()(topic_request)

        assert reply_resp.status_code == topic_resp.status_code
        reply_related_info = reply_resp.data['related_info'][str(project.uuid)]
        topic_related_info = topic_resp.data['related_info'][str(project.uuid)]
        assert reply_related_info['connection_type'] == topic_related_info['connection_type']
        assert reply_related_info['connection_id'] == topic_related_info['connection_id']


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
        project.refresh_from_db()
        assert project.deleted is False

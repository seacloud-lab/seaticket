# -*- coding: utf-8 -*-

from seahub.project.api_tokens import ProjectAPITokensView, ProjectAPITokenView
from seahub.project.models import ProjectAPIToken


class TestProjectAPITokensView:

    def test_get_non_org_context_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/api-tokens/")
        request.user = no_org_user

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_get_project_not_found(self, factory, project_creator):
        request = factory.get('/api/v1/project/p1/api-tokens/')
        request.user = project_creator

        resp = ProjectAPITokensView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_get_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.get(f"/api/v1/project/{project.uuid}/api-tokens/")
        request.user = auth_user

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_get_success(self, factory, project_creator, real_project):
        project = real_project
        ProjectAPIToken.objects.add(project, 'app1', project_creator.username, 'r')
        ProjectAPIToken.objects.add(project, 'app2', project_creator.username, 'rw')

        request = factory.get(f"/api/v1/project/{project.uuid}/api-tokens/")
        request.user = project_creator

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 200
        assert len(resp.data['api_tokens']) == 2

    def test_post_non_org_context_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/api-tokens/",
            data={'app_name': 'app1', 'permission': 'r'},
            format='json',
        )
        request.user = no_org_user

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_post_missing_app_name(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/api-tokens/",
            data={'permission': 'r'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_post_invalid_permission(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/api-tokens/",
            data={'app_name': 'app1', 'permission': 'bad'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_post_project_not_found(self, factory, project_creator):
        request = factory.post(
            '/api/v1/project/p1/api-tokens/',
            data={'app_name': 'app1', 'permission': 'r'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokensView.as_view()(request, project_uuid='p1')

        assert resp.status_code == 404

    def test_post_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/api-tokens/",
            data={'app_name': 'app1', 'permission': 'r'},
            format='json',
        )
        request.user = auth_user

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 403

    def test_post_exists_returns_400(self, factory, project_creator, real_project):
        project = real_project
        ProjectAPIToken.objects.add(project, 'app1', project_creator.username, 'r')

        request = factory.post(
            f"/api/v1/project/{project.uuid}/api-tokens/",
            data={'app_name': 'app1', 'permission': 'r'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 400

    def test_post_success(self, factory, project_creator, real_project):
        project = real_project
        request = factory.post(
            f"/api/v1/project/{project.uuid}/api-tokens/",
            data={'app_name': 'app1', 'permission': 'r'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokensView.as_view()(request, project_uuid=str(project.uuid))

        assert resp.status_code == 201
        assert resp.data['app_name'] == 'app1'
        assert resp.data['permission'] == 'r'


class TestProjectAPITokenView:

    def test_delete_non_org_context_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/project/{project.uuid}/api-tokens/1/")
        request.user = no_org_user

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id='1')

        assert resp.status_code == 403

    def test_delete_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/project/{project.uuid}/api-tokens/1/")
        request.user = auth_user

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id='1')

        assert resp.status_code == 403

    def test_delete_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.delete(f"/api/v1/project/{project.uuid}/api-tokens/1/")
        request.user = project_creator

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id='1')

        assert resp.status_code == 404

    def test_delete_success(self, factory, project_creator, real_project):
        project = real_project
        token = ProjectAPIToken.objects.add(project, 'app1', project_creator.username, 'r')

        request = factory.delete(f"/api/v1/project/{project.uuid}/api-tokens/{token.id}/")
        request.user = project_creator

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id=str(token.id))

        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert ProjectAPIToken.objects.filter(id=token.id).count() == 0

    def test_put_non_org_context_returns_403(self, factory, no_org_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/api-tokens/1/",
            data={'permission': 'r'},
            format='json',
        )
        request.user = no_org_user

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id='1')

        assert resp.status_code == 403

    def test_put_invalid_permission(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/api-tokens/1/",
            data={'permission': 'bad'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id='1')

        assert resp.status_code == 400

    def test_put_permission_denied(self, factory, auth_user, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/api-tokens/1/",
            data={'permission': 'r'},
            format='json',
        )
        request.user = auth_user

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id='1')

        assert resp.status_code == 403

    def test_put_not_found(self, factory, project_creator, real_project):
        project = real_project
        request = factory.put(
            f"/api/v1/project/{project.uuid}/api-tokens/1/",
            data={'permission': 'r'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id='1')

        assert resp.status_code == 404

    def test_put_same_permission_returns_400(self, factory, project_creator, real_project):
        project = real_project
        token = ProjectAPIToken.objects.add(project, 'app1', project_creator.username, 'r')

        request = factory.put(
            f"/api/v1/project/{project.uuid}/api-tokens/{token.id}/",
            data={'permission': 'r'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id=str(token.id))

        assert resp.status_code == 400

    def test_put_success(self, factory, project_creator, real_project):
        project = real_project
        token = ProjectAPIToken.objects.add(project, 'app1', project_creator.username, 'r')

        request = factory.put(
            f"/api/v1/project/{project.uuid}/api-tokens/{token.id}/",
            data={'permission': 'rw'},
            format='json',
        )
        request.user = project_creator

        resp = ProjectAPITokenView.as_view()(request, project_uuid=str(project.uuid), token_id=str(token.id))

        assert resp.status_code == 200
        assert resp.data['permission'] == 'rw'

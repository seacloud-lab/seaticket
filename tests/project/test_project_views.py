import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.http import HttpResponse

from seahub.project.files import GetProjectUploadFileView
from seahub.project.views import project_view
from seahub.organizations.models import OrgGroup
from seahub.group.models import GroupUser
from seahub.project.models import Projects, Workspaces


@pytest.mark.django_db
def test_portal_settings_page_denies_non_project_admin(factory, auth_user, real_project):
    project = real_project
    request = factory.get(
        f'/workspace/{project.workspace_id}/project/{project.name}/portal-settings/'
    )
    request.user = auth_user
    request.resolver_match = SimpleNamespace(url_name='project_portal_settings_view')

    with patch('seahub.project.views.check_project_admin_permission', return_value=False), \
            patch('seahub.project.views.check_project_permission', return_value='r'), \
            patch('seahub.project.views.render', return_value=HttpResponse(status=403)) as render_mock:
        response = project_view(
            request,
            workspace_id=project.workspace_id,
            project_name=project.name,
        )

    assert response.status_code == 403
    assert render_mock.call_args.kwargs['status'] == 403


@pytest.mark.django_db
def test_project_page_hides_private_settings_from_group_members(factory, project_creator):
    group_owner = f'owner-{project_creator.username}'
    group = OrgGroup.objects.create_org_group(1, f'group-{project_creator.username}', group_owner)
    GroupUser.objects.group_add_member(group.group_id, project_creator.username)
    workspace = Workspaces.objects.create(owner=f'{group.group_id}@seafile_group', org_id=1)
    project = Projects.objects.create_project(group_owner, workspace, 'private-settings')
    project.settings = json.dumps({
        'prompt': 'private prompt',
        'portal': {'enable_portal': True, 'password': 'encrypted-password', 'chat_prompt': 'private portal prompt'},
        'agent': {'enabled': True, 'ticket_rules': 'private rules', 'auto_confirm': {'send_email': True}},
    })
    project.save(update_fields=['settings'])
    request = factory.get(f'/workspace/{workspace.id}/project/{project.name}/')
    request.user = project_creator
    request.resolver_match = SimpleNamespace(url_name='project_view')

    with patch('seahub.project.views.render', return_value=HttpResponse()) as render_mock:
        response = project_view(request, workspace_id=workspace.id, project_name=project.name)

    assert response.status_code == 200
    settings_data = json.loads(render_mock.call_args.args[2]['settings'])
    assert settings_data == {'portal': {'enable_portal': True}, 'agent': {'enabled': True}}


@pytest.mark.django_db
def test_project_page_handles_missing_portal_settings(factory, project_creator, real_project):
    real_project.settings = json.dumps({'agent': {'enabled': True}})
    real_project.save(update_fields=['settings'])
    request = factory.get(f'/workspace/{real_project.workspace_id}/project/{real_project.name}/')
    request.user = project_creator
    request.resolver_match = SimpleNamespace(url_name='project_view')

    with patch('seahub.project.views.check_project_admin_permission', return_value=False), \
            patch('seahub.project.views.check_project_permission', return_value='r'), \
            patch('seahub.project.views.render', return_value=HttpResponse()) as render_mock:
        response = project_view(
            request,
            workspace_id=real_project.workspace_id,
            project_name=real_project.name,
        )

    assert response.status_code == 200
    settings_data = json.loads(render_mock.call_args.args[2]['settings'])
    assert settings_data == {'portal': {'enable_portal': False}, 'agent': {'enabled': True}}


@pytest.mark.django_db
def test_project_upload_read_returns_404_for_invalid_path(factory, project_creator, real_project):
    request = factory.get('/upload-file/project/%s/2026-11//missing.txt' % real_project.uuid)
    request.user = project_creator

    with patch('seahub.project.files.check_project_permission', return_value=True):
        response = GetProjectUploadFileView.as_view()(
            request,
            project_uuid=str(real_project.uuid),
            file_path='2026-11//missing.txt',
        )

    assert response.status_code == 404

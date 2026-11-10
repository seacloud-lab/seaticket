from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.http import HttpResponse

from seahub.project.files import GetProjectUploadFileView
from seahub.project.views import project_view


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

from unittest.mock import patch
from uuid import uuid4

import pytest
from django.contrib.auth.models import AnonymousUser

from seahub.portal.apis import PortalExternalUsersView
from seahub.portal.models import ProjectExternalUser
from seahub.portal.permissions import get_request_external_user


@pytest.fixture
def external_user(real_project):
    return ProjectExternalUser.objects.create(
        project_uuid=str(real_project.uuid),
        email='member@example.com',
        username='external-member',
        name='Original name',
        activated=True,
    )


@pytest.mark.django_db
class TestUpdatePortalExternalUser:

    @pytest.mark.parametrize('activated', [True, False])
    def test_update_name_and_status(self, factory, project_creator, real_project, external_user, activated):
        other_user = ProjectExternalUser.objects.create(
            project_uuid=str(uuid4()),
            email=external_user.email,
            username='another-project-member',
            name='Another project',
            activated=True,
        )
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': ' Member@Example.com ', 'name': ' Updated name ', 'activated': activated},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        external_user.refresh_from_db()
        assert external_user.name == 'Updated name'
        assert external_user.activated is activated
        assert external_user.email == 'member@example.com'
        assert external_user.username == 'external-member'
        other_user.refresh_from_db()
        assert other_user.name == 'Another project'
        assert other_user.activated is True

        session_request = factory.get('/')
        session_request.session.update({
            'portal_external_username': external_user.username,
            'portal_external_project_uuid': str(real_project.uuid),
        })
        assert bool(get_request_external_user(session_request, str(real_project.uuid))) is activated

    @pytest.mark.parametrize('data, expected_name, expected_status', [
        ({'name': 'Renamed'}, 'Renamed', True),
        ({'activated': False}, 'Original name', False),
    ])
    def test_update_preserves_omitted_fields(
            self, factory, project_creator, real_project, external_user, data, expected_name, expected_status):
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': external_user.email, **data},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        external_user.refresh_from_db()
        assert external_user.name == expected_name
        assert external_user.activated is expected_status

    @pytest.mark.parametrize('invalid_data', [
        {'email': None},
        {'email': 123},
        {'email': 'invalid'},
        {'name': None},
        {'name': 123},
        {'name': ''},
        {'name': '   '},
        {'name': 'x' * 256},
        {'activated': None},
        {'activated': 'false'},
        {'activated': 0},
    ])
    def test_invalid_fields_do_not_update_user(
            self, factory, project_creator, real_project, external_user, invalid_data):
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': external_user.email, 'name': 'Changed', 'activated': False, **invalid_data},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 400
        external_user.refresh_from_db()
        assert external_user.name == 'Original name'
        assert external_user.activated is True

    @pytest.mark.parametrize('user_fixture', ['auth_user', 'no_org_user', None])
    def test_update_requires_project_admin(
            self, factory, real_project, external_user, user_fixture, request):
        api_request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': external_user.email, 'name': 'Changed', 'activated': False},
            format='json',
        )
        api_request.user = request.getfixturevalue(user_fixture) if user_fixture else AnonymousUser()

        response = PortalExternalUsersView.as_view()(api_request, project_uuid=str(real_project.uuid))

        assert response.status_code == 403
        external_user.refresh_from_db()
        assert external_user.name == 'Original name'
        assert external_user.activated is True

    def test_user_in_another_project_is_not_found(self, factory, project_creator, real_project):
        ProjectExternalUser.objects.create(
            project_uuid=str(uuid4()),
            email='other@example.com',
            username='other-project-member',
            name='Other member',
        )
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': 'other@example.com', 'name': 'Changed', 'activated': True},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 404

    def test_project_not_found(self, factory, project_creator):
        project_uuid = str(uuid4())
        request = factory.put(
            f'/api/v1/portal/{project_uuid}/external-users/',
            data={'email': 'member@example.com', 'name': 'Changed', 'activated': True},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 404

    def test_save_failure_returns_server_error(self, factory, project_creator, real_project, external_user):
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': external_user.email, 'name': 'Changed', 'activated': False},
            format='json',
        )
        request.user = project_creator

        with patch.object(ProjectExternalUser, 'save', side_effect=Exception('save failed')):
            response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 500
        external_user.refresh_from_db()
        assert external_user.name == 'Original name'
        assert external_user.activated is True

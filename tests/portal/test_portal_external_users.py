from unittest.mock import patch
from uuid import uuid4

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.http import HttpResponse

from seahub.portal.apis import PortalExternalInvitationsView, PortalExternalLoginSendCodeView, \
    PortalExternalLoginVerifyCodeView, PortalExternalUsersView
from seahub.portal.chat.utils import get_portal_external_username
from seahub.portal.models import PortalCustomer, PortalExternalInvitation, ProjectExternalUser
from seahub.portal.permissions import get_request_external_user
from seahub.portal.utils import clear_portal_external_login_state, get_portal_external_login_code_key
from seahub.portal.views import _get_external_session_user, portal_external_invitation_accept_view


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
    @pytest.mark.parametrize('is_disabled', [True, False])
    def test_update_name_and_disablement(
            self, factory, project_creator, real_project, external_user, activated, is_disabled):
        external_user.activated = activated
        external_user.save(update_fields=['activated'])
        other_user = ProjectExternalUser.objects.create(
            project_uuid=str(uuid4()),
            email=external_user.email,
            username='another-project-member',
            name='Another project',
            activated=True,
        )
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': ' Member@Example.com ', 'name': ' Updated name ', 'is_disabled': is_disabled},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        external_user.refresh_from_db()
        assert external_user.name == 'Updated name'
        assert external_user.activated is activated
        assert external_user.is_disabled is is_disabled
        assert external_user.email == 'member@example.com'
        assert external_user.username == 'external-member'
        other_user.refresh_from_db()
        assert other_user.name == 'Another project'
        assert other_user.activated is True
        assert other_user.is_disabled is False

        session_request = factory.get('/')
        session_request.session.update({
            'portal_external_username': external_user.username,
            'portal_external_project_uuid': str(real_project.uuid),
        })
        assert bool(get_request_external_user(session_request, str(real_project.uuid))) is (activated and not is_disabled)

    @pytest.mark.parametrize('data, expected_name, expected_status', [
        ({'name': 'Renamed'}, 'Renamed', False),
        ({'is_disabled': True}, 'Original name', True),
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
        assert external_user.is_disabled is expected_status
        assert external_user.activated is True

    @pytest.mark.parametrize('invalid_data', [
        {'email': None},
        {'email': 123},
        {'email': 'invalid'},
        {'name': None},
        {'name': 123},
        {'name': ''},
        {'name': '   '},
        {'name': 'x' * 256},
        {'is_disabled': None},
        {'is_disabled': 'false'},
        {'is_disabled': 0},
        {'activated': True},
        {'activated': False},
        {'status': 'active'},
    ])
    def test_invalid_fields_do_not_update_user(
            self, factory, project_creator, real_project, external_user, invalid_data):
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': external_user.email, 'name': 'Changed', 'is_disabled': True, **invalid_data},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 400
        external_user.refresh_from_db()
        assert external_user.name == 'Original name'
        assert external_user.activated is True
        assert external_user.is_disabled is False

    @pytest.mark.parametrize('user_fixture', ['auth_user', 'no_org_user', None])
    def test_update_requires_project_admin(
            self, factory, real_project, external_user, user_fixture, request):
        api_request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': external_user.email, 'name': 'Changed', 'is_disabled': True},
            format='json',
        )
        api_request.user = request.getfixturevalue(user_fixture) if user_fixture else AnonymousUser()

        response = PortalExternalUsersView.as_view()(api_request, project_uuid=str(real_project.uuid))

        assert response.status_code == 403
        external_user.refresh_from_db()
        assert external_user.name == 'Original name'
        assert external_user.activated is True

    @pytest.mark.parametrize('name', [None, 123, '   ', 'x' * 256])
    def test_invalid_name_is_rejected_before_transaction(
            self, factory, project_creator, real_project, external_user, name):
        request = factory.put(
            '/', data={'email': external_user.email, 'name': name}, format='json',
        )
        request.user = project_creator

        with patch('seahub.portal.apis.transaction.atomic') as atomic:
            response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 400
        assert response.data['error_msg'] == 'name invalid.'
        atomic.assert_not_called()

    def test_user_in_another_project_is_not_found(self, factory, project_creator, real_project):
        ProjectExternalUser.objects.create(
            project_uuid=str(uuid4()),
            email='other@example.com',
            username='other-project-member',
            name='Other member',
        )
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': 'other@example.com', 'name': 'Changed', 'is_disabled': True},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 404

    def test_project_not_found(self, factory, project_creator):
        project_uuid = str(uuid4())
        request = factory.put(
            f'/api/v1/portal/{project_uuid}/external-users/',
            data={'email': 'member@example.com', 'name': 'Changed', 'is_disabled': True},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 404

    def test_save_failure_returns_server_error(self, factory, project_creator, real_project, external_user):
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': external_user.email, 'name': 'Changed', 'is_disabled': True},
            format='json',
        )
        request.user = project_creator

        with patch.object(ProjectExternalUser, 'save', side_effect=Exception('save failed')):
            response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 500
        external_user.refresh_from_db()
        assert external_user.name == 'Original name'
        assert external_user.activated is True
        assert external_user.is_disabled is False

    @pytest.mark.parametrize('activated', [True, False])
    def test_enabling_preserves_activation(self, factory, project_creator, real_project, external_user, activated):
        external_user.activated = activated
        external_user.is_disabled = True
        external_user.save(update_fields=['activated', 'is_disabled'])
        request = factory.put(
            '/',
            data={'email': external_user.email, 'is_disabled': False},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        external_user.refresh_from_db()
        assert external_user.activated is activated
        assert external_user.is_disabled is False

    def test_name_only_edit_preserves_disablement(self, factory, project_creator, real_project, external_user):
        external_user.is_disabled = True
        external_user.save(update_fields=['is_disabled'])
        request = factory.put('/', data={'email': external_user.email, 'name': 'Renamed'}, format='json')
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        external_user.refresh_from_db()
        assert external_user.name == 'Renamed'
        assert external_user.is_disabled is True
        assert external_user.activated is True


@pytest.fixture
def login_code(real_project, external_user):
    project_uuid = str(real_project.uuid)
    key = get_portal_external_login_code_key(project_uuid, external_user.email)
    cache.set(key, make_password('123456'), 300)
    yield key
    clear_portal_external_login_state(project_uuid, external_user.email)


@pytest.mark.django_db
class TestPortalDisabledUserAccess:

    def test_disabling_clears_existing_login_code(
            self, factory, project_creator, real_project, external_user, login_code):
        request = factory.put('/', data={'email': external_user.email, 'is_disabled': True}, format='json')
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert cache.get(login_code) is None

    def test_disabled_user_does_not_receive_login_code(self, factory, real_project, external_user):
        external_user.is_disabled = True
        external_user.save(update_fields=['is_disabled'])
        request = factory.post('/', data={'email': external_user.email}, format='json')

        with patch('seahub.portal.apis.is_user_in_the_same_team', return_value=False), \
                patch('seahub.portal.apis.send_html_email_with_dj_template') as send_mail:
            response = PortalExternalLoginSendCodeView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert response.data['success'] is True
        send_mail.assert_not_called()

    @pytest.mark.parametrize('activated', [True, False])
    def test_disabled_user_cannot_verify_valid_code(
            self, factory, real_project, external_user, login_code, activated):
        external_user.activated = activated
        external_user.is_disabled = True
        external_user.save(update_fields=['activated', 'is_disabled'])
        request = factory.post('/', data={'email': external_user.email, 'code': '123456'}, format='json')

        response = PortalExternalLoginVerifyCodeView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 403
        assert response.data['error_msg'] == 'External user is disabled.'
        assert 'portal_external_username' not in request.session
        external_user.refresh_from_db()
        assert external_user.activated is activated
        assert external_user.is_disabled is True

    def test_disabled_user_with_invalid_code_gets_code_error(
            self, factory, real_project, external_user, login_code):
        external_user.is_disabled = True
        external_user.save(update_fields=['is_disabled'])
        request = factory.post('/', data={'email': external_user.email, 'code': '654321'}, format='json')

        response = PortalExternalLoginVerifyCodeView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 400
        assert response.data['error_msg'] == 'code invalid.'
        assert 'portal_external_username' not in request.session

    @pytest.mark.parametrize('activated', [True, False])
    def test_enabled_user_can_login_and_activate(
            self, factory, real_project, external_user, login_code, activated):
        external_user.activated = activated
        external_user.save(update_fields=['activated'])
        request = factory.post('/', data={'email': external_user.email, 'code': '123456'}, format='json')

        response = PortalExternalLoginVerifyCodeView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert request.session['portal_external_username'] == external_user.username
        external_user.refresh_from_db()
        assert external_user.activated is True
        assert external_user.is_disabled is False

    @pytest.mark.parametrize('activated', [True, False])
    def test_old_invitation_does_not_enable_disabled_user(
            self, factory, project_creator, real_project, external_user, activated):
        project_uuid = str(real_project.uuid)
        customer = PortalCustomer.objects.create(project_uuid=project_uuid, name='Acme')
        invitation = PortalExternalInvitation.objects.add(
            inviter=project_creator.username, email=external_user.email,
            project_uuid=project_uuid, customer_id=customer.id,
        )
        external_user.activated = activated
        external_user.is_disabled = True
        external_user.save(update_fields=['activated', 'is_disabled'])
        request = factory.get('/')

        with patch('seahub.portal.views.render_error', return_value=HttpResponse(status=400)):
            response = portal_external_invitation_accept_view(request, invitation.token, project_uuid)

        assert response.status_code == 400
        assert 'portal_external_username' not in request.session
        external_user.refresh_from_db()
        invitation.refresh_from_db()
        assert external_user.activated is activated
        assert external_user.is_disabled is True
        assert external_user.customer_id is None
        assert invitation.accepted_at is None

    @patch('seahub.portal.apis.IS_EMAIL_CONFIGURED', True)
    def test_disabled_user_cannot_be_reinvited(self, factory, project_creator, real_project, external_user):
        external_user.is_disabled = True
        external_user.save(update_fields=['is_disabled'])
        request = factory.post('/', data={'email': external_user.email, 'name': 'Renamed'}, format='json')
        request.user = project_creator

        response = PortalExternalInvitationsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 409
        assert not PortalExternalInvitation.objects.filter(email=external_user.email).exists()
        external_user.refresh_from_db()
        assert external_user.is_disabled is True
        assert external_user.name == 'Original name'

    def test_missing_mail_configuration_is_rejected_before_transaction(
            self, factory, project_creator, real_project, external_user):
        request = factory.post('/', data={'email': external_user.email, 'name': 'Renamed'}, format='json')
        request.user = project_creator

        with patch('seahub.portal.apis.IS_EMAIL_CONFIGURED', False), \
                patch('seahub.portal.apis.transaction.atomic') as atomic:
            response = PortalExternalInvitationsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 503
        atomic.assert_not_called()
        assert not PortalExternalInvitation.objects.filter(email=external_user.email).exists()

    def test_existing_session_loses_external_identity(self, factory, real_project, external_user):
        project_uuid = str(real_project.uuid)
        external_user.is_disabled = True
        external_user.save(update_fields=['is_disabled'])
        request = factory.get('/')
        request.session.update({
            'portal_external_username': external_user.username,
            'portal_external_project_uuid': project_uuid,
        })

        assert get_request_external_user(request, project_uuid) is None
        assert get_portal_external_username(request, project_uuid) == ''
        assert _get_external_session_user(request, project_uuid)[1] is False

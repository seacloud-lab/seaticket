import time
import json
from uuid import uuid4

import jwt
import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, override_settings

from seahub.portal.apis import (
    PortalExternalSSOProviderResetSecretView,
    PortalExternalSSOProviderView,
    PortalExternalSSOProvidersView,
)
from seahub.portal.models import PortalExternalSSOProvider, ProjectExternalUser
from seahub.portal.views import portal_external_sso_login_view
from seahub.project.models import Projects, Workspaces


def build_sso_request(path):
    request = RequestFactory().get(path)
    SessionMiddleware(lambda _request: None).process_request(request)
    request.session.save()
    request.user = AnonymousUser()
    return request


def build_sso_token(provider_id, secret, **overrides):
    payload = {
        'iss': provider_id,
        'email': 'external@example.com',
        'iat': int(time.time()),
        'exp': int(time.time()) + 60,
    }
    payload.update(overrides)
    return jwt.encode(payload, secret, algorithm='HS256')


def create_portal_project():
    owner = f'owner_{uuid4().hex[:6]}@example.com'
    workspace = Workspaces.objects.create(owner=owner, org_id=1)
    project = Projects.objects.create_project(
        username=owner,
        workspace=workspace,
        name=f'proj-{uuid4().hex[:6]}',
    )
    project.settings = json.dumps({'portal': {'enable_portal': True}})
    project.save(update_fields=['settings'])
    return project


@pytest.mark.django_db
@override_settings(PORTAL_SERVICE_ROOT_DOMAIN='seaticket-portal.test')
class TestPortalExternalSSOProvidersView:

    def test_create_returns_secret_once_and_list_hides_secret(self, factory, project_creator, real_project):
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/',
            data={
                'provider_id': ' Customer ',
                'name': 'Customer system',
                'secret': 's' * 32,
            },
            format='json',
        )
        request.user = project_creator

        response = PortalExternalSSOProvidersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 201
        assert response.data['provider_id'] == 'customer'
        assert response.data['secret'] == 's' * 32
        assert response.data['login_url'].endswith('/external/sso/customer/')

        provider = PortalExternalSSOProvider.objects.get(project_uuid=str(real_project.uuid), provider_id='customer')
        assert provider.secret != 's' * 32
        assert provider.get_secret() == 's' * 32

        request = factory.get(f'/api/v1/portal/{real_project.uuid}/external-sso-providers/')
        request.user = project_creator
        response = PortalExternalSSOProvidersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert response.data['providers'][0]['provider_id'] == 'customer'
        assert 'secret' not in response.data['providers'][0]

    @pytest.mark.parametrize('secret', ['s' * 31, 's' * 129, '\u5bc6' * 32])
    def test_create_rejects_invalid_secret(self, factory, project_creator, real_project, secret):
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/',
            data={
                'provider_id': 'customer',
                'name': 'Customer system',
                'secret': secret,
            },
            format='json',
        )
        request.user = project_creator

        response = PortalExternalSSOProvidersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 400
        assert not PortalExternalSSOProvider.objects.filter(project_uuid=str(real_project.uuid)).exists()

    def test_create_rejects_invalid_provider_id(self, factory, project_creator, real_project):
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/',
            data={
                'provider_id': 'customer/system',
                'name': 'Customer system',
            },
            format='json',
        )
        request.user = project_creator

        response = PortalExternalSSOProvidersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 400
        assert not PortalExternalSSOProvider.objects.filter(project_uuid=str(real_project.uuid)).exists()

    def test_reset_rejects_invalid_secret(self, factory, project_creator, real_project):
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
        )
        provider.reset_secret('p' * 32)
        provider.save()
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/plus/reset-secret/',
            data={'secret': 's' * 129},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalSSOProviderResetSecretView.as_view()(
            request, project_uuid=str(real_project.uuid), provider_id='plus'
        )

        assert response.status_code == 400
        provider.refresh_from_db()
        assert provider.get_secret() == 'p' * 32

    def test_update_toggle_reset_and_delete(self, factory, project_creator, real_project):
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret('p' * 32)
        provider.save()

        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/plus/',
            data={'enabled': 0},
            format='json',
        )
        request.user = project_creator
        response = PortalExternalSSOProviderView.as_view()(request, project_uuid=str(real_project.uuid), provider_id='plus')
        assert response.status_code == 200
        assert response.data['enabled'] is False

        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/plus/reset-secret/',
            data={},
            format='json',
        )
        request.user = project_creator
        response = PortalExternalSSOProviderResetSecretView.as_view()(request, project_uuid=str(real_project.uuid), provider_id='plus')
        assert response.status_code == 200
        assert len(response.data['secret']) == 64
        provider.refresh_from_db()
        assert provider.get_secret() == response.data['secret']

        request = factory.delete(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/plus/',
        )
        request.user = project_creator
        response = PortalExternalSSOProviderView.as_view()(request, project_uuid=str(real_project.uuid), provider_id='plus')
        assert response.status_code == 200
        assert not PortalExternalSSOProvider.objects.filter(pk=provider.pk).exists()


@pytest.mark.django_db
class TestPortalExternalSSOLoginView:

    def test_login_creates_external_user_and_session(self, real_project):
        secret = 'x' * 32
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        token = build_sso_token('plus', secret)
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 302
        assert response['Location'] == f'/portal/{real_project.uuid}/'
        assert response['Cache-Control'] == 'no-store'
        assert response['Referrer-Policy'] == 'no-referrer'
        ext_user = ProjectExternalUser.objects.get(
            project_uuid=str(real_project.uuid),
            email='external@example.com',
        )
        assert ext_user.activated is True
        assert request.session['portal_external_username'] == ext_user.username
        assert request.session['portal_external_project_uuid'] == str(real_project.uuid)

    def test_login_reuses_existing_external_user(self, real_project):
        ext_user = ProjectExternalUser.objects.create(
            project_uuid=str(real_project.uuid),
            email='external@example.com',
            username='existing-external-user',
            activated=True,
        )
        secret = 'x' * 32
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        token = build_sso_token('plus', secret, sub='third-party-user-1')
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 302
        assert ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid), email=ext_user.email).count() == 1
        assert request.session['portal_external_username'] == ext_user.username

    def test_login_rejects_expired_token(self, real_project):
        secret = 'x' * 32
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        token = build_sso_token('plus', secret, exp=int(time.time()) - 1)
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 200
        assert response['Cache-Control'] == 'no-store'
        assert response['Referrer-Policy'] == 'no-referrer'
        assert not ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid)).exists()

    def test_login_rejects_token_lifetime_over_300_seconds(self, real_project):
        secret = 'x' * 32
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        now = int(time.time())
        token = build_sso_token('plus', secret, iat=now, exp=now + 301)
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 200
        assert not ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid)).exists()

    def test_same_provider_id_in_different_projects_uses_independent_secret(self, real_project):
        other_project = create_portal_project()
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret('a' * 32)
        provider.save()
        other_provider = PortalExternalSSOProvider(
            project_uuid=str(other_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=True,
        )
        other_provider.reset_secret('b' * 32)
        other_provider.save()
        token = build_sso_token('plus', 'a' * 32)
        request = build_sso_request(f'/portal-external/sso/plus/{other_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(other_project.uuid))

        assert response.status_code == 200
        assert not ProjectExternalUser.objects.filter(project_uuid=str(other_project.uuid)).exists()

    def test_login_rejects_disabled_provider(self, real_project):
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_id='plus',
            name='Plus',
            enabled=False,
        )
        provider.reset_secret('x' * 32)
        provider.save()
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token=invalid')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 200
        assert not ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid)).exists()

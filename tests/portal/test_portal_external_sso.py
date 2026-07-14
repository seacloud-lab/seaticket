import time

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


def build_sso_request(path):
    request = RequestFactory().get(path)
    SessionMiddleware(lambda _request: None).process_request(request)
    request.session.save()
    request.user = AnonymousUser()
    return request


def build_sso_token(project_uuid, provider_key, secret, **overrides):
    payload = {
        'iss': provider_key,
        'sub': 'third-party-user-1',
        'email': 'external@example.com',
        'aud': str(project_uuid),
        'iat': int(time.time()),
        'exp': int(time.time()) + 60,
    }
    payload.update(overrides)
    return jwt.encode(payload, secret, algorithm='HS256')


@pytest.mark.django_db
@override_settings(PORTAL_SERVICE_ROOT_DOMAIN='seaticket-portal.test')
class TestPortalExternalSSOProvidersView:

    def test_create_returns_secret_once_and_list_hides_secret(self, factory, project_creator, real_project):
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/',
            data={
                'provider_key': 'customer',
                'name': 'Customer system',
                'secret': 's' * 32,
            },
            format='json',
        )
        request.user = project_creator

        response = PortalExternalSSOProvidersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 201
        assert response.data['provider_key'] == 'customer'
        assert response.data['secret'] == 's' * 32
        assert response.data['login_url'].endswith('/external/sso/customer/')

        provider = PortalExternalSSOProvider.objects.get(project_uuid=str(real_project.uuid), provider_key='customer')
        assert provider.secret != 's' * 32
        assert provider.get_secret() == 's' * 32

        request = factory.get(f'/api/v1/portal/{real_project.uuid}/external-sso-providers/')
        request.user = project_creator
        response = PortalExternalSSOProvidersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert response.data['providers'][0]['provider_key'] == 'customer'
        assert 'secret' not in response.data['providers'][0]

    def test_update_toggle_reset_and_delete(self, factory, project_creator, real_project):
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_key='plus',
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
        response = PortalExternalSSOProviderView.as_view()(request, project_uuid=str(real_project.uuid), provider_key='plus')
        assert response.status_code == 200
        assert response.data['enabled'] is False

        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/plus/reset-secret/',
            data={},
            format='json',
        )
        request.user = project_creator
        response = PortalExternalSSOProviderResetSecretView.as_view()(request, project_uuid=str(real_project.uuid), provider_key='plus')
        assert response.status_code == 200
        assert len(response.data['secret']) == 64
        provider.refresh_from_db()
        assert provider.get_secret() == response.data['secret']

        request = factory.delete(
            f'/api/v1/portal/{real_project.uuid}/external-sso-providers/plus/',
        )
        request.user = project_creator
        response = PortalExternalSSOProviderView.as_view()(request, project_uuid=str(real_project.uuid), provider_key='plus')
        assert response.status_code == 200
        assert not PortalExternalSSOProvider.objects.filter(pk=provider.pk).exists()


@pytest.mark.django_db
class TestPortalExternalSSOLoginView:

    def test_login_creates_external_user_and_session(self, real_project):
        secret = 'x' * 32
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_key='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        token = build_sso_token(real_project.uuid, 'plus', secret)
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 302
        assert response['Location'] == f'/portal/{real_project.uuid}/'
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
            provider_key='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        token = build_sso_token(real_project.uuid, 'plus', secret)
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 302
        assert ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid), email=ext_user.email).count() == 1
        assert request.session['portal_external_username'] == ext_user.username

    def test_login_rejects_expired_token(self, real_project):
        secret = 'x' * 32
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_key='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        token = build_sso_token(real_project.uuid, 'plus', secret, exp=int(time.time()) - 1)
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 200
        assert not ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid)).exists()

    def test_login_rejects_wrong_audience(self, real_project):
        secret = 'x' * 32
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_key='plus',
            name='Plus',
            enabled=True,
        )
        provider.reset_secret(secret)
        provider.save()
        token = build_sso_token(real_project.uuid, 'plus', secret, aud='another-project')
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token={token}')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 200
        assert not ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid)).exists()

    def test_login_rejects_disabled_provider(self, real_project):
        provider = PortalExternalSSOProvider(
            project_uuid=str(real_project.uuid),
            provider_key='plus',
            name='Plus',
            enabled=False,
        )
        provider.reset_secret('x' * 32)
        provider.save()
        request = build_sso_request(f'/portal-external/sso/plus/{real_project.uuid}/?token=invalid')

        response = portal_external_sso_login_view(request, 'plus', str(real_project.uuid))

        assert response.status_code == 200
        assert not ProjectExternalUser.objects.filter(project_uuid=str(real_project.uuid)).exists()

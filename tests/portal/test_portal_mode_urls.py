from uuid import uuid4

import pytest
from django.urls import Resolver404, resolve

from seahub.portal.apis import PortalExternalLoginSendCodeView, PortalExternalLoginVerifyCodeView

PORTAL_URLCONF = 'seahub.portal_site_urls'
PORTAL_DOMAIN_MIDDLEWARE = 'seahub.portal.middleware.PortalDomainMiddleware'
PORTAL_HOST_MIDDLEWARE = 'seahub.portal.host_middleware.PortalHostValidationMiddleware'
CSRF_MIDDLEWARE = 'django.middleware.csrf.CsrfViewMiddleware'


def test_portal_domain_middleware_matches_runtime_mode(settings):
    assert (PORTAL_DOMAIN_MIDDLEWARE in settings.MIDDLEWARE) is bool(settings.IS_PORTAL_MODE)
    assert (PORTAL_HOST_MIDDLEWARE in settings.MIDDLEWARE) is bool(settings.IS_PORTAL_MODE)
    if settings.IS_PORTAL_MODE:
        assert settings.MIDDLEWARE[0] == PORTAL_HOST_MIDDLEWARE
    assert CSRF_MIDDLEWARE in settings.MIDDLEWARE


def test_portal_mode_resolves_public_portal_routes():
    project_uuid = str(uuid4())

    assert resolve(f'/portal/{project_uuid}/', urlconf=PORTAL_URLCONF).url_name == 'portal_view'
    assert resolve(f'/api/v1/portal/{project_uuid}/issues/', urlconf=PORTAL_URLCONF).url_name == 'api-v1-portal-issues'
    assert resolve(f'/file/portal-chat-image/{project_uuid}/', urlconf=PORTAL_URLCONF).url_name == 'api-v1-portal-chat-image'
    assert resolve('/internal/portal/custom-domain/allow-tls', urlconf=PORTAL_URLCONF).url_name == 'internal-portal-custom-domain-allow-tls'


@pytest.mark.parametrize('urlconf', ['seahub.urls', PORTAL_URLCONF])
@pytest.mark.parametrize('endpoint,view', [
    ('send-code', PortalExternalLoginSendCodeView),
    ('verify', PortalExternalLoginVerifyCodeView),
])
def test_external_login_routes_are_available_in_both_modes(urlconf, endpoint, view):
    project_uuid = str(uuid4())
    match = resolve('/api/v1/portal/%s/external-login/%s/' % (project_uuid, endpoint), urlconf=urlconf)

    assert match.func.view_class is view
    assert match.kwargs['project_uuid'] == project_uuid


@pytest.mark.parametrize('path', [
    '/sys/info/',
    '/api/v1/admin/users/',
    '/projects/',
    '/portal-edit/11111111-1111-1111-1111-111111111111/',
    '/workspace/1/project/demo/portal-issues/',
    '/api/v1/portal/11111111-1111-1111-1111-111111111111/custom-domain/',
    '/api/v1/portal/11111111-1111-1111-1111-111111111111/domain-alias/',
    '/api/v1/portal/11111111-1111-1111-1111-111111111111/settings/',
])
def test_portal_mode_does_not_resolve_management_routes(path):
    with pytest.raises(Resolver404):
        resolve(path, urlconf=PORTAL_URLCONF)

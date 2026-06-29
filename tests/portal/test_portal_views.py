import json
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.http import Http404, HttpResponse
from django.test import RequestFactory, override_settings

from seahub.portal.middleware import PortalDomainMiddleware
from seahub.portal.models import PORTAL_DOMAIN_CACHE_MISS_VALUE, PortalCustomDomain, PortalDomainAlias, ProjectExternalUser
from seahub.portal.utils import (
    PORTAL_DOMAIN_TYPE_CUSTOM,
    PORTAL_DOMAIN_TYPE_SERVICE_ALIAS,
    resolve_portal_domain,
    set_portal_preview_session,
)
from seahub.portal.views import portal_accounts_login_view, portal_external_logout_view, portal_view


def process_portal_domain_request(request):
    return PortalDomainMiddleware(lambda _request: None).process_request(request)


def build_session_request(path):
    request = RequestFactory().get(path)
    SessionMiddleware(lambda _request: None).process_request(request)
    request.session.save()
    request.is_mobile = False
    request.is_tablet = False
    return request


def enable_portal(project, allow_anonymous=False):
    settings_dict = json.loads(project.settings) if project.settings else {}
    portal = settings_dict.get('portal', {})
    portal['enable_portal'] = True
    portal['allow_anonymous'] = allow_anonymous
    settings_dict['portal'] = portal
    project.settings = json.dumps(settings_dict)
    project.save(update_fields=['settings'])


@pytest.mark.django_db
@override_settings(
    IS_PORTAL_MODE=True,
    ENABLE_SIGNUP=True,
    MULTI_TENANCY=True,
    ENABLE_SAML=True,
    ENABLE_MULTI_SAML=True,
    ROOT_URLCONF='seahub.utils.rooturl',
    SITE_ROOT_URLCONF='seahub.portal_site_urls',
)
def test_portal_accounts_login_hides_main_site_entry_points():
    request = build_session_request('/accounts/login/')
    request.user = AnonymousUser()

    response = portal_accounts_login_view(request)

    assert response.status_code == 200
    assert b'id="sign-up"' not in response.content
    assert b'id="sso"' not in response.content
    assert b'id="multi_saml_sso"' not in response.content


@pytest.mark.django_db
def test_portal_view_treats_cross_org_authenticated_external_user_as_external(factory, real_project):
    ext_username = 'virtual-ext-user'
    ProjectExternalUser.objects.create(
        email='external@example.com',
        username=ext_username,
        project_uuid=str(real_project.uuid),
        activated=True,
    )

    request = factory.get(f'/portal/{real_project.uuid}/')
    request.user = SimpleNamespace(
        username='other-org@example.com',
        is_authenticated=True,
        org=SimpleNamespace(org_id=999),
    )
    request.session['portal_external_username'] = ext_username
    request.session['portal_external_project_uuid'] = str(real_project.uuid)

    captured = {}

    def fake_render(_request, template, context):
        captured['template'] = template
        captured['context'] = context
        return HttpResponse('ok')

    import seahub.portal.views as portal_views

    original_render = portal_views.render
    portal_views.render = fake_render
    try:
        response = portal_view(request, str(real_project.uuid))
    finally:
        portal_views.render = original_render

    assert response.status_code == 200
    assert captured['template'] == 'portal_view_react.html'
    assert captured['context']['is_external_user'] is True
    assert captured['context']['is_anonymous'] is False
    assert captured['context']['username'] == ext_username


@pytest.mark.django_db
def test_portal_external_logout_clears_external_session_for_authenticated_user(factory, real_project):
    ext_username = 'virtual-ext-user'
    ProjectExternalUser.objects.create(
        email='external@example.com',
        username=ext_username,
        project_uuid=str(real_project.uuid),
        activated=True,
    )

    request = factory.get(f'/portal-external/logout/{real_project.uuid}/')
    request.user = SimpleNamespace(
        username='other-org@example.com',
        is_authenticated=True,
        org=SimpleNamespace(org_id=999),
    )
    request.session['portal_external_username'] = ext_username
    request.session['portal_external_project_uuid'] = str(real_project.uuid)

    response = portal_external_logout_view(request, str(real_project.uuid))

    assert response.status_code == 302
    assert response['Location'] == f'/portal/{real_project.uuid}/'
    assert 'portal_external_username' not in request.session
    assert 'portal_external_project_uuid' not in request.session


@pytest.mark.django_db
def test_portal_view_allows_preview_session_when_anonymous_disabled(factory, real_project, project_creator):
    enable_portal(real_project, allow_anonymous=False)
    request = factory.get(f'/portal/{real_project.uuid}/')
    request.session = {}
    request.user = SimpleNamespace(username='', is_authenticated=False)
    set_portal_preview_session(request, str(real_project.uuid), project_creator.username)

    captured = {}

    def fake_render(_request, template, context):
        captured['template'] = template
        captured['context'] = context
        return HttpResponse('ok')

    import seahub.portal.views as portal_views

    original_render = portal_views.render
    portal_views.render = fake_render
    try:
        response = portal_view(request, str(real_project.uuid))
    finally:
        portal_views.render = original_render

    assert response.status_code == 200
    assert captured['template'] == 'portal_view_react.html'
    assert captured['context']['username'] == project_creator.username
    assert captured['context']['is_external_user'] is False
    assert captured['context']['is_anonymous'] is False


@pytest.mark.django_db
def test_portal_view_allows_preview_session_when_password_protected(factory, real_project, project_creator):
    settings_dict = json.loads(real_project.settings) if real_project.settings else {}
    portal = settings_dict.get('portal', {})
    portal['enable_portal'] = True
    portal['allow_anonymous'] = True
    portal['enable_password_protection'] = True
    portal['password'] = 'encoded-password'
    settings_dict['portal'] = portal
    real_project.settings = json.dumps(settings_dict)
    real_project.save(update_fields=['settings'])

    request = factory.get(f'/portal/{real_project.uuid}/')
    request.session = {}
    request.user = SimpleNamespace(username='', is_authenticated=False)
    set_portal_preview_session(request, str(real_project.uuid), project_creator.username)

    captured = {}

    def fake_render(_request, template, context):
        captured['template'] = template
        captured['context'] = context
        return HttpResponse('ok')

    import seahub.portal.views as portal_views

    original_render = portal_views.render
    portal_views.render = fake_render
    try:
        response = portal_view(request, str(real_project.uuid))
    finally:
        portal_views.render = original_render

    assert response.status_code == 200
    assert captured['template'] == 'portal_view_react.html'
    assert captured['context']['username'] == project_creator.username
    assert 'need_password' not in captured['context']


@pytest.mark.django_db
def test_portal_view_sets_portal_domain_context(factory, real_project):
    enable_portal(real_project, allow_anonymous=True)
    request = factory.get(f'/portal/{real_project.uuid}/')
    request.session = {}
    request.user = SimpleNamespace(username='', is_authenticated=False)
    request.portal_domain = SimpleNamespace(
        binding=SimpleNamespace(project_uuid=str(real_project.uuid)),
    )

    captured = {}

    def fake_render(_request, template, context):
        captured['template'] = template
        captured['context'] = context
        return HttpResponse('ok')

    import seahub.portal.views as portal_views

    original_render = portal_views.render
    portal_views.render = fake_render
    try:
        response = portal_view(request, str(real_project.uuid))
    finally:
        portal_views.render = original_render

    assert response.status_code == 200
    assert captured['template'] == 'portal_view_react.html'
    assert captured['context']['is_portal_domain'] is True


@pytest.mark.django_db
def test_custom_domain_mismatched_portal_api_returns_404(factory, real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    other_project_uuid = str(uuid4())
    request = factory.get(
        f'/api/v1/portal/{other_project_uuid}/settings/',
        HTTP_HOST='support.local.test',
    )

    with pytest.raises(Http404):
        process_portal_domain_request(request)


@pytest.mark.django_db
def test_custom_domain_matched_portal_api_is_not_rewritten(factory, real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    path = f'/api/v1/portal/{real_project.uuid}/settings/'
    request = factory.get(path, HTTP_HOST='support.local.test')

    response = process_portal_domain_request(request)

    assert response is None
    assert request.path_info == path
    assert request.portal_domain.domain_type == PORTAL_DOMAIN_TYPE_CUSTOM
    assert not hasattr(request.portal_domain, 'project_uuid')
    assert request.portal_domain.binding.project_uuid == str(real_project.uuid)
    assert request.portal_domain.binding.domain == 'support.local.test'


@pytest.mark.django_db
def test_custom_domain_root_path_rewrites_to_bound_portal(factory, real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    request = factory.get('/', HTTP_HOST='support.local.test')

    response = process_portal_domain_request(request)

    assert response is None
    assert request.path_info == f'/portal/{real_project.uuid}/'
    assert request.portal_domain.domain_type == PORTAL_DOMAIN_TYPE_CUSTOM
    assert not hasattr(request.portal_domain, 'project_uuid')
    assert request.portal_domain.binding.project_uuid == str(real_project.uuid)
    assert request.portal_domain.binding.domain == 'support.local.test'


@pytest.mark.django_db
def test_main_site_host_skips_custom_domain_rewrite(factory, real_project, settings):
    settings.SEATICKET_SERVER_HOSTNAME = 'app.local.test'
    PortalCustomDomain.objects.create(
        domain='app.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    request = factory.get('/', HTTP_HOST='app.local.test')

    response = process_portal_domain_request(request)

    assert response is None
    assert request.path_info == '/'
    assert not hasattr(request, 'portal_domain')


@pytest.mark.django_db
def test_custom_domain_external_accept_path_rewrites_to_bound_invitation(factory, real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    token = 'a' * 32
    request = factory.get(f'/external/accept/{token}/', HTTP_HOST='support.local.test')

    response = process_portal_domain_request(request)

    assert response is None
    assert request.path_info == f'/portal-external/accept/{token}/{real_project.uuid}/'
    assert request.portal_domain.domain_type == PORTAL_DOMAIN_TYPE_CUSTOM
    assert not hasattr(request.portal_domain, 'project_uuid')
    assert request.portal_domain.binding.project_uuid == str(real_project.uuid)
    assert request.portal_domain.binding.domain == 'support.local.test'


@pytest.mark.django_db
def test_service_domain_alias_root_path_rewrites_to_bound_portal(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=str(real_project.uuid),
    )
    request = factory.get('/', HTTP_HOST='my-brand.seaticket-portal.test')

    response = process_portal_domain_request(request)

    assert response is None
    assert request.path_info == f'/portal/{real_project.uuid}/'
    assert request.portal_domain.domain_type == PORTAL_DOMAIN_TYPE_SERVICE_ALIAS
    assert not hasattr(request.portal_domain, 'project_uuid')
    assert request.portal_domain.binding.project_uuid == str(real_project.uuid)


@pytest.mark.django_db
def test_resolve_portal_domain_normalizes_service_alias_host(real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=str(real_project.uuid),
    )

    portal_domain = resolve_portal_domain('My-Brand.Seaticket-Portal.Test:8443')

    assert portal_domain.domain_type == PORTAL_DOMAIN_TYPE_SERVICE_ALIAS
    assert portal_domain.domain == 'my-brand.seaticket-portal.test'
    assert not hasattr(portal_domain, 'project_uuid')
    assert portal_domain.binding.project_uuid == str(real_project.uuid)


@pytest.mark.django_db
def test_resolve_portal_domain_returns_custom_domain_binding_project_uuid(real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )

    portal_domain = resolve_portal_domain('Support.Local.Test:8443')

    assert portal_domain.domain_type == PORTAL_DOMAIN_TYPE_CUSTOM
    assert portal_domain.domain == 'support.local.test'
    assert not hasattr(portal_domain, 'project_uuid')
    assert portal_domain.binding.project_uuid == str(real_project.uuid)


@pytest.mark.django_db
def test_resolve_portal_domain_skips_custom_domain_lookup_for_service_host(settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'

    with patch('seahub.portal.utils.PortalCustomDomain.objects.get_by_domain') as mock_get_by_domain:
        portal_domain = resolve_portal_domain('unknown.seaticket-portal.test')

    assert portal_domain is None
    mock_get_by_domain.assert_not_called()


@pytest.mark.django_db
def test_domain_alias_lookup_caches_missing_prefix_and_invalidates_on_create(real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    prefix = 'missing'
    cache_key = PortalDomainAlias.objects._prefix_cache_key(prefix)
    cache.delete(cache_key)

    assert PortalDomainAlias.objects.get_by_host('missing.seaticket-portal.test') is None
    assert cache.get(cache_key) == PORTAL_DOMAIN_CACHE_MISS_VALUE

    PortalDomainAlias.objects.create(
        prefix=prefix,
        project_uuid=str(real_project.uuid),
    )

    assert cache.get(cache_key) is None
    alias = PortalDomainAlias.objects.get_by_host('missing.seaticket-portal.test')
    assert alias.project_uuid == str(real_project.uuid)


@pytest.mark.django_db
def test_domain_alias_lookup_caches_missing_project_and_invalidates_on_create(real_project):
    project_uuid = str(real_project.uuid)
    cache_key = PortalDomainAlias.objects._project_cache_key(project_uuid)
    cache.delete(cache_key)

    assert PortalDomainAlias.objects.get_by_project_uuid(project_uuid) is None
    assert cache.get(cache_key) == PORTAL_DOMAIN_CACHE_MISS_VALUE

    PortalDomainAlias.objects.create(
        prefix='x765cd',
        project_uuid=project_uuid,
    )

    assert cache.get(cache_key) is None
    alias = PortalDomainAlias.objects.get_by_project_uuid(project_uuid)
    assert alias.prefix == 'x765cd'
    assert alias.project_uuid == project_uuid


@pytest.mark.django_db
def test_custom_domain_lookup_caches_missing_domain_and_invalidates_on_create(real_project):
    domain = 'missing.local.test'
    cache_key = PortalCustomDomain.objects._domain_cache_key(domain)
    cache.delete(cache_key)

    assert PortalCustomDomain.objects.get_by_domain(domain) is None
    assert cache.get(cache_key) == PORTAL_DOMAIN_CACHE_MISS_VALUE

    PortalCustomDomain.objects.create(
        domain=domain,
        project_uuid=str(real_project.uuid),
        verified=True,
    )

    assert cache.get(cache_key) is None
    binding = PortalCustomDomain.objects.get_by_domain(domain)
    assert binding.project_uuid == str(real_project.uuid)
    assert binding.verified is True


@pytest.mark.django_db
def test_verified_custom_domain_lookup_caches_missing_project_and_invalidates_on_verify(real_project):
    project_uuid = str(real_project.uuid)
    cache_key = PortalCustomDomain.objects._verified_project_cache_key(project_uuid)
    cache.delete(cache_key)

    assert PortalCustomDomain.objects.get_verified_by_project_uuid(project_uuid) is None
    assert cache.get(cache_key) == PORTAL_DOMAIN_CACHE_MISS_VALUE

    custom_domain = PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=project_uuid,
        verified=False,
    )

    assert cache.get(cache_key) is None
    assert PortalCustomDomain.objects.get_verified_by_project_uuid(project_uuid) is None
    assert cache.get(cache_key) == PORTAL_DOMAIN_CACHE_MISS_VALUE

    custom_domain.mark_verified()
    custom_domain.save(update_fields=['verified', 'verified_at', 'updated_at'])

    assert cache.get(cache_key) is None
    binding = PortalCustomDomain.objects.get_verified_by_project_uuid(project_uuid)
    assert binding.domain == 'support.local.test'
    assert binding.project_uuid == project_uuid
    assert binding.verified is True


@pytest.mark.django_db
def test_service_domain_alias_redirects_to_verified_custom_domain(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    project_uuid = str(real_project.uuid)
    project_cache_key = PortalCustomDomain.objects._verified_project_cache_key(project_uuid)
    cache.delete(project_cache_key)
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=project_uuid,
    )
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=project_uuid,
        verified=True,
    )
    request = factory.get('/my-issues/?page=1', HTTP_HOST='my-brand.seaticket-portal.test')

    response = process_portal_domain_request(request)

    assert response.status_code == 302
    assert response['Location'] == 'http://support.local.test/my-issues/?page=1'
    assert cache.get(project_cache_key) == {
        'domain': 'support.local.test',
        'project_uuid': project_uuid,
        'verified': True,
    }


@pytest.mark.django_db
def test_service_domain_alias_mismatched_project_404s_before_custom_domain_redirect(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=str(real_project.uuid),
    )
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    other_project_uuid = str(uuid4())
    request = factory.get(
        f'/api/v1/portal/{other_project_uuid}/settings/',
        HTTP_HOST='my-brand.seaticket-portal.test',
    )

    with pytest.raises(Http404):
        process_portal_domain_request(request)


@pytest.mark.django_db
def test_service_domain_alias_does_not_redirect_to_unverified_custom_domain(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=str(real_project.uuid),
    )
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=False,
    )
    request = factory.get('/', HTTP_HOST='my-brand.seaticket-portal.test')

    response = process_portal_domain_request(request)

    assert response is None
    assert request.path_info == f'/portal/{real_project.uuid}/'

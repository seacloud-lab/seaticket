import json
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.http import Http404, HttpResponse
from django.test import RequestFactory, override_settings

from seahub.portal.csrf import is_portal_origin_verified
from seahub.portal.middleware import PortalCustomDomainMiddleware
from seahub.portal.models import PortalCustomDomain, PortalDomainAlias, ProjectExternalUser
from seahub.portal.utils import set_portal_preview_session
from seahub.portal.views import portal_accounts_login_view, portal_external_logout_view, portal_view


def process_custom_domain_request(request):
    return PortalCustomDomainMiddleware(lambda _request: None).process_request(request)


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
        process_custom_domain_request(request)


@pytest.mark.django_db
def test_custom_domain_matched_portal_api_is_not_rewritten(factory, real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    path = f'/api/v1/portal/{real_project.uuid}/settings/'
    request = factory.get(path, HTTP_HOST='support.local.test')

    response = process_custom_domain_request(request)

    assert response is None
    assert request.path_info == path
    assert request.portal_custom_domain.project_uuid == str(real_project.uuid)


@pytest.mark.django_db
def test_custom_domain_root_path_rewrites_to_bound_portal(factory, real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    request = factory.get('/', HTTP_HOST='support.local.test')

    response = process_custom_domain_request(request)

    assert response is None
    assert request.path_info == f'/portal/{real_project.uuid}/'
    assert request.portal_custom_domain.project_uuid == str(real_project.uuid)


@pytest.mark.django_db
def test_main_site_host_skips_custom_domain_rewrite(factory, real_project, settings):
    settings.SEATICKET_SERVER_HOSTNAME = 'app.local.test'
    PortalCustomDomain.objects.create(
        domain='app.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    request = factory.get('/', HTTP_HOST='app.local.test')

    response = process_custom_domain_request(request)

    assert response is None
    assert request.path_info == '/'
    assert not hasattr(request, 'portal_custom_domain')


@pytest.mark.django_db
def test_custom_domain_external_accept_path_rewrites_to_bound_invitation(factory, real_project):
    PortalCustomDomain.objects.create(
        domain='support.local.test',
        project_uuid=str(real_project.uuid),
        verified=True,
    )
    token = 'a' * 32
    request = factory.get(f'/external/accept/{token}/', HTTP_HOST='support.local.test')

    response = process_custom_domain_request(request)

    assert response is None
    assert request.path_info == f'/portal-external/accept/{token}/{real_project.uuid}/'
    assert request.portal_custom_domain.project_uuid == str(real_project.uuid)


@pytest.mark.django_db
def test_service_domain_alias_root_path_rewrites_to_bound_portal(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=str(real_project.uuid),
        alias_type='custom',
        enabled=True,
    )
    request = factory.get('/', HTTP_HOST='my-brand.seaticket-portal.test')

    response = process_custom_domain_request(request)

    assert response is None
    assert request.path_info == f'/portal/{real_project.uuid}/'
    assert request.portal_domain.project_uuid == str(real_project.uuid)
    assert not hasattr(request, 'portal_custom_domain')


@pytest.mark.django_db
def test_disabled_service_domain_alias_is_not_rewritten(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='disabled-brand',
        project_uuid=str(real_project.uuid),
        alias_type='custom',
        enabled=False,
    )
    request = factory.get('/', HTTP_HOST='disabled-brand.seaticket-portal.test')

    response = process_custom_domain_request(request)

    assert response is None
    assert request.path_info == '/'
    assert not hasattr(request, 'portal_domain')


@pytest.mark.django_db
def test_portal_origin_verified_for_same_project_alias(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=str(real_project.uuid),
        alias_type='custom',
        enabled=True,
    )
    request = factory.post(
        '/',
        HTTP_HOST='my-brand.seaticket-portal.test',
        HTTP_ORIGIN='https://my-brand.seaticket-portal.test',
    )
    process_custom_domain_request(request)

    assert is_portal_origin_verified(request) is True


@pytest.mark.django_db
def test_portal_origin_rejects_other_project_alias(factory, real_project, settings):
    settings.PORTAL_SERVICE_ROOT_DOMAIN = 'seaticket-portal.test'
    PortalDomainAlias.objects.create(
        prefix='my-brand',
        project_uuid=str(real_project.uuid),
        alias_type='custom',
        enabled=True,
    )
    PortalDomainAlias.objects.create(
        prefix='other-brand',
        project_uuid=str(uuid4()),
        alias_type='custom',
        enabled=True,
    )
    request = factory.post(
        '/',
        HTTP_HOST='my-brand.seaticket-portal.test',
        HTTP_ORIGIN='https://other-brand.seaticket-portal.test',
    )
    process_custom_domain_request(request)

    assert is_portal_origin_verified(request) is False

from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.http import Http404, HttpResponse

from seahub.portal.middleware import PortalCustomDomainMiddleware
from seahub.portal.models import PortalCustomDomain, ProjectExternalUser
from seahub.portal.views import portal_external_logout_view, portal_view


def process_custom_domain_request(request):
    return PortalCustomDomainMiddleware(lambda _request: None).process_request(request)


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

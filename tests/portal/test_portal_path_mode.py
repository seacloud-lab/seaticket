import json
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.contrib.sessions.middleware import SessionMiddleware
from django.http import Http404, HttpResponse
from django.urls import resolve

from seahub.portal.apis import (
    PortalCustomDomainTLSAskView, PortalCustomDomainVerificationView, PortalCustomDomainView,
    PortalDomainAliasView, PortalIssueMetadataView, PortalKnowledgeBaseFeaturedArticlesView, PortalMyIssuesView,
    PortalPreviewTokenView, PortalTagsView,
)
from seahub.portal.middleware import PortalDomainMiddleware
from seahub.portal.models import PortalCustomDomain, PortalDomainAlias, PortalExternalInvitation, ProjectExternalUser
from seahub.portal.utils import portal_path
from seahub.portal.views import portal_path_view
from seahub.utils.hasher import AESPasswordHasher


@pytest.fixture(autouse=True)
def path_mode(settings):
    settings.ENABLE_PORTAL_DOMAIN = False
    settings.PORTAL_SERVICE_ROOT_DOMAIN = ''
    settings.IS_PORTAL_MODE = False
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def alias(real_project):
    return PortalDomainAlias.objects.create(project_uuid=str(real_project.uuid), prefix='my-brand')


def call_portal(request):
    match = resolve(request.path, urlconf='seahub.portal.urls')
    return match.func(request, **match.kwargs)


@pytest.mark.django_db
@pytest.mark.parametrize('page', ['', 'home/', 'my-issues/42/', 'team-issues/42/', 'emails/2/42/', 'knowledge-base/7/', 'chat/%s/' % uuid4()])
def test_path_routes_keep_public_base_url(factory, alias, real_project, monkeypatch, page):
    request = factory.get('/portals/my-brand/%s' % page)
    request.user = SimpleNamespace(username='', is_authenticated=False)
    real_project.settings = json.dumps({'portal': {'enable_portal': True, 'allow_anonymous': True}})
    real_project.save(update_fields=['settings'])
    captured = {}

    def render(_request, template, context):
        captured.update(context)
        return HttpResponse('ok')

    monkeypatch.setattr('seahub.portal.views.render', render)
    response = call_portal(request)

    assert response.status_code == 200
    assert captured['portal_base_url'] == '/portals/my-brand'
    assert 'enable_portal_domain' not in captured
    assert captured['is_anonymous'] is True
    assert captured['can_access_issues'] is False


@pytest.mark.parametrize('urlconf', ['seahub.portal.urls', 'seahub.portal_site_urls'])
def test_portal_email_attachment_api_route_matches(urlconf):
    match = resolve(
        '/api/v1/portal/5ff1dda1-7161-44ca-9f39-a5fda6701316/emails/383/1/2/attachments/8fe60378ead9e7132bd6c9580e94dde5.jpeg',
        urlconf=urlconf,
    )

    assert match.url_name == 'api-v1-portal-email-attachment'
    assert match.kwargs['connection_id'] == '383'
    assert match.kwargs['thread_id'] == '1'
    assert match.kwargs['email_id'] == '2'
    assert match.kwargs['file_path'] == '8fe60378ead9e7132bd6c9580e94dde5.jpeg'


@pytest.mark.django_db
def test_path_mode_requires_login_for_private_portal(factory, alias, monkeypatch):
    request = factory.get('/portals/my-brand/')
    request.user = SimpleNamespace(username='', is_authenticated=False)
    templates = []
    monkeypatch.setattr('seahub.portal.views.render', lambda _request, template, _context: templates.append(template) or HttpResponse())

    assert call_portal(request).status_code == 200
    assert templates == ['portal_login.html']


@pytest.mark.django_db
@pytest.mark.parametrize('page', ['settings/', 'api/v1/admin/users/', 'portal/%s/' % uuid4(), 'external/accept/invalid/'])
def test_path_mode_rejects_non_public_routes(factory, alias, page):
    with pytest.raises(Http404):
        call_portal(factory.get('/portals/my-brand/%s' % page))


@pytest.mark.django_db
def test_unknown_disabled_and_domain_mode_portals_are_unavailable(factory, alias, real_project, settings):
    with pytest.raises(Http404):
        call_portal(factory.get('/portals/unknown/'))
    settings.ENABLE_PORTAL_DOMAIN = True
    with pytest.raises(Http404):
        call_portal(factory.get('/portals/my-brand/'))
    settings.ENABLE_PORTAL_DOMAIN = False
    real_project.settings = json.dumps({'portal': {'enable_portal': False}})
    real_project.save(update_fields=['settings'])
    with pytest.raises(Http404):
        call_portal(factory.get('/portals/my-brand/'))


@pytest.mark.django_db
def test_alias_api_returns_main_site_url_without_domain_config(factory, alias, real_project, project_creator, settings):
    settings.SITE_ROOT = '/tickets/'
    request = factory.get('/api/v1/portal/%s/domain-alias/' % real_project.uuid, HTTP_HOST='ticket.example.com:8443', secure=True)
    request.user = project_creator
    response = PortalDomainAliasView.as_view()(request, project_uuid=str(real_project.uuid))

    assert response.status_code == 200
    prefix = response.data['subdomain_prefix']
    assert prefix == alias.prefix
    assert response.data['public_url'] == 'https://ticket.example.com:8443/tickets/portals/%s/' % prefix
    assert response.data['portal_service_root_domain'] == ''


@pytest.mark.django_db
@pytest.mark.parametrize('enable_portal_domain', [False, True])
@pytest.mark.parametrize('api_path,view,response_key', [
    ('issue/metadata/', PortalIssueMetadataView, None),
    ('tags/', PortalTagsView, 'tags'),
    ('featured-articles/', PortalKnowledgeBaseFeaturedArticlesView, 'records'),
])
@pytest.mark.parametrize('enable_portal,allow_anonymous,password_protection,verified,expected_status', [
    (True, True, False, False, 200),
    (True, True, True, False, 403),
    (True, True, True, True, 200),
    (True, False, False, False, 403),
    (False, True, False, False, 403),
])
def test_path_mode_anonymous_public_data_apis(
    factory, real_project, settings, monkeypatch, enable_portal_domain, api_path, view, response_key,
    enable_portal, allow_anonymous, password_protection, verified, expected_status,
):
    settings.ENABLE_PORTAL_DOMAIN = enable_portal_domain
    if enable_portal_domain:
        expected_status = 403
    project_uuid = str(real_project.uuid)
    real_project.settings = json.dumps({'portal': {
        'enable_portal': enable_portal, 'allow_anonymous': allow_anonymous,
        'enable_password_protection': password_protection, 'password': 'encoded-password',
    }})
    real_project.save(update_fields=['settings'])
    request = factory.get('/api/v1/portal/%s/%s' % (project_uuid, api_path))
    if verified:
        request.session['portal_verified_token_%s' % project_uuid] = 'encoded-password'

    records = [{'_pk': 1, 'name': 'Public content', 'content': 'Article content'}]
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {'metadata': [], 'results': records}
    seadb_api.get_base_metadata.return_value = {'tables': []}
    seadb_factory = Mock(return_value=seadb_api)
    monkeypatch.setattr('seahub.portal.apis.SeaDBAPI', seadb_factory)
    monkeypatch.setattr('seahub.portal.apis.get_current_table_metadata', lambda *args: {'columns': []})

    response = view.as_view()(request, project_uuid=project_uuid)

    assert response.status_code == expected_status
    if expected_status == 200:
        if response_key is None:
            assert response.data == {}
        else:
            assert response.data[response_key] == records
    else:
        assert 'detail' in response.data
        seadb_factory.assert_not_called()


@pytest.mark.django_db
def test_path_mode_anonymous_cannot_list_issues(factory, real_project):
    real_project.settings = json.dumps({'portal': {'enable_portal': True, 'allow_anonymous': True}})
    real_project.save(update_fields=['settings'])
    request = factory.get('/api/v1/portal/%s/my-issues/' % real_project.uuid)

    response = PortalMyIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

    assert response.status_code == 403
    assert 'detail' in response.data


@pytest.mark.django_db
def test_custom_token_change_invalidates_old_address(factory, alias, real_project, project_creator):
    request = factory.post('/api/v1/portal/%s/domain-alias/' % real_project.uuid, {'subdomain_prefix': 'New-Brand'}, format='json')
    request.user = project_creator
    response = PortalDomainAliasView.as_view()(request, project_uuid=str(real_project.uuid))

    assert response.status_code == 200
    assert portal_path(request, str(real_project.uuid)) == '/portals/new-brand/'
    with pytest.raises(Http404):
        call_portal(factory.get('/portals/my-brand/'))


@pytest.mark.django_db
def test_token_cannot_be_taken_from_another_project(factory, alias, real_project, project_creator):
    PortalDomainAlias.objects.create(project_uuid=str(uuid4()), prefix='taken-brand')
    request = factory.post('/api/v1/portal/%s/domain-alias/' % real_project.uuid, {'subdomain_prefix': 'taken-brand'}, format='json')
    request.user = project_creator
    response = PortalDomainAliasView.as_view()(request, project_uuid=str(real_project.uuid))

    assert response.status_code == 400
    assert response.data['error_msg'] == 'subdomain_prefix already in use.'
    alias.refresh_from_db()
    assert alias.prefix == 'my-brand'


@pytest.mark.django_db
def test_non_admin_cannot_change_token(factory, alias, real_project, auth_user):
    request = factory.post('/api/v1/portal/%s/domain-alias/' % real_project.uuid, {'subdomain_prefix': 'other-brand'}, format='json')
    request.user = auth_user
    response = PortalDomainAliasView.as_view()(request, project_uuid=str(real_project.uuid))
    assert response.status_code == 403
    alias.refresh_from_db()
    assert alias.prefix == 'my-brand'


@pytest.mark.django_db
def test_password_validation_redirects_within_portal(factory, alias, real_project):
    encoded_password = AESPasswordHasher().encode('portal-password')
    real_project.settings = json.dumps({'portal': {
        'enable_portal': True, 'allow_anonymous': True,
        'enable_password_protection': True, 'password': encoded_password,
    }})
    real_project.save(update_fields=['settings'])
    request = factory.get('/portals/my-brand/')
    request.user = SimpleNamespace(username='', is_authenticated=False)
    assert call_portal(request).url == '/portals/my-brand/anonymous-validate/'

    request = factory.post('/portals/my-brand/anonymous-validate/', {'password': 'wrong'})
    assert call_portal(request).status_code == 400
    request = factory.post('/portals/my-brand/anonymous-validate/', {'password': 'portal-password'})
    assert call_portal(request).url == '/portals/my-brand/'
    assert request.session['portal_verified_token_%s' % real_project.uuid] == encoded_password


@pytest.mark.django_db
def test_preview_and_invitation_use_main_site_paths(factory, alias, real_project, project_creator, monkeypatch):
    PortalCustomDomain.objects.create(project_uuid=str(real_project.uuid), domain='support.local.test', verified=True)
    request = factory.post('/api/v1/portal/%s/preview-token/' % real_project.uuid, HTTP_HOST='ticket.example.com')
    request.user = project_creator
    response = PortalPreviewTokenView.as_view()(request, project_uuid=str(real_project.uuid))
    assert response.status_code == 200
    assert response.data['preview_url'].startswith('http://ticket.example.com/portals/my-brand/preview/')

    request = factory.get('/portals/my-brand/preview/%s/' % response.data['token'])
    assert call_portal(request).url == '/portals/my-brand/'
    assert request.session['portal_preview_project_uuid'] == str(real_project.uuid)
    render_error = Mock(return_value=HttpResponse('invalid-preview'))
    monkeypatch.setattr('seahub.portal.views.render_error', render_error)
    invalid_request = factory.get('/portals/my-brand/preview/invalid/')
    invalid_response = portal_path_view(invalid_request, 'my-brand', 'preview/invalid/')
    assert invalid_response.status_code == 200
    render_error.assert_called_once_with(invalid_request, 'Preview link is invalid or expired.')

    invitation = PortalExternalInvitation.objects.add(project_creator.username, 'external@example.com', str(real_project.uuid))
    assert invitation.get_link(request) == 'http://testserver/portals/my-brand/external/accept/%s/' % invitation.token


@pytest.mark.django_db
def test_invitation_acceptance_and_logout_stay_under_token(factory, alias, real_project, project_creator):
    project_uuid = str(real_project.uuid)
    invitation = PortalExternalInvitation.objects.add(project_creator.username, 'external@example.com', project_uuid)
    external_user = ProjectExternalUser.objects.create(email=invitation.email, username='external-user', project_uuid=project_uuid)
    request = factory.get('/portals/my-brand/external/accept/%s/' % invitation.token)
    response = call_portal(request)
    assert response.url == '/portals/my-brand/'
    assert request.session['portal_external_project_uuid'] == project_uuid
    external_user.refresh_from_db()
    assert external_user.activated is True

    request = factory.get('/portals/my-brand/logout/')
    SessionMiddleware(lambda _request: None).process_request(request)
    request.session['portal_external_project_uuid'] = project_uuid
    response = call_portal(request)
    assert response.url == '/portals/my-brand/login/'
    assert 'portal_external_project_uuid' not in request.session


@pytest.mark.django_db
def test_path_dispatch_preserves_site_root(factory, alias, settings, monkeypatch):
    settings.SITE_ROOT = '/tickets/'
    monkeypatch.setattr('seahub.portal.views.render', lambda _request, _template, _context: HttpResponse('login'))
    request = factory.get('/tickets/portals/my-brand/login/')
    response = portal_path_view(request, 'my-brand', 'login/')
    assert response.status_code == 200
    assert portal_path(request, alias.project_uuid, 'home') == '/tickets/portals/my-brand/home/'


@pytest.mark.django_db
@pytest.mark.parametrize('view,method', [(PortalCustomDomainView, 'get'), (PortalCustomDomainView, 'post'), (PortalCustomDomainVerificationView, 'post')])
def test_custom_domain_management_is_disabled(factory, real_project, project_creator, view, method):
    request = getattr(factory, method)('/api/v1/portal/%s/custom-domain/' % real_project.uuid)
    request.user = project_creator
    response = view.as_view()(request, project_uuid=str(real_project.uuid))
    assert response.status_code == 403
    assert response.data['error_msg'] == 'Custom domains are disabled.'


@pytest.mark.django_db
def test_existing_verified_domain_is_ignored(factory, real_project):
    PortalCustomDomain.objects.create(project_uuid=str(real_project.uuid), domain='support.local.test', verified=True)
    request = factory.get('/', HTTP_HOST='support.local.test')
    assert PortalDomainMiddleware(lambda _request: None).process_request(request) is None
    assert request.path_info == '/'
    assert not hasattr(request, 'portal_domain')
    request = factory.get('/internal/portal/custom-domain/allow-tls', {'domain': 'support.local.test'})
    assert PortalCustomDomainTLSAskView.as_view()(request).status_code == 403

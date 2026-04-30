from types import SimpleNamespace

import pytest
from django.http import HttpResponse

from seahub.portal.models import ProjectExternalUser
from seahub.portal.views import portal_external_logout_view, portal_view


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

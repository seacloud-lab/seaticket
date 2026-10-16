import json

import pytest
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.urls import resolve

from seahub.portal import views as portal_views
from seahub.project import views as project_views


@pytest.mark.django_db
@pytest.mark.parametrize('enabled', [False, True])
@pytest.mark.parametrize('entry', ['project', 'portal_edit'])
def test_portal_domain_option_is_only_rendered_on_project_page(factory, real_project, project_creator, settings, monkeypatch, enabled, entry):
    settings.ENABLE_PORTAL_DOMAIN = enabled
    real_project.settings = json.dumps({'portal': {'enable_portal': True}})
    real_project.save(update_fields=['settings'])
    captured = {}

    # Keep the real page template and initialization script, without requiring a frontend build.
    monkeypatch.setattr('webpack_loader.utils.get_as_tags', lambda *args, **kwargs: [])

    def render_page(request, template, context):
        captured.update(context)
        return HttpResponse(render_to_string(template, dict(context, request=request)))

    if entry == 'project':
        path = '/workspace/%s/project/%s/' % (real_project.workspace_id, real_project.name)
        request = factory.get(path)
        request.resolver_match = resolve(path, urlconf='seahub.project.urls')
        request.user = project_creator
        monkeypatch.setattr(project_views, 'render', render_page)
        response = project_views.project_view(request, real_project.workspace_id, real_project.name)
    else:
        request = factory.get('/portal-edit/%s/' % real_project.uuid)
        request.user = project_creator
        monkeypatch.setattr(portal_views, 'render', render_page)
        response = portal_views.portal_edit_view(request, str(real_project.uuid))

    assert response.status_code == 200
    if entry == 'project':
        assert captured['enable_portal_domain'] is enabled
        expected = 'enablePortalDomain: %s,' % ('true' if enabled else 'false')
        assert expected.encode() in response.content
    else:
        assert 'enable_portal_domain' not in captured
        assert b'enablePortalDomain' not in response.content
        assert captured['portal_base_url'] == '/portal-edit/%s' % real_project.uuid

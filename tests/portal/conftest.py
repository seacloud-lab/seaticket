from types import SimpleNamespace
from uuid import uuid4

import pytest
from rest_framework.test import APIRequestFactory

from seahub.project.models import Projects, Workspaces


class SessionAPIRequestFactory(APIRequestFactory):
    def _with_session(self, request):
        if not hasattr(request, 'session'):
            request.session = {}
        return request

    def get(self, *args, **kwargs):
        request = super().get(*args, **kwargs)
        return self._with_session(request)

    def post(self, *args, **kwargs):
        request = super().post(*args, **kwargs)
        return self._with_session(request)

@pytest.fixture
def factory():
    return SessionAPIRequestFactory()


@pytest.fixture
def real_project(db):
    owner = f"owner_{uuid4().hex[:6]}@example.com"
    workspace = Workspaces.objects.create(owner=owner, org_id=1)
    project = Projects.objects.create_project(
        username=owner,
        workspace=workspace,
        name=f"proj-{uuid4().hex[:6]}",
    )
    return project


@pytest.fixture
def project_creator(real_project):
    owner = real_project.creator
    return SimpleNamespace(
        id=1,
        pk=1,
        username=owner,
        is_authenticated=True,
        is_active=True,
        org=SimpleNamespace(org_id=1),
        permissions=SimpleNamespace(can_add_project=lambda: True),
    )

@pytest.fixture
def auth_user():
    username = f"owner_{uuid4().hex[:6]}@example.com"
    return SimpleNamespace(
        id=2,
        pk=2,
        username=username,
        is_authenticated=True,
        is_active=True,
        org=SimpleNamespace(org_id=1),
        permissions=SimpleNamespace(can_add_project=lambda: True)
    )

@pytest.fixture
def no_org_user():
    username = f"owner_{uuid4().hex[:6]}@example.com"
    return SimpleNamespace(
        id=3,
        pk=3,
        username=username,
        is_authenticated=True,
        is_active=True,
        org=None
    )

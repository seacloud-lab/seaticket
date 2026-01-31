from types import SimpleNamespace
from uuid import uuid4

import pytest
from rest_framework.test import APIRequestFactory

from seahub.project.models import Projects, Workspaces


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def real_project(db):
    owner = f"owner_{uuid4().hex[:6]}@example.com"
    workspace = Workspaces.objects.create(owner=owner, org_id=1)
    project = Projects.objects.create_project(
        username=owner,
        workspace=workspace,
        name=f"proj-{uuid4().hex[:6]}",
    )
    return owner, project


@pytest.fixture
def auth_user(real_project):
    owner, _ = real_project
    return SimpleNamespace(
        id=1,
        pk=1,
        username=owner,
        is_authenticated=True,
        is_active=True,
        org=SimpleNamespace(org_id=1),
        permissions=SimpleNamespace(can_add_project=lambda: True),
    )

from types import SimpleNamespace
from uuid import uuid4
import re

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


def _snake_table_name(name, connection_id=None):
    base = name[:-5] if name.endswith('Table') else name
    base = re.sub(r'(.)([A-Z][a-z]+)', r'\1_\2', base)
    base = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', base)
    return base.lower()


@pytest.fixture(autouse=True)
def project_schema_helpers():
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr('seahub.project.tags.get_table_name', _snake_table_name)
        mp.setattr('seahub.project.tags.get_column_name', lambda _table, column_name: column_name)
        yield

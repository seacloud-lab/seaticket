from types import SimpleNamespace
from uuid import uuid4

import pytest
from rest_framework.test import APIRequestFactory

from seahub.project.models import Projects, Workspaces, ProjectConnections


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def user():
    return SimpleNamespace(
        id=1,
        pk=1,
        username='test@seafile.com',
        is_authenticated=True,
        is_active=True,
        permissions=SimpleNamespace(can_add_project=lambda: True),
        org=SimpleNamespace(org_id=1),
    )


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
        permissions=SimpleNamespace(can_add_project=lambda: True),
        org=SimpleNamespace(org_id=1),
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


@pytest.fixture
def site_connection(real_project, project_creator):
    return ProjectConnections.objects.create(
        username=project_creator.username,
        project=real_project,
        connection_type='site',
        name='site-conn',
        config={},
    )


@pytest.fixture
def connection_factory(real_project, project_creator):
    def _create(*, connection_type='site', name='conn', config=None, status=None, is_active=True, deleted=False, last_sync_log=None):
        if config is None:
            config = {}
        conn = ProjectConnections.objects.create(
            username=project_creator.username,
            project=real_project,
            connection_type=connection_type,
            name=name,
            config=config,
        )
        if status is not None:
            conn.status = status
        if is_active is not None:
            conn.is_active = is_active
        if deleted is not None:
            conn.deleted = deleted
        if last_sync_log is not None:
            conn.last_sync_log = last_sync_log
        if any(v is not None for v in (status, is_active, deleted, last_sync_log)):
            conn.save()
        return conn

    return _create

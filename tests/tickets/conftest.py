import json
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import Mock, patch
import re

import pytest
from rest_framework.test import APIRequestFactory

from seahub.project.models import Projects, Workspaces
from seahub.tickets.models import TicketViews


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
    )


@pytest.fixture
def mock_seadb():
    with patch('seahub.project.seadb_api.SeaDBAPI', return_value=Mock()), \
            patch('seahub.seadb_models.utils.get_seadb_table_columns', return_value=[]):
        yield


@pytest.fixture
def ticket_views_record(real_project):
    project = real_project
    details = {
        "navigation": [{"_id": "v1", "type": "view"}],
        "views": [{"_id": "v1", "name": "view1", "type": "table"}],
    }
    return TicketViews.objects.create(project_uuid=project.uuid, details=json.dumps(details))


@pytest.fixture
def ticket_views_folder_record(real_project):
    project = real_project
    details = {
        "navigation": [
            {"_id": "f1", "name": "folder1", "type": "folder", "children": []},
        ],
        "views": [],
    }
    return TicketViews.objects.create(project_uuid=project.uuid, details=json.dumps(details))


@pytest.fixture
def ticket_views_move_record(real_project):
    project = real_project
    details = {
        "navigation": [
            {"_id": "v1", "type": "view"},
            {"_id": "v2", "type": "view"},
        ],
        "views": [
            {"_id": "v1", "name": "view1", "type": "table"},
            {"_id": "v2", "name": "view2", "type": "table"},
        ],
    }
    return TicketViews.objects.create(project_uuid=project.uuid, details=json.dumps(details))

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
def ticket_schema_helpers():
    with patch('seahub.tickets.tickets.get_table_name', side_effect=_snake_table_name), \
            patch('seahub.tickets.tickets.get_seadb_column_name', side_effect=lambda _table, column_name: column_name), \
            patch('seahub.tickets.ticket_utils.get_table_name', side_effect=_snake_table_name), \
            patch('seahub.tickets.ticket_utils.get_seadb_column_name', side_effect=lambda _table, column_name: column_name):
        yield

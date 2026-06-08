# -*- coding: utf-8 -*-
from uuid import uuid4

import pytest
from copy import deepcopy
from unittest.mock import Mock, MagicMock, patch
from rest_framework.test import APIClient
from seahub.constants import PERMISSION_READ_WRITE
from types import SimpleNamespace
from seahub.project.models import Projects, Workspaces


@pytest.fixture
def real_project(db):
    owner = 'test@example.com'
    workspace = Workspaces.objects.create(owner=owner, org_id=1)
    project = Projects.objects.create_project(
        username=owner,
        workspace=workspace,
        name='Test Project',
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
def api_client(project_creator):
    """Create an authenticated API client for testing."""
    client = APIClient()
    client.force_authenticate(user=project_creator)
    return client


@pytest.fixture
def api_client_other(auth_user):
    client = APIClient()
    client.force_authenticate(user=auth_user)
    return client


@pytest.fixture
def api_client_no_org(no_org_user):
    client = APIClient()
    client.force_authenticate(user=no_org_user)
    return client


@pytest.fixture
def project_uuid(real_project):
    """Return a valid project UUID for testing."""
    project = real_project
    return str(project.uuid)


@pytest.fixture
def missing_project_uuid():
    return '00000000-0000-0000-0000-000000000000'


@pytest.fixture
def mock_workspace(real_project):
    """Create a mock workspace object."""
    project = real_project
    return project.workspace


@pytest.fixture
def mock_project(real_project):
    """Create a mock project object with workspace."""
    project = real_project
    return project


@pytest.fixture
def mock_seadb_api():
    """Mock SeaDBAPI class."""
    with patch('seahub.knowledge_base.knowledge_base.SeaDBAPI') as mock_class:
        mock_instance = MagicMock()
        mock_class.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_knowledge_base_views():
    """Mock KnowledgeBaseViews.objects.get_view."""
    mock_view = {
        '_id': '0000',
        'name': 'All',
        'type': 'table',
        'filters': [],
        'sorts': [],
    }
    with patch('seahub.knowledge_base.knowledge_base.KnowledgeBaseViews.objects.get_view', return_value=mock_view) as mock:
        yield mock


@pytest.fixture
def mock_list_knowledge_base_records():
    """Mock list_knowledge_base_records function."""
    records = [
        {'_pk': 1, 'title': 'Q1', 'content': 'A1'},
        {'_pk': 2, 'title': 'Q2', 'content': 'A2'},
    ]
    columns = [
        {'name': '_pk', 'type': 'int64'},
        {'name': 'title', 'type': 'text'},
        {'name': 'content', 'type': 'text'},
    ]
    with patch('seahub.knowledge_base.knowledge_base.list_knowledge_base_records', return_value=(records, columns)) as mock:
        yield mock


@pytest.fixture
def mock_get_knowledge_base_record_by_pk():
    """Mock get_knowledge_base_record_by_pk function."""
    record = {'_pk': 1, 'title': 'Test Title', 'content': 'Test Content'}
    columns = []
    with patch('seahub.knowledge_base.knowledge_base.get_knowledge_base_record_by_pk', return_value=(record, columns)) as mock:
        yield mock


@pytest.fixture
def mock_get_knowledge_base_record_by_pk_none():
    """Mock get_knowledge_base_record_by_pk to return (None, []) (record not found)."""
    with patch('seahub.knowledge_base.knowledge_base.get_knowledge_base_record_by_pk', return_value=(None, [])) as mock:
        yield mock


@pytest.fixture
def tag_option():
    """Default tag option data."""
    return {
        'id': 'TAG1',
        'name': 'Tag1',
        'color': '#111111',
        'text_color': '#eeeeee',
        'description': '',
    }


@pytest.fixture
def tag_table_metadata(tag_option):
    """Base table metadata containing the tags column."""
    return {
        'id': 'table-1',
        'columns': [
            {
                'name': 'tags',
                'key': 'col-tags',
                'data': {'options': [deepcopy(tag_option)]}
            }
        ]
    }


@pytest.fixture
def mock_seadb_api_tags():
    with patch('seahub.knowledge_base.knowledge_base_tags.SeaDBAPI') as mock_class:
        instance = MagicMock()
        mock_class.return_value = instance
        instance.assert_called_once = mock_class.assert_called_once
        yield instance


@pytest.fixture
def mock_get_current_table_metadata(tag_table_metadata):
    with patch(
        'seahub.knowledge_base.knowledge_base_tags.get_current_table_metadata',
        return_value=deepcopy(tag_table_metadata)
    ) as mock:
        yield mock


@pytest.fixture
def mock_get_column_from_columns_by_name(tag_table_metadata):
    def _side_effect(columns, name):
        for col in columns:
            if col.get('name') == name:
                return col
        return None

    with patch(
        'seahub.knowledge_base.knowledge_base_tags.get_column_from_columns_by_name',
        side_effect=_side_effect
    ) as mock:
        yield mock


@pytest.fixture
def mock_add_select_option(tag_option):
    with patch(
        'seahub.knowledge_base.knowledge_base_tags.add_select_option',
        return_value=deepcopy(tag_option)
    ) as mock:
        yield mock


@pytest.fixture
def mock_batch_delete_select_option():
    with patch('seahub.knowledge_base.knowledge_base_tags.batch_delete_select_option') as mock:
        yield mock


@pytest.fixture
def mock_filter_kb_by_select():
    records = [{'_pk': 1, 'title': 'Q1', 'content': 'A1'}]
    columns = [{'name': 'title'}, {'name': 'content'}]
    with patch(
        'seahub.knowledge_base.knowledge_base_tags.filter_kb_by_select',
        return_value=(records, columns)
    ) as mock:
        yield mock


@pytest.fixture
def mock_update_select_option():
    with patch('seahub.knowledge_base.knowledge_base_tags.update_select_option') as mock:
        yield mock


@pytest.fixture
def mock_get_kb_counts():
    with patch(
        'seahub.knowledge_base.knowledge_base_tags.get_kb_counts_group_by_column_name',
        return_value=({'Tag1': 2}, None)
    ) as mock:
        yield mock




@pytest.fixture
def mock_convert_kb_view_to_excel():
    """Mock convert_kb_view_to_excel helper."""
    with patch(
        'seahub.knowledge_base.knowledge_base_excel.convert_kb_view_to_excel',
        return_value='task-123'
    ) as mock:
        yield mock


@pytest.fixture
def mock_query_kb_task_status():
    """Mock query_kb_task_status helper."""
    with patch(
        'seahub.knowledge_base.knowledge_base_excel.query_io_task_status'
    ) as mock:
        yield mock


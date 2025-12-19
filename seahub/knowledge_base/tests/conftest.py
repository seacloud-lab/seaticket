# -*- coding: utf-8 -*-
import pytest
from copy import deepcopy
from unittest.mock import Mock, MagicMock, patch
from rest_framework.test import APIClient
from seahub.constants import PERMISSION_READ_WRITE


@pytest.fixture
def api_client():
    """Create an authenticated API client for testing."""
    client = APIClient()
    # Create a mock user
    mock_user = Mock()
    mock_user.id = 1
    mock_user.username = 'test@example.com'
    mock_user.is_authenticated = True
    # Force authenticate
    client.force_authenticate(user=mock_user)
    return client


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    user = Mock()
    user.id = 1
    user.username = 'test@example.com'
    user.is_authenticated = True
    return user


@pytest.fixture
def project_uuid():
    """Return a valid project UUID for testing."""
    return '12345678-1234-1234-1234-123456789abc'


@pytest.fixture
def mock_workspace():
    """Create a mock workspace object."""
    workspace = Mock()
    workspace.owner = 'test@example.com'
    workspace.org_id = 1
    return workspace


@pytest.fixture
def mock_project(mock_workspace):
    """Create a mock project object with workspace."""
    project = Mock()
    project.workspace = mock_workspace
    project.uuid = '12345678-1234-1234-1234-123456789abc'
    project.name = 'Test Project'
    return project


@pytest.fixture
def mock_org_context():
    """Mock is_org_context to return True."""
    with patch('seahub.knowledge_base.knowledge_base.is_org_context', return_value=True) as mock:
        yield mock


@pytest.fixture
def mock_org_context_false():
    """Mock is_org_context to return False."""
    with patch('seahub.knowledge_base.knowledge_base.is_org_context', return_value=False) as mock:
        yield mock


@pytest.fixture
def mock_get_project_by_uuid(mock_project):
    """Mock Projects.objects.get_project_by_uuid to return a mock project."""
    with patch('seahub.knowledge_base.knowledge_base.Projects.objects.get_project_by_uuid', return_value=mock_project) as mock:
        yield mock


@pytest.fixture
def mock_get_project_by_uuid_none():
    """Mock Projects.objects.get_project_by_uuid to return None (project not found)."""
    with patch('seahub.knowledge_base.knowledge_base.Projects.objects.get_project_by_uuid', return_value=None) as mock:
        yield mock


@pytest.fixture
def mock_check_permission_granted():
    """Mock check_project_permission to return permission granted."""
    with patch('seahub.knowledge_base.knowledge_base.check_project_permission', return_value=PERMISSION_READ_WRITE) as mock:
        yield mock


@pytest.fixture
def mock_check_permission_denied():
    """Mock check_project_permission to return None (permission denied)."""
    with patch('seahub.knowledge_base.knowledge_base.check_project_permission', return_value=None) as mock:
        yield mock


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
    with patch('seahub.knowledge_base.knowledge_base.get_knowledge_base_record_by_pk', return_value=record) as mock:
        yield mock


@pytest.fixture
def mock_get_knowledge_base_record_by_pk_none():
    """Mock get_knowledge_base_record_by_pk to return None (record not found)."""
    with patch('seahub.knowledge_base.knowledge_base.get_knowledge_base_record_by_pk', return_value=None) as mock:
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
def mock_org_context_tags():
    with patch('seahub.knowledge_base.knowledge_base_tags.is_org_context', return_value=True) as mock:
        yield mock


@pytest.fixture
def mock_org_context_tags_false():
    with patch('seahub.knowledge_base.knowledge_base_tags.is_org_context', return_value=False) as mock:
        yield mock


@pytest.fixture
def mock_get_project_by_uuid_tags(mock_project):
    with patch(
        'seahub.knowledge_base.knowledge_base_tags.Projects.objects.get_project_by_uuid',
        return_value=mock_project
    ) as mock:
        yield mock


@pytest.fixture
def mock_get_project_by_uuid_none_tags():
    with patch(
        'seahub.knowledge_base.knowledge_base_tags.Projects.objects.get_project_by_uuid',
        return_value=None
    ) as mock:
        yield mock


@pytest.fixture
def mock_check_permission_granted_tags():
    with patch('seahub.knowledge_base.knowledge_base_tags.check_project_permission', return_value=True) as mock:
        yield mock


@pytest.fixture
def mock_check_permission_denied_tags():
    with patch('seahub.knowledge_base.knowledge_base_tags.check_project_permission', return_value=None) as mock:
        yield mock


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
def mock_get_project_by_uuid_views(mock_project):
    with patch(
        'seahub.knowledge_base.knowledge_base_views.Projects.objects.get_project_by_uuid',
        return_value=mock_project
    ) as mock:
        yield mock


@pytest.fixture
def mock_get_project_by_uuid_none_views():
    with patch(
        'seahub.knowledge_base.knowledge_base_views.Projects.objects.get_project_by_uuid',
        return_value=None
    ) as mock:
        yield mock


@pytest.fixture
def mock_check_permission_granted_views():
    with patch(
        'seahub.knowledge_base.knowledge_base_views.check_project_permission',
        return_value=True
    ) as mock:
        yield mock


@pytest.fixture
def mock_check_permission_denied_views():
    with patch(
        'seahub.knowledge_base.knowledge_base_views.check_project_permission',
        return_value=False
    ) as mock:
        yield mock


@pytest.fixture
def mock_views_record():
    record = Mock()
    record.views_ids = ['0000']
    record.folders_views_ids = ['0000']
    record.details = '{}'
    return record


@pytest.fixture
def mock_get_record_views(mock_views_record):
    with patch(
        'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.get_record',
        return_value=mock_views_record
    ) as mock:
        yield mock


@pytest.fixture
def mock_get_record_views_none():
    with patch(
        'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.get_record',
        return_value=None
    ) as mock:
        yield mock


@pytest.fixture
def mock_list_views():
    payload = {'views': [{'_id': '0000', 'name': 'All'}]}
    with patch(
        'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.list_views',
        return_value=payload
    ) as mock:
        yield mock


@pytest.fixture
def mock_add_view():
    new_view = {'_id': '0001', 'name': 'New view'}
    with patch(
        'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.add_view',
        return_value=new_view
    ) as mock:
        yield mock


@pytest.fixture
def mock_get_view():
    view = {'_id': '0000', 'name': 'All'}
    with patch(
        'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.get_view',
        return_value=view
    ) as mock:
        yield mock


@pytest.fixture
def mock_duplicate_view():
    new_view = {'_id': '0004', 'name': 'Duplicate'}
    with patch(
        'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.duplicate_view',
        return_value=new_view
    ) as mock:
        yield mock


@pytest.fixture
def mock_move_view():
    navigation = {'navigation': [{'_id': 'nav', 'type': 'view'}]}
    with patch(
        'seahub.knowledge_base.knowledge_base_views.KnowledgeBaseViews.objects.move_view',
        return_value=navigation
    ) as mock:
        yield mock

# -*- coding: utf-8 -*-
from unittest.mock import Mock, patch
from contextlib import contextmanager

import pytest
from rest_framework.test import APIRequestFactory


class RequestFactoryWithCloudMode(APIRequestFactory):
    """
    Extended APIRequestFactory that adds cloud_mode attribute to requests.
    This is required for decorators that check org context.
    """
    def request(self, **request):
        req = super().request(**request)
        # Add cloud_mode attribute to support is_org_context check in decorators
        req.cloud_mode = True
        return req


@pytest.fixture
def factory():
    return RequestFactoryWithCloudMode()


@pytest.fixture
def user():
    u = Mock()
    u.id = 1
    u.pk = 1
    u.username = 'test@seafile.com'
    u.org = Mock()  # Add org attribute for is_org_context check
    u.permissions = Mock()
    u.permissions.can_add_project = Mock(return_value=True)
    return u


@contextmanager
def mock_project_and_permission(user, has_permission=True, project_exists=True, check_admin=False):
    """
    Helper context manager to mock project and permission checks for decorator tests.
    
    Args:
        user: The test user object
        has_permission: Whether user has permission (default True)
        project_exists: Whether project exists (default True)
        check_admin: Whether to mock admin permission check (default False)
    """
    project = None
    if project_exists:
        project = Mock()
        project.workspace = Mock()
        project.workspace.owner = user.username if has_permission else 'other@auth.local'
    
    # Patch in both locations: where decorators import from and where views might import from
    with patch('seahub.project.models.Projects.objects.get_project_by_uuid', return_value=project), \
            patch('seahub.project.utils.check_project_permission', return_value=has_permission), \
            patch('seahub.project.utils.check_project_admin_permission', return_value=has_permission):
        yield project


@contextmanager
def mock_project_connection(connection_exists=True):
    """
    Helper context manager to mock project connection checks for decorator tests.
    
    Args:
        connection_exists: Whether connection exists (default True)
    """
    connection = None
    if connection_exists:
        connection = Mock()
        connection.id = 1
        connection.name = 'Test Connection'
    
    with patch('seahub.project.models.ProjectConnections.objects.get_connection_by_id', return_value=connection):
        yield connection


@contextmanager
def mock_ticket(ticket_exists=True, has_permission=True):
    """
    Helper context manager to mock ticket checks for decorator tests.
    
    Args:
        ticket_exists: Whether ticket exists (default True)
        has_permission: Whether user has permission (default True)
    """
    ticket = None
    metadata = None
    if ticket_exists:
        ticket = {'_pk': 'ticket_pk_123', 'title': 'Test Ticket'}
        metadata = Mock()
    
    with patch('seahub.tickets.ticket_utils.get_ticket', return_value=(ticket, metadata)), \
            patch('seahub.project.utils.check_ticket_permission', return_value=has_permission):
        yield ticket, metadata


@contextmanager
def mock_comment(comment_exists=True, has_permission=True):
    """
    Helper context manager to mock comment checks for decorator tests.
    
    Args:
        comment_exists: Whether comment exists (default True)
        has_permission: Whether user has permission (default True)
    """
    comment = None
    if comment_exists:
        comment = {'_id': 'comment_123', 'content': 'Test Comment'}
    
    with patch('seahub.tickets.ticket_utils.get_ticket_comment_by_pk', return_value=comment), \
            patch('seahub.project.utils.check_comment_permission', return_value=has_permission):
        yield comment

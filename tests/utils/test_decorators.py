# -*- coding: utf-8 -*-
"""
Unit tests for decorators in seahub/utils/decorators.py
"""
from unittest.mock import Mock, patch

from rest_framework.views import APIView
from rest_framework.response import Response

from tests.utils.conftest import (
    mock_project_and_permission,
    mock_project_connection,
    mock_ticket,
    mock_comment,
)
from seahub.utils.decorators import (
    require_org_context,
    require_project,
    require_project_permission,
    require_project_connection,
    require_ticket,
    require_ticket_permission,
    require_comment_permission,
    require_can_add_project,
)


# ========== Tests for require_org_context decorator ==========

def test_require_org_context_success(factory, user):
    """Test require_org_context decorator allows request in org context"""
    
    class TestView(APIView):
        @require_org_context
        def get(self, request):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    # Mock is_org_context to return True
    with patch('seahub.utils.decorators.is_org_context', return_value=True):
        resp = TestView.as_view()(request)
    
    assert resp.status_code == 200


def test_require_org_context_failure(factory, user):
    """Test require_org_context decorator blocks request not in org context"""
    
    class TestView(APIView):
        @require_org_context
        def get(self, request):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    # Mock is_org_context to return False
    with patch('seahub.utils.decorators.is_org_context', return_value=False):
        resp = TestView.as_view()(request)
    
    assert resp.status_code == 403
    assert 'Feature is not enabled' in str(resp.data)


def test_require_org_context_adds_cloud_mode(factory, user):
    """Test require_org_context decorator adds cloud_mode attribute if missing"""
    
    class TestView(APIView):
        @require_org_context
        def get(self, request):
            assert hasattr(request, 'cloud_mode')
            return Response({'success': True})
    
    # Create a plain request without cloud_mode
    request = factory.get('/test/')
    request.user = user
    if hasattr(request, 'cloud_mode'):
        delattr(request, 'cloud_mode')
    
    with patch('seahub.utils.decorators.is_org_context', return_value=True):
        resp = TestView.as_view()(request)
    
    assert resp.status_code == 200


# ========== Tests for require_project decorator ==========

def test_require_project_success(factory, user):
    """Test require_project decorator injects project and workspace"""
    
    class TestView(APIView):
        @require_project()
        def get(self, request, project_uuid, project, workspace):
            assert project is not None
            assert workspace is not None
            return Response({'project_uuid': project_uuid})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user):
        resp = TestView.as_view()(request, project_uuid='test-uuid-123')
    
    assert resp.status_code == 200


def test_require_project_not_found(factory, user):
    """Test require_project decorator returns 404 when project not found"""
    
    class TestView(APIView):
        @require_project()
        def get(self, request, project_uuid, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user, project_exists=False):
        resp = TestView.as_view()(request, project_uuid='not-exists')
    
    assert resp.status_code == 404
    assert 'not found' in str(resp.data)


def test_require_project_missing_uuid(factory, user):
    """Test require_project decorator returns 400 when UUID is missing"""
    
    class TestView(APIView):
        @require_project()
        def get(self, request, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    # Call without project_uuid parameter
    resp = TestView.as_view()(request)
    
    assert resp.status_code == 400
    assert 'required' in str(resp.data)


def test_require_project_custom_param_name(factory, user):
    """Test require_project decorator with custom parameter name"""
    
    class TestView(APIView):
        @require_project(param_name='custom_uuid')
        def get(self, request, custom_uuid, project, workspace):
            assert project is not None
            return Response({'uuid': custom_uuid})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user):
        resp = TestView.as_view()(request, custom_uuid='custom-123')
    
    assert resp.status_code == 200


# ========== Tests for require_project_permission decorator ==========

def test_require_project_permission_success(factory, user):
    """Test require_project_permission decorator allows access with permission"""
    
    class TestView(APIView):
        @require_project()
        @require_project_permission()
        def get(self, request, project_uuid, project, workspace):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user, has_permission=True):
        resp = TestView.as_view()(request, project_uuid='test-uuid')
    
    assert resp.status_code == 200


def test_require_project_permission_denied(factory, user):
    """Test require_project_permission decorator blocks access without permission"""
    
    class TestView(APIView):
        @require_project()
        @require_project_permission()
        def get(self, request, project_uuid, project, workspace):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user, has_permission=False):
        resp = TestView.as_view()(request, project_uuid='test-uuid')
    
    assert resp.status_code == 403
    assert 'Permission denied' in str(resp.data)


def test_require_project_permission_check_admin(factory, user):
    """Test require_project_permission decorator with admin check"""
    
    class TestView(APIView):
        @require_project()
        @require_project_permission(check_admin=True)
        def get(self, request, project_uuid, project, workspace):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user, has_permission=True, check_admin=True):
        resp = TestView.as_view()(request, project_uuid='test-uuid')
    
    assert resp.status_code == 200


def test_require_project_permission_missing_workspace(factory, user):
    """Test require_project_permission decorator returns error when workspace missing"""
    
    class TestView(APIView):
        @require_project_permission()
        def get(self, request):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    # Call without workspace in kwargs (missing @require_project decorator)
    resp = TestView.as_view()(request)
    
    assert resp.status_code == 500


# ========== Tests for require_project_connection decorator ==========

def test_require_project_connection_success(factory, user):
    """Test require_project_connection decorator injects connection"""
    
    class TestView(APIView):
        @require_project_connection()
        def get(self, request, connection_id, project_connection):
            assert project_connection is not None
            return Response({'connection_id': connection_id})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_connection(connection_exists=True):
        resp = TestView.as_view()(request, connection_id=1)
    
    assert resp.status_code == 200


def test_require_project_connection_not_found(factory, user):
    """Test require_project_connection decorator returns 404 when connection not found"""
    
    class TestView(APIView):
        @require_project_connection()
        def get(self, request, connection_id, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_connection(connection_exists=False):
        resp = TestView.as_view()(request, connection_id=999)
    
    assert resp.status_code == 404
    assert 'not found' in str(resp.data)


def test_require_project_connection_missing_id(factory, user):
    """Test require_project_connection decorator returns 400 when ID is missing"""
    
    class TestView(APIView):
        @require_project_connection()
        def get(self, request, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    resp = TestView.as_view()(request)
    
    assert resp.status_code == 400
    assert 'required' in str(resp.data)


def test_require_project_connection_custom_param_name(factory, user):
    """Test require_project_connection decorator with custom parameter name"""
    
    class TestView(APIView):
        @require_project_connection(param_name='conn_id')
        def get(self, request, conn_id, project_connection):
            assert project_connection is not None
            return Response({'conn_id': conn_id})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_connection(connection_exists=True):
        resp = TestView.as_view()(request, conn_id=1)
    
    assert resp.status_code == 200


# ========== Tests for require_ticket decorator ==========

def test_require_ticket_success(factory, user):
    """Test require_ticket decorator injects ticket and metadata"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        def get(self, request, project_uuid, ticket_id, project, workspace, ticket, ticket_metadata):
            assert ticket is not None
            assert ticket_metadata is not None
            return Response({'ticket_id': ticket_id})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True):
        resp = TestView.as_view()(request, project_uuid='test-uuid', ticket_id='ticket-123')
    
    assert resp.status_code == 200


def test_require_ticket_not_found(factory, user):
    """Test require_ticket decorator returns 404 when ticket not found"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        def get(self, request, project_uuid, ticket_id, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=False):
        resp = TestView.as_view()(request, project_uuid='test-uuid', ticket_id='not-exists')
    
    assert resp.status_code == 404
    assert 'not found' in str(resp.data)


def test_require_ticket_missing_id(factory, user):
    """Test require_ticket decorator returns 400 when ticket ID is missing"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        def get(self, request, project_uuid, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user):
        resp = TestView.as_view()(request, project_uuid='test-uuid')
    
    assert resp.status_code == 400
    assert 'required' in str(resp.data)


def test_require_ticket_exception_handling(factory, user):
    """Test require_ticket decorator handles exceptions gracefully"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        def get(self, request, project_uuid, ticket_id, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            patch('seahub.tickets.ticket_utils.get_ticket', side_effect=Exception('Database error')):
        resp = TestView.as_view()(request, project_uuid='test-uuid', ticket_id='ticket-123')
    
    assert resp.status_code == 500


# ========== Tests for require_ticket_permission decorator ==========

def test_require_ticket_permission_success(factory, user):
    """Test require_ticket_permission decorator allows access with permission"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        @require_ticket_permission
        def get(self, request, project_uuid, ticket_id, project, workspace, ticket, ticket_metadata):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True, has_permission=True):
        resp = TestView.as_view()(request, project_uuid='test-uuid', ticket_id='ticket-123')
    
    assert resp.status_code == 200


def test_require_ticket_permission_denied(factory, user):
    """Test require_ticket_permission decorator blocks access without permission"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        @require_ticket_permission
        def get(self, request, project_uuid, ticket_id, project, workspace, ticket, ticket_metadata):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True, has_permission=False):
        resp = TestView.as_view()(request, project_uuid='test-uuid', ticket_id='ticket-123')
    
    assert resp.status_code == 403
    assert 'Permission denied' in str(resp.data)


def test_require_ticket_permission_missing_context(factory, user):
    """Test require_ticket_permission decorator returns error when context missing"""
    
    class TestView(APIView):
        @require_ticket_permission
        def get(self, request):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    resp = TestView.as_view()(request)
    
    assert resp.status_code == 500


# ========== Tests for require_comment_permission decorator ==========

def test_require_comment_permission_success(factory, user):
    """Test require_comment_permission decorator allows access with permission"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        @require_comment_permission()
        def get(self, request, project_uuid, ticket_id, comment_id, project, workspace, 
                ticket, ticket_metadata, ticket_comment_data):
            assert ticket_comment_data is not None
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True), \
            mock_comment(comment_exists=True, has_permission=True):
        resp = TestView.as_view()(request, project_uuid='test-uuid', 
                                 ticket_id='ticket-123', comment_id='comment-456')
    
    assert resp.status_code == 200


def test_require_comment_permission_denied(factory, user):
    """Test require_comment_permission decorator blocks access without permission"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        @require_comment_permission()
        def get(self, request, project_uuid, ticket_id, comment_id, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True), \
            mock_comment(comment_exists=True, has_permission=False):
        resp = TestView.as_view()(request, project_uuid='test-uuid', 
                                 ticket_id='ticket-123', comment_id='comment-456')
    
    assert resp.status_code == 403
    assert 'Permission denied' in str(resp.data)


def test_require_comment_permission_comment_not_found(factory, user):
    """Test require_comment_permission decorator returns 404 when comment not found"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        @require_comment_permission()
        def get(self, request, project_uuid, ticket_id, comment_id, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True), \
            mock_comment(comment_exists=False):
        resp = TestView.as_view()(request, project_uuid='test-uuid', 
                                 ticket_id='ticket-123', comment_id='not-exists')
    
    assert resp.status_code == 404
    assert 'not found' in str(resp.data)


def test_require_comment_permission_missing_id(factory, user):
    """Test require_comment_permission decorator returns 400 when comment ID is missing"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        @require_comment_permission()
        def get(self, request, project_uuid, ticket_id, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True):
        resp = TestView.as_view()(request, project_uuid='test-uuid', ticket_id='ticket-123')
    
    assert resp.status_code == 400
    assert 'required' in str(resp.data)


def test_require_comment_permission_exception_handling(factory, user):
    """Test require_comment_permission decorator handles exceptions gracefully"""
    
    class TestView(APIView):
        @require_project()
        @require_ticket()
        @require_comment_permission()
        def get(self, request, project_uuid, ticket_id, comment_id, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    with mock_project_and_permission(user), \
            mock_ticket(ticket_exists=True), \
            patch('seahub.tickets.ticket_utils.get_ticket_comment_by_pk', 
                  side_effect=Exception('Database error')):
        resp = TestView.as_view()(request, project_uuid='test-uuid', 
                                 ticket_id='ticket-123', comment_id='comment-456')
    
    assert resp.status_code == 500


# ========== Tests for require_can_add_project decorator ==========

def test_require_can_add_project_success(factory, user):
    """Test require_can_add_project decorator allows access with permission"""
    
    class TestView(APIView):
        @require_can_add_project
        def post(self, request):
            return Response({'success': True})
    
    request = factory.post('/test/')
    request.user = user
    user.permissions.can_add_project = Mock(return_value=True)
    
    resp = TestView.as_view()(request)
    
    assert resp.status_code == 200


def test_require_can_add_project_denied(factory, user):
    """Test require_can_add_project decorator blocks access without permission"""
    
    class TestView(APIView):
        @require_can_add_project
        def post(self, request):
            return Response({'success': True})
    
    request = factory.post('/test/')
    request.user = user
    user.permissions.can_add_project = Mock(return_value=False)
    
    resp = TestView.as_view()(request)
    
    assert resp.status_code == 403
    assert 'Permission denied' in str(resp.data)


# ========== Tests for decorator stacking ==========

def test_multiple_decorators_stacked(factory, user):
    """Test multiple decorators can be stacked together"""
    
    class TestView(APIView):
        @require_org_context
        @require_project()
        @require_project_permission()
        def get(self, request, project_uuid, project, workspace):
            return Response({
                'project_uuid': project_uuid,
            })
    
    request = factory.get('/test/')
    request.user = user
    
    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            mock_project_and_permission(user, has_permission=True):
        resp = TestView.as_view()(request, project_uuid='test-uuid')
    
    assert resp.status_code == 200


def test_decorators_fail_at_first_check(factory, user):
    """Test decorator chain stops at first failure"""
    
    class TestView(APIView):
        @require_org_context
        @require_project()
        @require_project_permission()
        def get(self, request, project_uuid, **kwargs):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    # Fail at org context check
    with patch('seahub.utils.decorators.is_org_context', return_value=False):
        resp = TestView.as_view()(request, project_uuid='test-uuid')
    
    assert resp.status_code == 403
    assert 'Feature is not enabled' in str(resp.data)


def test_decorators_fail_at_middle_check(factory, user):
    """Test decorator chain stops at middle failure"""
    
    class TestView(APIView):
        @require_org_context
        @require_project()
        @require_project_permission()
        def get(self, request, project_uuid, project, workspace):
            return Response({'success': True})
    
    request = factory.get('/test/')
    request.user = user
    
    # Pass org context but fail at permission check
    with patch('seahub.utils.decorators.is_org_context', return_value=True), \
            mock_project_and_permission(user, has_permission=False):
        resp = TestView.as_view()(request, project_uuid='test-uuid')
    
    assert resp.status_code == 403
    assert 'Permission denied' in str(resp.data)

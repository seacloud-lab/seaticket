# -*- coding: utf-8 -*-
"""
Unit tests for seahub.utils.decorators
"""

from unittest.mock import Mock, patch

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from seahub.utils.decorators import (
    require_org_context,
    require_can_add_project,
    require_can_add_group,
)


class TestRequireOrgContext:
    """Tests for require_org_context decorator."""

    def test_not_in_org_context_returns_403(self, factory, user):
        """When request is not in org context, should return 403."""
        
        class TestView(APIView):
            @require_org_context
            def get(self, request):
                return Response({'success': True}, status=status.HTTP_200_OK)
        
        request = factory.get('/test/')
        request.user = user
        
        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            response = TestView.as_view()(request)
        
        assert response.status_code == 403
        assert 'error_msg' in response.data
        assert response.data['error_msg'] == 'Feature is not enabled.'

    def test_in_org_context_calls_view(self, factory, user):
        """When request is in org context, should call the view function."""
        
        class TestView(APIView):
            @require_org_context
            def get(self, request):
                return Response({'success': True}, status=status.HTTP_200_OK)
        
        request = factory.get('/test/')
        request.user = user
        
        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            response = TestView.as_view()(request)
        
        assert response.status_code == 200
        assert response.data['success'] is True

    def test_decorator_preserves_view_args_and_kwargs(self, factory, user):
        """Decorator should pass through args and kwargs to the view."""
        
        class TestView(APIView):
            @require_org_context
            def get(self, request, project_id, *args, **kwargs):
                return Response({
                    'project_id': project_id,
                    'extra_param': kwargs.get('extra_param')
                }, status=status.HTTP_200_OK)
        
        request = factory.get('/test/')
        request.user = user
        
        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            view = TestView.as_view()
            response = view(request, project_id='123', extra_param='value')
        
        assert response.status_code == 200
        assert response.data['project_id'] == '123'
        assert response.data['extra_param'] == 'value'

    def test_post_method_not_in_org_context(self, factory, user):
        """Test decorator works with POST method."""
        
        class TestView(APIView):
            @require_org_context
            def post(self, request):
                return Response({'created': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/', data={'name': 'test'})
        request.user = user
        
        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            response = TestView.as_view()(request)
        
        assert response.status_code == 403


class TestRequireCanAddProject:
    """Tests for require_can_add_project decorator."""

    def test_user_cannot_add_project_returns_403(self, factory, user_with_permissions):
        """When user cannot add project, should return 403."""
        
        class TestView(APIView):
            @require_can_add_project
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=False)
        
        response = TestView.as_view()(request)
        
        assert response.status_code == 403
        assert 'error_msg' in response.data
        assert response.data['error_msg'] == 'Permission denied.'

    def test_user_can_add_project_calls_view(self, factory, user_with_permissions):
        """When user can add project, should call the view function."""
        
        class TestView(APIView):
            @require_can_add_project
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=True)
        
        response = TestView.as_view()(request)
        
        assert response.status_code == 201
        assert response.data['success'] is True

    def test_decorator_calls_permission_check(self, factory, user_with_permissions):
        """Decorator should call the can_add_project permission check."""
        
        class TestView(APIView):
            @require_can_add_project
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=True)
        
        response = TestView.as_view()(request)
        
        # Verify that the permission check was called
        request.user.permissions.can_add_project.assert_called_once()
        assert response.status_code == 201

    def test_get_method_cannot_add_project(self, factory, user_with_permissions):
        """Test decorator works with GET method."""
        
        class TestView(APIView):
            @require_can_add_project
            def get(self, request):
                return Response({'projects': []}, status=status.HTTP_200_OK)
        
        request = factory.get('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=False)
        
        response = TestView.as_view()(request)
        
        assert response.status_code == 403

    def test_decorator_preserves_view_args_and_kwargs(self, factory, user_with_permissions):
        """Decorator should pass through args and kwargs to the view."""
        
        class TestView(APIView):
            @require_can_add_project
            def post(self, request, org_id, *args, **kwargs):
                return Response({
                    'org_id': org_id,
                    'project_name': kwargs.get('project_name')
                }, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=True)
        
        view = TestView.as_view()
        response = view(request, org_id='org-123', project_name='Test Project')
        
        assert response.status_code == 201
        assert response.data['org_id'] == 'org-123'
        assert response.data['project_name'] == 'Test Project'


class TestRequireCanAddGroup:
    """Tests for require_can_add_group decorator."""

    def test_user_cannot_add_group_returns_403(self, factory, user_with_permissions):
        """When user cannot add group, should return 403."""
        
        class TestView(APIView):
            @require_can_add_group
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_group = Mock(return_value=False)
        
        response = TestView.as_view()(request)
        
        assert response.status_code == 403
        assert 'error_msg' in response.data
        assert response.data['error_msg'] == 'Permission denied.'

    def test_user_can_add_group_calls_view(self, factory, user_with_permissions):
        """When user can add group, should call the view function."""
        
        class TestView(APIView):
            @require_can_add_group
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_group = Mock(return_value=True)
        
        response = TestView.as_view()(request)
        
        assert response.status_code == 201
        assert response.data['success'] is True

    def test_decorator_calls_permission_check(self, factory, user_with_permissions):
        """Decorator should call the can_add_group permission check."""
        
        class TestView(APIView):
            @require_can_add_group
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_group = Mock(return_value=True)
        
        response = TestView.as_view()(request)
        
        # Verify that the permission check was called
        request.user.permissions.can_add_group.assert_called_once()
        assert response.status_code == 201

    def test_get_method_cannot_add_group(self, factory, user_with_permissions):
        """Test decorator works with GET method."""
        
        class TestView(APIView):
            @require_can_add_group
            def get(self, request):
                return Response({'groups': []}, status=status.HTTP_200_OK)
        
        request = factory.get('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_group = Mock(return_value=False)
        
        response = TestView.as_view()(request)
        
        assert response.status_code == 403

    def test_decorator_preserves_view_args_and_kwargs(self, factory, user_with_permissions):
        """Decorator should pass through args and kwargs to the view."""
        
        class TestView(APIView):
            @require_can_add_group
            def post(self, request, org_id, *args, **kwargs):
                return Response({
                    'org_id': org_id,
                    'group_name': kwargs.get('group_name')
                }, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_group = Mock(return_value=True)
        
        view = TestView.as_view()
        response = view(request, org_id='org-456', group_name='Test Group')
        
        assert response.status_code == 201
        assert response.data['org_id'] == 'org-456'
        assert response.data['group_name'] == 'Test Group'

    def test_put_method_cannot_add_group(self, factory, user_with_permissions):
        """Test decorator works with PUT method."""
        
        class TestView(APIView):
            @require_can_add_group
            def put(self, request):
                return Response({'updated': True}, status=status.HTTP_200_OK)
        
        request = factory.put('/test/', data={'name': 'updated'}, format='json')
        request.user = user_with_permissions
        request.user.permissions.can_add_group = Mock(return_value=False)
        
        response = TestView.as_view()(request)
        
        assert response.status_code == 403


class TestDecoratorsCombined:
    """Tests for using multiple decorators together."""

    def test_multiple_decorators_all_checks_pass(self, factory, user_with_permissions):
        """When all decorator checks pass, view should be called."""
        
        class TestView(APIView):
            @require_org_context
            @require_can_add_project
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=True)
        
        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            response = TestView.as_view()(request)
        
        assert response.status_code == 201
        assert response.data['success'] is True

    def test_multiple_decorators_first_check_fails(self, factory, user_with_permissions):
        """When first decorator check fails, view should not be called."""
        
        class TestView(APIView):
            @require_org_context
            @require_can_add_project
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=True)
        
        with patch('seahub.utils.decorators.is_org_context', return_value=False):
            response = TestView.as_view()(request)
        
        assert response.status_code == 403
        assert response.data['error_msg'] == 'Feature is not enabled.'

    def test_multiple_decorators_second_check_fails(self, factory, user_with_permissions):
        """When second decorator check fails, view should not be called."""
        
        class TestView(APIView):
            @require_org_context
            @require_can_add_project
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=False)
        
        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            response = TestView.as_view()(request)
        
        assert response.status_code == 403
        assert response.data['error_msg'] == 'Permission denied.'

    def test_all_three_decorators_combined(self, factory, user_with_permissions):
        """Test all three decorators used together."""
        
        class TestView(APIView):
            @require_org_context
            @require_can_add_project
            @require_can_add_group
            def post(self, request):
                return Response({'success': True}, status=status.HTTP_201_CREATED)
        
        request = factory.post('/test/')
        request.user = user_with_permissions
        request.user.permissions.can_add_project = Mock(return_value=True)
        request.user.permissions.can_add_group = Mock(return_value=True)
        
        with patch('seahub.utils.decorators.is_org_context', return_value=True):
            response = TestView.as_view()(request)
        
        assert response.status_code == 201
        assert response.data['success'] is True

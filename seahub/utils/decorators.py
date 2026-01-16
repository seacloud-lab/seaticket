# -*- coding: utf-8 -*-
"""
Reusable decorators for APIView methods to abstract common pre-conditions.
These decorators handle org context check, resource check, permission check, etc.
"""

import logging
from functools import wraps

from rest_framework import status

from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.project.models import Projects, ProjectConnections

logger = logging.getLogger(__name__)


def require_org_context(view_func):
    """
    Decorator to check if request is in org context.
    Returns 403 if not in org context.
    """
    @wraps(view_func)
    def wrapped_view(self, request, *args, **kwargs):
        # Ensure request has cloud_mode attribute (for test compatibility)
        if not hasattr(request, 'cloud_mode'):
            request.cloud_mode = False
        
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        return view_func(self, request, *args, **kwargs)
    return wrapped_view


def require_project(param_name='project_uuid'):
    """
    Decorator to check if project exists and inject it into the view.
    
    Args:
        param_name: The name of the URL parameter containing project UUID
        
    Injects:
        - project: Project instance
        - workspace: Workspace instance (project.workspace)
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(self, request, *args, **kwargs):
            project_uuid = kwargs.get(param_name)
            if not project_uuid:
                error_msg = 'Project UUID is required.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            
            project = Projects.objects.get_project_by_uuid(project_uuid)
            if not project:
                error_msg = f'Project {project_uuid} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            # Inject project and workspace into kwargs
            kwargs['project'] = project
            kwargs['workspace'] = project.workspace
            
            return view_func(self, request, *args, **kwargs)
        return wrapped_view
    return decorator


def require_project_permission(check_admin=False):
    """
    Decorator to check if user has permission to access the project.
    Must be used after @require_project decorator.
    
    Args:
        check_admin: If True, check admin permission instead of regular permission
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(self, request, *args, **kwargs):
            workspace = kwargs.get('workspace')
            if not workspace:
                error_msg = 'Workspace not found in context. Use @require_project before this decorator.'
                logger.error(error_msg)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            
            username = request.user.username
            
            if check_admin:
                from seahub.project.utils import check_project_admin_permission
                has_permission = check_project_admin_permission(username, workspace.owner)
            else:
                from seahub.project.utils import check_project_permission
                has_permission = check_project_permission(username, workspace.owner)
            
            if not has_permission:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            
            return view_func(self, request, *args, **kwargs)
        return wrapped_view
    return decorator


def require_project_connection(param_name='connection_id'):
    """
    Decorator to check if connection exists and inject it into the view.
    
    Args:
        param_name: The name of the URL parameter containing connection ID
        
    Injects:
        - project_connection: ProjectConnections instance
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(self, request, *args, **kwargs):
            connection_id = kwargs.get(param_name)
            if not connection_id:
                error_msg = 'Connection ID is required.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            
            project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
            if not project_connection:
                error_msg = f'project_connection {connection_id} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            # Inject connection into kwargs
            kwargs['project_connection'] = project_connection
            
            return view_func(self, request, *args, **kwargs)
        return wrapped_view
    return decorator


def require_ticket(param_name='ticket_id'):
    """
    Decorator to check if ticket exists and inject it into the view.
    Args:
        param_name: The name of the URL parameter containing ticket ID
        
    Injects:
        - ticket: Ticket data dict
        - ticket_metadata: Ticket metadata
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(self, request, *args, **kwargs):
            from seahub.tickets.ticket_utils import get_ticket
            
            ticket_id = kwargs.get(param_name)
            if not ticket_id:
                error_msg = 'Ticket ID is required.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            
            project_uuid = kwargs.get('project_uuid')
            if not project_uuid:
                error_msg = 'Project UUID not found in context.'
                logger.error(error_msg)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            
            from seahub.project.seadb_api import SeaDBAPI
            username = request.user.username
            seadb_api = SeaDBAPI(username)

            try:
                ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
                if not ticket:
                    error_msg = 'Ticket not found.'
                    return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            
            # Inject ticket and metadata into kwargs
            kwargs['ticket'] = ticket
            kwargs['ticket_metadata'] = metadata
            
            return view_func(self, request, *args, **kwargs)
        return wrapped_view
    return decorator


def require_ticket_permission(view_func):
    """
    Decorator to check if user has permission to access/modify the ticket.
    Must be used after @require_ticket decorator.
    """
    @wraps(view_func)
    def wrapped_view(self, request, *args, **kwargs):
        from seahub.project.utils import check_ticket_permission
        
        ticket = kwargs.get('ticket')
        workspace = kwargs.get('workspace')
        
        if not ticket or not workspace:
            error_msg = 'Ticket or workspace not found in context.'
            logger.error(error_msg)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        
        username = request.user.username
        if not check_ticket_permission(username, workspace.owner, ticket):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        return view_func(self, request, *args, **kwargs)
    return wrapped_view


def require_comment_permission(param_name='comment_id'):
    """
    Decorator to check if user has permission to access/modify the comment.
    Must be used after @require_ticket decorator.
    
    Args:
        param_name: The name of the URL parameter containing comment ID
        
    Injects:
        - ticket_comment_data: Comment data dict
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(self, request, *args, **kwargs):
            from seahub.project.utils import check_comment_permission
            from seahub.tickets.ticket_utils import get_ticket_comment_by_pk
            
            comment_id = kwargs.get(param_name)
            if not comment_id:
                error_msg = 'Comment ID is required.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            
            ticket = kwargs.get('ticket')
            workspace = kwargs.get('workspace')
            project_uuid = kwargs.get('project_uuid')
            
            if not ticket or not workspace or not project_uuid:
                error_msg = 'Required context not found.'
                logger.error(error_msg)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            
            from seahub.project.seadb_api import SeaDBAPI
            username = request.user.username
            seadb_api = SeaDBAPI(username)

            try:
                ticket_comment_data = get_ticket_comment_by_pk(
                    seadb_api, project_uuid, ticket.get('_pk'), comment_id
                )
                if not ticket_comment_data:
                    error_msg = 'Comment not found.'
                    return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            
            if not check_comment_permission(username, workspace.owner, ticket_comment_data):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            
            # Inject comment data into kwargs
            kwargs['ticket_comment_data'] = ticket_comment_data
            
            return view_func(self, request, *args, **kwargs)
        return wrapped_view
    return decorator


def require_can_add_project(view_func):
    """
    Decorator to check if user has permission to add project.
    """
    @wraps(view_func)
    def wrapped_view(self, request, *args, **kwargs):
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        return view_func(self, request, *args, **kwargs)
    return wrapped_view

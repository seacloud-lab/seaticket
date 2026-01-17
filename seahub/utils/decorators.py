# -*- coding: utf-8 -*-
"""
Reusable decorators for APIView methods to abstract common pre-conditions.
"""

import logging
from functools import wraps

from rest_framework import status

from seahub.api2.utils import api_error
from seahub.utils import is_org_context

logger = logging.getLogger(__name__)


def require_org_context(view_func):
    """
    Decorator to check if request is in org context.
    Returns 403 if not in org context.
    """
    @wraps(view_func)
    def wrapped_view(self, request, *args, **kwargs):   
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        return view_func(self, request, *args, **kwargs)
    return wrapped_view


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


def require_can_add_group(view_func):
    """
    Decorator to check if user has permission to add group.
    """
    @wraps(view_func)
    def wrapped_view(self, request, *args, **kwargs):
        if not request.user.permissions.can_add_group():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        return view_func(self, request, *args, **kwargs)
    return wrapped_view

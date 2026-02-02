# Copyright (c) 2012-2016 Seafile Ltd.
"""
Provides a set of pluggable permission policies.
"""

from rest_framework.permissions import BasePermission

import json
from seahub.project.models import Projects
from seahub.project.utils import check_same_org_permission

from seahub.utils import is_pro_version
from seahub.group.utils import is_group_member

SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']


class IsGroupMember(BasePermission):
    """
    Check whether user is in a group.
    """
    def has_permission(self, request, view, obj=None):
        group_id = int(view.kwargs.get('group_id', ''))
        username = request.user.username if request.user else ''
        return True if is_group_member(group_id, username) else False

class IsProVersion(BasePermission):
    """
    Check whether Seafile is pro version
    """

    def has_permission(self, request, *args, **kwargs):
        return is_pro_version()

class IsOrgAdminUser(BasePermission):
    """
    Check whether  user is org admin
    """
    def has_permission(self, request, view, obj=None):
        if not request.user.is_authenticated:
            return False
        if not request.user.org:
            return False
        org_id = int(view.kwargs.get('org_id', ''))
        return True if request.user.org.is_staff and \
            request.user.org.org_id == org_id else False


class IsOrgMember(BasePermission):
    """
    Check whether user is in an org
    """
    def has_permission(self, request, view, obj=None):
        if not request.user.is_authenticated:
            return False
        if not request.user.org:
            return False
        org_id = int(view.kwargs.get('org_id', ''))
        return True if request.user.org.org_id == org_id else False


class CanUseAdvancedPerms(BasePermission):
    def has_permission(self, request, view):
        return request.user.permissions.can_use_advanced_permissions()


class CanUseAdvancedCustomizaiton(BasePermission):
    def has_permission(self, request, view):
        return request.user.permissions.can_use_advanced_customization()

class PortalAccessPermission(BasePermission):
    def has_permission(self, request, view):
        project_uuid = view.kwargs.get('project_uuid')
        if not project_uuid:
            return False

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return False

        try:
            settings_dict = json.loads(project.settings) if project.settings else {}
        except Exception:
            settings_dict = {}
        portal_settings = settings_dict.get('portal', {})
        allow_anonymous = bool(portal_settings.get('allow_anonymous', False))
        enable_password_protection = bool(portal_settings.get('enable_password_protection', False))

        if not allow_anonymous:
            if not request.user.is_authenticated:
                return False
            return check_same_org_permission(request.user, project.workspace)
        else:
            if enable_password_protection:
                encoded_password = portal_settings.get('password')
                verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
                return bool(verified_token and encoded_password and verified_token == encoded_password)
            return True

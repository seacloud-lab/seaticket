import json

from rest_framework.permissions import BasePermission

from seahub.project.models import Projects
from seahub.project.utils import check_same_org_permission
from seahub.portal.models import ProjectExternalUser



def _get_project_and_settings(request, view):
    project_uuid = getattr(view, 'kwargs', {}).get('project_uuid')
    if not project_uuid:
        return None, None, None
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return None, None, None
    try:
        request.project = project
        settings_dict = json.loads(project.settings) if project.settings else {}
    except Exception:
        settings_dict = {}
    portal_settings = settings_dict.get('portal', {})
    return project_uuid, project, portal_settings


def _is_external_member(request, project_uuid):
    ext_username = request.session.get('portal_external_username')
    ext_project_uuid = request.session.get('portal_external_project_uuid')
    if ext_username and ext_project_uuid and ext_project_uuid == project_uuid and \
            ProjectExternalUser.objects.filter(project_uuid=project_uuid, username=ext_username, activated=True).exists():
        if getattr(request, 'user', None):
            request.user.username = ext_username
        return True
    return False


def _is_portal_password_verified(request, project_uuid, portal_settings):
    encoded_password = portal_settings.get('password')
    verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
    return bool(verified_token and encoded_password and verified_token == encoded_password)


class PortalKnowledgeBasePermission(BasePermission):
    def has_permission(self, request, view):
        project_uuid, project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False
            
        if _is_external_member(request, project_uuid):
            return True

        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            if check_same_org_permission(user, project.workspace):
                return True
        
        allow_anonymous = bool(portal_settings.get('allow_anonymous', False))
        enable_password_protection = bool(portal_settings.get('enable_password_protection', False))
        if allow_anonymous:
            if enable_password_protection and not _is_portal_password_verified(request, project_uuid, portal_settings):
                return False
            return True

        return False


class PortalIssuePermission(BasePermission):
    def has_permission(self, request, view):
        project_uuid, project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False

        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            if check_same_org_permission(user, project.workspace):
                return True

        if _is_external_member(request, project_uuid):
            return True

        return False


class PortalChatPermission(BasePermission):
    def has_permission(self, request, view):
        project_uuid, project, _ = _get_project_and_settings(request, view)
        if not project:
            return False

        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            if check_same_org_permission(user, project.workspace):
                return True

        if _is_external_member(request, project_uuid):
            return True
        return False

from rest_framework.permissions import BasePermission

from seahub.project.utils import check_same_org_permission
from seahub.portal.models import ProjectExternalUser
from seahub.portal.utils import get_portal_preview_username, get_request_project_and_portal_settings, get_request_session



def _get_project_and_settings(request, view):
    project_uuid = getattr(view, 'kwargs', {}).get('project_uuid')
    if not project_uuid:
        return None, None
    return get_request_project_and_portal_settings(request, project_uuid)


def _is_external_member(request, project_uuid):
    session = get_request_session(request)
    if session is None:
        return False

    ext_username = session.get('portal_external_username')
    ext_project_uuid = session.get('portal_external_project_uuid')
    if ext_username and ext_project_uuid and ext_project_uuid == project_uuid and \
            ProjectExternalUser.objects.filter(project_uuid=project_uuid, username=ext_username, activated=True).exists():
        if getattr(request, 'user', None):
            request.user.username = ext_username
        return True
    return False


def _is_portal_preview_user(request, project_uuid):
    preview_username = get_portal_preview_username(request, project_uuid)
    if not preview_username:
        return False
    if getattr(request, 'user', None):
        request.user.username = preview_username
    return True


def _is_portal_password_verified(request, project_uuid, portal_settings):
    session = get_request_session(request)
    if session is None:
        return False

    encoded_password = portal_settings.get('password')
    verified_token = session.get(f'portal_verified_token_{project_uuid}')
    return bool(verified_token and encoded_password and verified_token == encoded_password)


class PortalKnowledgeBasePermission(BasePermission):
    def has_permission(self, request, view):
        project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False
        project_uuid = str(project.uuid)

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False
            
        if _is_portal_preview_user(request, project_uuid):
            return True

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


class PortalAnonymousAccessPermission(BasePermission):
    def has_permission(self, request, view):
        project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False
        project_uuid = str(project.uuid)

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False

        if _is_portal_preview_user(request, project_uuid):
            return True

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
        project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False
        project_uuid = str(project.uuid)

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False

        if _is_portal_preview_user(request, project_uuid):
            return True

        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            if check_same_org_permission(user, project.workspace):
                return True

        if _is_external_member(request, project_uuid):
            return True

        return False


class PortalChatPermission(BasePermission):
    def has_permission(self, request, view):
        project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False
        project_uuid = str(project.uuid)

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False

        if _is_portal_preview_user(request, project_uuid):
            return True

        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            if check_same_org_permission(user, project.workspace):
                return True

        if _is_external_member(request, project_uuid):
            return True

        allow_anonymous = bool(portal_settings.get('allow_anonymous', False))
        enable_password_protection = bool(portal_settings.get('enable_password_protection', False))
        if allow_anonymous:
            if enable_password_protection and not _is_portal_password_verified(request, project_uuid, portal_settings):
                return False
            return True
        return False


class PortalUploadPermission(PortalChatPermission):
    pass


class PortalFilePermission(BasePermission):
    def has_permission(self, request, view):
        file_path = getattr(view, 'kwargs', {}).get('file_path', '') or ''

        if file_path.startswith('attachments/portal-chat/'):
            return PortalChatPermission().has_permission(request, view)

        if file_path.startswith('attachments/portal-issue/'):
            return PortalIssuePermission().has_permission(request, view)

        if file_path.startswith('attachments/knowledgebase/'):
            return PortalKnowledgeBasePermission().has_permission(request, view)

        return False

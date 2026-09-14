from django.conf import settings
from rest_framework.permissions import BasePermission

from seahub.constants import PERMISSION_READ_WRITE
from seahub.project.utils import check_same_org_permission, check_project_admin_permission, check_project_permission
from seahub.portal.models import ProjectExternalUser, PortalCustomer
from seahub.portal.utils import get_portal_preview_username, get_request_project_and_portal_settings, get_request_session



def _get_project_and_settings(request, view):
    project_uuid = getattr(view, 'kwargs', {}).get('project_uuid')
    if not project_uuid:
        return None, None
    return get_request_project_and_portal_settings(request, project_uuid)


def get_request_external_user(request, project_uuid):
    cached_project_uuid = getattr(request, '_portal_external_user_project_uuid', None)
    if cached_project_uuid == project_uuid:
        return getattr(request, 'portal_external_user', None)

    session = get_request_session(request)
    if session is None:
        return None

    ext_username = session.get('portal_external_username')
    ext_project_uuid = session.get('portal_external_project_uuid')
    external_user = None
    if ext_username and ext_project_uuid == project_uuid:
        external_user = ProjectExternalUser.objects.filter(
            project_uuid=project_uuid,
            username=ext_username,
            activated=True,
        ).first()

    request._portal_external_user_project_uuid = project_uuid
    request.portal_external_user = external_user
    return external_user


def get_request_portal_customer(request, project_uuid):
    cached_project_uuid = getattr(request, '_portal_customer_project_uuid', None)
    if cached_project_uuid == project_uuid:
        return getattr(request, 'portal_customer', None)

    external_user = getattr(request, 'portal_external_user', None)
    customer = None
    if external_user and external_user.customer_id:
        customer = PortalCustomer.objects.filter(
            id=external_user.customer_id,
            project_uuid=project_uuid,
            status=PortalCustomer.STATUS_ACTIVE,
        ).first()

    request._portal_customer_project_uuid = project_uuid
    request.portal_customer = customer
    return customer


def _is_external_member(request, project_uuid, require_customer=False):
    external_user = get_request_external_user(request, project_uuid)
    if not external_user:
        return False

    if require_customer and not get_request_portal_customer(request, project_uuid):
        return False

    if getattr(request, 'user', None):
        request.user.username = external_user.username
    return True


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


def _is_same_org_user(request, project):
    user = getattr(request, 'user', None)
    return bool(user and getattr(user, 'is_authenticated', False) and check_same_org_permission(user, project.workspace))


def can_access_portal_issue(request, project, issue):
    project_uuid = str(project.uuid)
    if _is_same_org_user(request, project) or _is_portal_preview_user(request, project_uuid):
        return True

    external_user = get_request_external_user(request, project_uuid)
    if not external_user:
        return False

    customer = get_request_portal_customer(request, project_uuid)
    if not customer:
        return False

    try:
        return int(issue.get('customer_id')) == customer.id
    except (TypeError, ValueError):
        return False


def check_portal_issue_permission(username, workspace_owner, issue=None):
    """Return edit permission for a portal issue."""
    if not username or not workspace_owner or not issue:
        return None

    if issue.get('creator') == username:
        return PERMISSION_READ_WRITE

    return check_project_permission(username, workspace_owner)


class PortalKnowledgeBasePermission(BasePermission):
    def has_permission(self, request, view):
        project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False
        project_uuid = str(project.uuid)

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False

        if _is_same_org_user(request, project):
            return True

        if not getattr(settings, 'IS_PORTAL_MODE', False):
            return False

        if _is_portal_preview_user(request, project_uuid):
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


class PortalAnonymousAccessPermission(BasePermission):
    def has_permission(self, request, view):
        project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False
        project_uuid = str(project.uuid)

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False

        if _is_same_org_user(request, project):
            return True

        if not getattr(settings, 'IS_PORTAL_MODE', False):
            return False

        if _is_portal_preview_user(request, project_uuid):
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


class PortalIssuePermission(BasePermission):
    def has_permission(self, request, view):
        project, portal_settings = _get_project_and_settings(request, view)
        if not project:
            return False
        project_uuid = str(project.uuid)

        enable_portal = portal_settings.get('enable_portal', False)
        if not enable_portal:
            return False

        if _is_same_org_user(request, project):
            return True

        if not getattr(settings, 'IS_PORTAL_MODE', False):
            return False

        if _is_portal_preview_user(request, project_uuid):
            return True

        if _is_external_member(request, project_uuid, require_customer=True):
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

        if _is_same_org_user(request, project):
            return True

        if not getattr(settings, 'IS_PORTAL_MODE', False):
            return False

        if _is_portal_preview_user(request, project_uuid):
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


class PortalAdminPermission(BasePermission):
    """Allow only project administrators to access portal admin APIs."""

    def has_permission(self, request, view):
        if not getattr(request.user, 'is_authenticated', False):
            return False

        project, _ = _get_project_and_settings(request, view)
        if not project:
            return False

        return check_project_admin_permission(request.user.username, project.workspace.owner)


class PortalUploadPermission(PortalChatPermission):
    pass


class PortalFilePermission(BasePermission):
    def has_permission(self, request, view):
        file_path = getattr(view, 'kwargs', {}).get('file_path', '') or ''

        if file_path.startswith('attachments/portal-chat/'):
            return PortalChatPermission().has_permission(request, view)

        if file_path.startswith('portal/portal-issues/'):
            return PortalIssuePermission().has_permission(request, view)

        if file_path.startswith('attachments/knowledgebase/'):
            return PortalKnowledgeBasePermission().has_permission(request, view)

        return False

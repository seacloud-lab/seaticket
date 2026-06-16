# -*- coding: utf-8 -*-
import logging
import json

from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.utils.translation import gettext as _
from django.http import HttpResponseRedirect, Http404
from django.utils import timezone

from seahub.portal.models import PortalExternalInvitation, ProjectExternalUser
from seahub.portal.visitor_session import (
    ensure_visitor_cookie,
)
from seahub.portal.utils import is_request_using_portal_custom_domain, portal_path
from seahub import settings
from seahub.project.models import Projects
from seahub.project.utils import check_project_admin_permission, check_same_org_permission
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')

logger = logging.getLogger(__name__)


def _get_portal_settings(project):
    try:
        project_settings = json.loads(project.settings) if project.settings else {}
    except Exception:
        project_settings = {}
    portal_settings = project_settings.get('portal', {})
    streaming_response = bool(project_settings.get('streaming_response', True))
    return {
        'enable_portal': bool(portal_settings.get('enable_portal', False)),
        'allow_anonymous': bool(portal_settings.get('allow_anonymous', False)),
        'enable_password_protection': bool(portal_settings.get('enable_password_protection', False)),
        'show_kb_in_portal': bool(portal_settings.get('show_knowledge_base', False)),
        'password': portal_settings.get('password'),
        'streaming_response': streaming_response,
        'portal_name': portal_settings.get('portal_name', ''),
        'portal_logo': portal_settings.get('portal_logo', ''),
    }


def _get_external_session_user(request, project_uuid):
    ext_username = request.session.get('portal_external_username')
    ext_project = request.session.get('portal_external_project_uuid')
    if not (ext_username and ext_project == project_uuid):
        return '', False
    ext_is_valid = ProjectExternalUser.objects.filter(
        project_uuid=project_uuid, username=ext_username, activated=True
    ).exists()
    return ext_username, ext_is_valid


def _get_portal_login_context(request, project, portal_settings):
    return {
        'project_uuid': str(project.uuid),
        'project_name': project.name,
        'portal_name': portal_settings.get('portal_name', ''),
        'portal_logo': portal_settings.get('portal_logo', ''),
        'media_url': MEDIA_URL,
    }


def portal_view(request, project_uuid, children_id=None, session_uuid=None, issue_id=None):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))

    portal_settings = _get_portal_settings(project)
    allow_anonymous = portal_settings['allow_anonymous']
    enable_password_protection = portal_settings['enable_password_protection']
    show_kb_in_portal = portal_settings['show_kb_in_portal']
    enable_portal = portal_settings['enable_portal']
    streaming_response = portal_settings['streaming_response']
    
    if not enable_portal:
        return render_error(request, _('Portal is not enabled'))

    ext_username, ext_is_valid = _get_external_session_user(request, project_uuid)
    is_authenticated_user = bool(getattr(request, 'user', None) and request.user.is_authenticated)

    same_org = False
    if is_authenticated_user:
        try:
            same_org = check_same_org_permission(request.user, project.workspace)
        except Exception:
            same_org = False

    has_ticket_access = ext_is_valid or same_org
    is_logged_in = is_authenticated_user or ext_is_valid
    # Treat invited users from other orgs as external portal users even when
    # they also have a normal site login in the current browser.
    is_external_user = bool(ext_is_valid and not same_org)

    if not allow_anonymous:
        if not is_logged_in or (not same_org and not ext_is_valid):
            return render(request, 'portal_login.html', _get_portal_login_context(request, project, portal_settings))

    is_anonymous = allow_anonymous and (not has_ticket_access)

    if has_ticket_access:
        if is_external_user:
            username = ext_username
        elif is_authenticated_user:
            username = request.user.username
        else:
            username = ext_username
    else:
        username = ''

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': False,
        'workspace_id': project.workspace_id,
        'is_anonymous': is_anonymous,
        'is_external_user': is_external_user,
        'username': username,
        'portal': {
            'allow_anonymous': allow_anonymous,
            'enable_password_protection': enable_password_protection,
            'show_kb_in_portal': show_kb_in_portal,
            'streaming_response': streaming_response,
            'portal_name': portal_settings.get('portal_name', ''),
            'portal_logo': portal_settings.get('portal_logo', ''),
        },
        'is_portal_custom_domain': is_request_using_portal_custom_domain(request, project_uuid),
        'portal_base_url': portal_path(request, project_uuid).rstrip('/') or '/',
    }
    if not is_logged_in or (not same_org and not ext_is_valid):
        need_password = False
        if enable_password_protection and allow_anonymous:
            encoded_password = portal_settings.get('password')
            verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
            need_password = not (verified_token and encoded_password and verified_token == encoded_password)

        if need_password:
            return redirect(portal_path(request, project_uuid, 'anonymous-validate'))

        return_dict['need_password'] = need_password

    response = render(request, 'portal_view_react.html', return_dict)
    if is_anonymous:
        response = ensure_visitor_cookie(request, response)
    return response


def portal_login_view(request, project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))
    portal_settings = _get_portal_settings(project)
    return render(request, 'portal_login.html', _get_portal_login_context(request, project, portal_settings))


def portal_external_logout_view(request, project_uuid):
    ext_username, ext_is_valid = _get_external_session_user(request, project_uuid)
    if ext_username and ext_is_valid:
        request.session.pop('portal_external_username', None)
        request.session.pop('portal_external_project_uuid', None)

    return redirect(portal_path(request, project_uuid))

def portal_anonymous_validate(request, project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))

    try:
        project_settings = json.loads(project.settings) if project.settings else {}
    except Exception:
        project_settings = {}

    portal_settings = project_settings.get('portal', {})
    allow_anonymous = bool(portal_settings.get('allow_anonymous', False))
    enable_password_protection = bool(portal_settings.get('enable_password_protection', False))
    enable_portal = bool(portal_settings.get('enable_portal', False))
    
    if not enable_portal:
        return render_error(request, _('Portal is not enabled'))

    # Only meaningful when anonymous and password protection is on
    if not (allow_anonymous and enable_password_protection):
        return redirect(portal_path(request, project_uuid))

    # Determine if password is still needed based on session token
    encoded_password = portal_settings.get('password')
    verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
    need_password = not (verified_token and encoded_password and verified_token == encoded_password)

    if request.method == 'GET':
        if not need_password:
            return redirect(portal_path(request, project_uuid))
        return_dict = {
            'version': SEAQA_VERSION,
            'project_name': project.name,
            'project_uuid': project_uuid,
            'media_url': MEDIA_URL,
            'is_edit_mode': False,
            'username': '',
            'portal': {
                'allow_anonymous': allow_anonymous,
                'enable_password_protection': enable_password_protection,
                'portal_name': portal_settings.get('portal_name', ''),
                'portal_logo': portal_settings.get('portal_logo', ''),
            },
            'need_password': True,
            'is_portal_custom_domain': is_request_using_portal_custom_domain(request, project_uuid),
            'portal_base_url': portal_path(request, project_uuid).rstrip('/') or '/',
        }
        return render(request, 'portal_view_react.html', return_dict)

    password = request.POST.get('password', '')
    if not encoded_password or not password:
        return HttpResponse(_('Password invalid'), status=400)

    from seahub.utils.hasher import AESPasswordHasher
    cryptor = AESPasswordHasher()
    if not cryptor.verify(password, encoded_password):
        return HttpResponse(_('Password invalid'), status=400)

    request.session[f'portal_verified_token_{project_uuid}'] = encoded_password
    return redirect(portal_path(request, project_uuid))


def portal_external_invitation_accept_view(request, token, project_uuid):

    invitation = PortalExternalInvitation.objects.get_by_token(token)
    if not invitation or invitation.project_uuid != project_uuid:
        return render_error(request, _('Invitation link is invalid or expired.'))
    if invitation.accepted_at:
        redirect_url = portal_path(request, project_uuid, 'login')
        return HttpResponseRedirect(redirect_url)
    if invitation.is_expired():
        return render_error(request, _('Invitation link is invalid or expired.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        raise Http404

    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=['accepted_at'])

    try:
        ext_user = ProjectExternalUser.objects.filter(email=invitation.email, project_uuid=project_uuid).first()
        if ext_user and not getattr(ext_user, 'activated', False):
            ext_user.activated = True
            ext_user.save(update_fields=['activated'])
    except Exception:
        ext_user = None

    if ext_user and getattr(ext_user, 'username', None):
        request.session['portal_external_username'] = ext_user.username
        request.session['portal_external_project_uuid'] = project_uuid
        redirect_url = portal_path(request, project_uuid)
    else:
        redirect_url = portal_path(request, project_uuid, 'login')

    return HttpResponseRedirect(redirect_url)


@login_required
def portal_edit_view(request, project_uuid, page=None, children_id=None, session_uuid=None):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))

    # permission check - only admins can access edit mode
    username = request.user.username
    workspace = project.workspace
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied'))

    project_settings = {}
    if project.settings:
        try:
            project_settings = json.loads(project.settings)
        except Exception:
            project_settings = {}
    
    portal_settings = project_settings.get('portal', {})
    streaming_response = bool(project_settings.get('streaming_response', True))
    show_kb_in_portal = bool(portal_settings.get('show_knowledge_base', False))
    allow_anonymous = bool(portal_settings.get('allow_anonymous', False))
    enable_password_protection = bool(portal_settings.get('enable_password_protection', False))
    enable_portal = bool(portal_settings.get('enable_portal', False))
    
    if not enable_portal:
        return render_error(request, _('Portal is not enabled'))

    if allow_anonymous and enable_password_protection:
        encoded_password = portal_settings.get('password')
        if encoded_password:
            request.session[f'portal_verified_token_{project_uuid}'] = encoded_password

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': True,
        'workspace_id': project.workspace_id,
        'username': request.user.username,
        'is_external_user': False,
        'portal': {
            'show_kb_in_portal': show_kb_in_portal,
            'streaming_response': streaming_response,
            'portal_name': portal_settings.get('portal_name', ''),
            'portal_logo': portal_settings.get('portal_logo', ''),
        },
        'is_portal_custom_domain': False,
        'portal_base_url': portal_path(request, project_uuid, is_edit_mode=True).rstrip('/'),
    }
    return render(request, 'portal_view_react.html', return_dict)

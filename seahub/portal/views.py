# -*- coding: utf-8 -*-
import logging
import json

from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.utils.translation import gettext as _
from django.http import HttpResponseRedirect, Http404
from django.utils import timezone

from seahub.portal.models import PortalExternalInvitation, ProjectExternalUser
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
    return {
        'allow_anonymous': bool(portal_settings.get('allow_anonymous', False)),
        'enable_password_protection': bool(portal_settings.get('enable_password_protection', False)),
        'show_kb_in_portal': bool(portal_settings.get('show_knowledge_base', False)),
        'password': portal_settings.get('password'),
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


def portal_view(request, project_uuid, page=None):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))

    portal_settings = _get_portal_settings(project)
    allow_anonymous = portal_settings['allow_anonymous']
    enable_password_protection = portal_settings['enable_password_protection']
    show_kb_in_portal = portal_settings['show_kb_in_portal']

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
    is_external_user = bool(ext_is_valid and (not is_authenticated_user))

    if not allow_anonymous:
        if not is_logged_in:
            return render(request, 'portal_login.html', {
                'project_uuid': project_uuid,
                'project_name': project.name,
                'media_url': MEDIA_URL,
            })
        if not has_ticket_access:
            return render_error(request, _('Permission denied'))

    is_anonymous = allow_anonymous and (not has_ticket_access)

    if has_ticket_access:
        username = request.user.username if is_authenticated_user else ext_username
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
        'username': username,
        'is_external_user': is_external_user,
        'portal': {
            'allow_anonymous': allow_anonymous,
            'enable_password_protection': enable_password_protection,
            'show_kb_in_portal': show_kb_in_portal,
        }
    }

    need_password = False
    if enable_password_protection and allow_anonymous:
        encoded_password = portal_settings.get('password')
        verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
        need_password = not (verified_token and encoded_password and verified_token == encoded_password)

    if need_password:
        return redirect(f"/portal/{project_uuid}/anonymous-validate/")

    return_dict['need_password'] = need_password
    return render(request, 'portal_view_react.html', return_dict)


def portal_login_view(request, project_uuid):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))
    return render(request, 'portal_login.html', {
        'project_uuid': project_uuid,
        'project_name': project.name,
        'media_url': MEDIA_URL,
    })


def portal_external_logout_view(request, project_uuid):
    if getattr(request, 'user', None) and request.user.is_authenticated:
        return redirect(f"/portal/{project_uuid}/")

    ext_username, ext_is_valid = _get_external_session_user(request, project_uuid)
    if ext_username and ext_is_valid:
        request.session.pop('portal_external_username', None)
        request.session.pop('portal_external_project_uuid', None)

    return redirect(f"/portal/{project_uuid}/")

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

    # Only meaningful when anonymous and password protection is on
    if not (allow_anonymous and enable_password_protection):
        return redirect(f"/portal/{project_uuid}/")

    # Determine if password is still needed based on session token
    encoded_password = portal_settings.get('password')
    verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
    need_password = not (verified_token and encoded_password and verified_token == encoded_password)

    if request.method == 'GET':
        if not need_password:
            return redirect(f"/portal/{project_uuid}/")
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
            },
            'need_password': True,
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
    return redirect(f"/portal/{project_uuid}/")


def portal_external_invitation_accept_view(request, token, project_uuid):

    invitation = PortalExternalInvitation.objects.get_by_token(token)
    if not invitation or invitation.project_uuid != project_uuid:
        return render_error(request, _('Invitation link is invalid or expired.'))
    if invitation.accepted_at:
        redirect_url = f"{request.scheme}://{request.get_host()}/portal/{project_uuid}/login/"
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
        redirect_url = f"{request.scheme}://{request.get_host()}/portal/{project_uuid}/"
    else:
        redirect_url = f"{request.scheme}://{request.get_host()}/portal/{project_uuid}/login/"

    return HttpResponseRedirect(redirect_url)


@login_required
def portal_edit_view(request, project_uuid, page=None):
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
    show_kb_in_portal = bool(portal_settings.get('show_knowledge_base', False))
    allow_anonymous = bool(portal_settings.get('allow_anonymous', False))
    enable_password_protection = bool(portal_settings.get('enable_password_protection', False))

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
        },
    }
    return render(request, 'portal_view_react.html', return_dict)

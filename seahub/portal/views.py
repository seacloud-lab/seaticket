# -*- coding: utf-8 -*-
import logging
import json

from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.utils.translation import gettext as _

from seahub import settings
from seahub.project.models import Projects
from seahub.project.utils import check_project_admin_permission, check_same_org_permission
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL, LOGIN_URL

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')

logger = logging.getLogger(__name__)


def portal_view(request, project_uuid, page=None):
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
    show_kb_in_portal = bool(portal_settings.get('show_knowledge_base', False))

    if not allow_anonymous:
        if not request.user.is_authenticated:
            return redirect(f"{LOGIN_URL}?next={request.get_full_path()}")
        workspace = project.workspace
        if not check_same_org_permission(request.user, workspace):
            return render_error(request, _('Permission denied'))


    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': False,
        'workspace_id': project.workspace_id,
        'is_anonymous': not request.user.is_authenticated,
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

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': True,
        'workspace_id': project.workspace_id,
        'portal': {
            'show_kb_in_portal': show_kb_in_portal,
        },
    }
    return render(request, 'portal_view_react.html', return_dict)

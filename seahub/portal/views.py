# -*- coding: utf-8 -*-
import logging

from django.shortcuts import render
from django.utils.translation import gettext as _

from seahub import settings
from seahub.project.models import Projects
from seahub.project.utils import check_project_admin_permission, check_same_org_permission
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')

logger = logging.getLogger(__name__)


@login_required
def portal_view(request, project_uuid, page=None):
    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))

    workspace = project.workspace
    if not check_same_org_permission(request.user, workspace):
        return render_error(request, _('Permission denied'))

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': False,
    }
    return render(request, 'portal_view_react.html', return_dict)


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

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': True,
    }
    return render(request, 'portal_view_react.html', return_dict)

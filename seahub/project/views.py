# -*- coding: utf-8 -*-
import logging
import json

from django.shortcuts import render
from django.utils.translation import gettext as _

from seahub import settings
from seahub.project.models import Workspaces, Projects
from seahub.project.utils import check_project_admin_permission, check_project_permission
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL, LLM_MODELS
from seahub.group.models import Group
from seahub.constants import PERMISSION_READ

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


@login_required
def project_view(request, workspace_id, project_name, children_id = '', record_id = ''):
    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    group_id = ''
    if '@seafile_group' in workspace.owner:
        group_id = workspace.owner.split('@')[0]
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = f'Group {group_id} not found.'
            return render_error(request, error_msg)

    project = Projects.objects.get_project(workspace, project_name)
    if not project:
        return render_error(request, _('This project does not exist'))

    icon = {
        'bg_color': project.color,
        'text_color': project.text_color,
        'name': project.icon
    }

    try:
        project_settings = getattr(project, 'settings', '{}') or '{}'
    except:
        project_settings = '{}'

    is_project_admin = check_project_admin_permission(request.user.username, workspace.owner)
    permission = check_project_permission(request.user.username, workspace.owner)
    if not permission:
        return render_error(request, _('Permission denied'))

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project_name,
        'workspace_id': workspace_id,
        'project_uuid': str(project.uuid),
        'current_group_id': int(group_id) if project.is_owned_by_group else None,
        'is_owned_by_group': project.is_owned_by_group,
        'media_url': MEDIA_URL,
        'icon': json.dumps(icon),
        'settings': project_settings,
        'is_project_admin': is_project_admin,
        'permission': permission if permission else PERMISSION_READ,
        'llm_models': json.dumps(LLM_MODELS),
    }
    return render(request, 'project_view_react.html', return_dict)


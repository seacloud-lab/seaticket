# -*- coding: utf-8 -*-
import logging

from django.shortcuts import render
from django.utils.translation import gettext as _

from seahub import settings
from seahub.project.models import Workspaces, Projects
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL
from seahub.group.models import Group

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


@login_required
def project_view(request, workspace_id, name):
    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    group_id = ''
    if '@seafile_group' in workspace.owner:
        group_id = workspace.owner.split('@')[0]
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = 'Group %s not found.' % group_id
            return render_error(request, error_msg)

    project = Projects.objects.get_project(workspace, name)
    if not project:
        return render_error(request, _('This project does not exist'))

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': name,
        'workspace_id': workspace_id,
        'project_uuid': str(project.uuid),
        'current_group_id': int(group_id) if project.is_owned_by_group else None,
        'is_owned_by_group': project.is_owned_by_group,
        'media_url': MEDIA_URL,
    }

    return render(request, 'project_view_react.html', return_dict)

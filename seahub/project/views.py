# -*- coding: utf-8 -*-
import logging
import json

from django.shortcuts import render
from django.utils.translation import gettext as _

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.project.models import Workspaces, Projects, ProjectConnections
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL
from seahub.group.models import Group
from seahub.project.utils import check_project_admin_permission, add_init_crawl_site_task
from seahub.project.constants import ConnectionType

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


@login_required
def project_view(request, workspace_id, project_name):
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

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project_name,
        'workspace_id': workspace_id,
        'project_uuid': str(project.uuid),
        'current_group_id': int(group_id) if project.is_owned_by_group else None,
        'is_owned_by_group': project.is_owned_by_group,
        'media_url': MEDIA_URL,
        'icon': json.dumps(icon)
    }

    return render(request, 'project_view_react.html', return_dict)


class ProjectConnectionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, project_name, connection_type):
        """get project connection records
        """

         # role permission check
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        start = (current_page - 1) * per_page
        end = start + per_page

        # resources check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.get_project(workspace, project_name)
        if not project:
            error_msg = f'Project {project_name} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not ConnectionType.is_valid(connection_type):
            error_msg = f'Type {connection_type} not support.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            

        records = ProjectConnections.objects.filter(project=project, type=connection_type)[start:end]
        records = [record.to_dict() for record in records]

        return Response({'records': records}, status=status.HTTP_200_OK)

    def post(self, request, workspace_id, project_name, connection_type):
        """modify project connection
        """

        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.POST.get('name', '')
        if not name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        value = request.POST.get('value')
        if not value:
            error_msg = 'value invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resources check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project = Projects.objects.get_project(workspace, project_name)
        if not project:
            error_msg = f'Project {project_name} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not ConnectionType.is_valid(connection_type):
            error_msg = f'Type {connection_type} not support.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        enable_create = ProjectConnections.objects.enable_create(project, connection_type, name, value)
        if not enable_create:
            error_msg = 'Name or config is not unique'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            record = ProjectConnections.objects.create(request.user.username, project, connection_type, name, value)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if connection_type == ConnectionType.SITE:
            params = {
                'site_id': record.get('id', '')
            }
            add_init_crawl_site_task(params)

        return Response({'record': record}, status=status.HTTP_201_CREATED)


class ProjectConnectionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, workspace_id, project_name, connection_type, connection_id):
        """ modify connection
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.data.get('name')
        if not name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        value = request.data.get('value', {})
        if not value:
            error_msg = 'value invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project = Projects.objects.get_project(workspace, project_name)
        if not project:
            error_msg = f'Project {project_name} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not ConnectionType.is_valid(connection_type):
            error_msg = f'Type {connection_type} not support.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        enable_modify = ProjectConnections.objects.enable_modify(project, connection_type, connection_id, name, value)
        if not enable_modify:
            error_msg = 'Please check input'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            record = ProjectConnections.objects.modify(username, project, connection_type, connection_id, name, value);
        except Exception as e:
            logger.error('modify %s: %s error: %s' % connection_type, connection_id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'record': record.to_dict()}, status=status.HTTP_200_OK)

    def delete(self, request, workspace_id, project_name, connection_type, connection_id):
        """delete connection
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project = Projects.objects.get_project(workspace, project_name)
        if not project:
            error_msg = f'Project {project_name} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not ConnectionType.is_valid(connection_type):
            error_msg = f'Type {connection_type} not support.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            ProjectConnections.objects.filter(project=project, type=connection_type, id=connection_id).delete()
        except Exception as e:
            logger.error('delete %s: %s error: %s', connection_type, connection_id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


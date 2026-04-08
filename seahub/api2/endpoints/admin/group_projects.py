import logging
from datetime import datetime

from django.utils.translation import gettext as _
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.project.models import Workspaces, Projects, ProjectAPIToken
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import BASE_DELETE
from seahub.group.models import Group
from seahub.project.utils import convert_project_trash_names
from seahub.organizations.models import Organization
from seahub.api2.endpoints.admin.projects import get_project_info


logger = logging.getLogger(__name__)


class AdminGroupProjects(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, group_id):
        """
        get workspace by group id
        get projects from workspace
        :param request:
        :param group_id:
        :return:
        """
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = _('Group not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        project_list = []
        projects = Projects.objects.filter(workspace=workspace, deleted=False)

        for project in projects:
            project_info = get_project_info(project)
            project_list.append(project_info)
        return Response({
            'projects': project_list,
            'group_name': group.group_name,
        })


class AdminGroupProject(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, group_id, project_uuid):
        """
        delete a project from a group
        :param request:
        :param group_id:
        :param project_uuid:
        :return:
        """
        group_id = int(group_id)
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = _('Group not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        owner = '%s@seafile_group' % (group_id,)
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            error_msg = _('Workspace not found')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.filter(workspace=workspace, uuid=project_uuid).first()
        if not project:
            error_msg = _('Project not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username

        new_project_name = convert_project_trash_names(project)
        try:
            Projects.objects.filter(id=project.id).update(deleted=True, delete_time=timezone.now(), name=new_project_name)
            ProjectAPIToken.objects.filter(project=project).delete()
        except Exception as e:
            logger.error('delete project: %s error: %s', project.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # send admin operation log signal
        admin_op_detail = {
            'name': project.name,
            'project_uuid': str(project.uuid),
            'group_id': group_id,
            'group_name': group.group_name
        }

        if workspace.org_id != -1:
            org = Organization.objects.get_org_by_id(workspace.org_id)
            if org:
                admin_op_detail['org_name'] = org.org_name
                admin_op_detail['org_id'] = org.org_id

        admin_operation.send(sender=None, admin_name=username,
                operation=BASE_DELETE, detail=admin_op_detail)

        return Response({'success': True}, status=status.HTTP_200_OK)

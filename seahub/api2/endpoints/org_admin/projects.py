import uuid
import logging

from django.utils import timezone

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsProVersion, IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects, Workspaces, DeletedProjects
from seahub.project.utils import get_project_owner, convert_project_trash_names, restore_trash_project_name
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import BASE_DELETE, BASE_RESTORE
from seahub.organizations.models import Organization
from seahub.group.models import Group

logger = logging.getLogger(__name__)
FILE_TYPE = '.project'
GROUP_DOMAIN = '@seafile_group'


def get_project_info(project, include_deleted=False):
    dtable_info = project.to_dict(include_deleted=include_deleted)
    dtable_info['org_id'] = project.workspace.org_id
    dtable_info['email'] = project.workspace.owner
    dtable_info['group_id'] = project.get_owner_group_id()
    owner_name, owner_deleted = get_project_owner(project)
    dtable_info['owner'] = owner_name
    dtable_info['owner_deleted'] = owner_deleted
    return dtable_info


def _check_org(org_id):
    org_id = int(org_id)
    org = Organization.objects.get_org_by_id(org_id)  # todo: wrong
    if not org:
        error_msg = 'Organization %s not found.' % org_id
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None
    return None, org


class OrgAdminProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def get(self, request, org_id):
        # resource check
        error, _ = _check_org(org_id)
        if error:
            return error

        try:
            page = int(request.GET.get('page', 1))
            page = page if page > 0 else 1
            per_page = int(request.GET.get('per_page', 25))
        except:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page

        try:
            project_count = Projects.objects.filter(deleted=False, workspace__org_id=org_id).count()
            projects_queryset = Projects.objects.filter(deleted=False, workspace__org_id=org_id).select_related('workspace')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        project_list = [get_project_info(d) for d in projects_queryset]

        return Response({
            'project_list': project_list,
            'count': project_count
        })


class OrgAdminProjectView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def delete(self, request, org_id, project_id):
        error, _ = _check_org(org_id)
        if error:
            return error
        # resource check
        project = Projects.objects.filter(id=project_id, deleted=False, workspace__org_id=org_id).select_related('workspace').first()
        if not project:
            error_msg = 'project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_project_name = convert_project_trash_names(project)
        try:
            Projects.objects.filter(id=project.id).update(deleted=True, delete_time=timezone.now(), name=new_project_name)
        except Exception as e:
            logger.error('delete project: %s error: %s', project.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        detail = {
            'name': project.name,
            'project_uuid': str(project.uuid)
        }
        if GROUP_DOMAIN in project.workspace.owner:
            group_id = int(project.workspace.owner.split('@')[0])
            group = Group.objects.get_group(group_id)
            if group:
                detail['group_id'] = group_id
                detail['group_name'] = group.group_name

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=BASE_DELETE, detail=detail, org_id=org_id)

        return Response({'success': True})


class OrgAdminTrashProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def _delete_project(self, project):
        try:
            DeletedProjects(project_uuid=project.uuid).save()
            Projects.objects.delete_project(project.workspace, project.name)
        except Exception as e:
            logger.error('delete project: %s error: %s', str(project.uuid), e)

    def get(self, request, org_id):
        error, _ = _check_org(org_id)
        if error:
            return error

        try:
            page = int(request.GET.get('page', 1))
            page = page if page > 0 else 1
            per_page = int(request.GET.get('per_page', 25))
        except Exception as e:
            logger.error(e)
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page

        try:
            projects_count = Projects.objects.filter(deleted=True, workspace__org_id=org_id).count()
            projects_queryset = Projects.objects.filter(deleted=True, workspace__org_id=org_id).select_related('workspace')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'project_list': [get_project_info(d, include_deleted=True) for d in projects_queryset],
            'count': projects_count
        })

    def delete(self, request, org_id):
        error, _ = _check_org(org_id)
        if error:
            return error

        try:
            projects = Projects.objects.filter(deleted=True, workspace__org_id=org_id).select_related('workspace')
            for project in projects:
                self._delete_project(project)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'success': True
        })


class OrgAdminTrashProjectView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsProVersion, IsOrgAdminUser)

    def _delete_project(self, project):
        try:
            Projects.objects.delete_dtable(project.workspace, project.name)
        except Exception as e:
            logger.error('delete project: %s error: %s', str(project.uuid), e)


    def put(self, request, org_id, project_id):
        error, _ = _check_org(org_id)
        if error:
            return api_error

        # resource check
        project = Projects.objects.filter(id=project_id, deleted=True, workspace__org_id=org_id).first()
        if not project:
            error_msg = 'project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_name = restore_trash_project_name(project)

        try:
            Projects.objects.filter(id=project.id).update(deleted=False, delete_time=None, name=new_name)
        except Exception as e:
            logger.error('recover project: %s name: %s error: %s', project.id, project.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        detail = {
            'name': project.name,
            'project_uuid': str(project.uuid)
        }
        if GROUP_DOMAIN in project.workspace.owner:
            group_id = int(project.workspace.owner.split('@')[0])
            group = Group.objects.get_group(group_id)
            if group:
                detail['group_id'] = group_id
                detail['group_name'] = group.group_name

        org_admin_operation.send(sender=None, admin_name=request.user.username, operation=BASE_RESTORE, detail=detail, org_id=org_id)

        return Response({'success': True})


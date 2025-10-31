import logging
from datetime import datetime

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects, ProjectAPIToken
from seahub.project.utils import get_project_owner, convert_project_trash_names, \
    restore_trash_project_name, delete_project
from seahub.organizations.models import Organization
from seahub.admin_log.models import BASE_DELETE, BASE_RESTORE
from seahub.admin_log.signals import admin_operation

logger = logging.getLogger(__name__)


def get_project_info(project, include_deleted=False, orgs_dict={}):
    project_info = project.to_dict(include_deleted=include_deleted)
    project_info['org_id'] = project.workspace.org_id
    project_info['org_name'] = orgs_dict.get(
        project.workspace.org_id, {}).get('org_name')
    project_info['email'] = project.workspace.owner
    project_info['group_id'] = project.get_owner_group_id()
    owner_name, owner_deleted = get_project_owner(project)
    project_info['owner'] = owner_name
    project_info['owner_deleted'] = owner_deleted
    return project_info


class AdminProjects(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, format=None):
        """ List projects
        """
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        start = (current_page - 1) * per_page
        end = start + per_page

        try:
            projects_count = Projects.objects.filter(deleted=False).count()
            projects_queryset = Projects.objects.filter(
                deleted=False).select_related('workspace')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if projects_count > end:
            has_next_page = True
        else:
            has_next_page = False

        page_info = {
            'has_next_page': has_next_page,
            'current_page': current_page
        }

        orgs = Organization.objects.filter(
            org_id__in=[project.workspace.org_id for project in projects_queryset])
        orgs_dict = {org.org_id: org.to_dict() for org in orgs}

        return_results = list()
        for project in projects_queryset:
            return_results.append(get_project_info(
                project, include_deleted=False, orgs_dict=orgs_dict))

        return Response({"page_info": page_info, "projects": return_results})


class AdminProject(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, )
    throttle_classes = (UserRateThrottle, )

    def delete(self, request, project_uuid):
        """delete a project
        """
        # argument check
        username = request.user.username
        if not request.user.admin_permissions.can_manage_project():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        project = Projects.objects.get_project_by_uuid(
            project_uuid, include_deleted=False)
        if not project:
            return Response({'success': True}, status=status.HTTP_200_OK)

        # resource check
        workspace = project.workspace
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_project_name = convert_project_trash_names(project)

        try:
            Projects.objects.filter(id=project.id).update(
                deleted=True, delete_time=datetime.now(), name=new_project_name)
            ProjectAPIToken.objects.filter(project=project).delete()
        except Exception as e:
            logger.error('delete project: %s error: %s', project.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # send admin operation log signal
        admin_op_detail = {
            'name': project.name,
            'project_uuid': str(project.uuid)
        }
        #admin_operation.send(sender=None, admin_name=request.user.username,
        #                     operation=BASE_DELETE, detail=admin_op_detail)

        return Response({'success': True}, status=status.HTTP_200_OK)


class AdminTrashProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        # argument check
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
        except Exception as e:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start, end = (page - 1) * per_page, page * per_page
        try:
            projects_count = Projects.objects.filter(deleted=True).count()
            projects_queryset = Projects.objects.filter(deleted=True).select_related(
                'workspace').order_by('-delete_time')[start: end]
        except Exception as e:
            logger.error('get deleted projects error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        orgs = Organization.objects.filter(
            org_id__in=[project.workspace.org_id for project in projects_queryset])
        orgs_dict = {org.org_id: org.to_dict() for org in orgs}
        results = [get_project_info(project, include_deleted=True, orgs_dict=orgs_dict)
                   for project in projects_queryset]

        return Response({'count': projects_count, 'projects': results})

    def delete(self, request):
        try:
            projects = Projects.objects.filter(deleted=True).select_related('workspace')
            for project in projects:
                delete_project(project)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'success': True
        })


class AdminTrashProjectView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def put(self, request, project_id):
        # resource check
        project = Projects.objects.filter(id=project_id, deleted=True).first()
        if not project:
            error_msg = 'project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_name = restore_trash_project_name(project)

        try:
            Projects.objects.filter(id=project.id).update(
                deleted=False, delete_time=None, name=new_name)
        except Exception as e:
            logger.error('recover project: %s name: %s error: %s',
                         project.id, project.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        detail = {
            'name': project.name,
            'project_uuid': str(project.uuid)
        }
        #admin_operation.send(
        #    sender=None, admin_name=request.user.username, operation=BASE_RESTORE, detail=detail)

        return Response({'success': True})


class AdminSearchProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        # argument check
        query_str = request.GET.get('query', '').strip()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
        except Exception as e:
            error_msg = 'per_page or page invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        start = (page - 1) * per_page
        end = page * per_page

        try:
            projects_count = Projects.objects.search_projects_count(query_str)
            projects_queryset = Projects.objects.search_projects(query_str, start, end)
        except Exception as e:
            logger.error('get search projects error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'projects': [get_project_info(project, include_deleted=False) for project in projects_queryset],
            'count': projects_count
        })


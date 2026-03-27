import logging

from django.utils import timezone

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import IsOrgAdminUser
from seahub.api2.throttling import UserRateThrottle, OrgAdminRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects, ProjectAPIToken
from seahub.project.utils import get_project_owner, convert_project_trash_names, \
    restore_trash_project_name, delete_project
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import BASE_DELETE, BASE_RESTORE
from seahub.organizations.models import Organization
from seahub.group.models import Group

from seahub.project.models import ProjectIssuesStatistics

logger = logging.getLogger(__name__)
FILE_TYPE = '.project'
GROUP_DOMAIN = '@seafile_group'


def _check_org(org_id):
    org_id = int(org_id)
    org = Organization.objects.get_org_by_id(org_id)  # todo: wrong
    if not org:
        error_msg = 'Organization %s not found.' % org_id
        return api_error(status.HTTP_404_NOT_FOUND, error_msg), None
    return None, org

def _get_project_info(project, include_deleted=False, orgs_dict={}, issues_stats_dict=None):
    project_info = project.to_dict(include_deleted=include_deleted)
    project_info['org_id'] = project.workspace.org_id
    project_info['org_name'] = orgs_dict.get(
        project.workspace.org_id, {}).get('org_name')
    project_info['email'] = project.workspace.owner
    project_info['group_id'] = project.get_owner_group_id()
    owner_name, owner_deleted = get_project_owner(project)
    project_info['owner'] = owner_name
    project_info['owner_deleted'] = owner_deleted
    if issues_stats_dict is not None:
        project_info['issues_count'] = issues_stats_dict.get(str(project.uuid), 0)
    return project_info



class OrgAdminProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsOrgAdminUser,)

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

        project_uuids = [str(d.uuid) for d in projects_queryset]
        stats = ProjectIssuesStatistics.objects.filter(project_uuid__in=project_uuids)
        issues_stats_dict = {str(s.project_uuid): s.total_issues_count for s in stats}
        projects = [_get_project_info(d, issues_stats_dict=issues_stats_dict) for d in projects_queryset]

        return Response({
            'projects': projects,
            'count': project_count
        })


class OrgAdminProjectView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdminUser,)

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
            ProjectAPIToken.objects.filter(project=project).delete()
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
    permission_classes = (IsOrgAdminUser,)

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
        project_uuids = [str(p.uuid) for p in projects_queryset]
        stats = ProjectIssuesStatistics.objects.filter(project_uuid__in=project_uuids)
        issues_stats_dict = {str(s.project_uuid): s.total_issues_count for s in stats}

        return Response({
            'projects': [_get_project_info(d, include_deleted=True, issues_stats_dict=issues_stats_dict) for d in projects_queryset],
            'count': projects_count
        })

    def delete(self, request, org_id):
        error, _ = _check_org(org_id)
        if error:
            return error

        try:
            projects = Projects.objects.filter(deleted=True, workspace__org_id=org_id).select_related('workspace')
            for project in projects:
                delete_project(project)
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
    permission_classes = (IsOrgAdminUser,)

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


class OrgAdminSearchProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, OrgAdminRateThrottle)
    permission_classes = (IsOrgAdminUser,)

    def get(self, request, org_id):
        error, _ = _check_org(org_id)
        if error:
            return error

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
            projects_count = Projects.objects.search_project_count_in_org(org_id, query_str)
            projects_queryset = Projects.objects.search_project_in_org(org_id, query_str, start, end)
        except Exception as e:
            logger.error('get search projects error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        project_uuids = [str(p.uuid) for p in projects_queryset]
        stats = ProjectIssuesStatistics.objects.filter(project_uuid__in=project_uuids)
        issues_stats_dict = {str(s.project_uuid): s.total_issues_count for s in stats}

        return Response({
            'projects': [_get_project_info(project, include_deleted=False, issues_stats_dict=issues_stats_dict) for project in projects_queryset],
            'count': projects_count
        })


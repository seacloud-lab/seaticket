# -*- coding: utf-8 -*-
import logging
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils.decorators import require_org_context
from seahub.project.models import Projects, ProjectGithubAppInstallation, ProjectLinearOauth, ProjectConfluenceOauth
from seahub.project.confluence_api import ConfluenceAPI
from seahub.project.linear_api import LinearAPI
from seahub.project.utils import check_project_permission, check_project_admin_permission, get_project_related_users, \
    query_items, check_project_admin_permission
from seahub.project.constants import ITEMS_SEARCH_QUERY_TYPES_SUPPORT
from seahub.project.github_issues_api import GitHubAPI


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)




class ProjectRelatedUsersView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        # argument check
        # name
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            user_list = get_project_related_users(workspace.owner)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"user_list": user_list})

class ProjectItemsSearchView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        query_str = request.GET.get('query_str', '')
        query_type = request.GET.get('query_type', '')
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if query_type not in ITEMS_SEARCH_QUERY_TYPES_SUPPORT:
            error_msg = 'query type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            results = query_items(request, query_str, query_type)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'results': results})


class ProjectGithubRepositories(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_installations = ProjectGithubAppInstallation.objects.get_installations_by_project_uuid(project_uuid)
        if not project_installations:
            return Response({'repositories': []})

        all_repositories = []

        for installation in project_installations:
            installation_id = installation.installation_id
            try:
                github_api = GitHubAPI(installation_id)
                repositories = github_api.get_installation_repositories()
            except Exception as e:
                logger.warning('get repositories from installation_id %s failed, error: %s', installation_id, e)
                repositories = []

            for repository in repositories:
                repository['installation_id'] = installation_id

            all_repositories.extend(repositories)

        return Response({
            'repositories': all_repositories,
        })


class ProjectLinearTeams(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        linear_oauth = ProjectLinearOauth.objects.get_by_project_uuid(project_uuid)
        if not linear_oauth:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Linear OAuth authorization is required.')

        linear_api = LinearAPI(
            access_token=linear_oauth.access_token,
            refresh_token=linear_oauth.refresh_token
        )

        try:
            teams, workspace_name = linear_api.list_teams()
        except Exception as e:
            logger.error('Linear API error fetching teams for project %s: %s', project_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch Linear teams.')

        if workspace_name:
            for team in teams:
                team['workspace_name'] = workspace_name
        return Response({'teams': teams})


class ProjectConfluenceWorkspaces(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        confluence_oauth = ProjectConfluenceOauth.objects.get_by_project_uuid(project_uuid)
        if not confluence_oauth:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Confluence OAuth authorization is required.')

        confluence_api = ConfluenceAPI(
            access_token=confluence_oauth.access_token,
            refresh_token=confluence_oauth.refresh_token,
            expires_at=confluence_oauth.expires_at,
        )

        try:
            resources = confluence_api.list_accessible_resources()
        except Exception as e:
            logger.error('Confluence API error fetching workspaces for project %s: %s', project_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch Confluence workspaces.')

        if confluence_api.access_token != confluence_oauth.access_token:
            ProjectConfluenceOauth.objects.upsert_token(
                project_uuid, confluence_api.access_token, confluence_api.expires_at, confluence_api.refresh_token
            )
        workspaces = []
        for resource in resources:
            scopes = resource.get('scopes') or []
            if not any('confluence' in str(scope).lower() for scope in scopes):
                continue
            workspace_id = resource.get('id')
            workspace_name = resource.get('name')
            workspace_url = resource.get('url')
            if not workspace_id or not workspace_name or not workspace_url:
                continue
            workspaces.append({
                'id': workspace_id,
                'name': workspace_name,
                'url': workspace_url,
            })

        workspaces.sort(key=lambda item: item['name'].lower())
        return Response({'workspaces': workspaces})


class ProjectConfluenceSpaces(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        workspace_id = request.GET.get('workspace_id', '')
        workspace_url = request.GET.get('workspace_url', '')
        if not workspace_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'workspace_id is required.')
        if not workspace_url:
            return api_error(status.HTTP_400_BAD_REQUEST, 'workspace_url is required.')

        confluence_oauth = ProjectConfluenceOauth.objects.get_by_project_uuid(project_uuid)
        if not confluence_oauth:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Confluence OAuth authorization is required.')

        confluence_api = ConfluenceAPI(
            access_token=confluence_oauth.access_token,
            refresh_token=confluence_oauth.refresh_token,
            expires_at=confluence_oauth.expires_at,
        )

        try:
            all_spaces = confluence_api.list_spaces(workspace_id)
        except Exception as e:
            logger.error('Confluence API error fetching spaces for project %s workspace %s: %s', project_uuid, workspace_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch Confluence spaces.')

        if confluence_api.access_token != confluence_oauth.access_token:
            ProjectConfluenceOauth.objects.upsert_token(
                project_uuid, confluence_api.access_token, confluence_api.expires_at, confluence_api.refresh_token
            )

        all_spaces.sort(key=lambda item: item['name'].lower())
        return Response({'spaces': all_spaces})

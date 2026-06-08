# -*- coding: utf-8 -*-
import datetime
import logging
from urllib.parse import parse_qs, urlparse

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
from seahub.project.linear_api import LinearAPI
from seahub.project.utils import check_project_permission, check_project_admin_permission, get_project_related_users, \
    query_items, check_project_admin_permission
from seahub.project.constants import ITEMS_SEARCH_QUERY_TYPES_SUPPORT
from seahub.project.github_issues_api import GitHubAPI


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


def _refresh_confluence_access_token(confluence_oauth):
    client_id = getattr(settings, 'CONFLUENCE_CLIENT_ID', '')
    client_secret = getattr(settings, 'CONFLUENCE_CLIENT_SECRET', '')
    if not client_id or not client_secret or not confluence_oauth.refresh_token:
        raise RuntimeError('Confluence OAuth settings are invalid.')

    payload = {
        'grant_type': 'refresh_token',
        'client_id': client_id,
        'client_secret': client_secret,
        'refresh_token': confluence_oauth.refresh_token,
    }
    response = requests.post('https://auth.atlassian.com/oauth/token', json=payload, timeout=10)
    response.raise_for_status()
    token_json = response.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token') or confluence_oauth.refresh_token
    if not access_token:
        raise RuntimeError('Confluence OAuth response missing access token.')

    expires_in = token_json.get('expires_in') or 3600
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=max(int(expires_in) - 60, 0))
    return ProjectConfluenceOauth.objects.upsert_token(
        confluence_oauth.project_uuid,
        access_token,
        expires_at,
        refresh_token,
    )


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

        if not confluence_oauth.expires_at or confluence_oauth.expires_at <= datetime.datetime.now(datetime.timezone.utc):
            try:
                confluence_oauth = _refresh_confluence_access_token(confluence_oauth)
            except Exception as e:
                logger.error('Failed to refresh Confluence OAuth token for project %s: %s', project_uuid, e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to refresh Confluence authorization.')

        try:
            response = requests.get(
                'https://api.atlassian.com/oauth/token/accessible-resources',
                headers={'Authorization': f'Bearer {confluence_oauth.access_token}'},
                timeout=10,
            )
            if response.status_code == 401:
                confluence_oauth = _refresh_confluence_access_token(confluence_oauth)
                response = requests.get(
                    'https://api.atlassian.com/oauth/token/accessible-resources',
                    headers={'Authorization': f'Bearer {confluence_oauth.access_token}'},
                    timeout=10,
                )
            response.raise_for_status()
        except Exception as e:
            logger.error('Confluence API error fetching workspaces for project %s: %s', project_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch Confluence workspaces.')

        resources = response.json() or []
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

        if not confluence_oauth.expires_at or confluence_oauth.expires_at <= datetime.datetime.now(datetime.timezone.utc):
            try:
                confluence_oauth = _refresh_confluence_access_token(confluence_oauth)
            except Exception as e:
                logger.error('Failed to refresh Confluence OAuth token for project %s: %s', project_uuid, e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to refresh Confluence authorization.')

        all_spaces = []
        cursor = None
        limit = 100
        try:
            while True:
                url = f'https://api.atlassian.com/ex/confluence/{workspace_id}/wiki/api/v2/spaces'
                params = {'limit': limit}
                if cursor:
                    params['cursor'] = cursor

                headers = {
                    'Authorization': f'Bearer {confluence_oauth.access_token}',
                    'Accept': 'application/json',
                }
                try:
                    response = requests.get(url, headers=headers, params=params, timeout=30)
                    if response.status_code == 401:
                        logger.info('Refreshing Confluence OAuth token for spaces API, project %s', project_uuid)
                        confluence_oauth = _refresh_confluence_access_token(confluence_oauth)
                        headers['Authorization'] = f'Bearer {confluence_oauth.access_token}'
                        response = requests.get(url, headers=headers, params=params, timeout=30)
                    response.raise_for_status()
                except requests.HTTPError:
                    logger.error(
                        'Confluence Spaces API HTTP %s for project %s workspace %s: %s',
                        response.status_code, project_uuid, workspace_id, response.text[:500]
                    )
                    raise
                data = response.json()
                results = data.get('results') or []
                for space in results:
                    space_id = space.get('id')
                    if space_id is None:
                        continue
                    all_spaces.append({
                        'id': str(space_id),
                        'key': space.get('key') or '',
                        'name': space.get('name') or '',
                        'type': space.get('type') or '',
                        'status': space.get('status') or '',
                    })

                next_link = (data.get('_links') or {}).get('next')
                if not next_link:
                    break
                query = parse_qs(urlparse(next_link).query)
                cursor_list = query.get('cursor')
                if not cursor_list:
                    break
                cursor = cursor_list[0]
        except Exception as e:
            logger.error('Confluence API error fetching spaces for project %s workspace %s: %s', project_uuid, workspace_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch Confluence spaces.')

        all_spaces.sort(key=lambda item: item['name'].lower())
        return Response({'spaces': all_spaces})

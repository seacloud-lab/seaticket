# -*- coding: utf-8 -*-
import logging
import requests

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
from seahub.project.models import Projects, ProjectGithubAppInstallation, \
    ProjectConnectionOauth
from seahub.project.confluence_api import ConfluenceAPI
from seahub.project.linear_api import LinearAPI
from seahub.project.utils import check_project_permission, check_project_admin_permission, get_project_related_users, \
    query_items, check_project_admin_permission
from seahub.project.constants import ConnectionType, ITEMS_SEARCH_QUERY_TYPES_SUPPORT
from seahub.project.github_issues_api import GitHubAPI
from seahub.project.discord_api import DiscordAPI
from seahub.project.slack_api import SlackAPI
from seahub.settings import JIRA_CLIENT_ID, JIRA_CLIENT_SECRET
from seahub.project.jira_api import JiraAPI


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
        if not check_project_admin_permission(username, workspace.owner):
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

        linear_oauth = ProjectConnectionOauth.objects.get_by_project_uuid(project_uuid, ConnectionType.LINEAR.value)
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

        confluence_oauth = ProjectConnectionOauth.objects.get_by_project_uuid(project_uuid, ConnectionType.CONFLUENCE.value)
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
            ProjectConnectionOauth.objects.upsert_token(
                project_uuid, ConnectionType.CONFLUENCE.value,
                confluence_api.access_token, confluence_api.expires_at, confluence_api.refresh_token
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

        confluence_oauth = ProjectConnectionOauth.objects.get_by_project_uuid(project_uuid, ConnectionType.CONFLUENCE.value)
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
            ProjectConnectionOauth.objects.upsert_token(
                project_uuid, ConnectionType.CONFLUENCE.value,
                confluence_api.access_token, confluence_api.expires_at, confluence_api.refresh_token
            )

        all_spaces.sort(key=lambda item: item['name'].lower())
        return Response({'spaces': all_spaces})


class ProjectDiscordChannels(APIView):
    """List text channels in a Discord guild using the configured bot token."""

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        """List text channels for the given Discord guild.

        Body params:
            guild_id: Discord guild (server) ID
        """
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        guild_id = (request.data.get('guild_id') or '').strip()

        if not guild_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'guild_id is required.')

        discord_api = DiscordAPI(settings.DISCORD_BOT_TOKEN)

        try:
            channels = discord_api.list_guild_channels(guild_id)
        except requests.HTTPError as e:
            discord_status = e.response.status_code
            logger.error('Discord API error listing channels for guild %s (HTTP %s): %s', guild_id, discord_status, e)
            if discord_status == 401:
                return api_error(status.HTTP_401_UNAUTHORIZED, 'Invalid Discord bot token')
            if discord_status == 403:
                return api_error(status.HTTP_403_FORBIDDEN, 'Bot does not have access to this guild')
            if discord_status == 404:
                return api_error(status.HTTP_404_NOT_FOUND, 'Guild not found')
            if discord_status == 429:
                return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Discord API rate limited. Please try again later')
            return api_error(discord_status, 'Discord API error.')
        except requests.RequestException as e:
            logger.error('Failed to connect to Discord API for guild %s: %s', guild_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'channels': channels})


class ProjectSlackChannels(APIView):
    """List Slack channels in the workspace using the stored OAuth bot token."""

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        """List channels for the Slack workspace.

        Body params:
            team_id: Slack workspace (team) ID
        """
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        team_id = (request.data.get('team_id') or '').strip()
        if not team_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'team_id is required.')

        oauth = ProjectConnectionOauth.objects.get_by_project_uuid(project_uuid, ConnectionType.SLACK.value)
        if not oauth:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Slack OAuth authorization is required.')

        slack_api = SlackAPI(oauth.access_token)

        try:
            channels = slack_api.list_channels()
        except requests.HTTPError as e:
            slack_status = e.response.status_code
            logger.error('Slack API error listing channels for team %s (HTTP %s): %s', team_id, slack_status, e)
            if slack_status == 401:
                return api_error(status.HTTP_401_UNAUTHORIZED, 'Invalid Slack bot token')
            if slack_status == 403:
                return api_error(status.HTTP_403_FORBIDDEN, 'Bot does not have access to this workspace')
            if slack_status == 429:
                return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Slack API rate limited. Please try again later')
            return api_error(slack_status, 'Slack API error.')
        except requests.RequestException as e:
            logger.error('Failed to connect to Slack API for team %s: %s', team_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'channels': channels})


class ProjectJiraSites(APIView):
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

        jira_oauth = ProjectConnectionOauth.objects.get_by_project_uuid(project_uuid, ConnectionType.JIRA_ISSUE.value)
        if not jira_oauth:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Jira OAuth authorization is required.')

        jira_api = JiraAPI(
            access_token=jira_oauth.access_token,
            refresh_token=jira_oauth.refresh_token,
            expires_at=jira_oauth.expires_at,
        )

        try:
            resources = jira_api.list_accessible_resources()
        except Exception as e:
            logger.error('Jira API error fetching sites for project %s: %s', project_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch Jira sites.')

        if jira_api.access_token != jira_oauth.access_token:
            ProjectConnectionOauth.objects.upsert_token(
                project_uuid, ConnectionType.JIRA_ISSUE.value,
                jira_api.access_token, jira_api.expires_at, jira_api.refresh_token
            )

        sites = []
        for resource in resources:
            scopes = resource.get('scopes') or []
            if not any('jira' in str(scope).lower() for scope in scopes):
                continue
            site_id = resource.get('id')
            site_name = resource.get('name')
            site_url = resource.get('url')
            if not site_id or not site_name or not site_url:
                continue
            sites.append({
                'id': site_id,
                'name': site_name,
                'url': site_url,
            })

        return Response({'sites': sites})


class ProjectJiraProjects(APIView):
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

        site_id = request.GET.get('site_id', '')
        if not site_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'site_id is required.')

        jira_oauth = ProjectConnectionOauth.objects.get_by_project_uuid(project_uuid, ConnectionType.JIRA_ISSUE.value)
        if not jira_oauth:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Jira OAuth authorization is required.')

        jira_api = JiraAPI(
            access_token=jira_oauth.access_token,
            refresh_token=jira_oauth.refresh_token,
            expires_at=jira_oauth.expires_at,
        )

        try:
            projects_list = jira_api.list_projects(site_id)
        except Exception as e:
            logger.error('Jira API error fetching projects for project %s: %s', project_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch Jira projects.')

        if jira_api.access_token != jira_oauth.access_token:
            ProjectConnectionOauth.objects.upsert_token(
                project_uuid, ConnectionType.JIRA_ISSUE.value,
                jira_api.access_token, jira_api.expires_at, jira_api.refresh_token
            )

        return Response({'projects': projects_list})

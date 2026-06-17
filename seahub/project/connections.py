# -*- coding: utf-8 -*-
import hashlib
import hmac
import logging
import json
import datetime
import os
from email.utils import formatdate, make_msgid
from urllib.parse import urlparse

from django.utils.translation import gettext as _
from django.http import FileResponse, HttpResponseNotModified
from django.shortcuts import render
from django.utils import timezone
from requests_oauthlib import OAuth2Session

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.utils import uuid_str_to_32_chars, gen_file_etag_and_modified_time
from seahub.project.models import Projects, ProjectConnections, decrypt_config, \
    ConnectionsViews, ProjectGithubAppInstallation, ProjectLinearOauth
from seahub.project.utils import check_project_admin_permission, check_project_permission, url_to_filename, \
    extract_email_addresses, get_email_oauth_callback_url, is_oauth_email_provider, create_connection, \
    fetch_oauth_email_sender_info, EmailOAuthProfileError, persist_project_connection_config, \
    get_connection_general_task_related_users
from seahub.utils.indexer import add_connection_sync_task, manual_sync_connection
from seahub.utils.webhook import update_github_issue_by_webhook, update_discourse_topic_by_webhook
from seahub.utils.storage import get_connection_file_from_s3, FileNotFound
from seahub.utils.storage import if_none_match_hit, get_connection_file_head_from_s3
from seahub.seadb_models.utils import init_seadb_tables_from_schema, list_discourse_forum_replies_records, \
    list_connection_view_records, list_github_issue_record_details, list_seafile_record_details, \
    list_site_record_details, list_email_record_details, get_issue_record_by_pk, list_notion_record_details, \
    list_general_task_record_details, build_general_task_row_data, get_connection_columns, list_linear_issue_record_details
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.seadb_models.general_task_seadb_api import GeneralTaskSeaDBAPI
from seahub.project.constants import ConnectionType, CrawlStatus, MANUAL_SYNC_INTERVAL, MANUAL_CRAWL_INTERVAL, \
    EMAIL_ATTACHMENT_TEMP_DIR, EMAIL_ATTACHMENTS_ZIP_NAME, GENERAL_TASK_MUTABLE_FIELDS
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.project.oauth_utils import EmailOAuthUtils
from seahub.project.seadb_api import SeaDBAPI
from seahub.utils.decorators import require_org_context
from seahub.tickets.ticket_utils import build_linked_ticket_titles_map, get_ticket, \
    check_ticket_link_changes, sync_links_in_connection, TicketLinkValidationError
from seahub.project.utils import LINKED_TICKET_SUPPORT_TYPES, send_connection_data_event
from seahub.settings import GITHUB_WEBHOOK_SECRET
from seahub.project.github_issues_api import GitHubAPI, GitHubAppNotInstalled
from seahub.utils.email_sender import toggle_send_email, toggle_delete_emails, EmailSendError, EmailDeleteError, EmailConfigError
from seahub.project.discourse_api import DiscourseForumAPI, DiscourseForumAPIException
from seahub.utils.io import zip_email_attachments, query_io_task_status
from seahub.project.task_utils import create_general_task_via_adapter, update_general_task_via_adapter, \
    prepare_image_data_for_adapter, build_general_task_change_values

from seahub.seadb_models.models import SchemaTables


from django.utils import timezone

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')

logger = logging.getLogger(__name__)



class GitHubIssueUpdateError(Exception):
    def __init__(self, error_msg, status_code):
        super().__init__(error_msg)
        self.error_msg = error_msg
        self.status_code = status_code


def normalize_github_issue_state_update(state=None, state_reason=None):
    update_state = state.lower() if isinstance(state, str) else None
    update_state_reason = state_reason.lower() if isinstance(state_reason, str) else None
    if update_state_reason is not None and update_state is None:
        if update_state_reason == 'reopened':
            update_state = 'open'
        elif update_state_reason in ('completed', 'not_planned', 'duplicate'):
            update_state = 'closed'
        else:
            raise GitHubIssueUpdateError('state_reason is invalid.', status.HTTP_400_BAD_REQUEST)
    return update_state, update_state_reason


def update_github_issue_record(
    project_uuid,
    connection_id,
    record_pk,
    *,
    title=None,
    labels=None,
    issue_type=None,
    state=None,
    state_reason=None,
    seadb_api=None,
):
    project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
    if not project_connection:
        raise GitHubIssueUpdateError(
            f'project_connection {connection_id} not found.',
            status.HTTP_404_NOT_FOUND,
        )

    if project_connection.type != ConnectionType.GITHUB_ISSUE.value:
        raise GitHubIssueUpdateError('Connection type invalid.', status.HTTP_400_BAD_REQUEST)

    if not project_connection.is_active:
        raise GitHubIssueUpdateError('Connection is inactive.', status.HTTP_400_BAD_REQUEST)

    update_state, update_state_reason = normalize_github_issue_state_update(
        state=state,
        state_reason=state_reason,
    )

    config = decrypt_config(json.loads(project_connection.config))
    installation_id = config.get('installation_id')
    if not installation_id:
        raise GitHubIssueUpdateError('GitHub auth config missing.', status.HTTP_400_BAD_REQUEST)

    seadb_api = seadb_api or SeaDBAPI()
    issue_record, _ = get_issue_record_by_pk(seadb_api, project_uuid, connection_id, record_pk)
    issue_number = issue_record.get('issue_number')
    if not issue_number:
        raise GitHubIssueUpdateError('GitHub issue not found.', status.HTTP_404_NOT_FOUND)

    server_url = config.get('repository')
    try:
        path = urlparse(server_url).path
        parts = path.strip('/').split('/')
        repo_owner, repo_name = parts[0], parts[1]
    except Exception as e:
        logger.error(f'Github repository is invalid {e}')
        raise GitHubIssueUpdateError('Github repository is invalid.', status.HTTP_400_BAD_REQUEST)

    try:
        github_api = GitHubAPI(installation_id=installation_id)
        issue_data = github_api.update_issue(
            repo_owner,
            repo_name,
            issue_number,
            title=title if title else None,
            labels=labels if labels is not None else None,
            state=update_state,
            state_reason=update_state_reason,
            issue_type=issue_type if issue_type is not None else None,
        )
    except GitHubAppNotInstalled:
        ProjectGithubAppInstallation.objects.filter(project_uuid=project_uuid, installation_id=installation_id).delete()
        raise GitHubIssueUpdateError('Installation_id is incorrect', status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f'github issue update error: {e}')
        response = getattr(e, 'response', None)
        if response is not None and response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            raise GitHubIssueUpdateError('Too many requests.', status.HTTP_429_TOO_MANY_REQUESTS)
        raise GitHubIssueUpdateError('Internal Server Error', status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        github_seadb_api = GitHubSeaDBAPI(project_uuid, seadb_api=seadb_api)
        github_seadb_api.update_issue_record(project_uuid, connection_id, record_pk, issue_data)
    except Exception as e:
        logger.error(f'update github issue in seadb error: {e}')
        if e.args and e.args[0] == 409:
            raise GitHubIssueUpdateError('Conflict with another transaction', status.HTTP_409_CONFLICT)
        raise GitHubIssueUpdateError('Internal Server Error', status.HTTP_500_INTERNAL_SERVER_ERROR)

    return issue_data


class ProjectConnectionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        """get project connection records
        """

        # role permission check
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        start = (current_page - 1) * per_page
        end = start + per_page

        # resources check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        records = ProjectConnections.objects.filter(project_uuid=project_uuid, deleted=False)[start:end]
        records = [record.to_dict() for record in records]

        return Response({'records': records}, status=status.HTTP_200_OK)

    @require_org_context
    def post(self, request, project_uuid):
        """modify project connection
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.POST.get('name', '')
        if not name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        config = request.POST.get('config')
        if not config:
            error_msg = 'config invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        connection_type = request.POST.get('type')
        if not ConnectionType.is_valid(connection_type):
            error_msg = f'Type {connection_type} not support.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # resources check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        config = json.loads(config)
        if connection_type == ConnectionType.EMAIL.value and is_oauth_email_provider(config.get('server_provider')):
            error_msg = 'OAuth email connections must be authorized before creation.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        record, error_response = create_connection(project, request.user.username, connection_type, name, config)
        if error_response:
            return error_response

        return Response({'record': record.to_dict()}, status=status.HTTP_201_CREATED)


class ProjectEmailOAuthLoginView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        if not request.user.permissions.can_add_project():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        oauth_payload, error_response = EmailOAuthUtils.build_email_oauth_config(request)
        if error_response:
            return error_response

        name = oauth_payload['name']
        config = oauth_payload['config']
        if ProjectConnections.objects.filter(project_uuid=project.uuid, name=name, deleted=False).exists():
            return api_error(status.HTTP_400_BAD_REQUEST, f'Connection name {name} already exists.')

        callback_url = get_email_oauth_callback_url(project_uuid)
        try:
            session = OAuth2Session(
                client_id=config.get('client_id'),
                scope=config.get('scopes'),
                redirect_uri=callback_url,
            )
            authorization_url, state = session.authorization_url(config.get('authority_url'))
            for key, value in config.get('authority_args', {}).items():
                authorization_url += f'&{key}={value}'
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to fetch authorization url')

        EmailOAuthUtils.set_oauth_session(request, {
            'oauth_state': state,
            'status': 'in-progress',
            'name': name,
            'config': config,
            'connection_id': None,
            'error_msg': '',
        })
        return Response({'auth_url': authorization_url})


class ProjectEmailOAuthQueryView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        oauth_data = EmailOAuthUtils.get_oauth_session(request)
        if not oauth_data:
            return api_error(status.HTTP_404_NOT_FOUND, 'OAuth request not found.')

        status_value = oauth_data.get('status')
        if status_value == 'failure':
            return api_error(status.HTTP_401_UNAUTHORIZED, oauth_data.get('error_msg') or 'OAuth authorization failed.')

        response_data = {'status': status_value or 'in-progress'}
        if status_value == 'success':
            connection_id = oauth_data.get('connection_id')
            record = ProjectConnections.objects.get_connection_by_id(connection_id) if connection_id else None
            if not record:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Connection information not found.')
            response_data['record'] = record.to_dict()

        return Response(response_data)


class ProjectEmailOAuthCallbackView(APIView):
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        oauth_data = EmailOAuthUtils.get_oauth_session(request)
        if not oauth_data:
            return render(request, 'error.html', {'error_msg': _('Request not found')})

        if oauth_data.get('status') == 'success':
            return render(request, 'authorization_success.html')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            EmailOAuthUtils.set_oauth_failure(request, 'Project not found.')
            return render(request, 'error.html', {'error_msg': _('Project not found.')})

        workspace = project.workspace
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            EmailOAuthUtils.set_oauth_failure(request, 'Permission denied.')
            return render(request, 'error.html', {'error_msg': _('Permission denied.')})

        config = oauth_data.get('config') or {}
        name = oauth_data.get('name')
        if not all([config, name, oauth_data.get('oauth_state')]):
            error_msg = 'Invalid request, please try again later'
            EmailOAuthUtils.set_oauth_failure(request, error_msg)
            return render(request, 'error.html', {'error_msg': _(error_msg)})

        request_state = request.GET.get('state')
        if not request_state or request_state != oauth_data.get('oauth_state'):
            error_msg = 'OAuth request is expired or has been replaced by a newer authorization.'
            EmailOAuthUtils.set_oauth_failure(request, error_msg)
            return render(request, 'error.html', {'error_msg': _(error_msg)})

        callback_url = get_email_oauth_callback_url(project_uuid)
        authorization_response_url = settings.SERVICE_URL.rstrip('/') + request.get_full_path()

        try:
            session = OAuth2Session(
                client_id=config.get('client_id'),
                scope=config.get('scopes'),
                state=oauth_data.get('oauth_state'),
                redirect_uri=callback_url,
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'OAuth verification failed, please check your connection configurations'
            EmailOAuthUtils.set_oauth_failure(request, error_msg)
            return render(request, 'error.html', {'error_msg': _(error_msg)})

        try:
            token = session.fetch_token(
                config.get('token_url'),
                client_secret=config.get('client_secret'),
                authorization_response=authorization_response_url,
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Failed to request token, please check your connection configurations'
            EmailOAuthUtils.set_oauth_failure(request, error_msg)
            return render(request, 'error.html', {'error_msg': _(error_msg)})

        refresh_token = token.get('refresh_token')
        if not refresh_token:
            error_msg = 'Failed to request token'
            EmailOAuthUtils.set_oauth_failure(request, error_msg)
            return render(request, 'error.html', {'error_msg': _(error_msg)})

        final_config = dict(config)
        final_config['refresh_token'] = refresh_token
        if token.get('access_token'):
            final_config['access_token'] = token.get('access_token')
        if token.get('expires_at'):
            final_config['expires_at'] = token.get('expires_at')

        try:
            final_config.update(fetch_oauth_email_sender_info(final_config, token.get('access_token')))
        except EmailOAuthProfileError as e:
            logger.error(e)
            error_msg = 'Failed to fetch sender profile, please check your connection configurations'
            EmailOAuthUtils.set_oauth_failure(request, error_msg)
            return render(request, 'error.html', {'error_msg': _(error_msg)})

        record, error_response = create_connection(project, username, ConnectionType.EMAIL.value, name, final_config)
        if error_response:
            error_msg = 'Internal Server Error'
            EmailOAuthUtils.set_oauth_failure(request, error_msg)
            return render(request, 'error.html', {'error_msg': _(error_msg)})

        oauth_data['status'] = 'success'
        oauth_data['connection_id'] = record.id
        oauth_data['config'] = final_config
        oauth_data['error_msg'] = ''
        EmailOAuthUtils.set_oauth_session(request, oauth_data)

        return render(request, 'authorization_success.html', {
            'name': name,
            'nickname': email2nickname(username),
        })


class ProjectGithubConnectionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            config_list = request.POST.get('config_list')
            config_list = json.loads(config_list)
        except ValueError:
            config_list = []

        if not config_list:
            error_msg = 'config_list invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(config_list) >= 10:
            error_msg = 'The number of selected repo exceeds the limit.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resources check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = project.workspace

        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        records = []
        for conf in config_list:
            name = conf.get('name')
            installation_id = conf.get('installation_id')
            github_app_installation = ProjectGithubAppInstallation.objects.get_project_installation(project_uuid, installation_id)

            if not github_app_installation:
                error_msg = 'The app has not been installed on the sea-ticket'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            connection_type = ConnectionType.GITHUB_ISSUE
            repository = conf.get('html_url')
            config = {
                'installation_id': installation_id,
                'repository': repository,
            }

            enable_create = ProjectConnections.objects.enable_create(project_uuid, connection_type, config)
            if not enable_create:
                error_msg = 'Please check input'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                record = ProjectConnections.objects.create(request.user.username, project_uuid, connection_type, name, config)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            connection_id = record.id
            seadb_api = SeaDBAPI()
            try:
                init_seadb_tables_from_schema([SchemaTables.GITHUB_ISSUES, SchemaTables.GITHUB_ISSUE_COMMENTS], seadb_api, project.uuid, connection_id)
            except Exception as e:
                logger.error(e)
                record.delete()
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            params = {
                'connection_id': connection_id,
                'type': connection_type,
            }
            add_connection_sync_task(params)

            records.append(record.to_dict())
        return Response({'records': records}, status=status.HTTP_201_CREATED)


class ProjectConnectionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, connection_id):
        """get project connection records
        """
        # resources check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return Response({'record': project_connection.to_dict()}, status=status.HTTP_200_OK)

    @require_org_context
    def put(self, request, project_uuid, connection_id):
        """ modify connection
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.data.get('name')
        new_config = request.data.get('config')
        is_active = request.data.get('is_active')

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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # argument check
        if new_config:
            config = decrypt_config(json.loads(project_connection.config))
            new_config = json.loads(new_config)
            config.update(new_config)
            new_config = config

        if is_active is not None:
            is_active = to_python_boolean(is_active)

        if new_config:
            enable_modify = ProjectConnections.objects.enable_modify(project_connection.type, connection_id, new_config)
            if not enable_modify:
                error_msg = 'Please check input'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            record = ProjectConnections.objects.modify(username, project_uuid, project_connection.type, connection_id, name,
                                                       new_config, is_active)
        except Exception as e:
            logger.error(f'modify {connection_id} error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'record': record.to_dict()}, status=status.HTTP_200_OK)

    @require_org_context
    def delete(self, request, project_uuid, connection_id):
        """delete connection
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

        try:
            ProjectConnections.objects.filter(project_uuid=project_uuid, id=connection_id).update(deleted=True)
        except Exception as e:
            logger.error(f'delete {connection_id} error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


class ProjectConnectionSyncView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid, connection_id):
        """trigger manual sync for a connection
        """

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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'Connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check connection status
        connection_type = project_connection.type
        connection_status = json.loads(project_connection.status)
        if connection_status.get('last_sync_status') == CrawlStatus.CRAWLING:
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Connection is currently syncing')

        # check cooldown
        if project_connection.last_sync_time:
            now_datetime = datetime.datetime.now(datetime.timezone.utc)
            time_diff = now_datetime - project_connection.last_sync_time
            cooldown_seconds = MANUAL_SYNC_INTERVAL
            if connection_type == ConnectionType.SITE:
                cooldown_seconds = MANUAL_CRAWL_INTERVAL
            if time_diff.total_seconds() < cooldown_seconds:
                next_sync_utc = project_connection.last_sync_time + datetime.timedelta(seconds=cooldown_seconds)
                error_msg = {
                    'message_type': 'Manual sync too frequent',
                    'next_time': next_sync_utc
                }
                return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        try:
            params = {
                'connection_id': project_connection.id,
                'connection_type': connection_type,
            }
            res, status_code = manual_sync_connection(params)
            success = res.get('success')
            if not success:
                return api_error(status_code, res.get('error_msg'))
        except Exception as e:
            logger.error(f'trigger sync for connection {connection_id} error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


class ProjectConnectionDetailsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, connection_id):
        """get records
        """
        # argument check
        view_id = request.GET.get('view_id', '')
        if not view_id:
            error_msg = 'view_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)

        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 1000

        try:
            view = ConnectionsViews.objects.get_view(project_uuid, project_connection, view_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not view:
            error_msg = 'Connection view %s not found.' % view_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            seadb_api = SeaDBAPI()
            records, columns = list_connection_view_records(
                seadb_api, project_uuid, project_connection, view, start, limit
            )
        except SQLGeneratorOptionInvalidError as e:
            logger.error(e)
            error_msg = _('There are errors with the filters. Please correct them.')
            return Response({
                'records': [],
                'columns': getattr(e, 'columns', []),
                'name': project_connection.name,
                'type': project_connection.type,
                'error_msg': error_msg,
            })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        ticket_pk_to_ticket_title = {}
        if project_connection.type in LINKED_TICKET_SUPPORT_TYPES:
            ticket_pk_to_ticket_title = build_linked_ticket_titles_map(
                seadb_api, project_uuid, records, columns, 'linked_ticket'
            )
        related_users = []
        if project_connection.type == ConnectionType.GENERAL_TASK.value:
            related_users = get_connection_general_task_related_users(project_uuid, connection_id)

        return Response({
            'records': records,
            'columns': columns,
            'name': project_connection.name,
            'type': project_connection.type,
            'ticket_pk_to_ticket_title': ticket_pk_to_ticket_title,
            'related_users': related_users,
        })


class ProjectConnectionMetaView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, connection_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if project_connection.type != ConnectionType.GENERAL_TASK.value:
            error_msg = 'Only general task connections support related users.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            seadb_api = SeaDBAPI()
            columns = get_connection_columns(seadb_api, project_uuid, project_connection)
            related_users = get_connection_general_task_related_users(project_uuid, connection_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'related_users': related_users,
            'columns': columns,
        })


class GithubWebhookView(APIView):
    throttle_classes = (UserRateThrottle,)

    def verify_signature(self, signature, msg, github_secret):
        if not signature:
            return False

        if '=' not in signature:
            return False

        sha_name, signature = signature.split('=', 1)
        if sha_name != 'sha256':
            return False

        mac = hmac.new(github_secret.encode(), msg=msg, digestmod=hashlib.sha256)
        return hmac.compare_digest(mac.hexdigest(), signature)

    def post(self, request):
        event = request.headers.get("X-GitHub-Event", "ping")
        msg = request.body
        signature = request.headers.get('X-Hub-Signature-256')

        if not self.verify_signature(signature, msg, GITHUB_WEBHOOK_SECRET):
            error_msg = 'Signature verification failed.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if event == 'ping':
            return Response({'success': True}, status=status.HTTP_200_OK)

        payload = request.data
        action = payload.get('action')
        installation_id = payload.get('installation').get('id')

        if not installation_id:
            error_msg = 'installation_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        github_app_installation = ProjectGithubAppInstallation.objects.get_installation_by_installation_id(installation_id)

        if not github_app_installation:
            error_msg = 'The app has not been installed on the sea-ticket'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repository_html_url = payload.get('repository').get('html_url')
        if not repository_html_url:
            error_msg = 'repository_html_url invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if event == 'issues':
            update_data = payload.get('issue')
            if not update_data and not update_data.get('id'):
                error_msg = 'issue_data invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        elif event == 'issue_comment':
            update_data = payload
            if not update_data and not update_data.get('comment'):
                error_msg = 'comment_data invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        elif event == 'installation' and action == 'deleted':
            update_data = {}
        else:
            return Response({'success': True}, status=status.HTTP_200_OK)

        params = {'installation_id': installation_id, 'action': action, 'event': event, 'update_data': update_data,
                  'repository_html_url': repository_html_url}

        try:
            update_github_issue_by_webhook(params)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


class GithubIssueView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def put(self, request, project_uuid, connection_id):
        _pk = request.data.get('_pk')
        title = request.data.get('title', None)
        state = request.data.get('state', None)
        state_reason = request.data.get('state_reason', None)
        labels = request.data.get('labels', None)
        issue_type = request.data.get('issue_type', None)

        if not _pk:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Missing _pk.')
        try:
            _pk = int(_pk)
        except (TypeError, ValueError):
            return api_error(status.HTTP_400_BAD_REQUEST, '_pk is invalid.')

        if all(value is None for value in (title, labels, issue_type, state, state_reason)):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Nothing to update.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        seadb_api = SeaDBAPI()
        try:
            issue_data = update_github_issue_record(
                project_uuid,
                connection_id,
                _pk,
                title=title,
                labels=labels,
                issue_type=issue_type,
                state=state,
                state_reason=state_reason,
                seadb_api=seadb_api,
            )
        except GitHubIssueUpdateError as e:
            return api_error(e.status_code, e.error_msg)
        except Exception as e:
            logger.error(f'github issue update error: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'issue': issue_data}, status=status.HTTP_200_OK)


class DiscourseWebhookView(APIView):
    throttle_classes = (UserRateThrottle,)

    def verify_signature(self, signature, msg, secret):
        if not signature:
            return True

        if '=' not in signature:
            return False

        sha_name, signature = signature.split('=', 1)
        if sha_name != 'sha256':
            return False

        mac = hmac.new(secret.encode(), msg=msg, digestmod=hashlib.sha256)
        return hmac.compare_digest(mac.hexdigest(), signature)

    def post(self, request):
        connection_id = request.query_params.get('connection_id')
        if not connection_id:
            error_msg = 'Missing connection_id.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection or not project_connection.is_active:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not project_connection.is_active:
            return Response({'warning': 'connection is inactive,request ignored'}, status=status.HTTP_200_OK)

        msg = request.body
        config = decrypt_config(json.loads(project_connection.config))
        secret = config.get('webhook_secret')
        signature = request.headers.get('X-Discourse-Event-Signature')

        if not self.verify_signature(signature, msg, secret):
            error_msg = 'Signature verification failed.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        event = request.headers.get('X-Discourse-Event')
        if not event:
            error_msg = 'X-Discourse-Event header missing.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        payload = request.data

        params = {'connection_id': connection_id, 'data': payload, 'event_type': event}
        try:
            update_discourse_topic_by_webhook(params)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


class ProjectConnectionLogView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, connection_id):
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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        last_sync_log = project_connection.last_sync_log or ''
        if last_sync_log:
            last_sync_log = last_sync_log[1:] if last_sync_log.startswith('\n') else last_sync_log
            last_sync_log = last_sync_log.replace('\n', '<br>')
        return Response({
            'last_sync_log': last_sync_log,
        })


class ProjectConnectionsStatusView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

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

        connection_ids = request.GET.get('connection_ids')
        if not connection_ids:
            error_msg = 'Missing connection_ids.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        connection_ids = connection_ids.split(',')
        records = ProjectConnections.objects.filter(project_uuid=project_uuid, deleted=False, id__in=connection_ids)
        connections_status = {}
        for record in records:
            connections_status[record.id] = {
                'status': record.status or '{}',
                'last_sync_time': record.last_sync_time,
            }
        return Response(connections_status)


class ProjectLinearOauthStatusView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

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
            return Response({'connected': False, 'expires_at': None}, status=status.HTTP_200_OK)

        return Response({'connected': True, 'expires_at': linear_oauth.expires_at}, status=status.HTTP_200_OK)


class ProjectConnectionRecordView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, connection_id, record_id):
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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        seadb_api = SeaDBAPI()
        if project_connection.type == ConnectionType.DISCOURSE_FORUM.value:
            record, columns, linked_ticket_title = list_discourse_forum_replies_records(seadb_api, project_uuid, connection_id, record_id)
        elif project_connection.type == ConnectionType.SITE.value:
            record, columns, linked_ticket_title = list_site_record_details(seadb_api, project_uuid, connection_id, record_id)
            url = record.get('url', '')
            if url:
                filename = url_to_filename(url)
                file = get_connection_file_from_s3(project_uuid, connection_id, filename)
                if file:
                    record['content'] = json.loads(file.read()).get('content')
        elif project_connection.type == ConnectionType.GITHUB_ISSUE.value:
            record, columns, linked_ticket_title = list_github_issue_record_details(seadb_api, project_uuid, connection_id, record_id)
        elif project_connection.type == ConnectionType.SEAFILE.value:
            record, columns, linked_ticket_title = list_seafile_record_details(seadb_api, project_uuid, connection_id, record_id)
        elif project_connection.type == ConnectionType.EMAIL.value:
            record, columns, linked_ticket_title = list_email_record_details(seadb_api, project_uuid, connection_id, record_id)
        elif project_connection.type == ConnectionType.NOTION.value:
            record, columns, linked_ticket_title = list_notion_record_details(seadb_api, project_uuid, connection_id, record_id)
        elif project_connection.type == ConnectionType.GENERAL_TASK.value:
            record, columns, linked_ticket_title = list_general_task_record_details(seadb_api, project_uuid, connection_id, record_id)
        elif project_connection.type == ConnectionType.LINEAR.value:
            record, columns, linked_ticket_title = list_linear_issue_record_details(seadb_api, project_uuid, connection_id, record_id)
        else:
            error_msg = 'type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        related_users = []
        if project_connection.type == ConnectionType.GENERAL_TASK.value:
            related_users = get_connection_general_task_related_users(project_uuid, connection_id)

        return Response({
            'record': record,
            'columns': columns,
            'linked_ticket_title': linked_ticket_title,
            'related_users': related_users,
        })


    @require_org_context
    def put(self, request, project_uuid, connection_id, record_id):
        """Update a single connection record
        Supports updating outdated field for all connection types,
        and unread field for EMAIL type.
        """
        row_data = request.data
        if not row_data or not isinstance(row_data, dict):
            error_msg = 'Request body must be a valid JSON object.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Get table class based on connection type
        supported_types = [
            ConnectionType.DISCOURSE_FORUM.value,
            ConnectionType.GITHUB_ISSUE.value,
            ConnectionType.SITE.value,
            ConnectionType.SEAFILE.value,
            ConnectionType.EMAIL.value,
            ConnectionType.NOTION.value,
            ConnectionType.GENERAL_TASK.value,
            ConnectionType.LINEAR.value,
        ]
        if project_connection.type not in supported_types:
            error_msg = f'Connection type {project_connection.type} does not support record editing.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = None
        if project_connection.type == ConnectionType.DISCOURSE_FORUM.value:
            table_name = SchemaTables.DISCOURSE_TOPICS.table_name(connection_id)
        elif project_connection.type == ConnectionType.GITHUB_ISSUE.value:
            table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        elif project_connection.type == ConnectionType.SITE.value:
            table_name = SchemaTables.WEB_CRAWL.table_name(connection_id)
        elif project_connection.type == ConnectionType.SEAFILE.value:
            table_name = SchemaTables.SEAFILE.table_name(connection_id)
        elif project_connection.type == ConnectionType.EMAIL.value:
            table_name = SchemaTables.THREAD.table_name(connection_id)
        elif project_connection.type == ConnectionType.NOTION.value:
            table_name = SchemaTables.NOTION.table_name(connection_id)
        elif project_connection.type == ConnectionType.GENERAL_TASK.value:
            table_name = SchemaTables.GENERAL_TASK.table_name(connection_id)
        elif project_connection.type == ConnectionType.LINEAR.value:
            table_name = SchemaTables.LINEAR_ISSUES.table_name(connection_id)

        update_row = {'pk': int(record_id), 'row': {}}
        seadb_api = SeaDBAPI()
        general_task_event = None

        if project_connection.type == ConnectionType.GENERAL_TASK.value:

            general_task_seadb_api = GeneralTaskSeaDBAPI(project)
            current_record = general_task_seadb_api.get_general_task_record(project_uuid, connection_id, record_id)
            if not current_record:
                return api_error(status.HTTP_404_NOT_FOUND, 'Task record not found.')

            changed_task_fields = {
                field for field in GENERAL_TASK_MUTABLE_FIELDS
                if field in row_data
            }
            if changed_task_fields:
                source_task_id = current_record.get('source_task_id')
                if not source_task_id:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Task source_task_id is missing.')
                merged_task = {
                    'id': source_task_id,
                    'title': row_data.get('title', current_record.get('title', '')),
                    'status': row_data.get('status', current_record.get('status', '')),
                    'size': row_data.get('size', current_record.get('size', '')),
                    'priority': row_data.get('priority', current_record.get('priority', '')),
                    'assignees': row_data.get('assignees', current_record.get('assignees') or []),
                    'participants': row_data.get('participants', current_record.get('participants') or []),
                    'version': row_data.get('version', current_record.get('version', '')),
                    'others': row_data.get('others', current_record.get('others', '')),
                    'description': row_data.get('description', current_record.get('content', '')),
                    'due_date': row_data.get('due_date', current_record.get('due_date')),
                    'created_time': current_record.get('created_time'),
                    'modified_time': current_record.get('modified_time'),
                    'url': current_record.get('url'),
                    'linked_ticket': row_data.get('linked_ticket', current_record.get('linked_ticket')),
                    'deleted': False,
                }
                connection_config = decrypt_config(json.loads(project_connection.config))
                image_data_map = prepare_image_data_for_adapter(project_uuid, merged_task.get('description'))
                if image_data_map:
                    merged_task['image_data_map'] = image_data_map
                try:
                    update_general_task_via_adapter(connection_config, source_task_id, merged_task)
                except ValueError as e:
                    logger.warning(f'update general task adapter error: {e}')
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Failed to update general task.')
                update_row['row'].update(build_general_task_row_data(merged_task))
                update_row['row']['source_task_id'] = source_task_id
                old_value, new_value = build_general_task_change_values(current_record, row_data, changed_task_fields)
                linked_ticket = merged_task.get('linked_ticket')
                if linked_ticket and old_value and new_value:
                    general_task_event = {
                        'record_id': record_id,
                        'old_value': old_value,
                        'new_value': new_value,
                    }

        # Support outdated field for all connection types
        if 'outdated' in row_data:
            update_row['row']['outdated'] = row_data.get('outdated')
            update_row['row']['record_modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()

        # Support unread field for EMAIL type only
        if project_connection.type == ConnectionType.EMAIL.value and 'unread' in row_data:
            update_row['row']['unread'] = row_data.get('unread')
            update_row['row']['record_modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()

        if project_connection.type == ConnectionType.EMAIL.value and 'tags' in row_data:
            update_row['row']['tags'] = row_data.get('tags')
            update_row['row']['record_modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()

        if 'linked_ticket' in row_data and project_connection.type in LINKED_TICKET_SUPPORT_TYPES:
            linked_ticket = row_data.get('linked_ticket')
            update_row['row']['linked_ticket'] = linked_ticket
            update_row['row']['record_modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()
            ticket, ticket_metadata = get_ticket(seadb_api, project_uuid, linked_ticket)
            old_value = ticket.get('linked_connection_records', []) or []
            new_value = old_value + [f'{connection_id}_{record_id}']
            try:
                update_rows = [
                    {
                        'pk': ticket.get('_pk'),
                        'row': {'linked_connection_records': new_value}
                    }
                ]
                seadb_api.update_rows(project_uuid, 'tickets', update_rows)
            except Exception as e:
                logger.error(f'update connection record error: {e}')
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not update_row['row']:
            return Response({'success': True})

        try:
            seadb_api.update_rows(project_uuid, table_name, [update_row])
        except Exception as e:
            logger.error(f'update connection record error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if general_task_event:
            send_connection_data_event(
                project_uuid, connection_id, general_task_event['record_id'],
                ConnectionType.GENERAL_TASK.value,
                {
                    'type': 'general_task_updated',
                    'old_value': general_task_event['old_value'],
                    'new_value': general_task_event['new_value'],
                }
            )

        return Response({'success': True})


class ProjectConnectionRecordsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid, connection_id):
        """
        Create a new record for a general task connection.
        """
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, f'Project {project_uuid} not found.')
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            return api_error(status.HTTP_404_NOT_FOUND, f'project_connection {connection_id} not found.')
        if project_connection.type != ConnectionType.GENERAL_TASK.value:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Only general task connections support record creation.')

        task_payload = request.data
        task_title = task_payload.get('title')
        if not task_title:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Task title is required.')
        task_payload['title'] = task_title
        task_payload['status'] = task_payload.get('status') or 'new'
        task_payload['priority'] = task_payload.get('priority') or 'medium'
        task_payload['size'] = task_payload.get('size') or 'medium'

        linked_ticket = request.data.get('linked_ticket')
        if linked_ticket in ('', None):
            linked_ticket = None
        elif not isinstance(linked_ticket, int):
            try:
                linked_ticket = int(linked_ticket)
            except Exception:
                return api_error(status.HTTP_400_BAD_REQUEST, 'linked_ticket invalid.')

        description_dict = task_payload.get('description')
        if not description_dict:
            error_msg = 'description invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not isinstance(description_dict, dict):
            error_msg = 'description invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        file_urls = description_dict.get('images')
        if file_urls and not isinstance(file_urls, list):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        link_urls = description_dict.get('links')
        if link_urls and isinstance(link_urls, list):
            file_urls = (file_urls or []) + link_urls

        try:
            connection_config = decrypt_config(json.loads(project_connection.config))
            image_data_map = prepare_image_data_for_adapter(project_uuid, description_dict)
            if image_data_map:
                task_payload['image_data_map'] = image_data_map
            created_task = create_general_task_via_adapter(connection_config, task_payload)
        except Exception as e:
            logger.error(f'create general task error: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))

        seadb_api = SeaDBAPI()
        row_data = build_general_task_row_data(created_task)
        try:
            res = seadb_api.insert_rows(project_uuid, SchemaTables.GENERAL_TASK.table_name(connection_id), [row_data])
            pks = res.get('pks', [])
            if len(pks) != 1:
                raise RuntimeError('insert_rows returned invalid pks')
            row_data['_pk'] = pks[0]
        except Exception as e:
            logger.error(f'insert general task row error: {e}')
            try:
                manual_sync_connection({'connection_id': connection_id, 'connection_type': project_connection.type})
            except Exception:
                pass
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Task created remotely but local sync failed.')

        if linked_ticket is not None:
            try:
                ticket, _ = get_ticket(seadb_api, project_uuid, linked_ticket)
                if not ticket:
                    return api_error(status.HTTP_404_NOT_FOUND, 'Ticket not found.')

                linked_record_key = f'{connection_id}_{row_data["_pk"]}'
                ticket_link_diff = {int(linked_ticket): ({linked_record_key}, set())}
                sync_plan, connections = check_ticket_link_changes(seadb_api, project_uuid, ticket_link_diff)

                old_value = ticket.get('linked_connection_records', []) or []
                if not isinstance(old_value, list):
                    old_value = []
                new_value = list(dict.fromkeys(old_value + [linked_record_key]))
                seadb_api.update_rows(project_uuid, 'tickets', [{
                    'pk': ticket.get('_pk'),
                    'row': {'linked_connection_records': new_value}
                }])
                sync_links_in_connection(seadb_api, project_uuid, sync_plan, connections)
                row_data['linked_ticket'] = linked_ticket
                send_connection_data_event(
                    project_uuid, connection_id, row_data.get('_pk'),
                    ConnectionType.GENERAL_TASK.value,
                    {
                        'type': 'general_task_added',
                        'old_value': None,
                        'new_value': {'title': row_data.get('title')},
                    }
                )
            except TicketLinkValidationError as e:
                return api_error(status.HTTP_400_BAD_REQUEST, str(e))
            except Exception as e:
                logger.error(f'link created general task to ticket error: {e}')
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Task created but link sync failed.')

        return Response({'row': row_data}, status=status.HTTP_201_CREATED)

    @require_org_context
    def put(self, request, project_uuid, connection_id):
        """Batch update connection records
        Supports updating outdated field for all connection types,
        and unread field for EMAIL type.
        """
        records_data = request.data.get('records_data')
        if not records_data or not isinstance(records_data, list):
            error_msg = 'records_data must be a non-empty list.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Get table class based on connection type
        supported_types = [
            ConnectionType.DISCOURSE_FORUM.value,
            ConnectionType.GITHUB_ISSUE.value,
            ConnectionType.SITE.value,
            ConnectionType.SEAFILE.value,
            ConnectionType.EMAIL.value,
            ConnectionType.NOTION.value,
            ConnectionType.GENERAL_TASK.value,
            ConnectionType.LINEAR.value,
        ]
        if project_connection.type not in supported_types:
            error_msg = f'Connection type {project_connection.type} does not support record editing.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = None
        if project_connection.type == ConnectionType.DISCOURSE_FORUM.value:
            table_name = SchemaTables.DISCOURSE_TOPICS.table_name(connection_id)
        elif project_connection.type == ConnectionType.GITHUB_ISSUE.value:
            table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        elif project_connection.type == ConnectionType.SITE.value:
            table_name = SchemaTables.WEB_CRAWL.table_name(connection_id)
        elif project_connection.type == ConnectionType.SEAFILE.value:
            table_name = SchemaTables.SEAFILE.table_name(connection_id)
        elif project_connection.type == ConnectionType.EMAIL.value:
            table_name = SchemaTables.THREAD.table_name(connection_id)
        elif project_connection.type == ConnectionType.NOTION.value:
            table_name = SchemaTables.NOTION.table_name(connection_id)
        elif project_connection.type == ConnectionType.GENERAL_TASK.value:
            table_name = SchemaTables.GENERAL_TASK.table_name(connection_id)
        elif project_connection.type == ConnectionType.LINEAR.value:
            table_name = SchemaTables.LINEAR_ISSUES.table_name(connection_id)

        update_rows = []
        general_task_events = []
        seadb_api = SeaDBAPI()
        for record in records_data:
            row_id = record.get('row_id')
            row_data = record.get('row', {})
            if not row_id or not isinstance(row_data, dict):
                continue
            update_row = {'pk': int(row_id), 'row': {}}

            if project_connection.type == ConnectionType.GENERAL_TASK.value:
                # sync to remote seatable task
                general_task_seadb_api = GeneralTaskSeaDBAPI(project_uuid)
                current_record = general_task_seadb_api.get_general_task_record(project_uuid, connection_id, row_id)
                if not current_record:
                    continue
                changed_task_fields = {
                    field for field in GENERAL_TASK_MUTABLE_FIELDS
                    if field in row_data
                }
                if changed_task_fields:
                    source_task_id = current_record.get('source_task_id')
                    if not source_task_id:
                        continue
                    merged_task = {
                        'id': source_task_id,
                        'title': row_data.get('title', current_record.get('title', '')),
                        'status': row_data.get('status', current_record.get('status', '')),
                        'size': row_data.get('size', current_record.get('size', '')),
                        'priority': row_data.get('priority', current_record.get('priority', '')),
                        'assignees': row_data.get('assignees', current_record.get('assignees') or []),
                        'participants': row_data.get('participants', current_record.get('participants') or []),
                        'version': row_data.get('version', current_record.get('version', '')),
                        'others': row_data.get('others', current_record.get('others', '')),
                        'description': row_data.get('description', current_record.get('content', '')),
                        'due_date': row_data.get('due_date', current_record.get('due_date')),
                        'created_time': current_record.get('created_time'),
                        'modified_time': current_record.get('modified_time'),
                        'url': current_record.get('url'),
                        'linked_ticket': row_data.get('linked_ticket', current_record.get('linked_ticket')),
                        'deleted': False
                    }
                    connection_config = decrypt_config(json.loads(project_connection.config))
                    image_data_map = prepare_image_data_for_adapter(project_uuid, merged_task.get('description'))
                    if image_data_map:
                        merged_task['image_data_map'] = image_data_map
                    try:
                        update_general_task_via_adapter(connection_config, source_task_id, merged_task)
                    except ValueError as e:
                        logger.warning(f'batch update general task adapter error: {e}')
                        return api_error(status.HTTP_400_BAD_REQUEST, str(e))
                    update_row['row'].update(build_general_task_row_data(merged_task))
                    update_row['row']['source_task_id'] = source_task_id
                    old_value, new_value = build_general_task_change_values(current_record, row_data, changed_task_fields)
                    linked_ticket = merged_task.get('linked_ticket')
                    if linked_ticket and old_value and new_value:
                        general_task_events.append({
                            'record_id': row_id,
                            'old_value': old_value,
                            'new_value': new_value,
                        })

            # Support outdated field for all connection types
            if 'outdated' in row_data:
                update_row['row']['outdated'] = row_data.get('outdated') if row_data.get(
                    'outdated') is not None else False
                update_row['row']['record_modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()

            # Support unread field for EMAIL type only
            if project_connection.type == ConnectionType.EMAIL.value and 'unread' in row_data:
                update_row['row']['unread'] = row_data.get('unread') if row_data.get('unread') is not None else False
                update_row['row']['record_modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()

            if project_connection.type == ConnectionType.EMAIL.value and 'tags' in row_data:
                update_row['row']['tags'] = row_data.get('tags')
                update_row['row']['record_modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()

            if update_row['row']:
                update_rows.append(update_row)

        if not update_rows:
            return Response({'success': True})

        try:
            seadb_api.update_rows(project_uuid, table_name, update_rows)
        except Exception as e:
            logger.error(f'batch update connection records error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        for event in general_task_events:
            send_connection_data_event(
                project_uuid, connection_id, event['record_id'],
                ConnectionType.GENERAL_TASK.value,
                {
                    'type': 'general_task_updated',
                    'old_value': event['old_value'],
                    'new_value': event['new_value'],
                }
            )

        return Response({'success': True})

    # def delete(self, request, project_uuid, connection_id):
    #     if not is_org_context(request):
    #         error_msg = 'Feature is not enabled.'
    #         return api_error(status.HTTP_403_FORBIDDEN, error_msg)

    #     record_ids = request.data.get('record_ids')
    #     if not record_ids or not isinstance(record_ids, list):
    #         error_msg = 'record_ids must be a non-empty list.'
    #         return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

    #     try:
    #         record_ids = [int(record_id) for record_id in record_ids]
    #     except (ValueError, TypeError):
    #         error_msg = 'record_ids must be a list of integers.'
    #         return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

    #     if not record_ids:
    #         return Response({'success': True})

    #     project = Projects.objects.get_project_by_uuid(project_uuid)
    #     if not project:
    #         error_msg = f'Project {project_uuid} not found.'
    #         return api_error(status.HTTP_404_NOT_FOUND, error_msg)
    #     workspace = project.workspace

    #     username = request.user.username
    #     if not check_project_permission(username, workspace.owner):
    #         error_msg = 'Permission denied.'
    #         return api_error(status.HTTP_403_FORBIDDEN, error_msg)

    #     project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
    #     if not project_connection:
    #         error_msg = f'project_connection {connection_id} not found.'
    #         return api_error(status.HTTP_404_NOT_FOUND, error_msg)

    #     if project_connection.type != ConnectionType.EMAIL.value:
    #         error_msg = f'Connection type {project_connection.type} does not support deleting records.'
    #         return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

    #     update_rows = []
    #     record_modified_time = datetime.datetime.now(datetime.UTC).isoformat()
    #     for record_id in record_ids:
    #         update_rows.append({
    #             'pk': record_id,
    #             'row': {
    #                 ThreadTable.deleted.name: True,
    #                 ThreadTable.record_modified_time.name: record_modified_time,
    #             }
    #         })

    #     table_name = ThreadTable.gen_table_name(connection_id)
    #     seadb_api = SeaDBAPI()

    #     try:
    #         seadb_api.update_rows(project_uuid, table_name, update_rows)
    #     except Exception as e:
    #         logger.error(f'batch delete connection records error: {e}')
    #         error_msg = 'Internal Server Error'
    #         return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    #     return Response({'success': True})


class ProjectConnectionReplyEmailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request, project_uuid, connection_id):
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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if project_connection.type != ConnectionType.EMAIL.value:
            error_msg = f'Connection type {project_connection.type} does not support replying email.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        content = (request.data.get('content') or '').strip()
        config = decrypt_config(json.loads(project_connection.config))

        seadb_api = SeaDBAPI()
        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)

        # email_id is the _pk of the email table to reply to (required)
        email_id = request.data.get('email_id')
        if not email_id:
            error_msg = 'email_id is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            email_id = int(email_id)
        except (TypeError, ValueError):
            error_msg = 'email_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        target_email = email_seadb_api.get_email_by_pk(connection_id, email_id)
        if not target_email:
            error_msg = 'email_id not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # Get thread_id from email_table
        thread_id = target_email.get('thread_id')
        if not thread_id:
            error_msg = 'No thread_id found in email.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        to_text = request.data.get('to') or target_email.get('email_from')
        to_emails = extract_email_addresses(to_text)
        if not to_emails:
            error_msg = 'to invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        cc_text = request.data.get('cc')
        cc_emails = extract_email_addresses(cc_text)

        subject = request.data.get('subject')
        if not subject:
            subject = target_email.get('title')
        if not subject.lower().startswith('re:'):
            subject = f'Re: {subject}'

        html_content = request.data.get('html_content')
        target_message_id = target_email.get('message_id')

        # Generate message_id before sending
        sender_email = config.get('sender_email') or config.get('username')
        domain = sender_email.split('@')[1] if '@' in sender_email else None
        message_id = make_msgid(domain=domain)


        # Send email
        send_info = {
            'message': content,
            'html_message': html_content,
            'send_to': to_emails,
            'copy_to': cc_emails,
            'subject': subject,
            'in_reply_to': target_message_id,
            'message_id': message_id,
        }

        try:
            send_res = toggle_send_email(config, send_info)
        except EmailConfigError as e:
            logger.error('email config error, connection_id: %s, error: %s', connection_id, e)
            error_msg = 'Email connection config is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except EmailSendError as e:
            logger.error('reply email failed, connection_id: %s, thread_id: %s, error: %s', connection_id, thread_id, e)
            error_msg = 'Failed to send email.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if send_res.get('config_updated'):
            persist_project_connection_config(project_connection, config)

        sender_name = config.get('sender_name', '')
        # Get Fastmail EMAILID if available
        email_id = send_res.get('email_id')
        origin_thread_id = send_res.get('origin_thread_id') or target_email.get('origin_thread_id')

        email_data = {
            'sender_name': sender_name,
            'sender_email': sender_email,
            'email_to': to_text,
            'cc': cc_text,
            'subject': subject,
            'content': content,
            'html_content': html_content,
            'reply_to_message_id': target_message_id,
            'origin_thread_id': origin_thread_id,
            'message_id': message_id,
            'email_id': email_id,
        }
        try:
            pk = email_seadb_api.save_reply_email(project_uuid, connection_id, thread_id, email_data)
            email_data['_pk'] = pk
        except Exception as e:
            logger.error('save reply email failed, connection_id: %s, thread_id: %s, error: %s', connection_id, thread_id, e)
            error_msg = 'Failed to save reply email.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(email_data, status=status.HTTP_200_OK)


class ProjectConnectionDeleteEmailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def _delete_one_thread(self, project_uuid, connection_id, config, thread_id, seadb_api, email_seadb_api):
        emails = email_seadb_api.get_emails_by_thread_id(connection_id, thread_id)
        if not emails:
            return False, 'No emails found in this thread.'

        # Skip already-deleted emails (retry only processes remaining)
        undeleted = [e for e in emails if not e.get('deleted')]
        if not undeleted:
            return self._mark_thread_deleted(project_uuid, connection_id, thread_id, seadb_api)

        # Delete one email at a time, marking each as deleted locally
        email_table_name = SchemaTables.EMAIL.table_name(connection_id)
        deleted_any = False
        last_error = None

        for email in undeleted:
            message_id = email.get('message_id')
            if not message_id:
                continue

            try:
                result = toggle_delete_emails(config, [{'message_id': message_id}])
            except (EmailConfigError, EmailDeleteError) as e:
                logger.error('delete email failed, email_pk: %s, error: %s', email['_pk'], e)
                last_error = str(e)
                continue

            if result.get('deleted_count', 0) > 0:
                seadb_api.update_rows(project_uuid, email_table_name, [{
                    'pk': int(email['_pk']),
                    'row': {'deleted': True}
                }])
                deleted_any = True

        if not deleted_any:
            return False, last_error or 'Failed to delete any emails from remote server.'

        # Only mark thread deleted if all its emails are now deleted
        if all(e.get('deleted') for e in emails):
            return self._mark_thread_deleted(project_uuid, connection_id, thread_id, seadb_api)

        return True, None  # partial success, will retry remaining

    def _mark_thread_deleted(self, project_uuid, connection_id, thread_id, seadb_api):
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        thread_table_name = SchemaTables.THREAD.table_name(connection_id)
        seadb_api.update_rows(project_uuid, thread_table_name, [{
            'pk': thread_id,
            'row': {
                SchemaTables.THREAD.column.deleted.name: True,
                SchemaTables.THREAD.column.record_modified_time.name: now_datetime,
            }
        }])
        return True, None

    @require_org_context
    def post(self, request, project_uuid, connection_id):
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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if project_connection.type != ConnectionType.EMAIL.value:
            error_msg = f'Connection type {project_connection.type} does not support deleting email.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        config = decrypt_config(json.loads(project_connection.config))

        seadb_api = SeaDBAPI()
        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        thread_ids = request.data.get('thread_ids')
        if thread_ids is None:
            thread_id = request.data.get('thread_id')
            if not thread_id:
                return api_error(status.HTTP_400_BAD_REQUEST, 'thread_id is required.')
            thread_ids = [thread_id]
        elif not isinstance(thread_ids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'thread_ids invalid.')

        normalized_thread_ids = []
        for thread_id in thread_ids:
            try:
                normalized_thread_ids.append(int(thread_id))
            except (TypeError, ValueError):
                return api_error(status.HTTP_400_BAD_REQUEST, 'thread_id invalid.')

        deleted_thread_ids = []
        failed_threads = []
        for thread_id in dict.fromkeys(normalized_thread_ids):
            ok, error_msg = self._delete_one_thread(
                project_uuid,
                connection_id,
                config,
                thread_id,
                seadb_api,
                email_seadb_api,
            )
            if ok:
                deleted_thread_ids.append(thread_id)
            else:
                failed_threads.append({'thread_id': thread_id, 'error': error_msg})

        status_code = status.HTTP_200_OK if deleted_thread_ids else status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response({
            'success': bool(deleted_thread_ids),
            'deleted_thread_ids': deleted_thread_ids,
            'failed_threads': failed_threads,
        }, status=status_code)


class ProjectConnectionReplyDiscourseView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def post(self, request, project_uuid, connection_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'Project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if project_connection.type != ConnectionType.DISCOURSE_FORUM.value:
            error_msg = f'Connection type {project_connection.type} does not support replying to Discourse topic.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        content = (request.data.get('content') or '').strip()
        if not content:
            error_msg = 'content is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(content) < 6:
            error_msg = 'The content is too short, at least 6 characters.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        _pk = request.data.get('_pk')
        if not _pk:
            error_msg = '_pk is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            _pk = int(_pk)
        except (TypeError, ValueError):
            error_msg = '_pk invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        config = decrypt_config(json.loads(project_connection.config))
        discourse_url = config.get('url')
        api_key = config.get('api_key')
        api_username = config.get('api_username')

        if not discourse_url or not api_key or not api_username:
            error_msg = 'Discourse connection config is incomplete.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        seadb_api = SeaDBAPI()
        discourse_seadb_api = DiscourseSeaDBAPI(project_uuid, seadb_api=seadb_api)

        topic = discourse_seadb_api.get_topic_by_pk(connection_id, _pk)
        if not topic:
            error_msg = 'Topic not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        topic_id = topic.get('topic_id')

        discourse_api = DiscourseForumAPI(discourse_url, api_key, api_username)
        try:
            post_data = discourse_api.create_post(topic_id, content)
        except DiscourseForumAPIException as e:
            logger.error('reply discourse topic failed, connection_id: %s, topic_id: %s, error: %s', connection_id, topic_id, e)
            error_msg = 'Failed to reply to Discourse topic.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        post_number = post_data.get('post_number', 0)
        reply_data = {
            'post_number': post_number,
            'content': content,
            'author': api_username,
            'topic_pk': _pk,
        }
        try:
            pk = discourse_seadb_api.add_reply(project_uuid, connection_id, topic_id, reply_data)
            reply_data['_pk'] = pk
        except Exception as e:
            logger.error('save reply to discourse seadb failed, connection_id: %s, topic_id: %s, error: %s', connection_id, topic_id, e)
            error_msg = 'Failed to save reply.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(reply_data, status=status.HTTP_200_OK)


class ConnectionFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, connection_id, file_path):
        """
        Permission:
        1. group member
        """
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
        try:
            s3_meta = get_connection_file_head_from_s3(project_uuid, str(connection_id), file_path)
        except FileNotFound:
            error_msg = 'File not exist'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        etag = s3_meta.get('ETag')
        if if_none_match_hit(request, etag):
            not_modified = HttpResponseNotModified()
            not_modified['Cache-Control'] = 'max-age=604800, private'
            return not_modified

        try:
            file = get_connection_file_from_s3(project_uuid, str(connection_id), file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(file)
        response['Cache-Control'] = 'max-age=604800, private'
        if etag:
            response['ETag'] = etag
        if s3_meta.get('LastModified'):
            response['Last-Modified'] = formatdate(int(s3_meta['LastModified'].timestamp()), usegmt=True)
        else:
            response['Last-Modified'] = formatdate(int(timezone.now().timestamp()), usegmt=True)
        return response


class ZipEmailAttachments(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid, connection_id, email_id):
        """
        Permission:
        1. group member
        """
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

        seadb_api = SeaDBAPI()
        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        target_email = email_seadb_api.get_email_by_pk(connection_id, email_id)
        if not target_email:
            error_msg = 'email_id not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        attachments = target_email.get('attachments')
        if not attachments:
            error_msg = 'attachments not exist'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        params = {
            'project_uuid': str(project_uuid),
            'connection_id': connection_id,
            'pk': email_id,
        }

        try:
            task_id = zip_email_attachments(params)
        except Exception as e:
            logger.exception('zip email attachments task error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class QueryIOStatus(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        task_id = request.GET.get('task_id', '')
        if not task_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_id invalid.')

        resp = query_io_task_status(task_id)
        try:
            resp_json = resp.json()
        except Exception:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        error_msg = resp_json.get('error_msg')
        if resp.status_code == 500 and error_msg:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not resp.ok:
            return api_error(resp.status_code, error_msg)

        return Response(resp_json)


class DownloadEmailAttachments(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, connection_id, email_id):
        """
        Permission:
        1. group member
        """
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

        seadb_api = SeaDBAPI()
        email_seadb_api = EmailSeaDBAPI(project_uuid, seadb_api=seadb_api)
        target_email = email_seadb_api.get_email_by_pk(connection_id, email_id)
        if not target_email:
            error_msg = 'email_id not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        attachments = target_email.get('attachments')
        if not attachments:
            error_msg = 'attachments not exist'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project_uuid = uuid_str_to_32_chars(project_uuid)

        os.makedirs(EMAIL_ATTACHMENT_TEMP_DIR, exist_ok=True)
        local_zip_path = os.path.join(EMAIL_ATTACHMENT_TEMP_DIR, project_uuid, connection_id, str(email_id), EMAIL_ATTACHMENTS_ZIP_NAME)

        if not os.path.exists(local_zip_path):
            error_msg = 'File not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        etag, last_modified_time = gen_file_etag_and_modified_time(local_zip_path)
        if if_none_match_hit(request, etag):
            not_modified = HttpResponseNotModified()
            not_modified['Cache-Control'] = 'max-age=604800, private'
            return not_modified

        response = FileResponse(
            open(local_zip_path, "rb"),
            content_type="application/zip",
            as_attachment=True,
            filename=EMAIL_ATTACHMENTS_ZIP_NAME
        )
        response['Cache-Control'] = 'max-age=604800, private'
        response['ETag'] = etag
        response['Last-Modified'] = formatdate(int(last_modified_time), usegmt=True)
        return response

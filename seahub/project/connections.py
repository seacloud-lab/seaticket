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
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.utils import uuid_str_to_32_chars, gen_file_etag_and_modified_time
from seahub.project.models import Projects, ProjectConnections, decrypt_config, \
    ConnectionsViews, ProjectGithubAppInstallation
from seahub.project.utils import check_project_admin_permission, check_project_permission, url_to_filename, \
    extract_email_addresses, get_connection_general_task_related_users
from seahub.utils.indexer import add_connection_sync_task, manual_sync_connection
from seahub.utils.webhook import update_github_issue_by_webhook, update_discourse_topic_by_webhook
from seahub.utils.storage import get_connection_file_from_s3, FileNotFound
from seahub.utils.storage import if_none_match_hit, get_connection_file_head_from_s3
from seahub.seadb_models.utils import init_site_seadb_table, init_discourse_forum_seadb_table, \
    init_github_issues_seadb_table, list_discourse_forum_replies_records, \
    list_connection_view_records, list_github_issue_record_details, init_seafile_seadb_table, init_email_seadb_table, \
    list_seafile_record_details, list_site_record_details, list_email_record_details, get_issue_record_by_pk, \
    init_notion_seadb_table, list_notion_record_details, init_general_task_seadb_table, \
    list_general_task_record_details, ensure_general_task_column_options, build_general_task_row_data
from seahub.seadb_models.email_seadb_api import EmailSeaDBAPI
from seahub.seadb_models.github_seadb_api import GitHubSeaDBAPI
from seahub.seadb_models.discourse_seadb_api import DiscourseSeaDBAPI
from seahub.seadb_models.general_task_seadb_api import GeneralTaskSeaDBAPI
from seahub.project.constants import ConnectionType, CrawlStatus, MANUAL_SYNC_INTERVAL, MANUAL_CRAWL_INTERVAL, \
    EMAIL_ATTACHMENT_TEMP_DIR, EMAIL_ATTACHMENTS_ZIP_NAME, GENERAL_TASK_MUTABLE_FIELDS
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.seadb_models.models import WebCrawlTable, ThreadTable, DiscourseTopicsTable, GithubIssuesTable, \
    SeafileTable, WebCrawlTable, ThreadTable, NotionTable, EmailTable, GeneralTaskTable
from seahub.project.seadb_api import SeaDBAPI
from seahub.utils.decorators import require_org_context
from seahub.tickets.ticket_utils import build_linked_ticket_titles_map, get_ticket
from seahub.project.utils import LINKED_TICKET_SUPPORT_TYPES
from seahub.settings import GITHUB_WEBHOOK_SECRET, ENABLE_GENERAL_TASK
from seahub.project.github_issues_api import GitHubAPI
from seahub.utils.email_sender import toggle_send_email, EmailSendError, EmailConfigError
from seahub.project.discourse_api import DiscourseForumAPI, DiscourseForumAPIException
from seahub.utils.io import zip_email_attachments, query_io_task_status
from seahub.project.utils import normalize_general_task_payload, create_general_task_via_adapter, update_general_task_via_adapter


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')

logger = logging.getLogger(__name__)



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
        enable_create = ProjectConnections.objects.enable_create(project_uuid, connection_type, config)
        if not enable_create:
            error_msg = 'Name or config is not unique'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            record = ProjectConnections.objects.create(request.user.username, project_uuid, connection_type, name, config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        connection_id = record.id
        seadb_api = SeaDBAPI()
        try:
            if connection_type == ConnectionType.SITE.value:
                init_site_seadb_table(seadb_api, project.uuid, connection_id)
            elif connection_type == ConnectionType.DISCOURSE_FORUM.value:
                init_discourse_forum_seadb_table(seadb_api, project.uuid, connection_id)
            elif connection_type == ConnectionType.GITHUB_ISSUE.value:
                init_github_issues_seadb_table(seadb_api, project.uuid, connection_id)
            elif connection_type == ConnectionType.SEAFILE.value:
                init_seafile_seadb_table(seadb_api, project.uuid, connection_id)
            elif connection_type == ConnectionType.EMAIL.value:
                init_email_seadb_table(seadb_api, project.uuid, connection_id)
            elif connection_type == ConnectionType.NOTION.value:
                init_notion_seadb_table(seadb_api, project.uuid, connection_id)
            elif connection_type == ConnectionType.GENERAL_TASK.value:
                if not ENABLE_GENERAL_TASK:
                    error_msg = 'General task connection is not enabled'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                init_general_task_seadb_table(seadb_api, project.uuid, connection_id)
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
        return Response({'record': record.to_dict()}, status=status.HTTP_201_CREATED)


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
                error_msg = 'Name or config is not unique'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            try:
                record = ProjectConnections.objects.create(request.user.username, project_uuid, connection_type, name, config)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            connection_id = record.id
            seadb_api = SeaDBAPI()
            try:
                init_github_issues_seadb_table(seadb_api, project.uuid, connection_id)
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
            now = datetime.datetime.now(datetime.timezone.utc)
            time_diff = now - project_connection.last_sync_time
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

        project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
        if not project_connection:
            error_msg = f'project_connection {connection_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if project_connection.type != ConnectionType.GITHUB_ISSUE.value:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Connection type invalid.')

        if not project_connection.is_active:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Connection is inactive.')

        # GitHub requires `state` to be present when updating `state_reason`.
        update_state = state.lower() if isinstance(state, str) else None
        update_state_reason = state_reason.lower() if isinstance(state_reason, str) else None
        if update_state_reason is not None and update_state is None:
            if update_state_reason == 'reopened':
                update_state = 'open'
            elif update_state_reason in ('completed', 'not_planned', 'duplicate'):
                update_state = 'closed'
            else:
                return api_error(status.HTTP_400_BAD_REQUEST, 'state_reason is invalid.')

        config = decrypt_config(json.loads(project_connection.config))
        installation_id = config.get('installation_id')
        if not installation_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'GitHub auth config missing.')

        seadb_api = SeaDBAPI()
        try:
            issue_record, _ = get_issue_record_by_pk(seadb_api, project_uuid, connection_id, _pk)
        except Exception as e:
            logger.error(f'get github issue details error: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        issue_number = issue_record.get('issue_number')
        server_url = config.get('repository')
        try:
            path = urlparse(server_url).path
            parts = path.strip("/").split("/")
            repo_owner, repo_name = parts[0], parts[1]
        except Exception as e:
            logger.error(f"Github repository is invalid {e}")
            return api_error(status.HTTP_400_BAD_REQUEST, 'Github repository is invalid.')

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
                issue_type=issue_type if issue_type is not None else None
            )
        except Exception as e:
            logger.error(f'github issue update error: {e}')
            response = getattr(e, 'response', None)
            if response is not None and response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                error_msg = 'Too many requests.'
                return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            github_seadb_api = GitHubSeaDBAPI(project_uuid, seadb_api=seadb_api)
            github_seadb_api.update_issue_record(project_uuid, connection_id, _pk, issue_data)
        except Exception as e:
            logger.error(f'update github issue in seadb error: {e}')
            if e.args and e.args[0] == 409:
                error_msg = 'Conflict with another transaction'
                return api_error(status.HTTP_409_CONFLICT, error_msg)
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
        ]
        if project_connection.type not in supported_types:
            error_msg = f'Connection type {project_connection.type} does not support record editing.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_cls = None
        if project_connection.type == ConnectionType.DISCOURSE_FORUM.value:
            table_cls = DiscourseTopicsTable
        elif project_connection.type == ConnectionType.GITHUB_ISSUE.value:
            table_cls = GithubIssuesTable
        elif project_connection.type == ConnectionType.SITE.value:
            table_cls = WebCrawlTable
        elif project_connection.type == ConnectionType.SEAFILE.value:
            table_cls = SeafileTable
        elif project_connection.type == ConnectionType.EMAIL.value:
            table_cls = ThreadTable
        elif project_connection.type == ConnectionType.NOTION.value:
            table_cls = NotionTable
        elif project_connection.type == ConnectionType.GENERAL_TASK.value:
            table_cls = GeneralTaskTable

        update_row = {'pk': int(record_id), 'row': {}}
        seadb_api = SeaDBAPI()

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
                    'content': row_data.get('content', row_data.get('description', current_record.get('content', ''))),
                    'due_date': row_data.get('due_date', current_record.get('due_date')),
                    'created_time': current_record.get('created_time'),
                    'modified_time': current_record.get('modified_time'),
                    'deleted': False,
                }
                connection_config = decrypt_config(json.loads(project_connection.config))
                adapter_task = update_general_task_via_adapter(
                    connection_config,
                    source_task_id,
                    normalize_general_task_payload(merged_task),
                )
                ensure_general_task_column_options(seadb_api, project_uuid, connection_id, [adapter_task])
                update_row['row'].update(build_general_task_row_data(adapter_task))
                update_row['row']['source_task_id'] = source_task_id

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

        table_name = table_cls.gen_table_name(connection_id)

        try:
            seadb_api.update_rows(project_uuid, table_name, [update_row])
        except Exception as e:
            logger.error(f'update connection record error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class ProjectConnectionRecordsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid, connection_id):
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

        task_payload = normalize_general_task_payload(request.data or {})
        task_title = task_payload.get('title')
        if not task_title:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Task title is required.')
        task_payload['title'] = task_title
        task_payload['status'] = task_payload.get('status') or 'new'
        task_payload['priority'] = task_payload.get('priority') or 'medium'
        task_payload['size'] = task_payload.get('size') or 'medium'

        try:
            connection_config = decrypt_config(json.loads(project_connection.config))
            created_task = create_general_task_via_adapter(connection_config, task_payload)
        except Exception as e:
            logger.error(f'create general task error: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))

        seadb_api = SeaDBAPI()
        row_data = build_general_task_row_data(created_task)
        try:
            ensure_general_task_column_options(seadb_api, project_uuid, connection_id, [created_task])
            res = seadb_api.insert_rows(project_uuid, GeneralTaskTable.gen_table_name(connection_id), [row_data])
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
        ]
        if project_connection.type not in supported_types:
            error_msg = f'Connection type {project_connection.type} does not support record editing.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_cls = None
        if project_connection.type == ConnectionType.DISCOURSE_FORUM.value:
            table_cls = DiscourseTopicsTable
        elif project_connection.type == ConnectionType.GITHUB_ISSUE.value:
            table_cls = GithubIssuesTable
        elif project_connection.type == ConnectionType.SITE.value:
            table_cls = WebCrawlTable
        elif project_connection.type == ConnectionType.SEAFILE.value:
            table_cls = SeafileTable
        elif project_connection.type == ConnectionType.EMAIL.value:
            table_cls = ThreadTable
        elif project_connection.type == ConnectionType.NOTION.value:
            table_cls = NotionTable
        elif project_connection.type == ConnectionType.GENERAL_TASK.value:
            table_cls = GeneralTaskTable

        update_rows = []
        seadb_api = SeaDBAPI()
        for record in records_data:
            row_id = record.get('row_id')
            row_data = record.get('row', {})
            if not row_id or not isinstance(row_data, dict):
                continue
            update_row = {'pk': int(row_id), 'row': {}}

            if project_connection.type == ConnectionType.GENERAL_TASK.value:
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
                        'content': row_data.get('content', row_data.get('description', current_record.get('content', ''))),
                        'due_date': row_data.get('due_date', current_record.get('due_date')),
                        'created_time': current_record.get('created_time'),
                        'modified_time': current_record.get('modified_time'),
                        'deleted': False,
                    }
                    connection_config = decrypt_config(json.loads(project_connection.config))
                    adapter_task = update_general_task_via_adapter(
                        connection_config,
                        source_task_id,
                        normalize_general_task_payload(merged_task),
                    )
                    ensure_general_task_column_options(seadb_api, project_uuid, connection_id, [adapter_task])
                    update_row['row'].update(build_general_task_row_data(adapter_task))
                    update_row['row']['source_task_id'] = source_task_id

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

        table_name = table_cls.gen_table_name(connection_id)

        try:
            seadb_api.update_rows(project_uuid, table_name, update_rows)
        except Exception as e:
            logger.error(f'batch update connection records error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

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

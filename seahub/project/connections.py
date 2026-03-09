# -*- coding: utf-8 -*-
import hmac
import hashlib
import logging
import json
import datetime
import sys
from email.utils import formatdate

from django.utils.translation import gettext as _
from django.http import FileResponse
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
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.project.models import Projects, ProjectConnections, decrypt_config, \
    ConnectionsViews, ProjectGithubAppInstallation
from seahub.project.utils import check_project_admin_permission, check_project_permission, url_to_filename
from seahub.utils.indexer import add_connection_sync_task, manual_sync_connection
from seahub.utils.webhook import update_github_issue_by_webhook, update_discourse_topic_by_webhook
from seahub.utils.storage import get_file_from_s3_web_crawl, FileNotFound
from seahub.seadb_models.utils import init_site_seadb_table, init_discourse_forum_seadb_table, \
    init_github_issues_seadb_table, list_discourse_forum_replies_records, \
    list_connection_view_records, list_github_issue_record_details, init_seafile_seadb_table, init_email_seadb_table, \
    list_seafile_record_details, list_site_record_details, list_email_record_details
from seahub.project.constants import ConnectionType, CrawlStatus, MANUAL_SYNC_INTERVAL, MANUAL_CRAWL_INTERVAL
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.seadb_models.models import WebCrawlTable, ThreadTable, DiscourseTopicsTable, GithubIssuesTable, \
    SeafileTable, WebCrawlTable, ThreadTable
from seahub.project.seadb_api import SeaDBAPI
from seahub.utils.decorators import require_org_context
from seahub.tickets.ticket_utils import build_linked_ticket_titles_map
from seahub.project.utils import LINKED_TICKET_SUPPORT_TYPES
from seahub.settings import GITHUB_WEBHOOK_SECRET

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

        records = ProjectConnections.objects.filter(project=project, deleted=False)[start:end]
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
        enable_create = ProjectConnections.objects.enable_create(project, connection_type, config)
        if not enable_create:
            error_msg = 'Name or config is not unique'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            record = ProjectConnections.objects.create(request.user.username, project, connection_type, name, config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        connection_id = record.id
        seadb_api = SeaDBAPI(request.user.username)
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

            enable_create = ProjectConnections.objects.enable_create(project, connection_type, config)
            if not enable_create:
                error_msg = 'Name or config is not unique'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            try:
                record = ProjectConnections.objects.create(request.user.username, project, connection_type, name, config)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            connection_id = record.id
            seadb_api = SeaDBAPI(request.user.username)
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
            record = ProjectConnections.objects.modify(username, project, project_connection.type, connection_id, name,
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
            ProjectConnections.objects.filter(project=project, id=connection_id).update(deleted=True)
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
            seadb_api = SeaDBAPI(username)
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

        return Response({
            'records': records,
            'columns': columns,
            'name': project_connection.name,
            'type': project_connection.type,
            'ticket_pk_to_ticket_title': ticket_pk_to_ticket_title,
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


class ProjectConnectionRowDetailView(APIView):
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

        _pk = request.GET.get('_pk')
        if not _pk:
            error_msg = 'Missing _pk.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        seadb_api = SeaDBAPI(username)
        if project_connection.type == ConnectionType.DISCOURSE_FORUM.value:
            record = list_discourse_forum_replies_records(seadb_api, project_uuid, connection_id, _pk)
        elif project_connection.type == ConnectionType.SITE.value:
            record = list_site_record_details(seadb_api, project_uuid, connection_id, _pk)
            url = record.get('url', '')
            if url:
                filename = url_to_filename(url)
                uuid_32_chars = uuid_str_to_32_chars(project_uuid)
                file = get_file_from_s3_web_crawl(uuid_32_chars, connection_id, filename)
                if file:
                    record['content'] = json.loads(file.read()).get('content')
        elif project_connection.type == ConnectionType.GITHUB_ISSUE.value:
            record = list_github_issue_record_details(seadb_api, project_uuid, connection_id, _pk)
        elif project_connection.type == ConnectionType.SEAFILE.value:
            record = list_seafile_record_details(seadb_api, project_uuid, connection_id, _pk)
        elif project_connection.type == ConnectionType.EMAIL.value:
            record = list_email_record_details(seadb_api, project_uuid, connection_id, _pk)
        else:
            error_msg = 'type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        record['connection_type'] = project_connection.type
        record['connection_name'] = project_connection.name

        return Response(record)


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
        records = ProjectConnections.objects.filter(project=project, deleted=False, id__in=connection_ids)
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

        update_row = {'pk': int(record_id), 'row': {}}

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

        if not update_row['row']:
            return Response({'success': True})

        table_name = table_cls.gen_table_name(connection_id)
        seadb_api = SeaDBAPI(username)

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

        update_rows = []
        for record in records_data:
            row_id = record.get('row_id')
            row_data = record.get('row', {})
            if not row_id or not isinstance(row_data, dict):
                continue
            update_row = {'pk': int(row_id), 'row': {}}

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
        seadb_api = SeaDBAPI(username)

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
    #     seadb_api = SeaDBAPI(username)

    #     try:
    #         seadb_api.update_rows(project_uuid, table_name, update_rows)
    #     except Exception as e:
    #         logger.error(f'batch delete connection records error: {e}')
    #         error_msg = 'Internal Server Error'
    #         return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    #     return Response({'success': True})


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
        project_uuid = uuid_str_to_32_chars(project_uuid)
        try:
            file = get_file_from_s3_web_crawl(project_uuid, str(connection_id), file_path)
        except FileNotFound:
            error_msg = 'File not exist'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(file)
        response['Cache-Control'] = 'max-age=604800, public'
        response['ETag'] = '"' + str(sys.getsizeof(file)) + '"'
        response['Last-Modified'] = formatdate(int(timezone.now().timestamp()), usegmt=True)
        return response

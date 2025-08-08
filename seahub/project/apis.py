# -*- coding: utf-8 -*-
import os
import sys
import logging
import json
from dateutil.relativedelta import relativedelta
from email.utils import formatdate

from django.utils import timezone
from django.utils.translation import gettext as _
from django.http import HttpResponse, FileResponse

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.project.models import Workspaces, Projects, ProjectConnections, Tickets, TicketReplies, \
    TicketTags, TicketParticipants, ProjectTags
from seahub.project.utils import check_project_admin_permission, check_project_permission, \
    add_init_crawl_site_task, add_index_seafile_task, get_project_related_users, encrypt_config, decrypt_config, \
    create_default_project_tags, gen_project_tags_dict, upload_file_to_tmp_dir, get_file_from_s3, \
    replace_file_url_in_content, upload_files_to_s3, delete_file_from_s3, gen_tmp_upload_file_path, add_github_issues_index_task
from seahub.project.constants import ConnectionType, TICKET_STATUS, TICKET_TYPE


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


class ProjectRelatedUsersView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        # argument check
        # name
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            related_users = get_project_related_users(workspace.owner)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"related_users": related_users})


class ProjectConnectionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        """get project connection records
        """

         # role permission check
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

        records = ProjectConnections.objects.filter(project=project, deleted=False)[start:end]
        records = [record.to_dict() for record in records]

        return Response({'records': records}, status=status.HTTP_200_OK)

    def post(self, request, project_uuid):
        """modify project connection
        """

        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
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

        config = encrypt_config(json.loads(config))
        enable_create = ProjectConnections.objects.enable_create(project, connection_type, name, config)
        if not enable_create:
            error_msg = 'Name or config is not unique'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            record = ProjectConnections.objects.create(request.user.username, project, connection_type, name, config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if connection_type == ConnectionType.SITE.value:
            params = {
                'site_id': record.get('id', '')
            }
            add_init_crawl_site_task(params)
        elif connection_type == ConnectionType.SEAFILE.value:
            params = {
                'connection_id': record.get('id', '')
            }
            add_index_seafile_task(params)
        elif connection_type == ConnectionType.GITHUB_ISSUE.value:
            params = {
                'issues_sync_id': record.get('id', '')
            }
            add_github_issues_index_task(params)

        return Response({'record': record}, status=status.HTTP_201_CREATED)


class ProjectConnectionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, project_uuid, connection_id):
        """ modify connection
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.data.get('name')
        if not name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_config = request.data.get('config', {})
        if not new_config:
            error_msg = 'config invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        connection_type = request.data.get('type', '')
        if not ConnectionType.is_valid(connection_type):
            error_msg = f'Type {connection_type} not support.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

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

        project_connection = ProjectConnections.objects.get(id=connection_id)

        config = decrypt_config(json.loads(project_connection.config))
        new_config = decrypt_config(json.loads(new_config))
        config.update(new_config)
        config = encrypt_config(config)

        enable_modify = ProjectConnections.objects.enable_modify(project, connection_type, connection_id, name, config)
        if not enable_modify:
            error_msg = 'Please check input'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            record = ProjectConnections.objects.modify(username, project, connection_type, connection_id, name, config)
        except Exception as e:
            logger.error(f'modify {connection_id} error: {e}')
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'record': record.to_dict()}, status=status.HTTP_200_OK)

    def delete(self, request, project_uuid, connection_id):
        """delete connection
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
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


class TicketsAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

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
        owned = request.GET.get('owned')
        try:
            if owned == 'true':
                tickets = Tickets.objects.list_tickets_by_username(
                    project_uuid, username, start, end)
            else:
                tickets = Tickets.objects.list_tickets(
                    project_uuid, start, end)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        tags_dict = {}

        ticket_tags = TicketTags.objects.filter(ticket_id__in=[ticket.id for ticket in tickets])
        project_tags_dict = gen_project_tags_dict(project_uuid, key='id')
        for tag in ticket_tags:
            tag_info = project_tags_dict.get(tag.tag_id, None)
            if tag_info:
                if tag.ticket_id not in tags_dict:
                    tags_dict[tag.ticket_id] = [tag_info]
                else:
                    tags_dict[tag.ticket_id].append(tag_info)

        return Response({
            'tickets': [ticket.to_dict(tags_dict=tags_dict) for ticket in tickets],
        })

    def post(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        title = request.POST.get('title')
        if not title:
            error_msg = 'title invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        content_dict = request.POST.get('content')
        if not content_dict:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            content_dict = json.loads(content_dict)
        except:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not isinstance(content_dict, dict):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        content = content_dict.get('text')
        if not content:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        file_urls = content_dict.get('images')
        if file_urls and not isinstance(file_urls, list):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        participants = request.POST.get('participants')
        if participants is not None:
            try:
                participants = json.loads(participants)
            except:
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(participants, list):
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            participants = list(set(participants))
        ticket_type = request.data.get('type')
        if ticket_type is not None:
            if ticket_type not in TICKET_TYPE:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        tags = request.POST.get('tags')
        if tags is not None:
            try:
                tags = json.loads(tags)
            except:
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(tags, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                project_tags = ProjectTags.objects.filter(
                    project_uuid=project_uuid)
            except Exception as e:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not project_tags:  # init default tags
                project_tags = create_default_project_tags(project_uuid)
            project_tag_ids = [project_tag.id for project_tag in project_tags]
            for tag in tags:
                if tag not in project_tag_ids:
                    error_msg = 'tags invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            tags = list(set(tags))

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        if participants:
            for participant in participants:
                if not check_project_permission(participant, workspace.owner):
                    error_msg = 'participants invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        previous_ticket = Tickets.objects.get_previous_ticket_by_username(
            project_uuid, username)
        if previous_ticket and \
                previous_ticket.created_at > timezone.now() - relativedelta(seconds=30):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            ticket_status = 'open'
            ticket = Tickets.objects.create_ticket(
                project_uuid, username, title, content, ticket_status, ticket_type)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not ticket:
            error_msg = 'Too many requests'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        tags_dict = {}
        participants_dict = {}
        if tags:
            try:
                project_tags_dict = gen_project_tags_dict(project_uuid, key='id')
                ticket_tags = [TicketTags(
                    ticket_id=ticket.id,
                    tag_id=project_tags_dict.get(tag, {}).get('id'),
                ) for tag in tags if project_tags_dict.get(tag, None)]
                TicketTags.objects.bulk_create(ticket_tags)
                for tag in ticket_tags:
                    tag_info = project_tags_dict.get(tag.tag_id, None)
                    if tag_info:
                        if tag.ticket_id not in tags_dict:
                            tags_dict[tag.ticket_id] = [tag_info]
                        else:
                            tags_dict[tag.ticket_id].append(tag_info)
            except Exception as e:
                logger.error(e)
        if participants:
            try:
                ticket_participants = [TicketParticipants(
                    ticket_id=ticket.id,
                    participant=participant,
                ) for participant in participants]
                TicketParticipants.objects.bulk_create(ticket_participants)
                participants_dict[ticket.id] = participants
            except Exception as e:
                logger.error(e)

        return Response({'ticket': ticket.to_dict(
            tags_dict=tags_dict,
            participants_dict=participants_dict,
        )},status=status.HTTP_201_CREATED)


class TicketAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, ticket_number):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        start = 0
        end = 25
        try:
            ticket_replies = TicketReplies.objects.list_replies(
                ticket.id, start, end)
            ticket_tags = TicketTags.objects.filter(
                ticket_id=ticket.id)
            project_tags_dict = gen_project_tags_dict(project_uuid, key='id')
            ticket_participants = TicketParticipants.objects.filter(
                ticket_id=ticket.id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        tags_dict = {}
        for tag in ticket_tags:
            tag_info = project_tags_dict.get(tag.tag_id, None)
            if tag_info:
                if tag.ticket_id not in tags_dict:
                    tags_dict[tag.ticket_id] = [tag_info]
                else:
                    tags_dict[tag.ticket_id].append(tag_info)
        ticket = ticket.to_dict(
            tags_dict=tags_dict,
            participants_dict={ticket.id: [participant.participant for participant in ticket_participants]},
        )
        ticket['replies'] = [ticket_reply.to_dict() for ticket_reply in ticket_replies]
        return Response({'ticket': ticket})

    def put(self, request, project_uuid, ticket_number):
        """
        Permission:
        1. creator
        2. group admin, can modify status
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        title = request.data.get('title')

        content = None
        file_urls = None
        content_dict = request.data.get('content')
        if content_dict:
            try:
                content_dict = json.loads(content_dict)
            except:
                error_msg = 'content invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(content_dict, dict):
                error_msg = 'content invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            content = content_dict.get('text')
            if not content:
                error_msg = 'content invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            file_urls = content_dict.get('images')
            if file_urls and not isinstance(file_urls, list):
                error_msg = 'content invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        ticket_status = request.data.get('status')
        if ticket_status is not None:
            if ticket_status not in TICKET_STATUS:
                error_msg = 'status invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        ticket_type = request.data.get('type')
        if ticket_type is not None:
            if ticket_type not in TICKET_TYPE:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        participants = request.data.get('participants')
        if participants is not None:
            try:
                participants = json.loads(participants)
            except:
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(participants, list):
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            participants = list(set(participants))

        tags = request.data.get('tags')
        if tags is not None:
            try:
                tags = json.loads(tags)
            except:
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(tags, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                project_tags = ProjectTags.objects.filter(
                    project_uuid=project_uuid)
            except Exception as e:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not project_tags:  # init default tags
                project_tags = create_default_project_tags(project_uuid)
            project_tag_ids = [project_tag.id for project_tag in project_tags]
            for tag in tags:
                if tag not in project_tag_ids:
                    error_msg = 'tags invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            tags = list(set(tags))

        if not any([title, content, ticket_status, ticket_type]) \
                and participants is None and tags is None:
            error_msg = 'argument invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        if participants:
            for participant in participants:
                if not check_project_permission(participant, workspace.owner):
                    error_msg = 'participants invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if content and ticket.updated_at > timezone.now() - relativedelta(seconds=10):
            error_msg = 'Cannot be updated again within 10 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # permission check
        username = request.user.username

        # group admin can modify status
        if username != ticket.creator:
            if ticket_status and check_project_admin_permission(username, workspace.owner):
                ticket.status = ticket_status
                ticket.save()
                return Response({"ticket": ticket.to_dict()})
            else:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            if title:
                ticket.title = title
            if content:
                ticket.content = content
            if ticket_status or ticket_status == '':
                ticket.status = ticket_status
            if ticket_type or ticket_type == '':
                ticket.type = ticket_type
            ticket.updated_at = timezone.now()
            ticket.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if tags:
            try:
                project_tags_dict = gen_project_tags_dict(project_uuid, key='id')
                exist_ticket_tags = TicketTags.objects.filter(ticket_id=ticket.id)
                exist_tags = [project_tags_dict.get(tag.tag_id, {}).get('id') for tag in exist_ticket_tags if project_tags_dict.get(tag.tag_id, None)]
                tags_to_create = list(set(tags) - set(exist_tags))
                tags_to_delete = list(set(exist_tags) - set(tags))
                if tags_to_create:
                    project_tags_dict = gen_project_tags_dict(project_uuid, key='id')
                    ticket_tags = [TicketTags(
                        ticket_id=ticket.id,
                        tag_id=project_tags_dict.get(tag, {}).get('id'),
                    ) for tag in tags_to_create if project_tags_dict.get(tag, None)]
                    TicketTags.objects.bulk_create(ticket_tags)
                if tags_to_delete:
                    TicketTags.objects.filter(
                        ticket_id=ticket.id, tag_id__in=tags_to_delete).delete()
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if participants:
            try:
                exist_ticket_participants = TicketParticipants.objects.filter(ticket_id=ticket.id)
                exist_participants = [participant.participant for participant in exist_ticket_participants]
                participants_to_create = list(set(participants) - set(exist_participants))
                participants_to_delete = list(set(exist_participants) - set(participants))
                if participants_to_create:
                    ticket_participants = [TicketParticipants(
                        ticket_id=ticket.id,
                        participant=participant,
                    ) for participant in participants_to_create]
                    TicketParticipants.objects.bulk_create(ticket_participants)
                if participants_to_delete:
                    TicketParticipants.objects.filter(
                        ticket_id=ticket.id, participant__in=participants_to_delete).delete()
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            ticket_tags = TicketTags.objects.filter(
                ticket_id=ticket.id)
            project_tags_dict = gen_project_tags_dict(project_uuid, key='id')
            ticket_participants = TicketParticipants.objects.filter(
                ticket_id=ticket.id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        tags_dict = {}
        for tag in ticket_tags:
            tag_info = project_tags_dict.get(tag.tag_id, None)
            if tag_info:
                if tag.ticket_id not in tags_dict:
                    tags_dict[tag.ticket_id] = [tag_info]
                else:
                    tags_dict[tag.ticket_id].append(tag_info)
        ticket = ticket.to_dict(
            tags_dict=tags_dict,
            participants_dict={ticket.id: [participant.participant for participant in ticket_participants]},
        )
        return Response({'ticket': ticket})

    def delete(self, request, project_uuid, ticket_number):
        """
        Permission:
        1. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            ticket.deleted = True
            ticket.delete_time = timezone.now()
            ticket.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class TicketRepliesAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, ticket_number):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        try:
            current_page = int(request.GET.get('page', '2'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 2
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

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

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            ticket_replies = TicketReplies.objects.list_replies(
                ticket.id, start, end)
        except Exception as e:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'ticket_replies': [ticket_reply.to_dict() for ticket_reply in ticket_replies],
        })

    def post(self, request, project_uuid, ticket_number):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        content_dict = request.POST.get('content')
        if not content_dict:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            content_dict = json.loads(content_dict)
        except:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not isinstance(content_dict, dict):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        content = content_dict.get('text')
        if not content:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        file_urls = content_dict.get('images')
        if file_urls and not isinstance(file_urls, list):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        previous_ticket_reply = TicketReplies.objects.get_previous_reply_by_username(
            ticket.id, username)
        if previous_ticket_reply and \
                previous_ticket_reply.created_at > timezone.now() - relativedelta(seconds=30):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            ticket_reply = TicketReplies.objects.create_reply(
                ticket.id, username, content)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not ticket_reply:
            error_msg = 'Too many requests'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        try:
            ticket_replies_count = TicketReplies.objects.get_replies_count(
                ticket_id=ticket.id)
            ticket.reply_count = ticket_replies_count
            ticket.reply_updated_at = timezone.now()
            ticket.save()
        except Exception as e:
            logger.error(e)

        return Response({'ticket_reply': ticket_reply.to_dict()}, status=status.HTTP_201_CREATED)


class TicketReplyAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, project_uuid, ticket_number, reply_number):
        """
        Permission:
        1. creator
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        content_dict = request.data.get('content')
        if not content_dict:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            content_dict = json.loads(content_dict)
        except:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not isinstance(content_dict, dict):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        content = content_dict.get('text')
        if not content:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        file_urls = content_dict.get('images')
        if file_urls and not isinstance(file_urls, list):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        ticket_reply = TicketReplies.objects.get_reply(
            ticket.id, reply_number)
        if not ticket_reply:
            error_msg = 'Reply not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if username != ticket_reply.creator:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if ticket_reply.updated_at > timezone.now() - relativedelta(seconds=10):
            error_msg = 'Cannot be updated again within 10 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            ticket_reply.content = content
            ticket_reply.updated_at = timezone.now()
            ticket_reply.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            ticket.reply_updated_at = ticket_reply.updated_at
            ticket.save()
        except Exception as e:
            logger.error(e)

        return Response({'ticket_reply': ticket_reply.to_dict()})

    def delete(self, request, project_uuid, ticket_number, reply_number):
        """
        Permission:
        1. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        ticket_reply = TicketReplies.objects.get_reply(
            ticket.id, reply_number)
        if not ticket_reply:
            error_msg = 'Reply not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            ticket_reply.deleted = True
            ticket_reply.delete_time = timezone.now()
            ticket_reply.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

class ProjectTagsAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        tickets_count = request.GET.get('tickets_count', '0')

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
            project_tags = ProjectTags.objects.filter(
                project_uuid=project_uuid)
        except Exception as e:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not project_tags:  # init default tags
            project_tags = create_default_project_tags(project_uuid)

        tickets_count_dict = {}
        if tickets_count == '1':
            ticket_tags = TicketTags.objects.filter(
                tag_id__in=[project_tag.id for project_tag in project_tags])
            for ticket_tag in ticket_tags:
                if ticket_tag.tag_id not in tickets_count_dict:
                    tickets_count_dict[ticket_tag.tag_id] = 1
                else:
                    tickets_count_dict[ticket_tag.tag_id] += 1

        return Response({
            'project_tags': [project_tag.to_dict(tickets_count_dict) for project_tag in project_tags],
        })

    def post(self, request, project_uuid):
        """
        Permission:
        1. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.POST.get('name')
        if not name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        description = request.POST.get('description')
        if not description:
            description = ''

        color = request.POST.get('color')
        if not color:
            error_msg = 'color invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        text_color = request.POST.get('text_color')
        if not text_color:
            error_msg = 'text_color invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            project_tags = ProjectTags.objects.filter(
                project_uuid=project_uuid)
        except Exception as e:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not project_tags:  # init default tags
            project_tags = create_default_project_tags(project_uuid)

        if name in [project_tag.name for project_tag in project_tags]:
            error_msg = 'tag already exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        try:
            project_tag = ProjectTags.objects.create(
                project_uuid=project_uuid,
                name=name,
                description=description,
                color=color,
                text_color=text_color,
                is_predefined=False,
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'project_tag': project_tag.to_dict()}, status=status.HTTP_201_CREATED)


class ProjectTagAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, project_uuid, tag_id):
        """
        Permission:
        1. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.data.get('name')
        description = request.POST.get('description')
        color = request.POST.get('color')
        text_color = request.POST.get('text_color')
        if not name and not description and not color and not text_color:
            error_msg = 'argument invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_tag = ProjectTags.objects.filter(
            id=tag_id, project_uuid=project_uuid).first()
        if not project_tag:
            error_msg = 'Project tag not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if project_tag.is_predefined:
            error_msg = 'Default tag cannot be modified.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            if name:
                project_tag.name = name
            if description:
                project_tag.description = description
            if color:
                project_tag.color = color
            if text_color:
                project_tag.text_color = text_color
            project_tag.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'project_tag': project_tag.to_dict()})

    def delete(self, request, project_uuid, tag_id):
        """
        Permission:
        1. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_tag = ProjectTags.objects.filter(
            id=tag_id, project_uuid=project_uuid).first()
        if not project_tag:
            error_msg = 'Project tag not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        if project_tag.is_predefined:
            error_msg = 'Default tag cannot be modified.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            project_tag.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class ProjectUploadFileAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, project_uuid):
        """
        Upload a file to /tmp.
        TicketsAPIView and TicketRepliesAPIView upload files to S3.

        Permission:
        1. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        file = request.FILES.get('file', None)
        if not file:
            error_msg = 'file not found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if file.size > 1024 * 1024 * settings.PROJECT_FILE_SIZE_MAX:
            error_msg = 'file too large.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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
            tmp_upload_file_path = upload_file_to_tmp_dir(project_uuid, file)
            file_url = f'{settings.SEAQA_WEB_SERVICE_URL.rstrip("/")}/{tmp_upload_file_path.replace("/tmp/projects/", "upload-file/project/")}'
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'url': file_url}, status=status.HTTP_201_CREATED)


class GetProjectUploadFileView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, file_path):
        """
        Get a file from /tmp.

        Permission:
        1. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(open(tmp_upload_file_path, 'rb'))
        response['Cache-Control'] = 'max-age=604800, public'
        response['ETag'] = '"' + str(os.path.getsize(tmp_upload_file_path)) + '"'
        response['Last-Modified'] = formatdate(int(os.path.getmtime(tmp_upload_file_path)), usegmt=True)
        return response


class ProjectFileAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def delete(self, request, project_uuid, file_path):
        """
        Permission:
        1. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            delete_file_from_s3(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class GetProjectFileView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, file_path):
        """
        Permission:
        1. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            file = get_file_from_s3(project_uuid, file_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        response = FileResponse(file)
        response['Cache-Control'] = 'max-age=604800, public'
        response['ETag'] = '"' + str(sys.getsizeof(file)) + '"'
        response['Last-Modified'] = formatdate(int(timezone.now().timestamp()), usegmt=True)
        return response

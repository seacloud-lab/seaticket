# -*- coding: utf-8 -*-
import logging
import json
from dateutil.relativedelta import relativedelta

from django.utils import timezone
from django.utils.translation import gettext as _

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
from seahub.project.models import Projects, Tickets, TicketReplies, \
    TicketTags, TicketAssignees, ProjectTags, ProjectTypes, TicketParticipants
from seahub.project.utils import check_project_admin_permission, check_project_permission, \
    replace_file_url_in_content, upload_files_to_s3
from seahub.project.constants import TICKET_STATUS


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


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
        view_id = request.GET.get('view_id', '')
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)

        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 1000
        end = start + limit

        if start < 0:
            error_msg = 'start invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if limit < 0:
            error_msg = 'limit invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not view_id:
            error_msg = 'view_id is invalid.'
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
        owned = request.GET.get('owned')
        try:
            if owned == 'true':
                tickets = Tickets.objects.list_tickets_by_username(
                    project_uuid, username, start, end)
            else:
                tickets = Tickets.objects.list_tickets_by_view(
                    project_uuid, start, end, view_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        ticket_id_list = [ticket.id for ticket in tickets]

        tags_dict = {}
        ticket_tags = TicketTags.objects.filter(ticket_id__in=ticket_id_list)
        for tag in ticket_tags:
            if tag.ticket_id not in tags_dict:
                tags_dict[tag.ticket_id] = [tag.tag_id]
            else:
                tags_dict[tag.ticket_id].append(tag.tag_id)

        assignees_dict = {}
        ticket_assignees = TicketAssignees.objects.filter(ticket_id__in=ticket_id_list)
        for ticket_assignee in ticket_assignees:
            if ticket_assignee.ticket_id not in assignees_dict:
                assignees_dict[ticket_assignee.ticket_id] = [ticket_assignee.assignee]
            else:
                assignees_dict[ticket_assignee.ticket_id].append(ticket_assignee.assignee)

        participants_dict = {}
        ticket_participants = TicketParticipants.objects.filter(ticket_id__in=ticket_id_list)
        for ticket_participant in ticket_participants:
            if ticket_participant.ticket_id not in participants_dict:
                participants_dict[ticket_participant.ticket_id] = [ticket_participant.participant]
            else:
                participants_dict[ticket_participant.ticket_id].append(ticket_participant.participant)

        return Response({
            'tickets': [ticket.to_dict(tags_dict=tags_dict, assignees_dict=assignees_dict, participants_dict=participants_dict) for ticket in tickets],
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
        link_urls = content_dict.get('links')
        if link_urls and isinstance(link_urls, list):
            file_urls = (file_urls or []) + link_urls

        assignees = request.POST.get('assignees')
        if assignees is not None:
            try:
                assignees = json.loads(assignees)
            except:
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(assignees, list):
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            assignees = list(set(assignees))

        type_id = request.POST.get('type') or None
        if type_id:
            try:
                type_id = int(type_id)
            except:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                project_type = ProjectTypes.objects.filter(
                    id=type_id, project_uuid=project_uuid).first()
            except Exception as e:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not project_type:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        priority = request.data.get('priority')
        if priority is not None:
            try:
                priority = int(priority)
            except:
                error_msg = 'priority invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if priority < 0:
                priority = 0
            elif priority > 5:
                priority = 5
        else:
            priority = 0

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
            if not project_tags:
                project_tags = []
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

        if assignees:
            for assignee in assignees:
                if not check_project_permission(assignee, workspace.owner):
                    error_msg = 'assignees invalid.'
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
                project_uuid, username, title, content, ticket_status, type_id, priority)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not ticket:
            error_msg = 'Too many requests'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        try:
            TicketParticipants.objects.create(ticket_id=ticket.id, participant=username)
        except Exception as e:
            logger.error(e)

        tags_dict = {}
        if tags:
            try:
                ticket_tags = [TicketTags(
                    ticket_id=ticket.id,
                    tag_id=tag,
                ) for tag in tags]
                TicketTags.objects.bulk_create(ticket_tags)
                for tag in ticket_tags:
                    if tag.ticket_id not in tags_dict:
                        tags_dict[tag.ticket_id] = [tag.tag_id]
                    else:
                        tags_dict[tag.ticket_id].append(tag.tag_id)
            except Exception as e:
                logger.error(e)

        assignees_dict = {}
        if assignees:
            try:
                ticket_assignees = [TicketAssignees(
                    ticket_id=ticket.id,
                    assignee=assignee,
                ) for assignee in assignees]
                TicketAssignees.objects.bulk_create(ticket_assignees)
                assignees_dict[ticket.id] = assignees
            except Exception as e:
                logger.error(e)

        participants_dict = {ticket.id: [username]}

        return Response({'ticket': ticket.to_dict(
            tags_dict=tags_dict,
            assignees_dict=assignees_dict,
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
            ticket_assignees = TicketAssignees.objects.filter(
                ticket_id=ticket.id)
            ticket_participants = TicketParticipants.objects.filter(
                ticket_id=ticket.id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        tags_dict = {}
        for tag in ticket_tags:
            if tag.ticket_id not in tags_dict:
                tags_dict[tag.ticket_id] = [tag.tag_id]
            else:
                tags_dict[tag.ticket_id].append(tag.tag_id)

        assignees_dict = {}
        for ticket_assignee in ticket_assignees:
            if ticket_assignee.ticket_id not in assignees_dict:
                assignees_dict[ticket_assignee.ticket_id] = [ticket_assignee.assignee]
            else:
                assignees_dict[ticket_assignee.ticket_id].append(ticket_assignee.assignee)

        participants_dict = {}
        for ticket_participant in ticket_participants:
            if ticket_participant.ticket_id not in participants_dict:
                participants_dict[ticket_participant.ticket_id] = [ticket_participant.participant]
            else:
                participants_dict[ticket_participant.ticket_id].append(ticket_participant.participant)

        ticket = ticket.to_dict(
            tags_dict=tags_dict,
            assignees_dict=assignees_dict,
            participants_dict=participants_dict,
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
            link_urls = content_dict.get('links')
            if link_urls and isinstance(link_urls, list):
                file_urls = (file_urls or []) + link_urls

        ticket_status = request.data.get('status')
        if ticket_status is not None:
            if ticket_status not in TICKET_STATUS:
                error_msg = 'status invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_update_type = 'type' in request.data
        type_id = request.data.get('type')
        if is_update_type and type_id is not None:
            try:
                type_id = int(type_id)
            except:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                project_type = ProjectTypes.objects.filter(
                    id=type_id, project_uuid=project_uuid).first()
            except Exception as e:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not project_type:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        priority = request.data.get('priority')
        if priority is not None:
            try:
                priority = int(priority)
            except:
                error_msg = 'priority invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if priority < 0:
                priority = 0
            elif priority > 5:
                priority = 5

        is_update_assignees = 'assignees' in request.data
        assignees = request.data.get('assignees')
        if is_update_assignees and assignees is not None:
            assignees = assignees if assignees else '[]'
            try:
                assignees = json.loads(assignees)
            except:
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not isinstance(assignees, list):
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            assignees = list(set(assignees))

        is_update_tags = 'tags' in request.data
        tags = request.data.get('tags')
        if is_update_tags and tags is not None:
            tags = tags if tags else '[]'
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
            if not project_tags:
                project_tags = []
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

        if assignees:
            for assignee in assignees:
                if not check_project_permission(assignee, workspace.owner):
                    error_msg = 'assignees invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        ticket = Tickets.objects.get_ticket(project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
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
            if is_update_type:
                ticket.type = type_id
            if priority is not None:
                ticket.priority = priority
            ticket.updated_at = timezone.now()
            ticket.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if is_update_tags:
            try:
                exist_ticket_tags = TicketTags.objects.filter(ticket_id=ticket.id)
                exist_tags = [tag.tag_id for tag in exist_ticket_tags]
                tags_to_create = list(set(tags) - set(exist_tags))
                tags_to_delete = list(set(exist_tags) - set(tags))
                if tags_to_create:
                    ticket_tags = [TicketTags(
                        ticket_id=ticket.id,
                        tag_id=tag,
                    ) for tag in tags_to_create]
                    TicketTags.objects.bulk_create(ticket_tags)
                if tags_to_delete:
                    TicketTags.objects.filter(
                        ticket_id=ticket.id, tag_id__in=tags_to_delete).delete()
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if is_update_assignees:
            try:
                exist_ticket_assignees = TicketAssignees.objects.filter(ticket_id=ticket.id)
                exist_assignees = [ticket_assignee.assignee for ticket_assignee in exist_ticket_assignees]
                assignees_to_create = list(set(assignees) - set(exist_assignees))
                assignees_to_delete = list(set(exist_assignees) - set(assignees))
                if assignees_to_create:
                    ticket_assignees = [TicketAssignees(
                        ticket_id=ticket.id,
                        assignee=assignee,
                    ) for assignee in assignees_to_create]
                    TicketAssignees.objects.bulk_create(ticket_assignees)
                if assignees_to_delete:
                    TicketAssignees.objects.filter(
                        ticket_id=ticket.id, assignee__in=assignees_to_delete).delete()
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

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
        link_urls = content_dict.get('links')
        if link_urls and isinstance(link_urls, list):
            file_urls = (file_urls or []) + link_urls

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
            if not TicketParticipants.objects.filter(ticket_id=ticket.id, participant=username).exists():
                TicketParticipants.objects.create(ticket_id=ticket.id, participant=username)
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
        link_urls = content_dict.get('links')
        if link_urls and isinstance(link_urls, list):
            file_urls = (file_urls or []) + link_urls

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

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


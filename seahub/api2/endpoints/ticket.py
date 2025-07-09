# -*- coding: utf-8 -*-
import logging
import json
from datetime import datetime
from dateutil.relativedelta import relativedelta

from django.utils import timezone
from django.utils.translation import gettext as _

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.project.models import Projects, Tickets, TicketReplies
from seahub.project.utils import TICKET_STATUS, TICKET_TAGS, \
    check_project_admin_permission, check_project_permission


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

        has_next_page = len(tickets) == per_page
        return Response({
            'tickets': [ticket.to_dict() for ticket in tickets],
            'has_next_page': has_next_page,
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

        # role permission check
        if not request.user.permissions.can_add_ticket():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        title = request.POST.get('title')
        if not title:
            error_msg = 'title invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        content = request.POST.get('content')
        if not content:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        participants = request.POST.get('participants')
        if participants is not None:
            if not isinstance(participants, list):
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            participants = list(set(participants))
        tags = request.POST.get('tags')
        if tags is not None:
            if not isinstance(tags, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            for tag in tags:
                if tag not in TICKET_TAGS:
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

        # main
        try:
            ticket_status = 'open'
            ticket = Tickets.objects.create_ticket(
                project_uuid, username, title, content, ticket_status, participants, tags)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if not ticket:
            error_msg = 'Too many requests'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        return Response({'ticket': ticket.to_dict()}, status=status.HTTP_201_CREATED)


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
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        has_next_page = len(ticket_replies) == end

        ticket = ticket.to_dict()
        ticket['replies'] = [ticket_reply.to_dict() for ticket_reply in ticket_replies]
        return Response({
            'ticket': ticket,
            'has_next_page': has_next_page,
        })

    def put(self, request, project_uuid, ticket_number):
        """
        Permission:
        1. creator
        2. group admin, can modify status
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # role permission check
        if not request.user.permissions.can_add_ticket():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        title = request.data.get('title')

        content = request.data.get('content')

        ticket_status = request.data.get('status')
        if ticket_status is not None:
            if ticket_status not in TICKET_STATUS:
                error_msg = 'status invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        participants = request.data.get('participants')
        if participants is not None:
            if not isinstance(participants, list):
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            participants = list(set(participants))

        tags = request.data.get('tags')
        if tags is not None:
            if not isinstance(tags, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            for tag in tags:
                if tag not in TICKET_TAGS:
                    error_msg = 'tags invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            tags = list(set(tags))

        if not any([title, content, status]) \
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

        if ticket.updated_at > timezone.now() - relativedelta(seconds=10):
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

        # main
        try:
            if title:
                ticket.title = title
            if content:
                ticket.content = content
            if ticket_status:
                ticket.status = ticket_status
            if participants or participants == []:
                ticket.participants = json.dumps(participants)
            if tags or tags == []:
                ticket.tags = json.dumps(tags)
            ticket.updated_at = timezone.now()
            ticket.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'ticket"': ticket.to_dict()})

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
            ticket.delete_time = datetime.now()
            ticket.save()
        except Exception as e:
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

        has_next_page = len(ticket_replies) == per_page

        return Response({
            'ticket_replies': [ticket_reply.to_dict() for ticket_reply in ticket_replies],
            'has_next_page': has_next_page
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

        # role permission check
        if not request.user.permissions.can_add_ticket_reply():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        content = request.POST.get('content')
        if not content:
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

        # role permission check
        if not request.user.permissions.can_add_ticket_reply():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        content = request.data.get('content')
        if content:
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
            ticket_reply.delete_time = datetime.now()
            ticket_reply.save()
        except Exception as e:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

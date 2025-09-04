# -*- coding: utf-8 -*-
import logging
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
from seahub.project.models import Projects, ProjectTypes, Tickets, TicketAssignees, \
    TicketParticipants, TicketTags
from seahub.project.utils import check_project_admin_permission, check_project_permission


logger = logging.getLogger(__name__)


class ProjectTypesAPIView(APIView):
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
            project_types = ProjectTypes.objects.filter(
                project_uuid=project_uuid)
        except Exception as e:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not project_types:
            project_types = []

        tickets_count_dict = {}
        if tickets_count == '1':
            tickets = Tickets.objects.filter(
                project_uuid=project_uuid,
                deleted=False,
                type__in=[project_type.id for project_type in project_types])
            for ticket in tickets:
                if ticket.type not in tickets_count_dict:
                    tickets_count_dict[ticket.type] = 1
                else:
                    tickets_count_dict[ticket.type] += 1

        return Response({
            'project_types': [project_type.to_dict(tickets_count_dict) for project_type in project_types],
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
            project_types = ProjectTypes.objects.filter(
                project_uuid=project_uuid)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not project_types:
            project_types = []

        if name in [project_type.name for project_type in project_types]:
            error_msg = 'type already exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        try:
            project_type = ProjectTypes.objects.create(
                project_uuid=project_uuid,
                name=name,
                color=color,
                text_color=text_color,
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'project_type': project_type.to_dict()}, status=status.HTTP_201_CREATED)


class ProjectTypeAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, project_uuid, type_id):
        """
        Permission:
        1. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        name = request.data.get('name')
        color = request.POST.get('color')
        text_color = request.POST.get('text_color')
        if 'name' not in request.data and 'color' not in request.data and 'text_color' not in request.data:
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

        project_type = ProjectTypes.objects.filter(
            id=type_id, project_uuid=project_uuid).first()
        if not project_type:
            error_msg = 'Project type not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            if name:
                project_type.name = name
            if color:
                project_type.color = color
            if text_color:
                project_type.text_color = text_color
            project_type.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'project_type': project_type.to_dict()})

    def delete(self, request, project_uuid, type_id):
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

        project_type = ProjectTypes.objects.filter(
            id=type_id, project_uuid=project_uuid).first()
        if not project_type:
            error_msg = 'Project type not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            project_type.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class ProjectTypeTicketsAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )
    def get(self, request, project_uuid, type_id):
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

        project_type = ProjectTypes.objects.filter(
            id=type_id, project_uuid=project_uuid).first()
        if not project_type:
            error_msg = 'Project type not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            tickets = Tickets.objects.list_tickets_by_type(
                    project_uuid, type_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not tickets:
            return Response({
                'tickets': []
            })
        
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

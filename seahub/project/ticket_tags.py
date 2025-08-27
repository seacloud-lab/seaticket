# -*- coding: utf-8 -*-
import logging
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
from seahub.project.models import Projects, TicketTags, ProjectTags, Tickets, TicketAssignees, \
    TicketParticipants
from seahub.project.utils import check_project_admin_permission, check_project_permission, \
    gen_project_tags_dict


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


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

        if not project_tags:
            project_tags = []

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
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not project_tags:
            project_tags = []

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
        if 'name' not in request.data and 'description' not in request.data and 'color' not in request.data and 'text_color' not in request.data:
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

        try:
            project_tag.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class ProjectTagTicketsAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )
    def get(self, request, project_uuid, tag_id):
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

        # main
        try:
            tickets = Tickets.objects.list_tickets_by_tag(
                    project_uuid, tag_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not tickets:
            return Response({
                'tickets': []
            })

        tags_dict = {}
        ticket_tags = TicketTags.objects.filter(ticket_id__in=[ticket.id for ticket in tickets])
        project_tags_dict = gen_project_tags_dict(project_uuid, key='id')
        for tag in ticket_tags:
            tag_info = project_tags_dict.get(tag.tag_id, None)
            if tag_info:
                if tag.ticket_id not in tags_dict:
                    tags_dict[tag.ticket_id] = [tag.tag_id]
                else:
                    tags_dict[tag.ticket_id].append(tag.tag_id)

        assignees_dict = {}
        ticket_assignees = TicketAssignees.objects.filter(ticket_id__in=[ticket.id for ticket in tickets])
        for ticket_assignee in ticket_assignees:
            if ticket_assignee.ticket_id not in assignees_dict:
                assignees_dict[ticket_assignee.ticket_id] = [ticket_assignee.assignee]
            else:
                assignees_dict[ticket_assignee.ticket_id].append(ticket_assignee.assignee)

        participants_dict = {}
        ticket_participants = TicketParticipants.objects.filter(ticket_id__in=[ticket.id for ticket in tickets])
        for ticket_participant in ticket_participants:
            if ticket_participant.ticket_id not in participants_dict:
                participants_dict[ticket_participant.ticket_id] = [ticket_participant.participant]
            else:
                participants_dict[ticket_participant.ticket_id].append(ticket_participant.participant)

        return Response({
            'tickets': [ticket.to_dict(tags_dict=tags_dict, assignees_dict=assignees_dict, participants_dict=participants_dict) for ticket in tickets],
        })


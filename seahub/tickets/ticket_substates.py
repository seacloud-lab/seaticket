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
from seahub.project.models import Projects
from seahub.project.utils import check_project_permission
from seahub.project.seadb_api import SeaDBAPI
from seahub.tickets.ticket_utils import get_substate_column_details, get_substate_column, add_substate_option, \
    update_substate_option, delete_substate_option, get_substate_option_by_id, filter_tickets_by_substate, \
    get_ticket_counts_group_by_column_name, get_substate_options_by_status_option_id, convert_ticket_select_column_name_to_option_id


logger = logging.getLogger(__name__)


class TicketSubstatesAPIView(APIView):
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
        status_id = request.GET.get('status_id')  # optional: filter substates by status id

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
            seadb_api = SeaDBAPI(username)
            substate_options, column_key, substate_data = get_substate_column_details(seadb_api, project_uuid)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # optional cascade filter
        if status_id:
            try:
                substate_options = get_substate_options_by_status_option_id(seadb_api, project_uuid, status_id) or []
            except Exception as e:
                logger.error(e)

        tickets_count_dict = {}
        try:
            tickets_count_dict = get_ticket_counts_group_by_column_name(seadb_api, project_uuid, 'substate') or {}
            for option in substate_options:
                option['tickets_count'] = tickets_count_dict.get(option.get('name'), 0)
        except Exception as e:
            logger.error(e)

        return Response({
            'project_substates': substate_options,
            'cascade_column_key': substate_data.get('cascade_column_key'),
            'cascade_settings': substate_data.get('cascade_settings') or {},
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
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            seadb_api = SeaDBAPI(username)
            existing_options, _ = get_substate_column(seadb_api, project_uuid)
            if any(opt.get('name') == name for opt in (existing_options or [])):
                error_msg = 'substate already exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            substate_option = add_substate_option(seadb_api, project_uuid, name, color, text_color)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'project_substate': substate_option}, status=status.HTTP_201_CREATED)


class TicketSubstateAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, substate_id):
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

        try:
            seadb_api = SeaDBAPI(username)
            substate_option = get_substate_option_by_id(seadb_api, project_uuid, substate_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not substate_option:
            error_msg = 'Project substate not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            tickets, columns = filter_tickets_by_substate(seadb_api, project_uuid, [substate_id])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        for ticket in tickets:
            convert_ticket_select_column_name_to_option_id(seadb_api, project_uuid, ticket)

        return Response({
            'tickets': tickets,
            'columns': columns,
        })

    def put(self, request, project_uuid, substate_id):
        """
        Permission:
        1. owner
        2. group member
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
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            substate_option = get_substate_option_by_id(seadb_api, project_uuid, substate_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not substate_option:
            error_msg = 'Project substate not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            update_data = {}
            if name:
                update_data['name'] = name
            if color:
                update_data['color'] = color
            if text_color:
                update_data['text_color'] = text_color
            update_substate_option(seadb_api, project_uuid, substate_id, update_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def delete(self, request, project_uuid, substate_id):
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

        try:
            seadb_api = SeaDBAPI(username)
            substate_option = get_substate_option_by_id(seadb_api, project_uuid, substate_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not substate_option:
            error_msg = 'Project substate not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            delete_substate_option(seadb_api, project_uuid, substate_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

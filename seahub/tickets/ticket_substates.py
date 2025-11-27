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
from seahub.project.utils import check_project_permission, get_current_table_metadata
from seahub.project.seadb_api import SeaDBAPI
from seahub.tickets.ticket_utils import update_select_option, get_ticket_counts_group_by_column_name, \
    TABLE_TICKETS, get_column_from_columns_by_name, \
    filter_tickets_by_select, add_select_option, batch_delete_select_option



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
        state_id = request.GET.get('state_id')  # optional: filter substates by state id

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

        seadb_api = SeaDBAPI(username)

        try:
            substate_options, substate_column = get_ticket_counts_group_by_column_name(seadb_api, project_uuid, 'substate') or {}
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # substate_column = TicketsTable.substate.data
        cascade_settings = substate_column.get('data').get('cascade_settings')
        cascade_column_key = substate_column.get('data').get('cascade_column_key')
        if state_id:
            allowed_ids = set(cascade_settings.get(state_id, []))
            substate_options = [opt for opt in substate_options if opt.get('id') in allowed_ids]

        return Response({
            'substates': substate_options,
            'cascade_column_key': cascade_column_key,
            'cascade_settings': cascade_settings,
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
        
        parent_id = request.POST.get('parent_id')
        if not parent_id:
            error_msg = 'parent_id invalid.'
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
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            table_id = table_meta.get('id')
            substate_column = get_column_from_columns_by_name(table_meta.get('columns'), 'substate')
            substate_column_key = substate_column.get('key')
            column_data = substate_column.get('data') or {}
            existing_options = column_data.get('options', []) or []

            if any(opt.get('name') == name for opt in (existing_options or [])):
                error_msg = 'substate already exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            option_data = {'color': color, 'text_color': text_color}
            substate_option = add_select_option(seadb_api, project_uuid, table_id, substate_column_key, name, option_data)
            substate_option_id = substate_option.get('id', '')

            # update cascade_settings
            cascade_settings = column_data.get('cascade_settings')
            if cascade_settings:
                for state_id, substate_options in cascade_settings.items():
                    if not substate_options:
                        substate_options = []
                    if state_id == parent_id:
                        substate_options.append(substate_option_id)
                column_data = {
                    'table_id': table_meta.get('id'),
                    'column_key': substate_column_key,
                    'update_column_data': {
                        'cascade_settings': cascade_settings,
                    },
                }
                seadb_api.update_column(project_uuid, column_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'substate': substate_option}, status=status.HTTP_201_CREATED)

    def delete(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        substate_ids = request.data.get('substate_ids', [])
        if not substate_ids:
            error_msg = 'substate_ids invalid.'
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
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            column = get_column_from_columns_by_name(table_meta.get('columns'), 'substate')
            batch_delete_select_option(seadb_api, project_uuid, table_meta.get('id'), column.get('key'), substate_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


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
            substate_option = None
            seadb_api = SeaDBAPI(username)
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            table_columns = table_meta.get('columns')
            column = get_column_from_columns_by_name(table_columns, 'substate')
            column_data = column.get('data') or {}
            options = column_data.get('options', []) or []
            for opt in options:
                if opt.get('id') == substate_id:
                    substate_option = opt
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not substate_option:
            error_msg = 'Project substate not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        try:
            tickets, columns = filter_tickets_by_select(seadb_api, project_uuid, 'substate', [substate_option.get('name')])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

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
        
        parent_id = request.POST.get('parent_id')

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

        substate_option = None
        seadb_api = SeaDBAPI(username)
        base_metadata = seadb_api.get_base_metadata(project_uuid)
        table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
        column = get_column_from_columns_by_name(table_meta.get('columns'), 'substate')
        column_data = column.get('data') or {}
        options = column_data.get('options', []) or []
        for opt in options:
            if opt.get('id') == substate_id:
                substate_option = opt

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
            table_id = table_meta.get('id')
            column_key = column.get('key')
            update_select_option(seadb_api, project_uuid, table_id, column_key, substate_option, substate_id, update_data)

            # update cascade_settings
            if parent_id:
                cascade_settings = column_data.get('cascade_settings')
                if cascade_settings:
                    for state_id, substate_options in cascade_settings.items():
                        if not substate_options:
                            substate_options = []
                        if substate_id in substate_options:
                            substate_options.remove(substate_id)
                        if state_id == parent_id:
                            substate_options.append(substate_id)
                    column_data = {
                        'table_id': table_meta.get('id'),
                        'column_key': column_key,
                        'update_column_data': {
                            'cascade_settings': cascade_settings,
                        },
                    }
                    seadb_api.update_column(project_uuid, column_data)

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
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            tickets_table_metadata = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            column = get_column_from_columns_by_name(tickets_table_metadata.get('columns'), 'substate')
            column_key = column.get('key')
            column_data = column.get('data') or {}
            options = column_data.get('options', []) or []
            option = None
            for opt in options:
                if opt.get('id') == substate_id:
                    option = opt
            if not option:
                error_msg = 'substate not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            option_data = {
                'table_id': tickets_table_metadata.get('id'),
                'column_key': column_key,
                'option_id': substate_id,
            }
            seadb_api.delete_column_option(project_uuid, option_data)
            # delete substate id in cascade settings
            cascade_settings = column_data.get('cascade_settings')
            if cascade_settings:
                for status_id, substate_ids in cascade_settings.items():
                    if substate_id in substate_ids:
                        substate_ids.remove(substate_id)
                    column_data = {
                        'table_id': tickets_table_metadata.get('id'),
                        'column_key': column_key,
                        'update_column_data': {
                            'cascade_settings': cascade_settings,
                        },
                    }
                    seadb_api.update_column(project_uuid, column_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

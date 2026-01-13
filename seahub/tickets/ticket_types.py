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
from seahub.utils.decorators import require_org_context, require_project, require_project_permission, require_seadb_api
from seahub.project.models import Projects
from seahub.project.utils import check_project_permission, get_current_table_metadata
from seahub.tickets.ticket_utils import update_select_option, add_select_option, get_ticket_counts_group_by_column_name, \
    filter_tickets_by_select, TABLE_TICKETS, \
    get_column_from_columns_by_name, batch_delete_select_option
from seahub.project.seadb_api import SeaDBAPI

logger = logging.getLogger(__name__)


class TicketTypesAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    @require_project()
    @require_project_permission()
    @require_seadb_api
    def get(self, request, project_uuid, project, workspace, seadb_api):
        """
        Permission:
        1. owner
        2. group member
        """
        # main
        type_options, _ = get_ticket_counts_group_by_column_name(seadb_api, project_uuid, 'type')
        return Response({
            'types': type_options,
        })

    @require_org_context
    @require_project()
    @require_project_permission()
    @require_seadb_api
    def post(self, request, project_uuid, project, workspace, seadb_api):
        """
        Permission:
        1. owner
        2. group member
        """
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

        # main
        base_metadata = seadb_api.get_base_metadata(project_uuid)
        table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
        table_id = table_meta.get('id')
        type_column = get_column_from_columns_by_name(table_meta.get('columns'), 'type')
        column_data = type_column.get('data') or {}
        existing_options = column_data.get('options', []) or []

        if any(opt.get('name') == name for opt in (existing_options or [])):
            error_msg = 'type already exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        try:
            option_data = {'color': color, 'text_color': text_color}
            type_option = add_select_option(seadb_api, project_uuid, table_id, type_column.get('key'), name, option_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'type': type_option}, status=status.HTTP_201_CREATED)

    @require_org_context
    @require_project()
    @require_project_permission()
    @require_seadb_api
    def delete(self, request, project_uuid, project, workspace, seadb_api):
        """
        Permission:
        1. owner
        2. group member
        """
        # argument check
        type_ids = request.data.get('type_ids', [])
        if not type_ids:
            error_msg = 'type_ids invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        try:
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            column = get_column_from_columns_by_name(table_meta.get('columns'), 'type')
            batch_delete_select_option(seadb_api, project_uuid, table_meta.get('id'), column.get('key'), type_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class TicketTypeAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    @require_project()
    @require_project_permission()
    @require_seadb_api
    def get(self, request, project_uuid, type_id, project, workspace, seadb_api):
        """
        Permission:
        1. owner
        2. group member
        """
        try:
            type_option = None
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            table_columns = table_meta.get('columns')
            column = get_column_from_columns_by_name(table_columns, 'type')
            column_data = column.get('data') or {}
            options = column_data.get('options', []) or []
            for opt in options:
                if opt.get('id') == type_id:
                    type_option = opt
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not type_option:
            error_msg = 'type option not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            tickets, columns = filter_tickets_by_select(seadb_api, project_uuid, 'type', [type_option.get('name')])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'tickets': tickets,
            'columns': columns,
        })

    @require_org_context
    @require_project()
    @require_project_permission()
    @require_seadb_api
    def put(self, request, project_uuid, type_id, project, workspace, seadb_api):
        """
        Permission:
        1. owner
        2. group member
        """
        # argument check
        name = request.data.get('name')
        color = request.POST.get('color')
        text_color = request.POST.get('text_color')
        if 'name' not in request.data and 'color' not in request.data and 'text_color' not in request.data:
            error_msg = 'argument invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            type_option = None
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            column = get_column_from_columns_by_name(table_meta.get('columns'), 'type')
            column_data = column.get('data') or {}
            options = column_data.get('options', []) or []
            for opt in options:
                if opt.get('id') == type_id:
                    type_option = opt
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not type_option:
            error_msg = 'type not found.'
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
            update_select_option(seadb_api, project_uuid, table_id, column_key, type_option, type_id, update_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    @require_org_context
    @require_project()
    @require_project_permission()
    @require_seadb_api
    def delete(self, request, project_uuid, type_id, project, workspace, seadb_api):
        """
        Permission:
        1. owner
        2. group member
        """
        try:
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            tickets_table_metadata = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            column = get_column_from_columns_by_name(tickets_table_metadata.get('columns'), 'type')
            table_id = tickets_table_metadata.get('id')
            column_key = column.get('key')
            column_data = column.get('data') or {}
            options = column_data.get('options', []) or []
            option = None
            for opt in options:
                if opt.get('id') == type_id:
                    option = opt
            if not option:
                error_msg = 'type not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            option_data = {
                'table_id': table_id,
                'column_key': column_key,
                'option_id': type_id,
            }
            seadb_api.delete_column_option(project_uuid, option_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

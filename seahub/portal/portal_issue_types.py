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
from seahub.project.models import Projects
from seahub.project.utils import check_project_permission, get_current_table_metadata
from seahub.tickets.ticket_utils import add_select_option, update_select_option, batch_delete_select_option, \
    get_column_from_columns_by_name
from seahub.project.seadb_api import SeaDBAPI
from seahub.utils.decorators import require_org_context
from seahub.portal.portal_utils import TABLE_PORTAL_ISSUES, get_portal_issue_counts_group_by_column_name, \
    filter_portal_issues_by_select

logger = logging.getLogger(__name__)


class PortalIssueTypesAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
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

        # main
        seadb_api = SeaDBAPI()
        type_options, column = get_portal_issue_counts_group_by_column_name(seadb_api, project_uuid, 'type')
        return Response({
            'types': type_options,
        })

    @require_org_context
    def post(self, request, project_uuid):
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
        seadb_api = SeaDBAPI()
        base_metadata = seadb_api.get_base_metadata(project_uuid)
        table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_PORTAL_ISSUES)
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
    def delete(self, request, project_uuid):
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
            seadb_api = SeaDBAPI()
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_PORTAL_ISSUES)
            column = get_column_from_columns_by_name(table_meta.get('columns'), 'type')
            batch_delete_select_option(seadb_api, project_uuid, table_meta.get('id'), column.get('key'), type_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class PortalIssueTypeAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, type_id):
        """
        Permission:
        1. owner
        2. group member
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
            type_option = None
            seadb_api = SeaDBAPI()
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_PORTAL_ISSUES)
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
            issues, columns = filter_portal_issues_by_select(seadb_api, project_uuid, 'type', [type_option.get('name')])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'issues': issues,
            'columns': columns,
        })

    @require_org_context
    def put(self, request, project_uuid, type_id):
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
            type_option = None
            seadb_api = SeaDBAPI()
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_PORTAL_ISSUES)
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
    def delete(self, request, project_uuid, type_id):
        """
        Permission:
        1. owner
        2. group member
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
            seadb_api = SeaDBAPI()
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_PORTAL_ISSUES)
            column = get_column_from_columns_by_name(table_meta.get('columns'), 'type')
            table_id = table_meta.get('id')
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

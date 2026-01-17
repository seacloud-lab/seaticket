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
from seahub.tickets.ticket_utils import add_select_option, update_select_option, get_column_from_columns_by_name, batch_delete_select_option
from seahub.knowledge_base.knowledge_base_utils import TABLE_KNOWLEDGE_BASE, get_kb_counts_group_by_column_name, filter_kb_by_select
from seahub.utils.decorators import require_org_context


logger = logging.getLogger(__name__)


class KnowledgeBaseTagsAPIView(APIView):
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
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            tag_options, _ = get_kb_counts_group_by_column_name(seadb_api, project_uuid, 'tags', 'multiple-select') or {}
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'tags': tag_options})

    @require_org_context
    def post(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        data = request.data or {}
        name = data.get('name')
        if not name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        description = data.get('description')
        if description is None:
            description = ''

        color = data.get('color')
        if not color:
            error_msg = 'color invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        text_color = data.get('text_color')
        if not text_color:
            error_msg = 'text_color invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_KNOWLEDGE_BASE)
            table_id = table_meta.get('id')
            tag_column = get_column_from_columns_by_name(table_meta.get('columns'), 'tags')
            column_data = tag_column.get('data') or {}
            existing_options = column_data.get('options', []) or []

            if any(opt.get('name') == name for opt in (existing_options or [])):
                error_msg = 'tag already exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            option_data = {'color': color, 'text_color': text_color, 'description': description or ''}
            tag_option = add_select_option(seadb_api, project_uuid, table_id, tag_column.get('key'), name, option_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'tag': tag_option}, status=status.HTTP_201_CREATED)

    @require_org_context
    def delete(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        tag_ids = request.data.get('tag_ids', [])
        if not tag_ids:
            error_msg = 'tag_ids invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_KNOWLEDGE_BASE)
            column = get_column_from_columns_by_name(table_meta.get('columns'), 'tags')
            batch_delete_select_option(seadb_api, project_uuid, table_meta.get('id'), column.get('key'), tag_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class KnowledgeBaseTagAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, tag_id):
        """
        Permission:
        1. owner
        2. group member
        """
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            tag_option = None
            seadb_api = SeaDBAPI(username)
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_KNOWLEDGE_BASE)
            table_columns = table_meta.get('columns')
            column = get_column_from_columns_by_name(table_columns, 'tags')
            column_data = column.get('data') or {}
            options = column_data.get('options', []) or []
            for opt in options:
                if opt.get('id') == tag_id:
                    tag_option = opt
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not tag_option:
            error_msg = 'tag option not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            records, columns = filter_kb_by_select(seadb_api, project_uuid, 'tags', [tag_option.get('name')])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'records': records,
            'columns': columns,
        })

    @require_org_context
    def put(self, request, project_uuid, tag_id):
        """
        Permission:
        1. owner
        2. group member
        """
        name = request.data.get('name')
        description = request.data.get('description')
        color = request.data.get('color')
        text_color = request.data.get('text_color')
        
        if 'name' in request.data:
            if not name or not name.strip():
                error_msg = 'name invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if 'description' in request.data:
            if not description:
                description = ''
            description = description.strip()

        if 'color' in request.data:
            if not color or not color.strip():
                error_msg = 'color invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if 'text_color' in request.data:
            if not text_color or not text_color.strip():
                error_msg = 'text_color invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        tag_option = None
        seadb_api = SeaDBAPI(username)
        base_metadata = seadb_api.get_base_metadata(project_uuid)
        table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_KNOWLEDGE_BASE)
        column = get_column_from_columns_by_name(table_meta.get('columns'), 'tags')
        column_data = column.get('data') or {}
        options = column_data.get('options', []) or []
        for opt in options:
            if opt.get('id') == tag_id:
                tag_option = opt

        if not tag_option:
            error_msg = 'Knowledge base tag not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            update_data = {}
            if name:
                update_data['name'] = name
            if 'description' in request.data:
                update_data['description'] = description
            if color:
                update_data['color'] = color
            if text_color:
                update_data['text_color'] = text_color
            table_id = table_meta.get('id')
            column_key = column.get('key')
            update_select_option(seadb_api, project_uuid, table_id, column_key, tag_option, tag_id, update_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    @require_org_context
    def delete(self, request, project_uuid, tag_id):
        """
        Permission:
        1. owner
        2. group member
        """
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            kb_table_metadata = get_current_table_metadata(base_metadata.get('tables'), TABLE_KNOWLEDGE_BASE)
            column = get_column_from_columns_by_name(kb_table_metadata.get('columns'), 'tags')
            table_id = kb_table_metadata.get('id')
            column_key = column.get('key')
            column_data = column.get('data') or {}
            options = column_data.get('options', []) or []
            tag_option = None
            for opt in options:
                if opt.get('id') == tag_id:
                    tag_option = opt
            if not tag_option:
                error_msg = 'tag not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            option_data = {
                'table_id': table_id,
                'column_key': column_key,
                'option_id': tag_id,
            }
            seadb_api.delete_column_option(project_uuid, option_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

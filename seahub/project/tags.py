
# -*- coding: utf-8 -*-
import logging

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
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.utils import get_table_name_from_schema, get_column_name_from_schema, get_column_data _from_schema
from seahub.tickets.ticket_utils import TABLE_TICKETS, get_column_from_columns_by_name, filter_tickets_by_select, \
    build_linked_record_titles_map
from seahub.utils.decorators import require_org_context

logger = logging.getLogger(__name__)


class TagsAPIView(APIView):
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
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)

        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 1000

        if start < 0:
            error_msg = 'start invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if limit < 0:
            error_msg = 'limit invalid'
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
            seadb_api = SeaDBAPI()
            table_name = get_table_name_from_schema('TagTable', )
            sql = "SELECT `_pk`, `name`, `color`, `text_color`, `description` " \
                f"FROM `{table_name}` LIMIT {start}, {limit}"
            res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'columns': res.get('metadata'), 'tags': res.get('results')})

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
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        table_name = get_table_name_from_schema('TagTable', )
        # main
        try:
            seadb_api = SeaDBAPI()
            row = {
                get_column_name_from_schema('TagTable', 'name'): name,
                get_column_name_from_schema('TagTable', 'color'): color,
                get_column_name_from_schema('TagTable', 'text_color'): text_color,
                get_column_name_from_schema('TagTable', 'description'): description,
            }
            res = seadb_api.insert_rows(project_uuid, table_name, [row])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        pks = res.get('pks', [])
        row.update({'_pk': pks[0]})

        return Response({'tag': row}, status=status.HTTP_201_CREATED)

    @require_org_context
    def delete(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        # argument check
        tag_ids = request.data.get('tag_ids', [])
        if not tag_ids:
            error_msg = 'tag_ids invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            tag_ids = [int(tag_id) for tag_id in tag_ids]
        except ValueError:
            error_msg = 'tag_ids invalid.'
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
            seadb_api = SeaDBAPI()
            seadb_api.delete_rows(project_uuid, get_table_name_from_schema('TagTable', ), tag_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class TagAPIView(APIView):
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
            tag_option = None
            seadb_api = SeaDBAPI()
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
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

        # main
        try:
            seadb_api = SeaDBAPI()
            tickets, columns = filter_tickets_by_select(seadb_api, project_uuid, 'tags', [tag_option.get('name')])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        linked_record_titles = build_linked_record_titles_map(seadb_api, project_uuid, tickets, columns)
        return Response({
            'tickets': tickets,
            'columns': columns,
            'linked_record_titles': linked_record_titles,
        })

    @require_org_context
    def put(self, request, project_uuid, tag_id):
        """
        Permission:
        1. owner
        2. group member
        """
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
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        seadb_api = SeaDBAPI()

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

            if update_data:
                table_name = get_table_name_from_schema('TagTable', )
                update_row = {
                    'pk': int(tag_id),
                    'row': update_data
                }
                seadb_api.update_rows(project_uuid, table_name, [update_row])
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
            seadb_api.delete_rows(project_uuid, get_table_name_from_schema('TagTable', ), [int(tag_id)])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

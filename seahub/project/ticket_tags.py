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
from seahub.project.utils import check_project_admin_permission, check_project_permission
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.ticket_utils import get_tags_column, add_tag_option, update_tag_option, delete_tag_option, \
    get_tag_option_by_id, get_type_option_by_name, get_tag_ids_by_names, get_ticket_counts_group_by_tag, \
    get_status_option_by_name


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
            seadb_api = SeaDBAPI(username)
            tag_options, _ = get_tags_column(seadb_api, project_uuid)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        tickets_count_dict = {}
        if tickets_count == '1':
            try:
                tickets_count_dict = get_ticket_counts_group_by_tag(seadb_api, project_uuid) or {}
                for tag_option in tag_options:
                    tag_option['tickets_count'] = tickets_count_dict.get(tag_option.get('name'), 0)
            except Exception as e:
                logger.error(e)

        return Response({'project_tags': tag_options})

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
            seadb_api = SeaDBAPI(username)
            existing_options, _ = get_tags_column(seadb_api, project_uuid)
            if any(opt.get('name') == name for opt in (existing_options or [])):
                error_msg = 'tag already exists.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            tag_option = add_tag_option(seadb_api, project_uuid, name, color, text_color, description=description)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'project_tag': tag_option}, status=status.HTTP_201_CREATED)


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

        # main
        try:
            seadb_api = SeaDBAPI(username)
            tag_option = get_tag_option_by_id(seadb_api, project_uuid, tag_id)
            if not tag_option:
                error_msg = 'Project tag not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        try:
            update_data = {}
            if name:
                update_data['name'] = name
            if description:
                update_data['description'] = description
            if color:
                update_data['color'] = color
            if text_color:
                update_data['text_color'] = text_color
            update_tag_option(seadb_api, project_uuid, tag_id, update_data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

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
        
        try:
            seadb_api = SeaDBAPI(username)
            tag_option = get_tag_option_by_id(seadb_api, project_uuid, tag_id)
            if not tag_option:
                error_msg = 'Project tag not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            delete_tag_option(seadb_api, project_uuid, tag_id)
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
            seadb_api = SeaDBAPI(username)
            tag_name = get_tag_option_by_id(seadb_api, project_uuid, tag_id).get('name')
            sql = f"""
                SELECT * 
                FROM `tickets` 
                WHERE `deleted` = False 
                AND `tags` in ('{tag_name}')
            """
            res = seadb_api.query_rows(project_uuid, sql)
            tickets = res.get('results') or []
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        for row in tickets:
            if row.get('status'):
                option = get_status_option_by_name(seadb_api, project_uuid, row.get('status'))
                row['status'] = option.get('id')
            if row.get('type'):
                option = get_type_option_by_name(seadb_api, project_uuid, row.get('type'))
                row['type'] = option.get('id')
            if row.get('tags'):
                row['tags'] = get_tag_ids_by_names(seadb_api, project_uuid, row.get('tags'))

        return Response({'tickets': tickets})

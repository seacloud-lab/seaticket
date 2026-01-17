# -*- coding: utf-8 -*-
import json
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from seahub.api2.throttling import AppRateThrottle
from seahub.api2.utils import api_error
from seahub.utils.auth import AUTHORIZATION_PREFIX
from seahub.utils import uuid_str_to_32_chars
from seahub.project.constants import ConnectionType
from seahub.project.models import (
    ProjectConnections, ConnectionsViews, ProjectAPIToken
)
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.utils import url_to_filename
from seahub.utils.storage import get_file_from_s3_web_crawl
from seahub.seadb_models.utils import (
    list_connection_view_records, list_discourse_forum_replies_records,
    list_github_issue_record_details
)

logger = logging.getLogger(__name__)


class ProjectConnectionListByTokenView(APIView):
    throttle_classes = (AppRateThrottle,)

    def get(self, request):
        token_list = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not token_list or token_list[0].lower() not in AUTHORIZATION_PREFIX or len(token_list) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        api_token = token_list[1]

        try:
            api_token_obj = ProjectAPIToken.objects.get_by_token(api_token)
            if not api_token_obj:
                return api_error(status.HTTP_403_FORBIDDEN, 'Invalid API token.')
        except Exception as e:
            logger.error('API token validation error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        project = api_token_obj.project
        if not project or project.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found or deleted.')

        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            current_page = 1
            per_page = 100

        start = (current_page - 1) * per_page
        end = start + per_page

        connections_qs = ProjectConnections.objects.filter(
            project=project,
            deleted=False
        )[start:end]

        records = [conn.to_dict() for conn in connections_qs]

        return Response({'records': records})


class ProjectConnectionDetailByTokenView(APIView):
    throttle_classes = (AppRateThrottle,)

    def get(self, request):
        token_list = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not token_list or token_list[0].lower() not in AUTHORIZATION_PREFIX or len(token_list) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        api_token = token_list[1]

        name = request.GET.get('name')
        if not name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'name is required.')

        connection_type = request.GET.get('type')
        if not connection_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'type is required.')

        view_id = request.GET.get('view_id', '')
        if not view_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'view_id is required.')

        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)
        try:
            start = int(start)
            limit = int(limit)
        except Exception:
            start = 0
            limit = 1000

        try:
            api_token_obj = ProjectAPIToken.objects.get_by_token(api_token)
            if not api_token_obj:
                return api_error(status.HTTP_403_FORBIDDEN, 'Invalid API token.')
        except Exception as e:
            logger.error('API token validation error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        project = api_token_obj.project
        if not project or project.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        project_uuid = str(project.uuid)

        try:
            connection = ProjectConnections.objects.filter(
                project=project,
                name=name,
                type=connection_type,
                deleted=False,
                is_active=True
            ).first()

            if not connection:
                return api_error(
                    status.HTTP_404_NOT_FOUND,
                    f'connection "{name}" type "{connection_type}" not found.'
                )

            view = ConnectionsViews.objects.get_view(project_uuid, connection, view_id)
            if not view:
                return api_error(status.HTTP_404_NOT_FOUND, f'Connection view with id "{view_id}" not found.')

            username = api_token_obj.generated_by
            seadb_api = SeaDBAPI(username)
            records, _ = list_connection_view_records(
                seadb_api, project_uuid, connection, view, start, limit
            )
            return Response({
                'records': records
            })

        except Exception as e:
            logger.error('Error getting connection details: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


class ProjectConnectionRowDetailByTokenView(APIView):
    throttle_classes = (AppRateThrottle,)

    def get(self, request):
        token_list = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not token_list or token_list[0].lower() not in AUTHORIZATION_PREFIX or len(token_list) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        api_token = token_list[1]

        name = request.GET.get('name')
        if not name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'name is required.')

        connection_type = request.GET.get('type')
        if not connection_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'type is required.')

        try:
            api_token_obj = ProjectAPIToken.objects.get_by_token(api_token)
            if not api_token_obj:
                return api_error(status.HTTP_403_FORBIDDEN, 'Invalid API token.')
        except Exception as e:
            logger.error('API token validation error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        project = api_token_obj.project
        if not project or project.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found or deleted.')

        try:
            connection = ProjectConnections.objects.filter(
                project=project,
                name=name,
                type=connection_type,
                deleted=False,
                is_active=True
            ).first()
            if not connection:
                return api_error(
                    status.HTTP_404_NOT_FOUND,
                    f'Active connection with name "{name}" and type "{connection_type}" not found.'
                )
        except Exception as e:
            logger.error('Error locating connection %s (%s): %s', name, connection_type, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        connection_id = connection.id
        project_uuid = str(project.uuid)
        username = api_token_obj.generated_by
        seadb_api = SeaDBAPI(username)
        row_details = []

        try:
            if connection.type == ConnectionType.DISCOURSE_FORUM.value:
                _pk = request.GET.get('_pk')
                if not _pk:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Missing _pk.')
                row_details = list_discourse_forum_replies_records(seadb_api, project_uuid, connection_id, _pk)
            elif connection.type == ConnectionType.SITE.value:
                url = request.GET.get('url')
                if not url:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Missing url.')
                filename = url_to_filename(url)
                uuid_32_chars = uuid_str_to_32_chars(project_uuid)
                try:
                    file_obj = get_file_from_s3_web_crawl(uuid_32_chars, connection_id, filename)
                    if file_obj:
                        row_details = json.loads(file_obj.read())
                except Exception as err:
                    logger.error('Error retrieving site row details for %s: %s', name, err)
            elif connection.type == ConnectionType.GITHUB_ISSUE.value:
                _pk = request.GET.get('_pk')
                if not _pk:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Missing _pk.')
                row_details = list_github_issue_record_details(seadb_api, project_uuid, connection_id, _pk)
        except Exception as e:
            logger.error('Error getting connection row details: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'row_details': row_details})

# -*- coding: utf-8 -*-
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle, AppRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.utils.auth import AUTHORIZATION_PREFIX
from seahub.project.constants import ConnectionType
from seahub.seadb_models.models import GithubIssuesTable, DiscourseTopicsTable, WebCrawlTable, SeafileTable
from seahub.seadb_models.utils import list_connection_view_records
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.models import (
    ProjectConnections, ConnectionsViews, Projects, ProjectAPIToken, API_TOKEN_PERMISSION_TUPLE
)
from seahub.project.utils import check_project_admin_permission

logger = logging.getLogger(__name__)


def _api_token_obj_to_dict(api_token_obj):
    return {
        'id': api_token_obj.id,
        'app_name': api_token_obj.app_name,
        'api_token': api_token_obj.token,
        'generated_by': api_token_obj.generated_by,
        'generated_at': api_token_obj.generated_at.isoformat() if api_token_obj.generated_at else '',
        'last_access': api_token_obj.last_access.isoformat() if api_token_obj.last_access else '',
        'permission': api_token_obj.permission,
    }


def _resource_check(project_uuid):
    try:
        project = Projects.objects.get_project_by_uuid(project_uuid, include_deleted=False)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.'), None
        return None, project
    except Exception as e:
        logger.error(e)
        return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error'), None


def _permission_check_for_project_api_token(username, workspace_owner):
    """Check if user has permission to manage API tokens"""
    if not check_project_admin_permission(username, workspace_owner):
        return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
    return None


class ProjectAPITokensView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        username = request.user.username

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        error, project = _resource_check(project_uuid)
        if error:
            return error

        workspace = project.workspace
        owner = workspace.owner
        error = _permission_check_for_project_api_token(username, owner)
        if error:
            return error

        api_tokens = []
        try:
            api_token_queryset = ProjectAPIToken.objects.list_by_project(project)
            for api_token_obj in api_token_queryset:
                data = _api_token_obj_to_dict(api_token_obj)
                api_tokens.append(data)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'api_tokens': api_tokens})

    def post(self, request, project_uuid):
        username = request.user.username

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_name = request.data.get('app_name')
        if not app_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'app_name invalid.')

        permission = request.data.get('permission')
        if not permission or permission not in API_TOKEN_PERMISSION_TUPLE:
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        error, project = _resource_check(project_uuid)
        if error:
            return error

        workspace = project.workspace
        owner = workspace.owner
        error = _permission_check_for_project_api_token(username, owner)
        if error:
            return error

        try:
            exist_obj = ProjectAPIToken.objects.get_by_project_and_app_name(project, app_name)
            if exist_obj is not None:
                return api_error(status.HTTP_400_BAD_REQUEST, 'API token already exists.')

            api_token_obj = ProjectAPIToken.objects.add(project, app_name, username, permission)
            data = _api_token_obj_to_dict(api_token_obj)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(data, status=status.HTTP_201_CREATED)


class ProjectAPITokenView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, project_uuid, token_id):
        username = request.user.username

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        error, project = _resource_check(project_uuid)
        if error:
            return error

        workspace = project.workspace
        owner = workspace.owner
        error = _permission_check_for_project_api_token(username, owner)
        if error:
            return error

        try:
            api_token_obj = ProjectAPIToken.objects.get(id=token_id, project=project)
            api_token_obj.delete()
        except ProjectAPIToken.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'API token not found.')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def put(self, request, project_uuid, token_id):
        username = request.user.username

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        permission = request.data.get('permission')
        if not permission or permission not in API_TOKEN_PERMISSION_TUPLE:
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        error, project = _resource_check(project_uuid)
        if error:
            return error

        workspace = project.workspace
        owner = workspace.owner
        error = _permission_check_for_project_api_token(username, owner)
        if error:
            return error

        try:
            api_token_obj = ProjectAPIToken.objects.get(id=token_id, project=project)
            
            if permission == api_token_obj.permission:
                return api_error(status.HTTP_400_BAD_REQUEST, f'API token already has {permission} permission.')

            api_token_obj.permission = permission
            api_token_obj.save(update_fields=['permission'])
            
            data = _api_token_obj_to_dict(api_token_obj)
        except ProjectAPIToken.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'API token not found.')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(data)


class ProjectConnectionDetailView(APIView):
    throttle_classes = (AppRateThrottle,)

    def get(self, request):
        """Get project connection detail records by API token"""
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
        view_name = request.GET.get('view_name', '')

        if not view_id and not view_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Either view_id or view_name is required.')

        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)
        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 1000

        try:
            api_token_obj = ProjectAPIToken.objects.get_by_token(api_token)
            if not api_token_obj:
                return api_error(status.HTTP_403_FORBIDDEN, 'Invalid API token.')

        except Exception as e:
            logger.error(f'API token validation error: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        project = api_token_obj.project
        if not project or project.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found or deleted.')

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
                return api_error(status.HTTP_404_NOT_FOUND,
                    f'Active connection with name "{name}" and type "{connection_type}" not found.')

            connection_id = connection.id

            view = None
            if view_id:
                view = ConnectionsViews.objects.get_view(project_uuid, connection_id, view_id, connection.type)
                if not view:
                    return api_error(status.HTTP_404_NOT_FOUND, f'Connection view with id "{view_id}" not found.')
            else:
                view_details = ConnectionsViews.objects.list_views(project_uuid, connection_id, connection.type)
                views = view_details.get('views', [])
                for v in views:
                    if v.get('name') == view_name:
                        view = v
                        view_id = v.get('_id', '')
                        break
                if not view:
                    return api_error(status.HTTP_404_NOT_FOUND,
                        f'Connection view with name "{view_name}" not found.')

            username = api_token_obj.generated_by
            seadb_api = SeaDBAPI(username)

            if connection.type == ConnectionType.GITHUB_ISSUE.value:
                basic_filters = view.get('basic_filters', [])
                for basic_filter in basic_filters:
                    column_key = basic_filter.get('column_key', '')
                    if column_key == 'type':
                        basic_filter['column_name'] = 'issue_type'
                        del basic_filter['column_key']
                    elif column_key == 'status':
                        basic_filter['column_name'] = 'state'
                        del basic_filter['column_key']
                view['basic_filters'] = basic_filters
                table_name = GithubIssuesTable.gen_table_name(connection_id)
            elif connection.type == ConnectionType.DISCOURSE_FORUM.value:
                table_name = DiscourseTopicsTable.gen_table_name(connection_id)
            elif connection.type == ConnectionType.SITE.value:
                table_name = WebCrawlTable.gen_table_name(connection_id)
            elif connection.type == ConnectionType.SEAFILE.value:
                table_name = SeafileTable.gen_table_name(connection_id)
            else:
                return api_error(status.HTTP_400_BAD_REQUEST, f'Unsupported connection type: {connection.type}')

            records, _ = list_connection_view_records(
                seadb_api, project_uuid, table_name, view, start, limit, username
            )

            return Response({
                'records': records,
                'name': connection.name,
                'type': connection.type,
                'connection_id': connection_id,
                'view_id': view_id,
                'view_name': view.get('name', ''),
                'project_uuid': project_uuid,
                'project_name': project.name,
            })

        except Exception as e:
            logger.error(f'Error getting connection details: {e}')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

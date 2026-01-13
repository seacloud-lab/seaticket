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
from seahub.utils import is_org_context
from seahub.project.models import (
    Projects, ProjectAPIToken, API_TOKEN_PERMISSION_TUPLE
)
from seahub.project.utils import check_project_admin_permission
from seahub.utils.decorators import require_org_context

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

    @require_org_context
    def get(self, request, project_uuid):
        username = request.user.username

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

    @require_org_context
    def post(self, request, project_uuid):
        username = request.user.username

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

    @require_org_context
    def delete(self, request, project_uuid, token_id):
        username = request.user.username

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

    @require_org_context
    def put(self, request, project_uuid, token_id):
        username = request.user.username

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

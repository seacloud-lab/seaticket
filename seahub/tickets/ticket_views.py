# -*- coding: utf-8 -*-
import logging
from django.utils.translation import gettext as _

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects, TicketViews
from seahub.project.utils import check_project_permission

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


class TicketFolders(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, project_uuid):
        # add folder
        folder_name = request.data.get('name')

        # check view name
        if not folder_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder_name is invalid')

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

        # check record
        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The ticket views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            new_folder = TicketViews.objects.add_folder(project_uuid, folder_name)
            if not new_folder:
                return api_error(status.HTTP_400_BAD_REQUEST, 'add folder failed')
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'folder': new_folder})

    def put(self, request, project_uuid):
        # update folder: name etc.
        folder_id = request.data.get('folder_id', None)
        folder_data = request.data.get('folder_data', None)

        # check folder_id
        if not folder_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder_id is invalid')

        # check folder_data
        if not folder_data:
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder_data is invalid')
        if folder_data.get('_id') or folder_data.get('type') or folder_data.get('children'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder_data is invalid')
        
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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = f'The project {project_uuid} views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check folder exist
        if folder_id not in record.folders_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'folder {folder_id} does not exists.')

        try:
            result = TicketViews.objects.update_folder(project_uuid, folder_id, folder_data)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def delete(self, request, project_uuid):
        # delete folder by id
        # check folder_id
        folder_id = request.data.get('folder_id', None)
        if not folder_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder_id is invalid')
        
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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The project views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check folder exist
        if folder_id not in record.folders_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'folder {folder_id} does not exists.')

        try:
            result = TicketViews.objects.delete_folder(project_uuid, folder_id)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class TicketViewsAPI(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
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
            views = TicketViews.objects.list_views(project_uuid)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(views)

    def post(self, request, project_uuid):
        #  Add a view
        view_name = request.data.get('name')
        folder_id = request.data.get('folder_id', None)
        view_type = request.data.get('type', 'table')
        view_data = request.data.get('data', {})

        # check view name
        if not view_name:
            error_msg = 'view name is invalid.'
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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check folder exist
        if folder_id:
            if not record:
                error_msg = 'The views does not exists.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if folder_id not in record.folders_ids:
                return api_error(status.HTTP_400_BAD_REQUEST, 'folder %s does not exists' % folder_id)

        try:
            new_view = TicketViews.objects.add_view(project_uuid, view_name, view_type, view_data, folder_id)
            if not new_view:
                return api_error(status.HTTP_400_BAD_REQUEST, 'add view failed')
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'view': new_view})


class TicketViewView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid, view_id):
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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            view = TicketViews.objects.get_view(project_uuid, view_id)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'view': view})

    def put(self, request, project_uuid, view_id):
        # Update a view, including rename, change filters and so on
        # by a json data
        view_data = request.data.get('view_data', None)
        if not view_data:
            error_msg = 'view_data is invalid.'
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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if view_id not in record.views_ids:
            error_msg = f'view_id {view_id} does not exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            result = TicketViews.objects.update_view(project_uuid, view_id, view_data)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def delete(self, request, project_uuid, view_id):
        folder_id = request.data.get('folder_id', None)
        if not view_id:
            error_msg = 'view_id is invalid.'
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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check view exist
        if view_id not in record.views_ids:
            error_msg = f'view_id {view_id} does not exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # check folder exist
        if folder_id and folder_id not in record.folders_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'folder {folder_id} does not exists')

        try:
            result = TicketViews.objects.delete_view(project_uuid, view_id, folder_id)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class TicketViewsDuplicateView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid):
        view_id = request.data.get('view_id')
        folder_id = request.data.get('folder_id', None)
        if not view_id:
            error_msg = 'view_id invalid'
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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if view_id not in record.views_ids:
            error_msg = 'view_id %s does not exists.' % view_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check folder exist
        if folder_id and folder_id not in record.folders_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder %s does not exists' % folder_id)

        try:
            new_view = TicketViews.objects.duplicate_view(project_uuid, view_id, folder_id)
            if not new_view:
                return api_error(status.HTTP_400_BAD_REQUEST, 'duplicate view failed')
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'view': new_view})


class TicketViewsMoveView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid):
        # move view or folder to another position
        source_view_id = request.data.get('source_view_id')
        source_folder_id = request.data.get('source_folder_id')
        target_view_id = request.data.get('target_view_id')
        target_folder_id = request.data.get('target_folder_id')
        is_above_folder = request.data.get('is_above_folder', False)

        # must drag view or folder
        if not source_view_id and not source_folder_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'source_view_id and source_folder_id is invalid')

        # must move above to view/folder or move view into folder
        if not target_view_id and not target_folder_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'target_view_id and target_folder_id is invalid')

        # not allowed to drag folder into folder
        if not source_view_id and source_folder_id and target_view_id and target_folder_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'not allowed to drag folder into folder')

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

        record = TicketViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check dragged view exist
        if source_view_id and source_view_id not in record.views_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'source_view_id {source_view_id} does not exists.')

        # check dragged view exist
        if source_folder_id and source_folder_id not in record.folders_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'source_view_id {source_view_id} does not exists.')

        # check target view exist
        if target_view_id and target_view_id not in record.views_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'target_view_id {target_view_id} does not exists.')

        # check target view exist
        if target_folder_id and target_folder_id not in record.folders_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'target_folder_id {target_folder_id} does not exists.')

        try:
            results = TicketViews.objects.move_view(project_uuid, source_view_id, source_folder_id, target_view_id, target_folder_id, is_above_folder)
            if not results:
                return api_error(status.HTTP_400_BAD_REQUEST, 'move view or folder failed')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'navigation': results['navigation']})

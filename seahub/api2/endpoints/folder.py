import logging

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils.translation import gettext as _
from django.db import IntegrityError, OperationalError

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.constants import FOLDER_ITEM_PROJECT_GROUP_SHARE, FOLDER_ITEM_PROJECT
from seahub.project.models import Workspaces, Folders, FolderItems, Projects
from seahub.project.utils import check_project_admin_permission
from seahub.utils import uuid_str_to_32_chars

logger = logging.getLogger(__name__)


class FoldersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        name = request.data.get('name')
        if not name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'name invalid.')

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workspace not found.')

        if not check_project_admin_permission(request.user.username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        name = Folders.objects.get_non_duplicated_name(name, workspace_id)
        try:
            folder = Folders.objects.create(name=name, workspace_id=workspace_id)
        except OperationalError:
            error_msg = _('Folder name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except IntegrityError:
            error_msg = _('Folder %s already exists in this workspace.') % name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'folder': folder.to_dict()})


class FolderView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, workspace_id, folder_id):
        name = request.data.get('name')

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workspace not found.')

        if not check_project_admin_permission(request.user.username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        folder = Folders.objects.filter(id=folder_id, workspace_id=workspace.id).first()
        if not folder:
            return api_error(status.HTTP_404_NOT_FOUND, 'Folder not found.')

        try:
            if name:
                name = Folders.objects.get_non_duplicated_name(name, workspace_id)
                folder.name = name
            folder.save()
        except OperationalError:
            error_msg = _('Folder name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'folder': folder.to_dict()})

    def delete(self, request, workspace_id, folder_id):
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workspace not found.')

        # permission check
        if not check_project_admin_permission(request.user.username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        if not Folders.objects.filter(id=int(folder_id), workspace_id=int(workspace_id)):
            return api_error(status.HTTP_404_NOT_FOUND, 'Folder not found.')

        # find items and delete
        folder_items = FolderItems.objects.filter(folder_id=folder_id)
        item_id_types = folder_items.values_list('item_id', 'item_type')
        project_uuids, dtable_share_ids, view_share_ids = [], [], []
        for item_id, item_type in item_id_types:
            if item_type == FOLDER_ITEM_PROJECT:
                project_uuids.append(item_id)
            elif item_type == FOLDER_ITEM_PROJECT_GROUP_SHARE:
                dtable_share_ids.append(int(item_id))

        if Projects.objects.filter(uuid__in=project_uuids, deleted=False).exists():
            return api_error(status.HTTP_400_BAD_REQUEST, _('Folder is not empty. Can not be deleted.'))

        try:
            folder_items.delete()
            Folders.objects.filter(id=folder_id).delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class FolderItemMovingView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, workspace_id):
        # arguments check
        item_type = request.data.get('item_type')
        item_id = request.data.get('item_id')
        move_from = request.data.get('from')
        move_to = request.data.get('to')
        if not item_type or not item_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'item_type or item_id invalid.')
        if not move_from or not move_to or move_from == move_to:
            return api_error(status.HTTP_400_BAD_REQUEST, 'from or to invalid.')
        try:
            move_from = int(move_from) if move_from != '/' else '/'
            move_to = int(move_to) if move_to != '/' else '/'
            item_id = uuid_str_to_32_chars(item_id)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'from or to or item_id invalid.')
        if item_type not in [t[0] for t in FolderItems.ITEM_TYPE_CHOICES]:
            return api_error(status.HTTP_400_BAD_REQUEST, 'item_type invalid.')

        # permission and resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workspace not found.')
        if not check_project_admin_permission(request.user.username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        ## from and to check
        if move_from != '/':
            move_from_folder = Folders.objects.filter(id=move_from, workspace_id=workspace.id).first()
            if not move_from_folder:
                return api_error(status.HTTP_404_NOT_FOUND, 'From folder not found.')
            if not FolderItems.objects.filter(folder_id=move_from, item_type=item_type, item_id=item_id).exists():
                return api_error(status.HTTP_404_NOT_FOUND, 'Item not found in folder.')
        if move_to != '/':
            move_to_folder = Folders.objects.filter(id=move_to, workspace_id=workspace.id).first()
            if not move_to_folder:
                return api_error(status.HTTP_404_NOT_FOUND, 'To folder not found.')

        project = Projects.objects.get_project_by_uuid(item_id)
        if not project or project.workspace.id != workspace.id:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        # move
        try:
            if move_from == '/':
                FolderItems.objects.create(folder_id=move_to, item_type=item_type, item_id=item_id)
            elif move_to == '/':
                FolderItems.objects.filter(folder_id=move_from, item_type=item_type, item_id=item_id).delete()
            else:
                FolderItems.objects.filter(folder_id=move_from, item_type=item_type, item_id=item_id).update(
                    folder_id=move_to
                )
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

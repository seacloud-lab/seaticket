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
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.constants import FOLDER_ITEM_DTABLE_GROUP_SHARE, FOLDER_ITEM_VIEW_GROUP_SHARE, FOLDER_ITEM_DTABLE
from seahub.dtable.models import Workspaces, Folders, FolderItems, DTableGroupShare, DTables, DTableViewGroupShare, \
    UserShareFolders, DTableShare, DTableViewUserShare, UserStarredDTables
from seahub.dtable.utils import check_dtable_admin_permission
from seahub.group.utils import group_id_to_name
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

        if not check_dtable_admin_permission(request.user.username, workspace.owner):
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

        if not check_dtable_admin_permission(request.user.username, workspace.owner):
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
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        if not Folders.objects.filter(id=int(folder_id), workspace_id=int(workspace_id)):
            return api_error(status.HTTP_404_NOT_FOUND, 'Folder not found.')

        # find items and delete
        folder_items = FolderItems.objects.filter(folder_id=folder_id)
        item_id_types = folder_items.values_list('item_id', 'item_type')
        dtable_uuids, dtable_share_ids, view_share_ids = [], [], []
        for item_id, item_type in item_id_types:
            if item_type == FOLDER_ITEM_DTABLE:
                dtable_uuids.append(item_id)
            elif item_type == FOLDER_ITEM_DTABLE_GROUP_SHARE:
                dtable_share_ids.append(int(item_id))
            elif item_type == FOLDER_ITEM_VIEW_GROUP_SHARE:
                view_share_ids.append(int(item_id))

        if DTables.objects.filter(uuid__in=dtable_uuids, deleted=False).exists():
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
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
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

        ## item resource check
        if item_type == FOLDER_ITEM_DTABLE_GROUP_SHARE:
            dgs = DTableGroupShare.objects.filter(id=item_id).first()
            if not dgs or str(dgs.group_id) != workspace.owner.split('@')[0]:
                return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        elif item_type == FOLDER_ITEM_VIEW_GROUP_SHARE:
            dvgs = DTableViewGroupShare.objects.filter(id=item_id).first()
            if not dvgs or str(dvgs.to_group_id) != workspace.owner.split('@')[0]:
                return api_error(status.HTTP_404_NOT_FOUND, 'View not found.')
        else:
            dtable = DTables.objects.get_dtable_by_uuid(item_id)
            if not dtable or dtable.workspace.id != workspace.id:
                return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

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

class UserShareFoldersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        # add a share folders
        name = request.data.get('name')
        if not name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'name invalid.')

        username = request.user.username

        name = UserShareFolders.objects.get_non_duplicated_name(name, username)
        try:
            folder = UserShareFolders.objects.create(name=name, username=username)
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


class UserShareFolderView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, share_folder_id):
        # list shares in a folder

        try:
            share_folder_id = int(share_folder_id)
        except:
            error_msg = 'share_folder_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username

        folder_queryset = UserShareFolders.objects.filter(pk=share_folder_id, username=username)
        if not folder_queryset.exists():
            error_msg = 'Folder %s does not exist.' % share_folder_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        share_folder = folder_queryset[0]
        shared_tables_by_user = share_folder.dtable_user_shares.filter(
            dtable__deleted=False
        )
        shared_views_by_user = share_folder.view_user_shares.filter(
            dtable__deleted=False
        )

        starred_table_uuid_set = set(UserStarredDTables.objects.get_dtable_uuids_by_email(username))
        shared_table_list = list()
        shared_view_list = list()
        starred_table_uuid_list = set()
        starred_table_list = list()
        try:
            # shared tables
            for table in shared_tables_by_user:
                dtable_info = table.dtable.to_dict()
                dtable_info['share_id'] = table.id
                dtable_info['share_type'] = 'dtable-share'
                if table.dtable.uuid.hex in starred_table_uuid_set:
                    dtable_info['starred'] = True
                    if table.dtable.uuid.hex not in starred_table_uuid_list:
                        starred_table_uuid_list.add(table.dtable.uuid.hex)
                        starred_table_list.append(dtable_info)
                else:
                    dtable_info['starred'] = False
                dtable_info['from_user'] = table.from_user
                dtable_info['permission'] = table.permission
                avatar_url, is_default, date_uploaded = api_avatar_url(table.from_user)
                dtable_info['from_user_avatar'] = avatar_url
                if '@seafile_group' in table.from_user:
                    group_id = table.from_user.split('@')[0]
                    dtable_info['from_user_name'] = group_id_to_name(group_id)
                else:
                    dtable_info['from_user_name'] = email2nickname(table.from_user)
                shared_table_list.append(dtable_info)

            # shared views
            for view in shared_views_by_user:
                view_info = view.to_dict()
                avatar_url, is_default, date_uploaded = api_avatar_url(view_info['from_user'])
                view_info['from_user_name'] = email2nickname(view.from_user)
                view_info['to_user_name'] = email2nickname(view.to_user)
                view_info['from_user_avatar'] = avatar_url
                view_info['workspace_id'] = view.dtable.workspace.id
                view_info['color'] = view.dtable.color
                view_info['text_color'] = view.dtable.text_color
                view_info['icon'] = view.dtable.icon
                view_info['share_id'] = view.id
                view_info['share_type'] = 'view-share'
                shared_view_list.append(view_info)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({
            'shared_table_list': shared_table_list,
            'shared_view_list': shared_view_list,
            'folder_name':share_folder.name,
        })

    def put(self, request, share_folder_id):
        # rename a share folder
        try:
            share_folder_id = int(share_folder_id)
        except:
            error_msg = 'share_folder_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        name = request.data.get('name')
        username = request.user.username

        try:
            folder_queryset = UserShareFolders.objects.filter(pk=share_folder_id, username=username)
            if not folder_queryset.exists():
                error_msg = 'Folder %s does not exist.' % share_folder_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            folder = folder_queryset[0]

            name = UserShareFolders.objects.get_non_duplicated_name(name, username)
            folder.name = name
            folder.save()

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'folder': folder.to_dict()})



    def delete(self, request, share_folder_id):
        # delete a share folders
        try:
            share_folder_id = int(share_folder_id)
        except:
            error_msg = 'share_folder_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username

        try:
            folder_queryset = UserShareFolders.objects.filter(pk=share_folder_id, username=username)
            if not folder_queryset.exists():
                error_msg = 'Folder %s does not exist.' % share_folder_id
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            folder = folder_queryset[0]
            dtable_shares = folder.dtable_user_shares.all()
            if dtable_shares.exists():
                error_msg = _('Folder is not empty. Can not be deleted.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            dtable_view_shares = folder.view_user_shares.all()
            if dtable_view_shares.exists():
                error_msg = _('Folder is not empty. Can not be deleted.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            folder.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

class DTableUserShareMoveView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_share_id):
        try:
            dtable_share_id = int(dtable_share_id)
        except:
            error_msg = 'dtable_share_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        folder_name = request.data.get('move_to', '/')
        username = request.user.username
        if folder_name != '/':
            folder_queryset = UserShareFolders.objects.filter(name=folder_name, username=username)
            if not folder_queryset.exists():
                error_msg = 'Folder %s does not exist.' % folder_name
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            share_folder = folder_queryset[0]
        else:
            share_folder = None

        dtable_share_queryset = DTableShare.objects.filter(to_user=username, pk=dtable_share_id)
        if not dtable_share_queryset.exists():
            error_msg = 'dtable share does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_share = dtable_share_queryset[0]
        try:
            dtable_share.share_folder = share_folder
            dtable_share.save()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class DTableViewUserShareMoveView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, view_share_id):
        try:
            view_share_id = int(view_share_id)
        except:
            error_msg = 'view_share_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        folder_name = request.data.get('move_to', '/')
        username = request.user.username

        if folder_name != '/':
            folder_queryset = UserShareFolders.objects.filter(name=folder_name, username=username)
            if not folder_queryset.exists():
                error_msg = 'Folder %s does not exist.' % folder_name
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            share_folder = folder_queryset[0]
        else:
            share_folder = None


        dtable_view_share_queryset = DTableViewUserShare.objects.filter(to_user=username, pk=view_share_id)
        if not dtable_view_share_queryset.exists():
            error_msg = 'dtable share does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        view_share = dtable_view_share_queryset[0]
        try:
            view_share.share_folder = share_folder
            view_share.save()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

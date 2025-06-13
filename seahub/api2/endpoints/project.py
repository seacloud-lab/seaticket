# -*- coding: utf-8 -*-
import logging
import json

from django.utils.translation import gettext as _
from django.db.utils import OperationalError, IntegrityError
from django.contrib.auth.hashers import make_password, check_password

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.organizations.models import OrgGroup
from seahub.project.models import Workspaces, Projects, UserStarredProjects, FolderItems, Folders, ProjectGroupOrders
from seahub.group.utils import group_id_to_name
from seahub.project.utils import check_base_limit, check_dtable_admin_permission
from seahub.project.constants import FOLDER_ITEM_PROJECT

logger = logging.getLogger(__name__)


FILE_TYPE = '.dtable'


class WorkspacesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """get all workspaces
        """
        detail = request.GET.get('detail', 'true')
        if detail not in ('true', 'false'):
            error_msg = 'detail invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        groups = OrgGroup.objects.get_org_groups_by_user(org_id, username)
        group_id_list = []
        admin_group_ids = []
        for group in groups:
            group_id = group.group_id
            group_id_list.append(group_id)
            if group.is_staff:
                admin_group_ids.append(group_id)

        group_orders = ProjectGroupOrders.objects.filter(username=username).first()
        if not group_orders:
            try:
                ProjectGroupOrders.objects.create(
                    username=username,
                    detail=json.dumps({'group_ids': group_id_list})
                )
            except Exception as e:
                logger.warning("group order create warning: %s" % e)
                pass
        else:
            group_id_list = group_orders.flush(group_id_list)

        owner_list = [username] + ['%s@seafile_group' % group_id for group_id in group_id_list]

        try:
            workspaces = Workspaces.objects.filter(owner__in=owner_list)
            if not workspaces.filter(owner=username).exists() and detail == 'true':
                workspaces = list(workspaces)
                workspace = Workspaces.objects.create_workspace(username, org_id)
                workspaces.extend([workspace])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        workspace_list = list()
        if detail == 'false':
            workspace_list.append(dict(id='', name='starred', type='starred'))
            workspace_list.append(dict(id='', name='shared', type='shared'))
            workspace_list_for_group = []
            for workspace in workspaces:
                owner = workspace.owner
                res = dict(id=workspace.id)
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    res['name'] = group_id_to_name(group_id)
                    res['type'] = 'group'
                    res['group_id'] = group_id
                    res['group_owner'] = [g.creator_name for g in groups if g.id == group_id][0]
                    res['is_admin'] = group_id in admin_group_ids
                    workspace_list_for_group.append(res)
                else:
                    res['name'] = 'personal'
                    res['type'] = 'personal'
                    workspace_list.append(res)

            workspace_list_for_group = sorted(workspace_list_for_group, key=lambda x: group_id_list.index(x.get('group_id')))
            workspace_list.extend(workspace_list_for_group)

            return Response({'workspace_list': workspace_list}, status=status.HTTP_200_OK)

        try:
            project_list = Projects.objects.filter(workspace__in=workspaces, deleted=False).select_related()
            starred_project_uuid_set = set(UserStarredProjects.objects.get_project_uuids_by_email(username))

            # folders and folder-items
            folders = list(Folders.objects.filter(workspace_id__in=[w.id for w in workspaces]))
            folder_items = list(FolderItems.objects.filter(folder_id__in=[f.id for f in folders]))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        starred_project_uuid_list = set()
        starred_project_list = list()

        # group and personal tables
        workspace_id2project_list = {}
        for project in project_list:
            project_info = project.to_dict()
            if project.workspace.id in workspace_id2project_list:
                workspace_id2project_list[project.workspace.id].append(project_info)
            else:
                workspace_id2project_list[project.workspace.id] = [project_info]
            if project.uuid.hex in starred_project_uuid_set:
                project_info['starred'] = True
                if project.uuid.hex not in starred_project_uuid_list:
                    starred_project_uuid_list.add(project.uuid.hex)
                    starred_project_list.append(project_info)
            else:
                project_info['starred'] = False

        starred_tables = dict(id='', name='starred', type='starred')
        starred_tables['project_list'] = starred_project_list
        workspace_list.append(starred_tables)

        # handle folders and folder-items
        folder_items_dict = {}
        for item in folder_items:
            if item.folder_id not in folder_items_dict:
                folder_items_dict[item.folder_id] = [item]
            else:
                folder_items_dict[item.folder_id].append(item)
        workspace_folders_dict = {}
        for folder in folders:
            folder_info = folder.to_dict()
            items = folder_items_dict.get(folder.id, [])

            folder_info.update({'items': [i.to_dict() for i in items]})
            if folder.workspace_id not in workspace_folders_dict:
                workspace_folders_dict[folder.workspace_id] = [folder_info]
            else:
                workspace_folders_dict[folder.workspace_id].append(folder_info)

        workspace_list_for_group =[]
        for workspace in workspaces:
            owner = workspace.owner
            res = dict(id=workspace.id)
            if '@seafile_group' in owner:
                group_id = int(owner.split('@')[0])
                res['name'] = group_id_to_name(group_id)
                res['type'] = 'group'
                res['group_id'] = group_id
                res['group_owner'] = [g.creator_name for g in groups if g.id == group_id][0]
                res['is_admin'] = group_id in admin_group_ids
                res['project_list'] = workspace_id2project_list.get(workspace.id, [])
                res['folders'] = workspace_folders_dict.get(workspace.id, [])
                workspace_list_for_group.append(res)
            else:
                res['name'] = 'personal'
                res['type'] = 'personal'
                res['project_list'] = workspace_id2project_list.get(workspace.id, [])
                res['folders'] = workspace_folders_dict.get(workspace.id, [])
                workspace_list.append(res)
        workspace_list_for_group = sorted(workspace_list_for_group, key=lambda x: group_id_list.index(x.get('group_id')))
        workspace_list.extend(workspace_list_for_group)

        return Response({'workspace_list': workspace_list}, status=status.HTTP_200_OK)


class ProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request):
        """
        Permission:
        1. owner
        2. group admin
        """
        # role permission check
        if not request.user.permissions.can_add_project():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        project_owner = request.POST.get('owner')
        workspace_id = request.POST.get('workspace_id')
        folder_id = request.POST.get('folder_id')

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_name = request.POST.get('name')
        if not project_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # color text-color icon
        color = request.data.get('color')
        text_color = request.data.get('text_color')
        icon = request.data.get('icon')
        password = request.data.get('password', None)

        # resource check
        if project_owner:
            workspace = Workspaces.objects.get_workspace_by_owner(project_owner)
            if not workspace:
                org_id = -1
                if is_org_context(request):
                    org_id = request.user.org.org_id
                try:
                    workspace = Workspaces.objects.create_workspace(project_owner, org_id)
                except Exception as e:
                    logger.error(e)
                    error_msg = 'Internal Server Error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        elif workspace_id:
            workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
            if not workspace:
                error_msg = 'Workspace not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        else:
            workspace = Workspaces.objects.get_workspace_by_owner(request.user.username)

        existed_projects = Projects.objects.filter(workspace=workspace, name=project_name)
        if len(existed_projects) > 0:
            error_msg = _('Project %s already exists in this workspace.') % project_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        folder = None
        if folder_id:
            folder = Folders.objects.filter(id=folder_id).first()
            if not folder or folder.workspace_id != workspace.id:
                error_msg = 'Folder not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_base_limit(workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            if password:
                password = make_password(password)
            project = Projects.objects.create_project(username, workspace, project_name, color=color, text_color=text_color, icon=icon, password=password)
            if folder:
                FolderItems.objects.create(folder_id=folder.id, item_type=FOLDER_ITEM_PROJECT, item_id=dtable.uuid.hex)
        except OperationalError:
            error_msg = _('Base name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except IntegrityError:
            error_msg = _('Base %s already exists in this workspace.') % project_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"project": project.to_dict()}, status=status.HTTP_201_CREATED)


class ProjectView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, workspace_id):
        """rename a project

        Permission:
        1. owner
        2. group adminn
        """
        # argument check
        # name
        project_name = request.data.get('name')
        if not project_name:
            error_msg = _('Base name is invalid')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_project_name = request.data.get('new_name')

        # color text-color icon
        color = request.data.get('color')
        text_color = request.data.get('text_color')
        icon = request.data.get('icon')
        password = request.data.get('password')

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.get_dtable(workspace, project_name)
        if not project:
            error_msg = _('Base %s not found.') % project_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if Projects.objects.filter(workspace_id=workspace_id, name=new_project_name).exclude(pk=project.pk).exists():
            error_msg = _('%s exists.') % (new_project_name,)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            if new_project_name:
                project.name = new_project_name
            if color:
                project.color = color
            if text_color:
                project.text_color = text_color
            if icon:
                project.icon = icon
            project.modifier = username
            project.save()
        except OperationalError:
            error_msg = _('Base name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"project": project.to_dict()}, status=status.HTTP_200_OK)

    def delete(self, request, workspace_id):
        """delete a table

        Permission:
        1. owner
        2. group admin
        """
        # argument check
        table_name = request.data.get('name')
        if not table_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # repo status check
        repo_status = repo.status
        if repo_status != 0:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # rename .dtable file
        new_dtable_name, old_dtable_file_name, new_dtable_file_name = convert_dtable_trash_names(dtable)

        # if has .dtable file, then rename, else skip
        try:
            storage_backend.rename_dtable(dtable, old_dtable_file_name, new_dtable_file_name, username)
        except Exception as e:
            logger.error('delete dtable file: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            DTables.objects.filter(id=dtable.id).update(deleted=True,
                                                        delete_time=datetime.now(),
                                                        name=new_dtable_name)
            move_dtable_to_trash.send(None, dtable_uuid=dtable.uuid.hex)
            if GROUP_DOMAIN == workspace.owner[ - len(GROUP_DOMAIN) : ] :
                group_id = int(workspace.owner[ : - len(GROUP_DOMAIN)])
                group = ccnet_api.get_group(int(group_id))
                audit_operation.send(None, username=username, operation=GROUP_BASE_DELETE, detail={
                    'id': group_id,
                    'name': group.group_name,
                    'dtable_name': table_name,
                    'dtable_uuid': str(dtable.uuid)
                }, org_id=workspace.org_id)
            else:
                audit_operation.send(None, username=username, operation=BASE_DELETE, detail={
                    'name': table_name,
                    'dtable_uuid': str(dtable.uuid)
                }, org_id=workspace.org_id)
        except Exception as e:
            logger.error('delete dtable: %s error: %s', dtable.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)

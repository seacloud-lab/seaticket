# -*- coding: utf-8 -*-
import logging
import json
from datetime import datetime, UTC

from django.utils.translation import gettext as _
from django.db.utils import OperationalError, IntegrityError

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.organizations.models import OrgGroup
from seahub.project.models import Workspaces, Projects, ProjectGroupOrders, \
    ChatSessions, ChatMessages, ProjectAPIToken, ChatToolCalls
from seahub.group.utils import group_id_to_name
from seahub.project.utils import check_project_limit, check_project_admin_permission, \
    convert_project_trash_names, check_project_permission, search, \
    delete_session, format_tool_calls, format_thought_process

from seahub.seadb_models.utils import init_ticket_seadb_table, init_knowledge_base_seadb_table

from seahub.project.seadb_api import SeaDBAPI

logger = logging.getLogger(__name__)


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
            workspace_list_for_group = []
            for workspace in workspaces:
                owner = workspace.owner
                res = dict(id=workspace.id)
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    res['name'] = group_id_to_name(group_id)
                    res['type'] = 'group'
                    res['group_id'] = group_id
                    res['group_owner'] = [g.creator_name for g in groups if g.group_id == group_id][0]
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
            projects = Projects.objects.filter(workspace__in=workspaces, deleted=False).select_related()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


        # group and personal tables
        workspace_id2project_list = {}
        for project in projects:
            project_info = project.to_dict()
            if project.workspace.id in workspace_id2project_list:
                workspace_id2project_list[project.workspace.id].append(project_info)
            else:
                workspace_id2project_list[project.workspace.id] = [project_info]
            project_info['starred'] = False


        workspace_list_for_group =[]
        for workspace in workspaces:
            owner = workspace.owner
            res = dict(id=workspace.id)
            if '@seafile_group' in owner:
                group_id = int(owner.split('@')[0])
                res['name'] = group_id_to_name(group_id)
                res['type'] = 'group'
                res['group_id'] = group_id
                res['group_owner'] = [g.creator_name for g in groups if g.group_id == group_id][0]
                res['is_admin'] = group_id in admin_group_ids
                res['projects'] = workspace_id2project_list.get(workspace.id, [])
                workspace_list_for_group.append(res)
            else:
                res['name'] = 'personal'
                res['type'] = 'personal'
                res['projects'] = workspace_id2project_list.get(workspace.id, [])
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

        if not check_project_limit(workspace, request):
            error_msg = 'base exceeded.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            project = Projects.objects.create_project(username, workspace, project_name, color=color, text_color=text_color, icon=icon)
        except OperationalError:
            error_msg = _('Project name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except IntegrityError:
            error_msg = _('Project %s already exists in this workspace.') % project_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            seadb_api.create_base(project.uuid)
            init_ticket_seadb_table(seadb_api, project.uuid)
            init_knowledge_base_seadb_table(seadb_api, project.uuid)
        except Exception as e:
            logger.error(e)
            project.delete()
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
            error_msg = _('Project name is invalid')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_project_name = request.data.get('new_name')

        # color text-color icon
        color = request.data.get('color')
        text_color = request.data.get('text_color')
        icon = request.data.get('icon')
        settings = request.data.get('settings')
        password = request.data.get('password')

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.get_project(workspace, project_name)
        if not project:
            error_msg = _(f'Project {project_name} not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if Projects.objects.filter(workspace_id=workspace_id, name=new_project_name).exclude(pk=project.pk).exists():
            error_msg = _(f'{new_project_name} exists.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
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
            if settings:
                if project.settings:
                    project_settings = json.loads(project.settings)
                else:
                    project_settings = {}
                update_settings = json.loads(settings)
                for k,v in update_settings.items():
                    project_settings[k] = v
                project.settings = json.dumps(project_settings)
            project.modifier = username
            project.save()
        except OperationalError:
            error_msg = _('Project name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"project": project.to_dict()}, status=status.HTTP_200_OK)

    def delete(self, request, workspace_id):
        """delete a project
        """
        # argument check
        project_name = request.data.get('name')
        if not project_name:
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

        project = Projects.objects.get_project(workspace, project_name)
        if not project:
            error_msg = 'project_name %s not found.' % project_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        new_project_name = convert_project_trash_names(project)
        try:
            Projects.objects.filter(id=project.id).update(deleted=True, delete_time=datetime.now(UTC), name=new_project_name)
            ProjectAPIToken.objects.filter(project=project).delete()
        except Exception as e:
            logger.error('delete project: %s error: %s', project.id, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


class SearchView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request):
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            error_msg = 'workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        query = request.data.get('query')
        if not query:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            count = int(request.GET.get('count', '20'))
        except ValueError:
            count = 20

        connection_ids = request.data.get('connection_ids')
        if not connection_ids:
            error_msg = 'connection_ids invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        time_from = request.data.get('time_from')
        time_to = request.data.get('time_to')

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = f'project {project_uuid} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'project_uuid': uuid_str_to_32_chars(project_uuid),
            'query': query,
            'connection_ids': connection_ids,
            'count': count,
            'time_from': time_from,
            'time_to': time_to,
        }
        results = search(params)

        return Response({'results': results})

class ChatSessionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """Retrieve the user's chat session list"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        project_uuid = request.GET.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
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
            sessions = ChatSessions.objects.get_sessions_by_project(project_uuid, request.user.username)
            sessions_data = [session.to_dict() for session in sessions]

            return Response({'sessions': sessions_data})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    def post(self, request):
        """Create a new chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        session_name = request.data.get('session_name', '')
        if not session_name:
            error_msg = 'session_name parameter is required.'
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
            session = ChatSessions.objects.create_session(
                project_uuid=project_uuid,
                session_name=session_name,
                username=request.user.username
            )

            return Response({ 'session': session.to_dict() }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatSessionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, session_uuid):
        """Modify chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        session_name = request.data.get('session_name', '')
        if not session_name:
            error_msg = 'session_name parameter is required.'
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
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            session.session_name = session_name
            session.save()

            return Response({'success': True})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

    def delete(self, request, session_uuid):
        """Delete chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        project_uuid = request.data.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
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
            if delete_session(session_uuid):
                return Response({'success': True})
            else:
                error_msg = 'Failed to delete session.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class ChatMessagesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, session_uuid):
        """Retrieve the message list of the chat session"""
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        project_uuid = request.GET.get('project_uuid')
        if not project_uuid:
            error_msg = 'project_uuid parameter is required.'
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
            session = ChatSessions.objects.get_session_by_uuid(session_uuid)
            if not session:
                error_msg = 'Session not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            messages = ChatMessages.objects.get_messages_by_session(session_uuid)

            message_ids = set([message.message_id for message in messages])

            tool_calls_history = ChatToolCalls.objects.get_tool_calls_from_session_uuid_and_message_ids(session_uuid, message_ids)

            messages_data = []
            for message in messages:
                data = message.to_dict()
                if message.role == 'assistant':
                    if message.is_agent_mode:
                        if thought_process := format_thought_process(tool_calls_history.get(message.message_id, {})):
                            data['thought_process'] = thought_process
                    elif tool_calls := format_tool_calls(tool_calls_history.get(message.message_id, {})):
                        data['tool_calls'] = tool_calls
                messages_data.append(data)

            return Response({'messages': messages_data})

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

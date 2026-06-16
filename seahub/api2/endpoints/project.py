# -*- coding: utf-8 -*-
import logging
import json
import re
from datetime import datetime, UTC
from seahub.utils import normalize_cache_key

from django.utils.translation import gettext as _
from django.db.utils import OperationalError, IntegrityError
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context, uuid_str_to_32_chars, uuid_str_to_36_chars
from seahub.organizations.models import OrgGroup
from seahub.project.models import Workspaces, Projects, ProjectGroupOrders, \
    ProjectAPIToken, ProjectConnections
from seahub.group.utils import group_id_to_name
from seahub.project.utils import check_project_limit, check_project_admin_permission, \
    convert_project_trash_names, check_project_permission, delete_project, restore_trash_project_name, \
    rank_vector_search_results, is_url_end_with_number, parse_webpage_url, is_current_server, extract_fields_from_url, \
    get_org_project_connections_by_prefix_url, get_org_project_connections_by_connection_ids
from seahub.seadb_models.utils import init_seadb_tables_from_schema, ensure_portal_issues_seadb_table, retrieve_vector_search_rerank_data
from seahub.project.seadb_api import SeaDBAPI
from seahub.utils.decorators import require_org_context
from seahub.utils.indexer import keyword_search, vector_search_with_text

from seahub.seadb_models.models import SchemaTables
from seahub.seadb_models.utils import get_discourse_topic_by_topic_id, get_issue_record_by_issue_number, get_connection_record_by_pk
from seahub.project.constants import ConnectionType, REF_URL_CONNECTION_CACHE_PREFIX, REF_URL_CONNECTION_CACHE_TIMEOUT


logger = logging.getLogger(__name__)

PROJECT_PROMPT_TAG_LIKE_RE = re.compile(r'<[^>]+>')


def is_safe_prompt(value):
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    return PROJECT_PROMPT_TAG_LIKE_RE.search(value) is None


class WorkspacesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request):
        """get all workspaces
        """

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
            if not workspaces.filter(owner=username).exists():
                workspaces = list(workspaces)
                workspace = Workspaces.objects.create_workspace(username, org_id)
                workspaces.extend([workspace])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

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

        workspace_list = list()
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


class RelatedProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request):
        """get all related projects
        """
        username = request.user.username
        org_id = request.user.org.org_id
        webpage = request.GET.get('webpage', '')

        if not webpage or not is_url_end_with_number(webpage):
            error_msg = 'webpage invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if is_current_server(webpage):
            url_params = extract_fields_from_url(webpage)
            if not url_params:
                error_msg = 'Not support url'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            workspace_id = url_params.get('workspace_id')
            project_name = url_params.get('project_name')
            connection_id = url_params.get('connection_id')
            record_id = url_params.get('record_id')
            workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
            if not workspace:
                return api_error(status.HTTP_404_NOT_FOUND, 'Workspace does not exist.')

            permission = check_project_permission(username, workspace.owner)
            if not permission:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

            project = Projects.objects.get_project(workspace, project_name)
            if not project:
                return api_error(status.HTTP_404_NOT_FOUND, _('This project does not exist'))

            project_uuid = project.uuid
            project_name = project.name
            project_connection = ProjectConnections.objects.get_connection_by_id(connection_id)
            if not project_connection or str(project_connection.project_uuid) != str(project_uuid):
                error_msg = f'project_connection {connection_id} not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            connection_type = project_connection.type

            workspace_owner = workspace.owner
            if '@seafile_group' in workspace_owner:
                group_id = int(workspace_owner.split('@')[0])
                workspace_type = 'group'
                workspace_name = group_id_to_name(group_id)
            else:
                workspace_type = 'personal'
                workspace_name = 'personal'

            seadb_api = SeaDBAPI()
            record, columns, linked_ticket_title = get_connection_record_by_pk(seadb_api, project_uuid, connection_type, connection_id, record_id)
            return Response({'projects': [
                {
                    'uuid': project_uuid,
                    'name': project_name,
                    'icon': project.icon,
                    'color': project.color,
                    'workspace_id': workspace_id,
                    'workspace_type': workspace_type,
                    'workspace_name': workspace_name,
                    'permission': permission,
                    'related_info': {
                        'record': record,
                        'columns': columns,
                        'connection_type': connection_type,
                        'connection_id': connection_id,
                        'linked_ticket_title': linked_ticket_title
                    }
                }
            ]}, status=status.HTTP_200_OK)

        external_ref_url, external_ref_id, connection_type = parse_webpage_url(webpage)
        if not external_ref_id or not external_ref_url:
            error_msg = 'webpage invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        related_projects = []
        connection_cache_key = normalize_cache_key((str(org_id) + '_' + external_ref_url), REF_URL_CONNECTION_CACHE_PREFIX)
        connection_ids = cache.get(connection_cache_key, None)
        has_connection_cache = False
        if connection_ids is not None:
            has_connection_cache = True
            if not connection_ids:
                return Response({'projects': related_projects}, status=status.HTTP_200_OK)
            workspace_project_connections = get_org_project_connections_by_connection_ids(org_id, connection_ids)
        else:
            workspace_project_connections = get_org_project_connections_by_prefix_url(org_id, external_ref_url, connection_type)

        seadb_api = SeaDBAPI()
        related_connections = []
        for wpc in workspace_project_connections:
            if wpc.get('workspace_deleted') or wpc.get('project_deleted') or wpc.get('connection_deleted'):
                continue
            owner = wpc.get('owner')
            project_uuid = wpc.get('uuid')
            connection_id = wpc.get('connection_id')
            related_connections.append(connection_id)

            permission = check_project_permission(request.user.username, owner)
            if not permission:
                continue

            if connection_type == ConnectionType.DISCOURSE_FORUM.value:
                record, columns, linked_ticket_title = get_discourse_topic_by_topic_id(seadb_api, project_uuid, connection_id, external_ref_id)
            else:
                record, columns, linked_ticket_title = get_issue_record_by_issue_number(seadb_api, project_uuid, connection_id, external_ref_id)
            if not record:
                continue
            project_info = {}
            project_info['related_info'] = {
                'record': record,
                'columns': columns,
                'connection_type': connection_type,
                'connection_id': connection_id,
                'linked_ticket_title': linked_ticket_title,
            }

            if '@seafile_group' in owner:
                group_id = int(owner.split('@')[0])
                project_info['workspace_name'] = group_id_to_name(group_id)
                project_info['workspace_type'] = 'group'
            else:
                project_info['workspace_name'] = 'personal'
                project_info['workspace_type'] = 'personal'
            project_info['name'] = wpc.get('name')
            project_info['uuid'] = uuid_str_to_36_chars(project_uuid)
            project_info['workspace_id'] = wpc.get('workspace_id')
            project_info['permission'] = permission
            related_projects.append(project_info)

        if not has_connection_cache:
            cache.set(connection_cache_key, related_connections, REF_URL_CONNECTION_CACHE_TIMEOUT)

        return Response({'projects': related_projects}, status=status.HTTP_200_OK)


class ProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
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
            error_msg = 'Project exceeded.'
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
            seadb_api = SeaDBAPI()
            seadb_api.create_base(project.uuid)
            init_seadb_tables_from_schema([SchemaTables.TICKETS, SchemaTables.TICKET_COMMENTS, SchemaTables.TICKET_ACTIVITIES], seadb_api, project.uuid)
            init_seadb_tables_from_schema([SchemaTables.KNOWLEDGE_BASE], seadb_api, project.uuid)
            init_seadb_tables_from_schema([SchemaTables.TAG], seadb_api, project.uuid)
            init_seadb_tables_from_schema([SchemaTables.AGENT_RUNS, SchemaTables.AGENT_ACTIONS], seadb_api, project.uuid)
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

    @require_org_context
    def put(self, request, workspace_id):
        """update a project

        Permission:
        1. owner
        2. group admin
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
        target_workspace_id = request.data.get('workspace_id')

         # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = f'Workspace {workspace_id} not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        project = Projects.objects.get_project(workspace, project_name)
        if not project:
            error_msg = _(f'Project {project_name} not found.')
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if new_project_name and Projects.objects.filter(workspace_id=workspace_id, name=new_project_name).exclude(pk=project.pk).exists():
            error_msg = _(f'{new_project_name} exists.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        if not check_project_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if target_workspace_id is not None:
            try:
                target_workspace_id = int(target_workspace_id)
            except (TypeError, ValueError):
                error_msg = 'workspace_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if target_workspace_id != workspace.id:
                target_workspace = Workspaces.objects.get_workspace_by_id(target_workspace_id)
                if not target_workspace:
                    error_msg = f'Workspace {target_workspace_id} not found.'
                    return api_error(status.HTTP_404_NOT_FOUND, error_msg)

                if target_workspace.org_id != request.user.org.org_id:
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)

                if not check_project_admin_permission(username, target_workspace.owner):
                    error_msg = 'Permission denied.'
                    return api_error(status.HTTP_403_FORBIDDEN, error_msg)

                if not check_project_limit(target_workspace, request):
                    error_msg = 'Project exceeded.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                target_project_name = new_project_name if new_project_name else project.name
                if Projects.objects.filter(workspace_id=target_workspace.id, name=target_project_name).exists():
                    error_msg = _(f'{target_project_name} exists.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            should_init_portal_issues = False
            if new_project_name:
                project.name = new_project_name
            if target_workspace_id:
                project.workspace_id = target_workspace_id
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
                project_prompt = update_settings.get('prompt')
                if not is_safe_prompt(project_prompt):
                    error_msg = _('Project prompt contains disallowed tag-like content.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                agent_settings = update_settings.get('agent')
                if isinstance(agent_settings, dict):
                    ticket_rules = agent_settings.get('ticket_rules')
                    if not is_safe_prompt(ticket_rules):
                        error_msg = _('Ticket Agent rules must be text, and cannot contain tag-like content.')
                        return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                old_enable_portal = bool((project_settings.get('portal') or {}).get('enable_portal', False))
                for k,v in update_settings.items():
                    project_settings[k] = v
                new_enable_portal = bool((project_settings.get('portal') or {}).get('enable_portal', False))
                should_init_portal_issues = not old_enable_portal and new_enable_portal
                project.settings = json.dumps(project_settings)
            project.modifier = username
            project.save()
            if should_init_portal_issues:
                seadb_api = SeaDBAPI()
                ensure_portal_issues_seadb_table(seadb_api, project.uuid)
        except OperationalError:
            error_msg = _('Project name contains illegal characters')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"project": project.to_dict()}, status=status.HTTP_200_OK)

    @require_org_context
    def delete(self, request, workspace_id):
        """delete a project
        """
        # argument check
        project_name = request.data.get('name')
        if not project_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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

    @require_org_context
    def post(self, request):
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

        search_type = request.data.get('search_type', 'keyword_search')
        if search_type not in ('keyword_search', 'semantic_search'):
            error_msg = 'search_type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            count = int(request.GET.get('count', '20'))
        except ValueError:
            count = 20

        extra_sources = request.data.get('extra_sources', [])
        if extra_sources and not isinstance(extra_sources, list):
            error_msg = 'extra_sources invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        connection_ids = request.data.get('connection_ids')
        if not connection_ids and not extra_sources:
            error_msg = 'sources invalid.'
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
            'extra_sources': extra_sources,
            'count': count,
            'time_from': time_from,
            'time_to': time_to
        }
        
        if search_type == 'keyword_search':
            results = keyword_search(params)
        else:
            results = vector_search_with_text(params)
            org_id = request.user.org.org_id if is_org_context(request) else -1
            # preparing required fields for reranking
            results = retrieve_vector_search_rerank_data(SeaDBAPI(), uuid_str_to_32_chars(project_uuid), results)

            # rerank
            results = rank_vector_search_results({'ai_summary': query}, results, org_id, project_uuid)

        # returns only the required fields
        formatted_results = []
        for result in results:
            res = {
                'type': result['type'],
                '_id': result['_id'],
                'title': result['title'],
                'content': result['content'],
                'modified_time': result['modified_time']
            }
            connection_id = result.get('connection_id')
            if connection_id:
                res['connection_id'] = connection_id
            formatted_results.append(res)
        return Response({'results': formatted_results})

class TrashProjectsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        username = request.user.username
        try:
            projects = Projects.objects.filter(deleted=True,workspace__owner=username).select_related('workspace').order_by('-delete_time')
        except Exception as e:
            logger.error('get deleted projects error: %s', e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        count = projects.count()
        results = [project.to_dict(include_deleted=True) for project in projects[:500]]

        return Response({'count': count, 'trash_project_list': results})

    def delete(self, request):
        username = request.user.username
        try:
            projects = Projects.objects.filter(deleted=True, workspace__owner=username).select_related('workspace')
            for project in projects:
                delete_project(project)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class TrashProjectView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    def put(self, request, project_uuid):

        username = request.user.username
        # resource check
        project = Projects.objects.filter(uuid=project_uuid, deleted=True).select_related('workspace').first()
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if username != project.workspace.owner:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        new_project_name = restore_trash_project_name(project)
        # check existed project
        if Projects.objects.get_project(project.workspace, new_project_name):
            error_msg = 'Project with name "%s" exists.' % new_project_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # restore project
        try:
            Projects.objects.filter(
                uuid=project_uuid, deleted=True).update(deleted=False, delete_time=None, name=new_project_name)
        except Exception as e:
            logger.error('restore project: %s name: %s error: %s', project.id, project.name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

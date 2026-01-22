# -*- coding: utf-8 -*-
import datetime
import logging
import json

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
from seahub.project.utils import replace_file_url_in_content, check_same_org_permission
from seahub.utils.storage import upload_files_to_s3
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import TicketsTable
from seahub.seadb_models.utils import list_my_tickets, list_knowledge_base_records
from seahub.tickets.ticket_utils import check_ticket_creation_interval, TABLE_TICKETS, get_ticket_counts_group_by_column_name
from seahub.knowledge_base.models import KnowledgeBaseViews
from seahub.utils.decorators import require_org_context

logger = logging.getLogger(__name__)


class PortalTicketsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        title = request.POST.get('title')
        if not title:
            error_msg = 'title invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        content_dict = request.POST.get('content')
        if not content_dict:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            content_dict = json.loads(content_dict)
        except:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not isinstance(content_dict, dict):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        content = content_dict.get('text')
        if not content:
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_urls = content_dict.get('images')
        if file_urls and not isinstance(file_urls, list):
            error_msg = 'content invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        link_urls = content_dict.get('links')
        if link_urls and isinstance(link_urls, list):
            file_urls = (file_urls or []) + link_urls

        type_name = request.POST.get('type', '')

        priority = request.data.get('priority')
        if priority is not None:
            try:
                priority = int(priority)
            except:
                error_msg = 'priority invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if priority < 0:
                priority = 0
            elif priority > 5:
                priority = 5
        else:
            priority = 0

        tag_names = request.POST.get('tags', "[]")
        try:
            tag_names = json.loads(tag_names)
        except:
            tag_names = []
        if not isinstance(tag_names, list):
            tag_names = []

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_same_org_permission(request.user, project.workspace):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        seadb_api = SeaDBAPI(username)

        if not check_ticket_creation_interval(seadb_api, project_uuid, username):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            ticket_state = 'open'
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()

            row = {
                TicketsTable.title.name: title,
                TicketsTable.content.name: content,
                TicketsTable.state.name: ticket_state,
                TicketsTable.type.name: type_name if type_name else None,
                TicketsTable.substate.name: '',
                TicketsTable.priority.name: priority,
                TicketsTable.assignees.name: [],
                TicketsTable.participants.name: [username],
                TicketsTable.tags.name: tag_names,
                TicketsTable.creator.name: username,
                TicketsTable.comment_count.name: 0,
                TicketsTable.created_time.name: now_datetime,
                TicketsTable.modified_time.name: now_datetime,
                TicketsTable.deleted.name: False,
            }
            res = seadb_api.insert_rows(project_uuid, TABLE_TICKETS, [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            ticket_pk = pks[0]
            row.update({'_pk': ticket_pk})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'ticket': row}, status=status.HTTP_201_CREATED)


class PortalMyTicketsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        view_id = request.POST.get('view_id', 'open')
        start = request.POST.get('start', 0)
        limit = request.POST.get('limit', 1000)
        view_config = request.POST.get('config', '{}')

        try:
            start = int(start)
            limit = int(limit)
            view_config = json.loads(view_config)
        except:
            start = 0
            limit = 1000
            view_config = {}

        ticket_state = view_id
        if ticket_state not in ['open', 'closed']:
            ticket_state = 'open'

        if start < 0:
            error_msg = 'start invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if limit < 0:
            error_msg = 'limit invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_same_org_permission(request.user, project.workspace):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        seadb_api = SeaDBAPI(username)

        basic_filters = view_config.get('basic_filters', [])
        basic_filters.append({
            'column_name': 'creator',
            'filter_predicate': 'is',
            'filter_term': username,
        })
        view_config['basic_filters'] = basic_filters

        try:
            tickets, columns = list_my_tickets(seadb_api, project_uuid, username, ticket_state, start, limit, view_config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'tickets': tickets,
            'columns': columns,
        })


class PortalTicketTypesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_same_org_permission(request.user, project.workspace):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        seadb_api = SeaDBAPI(username)

        try:
            type_options, _ = get_ticket_counts_group_by_column_name(seadb_api, project_uuid, 'type')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'types': type_options})


class PortalTicketTagsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_same_org_permission(request.user, project.workspace):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        seadb_api = SeaDBAPI(username)

        try:
            tag_options, _ = get_ticket_counts_group_by_column_name(seadb_api, project_uuid, 'tags', 'multiple-select')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'tags': tag_options})


class PortalKnowledgeBaseViewsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_same_org_permission(request.user, project.workspace):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        show_kb = False
        try:
            settings_obj = json.loads(project.settings) if project.settings else {}
            show_kb = bool(settings_obj.get('portal_show_knowledge_base', False))
        except Exception:
            show_kb = False
        if not show_kb:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            views = KnowledgeBaseViews.objects.list_views(project_uuid)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(views)


class PortalKnowledgeBaseRecordsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):

        view_id = request.GET.get('view_id')
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 100)
        try:
            start = int(start)
            limit = int(limit)
        except Exception:
            start = 0
            limit = 100
        if not view_id:
            error_msg = 'view_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_same_org_permission(request.user, project.workspace):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        show_kb = False
        try:
            settings_obj = json.loads(project.settings) if project.settings else {}
            show_kb = bool(settings_obj.get('portal_show_knowledge_base', False))
        except Exception:
            show_kb = False
        if not show_kb:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        try:
            seadb_api = SeaDBAPI(username)
            view = KnowledgeBaseViews.objects.get_view(project_uuid, view_id)
            records, columns = list_knowledge_base_records(seadb_api, project_uuid, view, start, limit, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'records': records, 'columns': columns})

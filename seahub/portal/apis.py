# -*- coding: utf-8 -*-
import datetime
import logging
import json

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from seahub.api2.permissions import PortalAccessPermission
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.project.utils import replace_file_url_in_content, get_current_table_metadata, \
    check_project_admin_permission
from seahub.utils.storage import upload_files_to_s3
from seahub.utils.hasher import AESPasswordHasher
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.project.constants import PORTAL_TICKET_DISPLAY_ALL_COLUMNS
from seahub.seadb_models.models import TicketsTable, TagTable
from seahub.seadb_models.utils import list_my_tickets, list_knowledge_base_records
from seahub.tickets.ticket_utils import check_ticket_creation_interval, TABLE_TICKETS
from seahub.knowledge_base.models import KnowledgeBaseViews
from seahub.utils.decorators import require_org_context


logger = logging.getLogger(__name__)


def get_portal_access_username(request):
    if request.user.is_authenticated:
        return request.user.username

    session_key = request.session.session_key
    if not session_key:
        request.session.save()
        session_key = request.session.session_key
    return f'portal-anon-{session_key}'


class PortalTicketsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

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

        tag_ids = request.POST.get('tags', "[]")
        try:
            tag_ids = json.loads(tag_ids)
        except:
            tag_ids = []
        if not isinstance(tag_ids, list):
            tag_ids = []

        due_date = request.POST.get('due_date', '')

        username = get_portal_access_username(request)
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
                TicketsTable.tags.name: tag_ids,
                TicketsTable.creator.name: username,
                TicketsTable.comment_count.name: 0,
                TicketsTable.created_time.name: now_datetime,
                TicketsTable.modified_time.name: now_datetime,
                TicketsTable.deleted.name: False,
                TicketsTable.due_date.name: due_date,
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
    permission_classes = (PortalAccessPermission,)
    throttle_classes = (UserRateThrottle,)

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

        username = get_portal_access_username(request)
        seadb_api = SeaDBAPI(username)

        basic_filters = view_config.get('basic_filters', [])
        basic_filters.append({
            'column_name': 'creator',
            'filter_predicate': 'is',
            'filter_term': username,
        })
        view_config['basic_filters'] = basic_filters

        try:
            tickets, columns = list_my_tickets(seadb_api, project_uuid, username, ticket_state, start, limit, PORTAL_TICKET_DISPLAY_ALL_COLUMNS, view_config)
        except SQLGeneratorOptionInvalidError as e:
            logger.error(e)
            error_msg = _('There are errors with the filters. Please correct them.')
            return Response({
                'tickets': [],
                'columns': getattr(e, 'columns', []),
                'error_msg': error_msg,
            })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'tickets': tickets,
            'columns': columns,
        })


class PortalTagsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalAccessPermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)

        try:
            start = int(start)
            limit = int(limit)
        except:
            start = 0
            limit = 1000

        if start < 0:
            error_msg = 'start invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if limit < 0:
            error_msg = 'limit invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = get_portal_access_username(request)
        try:
            seadb_api = SeaDBAPI(username)
            table_name = TagTable.gen_table_name()
            sql = f"SELECT * FROM `{table_name}` LIMIT {start}, {limit}"
            res = seadb_api.query_rows(project_uuid, sql, convert_keys=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'columns': res.get('metadata'), 'tags': res.get('results')})


class PortalKnowledgeBaseViewsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalAccessPermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        try:
            project = request.project
            project_settings = json.loads(project.settings) if project.settings else {}
            portal_settings = project_settings.get('portal', {})
            show_kb = bool(portal_settings.get('portal_show_knowledge_base', False))
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
    permission_classes = (PortalAccessPermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        view_id = request.GET.get('view_id')
        start = request.GET.get('start', 0)
        limit = request.GET.get('limit', 1000)
        try:
            start = int(start)
            limit = int(limit)
        except Exception:
            start = 0
            limit = 1000
        if not view_id:
            error_msg = 'view_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            project = request.project
            project_settings = json.loads(project.settings) if project.settings else {}
            portal_settings = project_settings.get('portal', {})
            show_kb = bool(portal_settings.get('portal_show_knowledge_base', False))
        except Exception:
            show_kb = False
        if not show_kb:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username if request.user.is_authenticated else ''
        try:
            seadb_api = SeaDBAPI(username)
            view = KnowledgeBaseViews.objects.get_view(project_uuid, view_id)
            records, columns = list_knowledge_base_records(seadb_api, project_uuid, view, start, limit, username)
        except SQLGeneratorOptionInvalidError as e:
            logger.error(e)
            error_msg = _('There are errors with the filters. Please correct them.')
            return Response({'records': [], 'columns': getattr(e, 'columns', []), 'error_msg': error_msg})
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'records': records, 'columns': columns})

class PortalTicketMetadataView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalAccessPermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        username = get_portal_access_username(request)
        seadb_api = SeaDBAPI(username)
        try:
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            ticket_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            ticket_column_name_to_return_name = {
                TicketsTable.substate.name: 'substates',
                TicketsTable.type.name: 'types',
                TicketsTable.state.name: 'states'
            }
            select_option_metadata = {}
            for column in ticket_meta.get('columns'):
                column_name = column.get('name')
                return_name = ticket_column_name_to_return_name.get(column_name)
                if return_name:
                    column_data = column.get('data', {}) or {}
                    select_option_metadata[return_name] = column_data
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(select_option_metadata)


class PortalSettingsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            project_settings = json.loads(project.settings) if project.settings else {}
        except Exception:
            project_settings = {}
        portal_settings = project_settings.get('portal', {})
        allow_anonymous = bool(portal_settings.get('allow_anonymous', False))
        enable_password_protection = bool(portal_settings.get('enable_password_protection', False))
        has_password = bool(portal_settings.get('password'))
        portal_show_knowledge_base = bool(portal_settings.get('portal_show_knowledge_base', False))

        return Response({
            'allow_anonymous': allow_anonymous,
            'enable_password_protection': enable_password_protection,
            'has_password': has_password,
            'portal_show_knowledge_base': portal_show_knowledge_base,
        })

    @require_org_context
    def post(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_project_admin_permission(request.user.username, project.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        allow_anonymous = request.data.get('allow_anonymous', 0)
        enable_password_protection = request.data.get('enable_password_protection', 0)
        password = request.data.get('password', '')
        portal_show_knowledge_base = request.data.get('portal_show_knowledge_base', None)

        try:
            allow_anonymous = int(allow_anonymous)
            enable_password_protection = int(enable_password_protection)
            if portal_show_knowledge_base is not None:
                portal_show_knowledge_base = int(portal_show_knowledge_base)
        except Exception:
            error_msg = 'Invalid params.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if enable_password_protection:
            if password and len(password) < 8:
                error_msg = 'Password too short.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            project_settings = json.loads(project.settings) if project.settings else {}
        except Exception:
            project_settings = {}

        portal_settings = project_settings.get('portal', {})
        portal_settings['allow_anonymous'] = bool(allow_anonymous)
        portal_settings['enable_password_protection'] = bool(enable_password_protection)
        if portal_show_knowledge_base is not None:
            portal_settings['portal_show_knowledge_base'] = bool(portal_show_knowledge_base)

        if enable_password_protection:
            if password:
                cryptor = AESPasswordHasher()
                portal_settings['password'] = cryptor.encode(password)
        else:
            portal_settings.pop('password', None)

        project_settings['portal'] = portal_settings
        project.settings = json.dumps(project_settings)
        project.save(update_fields=['settings'])

        return Response({'success': True})

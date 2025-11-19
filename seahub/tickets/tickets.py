# -*- coding: utf-8 -*-
import datetime
import logging
import json
from dateutil.relativedelta import relativedelta

from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context
from seahub.project.models import Projects
from seahub.tickets.models import TicketViews
from seahub.project.utils import check_project_permission, \
    replace_file_url_in_content, upload_files_to_s3, check_ticket_permission, \
    check_comment_permission, get_current_table_metadata
from seahub.seadb_models.utils import list_tickets_view_records, list_tickets_by_search
from seahub.seadb_models.models import TicketRepliesTable, TicketsTable
from seahub.project.seadb_api import SeaDBAPI
from seahub.tickets.ticket_utils import get_ticket, get_ticket_replies, \
    check_ticket_reply_creation_interval, get_ticket_reply_by_pk, check_ticket_creation_interval,\
    convert_ticket_select_column_name_to_option_id, TABLE_TICKETS, get_column_from_columns_by_name, get_tickets_by_ids

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


class TicketsAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        view_id = request.GET.get('view_id', '')
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

        # main
        try:
            view = TicketViews.objects.get_view(project_uuid=project_uuid, view_id=view_id)
            seadb_api = SeaDBAPI(username)
            tickets, columns = list_tickets_view_records(
                seadb_api, project_uuid, view, username, start, limit)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'tickets': tickets,
            'columns': columns,
        })

    def post(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
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

        assignees = request.POST.get('assignees')
        if assignees is not None:
            try:
                assignees = json.loads(assignees)
            except:
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(assignees, list):
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            assignees = list(set(assignees))

        username = request.user.username
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        if assignees:
            for assignee in assignees:
                if not check_project_permission(assignee, workspace.owner):
                    error_msg = 'assignees invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        seadb_api = SeaDBAPI(username)
        base_metadata = seadb_api.get_base_metadata(project_uuid)
        table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)


        type_id = request.POST.get('type')
        if type_id:
            try:
                column = get_column_from_columns_by_name(table_meta.get('columns'), 'type')
                column_data = column.get('data') or {}
                options = column_data.get('options', []) or []
                type_option = next((option for option in options if option['id'] == type_id), None)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not type_option:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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

        tag_option_ids = request.POST.get('tags')
        if tag_option_ids is not None:
            try:
                tag_option_ids = json.loads(tag_option_ids)
            except:
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(tag_option_ids, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                tag_column = get_column_from_columns_by_name(table_meta.get('columns'), 'tags')
                tag_column_data = tag_column.get('data') or {}
                tag_options = tag_column_data.get('options', []) or []
                tag_option_id_to_option_name = {opt.get('id'): opt.get('name') for opt in tag_options}
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            tag_option_ids = list(set(tag_option_ids))
            tag_names = []
            for tag_option_id in tag_option_ids:
                tag_option_name = tag_option_id_to_option_name.get(tag_option_id)
                if not tag_option_name:
                    error_msg = 'tags invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                tag_names.append(tag_option_name)

        if not check_ticket_creation_interval(seadb_api, project_uuid, username):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            ticket_state = 'open'
            substate_name = 'New'
            row = {
                TicketsTable.title.name: title,
                TicketsTable.content.name: content,
                TicketsTable.state.name: ticket_state,
                TicketsTable.type.name: type_option.get('name') if type_id and type_option else None,
                TicketsTable.substate.name: substate_name,
                TicketsTable.priority.name: priority,
                TicketsTable.assignees.name: assignees or [],
                TicketsTable.participants.name: [username],
                TicketsTable.tags.name: tag_names or [],
                TicketsTable.creator.name: username,
                TicketsTable.reply_count.name: 0,
                TicketsTable.created_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketsTable.updated_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketsTable.deleted.name: False,
            }
            res = seadb_api.insert_rows(project_uuid, 'tickets', [row])
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

        return Response({'ticket': row},status=status.HTTP_201_CREATED)

    def put(self, request, project_uuid):
        tickets_data = request.data.get('tickets_data')
        if not tickets_data:
            error_msg = 'tickets_data is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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

        seadb_api = SeaDBAPI(username)
        base_metadata = seadb_api.get_base_metadata(project_uuid)
        table_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)

        ticket_id_to_row = {}
        for ticket_data in tickets_data:
            row = ticket_data.get('row', {})
            if not row:
                continue
            row_id = ticket_data.get('row_id', '')
            if not row_id:
                error_msg = 'row_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            ticket_id_to_row[row_id] = row

        try:
            ticket_ids = ticket_id_to_row.keys()
            ticket_ids_str = ','.join(ticket_ids)
            sql = f'SELECT `_pk` FROM `tickets` WHERE `_pk` IN ({ticket_ids_str})'
            query_result = seadb_api.query_rows(project_uuid, sql)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        results = query_result.get('results')
        if not results:
            # file or folder has been deleted
            return Response({'success': True})

        update_rows = []
        for row in results:
            updated_row = {}
            row_data = ticket_id_to_row.get(str(row.get('_pk')))
            if not row_data:
                continue
            if 'state' in row_data:
                column = get_column_from_columns_by_name(table_meta.get('columns'), 'status')
                column_data = column.get('data') or {}
                options = column_data.get('options', []) or []
                state_option = next((option for option in options if option['id'] == row_data.get('state')), None)
                updated_row[TicketsTable.state.name] = state_option.get('name') if state_option else None
            if 'substate' in row_data:
                column = get_column_from_columns_by_name(table_meta.get('columns'), 'substate')
                column_data = column.get('data') or {}
                options = column_data.get('options', []) or []
                substate_option = None
                for opt in options:
                    if opt.get('id') == row_data.get('substate'):
                        substate_option = opt

                updated_row[TicketsTable.substate.name] = substate_option.get('name') if substate_option else None
            if 'tags' in row_data:
                tag_column = get_column_from_columns_by_name(table_meta.get('columns'), 'tags')
                column_data = tag_column.get('data') or {}
                tag_options = column_data.get('options', []) or []
                tag_id_to_name = {opt.get('id'): opt.get('name') for opt in tag_options}
                tag_names = []
                tags = row_data.get('tags') or []
                for tag_id in tags:
                    tag_names.append(tag_id_to_name.get(tag_id))
                updated_row[TicketsTable.tags.name] = tag_names
            if 'type' in row_data:
                tag_column = get_column_from_columns_by_name(table_meta.get('columns'), 'type')
                column_data = tag_column.get('data') or {}
                type_options = column_data.get('options', []) or []
                type_option = next((option for option in type_options if option['id'] == row_data.get('type')), None)
                updated_row[TicketsTable.type.name] = type_option.get('name') if type_option else None
            if 'content' in row_data:
                content_dict = row_data.get('content')
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
                updated_row[TicketsTable.content.name] = content
            for key, value in row_data.items():
                if key in ('substate', 'tags', 'type', '_pk', 'updated_at', 'content', 'state'):
                    continue
                updated_row[key] = value

            updated_row[TicketsTable.updated_time.name] = datetime.datetime.now(datetime.UTC).isoformat()
            update_rows.append(
                {
                    'pk': row.get('_pk'),
                    'row': updated_row,
                }
            )
        if update_rows:
            try:
                seadb_api.update_rows(project_uuid, 'tickets', update_rows)
            except Exception as e:
                logger.exception(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def delete(self, request, project_uuid):
        ticket_ids = request.data.get('ticket_ids')
        if not ticket_ids:
            error_msg = 'ticket_ids is required.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            seadb_api = SeaDBAPI(username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        tickets = get_tickets_by_ids(seadb_api, project_uuid, ticket_ids)
        exist_ticket_ids = [ticket.get('_pk') for ticket in tickets]
        fail_ticket_ids = []
        for ticket_id in ticket_ids:
            if int(ticket_id) not in exist_ticket_ids:
                fail_ticket_ids.append(ticket_id)

        need_delete_ticket_ids = list(set(ticket_ids) - set(fail_ticket_ids))
        update_rows = []
        for ticket_id in need_delete_ticket_ids:
            update_row = {
                'pk': int(ticket_id),
                'row': {
                    'deleted': True,
                    'deleted_at': datetime.datetime.now(datetime.UTC).isoformat(),
                }
            }
            update_rows.append(update_row)
        try:
            seadb_api.update_rows(project_uuid, 'tickets', update_rows)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'success': need_delete_ticket_ids,
            'failed': fail_ticket_ids
        })


class TicketAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            seadb_api = SeaDBAPI(username)
            ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            convert_ticket_select_column_name_to_option_id(metadata, ticket)
            start = 0
            end = 25
            ticket_replies = get_ticket_replies(seadb_api, project_uuid, ticket_id, start, end)

            for ticket_reply in ticket_replies:
                result = {
                    'number': ticket_reply.get('_pk'),
                    'content': ticket_reply.get('content'),
                    'created_time': ticket_reply.get('created_time'),
                    'updated_time': ticket_reply.get('updated_time'),
                    'creator': ticket_reply.get('creator'),
                }
                if not ticket.get('replies'):
                    ticket['replies'] = []
                ticket['replies'].append(result)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'ticket': ticket})

    def put(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. creator
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        title = request.data.get('title')
        username = request.user.username

        content = None
        file_urls = None
        content_dict = request.data.get('content')
        if content_dict:
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

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        seadb_api = SeaDBAPI(username)
        ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_ticket_permission(username, workspace.owner, ticket):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        ticket_state_id = request.data.get('state')

        if ticket_state_id is not None:
            state_column = get_column_from_columns_by_name(metadata, 'state')
            state_column_data = state_column.get('data') or {}
            state_options = state_column_data.get('options', []) or []
            state_option = next((option for option in state_options if option['id'] == ticket_state_id), None)
            if not state_option:
                error_msg = 'state invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_update_type = 'type' in request.data
        type_id = request.data.get('type') or None

        if is_update_type and type_id is not None:
            try:
                type_column = get_column_from_columns_by_name(metadata, 'type')
                type_column_data = type_column.get('data') or {}
                type_options = type_column_data.get('options', []) or []
                type_option = next((option for option in type_options if option['id'] == type_id), None)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not type_option:
                error_msg = 'type invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_update_priority = 'priority' in request.data
        priority = request.data.get('priority')
        if is_update_priority:
            if not priority:
                priority = 0
            try:
                priority = int(priority)
            except:
                error_msg = 'priority invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if priority < 0:
                priority = 0
            elif priority > 5:
                priority = 5

        is_update_assignees = 'assignees' in request.data
        assignees = request.data.get('assignees')
        if is_update_assignees and assignees is not None:
            assignees = assignees if assignees else '[]'
            try:
                assignees = json.loads(assignees)
            except:
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not isinstance(assignees, list):
                error_msg = 'assignees invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            assignees = list(set(assignees))

        is_update_tags = 'tags' in request.data
        tags = request.data.get('tags')
        if is_update_tags and tags is not None:
            tags = tags if tags else '[]'
            try:
                tags = json.loads(tags)
            except:
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(tags, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            tag_column = get_column_from_columns_by_name(metadata, 'tags')
            tag_column_data = tag_column.get('data') or {}
            tag_options = tag_column_data.get('options', []) or []
            tag_ids = [tag.get('id') for tag in tag_options]
            for tag in tags:
                if tag not in tag_ids:
                    error_msg = 'tags invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            tags = list(set(tags))

        is_update_substate = 'substate' in request.data
        substate_option_id = request.data.get('substate') or None
        substate_name = None
        if is_update_substate and substate_option_id is not None:
            try:
                substate_column = get_column_from_columns_by_name(metadata, 'substate')
                substate_column_data = substate_column.get('data') or {}
                substate_options = substate_column_data.get('options', []) or []
                substate_option = next((option for option in substate_options if option['id'] == substate_option_id), None)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not substate_option:
                error_msg = 'substate invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            # determine state id to check cascade: prefer target state if provided
            if ticket_state_id is not None:
                state_option_id = ticket_state_id
            else:
                current_state_name = ticket.get('state')
                state_column = get_column_from_columns_by_name(metadata, 'state')
                state_column_data = state_column.get('data') or {}
                state_options = state_column_data.get('options', []) or []
                current_state_option = next((option for option in state_options if option['name'] == current_state_name), None)
                state_option_id = current_state_option.get('id') if current_state_option else ''

            cascade_settings = (substate_column_data or {}).get('cascade_settings') or {}
            allowed_substate_ids = set(cascade_settings.get(state_option_id, []))
            if substate_option.get('id') not in allowed_substate_ids:
                error_msg = 'substate not allowed for current state.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            substate_name = substate_option.get('name')

        if assignees:
            for assignee in assignees:
                if not check_project_permission(assignee, workspace.owner):
                    error_msg = 'assignees invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            update_row = {}
            if title:
                update_row['title'] = title
            if content:
                update_row['content'] = content
            if ticket_state or ticket_state == '':
                update_row['state'] = state_option.get('name')
            if is_update_type:
                update_row['type'] = type_option.get('name') if type_id and type_option else None
            if is_update_substate:
                update_row['substate'] = substate_name
            if is_update_tags:
                tag_names = []
                for tag in tag_options:
                    if tag.get('id') in tags:
                        tag_names.append(tag.get('name'))
                update_row['tags'] = tag_names
            if is_update_priority:
                update_row['priority'] = priority
            if is_update_assignees:
                update_row['assignees'] = assignees
            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
            update_row['participants'] = participants
            update_row['updated_time'] = datetime.datetime.now(datetime.UTC).isoformat()
            update_rows = [
                {
                    'pk': ticket.get('_pk'),
                    'row': update_row
                }
            ]
            seadb_api.update_rows(project_uuid, 'tickets', update_rows)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    def delete(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

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
            seadb_api = SeaDBAPI(username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        update_row = {
            'pk': ticket.get('_pk'),
            'row': {
                'deleted': True,
                'updated_time': datetime.datetime.now(datetime.UTC).isoformat(),
            }
        }
        try:
            seadb_api.update_rows(project_uuid, 'tickets', [update_row])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class TicketsSearchAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        query = request.GET.get('query', '')
        limit = 100

        if query:
            limit = 50

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        # permission check, same as AI
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # project_uuid, username, search_text, start, end
        try:
            seadb_api = SeaDBAPI(username)
            tickets = list_tickets_by_search(seadb_api, project_uuid, query, 0, limit)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        tickets = [{'_pk': ticket.get('_pk'), 'title': ticket.get('title')} for ticket in tickets]
        return Response({'tickets': tickets})


class TicketRepliesAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        try:
            current_page = int(request.GET.get('page', '2'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 2
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

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
            seadb_api = SeaDBAPI(username)
            ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            replies_data = get_ticket_replies(seadb_api, project_uuid, ticket.get('_pk'), start, end)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'ticket_replies': replies_data,
        })

    def post(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. owner
        2. group member
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
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

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace
        username = request.user.username

        try:
            seadb_api = SeaDBAPI(username)
            ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # permission check
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not check_ticket_reply_creation_interval(seadb_api, project_uuid, username, ticket.get('_pk')):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            row = {
                TicketRepliesTable.ticket_id.name: ticket.get('_pk'),
                TicketRepliesTable.creator.name: username,
                TicketRepliesTable.content.name: content,
                TicketRepliesTable.created_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketRepliesTable.updated_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketRepliesTable.deleted.name: False,
            }
            res = seadb_api.insert_rows(project_uuid, 'ticket_replies', [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            pk = pks[0]
            row.update({'number': pk})
            ticket_replies_count = seadb_api.query_rows(project_uuid, f"SELECT COUNT(*) as count FROM `ticket_replies` WHERE `ticket_id` = {ticket.get('_pk')} AND `deleted` = False").get('results')[0].get('count')
            update_ticket = {
                'pk': ticket.get('_pk'),
                'row': {
                    'reply_count': ticket_replies_count,
                    'updated_time': datetime.datetime.now(datetime.UTC).isoformat(),
                    },
                }
            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
            update_ticket['row']['participants'] = participants
            seadb_api.update_rows(project_uuid, 'tickets', [update_ticket])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'ticket_reply': row}, status=status.HTTP_201_CREATED)


class TicketReplyAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, project_uuid, ticket_id, reply_id):
        """
        Permission:
        1. creator
        2. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        content_dict = request.data.get('content')
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

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        username = request.user.username

        try:
            seadb_api = SeaDBAPI(username)
            ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            ticket_reply_data = get_ticket_reply_by_pk(seadb_api, project_uuid, ticket.get('_pk'), reply_id)
            if not ticket_reply_data:
                error_msg = 'Reply not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            # permission check
            if not check_comment_permission(username, workspace.owner, ticket_reply_data):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        updated_at = ticket_reply_data.get('updated_time')
        if updated_at:
            updated_at = datetime.datetime.fromisoformat(updated_at)
        if updated_at and updated_at > timezone.now() - relativedelta(seconds=10):
            error_msg = 'Cannot be updated again within 10 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            ticket_reply_update = {
                'pk': ticket_reply_data.get('_pk'),
                'row': {
                    'content': content,
                    'updated_time': datetime.datetime.now(datetime.UTC).isoformat(),
                },
            }
            seadb_api.update_rows(project_uuid, 'ticket_replies', [ticket_reply_update])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            update_row = {
                'updated_time': ticket_reply_data.get('updated_time'),
            }
            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
                update_row['participants'] = participants
            ticket_update = {
                'pk': ticket.get('_pk'),
                'row': update_row,
            }
            seadb_api.update_rows(project_uuid, 'tickets', [ticket_update])
        except Exception as e:
            logger.error(e)

        return Response({'ticket_reply': ticket_reply_data})

    def delete(self, request, project_uuid, ticket_id, reply_id):
        """
        Permission:
        1. creator
        2. group admin
        """
        if not is_org_context(request):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace
        username = request.user.username

        try:
            seadb_api = SeaDBAPI(username)
            ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            ticket_reply_data = get_ticket_reply_by_pk(seadb_api, project_uuid, ticket_id, reply_id)
            if not ticket_reply_data:
                error_msg = 'Reply not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # permission check
        if not check_comment_permission(username, workspace.owner, ticket_reply_data):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
                update_ticket = {
                    'pk': ticket.get('_pk'),
                    'row': {
                        'participants': participants,
                    },
                }
                seadb_api.update_rows(project_uuid, 'tickets', [update_ticket])
            update_ticket_reply = {
                'pk': ticket_reply_data.get('_pk'),
                'row': {
                    'deleted': True,
                    'delete_time': datetime.datetime.now(datetime.UTC).isoformat(),
                },
            }
            seadb_api.update_rows(project_uuid, 'ticket_replies', [update_ticket_reply])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

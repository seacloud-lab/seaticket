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
from seahub.seadb_models.models import TicketCommentsTable, TicketsTable
from seahub.project.seadb_api import SeaDBAPI
from seahub.tickets.ticket_utils import get_ticket, get_ticket_comments, \
    check_ticket_comment_creation_interval, get_ticket_comment_by_pk, check_ticket_creation_interval, \
    convert_ticket_select_column_name_to_option_id, TABLE_TICKETS, get_tickets_by_ids, get_my_tickets

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

        assignees = request.POST.get('assignees', "[]")
        try:
            assignees = json.loads(assignees)
        except:
            error_msg = 'assignees invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not isinstance(assignees, list):
            error_msg = 'assignees invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        assignees = list(set(assignees))

        substate = request.POST.get('substate', '')

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

        type_name = request.POST.get('type')

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
        tag_names = json.loads(tag_names)

        seadb_api = SeaDBAPI(username)
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

            row = {
                TicketsTable.title.name: title,
                TicketsTable.content.name: content,
                TicketsTable.state.name: ticket_state,
                TicketsTable.type.name: type_name,
                TicketsTable.substate.name: substate,
                TicketsTable.priority.name: priority,
                TicketsTable.assignees.name: assignees,
                TicketsTable.participants.name: [username],
                TicketsTable.tags.name: tag_names,
                TicketsTable.creator.name: username,
                TicketsTable.comment_count.name: 0,
                TicketsTable.created_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketsTable.modified_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
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
                ticket_state_name = row_data.get('state').lower()
                updated_row[TicketsTable.state.name] = ticket_state_name
                if ticket_state_name == 'closed':
                    updated_row[TicketsTable.closed_time.name] = datetime.datetime.now(datetime.UTC).isoformat()
                elif ticket_state_name == 'open':
                    updated_row[TicketsTable.closed_time.name] = ''
            if 'substate' in row_data:
                updated_row[TicketsTable.substate.name] = row_data.get('substate')
            if 'tags' in row_data:
                updated_row[TicketsTable.tags.name] = row_data.get('tags')
            if 'type' in row_data:
                updated_row[TicketsTable.type.name] = row_data.get('type')
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
                if key in ('substate', 'tags', 'type', '_pk', 'modified_time', 'content', 'state'):
                    continue
                updated_row[key] = value

            updated_row[TicketsTable.modified_time.name] = datetime.datetime.now(datetime.UTC).isoformat()
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
            ticket_comments = get_ticket_comments(seadb_api, project_uuid, ticket_id, start, end)

            for ticket_comment in ticket_comments:
                result = {
                    'number': ticket_comment.get('_pk'),
                    'content': ticket_comment.get('content'),
                    'created_time': ticket_comment.get('created_time'),
                    'modified_time': ticket_comment.get('modified_time'),
                    'creator': ticket_comment.get('creator'),
                }
                if not ticket.get('comments'):
                    ticket['comments'] = []
                ticket['comments'].append(result)
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

        ticket_state_name = request.data.get('state')

        is_update_type = 'type' in request.data
        type_name = request.data.get('type') or None

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
        is_update_substate = 'substate' in request.data
        substate_option_name = request.data.get('substate') or None

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
                update_row[TicketsTable.title.name] = title
            if content:
                update_row[TicketsTable.content.name] = content

            if ticket_state_name or ticket_state_name == '':
                ticket_state_name = ticket_state_name.lower()
                update_row[TicketsTable.state.name] = ticket_state_name
                if ticket_state_name == 'closed':
                    update_row[TicketsTable.closed_time.name] = datetime.datetime.now(datetime.UTC).isoformat()
                elif ticket_state_name == 'open':
                    update_row[TicketsTable.closed_time.name] = ''
            if is_update_type:
                update_row[TicketsTable.type.name] = type_name
            if is_update_substate:
                update_row[TicketsTable.substate.name] = substate_option_name
            if is_update_tags:
                update_row[TicketsTable.tags.name] = tags
            if is_update_priority:
                update_row[TicketsTable.priority.name] = priority
            if is_update_assignees:
                update_row[TicketsTable.assignees.name] = assignees
            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
            update_row[TicketsTable.participants.name] = participants
            update_row[TicketsTable.modified_time.name] = datetime.datetime.now(datetime.UTC).isoformat()
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
                'modified_time': datetime.datetime.now(datetime.UTC).isoformat(),
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


class TicketCommentsAPIView(APIView):
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
            comments_data = get_ticket_comments(seadb_api, project_uuid, ticket.get('_pk'), start, end)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'ticket_comments': comments_data,
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

        if not check_ticket_comment_creation_interval(seadb_api, project_uuid, username, ticket.get('_pk')):
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
                TicketCommentsTable.ticket_id.name: ticket.get('_pk'),
                TicketCommentsTable.creator.name: username,
                TicketCommentsTable.content.name: content,
                TicketCommentsTable.created_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketCommentsTable.modified_time.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketCommentsTable.deleted.name: False,
            }
            res = seadb_api.insert_rows(project_uuid, 'ticket_comments', [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            pk = pks[0]
            row.update({'number': pk})
            ticket_comments_count = seadb_api.query_rows(project_uuid, f"SELECT COUNT(*) as count FROM `ticket_comments` WHERE `ticket_id` = {ticket.get('_pk')} AND `deleted` = False").get('results')[0].get('count')
            update_ticket = {
                'pk': ticket.get('_pk'),
                'row': {
                    'comment_count': ticket_comments_count,
                    'modified_time': datetime.datetime.now(datetime.UTC).isoformat(),
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

        return Response({'ticket_comment': row}, status=status.HTTP_201_CREATED)


class TicketCommentAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, project_uuid, ticket_id, comment_id):
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

            ticket_comment_data = get_ticket_comment_by_pk(seadb_api, project_uuid, ticket.get('_pk'), comment_id)
            if not ticket_comment_data:
                error_msg = 'Comment not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            # permission check
            if not check_comment_permission(username, workspace.owner, ticket_comment_data):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        modified_time = ticket_comment_data.get('modified_time')
        if modified_time:
            modified_time = datetime.datetime.fromisoformat(modified_time)
        if modified_time and modified_time > timezone.now() - relativedelta(seconds=10):
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
            ticket_comment_update = {
                'pk': ticket_comment_data.get('_pk'),
                'row': {
                    'content': content,
                    'modified_time': datetime.datetime.now(datetime.UTC).isoformat(),
                },
            }
            seadb_api.update_rows(project_uuid, 'ticket_comments', [ticket_comment_update])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            update_row = {
                'modified_time': ticket_comment_data.get('modified_time'),
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

        return Response({'ticket_comment': ticket_comment_data})

    def delete(self, request, project_uuid, ticket_id, comment_id):
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

            ticket_comment_data = get_ticket_comment_by_pk(seadb_api, project_uuid, ticket_id, comment_id)
            if not ticket_comment_data:
                error_msg = 'Comment not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # permission check
        if not check_comment_permission(username, workspace.owner, ticket_comment_data):
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
            update_ticket_comment = {
                'pk': ticket_comment_data.get('_pk'),
                'row': {
                    'deleted': True,
                    'delete_time': datetime.datetime.now(datetime.UTC).isoformat(),
                },
            }
            seadb_api.update_rows(project_uuid, 'ticket_comments', [update_ticket_comment])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

class MyTicketAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

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
        try:
            tickets, columns = get_my_tickets(seadb_api, project_uuid, username, start, limit)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({
            'tickets': tickets,
            'columns': columns,
        })


class TicketMetadataAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
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
        try:
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            ticket_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_TICKETS)
            ticket_column_name_to_return_name = {
                TicketsTable.substate.name: 'substates',
                TicketsTable.tags.name: 'tags',
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

# -*- coding: utf-8 -*-
import datetime
import uuid
import logging
import json
from dateutil.relativedelta import relativedelta

from django.utils import timezone
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
from seahub.utils import is_org_context
from seahub.project.models import Projects, TicketViews
from seahub.project.utils import check_project_permission, \
    replace_file_url_in_content, upload_files_to_s3, check_ticket_permission, \
    check_comment_permission
from seahub.seadb_models.utils import list_tickets_view_records, list_tickets_by_search
from seahub.seadb_models.models import TicketRepliesTable, TicketsTable
from seahub.project.seadb_api import SeaDBAPI
from seahub.tickets.ticket_utils import get_status_option_by_name, get_tag_option_by_id, get_ticket, get_ticket_replies, \
    check_ticket_reply_creation_interval, get_ticket_reply_by_pk, get_type_option_by_id, get_tags_column, check_ticket_creation_interval,\
    get_type_option_by_name, get_tag_ids_by_names, get_status_option_by_id

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
                seadb_api, project_uuid, view, start, limit)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        for ticket in tickets:
            if ticket.get('status'):
                status_option = get_status_option_by_name(seadb_api, project_uuid, ticket.get('status'))
                ticket['status'] = status_option.get('id')
            if ticket.get('type'):
                type_option = get_type_option_by_name(seadb_api, project_uuid, ticket.get('type'))
                ticket['type'] = type_option.get('id')
            if ticket.get('tags'):
                tag_ids = get_tag_ids_by_names(seadb_api, project_uuid, ticket.get('tags'))
                ticket['tags'] = tag_ids
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
        description_dict = request.POST.get('description')
        if not description_dict:
            error_msg = 'description invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            description_dict = json.loads(description_dict)
        except:
            error_msg = 'description invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not isinstance(description_dict, dict):
            error_msg = 'description invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        description = description_dict.get('text')
        if not description:
            error_msg = 'description invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        file_urls = description_dict.get('images')
        if file_urls and not isinstance(file_urls, list):
            error_msg = 'description invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        link_urls = description_dict.get('links')
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

        try:
            username = request.user.username
            seadb_api = SeaDBAPI(username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        type_id = request.POST.get('type')
        if type_id:
            try:
                project_type = get_type_option_by_id(seadb_api, project_uuid, type_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not project_type:
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

        tags = request.POST.get('tags')
        if tags is not None:
            try:
                tags = json.loads(tags)
            except:
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(tags, list):
                error_msg = 'tags invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                tag_options, _ = get_tags_column(seadb_api, project_uuid)
                valid_tag_ids = set([opt.get('id') for opt in (tag_options or [])])
                for tag in tags:
                    if tag not in valid_tag_ids:
                        error_msg = 'tags invalid.'
                        return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            tags = list(set(tags))
            tag_names = []
            for tag in tags:
                tag_option = get_tag_option_by_id(seadb_api, project_uuid, tag)
                tag_names.append(tag_option.get('name'))
            tags = tag_names

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

        if not check_ticket_creation_interval(seadb_api, project_uuid, username):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                description = replace_file_url_in_content(description, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            ticket_status = 'open'
            client_token = uuid.uuid4().hex
            row = {
                TicketsTable.title.name: title,
                TicketsTable.description.name: description,
                TicketsTable.status.name: ticket_status,
                TicketsTable.type.name: project_type.get('name') if type_id and project_type else None,
                TicketsTable.priority.name: priority,
                TicketsTable.assignees.name: assignees or [],
                TicketsTable.participants.name: [username],
                TicketsTable.tags.name: tags or [],
                TicketsTable.creator.name: username,
                TicketsTable.reply_count.name: 0,
                TicketsTable.created_at.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketsTable.updated_at.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketsTable.reply_updated_at.name: None,
                TicketsTable.deleted.name: False,
                TicketsTable.delete_at.name: None,
                TicketsTable.client_token.name: client_token,
            }
            seadb_api.insert_rows(project_uuid, 'tickets', [row])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            sql = f"SELECT _pk FROM `tickets` WHERE `client_token` = '{client_token}' ORDER BY _pk DESC LIMIT 1"
            res = seadb_api.query_rows(project_uuid, sql).get('results')
            ticket_pk = res and res[0].get('_pk')
            row.update({'_pk': ticket_pk})
        except Exception as e:
            logger.error(e)

        return Response({'ticket': row},status=status.HTTP_201_CREATED)


class TicketAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, ticket_number):
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
            ticket = get_ticket(seadb_api, project_uuid, ticket_number)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            if ticket.get('status'):
                status_option = get_status_option_by_name(seadb_api, project_uuid, ticket.get('status'))
                ticket['status'] = status_option.get('id')
            if ticket.get('type'):
                type_option = get_type_option_by_name(seadb_api, project_uuid, ticket.get('type'))
                ticket['type'] = type_option.get('id')
            if ticket.get('tags'):
                tag_ids = get_tag_ids_by_names(seadb_api, project_uuid, ticket.get('tags'))
                ticket['tags'] = tag_ids
            start = 0
            end = 25
            ticket_replies = get_ticket_replies(seadb_api, project_uuid, ticket_number, start, end)

            for ticket_reply in ticket_replies:
                result = {
                    'number': ticket_reply.get('_pk'),
                    'content': ticket_reply.get('content'),
                    'created_at': ticket_reply.get('created_at'),
                    'updated_at': ticket_reply.get('updated_at'),
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

    def put(self, request, project_uuid, ticket_number):
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

        description = None
        file_urls = None
        description_dict = request.data.get('description')
        if description_dict:
            try:
                description_dict = json.loads(description_dict)
            except:
                error_msg = 'description invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if not isinstance(description_dict, dict):
                error_msg = 'description invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            description = description_dict.get('text')
            if not description:
                error_msg = 'description invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            file_urls = description_dict.get('images')
            if file_urls and not isinstance(file_urls, list):
                error_msg = 'description invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            link_urls = description_dict.get('links')
            if link_urls and isinstance(link_urls, list):
                file_urls = (file_urls or []) + link_urls
        try:
            seadb_api = SeaDBAPI(username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        ticket_status = request.data.get('status')
        if ticket_status is not None:
            status_option = get_status_option_by_id(seadb_api, project_uuid, ticket_status)
            if not status_option:
                error_msg = 'status invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_update_type = 'type' in request.data
        type_id = request.data.get('type') or None

        if is_update_type and type_id is not None:
            try:
                project_type = get_type_option_by_id(seadb_api, project_uuid, type_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not project_type:
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
            try:
                tag_options, _ = get_tags_column(seadb_api, project_uuid)
            except Exception as e:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            if not tag_options:
                tag_options = []
            tag_ids = [tag.get('id') for tag in tag_options]
            for tag in tags:
                if tag not in tag_ids:
                    error_msg = 'tags invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            tags = list(set(tags))
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

        ticket = get_ticket(seadb_api, project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        if not check_ticket_permission(username, workspace.owner, ticket):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username)
                description = replace_file_url_in_content(description, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            update_row = {}
            if title:
                update_row['title'] = title
            if description:
                update_row['description'] = description
            if ticket_status or ticket_status == '':
                update_row['status'] = status_option.get('name')
            if is_update_type:
                update_row['type'] = project_type.get('name') if type_id and project_type else None
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
            participants = ticket.get('participants', [])
            if username not in participants:
                participants.append(username)
            update_row['participants'] = participants
            update_row['updated_at'] = datetime.datetime.now(datetime.UTC).isoformat()
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

    def delete(self, request, project_uuid, ticket_number):
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

        ticket = get_ticket(seadb_api, project_uuid, ticket_number)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
        update_row = {
            'pk': ticket.get('_pk'),
            'row': {
                'deleted': True,
                'deleted_at': datetime.datetime.now(datetime.UTC).isoformat(),
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

        tickets = [{'number': ticket.get('_pk'), 'title': ticket.get('title')} for ticket in tickets]
        return Response({'tickets': tickets})


class TicketRepliesAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid, ticket_number):
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
            ticket = get_ticket(seadb_api, project_uuid, ticket_number)
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

    def post(self, request, project_uuid, ticket_number):
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
            ticket = get_ticket(seadb_api, project_uuid, ticket_number)
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
            client_token = uuid.uuid4().hex
            row = {
                TicketRepliesTable.ticket_id.name: ticket.get('_pk'),
                TicketRepliesTable.creator.name: username,
                TicketRepliesTable.content.name: content,
                TicketRepliesTable.created_at.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketRepliesTable.updated_at.name: datetime.datetime.now(datetime.UTC).isoformat(),
                TicketRepliesTable.deleted.name: False,
                TicketRepliesTable.delete_at.name: None,
                TicketRepliesTable.client_token.name: client_token,
            }
            seadb_api.insert_rows(project_uuid, 'ticket_replies', [row])

            sql = f"SELECT _pk FROM `ticket_replies` WHERE `client_token` = '{client_token}' ORDER BY _pk DESC LIMIT 1"
            res = seadb_api.query_rows(project_uuid, sql).get('results')
            pk = res and res[0].get('_pk')
            row.update({'number': pk})
            ticket_replies_count = seadb_api.query_rows(project_uuid, f"SELECT COUNT(*) as count FROM `ticket_replies` WHERE `ticket_id` = {ticket.get('_pk')} AND `deleted` = False").get('results')[0].get('count')
            update_ticket = {
                'pk': ticket.get('_pk'),
                'row': {
                    'reply_count': ticket_replies_count,
                    'reply_updated_at': datetime.datetime.now(datetime.UTC).isoformat(),
                    },
                }
            participants = ticket.get('participants', [])
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

    def put(self, request, project_uuid, ticket_number, reply_number):
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
            ticket = get_ticket(seadb_api, project_uuid, ticket_number)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        
            ticket_reply_data = get_ticket_reply_by_pk(seadb_api, project_uuid, ticket.get('_pk'), reply_number)
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

        updated_at = ticket_reply_data.get('updated_at')
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
                    'updated_at': datetime.datetime.now(datetime.UTC).isoformat(),
                },
            }
            seadb_api.update_rows(project_uuid, 'ticket_replies', [ticket_reply_update])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            update_row = {
                'reply_updated_at': ticket_reply_data.get('updated_at'),
            }
            participants = ticket.get('participants', [])
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

    def delete(self, request, project_uuid, ticket_number, reply_number):
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
            ticket_reply_data = get_ticket_reply_by_pk(seadb_api, project_uuid, ticket_number, reply_number)
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
            participants = ticket.get('participants', [])
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

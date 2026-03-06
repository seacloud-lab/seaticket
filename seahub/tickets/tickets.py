# -*- coding: utf-8 -*-
import datetime
import logging
import json
from dateutil.relativedelta import relativedelta

from django.utils import timezone
from django.utils.translation import gettext as _
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub import settings
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects
from seahub.project.models import ProjectConnections
from seahub.tickets.models import TicketViews
from seahub.project.utils import check_project_permission, \
    replace_file_url_in_content, check_ticket_permission, \
    check_comment_permission, get_current_table_metadata
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.utils.storage import upload_files_to_s3, delete_record_attachments_from_s3
from seahub.project.constants import TICKET_DEFAULT_SUBSTATE_CACHE_PREFIX, TICKET_DEFAULT_SUBSTATE_CACHE_TIMEOUT
from seahub.seadb_models.utils import list_tickets_view_records, list_tickets_by_search, \
    list_trash_tickets, list_my_tickets
from seahub.seadb_models.models import TicketCommentsTable, TicketsTable, DiscourseTopicsTable
from seahub.project.seadb_api import SeaDBAPI
from seahub.tickets.ticket_utils import get_ticket, get_ticket_comments, \
    check_ticket_comment_creation_interval, get_ticket_comment_by_pk, check_ticket_creation_interval, \
    convert_ticket_select_column_name_to_option_id, TABLE_TICKETS, get_tickets_by_ids, \
    delete_ticket_comments_by_ids, delete_ticket_activities_by_ids, get_deleted_tickets, \
    send_ticket_update_msg, compare_ticket_changes, record_ticket_activities, get_ticket_activities, \
    build_linked_record_titles_map, build_linked_record_titles_map_for_keys, \
    check_ticket_link_changes, sync_links_in_connection, TicketLinkValidationError, \
    get_column_from_columns_by_name, get_option_id_by_name
from seahub.notifications.signal_handler import MSG_TYPE_TICKET_COMMENTED, MSG_TYPE_TICKET_ASSIGNEE_ADDED
from seahub.tickets.signals import ticket_assignees_added, ticket_commented
from seahub.utils.decorators import require_org_context
from seahub.seadb_models.utils import get_connection_table_name
from seahub.utils import normalize_cache_key

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


class TicketsAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
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
            tickets, columns = list_tickets_view_records(seadb_api, project_uuid, view, username, start, limit)
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

        linked_record_titles = build_linked_record_titles_map(seadb_api, project_uuid, tickets, columns)
        return Response({
            'tickets': tickets,
            'columns': columns,
            'linked_record_titles': linked_record_titles,
        })

    @require_org_context
    def post(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
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

        due_date = request.POST.get('due_date', '')

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

        tag_ids = request.POST.get('tags', "[]")
        tag_ids = json.loads(tag_ids)

        seadb_api = SeaDBAPI(username)

        default_substate = ''
        cache_key = normalize_cache_key(str(project_uuid), prefix=TICKET_DEFAULT_SUBSTATE_CACHE_PREFIX)
        cached_default_substate = cache.get(cache_key, None)
        if cached_default_substate is not None:
            default_substate = cached_default_substate
        else:
            try:
                base_metadata = seadb_api.get_base_metadata(project_uuid)
                ticket_meta = get_current_table_metadata(base_metadata.get('tables'),
                                                         TABLE_TICKETS) if base_metadata else None
                table_columns = (ticket_meta or {}).get('columns') or []

                substate_column = get_column_from_columns_by_name(table_columns, 'substate') or {}
                substate_options = ((substate_column.get('data') or {}).get('options') or [])
                for opt in substate_options:
                    if (opt.get('name') or '').lower() == 'new':
                        default_substate = opt.get('name') or ''
                        break
                cache.set(cache_key, default_substate, TICKET_DEFAULT_SUBSTATE_CACHE_TIMEOUT)
            except Exception as e:
                logger.error(e)

        if not check_ticket_creation_interval(seadb_api, project_uuid, username):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        linked_connection_records = request.POST.get('linked_connection_records', '[]')
        try:
            linked_connection_records = json.loads(linked_connection_records)
        except Exception:
            error_msg = 'linked_connection_records invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if linked_connection_records and not isinstance(linked_connection_records, list):
            error_msg = 'linked_connection_records invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        # check linked connection records
        if linked_connection_records:
            for connection_record in linked_connection_records:
                try:
                    connection_id, record_id = connection_record.split('_', 1)
                    connection_id = int(connection_id)
                    record_id = int(record_id)
                except Exception:
                    error_msg = 'linked_connection_records invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        # main
        try:
            ticket_state = 'open'
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()

            row = {
                TicketsTable.title.name: title,
                TicketsTable.content.name: content,
                TicketsTable.state.name: ticket_state,
                TicketsTable.type.name: type_name,
                TicketsTable.substate.name: default_substate,
                TicketsTable.priority.name: priority,
                TicketsTable.assignees.name: assignees,
                TicketsTable.participants.name: [username],
                TicketsTable.tags.name: [int(tag_id) for tag_id in tag_ids],
                TicketsTable.creator.name: username,
                TicketsTable.comment_count.name: 0,
                TicketsTable.created_time.name: now_datetime,
                TicketsTable.modified_time.name: now_datetime,
                TicketsTable.deleted.name: False,
                TicketsTable.due_date.name: due_date,
            }
            if linked_connection_records is not None:
                # keep stored value as list[str]
                row[TicketsTable.linked_connection_records.name] = list(set(linked_connection_records or []))

            res = seadb_api.insert_rows(project_uuid, TABLE_TICKETS, [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            ticket_pk = pks[0]
            row.update({'_pk': ticket_pk})

            if file_urls:
                try:
                    new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'ticket', int(ticket_pk))
                    updated_content = replace_file_url_in_content(content, new_file_urls_dict)
                    if updated_content != content:
                        seadb_api.update_rows(project_uuid, TABLE_TICKETS, [{
                            'pk': int(ticket_pk),
                            'row': {
                                TicketsTable.content.name: updated_content,
                            }
                        }])
                        row[TicketsTable.content.name] = updated_content
                except Exception as e:
                    logger.error(e)
                    try:
                        seadb_api.delete_rows(project_uuid, TABLE_TICKETS, [int(ticket_pk)])
                    except Exception as e:
                        logger.error(e)
                    error_msg = 'Upload files failed.'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            # sync reverse link to discourse topics
            if linked_connection_records:
                ticket_link_diff = {
                    int(ticket_pk): (set(row.get(TicketsTable.linked_connection_records.name) or []), set())
                }
                try:
                    sync_plan, connections = check_ticket_link_changes(seadb_api, project_uuid, ticket_link_diff)
                except TicketLinkValidationError as e:
                    # rollback ticket creation if discourse topic already claimed
                    seadb_api.delete_rows(project_uuid, TABLE_TICKETS, [int(ticket_pk)])
                    return api_error(status.HTTP_400_BAD_REQUEST, str(e))
                sync_links_in_connection(seadb_api, project_uuid, sync_plan, connections)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        ticket_assignees_added.send(
            sender=None,
            project_uuid=project_uuid,
            assignees=assignees,
            msg_type=MSG_TYPE_TICKET_ASSIGNEE_ADDED,
            from_user_id=username,
            ticket_id=ticket_pk,
            ticket_title=title,
            workspace_id=workspace.id,
            project_name=project.project_name,
        )

        send_ticket_update_msg(project_uuid)

        return Response({'ticket': row},status=status.HTTP_201_CREATED)

    @require_org_context
    def put(self, request, project_uuid):
        tickets_data = request.data.get('tickets_data')
        if not tickets_data:
            error_msg = 'tickets_data is required.'
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
            sql = f"""
            SELECT `_pk`, `assignees`, `title`, `state`, `substate`, `type`, `tags`, `priority`, `linked_connection_records`
            FROM `tickets`
            WHERE `_pk` IN ({ticket_ids_str})
            """
            query_result = seadb_api.query_rows(project_uuid, sql)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        results = query_result.get('results')
        if not results:
            # file or folder has been deleted
            return Response({'success': True})

        old_lcr_by_ticket_id = {}
        for r in results:
            old_lcr_by_ticket_id[int(r.get('_pk'))] = r.get(TicketsTable.linked_connection_records.name) or []

        ticket_link_diff = {}
        update_rows = []
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        for row in results:
            updated_row = {}
            row_data = ticket_id_to_row.get(str(row.get('_pk')))
            if not row_data:
                continue
            if 'state' in row_data:
                ticket_state_name = row_data.get('state').lower()
                updated_row[TicketsTable.state.name] = ticket_state_name
                if ticket_state_name == 'closed':
                    updated_row[TicketsTable.closed_time.name] = now_datetime
                elif ticket_state_name == 'open':
                    updated_row[TicketsTable.closed_time.name] = ''
            if 'substate' in row_data:
                updated_row[TicketsTable.substate.name] = row_data.get('substate')
            if 'tags' in row_data:
                tags_value = row_data.get('tags')
                if tags_value is None:
                    updated_row[TicketsTable.tags.name] = []
                else:
                    updated_row[TicketsTable.tags.name] = [int(tag_id) for tag_id in tags_value]
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
            if 'linked_connection_records' in row_data:
                new_lcr = row_data.get('linked_connection_records', [])
                if new_lcr in (None, ''):
                    updated_row[TicketsTable.linked_connection_records.name] = []
                elif isinstance(new_lcr, list):
                    if any((not isinstance(x, str)) for x in new_lcr):
                        error_msg = 'linked_connection_records invalid.'
                        return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                    updated_row[TicketsTable.linked_connection_records.name] = list(set(new_lcr))
                else:
                    error_msg = 'linked_connection_records invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

                ticket_pk = int(row.get('_pk'))
                old_lcr = old_lcr_by_ticket_id.get(ticket_pk) or []
                old_set = set(old_lcr)
                new_set = set(updated_row.get(TicketsTable.linked_connection_records.name) or [])
                added_items = list(new_set - old_set)
                removed_items = list(old_set - new_set)
                ticket_link_diff[ticket_pk] = (added_items, removed_items)
            for key, value in row_data.items():
                if key in ('substate', 'tags', 'type', '_pk', 'modified_time', 'content', 'state', 'linked_connection_records'):
                    continue
                updated_row[key] = value

            updated_row[TicketsTable.modified_time.name] = now_datetime
            update_rows.append(
                {
                    'pk': row.get('_pk'),
                    'row': updated_row,
                }
            )

        if ticket_link_diff:
            try:
                sync_plan, connections = check_ticket_link_changes(seadb_api, project_uuid, ticket_link_diff)
            except TicketLinkValidationError as e:
                return api_error(status.HTTP_400_BAD_REQUEST, str(e))
            sync_links_in_connection(seadb_api, project_uuid, sync_plan, connections)

        if update_rows:
            try:
                seadb_api.update_rows(project_uuid, TABLE_TICKETS, update_rows)
            except Exception as e:
                logger.exception(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            # record ticket activities
            try:
                for ticket in results:
                    row_data = ticket_id_to_row.get(str(ticket.get('_pk')))
                    if not row_data:
                        continue
                    changes = compare_ticket_changes(ticket, row_data)
                    if changes:
                        record_ticket_activities(
                            seadb_api, project_uuid, ticket.get('_pk'), username, changes
                        )
            except Exception as e:
                logger.error('Failed to record ticket activities: %s', e)

            try:
                for ticket in results:
                    row_data = ticket_id_to_row.get(str(ticket.get('_pk')))
                    if not row_data:
                        continue
                    if 'assignees' not in row_data:
                        continue

                    old_assignees = set(ticket.get('assignees') or [])
                    new_assignees = set(row_data.get('assignees') or [])
                    added_assignees = new_assignees - old_assignees
                    ticket_assignees_added.send(
                        sender=None,
                        project_uuid=project_uuid,
                        assignees=list(added_assignees),
                        msg_type=MSG_TYPE_TICKET_ASSIGNEE_ADDED,
                        from_user_id=username,
                        ticket_id=ticket.get('_pk'),
                        ticket_title=row_data.get('title') or ticket.get('title'),
                        workspace_id=workspace.id,
                        project_name=project.project_name,
                    )
            except Exception as e:
                logger.error(e)

        return Response({'success': True})

    @require_org_context
    def delete(self, request, project_uuid):
        ticket_ids = request.data.get('ticket_ids')
        if not ticket_ids:
            error_msg = 'ticket_ids is required.'
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
            seadb_api.update_rows(project_uuid, TABLE_TICKETS, update_rows)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        send_ticket_update_msg(project_uuid)

        return Response({
            'success': need_delete_ticket_ids,
            'failed': fail_ticket_ids
        })


class TicketAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. owner
        2. group member
        """
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

            linked_connection_records = ticket.get(TicketsTable.linked_connection_records.name) or []
            linked_record_titles = build_linked_record_titles_map_for_keys(
                seadb_api, project_uuid, linked_connection_records
            )

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

        return Response({'ticket': ticket, 'linked_record_titles': linked_record_titles})

    @require_org_context
    def put(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. creator
        2. group member
        """
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

        is_update_due_date = 'due_date' in request.data
        due_date = request.data.get('due_date')

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

        is_update_linked_connection_records = 'linked_connection_records' in request.data
        new_linked_connection_records = request.data.get('linked_connection_records')
        ticket_link_diff = {}
        if is_update_linked_connection_records:
            # check new_linked_connection_records
            if new_linked_connection_records in (None, ''):
                new_linked_connection_records = []
            elif isinstance(new_linked_connection_records, str):
                try:
                    new_linked_connection_records = json.loads(new_linked_connection_records)
                except Exception:
                    error_msg = 'linked_connection_records invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not isinstance(new_linked_connection_records, list) or any(
                (not isinstance(x, str)) for x in new_linked_connection_records
            ):
                error_msg = 'linked_connection_records invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # handle diff
            new_linked_connection_records = list(set([x for x in new_linked_connection_records if x]))
            old_linked_connection_records = ticket.get(TicketsTable.linked_connection_records.name) or []
            if not isinstance(old_linked_connection_records, list):
                old_linked_connection_records = []
            added_linked_records = set(new_linked_connection_records) - set(old_linked_connection_records)
            removed_linked_records = set(old_linked_connection_records) - set(new_linked_connection_records)

            if added_linked_records or removed_linked_records:
                ticket_link_diff[ticket_id] = (added_linked_records, removed_linked_records)
            try:
                sync_plan, connections = check_ticket_link_changes(seadb_api, project_uuid, ticket_link_diff)
            except TicketLinkValidationError as e:
                return api_error(status.HTTP_400_BAD_REQUEST, str(e))
        if assignees:
            for assignee in assignees:
                if not check_project_permission(assignee, workspace.owner):
                    error_msg = 'assignees invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'ticket', int(ticket.get('_pk')))
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
            if is_update_due_date:
                update_row[TicketsTable.due_date.name] = due_date or ''
            if is_update_linked_connection_records:
                update_row[TicketsTable.linked_connection_records.name] = new_linked_connection_records
            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            if ticket_state_name or ticket_state_name == '':
                ticket_state_name = ticket_state_name.lower()
                update_row[TicketsTable.state.name] = ticket_state_name
                if ticket_state_name == 'closed':
                    update_row[TicketsTable.closed_time.name] = now_datetime
                elif ticket_state_name == 'open':
                    update_row[TicketsTable.closed_time.name] = ''

            update_row[TicketsTable.participants.name] = participants
            update_row[TicketsTable.modified_time.name] = now_datetime
            update_rows = [
                {
                    'pk': ticket.get('_pk'),
                    'row': update_row
                }
            ]
            print(f"DEBUG: update_rows: {update_rows}")
            seadb_api.update_rows(project_uuid, TABLE_TICKETS, update_rows)
            if is_update_linked_connection_records and ticket_link_diff:
                sync_links_in_connection(seadb_api, project_uuid, sync_plan, connections)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # record ticket activities
        new_activities = []
        try:
            changes = compare_ticket_changes(ticket, update_row)
            if changes:
                new_activities = record_ticket_activities(
                    seadb_api, project_uuid, ticket.get('_pk'), username, changes
                )
                for activity in new_activities:
                    field_name = activity.get('field_name')
                    if field_name not in (
                        TicketsTable.state.name,
                        TicketsTable.substate.name,
                        TicketsTable.type.name,
                    ):
                        continue
                    # keep storage as option name; only return ids for frontend consistency
                    case_insensitive = field_name == TicketsTable.state.name
                    activity['old_value'] = get_option_id_by_name(
                        metadata, field_name, activity.get('old_value'),
                        case_insensitive=case_insensitive
                    )
                    activity['new_value'] = get_option_id_by_name(
                        metadata, field_name, activity.get('new_value'),
                        case_insensitive=case_insensitive
                    )
        except Exception as e:
            logger.error('Failed to record ticket activity: %s', e)

        old_assignees = set(ticket.get('assignees') or [])
        if is_update_assignees:
            new_assignees = set(assignees or [])
            added_assignees = new_assignees - old_assignees
            if added_assignees:
                ticket_assignees_added.send(
                    sender=None,
                    project_uuid=project_uuid,
                    assignees=added_assignees,
                    from_user_id=username,
                    msg_type=MSG_TYPE_TICKET_ASSIGNEE_ADDED,
                    ticket_id=ticket.get('_pk'),
                    ticket_title=title or ticket.get('title'),
                    workspace_id=workspace.id,
                    project_name=project.project_name,
                )

        send_ticket_update_msg(project_uuid)

        return Response({'success': True, 'activities': new_activities})

    @require_org_context
    def delete(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. group member
        """
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
            seadb_api.update_rows(project_uuid, TABLE_TICKETS, [update_row])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        send_ticket_update_msg(project_uuid)

        return Response({'success': True})


class TicketsSearchAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def get(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
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

    @require_org_context
    def get(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. owner
        2. group member
        """
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

    @require_org_context
    def post(self, request, project_uuid, ticket_id):
        """
        Permission:
        1. owner
        2. group member
        """
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
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'ticket', int(ticket.get('_pk')))
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            row = {
                TicketCommentsTable.ticket_id.name: ticket.get('_pk'),
                TicketCommentsTable.creator.name: username,
                TicketCommentsTable.content.name: content,
                TicketCommentsTable.created_time.name: now_datetime,
                TicketCommentsTable.modified_time.name: now_datetime,
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
                    'modified_time': now_datetime,
                    },
                }
            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
            update_ticket['row']['participants'] = participants
            seadb_api.update_rows(project_uuid, TABLE_TICKETS, [update_ticket])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        assignees = ticket.get('assignees') or []
        related_users = set(assignees) | set(participants)
        if related_users:
            ticket_commented.send(
                sender=None,
                project_uuid=project_uuid,
                related_users=list(related_users),
                msg_type=MSG_TYPE_TICKET_COMMENTED,
                from_user_id=username,
                ticket_id=ticket.get('_pk'),
                comment_id=pk,
                comment_content=content[:100] if content else '',
                ticket_title=ticket.get('title'),
                workspace_id=workspace.id,
                project_name=project.project_name,
            )

        return Response({'ticket_comment': row}, status=status.HTTP_201_CREATED)


class TicketCommentAPIView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    @require_org_context
    def put(self, request, project_uuid, ticket_id, comment_id):
        """
        Permission:
        1. creator
        2. group admin
        """
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
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'ticket', int(ticket.get('_pk')))
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
            seadb_api.update_rows(project_uuid, TABLE_TICKETS, [ticket_update])
        except Exception as e:
            logger.error(e)

        return Response({'ticket_comment': ticket_comment_data})

    @require_org_context
    def delete(self, request, project_uuid, ticket_id, comment_id):
        """
        Permission:
        1. creator
        2. group admin
        """
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
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            update_ticket_comment = {
                'pk': ticket_comment_data.get('_pk'),
                'row': {
                    'deleted': True,
                    'delete_time': now_datetime,
                },
            }
            seadb_api.update_rows(project_uuid, 'ticket_comments', [update_ticket_comment])

            update_ticket = {
                'pk': ticket.get('_pk'),
                'row': {
                    'modified_time': now_datetime,
                }
            }

            participants = ticket.get('participants') or []
            if username not in participants:
                participants.append(username)
                update_ticket['row']['participants'] = participants
            seadb_api.update_rows(project_uuid, TABLE_TICKETS, [update_ticket])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

class TicketActivitiesAPIView(APIView):
    """GET /api/v1/project/{project_uuid}/tickets/{ticket_id}/activities/"""
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid, ticket_id):
        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 50))
        except ValueError:
            page, per_page = 1, 50

        start = (page - 1) * per_page

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            seadb_api = SeaDBAPI(username)
            ticket, metadata = get_ticket(seadb_api, project_uuid, int(ticket_id))
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            activities = get_ticket_activities(
                seadb_api, project_uuid, int(ticket_id), start, per_page
            )
        except Exception as e:
            logger.error('Failed to get ticket activities: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        activities_list = []
        for a in activities:
            detail = json.loads(a.get('detail', '{}')) if a.get('detail') else {}
            field_name = detail.get('field_name', '')
            old_value = detail.get('old_value')
            new_value = detail.get('new_value')

            if field_name in (TicketsTable.state.name, TicketsTable.substate.name, TicketsTable.type.name):
                old_value = get_option_id_by_name(metadata, field_name, old_value)
                new_value = get_option_id_by_name(metadata, field_name, new_value)
            elif field_name == TicketsTable.tags.name:
                if isinstance(old_value, list):
                    old_value = [
                        get_option_id_by_name(metadata, TicketsTable.tags.name, v)
                        for v in old_value
                    ]
                if isinstance(new_value, list):
                    new_value = [
                        get_option_id_by_name(metadata, TicketsTable.tags.name, v)
                        for v in new_value
                    ]
            activities_list.append({
                'id': a.get('_pk'),
                'ticket_id': a.get('ticket_id'),
                'activity_type': a.get('activity_type'),
                'field_name': field_name,
                'old_value': old_value,
                'new_value': new_value,
                'creator': a.get('creator'),
                'created_time': a.get('created_time'),
            })

        return Response({
            'activities': activities_list
        })


class MyTicketAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def post(self, request, project_uuid):
        """
        Permission:
        1. owner
        2. group member
        """
        # argument check
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
            tickets, columns = list_my_tickets(seadb_api, project_uuid, username, ticket_state, start, limit, view_config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        linked_record_titles = build_linked_record_titles_map(seadb_api, project_uuid, tickets, columns)
        return Response({
            'tickets': tickets,
            'columns': columns,
            'linked_record_titles': linked_record_titles,
        })


class TicketMetadataAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
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


class TicketTrashAPIView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
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
            tickets, columns = list_trash_tickets(seadb_api, project_uuid, start, limit)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        linked_record_titles = build_linked_record_titles_map(seadb_api, project_uuid, tickets, columns)
        return Response({'tickets': tickets, 'columns': columns, 'linked_record_titles': linked_record_titles})

    @require_org_context
    def put(self, request, project_uuid):
        ticket_ids = request.data.get('ticket_ids')
        if not ticket_ids:
            error_msg = 'tickets_data is required.'
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
        update_rows = []
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        for ticket_id in ticket_ids:
            updated_row = {
                TicketsTable.modified_time.name: now_datetime,
                TicketsTable.deleted.name: False,
            }
            update_rows.append(
                {
                    'pk': int(ticket_id),
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

        send_ticket_update_msg(project_uuid)

        return Response({'success': True})

    @require_org_context
    def delete(self, request, project_uuid):
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
            need_delete_tickets = get_deleted_tickets(seadb_api, project_uuid)
            need_delete_ticket_ids = [ticket['ticket_id'] for ticket in need_delete_tickets]
            if not need_delete_ticket_ids:
                return Response({'success': True}, status=status.HTTP_200_OK)

            for ticket_id in need_delete_ticket_ids:
                delete_record_attachments_from_s3(project_uuid, 'ticket', int(ticket_id))

            need_update_connection_records = [ticket['linked_connection_records'] for ticket in need_delete_tickets if ticket['linked_connection_records']]
            update_connection_ids = set()
            for ticket_linked in need_update_connection_records:
                update_connection_ids.update([int(record.split('_')[0]) for record in ticket_linked if record])

            # Get connection types for each connection_id
            connections = ProjectConnections.objects.filter(id__in=update_connection_ids)
            connection_map = {c.id: c for c in connections}

            for connection_id in update_connection_ids:
                connection = connection_map.get(connection_id)
                if not connection:
                    continue
                table_name = get_connection_table_name(connection.type, connection_id)
                if not table_name:
                    continue
                ticket_ids_str = ','.join([str(ticket_id) for ticket_id in need_delete_ticket_ids])
                update_sql = f"""
                SELECT _pk FROM `{table_name}` WHERE `linked_ticket` IN ({ticket_ids_str})
                """
                need_update_records = seadb_api.query_rows(project_uuid, update_sql).get('results')
                update_rows = []
                for row in need_update_records:
                    update_rows.append({
                        'pk': row.get('_pk'),
                        'row': {
                            'linked_ticket': None,
                        }
                    })
                if update_rows:
                    seadb_api.update_rows(project_uuid, table_name, update_rows)

            delete_ticket_comments_by_ids(seadb_api, project_uuid, need_delete_ticket_ids)
            delete_ticket_activities_by_ids(seadb_api, project_uuid, need_delete_ticket_ids)
            seadb_api.delete_rows(project_uuid, 'tickets', need_delete_ticket_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)


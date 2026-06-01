# -*- coding: utf-8 -*-
import datetime
import logging
import json
import copy
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
from seahub.project.constants import TICKET_DEFAULT_SUBSTATE_CACHE_PREFIX, TICKET_DEFAULT_SUBSTATE_CACHE_TIMEOUT, \
    GITHUB_ISSUE_ACTIVITY_TYPES, DISCOURSE_TOPIC_ACTIVITY_TYPES, EMAIL_ACTIVITY_TYPES, ConnectionType
from seahub.seadb_models.utils import list_tickets_view_records, list_tickets_by_search, \
    list_trash_tickets, list_my_tickets
from seahub.seadb_models.models import TicketCommentsTable, TicketsTable, DiscourseTopicsTable, GithubIssuesTable
from seahub.project.seadb_api import SeaDBAPI
from seahub.tickets.ticket_utils import get_ticket, get_ticket_comments, \
    check_ticket_comment_creation_interval, get_ticket_comment_by_pk, check_ticket_creation_interval, \
    convert_select_field_names_to_option_ids, TABLE_TICKETS, get_tickets_by_ids, \
    delete_ticket_comments_by_ids, delete_ticket_activities_by_ids, get_deleted_tickets, \
    send_ticket_update_msg, compare_ticket_changes, record_ticket_activities, get_ticket_activities, \
    build_linked_record_titles_map, build_linked_records_info_for_keys, \
    check_ticket_link_changes, sync_links_in_connection, TicketLinkValidationError, \
    get_column_from_columns_by_name, get_option_id_by_name, send_data_update_msg, \
    build_tag_id_to_name_map, validate_linked_connection_records, \
    collect_open_linked_github_issues_for_tickets, build_ticket_close_warning_response, \
    TICKET_CLOSE_CONFIRM_FIELD, close_linked_github_issues, get_ticket_table_columns, \
    map_ticket_substate_to_github_state_reason, TicketCloseValidationError
from seahub.notifications.signal_handler import MSG_TYPE_TICKET_COMMENTED, MSG_TYPE_TICKET_ASSIGNEE_ADDED
from seahub.tickets.signals import ticket_assignees_added, ticket_commented
from seahub.utils.decorators import require_org_context
from seahub.seadb_models.utils import get_connection_table_name
from seahub.utils import normalize_cache_key
from seahub.project.constants import DataEventType

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


TICKET_EVENT_IGNORED_FIELDS = frozenset({
    TicketsTable.comment_count.name,
    TicketsTable.modified_time.name,
    TicketsTable.closed_time.name,
})


def _format_ticket_event_value(field_name, field_value, tag_id_to_name=None):
    if field_name == TicketsTable.tags.name and isinstance(field_value, list):
        return [
            tag_id_to_name.get(str(tag_id), tag_id)
            for tag_id in field_value
        ]
    return field_value


def build_ticket_data_event(event_type, old_row=None, new_row=None, seadb_api=None, project_uuid=None):
    old_row = old_row or {}
    new_row = new_row or {}
    old_value = {}
    new_value = {}
    tag_id_to_name = {}

    has_tag_changes = False
    tag_ids = []
    if TicketsTable.tags.name in new_row:
        old_tags = old_row.get(TicketsTable.tags.name) or []
        new_tags = new_row.get(TicketsTable.tags.name) or []
        if old_tags != new_tags:
            has_tag_changes = True
            tag_ids = old_tags + new_tags

    if has_tag_changes and seadb_api and project_uuid:
        tag_id_to_name = build_tag_id_to_name_map(seadb_api, project_uuid, tag_ids)

    for field_name, field_value in new_row.items():
        if field_name in TICKET_EVENT_IGNORED_FIELDS:
            continue
        old_field_value = old_row.get(field_name)
        if old_field_value == field_value:
            continue
        old_value[field_name] = _format_ticket_event_value(field_name, old_field_value, tag_id_to_name)
        new_value[field_name] = _format_ticket_event_value(field_name, field_value, tag_id_to_name)

    return {
        'type': event_type,
        'old_value': old_value or None,
        'new_value': new_value or None,
    }


def has_ticket_event_changes(event):
    if not isinstance(event, dict):
        return False
    return bool(event.get('old_value')) or bool(event.get('new_value'))


def get_github_issue_update_error_response(error):
    status_code = getattr(error, 'status_code', None)
    error_msg = getattr(error, 'error_msg', None)
    if status_code and error_msg:
        return api_error(status_code, error_msg)
    return None


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
            seadb_api = SeaDBAPI()
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

        seadb_api = SeaDBAPI()

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
        try:
            validate_linked_connection_records(linked_connection_records)
        except TicketLinkValidationError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, str(e))
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

            # sync reverse link to discourse topics and portal issues
            if linked_connection_records:
                ticket_link_diff = {
                    int(ticket_pk): (set(row.get(TicketsTable.linked_connection_records.name) or []), set())
                }
                try:
                    sync_plan, connections = check_ticket_link_changes(seadb_api, project_uuid, ticket_link_diff)
                except TicketLinkValidationError as e:
                    # rollback ticket creation if discourse topic already claimed or portal issue already linked
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

        send_ticket_update_msg(project_uuid, added=1)
        added_event = build_ticket_data_event(
            DataEventType.TICKET_ADDED.value,
            new_row=row,
            seadb_api=seadb_api,
            project_uuid=project_uuid,
        )
        if has_ticket_event_changes(added_event):
            send_data_update_msg(
                project_uuid,
                ticket_pk,
                event=added_event,
            )

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

        seadb_api = SeaDBAPI()
        confirm_close_linked_github_issues = request.data.get(TICKET_CLOSE_CONFIRM_FIELD)
        confirm_close_linked_github_issues = bool(confirm_close_linked_github_issues)

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
        ticket_events = {}
        ticket_close_candidates = []
        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        for row in results:
            updated_row = {}
            event_type = DataEventType.TICKET_UPDATED.value
            row_data = ticket_id_to_row.get(str(row.get('_pk')))
            if not row_data:
                continue
            if 'state' in row_data:
                ticket_state_name = row_data.get('state').lower()
                updated_row[TicketsTable.state.name] = ticket_state_name
                if ticket_state_name == 'closed':
                    event_type = DataEventType.TICKET_CLOSED.value
                    updated_row[TicketsTable.closed_time.name] = now_datetime
                elif ticket_state_name == 'open':
                    event_type = DataEventType.TICKET_REOPENED.value
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
                    try:
                        validate_linked_connection_records(new_lcr)
                    except TicketLinkValidationError as e:
                        return api_error(status.HTTP_400_BAD_REQUEST, str(e))
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
            old_state = (row.get(TicketsTable.state.name) or '').lower()
            new_state = updated_row.get(TicketsTable.state.name) or old_state
            if new_state == 'closed' and old_state != 'closed':
                linked_connection_records = updated_row.get(TicketsTable.linked_connection_records.name)
                if linked_connection_records is None:
                    linked_connection_records = old_lcr_by_ticket_id.get(int(row.get('_pk'))) or []
                substate = updated_row.get(TicketsTable.substate.name)
                if substate is None:
                    substate = row.get(TicketsTable.substate.name)
                ticket_close_candidates.append({
                    'ticket_id': int(row.get('_pk')),
                    'ticket_title': updated_row.get(TicketsTable.title.name) or row.get(TicketsTable.title.name) or '',
                    'linked_connection_records': linked_connection_records,
                    'substate': substate,
                })
            ticket_id = int(row.get('_pk'))
            ticket_event = build_ticket_data_event(
                event_type,
                old_row=row,
                new_row=updated_row,
                seadb_api=seadb_api,
                project_uuid=project_uuid,
            )
            if has_ticket_event_changes(ticket_event):
                ticket_events[ticket_id] = ticket_event

        if ticket_close_candidates:
            grouped_open_issues = collect_open_linked_github_issues_for_tickets(
                seadb_api, project_uuid, ticket_close_candidates
            )
            if grouped_open_issues:
                if not confirm_close_linked_github_issues:
                    warning_payload = build_ticket_close_warning_response(grouped_open_issues)
                    return Response(warning_payload, status=status.HTTP_409_CONFLICT)
                try:
                    ticket_columns = get_ticket_table_columns(seadb_api, project_uuid)
                    ticket_open_issue_map = {
                        int(item.get('ticket_id')): item.get('open_github_issues') or []
                        for item in grouped_open_issues
                    }
                    ticket_close_payloads = []
                    for candidate in ticket_close_candidates:
                        ticket_id = int(candidate.get('ticket_id'))
                        open_github_issues = ticket_open_issue_map.get(ticket_id) or []
                        if not open_github_issues:
                            continue
                        state_reason = map_ticket_substate_to_github_state_reason(
                            candidate.get('substate'),
                            ticket_columns,
                        )
                        ticket_close_payloads.append({
                            'ticket_id': ticket_id,
                            'state_reason': state_reason,
                            'open_github_issues': open_github_issues,
                        })
                    close_linked_github_issues(seadb_api, project_uuid, ticket_close_payloads)
                except TicketCloseValidationError as e:
                    return api_error(status.HTTP_400_BAD_REQUEST, str(e))
                except Exception as e:
                    github_error_response = get_github_issue_update_error_response(e)
                    if github_error_response:
                        return github_error_response
                    logger.exception(e)
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

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

        for update_row in update_rows:
            ticket_id = int(update_row.get('pk'))
            ticket_event = ticket_events.get(ticket_id)
            if not ticket_event:
                continue
            send_data_update_msg(
                project_uuid,
                ticket_id,
                event=ticket_event,
            )

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
            seadb_api = SeaDBAPI()
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

        if need_delete_ticket_ids:
            send_ticket_update_msg(project_uuid, deleted=len(need_delete_ticket_ids))

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
            seadb_api = SeaDBAPI()
            ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            convert_select_field_names_to_option_ids(metadata, ticket)

            linked_connection_records = ticket.get(TicketsTable.linked_connection_records.name) or []

            linked_records_info = build_linked_records_info_for_keys(seadb_api, project_uuid, linked_connection_records)

            start = 0
            end = 25
            ticket_comments = get_ticket_comments(seadb_api, project_uuid, ticket_id, start, end)

            ticket['comments'] = ticket_comments
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'ticket': ticket, 'linked_records_info': linked_records_info})

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

        seadb_api = SeaDBAPI()
        ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
        if not ticket:
            error_msg = 'Ticket not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_ticket_permission(username, workspace.owner, ticket):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        ticket_state_name = request.data.get('state')
        confirm_close_linked_github_issues = request.data.get(TICKET_CLOSE_CONFIRM_FIELD)
        confirm_close_linked_github_issues = bool(confirm_close_linked_github_issues)
        updated_linked_records_info = None

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

        is_update_participants = TicketsTable.participants.name in request.data
        participants = request.data.get(TicketsTable.participants.name) or '[]'
        if is_update_participants and participants is not None:
            try:
                participants = json.loads(participants)
            except:
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not isinstance(participants, list):
                error_msg = 'participants invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            participants = list(set(participants))

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

            try:
                validate_linked_connection_records(new_linked_connection_records)
            except TicketLinkValidationError as e:
                return api_error(status.HTTP_400_BAD_REQUEST, str(e))

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
            event_type = DataEventType.TICKET_UPDATED.value
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
            if not is_update_participants:
                participants = ticket.get(TicketsTable.participants.name) or []
                if username not in participants:
                    participants.append(username)
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            if ticket_state_name or ticket_state_name == '':
                ticket_state_name = ticket_state_name.lower()
                update_row[TicketsTable.state.name] = ticket_state_name
                if ticket_state_name == 'closed':
                    event_type = DataEventType.TICKET_CLOSED.value
                    update_row[TicketsTable.closed_time.name] = now_datetime
                elif ticket_state_name == 'open':
                    event_type = DataEventType.TICKET_REOPENED.value
                    update_row[TicketsTable.closed_time.name] = ''

            old_state = (ticket.get(TicketsTable.state.name) or '').lower()
            new_state = update_row.get(TicketsTable.state.name) or old_state
            if new_state == 'closed' and old_state != 'closed':
                linked_connection_records = update_row.get(TicketsTable.linked_connection_records.name)
                if linked_connection_records is None:
                    linked_connection_records = ticket.get(TicketsTable.linked_connection_records.name) or []
                close_candidates = [{
                    'ticket_id': int(ticket.get('_pk')),
                    'ticket_title': update_row.get(TicketsTable.title.name) or ticket.get(TicketsTable.title.name) or '',
                    'linked_connection_records': linked_connection_records,
                    'substate': update_row.get(TicketsTable.substate.name) or ticket.get(TicketsTable.substate.name),
                }]
                grouped_open_issues = collect_open_linked_github_issues_for_tickets(
                    seadb_api, project_uuid, close_candidates
                )
                if grouped_open_issues:
                    if not confirm_close_linked_github_issues:
                        warning_payload = build_ticket_close_warning_response()
                        return Response(warning_payload, status=status.HTTP_409_CONFLICT)
                    try:
                        ticket_columns = get_ticket_table_columns(seadb_api, project_uuid)
                        state_reason = map_ticket_substate_to_github_state_reason(
                            close_candidates[0].get('substate'),
                            ticket_columns,
                        )
                        close_linked_github_issues(
                            seadb_api,
                            project_uuid,
                            [{
                                'ticket_id': int(ticket.get('_pk')),
                                'state_reason': state_reason,
                                'open_github_issues': grouped_open_issues[0].get('open_github_issues') or [],
                            }],
                        )
                        updated_linked_records_info = build_linked_records_info_for_keys(
                            seadb_api,
                            project_uuid,
                            close_candidates[0].get('linked_connection_records') or [],
                        )
                    except TicketCloseValidationError as e:
                        return api_error(status.HTTP_400_BAD_REQUEST, str(e))
                    except Exception as e:
                        github_error_response = get_github_issue_update_error_response(e)
                        if github_error_response:
                            return github_error_response
                        logger.exception(e)
                        return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

            update_row[TicketsTable.participants.name] = participants
            update_row[TicketsTable.modified_time.name] = now_datetime
            update_rows = [
                {
                    'pk': ticket.get('_pk'),
                    'row': update_row
                }
            ]
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
                    if field_name == 'state_substate':
                        state_column = get_column_from_columns_by_name(metadata, TicketsTable.state.name)
                        substate_column = get_column_from_columns_by_name(metadata, TicketsTable.substate.name)
                        state_key = (state_column or {}).get('key') or TicketsTable.state.name
                        substate_key = (substate_column or {}).get('key') or TicketsTable.substate.name
                        old_value = activity.get('old_value') or {}
                        new_value = activity.get('new_value') or {}
                        if isinstance(old_value, dict):
                            activity['old_value'] = {
                                state_key: get_option_id_by_name(
                                    metadata, TicketsTable.state.name, old_value.get('state'),
                                    case_insensitive=True
                                ),
                                substate_key: get_option_id_by_name(
                                    metadata, TicketsTable.substate.name, old_value.get('substate')
                                )
                            }
                        if isinstance(new_value, dict):
                            activity['new_value'] = {
                                state_key: get_option_id_by_name(
                                    metadata, TicketsTable.state.name, new_value.get('state'),
                                    case_insensitive=True
                                ),
                                substate_key: get_option_id_by_name(
                                    metadata, TicketsTable.substate.name, new_value.get('substate')
                                )
                            }
                    elif field_name in (
                        TicketsTable.state.name,
                        TicketsTable.substate.name,
                        TicketsTable.type.name,
                    ):
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
                    if field_name == 'state_substate':
                        state_column = get_column_from_columns_by_name(metadata, TicketsTable.state.name)
                        substate_column = get_column_from_columns_by_name(metadata, TicketsTable.substate.name)
                        state_key = (state_column or {}).get('key')
                        substate_key = (substate_column or {}).get('key')
                        if state_key and substate_key:
                            activity['field_key'] = f'{state_key}_{substate_key}'
                    else:
                        column = get_column_from_columns_by_name(metadata, field_name)
                        if column and column.get('key'):
                            activity['field_key'] = column.get('key')
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

        send_ticket_update_msg(project_uuid, updated=1)
        ticket_event = build_ticket_data_event(
            event_type,
            old_row=ticket,
            new_row=update_row,
            seadb_api=seadb_api,
            project_uuid=project_uuid,
        )
        if has_ticket_event_changes(ticket_event):
            send_data_update_msg(
                project_uuid,
                ticket.get('_pk'),
                event=ticket_event,
            )

        # Rename activity_type to type_description for frontend
        for activity in new_activities:
            activity.pop('field_name', None)

        return_dict = {
            'row': update_row,
            'activities': new_activities
        }
        if updated_linked_records_info is not None:
            return_dict['linked_records_info'] = updated_linked_records_info
        return Response(return_dict)

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
            seadb_api = SeaDBAPI()
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

        send_ticket_update_msg(project_uuid, deleted=1)

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
            seadb_api = SeaDBAPI()
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
            seadb_api = SeaDBAPI()
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
            seadb_api = SeaDBAPI()
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
                TicketCommentsTable.via_agent.name: False,
            }
            res = seadb_api.insert_rows(project_uuid, 'ticket_comments', [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            pk = pks[0]
            row.update({'_pk': pk, 'via_agent': False})
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

        send_data_update_msg(
            project_uuid,
            ticket.get('_pk'),
            event={
                'type': DataEventType.TICKET_COMMENT_ADDED.value,
                'old_value': None,
                'new_value': {
                    'comment_id': pk,
                    'content': content,
                }
            },
        )

        return Response({'comment': row}, status=status.HTTP_201_CREATED)


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
            seadb_api = SeaDBAPI()
            ticket, metadata = get_ticket(seadb_api, project_uuid, ticket_id)
            if not ticket:
                error_msg = 'Ticket not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            old_comment_data = get_ticket_comment_by_pk(seadb_api, project_uuid, ticket.get('_pk'), comment_id)
            if not old_comment_data:
                error_msg = 'Comment not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            # permission check
            if not check_comment_permission(username, workspace.owner, old_comment_data):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        new_comment_data = copy.deepcopy(old_comment_data)
        modified_time = old_comment_data.get('modified_time')
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
            
        new_comment_data['_pk'] = old_comment_data.get('_pk')
        new_comment_data['content'] = content
        new_comment_data['modified_time'] = datetime.datetime.now(datetime.UTC).isoformat()

        # main
        try:
            ticket_comment_update = {
                'pk': old_comment_data.get('_pk'),
                'row': {
                    'content': new_comment_data.get('content'),
                    'modified_time': new_comment_data.get('modified_time'),
                },
            }
            seadb_api.update_rows(project_uuid, 'ticket_comments', [ticket_comment_update])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            update_row = {
                'modified_time': datetime.datetime.now(datetime.UTC).isoformat(),
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

        send_data_update_msg(
            project_uuid,
            ticket.get('_pk'),
            event={
                'type': DataEventType.TICKET_COMMENT_UPDATED.value,
                'old_value': {
                    'comment_id': old_comment_data.get('_pk'),
                    'content': old_comment_data.get('content'),
                },
                'new_value': {
                    'comment_id': old_comment_data.get('_pk'),
                    'content': new_comment_data.get('content'),
                }
            },
        )

        return Response({'comment': new_comment_data})

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
            seadb_api = SeaDBAPI()
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
                    'modified_time': now_datetime,
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
            seadb_api = SeaDBAPI()
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
            field_key = None
            activity_type = a.get('activity_type', '')

            issue_number = None
            issue_url = None
            topic_id = None
            topic_url = None
            thread_id = None
            thread_title = None
            if activity_type in GITHUB_ISSUE_ACTIVITY_TYPES:
                field_key = activity_type
                issue_number = detail.get('issue_number')
                issue_url = detail.get('issue_url', '')
            elif activity_type in DISCOURSE_TOPIC_ACTIVITY_TYPES:
                field_key = activity_type
                topic_id = detail.get('topic_id')
                topic_url = detail.get('topic_url', '')
            elif activity_type in EMAIL_ACTIVITY_TYPES:
                field_key = activity_type
                connection_id = detail.get('connection_id')
                thread_id = detail.get('thread_id')
                thread_title = detail.get('thread_title', '')
            elif field_name == 'state_substate':
                state_column = get_column_from_columns_by_name(metadata, TicketsTable.state.name)
                substate_column = get_column_from_columns_by_name(metadata, TicketsTable.substate.name)
                state_key = (state_column or {}).get('key') or TicketsTable.state.name
                substate_key = (substate_column or {}).get('key') or TicketsTable.substate.name
                if isinstance(old_value, dict):
                    old_value = {
                        state_key: get_option_id_by_name(
                            metadata, TicketsTable.state.name, old_value.get('state'),
                            case_insensitive=True
                        ),
                        substate_key: get_option_id_by_name(
                            metadata, TicketsTable.substate.name, old_value.get('substate')
                        )
                    }
                if isinstance(new_value, dict):
                    new_value = {
                        state_key: get_option_id_by_name(
                            metadata, TicketsTable.state.name, new_value.get('state'),
                            case_insensitive=True
                        ),
                        substate_key: get_option_id_by_name(
                            metadata, TicketsTable.substate.name, new_value.get('substate')
                        )
                    }
            elif field_name in (TicketsTable.state.name, TicketsTable.substate.name, TicketsTable.type.name):
                case_insensitive = field_name == TicketsTable.state.name
                old_value = get_option_id_by_name(metadata, field_name, old_value, case_insensitive=case_insensitive)
                new_value = get_option_id_by_name(metadata, field_name, new_value, case_insensitive=case_insensitive)
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
            if activity_type not in GITHUB_ISSUE_ACTIVITY_TYPES and \
                    activity_type not in DISCOURSE_TOPIC_ACTIVITY_TYPES and \
                    activity_type not in EMAIL_ACTIVITY_TYPES:
                if field_name == 'state_substate':
                    state_column = get_column_from_columns_by_name(metadata, TicketsTable.state.name)
                    substate_column = get_column_from_columns_by_name(metadata, TicketsTable.substate.name)
                    state_key = (state_column or {}).get('key')
                    substate_key = (substate_column or {}).get('key')
                    if state_key and substate_key:
                        field_key = f'{state_key}_{substate_key}'
                else:
                    column = get_column_from_columns_by_name(metadata, field_name)
                    if column and column.get('key'):
                        field_key = column.get('key')
            activity_item = {
                'id': a.get('_pk'),
                'ticket_id': a.get('ticket_id'),
                'activity_type': a.get('activity_type'),
                'field_key': field_key,
                'old_value': old_value,
                'new_value': new_value,
                'creator': a.get('creator'),
                'created_time': a.get('created_time'),
            }
            if activity_type in GITHUB_ISSUE_ACTIVITY_TYPES:
                activity_item['issue_number'] = issue_number
                activity_item['issue_url'] = issue_url
            elif activity_type in DISCOURSE_TOPIC_ACTIVITY_TYPES:
                activity_item['topic_id'] = topic_id
                activity_item['topic_url'] = topic_url
            elif activity_type in EMAIL_ACTIVITY_TYPES:
                activity_item['connection_id'] = connection_id
                activity_item['thread_id'] = thread_id
                activity_item['thread_title'] = thread_title
            activities_list.append(activity_item)

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

        seadb_api = SeaDBAPI()
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

        seadb_api = SeaDBAPI()
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

        seadb_api = SeaDBAPI()
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

        seadb_api = SeaDBAPI()
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

        if update_rows:
            send_ticket_update_msg(project_uuid, added=len(update_rows))
        for ticket_id in ticket_ids:
            send_data_update_msg(
                project_uuid,
                ticket_id,
                event={
                    'type': DataEventType.TICKET_RESTORED.value,
                    'old_value': {'deleted': True},
                    'new_value': {'deleted': False},
                },
            )

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
            seadb_api = SeaDBAPI()
            need_delete_tickets = get_deleted_tickets(seadb_api, project_uuid)
            need_delete_ticket_ids = [ticket['ticket_id'] for ticket in need_delete_tickets]
            if not need_delete_ticket_ids:
                return Response({'success': True}, status=status.HTTP_200_OK)

            for ticket_id in need_delete_ticket_ids:
                delete_record_attachments_from_s3(project_uuid, 'ticket', int(ticket_id))

            need_update_connection_records = [ticket['linked_connection_records'] for ticket in need_delete_tickets if ticket['linked_connection_records']]
            update_connection_ids = set()
            portal_issue_ids_to_unlink = set()
            for ticket_linked in need_update_connection_records:
                for record in ticket_linked:
                    if not record:
                        continue
                    if record.startswith('portal_'):
                        portal_issue_ids_to_unlink.add(int(record.split('_', 1)[1]))
                    else:
                        update_connection_ids.add(int(record.split('_')[0]))

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

            # Clear linked_ticket on portal issues linked to the deleted tickets
            if portal_issue_ids_to_unlink:
                portal_ids_str = ','.join(str(pid) for pid in portal_issue_ids_to_unlink)
                portal_sql = f"SELECT _pk, `linked_ticket` FROM `portal_issues` WHERE _pk IN ({portal_ids_str})"
                portal_res = seadb_api.query_rows(project_uuid, portal_sql)
                portal_rows = portal_res.get('results', [])
                now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
                portal_update_rows = []
                for portal_row in portal_rows:
                    linked_ticket = portal_row.get('linked_ticket')
                    if linked_ticket and int(linked_ticket) in need_delete_ticket_ids:
                        portal_update_rows.append({
                            'pk': int(portal_row.get('_pk')),
                            'row': {
                                'linked_ticket': None,
                                'modified_time': now_datetime,
                            }
                        })
                if portal_update_rows:
                    seadb_api.update_rows(project_uuid, 'portal_issues', portal_update_rows)

            delete_ticket_comments_by_ids(seadb_api, project_uuid, need_delete_ticket_ids)
            delete_ticket_activities_by_ids(seadb_api, project_uuid, need_delete_ticket_ids)
            seadb_api.delete_rows(project_uuid, 'tickets', need_delete_ticket_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)

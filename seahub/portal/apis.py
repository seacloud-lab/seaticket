# -*- coding: utf-8 -*-
import datetime
import logging
import json

from dateutil.relativedelta import relativedelta
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _
from django.utils import timezone
from django.core.cache import cache


from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info
from seahub.project.models import Projects
from seahub.project.utils import replace_file_url_in_content, get_current_table_metadata, check_project_admin_permission, \
    check_project_permission, check_ticket_permission, check_comment_permission
from seahub.utils.storage import upload_files_to_s3, delete_record_attachments_from_s3
from seahub.utils.hasher import AESPasswordHasher
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.project.constants import PORTAL_ISSUE_DEFAULT_SUBSTATE_CACHE_TIMEOUT, PORTAL_ISSUE_DEFAULT_SUBSTATE_CACHE_PREFIX
from seahub.seadb_models.models import TagTable, PortalIssuesTable, PortalIssueCommentsTable
from seahub.seadb_models.utils import list_knowledge_base_records, list_my_portal_issues, list_portal_issues_view_records, list_trash_portal_issues
from seahub.tickets.ticket_utils import check_ticket_creation_interval, get_column_from_columns_by_name, \
    check_ticket_comment_creation_interval, build_linked_ticket_titles_map, TABLE_TICKETS, get_tickets_by_ids
from seahub.knowledge_base.models import KnowledgeBaseViews
from seahub.utils.decorators import require_org_context
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.portal.permissions import PortalKnowledgeBasePermission, PortalIssuePermission
from seahub.portal.models import ProjectExternalUser
from seahub.utils.verify import get_random_code
from seahub.utils.auth import gen_user_virtual_id
from seahub.utils.mail import send_html_email_with_dj_template
from seahub.portal.models import PortalExternalInvitation, PortalIssueViews
from seahub.utils import is_valid_email, IS_EMAIL_CONFIGURED, normalize_cache_key
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.knowledge_base.knowledge_base_utils import get_knowledge_base_record_by_pk
from seahub.portal.portal_utils import get_portal_issue, get_portal_issue_comments, get_portal_issue_comment_by_pk, get_portal_issues

logger = logging.getLogger(__name__)


TABLE_PORTAL_ISSUES = 'portal_issues'
TABLE_PORTAL_ISSUE_COMMENTS = 'portal_issue_comments'

MAX_LENGTH = 10000


class PortalIssuesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission,)
    throttle_classes = (UserRateThrottle,)

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
            view = PortalIssueViews.objects.get_view(project_uuid=project_uuid, view_id=view_id)
            seadb_api = SeaDBAPI()
            issues, columns = list_portal_issues_view_records(seadb_api, project_uuid, view, username, start, limit)
            ticket_pk_to_ticket_title = build_linked_ticket_titles_map(seadb_api, project_uuid, issues, columns, 'linked_ticket')
        except SQLGeneratorOptionInvalidError as e:
            logger.error(e)
            error_msg = _('There are errors with the filters. Please correct them.')
            return Response({
                'issues': [],
                'columns': getattr(e, 'columns', []),
                'error_msg': error_msg,
            })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'issues': issues,
            'columns': columns,
            'ticket_pk_to_ticket_title': ticket_pk_to_ticket_title,
        })


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

        username = request.user.username
        seadb_api = SeaDBAPI()

        if not check_ticket_creation_interval(seadb_api, project_uuid, username):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        try:
            portal_issue_state = 'open'
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()

            default_substate = ''
            cache_key = normalize_cache_key(str(project_uuid), prefix=PORTAL_ISSUE_DEFAULT_SUBSTATE_CACHE_PREFIX)
            cached_default_substate = cache.get(cache_key, None)
            if cached_default_substate is not None:
                default_substate = cached_default_substate
            else:
                try:
                    base_metadata = seadb_api.get_base_metadata(project_uuid)
                    issue_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_PORTAL_ISSUES) if base_metadata else None
                    table_columns = (issue_meta or {}).get('columns') or []

                    substate_column = get_column_from_columns_by_name(table_columns, 'substate') or {}
                    substate_options = ((substate_column.get('data') or {}).get('options') or [])
                    for opt in substate_options:
                        if (opt.get('name') or '').lower() == 'new':
                            default_substate = opt.get('name') or ''
                            break
                    cache.set(cache_key, default_substate, PORTAL_ISSUE_DEFAULT_SUBSTATE_CACHE_TIMEOUT)
                except Exception as e:
                    logger.error(e)

            row = {
                PortalIssuesTable.title.name: title,
                PortalIssuesTable.content.name: content,
                PortalIssuesTable.state.name: portal_issue_state,
                PortalIssuesTable.type.name: type_name if type_name else None,
                PortalIssuesTable.substate.name: default_substate,
                PortalIssuesTable.priority.name: priority,
                PortalIssuesTable.assignees.name: [],
                PortalIssuesTable.participants.name: [username],
                PortalIssuesTable.tags.name: tag_ids,
                PortalIssuesTable.creator.name: username,
                PortalIssuesTable.comment_count.name: 0,
                PortalIssuesTable.created_time.name: now_datetime,
                PortalIssuesTable.modified_time.name: now_datetime,
                PortalIssuesTable.deleted.name: False,
                PortalIssuesTable.due_date.name: due_date,
            }
            res = seadb_api.insert_rows(project_uuid, TABLE_PORTAL_ISSUES, [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            portal_issue_pk = pks[0]
            row.update({'_pk': portal_issue_pk})

            if file_urls:
                try:
                    new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'portal_issue', int(portal_issue_pk))
                    updated_content = replace_file_url_in_content(content, new_file_urls_dict)
                    if updated_content != content:
                        seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, [{
                            'pk': int(portal_issue_pk),
                            'row': {
                                PortalIssuesTable.content.name: updated_content,
                            }
                        }])
                        row[PortalIssuesTable.content.name] = updated_content
                except Exception as e:
                    logger.error(e)
                    try:
                        seadb_api.delete_rows(project_uuid, TABLE_PORTAL_ISSUES, [int(portal_issue_pk)])
                    except Exception as e:
                        logger.error(e)
                    error_msg = 'Upload files failed.'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'portal_issue': row}, status=status.HTTP_201_CREATED)

    @require_org_context
    def delete(self, request, project_uuid):
        issue_ids = request.data.get('issue_ids')
        if not issue_ids:
            error_msg = 'issue_ids is required.'
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
            issues = get_portal_issues(seadb_api, project_uuid, issue_ids)
            exist_issue_ids = [issue.get('_pk') for issue in issues]
            fail_issue_ids = []
            for issue_id in issue_ids:
                if int(issue_id) not in exist_issue_ids:
                    fail_issue_ids.append(issue_id)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
        need_delete_issue_ids = list(set(issue_ids) - set(fail_issue_ids))
        update_rows = []
        for issue_id in need_delete_issue_ids:
            update_row = {
                'pk': int(issue_id),
                'row': {
                    'deleted': True,
                    'modified_time': now_datetime,
                }
            }
            update_rows.append(update_row)

        if update_rows:
            try:
                seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, update_rows)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'success': need_delete_issue_ids,
            'failed': fail_issue_ids
        })


class PortalMyIssuesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission,)
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

        portal_issue_state = view_id
        if portal_issue_state not in ['open', 'closed']:
            portal_issue_state = 'open'

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

        username = request.user.username
        seadb_api = SeaDBAPI()

        basic_filters = view_config.get('basic_filters', [])
        basic_filters.append({
            'column_name': 'creator',
            'filter_predicate': 'is',
            'filter_term': username,
        })
        view_config['basic_filters'] = basic_filters

        try:
            issues, columns = list_my_portal_issues(seadb_api, project_uuid, username, portal_issue_state, start, limit, view_config)
        except SQLGeneratorOptionInvalidError as e:
            logger.error(e)
            error_msg = _('There are errors with the filters. Please correct them.')
            return Response({
                'issues': [],
                'columns': getattr(e, 'columns', []),
                'error_msg': error_msg,
            })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'issues': issues,
            'columns': columns,
        })


class PortalIssueView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid, issue_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            seadb_api = SeaDBAPI()
            issue, metadata = get_portal_issue(seadb_api, project_uuid, issue_id)
            if not issue:
                error_msg = 'Issue not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            start = 0
            end = 25
            issue_comments = get_portal_issue_comments(seadb_api, project_uuid, issue_id, start, end)

            for issue_comment in issue_comments:
                result = {
                    'id': issue_comment.get('_pk'),
                    'number': issue_comment.get('_pk'),
                    'content': issue_comment.get('content'),
                    'created_time': issue_comment.get('created_time'),
                    'modified_time': issue_comment.get('modified_time'),
                    'creator': issue_comment.get('creator'),
                    'via_agent': bool(issue_comment.get('via_agent')),
                }
                if not issue.get('comments'):
                    issue['comments'] = []
                issue['comments'].append(result)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'issue': issue})


    def put(self, request, project_uuid, issue_id):
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
        # resource check
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = project.workspace

        seadb_api = SeaDBAPI()
        issue, metadata = get_portal_issue(seadb_api, project_uuid, issue_id)
        if not issue:
            error_msg = 'Issue not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_ticket_permission(username, workspace.owner, issue):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        issue_state_name = request.data.get('state')

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

        if assignees:
            for assignee in assignees:
                if not check_project_permission(assignee, workspace.owner):
                    error_msg = 'assignees invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'portal_issue', int(issue.get('_pk')))
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            update_row = {}
            if title:
                update_row[PortalIssuesTable.title.name] = title
            if content:
                update_row[PortalIssuesTable.content.name] = content
            if is_update_type:
                update_row[PortalIssuesTable.type.name] = type_name
            if is_update_substate:
                update_row[PortalIssuesTable.substate.name] = substate_option_name
            if is_update_tags:
                update_row[PortalIssuesTable.tags.name] = tags
            if is_update_priority:
                update_row[PortalIssuesTable.priority.name] = priority
            if is_update_assignees:
                update_row[PortalIssuesTable.assignees.name] = assignees
            if is_update_due_date:
                update_row[PortalIssuesTable.due_date.name] = due_date or ''
            
            participants = issue.get('participants') or []
            if username not in participants:
                participants.append(username)
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            if issue_state_name or issue_state_name == '':
                issue_state_name = issue_state_name.lower()
                update_row[PortalIssuesTable.state.name] = issue_state_name
                if issue_state_name == 'closed':
                    update_row[PortalIssuesTable.closed_time.name] = now_datetime
                elif issue_state_name == 'open':
                    update_row[PortalIssuesTable.closed_time.name] = ''

            update_row[PortalIssuesTable.participants.name] = participants
            update_row[PortalIssuesTable.modified_time.name] = now_datetime
            update_rows = [
                {
                    'pk': issue.get('_pk'),
                    'row': update_row
                }
            ]
            seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, update_rows)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    @require_org_context
    def delete(self, request, project_uuid, issue_id):
        """
        Soft delete a portal issue.
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
            issue, metadata = get_portal_issue(seadb_api, project_uuid, issue_id)
            if not issue:
                error_msg = 'Issue not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            update_row = {
                'pk': issue.get('_pk'),
                'row': {
                    'deleted': True,
                    'modified_time': datetime.datetime.now(datetime.UTC).isoformat(),
                }
            }
            seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, [update_row])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class PortalIssueCommentsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission | PortalKnowledgeBasePermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid, issue_id):
        # argument check
        try:
            current_page = int(request.GET.get('page', '2'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 2
            per_page = 25

        start = (current_page - 1) * per_page
        end = start + per_page

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        try:
            seadb_api = SeaDBAPI()
            portal_issue, metadata = get_portal_issue(seadb_api, project_uuid, issue_id)
            if not portal_issue:
                error_msg = 'Issue not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            comments = get_portal_issue_comments(seadb_api, project_uuid, issue_id, start, end)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'comments': comments})

    def post(self, request, project_uuid, issue_id):
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

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        try:
            seadb_api = SeaDBAPI()
            issue, metadata = get_portal_issue(seadb_api, project_uuid, issue_id)
            if not issue:
                return api_error(status.HTTP_404_NOT_FOUND, 'Issue not found.')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        if not check_ticket_comment_creation_interval(seadb_api, project_uuid, username, issue.get('_pk')):
            error_msg = 'Cannot be created again within 30 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'portal_issue', int(issue.get('_pk')))
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # main
        try:
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            row = {
                PortalIssueCommentsTable.issue_id.name: issue.get('_pk'),
                PortalIssueCommentsTable.creator.name: username,
                PortalIssueCommentsTable.content.name: content,
                PortalIssueCommentsTable.created_time.name: now_datetime,
                PortalIssueCommentsTable.modified_time.name: now_datetime,
                PortalIssueCommentsTable.deleted.name: False,
            }
            res = seadb_api.insert_rows(project_uuid, TABLE_PORTAL_ISSUE_COMMENTS, [row])
            pks = res.get('pks', [])
            if len(pks) != 1:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            pk = pks[0]
            row.update({'number': pk, 'via_agent': False})
            issue_comments_count = seadb_api.query_rows(project_uuid, f"SELECT COUNT(*) as count FROM `{TABLE_PORTAL_ISSUE_COMMENTS}` WHERE `issue_id` = {issue.get('_pk')} AND `deleted` = False").get('results')[0].get('count')
            update_issue = {
                'pk': issue.get('_pk'),
                'row': {
                    'comment_count': issue_comments_count,
                    'modified_time': now_datetime,
                    },
                }
            participants = issue.get('participants') or []
            if username not in participants:
                participants.append(username)
            update_issue['row']['participants'] = participants
            seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, [update_issue])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'comment': row}, status=status.HTTP_201_CREATED)


class PortalIssueCommentView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission | PortalKnowledgeBasePermission,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, project_uuid, issue_id, comment_id):
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
            issue, metadata = get_portal_issue(seadb_api, project_uuid, issue_id)
            if not issue:
                error_msg = 'Issue not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            issue_comment_data = get_portal_issue_comment_by_pk(seadb_api, project_uuid, issue.get('_pk'), comment_id)
            if not issue_comment_data:
                error_msg = 'Comment not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            
            # permission check
            if not check_comment_permission(username, workspace.owner, issue_comment_data):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        
        modified_time = issue_comment_data.get('modified_time')
        if modified_time:
            modified_time = datetime.datetime.fromisoformat(modified_time)
        if modified_time and modified_time > timezone.now() - relativedelta(seconds=10):
            error_msg = 'Cannot be updated again within 10 seconds.'
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

         # upload files
        if file_urls:
            try:
                new_file_urls_dict = upload_files_to_s3(project_uuid, file_urls, username, 'portal_issue', int(issue.get('_pk')))
                content = replace_file_url_in_content(content, new_file_urls_dict)
            except Exception as e:
                logger.error(e)
                error_msg = 'Upload files failed.'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        # main
        try:
            issue_comment_update = {
                'pk': issue_comment_data.get('_pk'),
                'row': {
                    'content': content,
                    'modified_time': datetime.datetime.now(datetime.UTC).isoformat(),
                },
            }
            seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUE_COMMENTS, [issue_comment_update])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            update_row = {
                'modified_time': issue_comment_data.get('modified_time'),
            }
            participants = issue.get('participants') or []
            if username not in participants:
                participants.append(username)
                update_row['participants'] = participants
            issue_update = {
                'pk': issue.get('_pk'),
                'row': update_row,
            }
            seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, [issue_update])
        except Exception as e:
            logger.error(e)

        return Response({'comment': issue_comment_data})

    def delete(self, request, project_uuid, issue_id, comment_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        workspace = project.workspace
        username = request.user.username
        try:
            seadb_api = SeaDBAPI()
            issue, metadata = get_portal_issue(seadb_api, project_uuid, issue_id)
            if not issue:
                error_msg = 'Issue not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            issue_comment_data = get_portal_issue_comment_by_pk(seadb_api, project_uuid, issue_id, comment_id)
            if not issue_comment_data:
                error_msg = 'Comment not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # permission check
        if not check_comment_permission(username, workspace.owner, issue_comment_data):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
            update_issue_comment = {
                'pk': issue_comment_data.get('_pk'),
                'row': {
                    'deleted': True,
                    'delete_time': now_datetime,
                },
            }
            seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUE_COMMENTS, [update_issue_comment])

            update_issue = {
                'pk': issue.get('_pk'),
                'row': {
                    'modified_time': now_datetime,
                }
            }

            participants = issue.get('participants') or []
            if username not in participants:
                participants.append(username)
                update_issue['row']['participants'] = participants
            seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, [update_issue])
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class PortalTagsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission | PortalKnowledgeBasePermission,)
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

        try:
            seadb_api = SeaDBAPI()
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
    permission_classes = (PortalKnowledgeBasePermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        try:
            project = request.project
            project_settings = json.loads(project.settings) if project.settings else {}
            portal_settings = project_settings.get('portal', {})
            show_kb = bool(portal_settings.get('show_knowledge_base', False))
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
    permission_classes = (PortalKnowledgeBasePermission,)
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
            show_kb = bool(portal_settings.get('show_knowledge_base', False))
        except Exception:
            show_kb = False
        if not show_kb:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username if request.user.is_authenticated else ''
        try:
            seadb_api = SeaDBAPI()
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


class PortalKnowledgeBaseRecordView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalKnowledgeBasePermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid, knowledge_id):
        try:
            project = request.project
            project_settings = json.loads(project.settings) if project.settings else {}
            portal_settings = project_settings.get('portal', {})
            show_kb = bool(portal_settings.get('show_knowledge_base', False))
        except Exception:
            show_kb = False
        if not show_kb:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = getattr(request.user, 'username', '')
        try:
            seadb_api = SeaDBAPI()
            record, columns = get_knowledge_base_record_by_pk(seadb_api, project_uuid, knowledge_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not record:
            error_msg = 'Knowledge base record not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return Response({'record': record})


class PortalUserListView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission | PortalKnowledgeBasePermission,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid):
        user_id_list = request.data.get('user_id_list')
        if not isinstance(user_id_list, list):
            error_msg = 'user_id_list invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_authenticated = bool(getattr(request.user, 'is_authenticated', False))

        ext_username = request.session.get('portal_external_username')
        ext_project_uuid = request.session.get('portal_external_project_uuid')
        is_external = False
        if ext_username and ext_project_uuid == project_uuid:
            is_external = ProjectExternalUser.objects.filter(
                project_uuid=project_uuid, username=ext_username, activated=True
            ).exists()

        if not is_authenticated and not is_external:
            return Response({'user_list': []})

        user_list = []
        for user_id in user_id_list:
            if not isinstance(user_id, str):
                continue
            user_info = get_user_common_info(user_id, include_contact_email=False)
            user_list.append(user_info)

        return Response({'user_list': user_list})

class PortalIssueMetadataView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalIssuePermission | PortalKnowledgeBasePermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        seadb_api = SeaDBAPI()
        try:
            base_metadata = seadb_api.get_base_metadata(project_uuid)
            portal_issue_meta = get_current_table_metadata(base_metadata.get('tables'), TABLE_PORTAL_ISSUES)
            protal_issue_column_name_to_return_name = {
                PortalIssuesTable.substate.name: 'substates',
                PortalIssuesTable.type.name: 'types',
                PortalIssuesTable.state.name: 'states'
            }
            select_option_metadata = {}
            for column in portal_issue_meta.get('columns'):
                column_name = column.get('name')
                return_name = protal_issue_column_name_to_return_name.get(column_name)
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
        show_knowledge_base = bool(portal_settings.get('show_knowledge_base', False))

        chat_allowed_sources = portal_settings.get('chat_allowed_sources')
        if not isinstance(chat_allowed_sources, dict):
            chat_allowed_sources = {
                'connection_ids': [],
                'extra_sources': [],
            }

        return Response({
            'allow_anonymous': allow_anonymous,
            'enable_password_protection': enable_password_protection,
            'show_knowledge_base': show_knowledge_base,
            'chat_allowed_sources': chat_allowed_sources,
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
        show_knowledge_base = request.data.get('show_knowledge_base', None)

        try:
            allow_anonymous = int(allow_anonymous)
            enable_password_protection = int(enable_password_protection)
            if show_knowledge_base is not None:
                show_knowledge_base = int(show_knowledge_base)
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
        if show_knowledge_base is not None:
            portal_settings['show_knowledge_base'] = bool(show_knowledge_base)

        chat_allowed_sources = request.data.get('chat_allowed_sources')
        if chat_allowed_sources is not None:
            if not isinstance(chat_allowed_sources, dict):
                error_msg = 'chat_allowed_sources invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            portal_settings['chat_allowed_sources'] = chat_allowed_sources

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


class PortalExternalInvitationsView(APIView):
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
            invites = PortalExternalInvitation.objects.list_invites_by_project_uuid(project_uuid)
            data = []
            for iv in invites:
                data.append({
                    'token': iv.token,
                    'link': iv.link,
                    'expire_time': datetime_to_isoformat_timestr(iv.expire_time),
                    'email': iv.email,
                    'inviter': iv.inviter,
                    'accepted_at': iv.accepted_at,
                    'created_at': iv.created_at,
                })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'invite_list': data})

    @require_org_context
    def post(self, request, project_uuid):
        email = request.data.get('email')
        if not email:
            error_msg = 'Email not provided.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not is_valid_email(email):
            return api_error(status.HTTP_400_BAD_REQUEST, 'email invalid.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_admin_permission(username, project.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not IS_EMAIL_CONFIGURED:
            error_msg = _('Failed to send email, email service is not properly configured, please contact administrator.')
            return api_error(status.HTTP_503_SERVICE_UNAVAILABLE, error_msg)

        try:
            invitation = PortalExternalInvitation.objects.add(inviter=username, email=email, project_uuid=str(project.uuid))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        context = {
            'token': invitation.token,
            'inviter_name': email2nickname(username),
            'project_uuid': str(project.uuid),
        }
        sent = False
        try:
            sent = send_html_email_with_dj_template(email, _('Support Portal Invitation'), 'portal/external_invitation_email.html', context=context)
        except Exception as e:
            logger.error(e)
            sent = False
        if not sent:
            try:
                invitation.delete()
            except Exception as e:
                logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            if not ProjectExternalUser.objects.filter(email=email, project_uuid=str(project.uuid)).exists():
                ProjectExternalUser.objects.create(email=email, username=gen_user_virtual_id(), project_uuid=str(project.uuid), activated=False)
        except Exception as e:
            logger.error(e)

        return Response({'success': True})

    @require_org_context
    def delete(self, request, project_uuid, token):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_project_admin_permission(username, project.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        try:
            invitation = PortalExternalInvitation.objects.get_by_token(token)
            if not invitation or invitation.project_uuid != str(project.uuid):
                return api_error(status.HTTP_404_NOT_FOUND, 'Invitation not found.')
            invitation.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'success': True})


class PortalExternalUsersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    @require_org_context
    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
        if not check_project_admin_permission(request.user.username, project.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        try:
            items = ProjectExternalUser.objects.list_ext_users_by_project_uuid(project_uuid)
            users = []
            for it in items:
                users.append({
                    'email': it.email,
                    'activated': bool(getattr(it, 'activated', False)),
                })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'users': users})

    @require_org_context
    def delete(self, request, project_uuid):
        email = request.data.get('email')
        if not email:
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_project_admin_permission(request.user.username, project.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            ProjectExternalUser.objects.filter(project_uuid=project_uuid, email=email).delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})


class PortalExternalLoginSendCodeView(APIView):
    authentication_classes = (SessionAuthentication,)
    permission_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid):
        email = request.data.get('email')
        if not is_valid_email(email):
            return api_error(status.HTTP_400_BAD_REQUEST, 'email invalid.')

        if not ProjectExternalUser.objects.filter(email=email, project_uuid=project_uuid).exists():
            err_resp = {'error_msg': 'External user not found', 'detail': _('External user not found. Please use the invitation link first.')}
            return Response(err_resp, status=status.HTTP_404_NOT_FOUND)

        try:
            code = get_random_code()
            cache_key = f"portal_email_login:{project_uuid}:{email}"
            cache.set(cache_key, code, 600)
            send_html_email_with_dj_template(email, _('Your login code'), 'portal/email_login_code.html', context={'code': code, 'project_uuid': project_uuid})
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'success': True})


class PortalExternalLoginVerifyCodeView(APIView):
    authentication_classes = (SessionAuthentication,)
    permission_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid):
        email = request.data.get('email')
        code = request.data.get('code')
        if not email or not code:
            return api_error(status.HTTP_400_BAD_REQUEST, 'param invalid.')
        cache_key = f"portal_email_login:{project_uuid}:{email}"
        cached = cache.get(cache_key)
        if cached != code:
            return api_error(status.HTTP_400_BAD_REQUEST, 'code invalid.')
        cache.delete(cache_key)

        try:
            ext_user = ProjectExternalUser.objects.get(email=email, project_uuid=project_uuid)
            if not ext_user.activated:
                ext_user.activated = True
                ext_user.save(update_fields=['activated'])
        except ProjectExternalUser.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'External user record not found. Please use the invitation link first.')

        # Set session to log the user in as an external collaborator
        request.session['portal_external_username'] = ext_user.username
        request.session['portal_external_project_uuid'] = project_uuid
        return Response({'success': True})


class PortalIssueViewsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')
        workspace = project.workspace

        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            views = PortalIssueViews.objects.list_views(project_uuid)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(views)

    def post(self, request, project_uuid):
        view_name = request.data.get('name')
        view_type = request.data.get('type', 'table')
        view_data = request.data.get('data', {})

        if not view_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'view name is invalid.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        # permission check
        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        record = PortalIssueViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            new_view = PortalIssueViews.objects.add_view(project_uuid, view_name, view_type, view_data)
            if not new_view:
                return api_error(status.HTTP_400_BAD_REQUEST, 'add view failed')
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'view': new_view}, status=status.HTTP_201_CREATED)


class PortalIssueViewView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid, view_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        workspace = project.workspace
        # permission check
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        record = PortalIssueViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            view = PortalIssueViews.objects.get_view(project_uuid, view_id)
            if not view:
                return api_error(status.HTTP_404_NOT_FOUND, 'View not found.')
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'view': view})

    def put(self, request, project_uuid, view_id):
        view_data = request.data.get('view_data', None)
        if not view_data:
            error_msg = 'view_data is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        username = request.user.username
        if not check_project_permission(username, project.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            PortalIssueViews.objects.update_view(project_uuid, view_id, view_data)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

    def delete(self, request, project_uuid, view_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        workspace = project.workspace
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            
        record = PortalIssueViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check view exist
        if view_id not in record.views_ids:
            error_msg = f'view_id {view_id} does not exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            PortalIssueViews.objects.delete_view(project_uuid, view_id)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class PortalIssueViewsMoveView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, project_uuid):
        source_view_id = request.data.get('source_view_id')
        target_view_id = request.data.get('target_view_id')

        if not source_view_id or not target_view_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid parameters.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            return api_error(status.HTTP_404_NOT_FOUND, 'Project not found.')

        workspace = project.workspace
        username = request.user.username
        if not check_project_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        record = PortalIssueViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # check dragged view exist
        if source_view_id and source_view_id not in record.views_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'source_view_id {source_view_id} does not exists.')

        # check target view exist
        if target_view_id and target_view_id not in record.views_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, f'target_view_id {target_view_id} does not exists.')

        try:
            results = PortalIssueViews.objects.move_view(project_uuid, source_view_id, target_view_id)
            if not results:
                return api_error(status.HTTP_400_BAD_REQUEST, 'move view failed')
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class PortalIssueViewsDuplicateView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)
    def post(self, request, project_uuid):
        view_id = request.data.get('view_id')
        if not view_id:
            error_msg = 'view_id invalid'
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

        record = PortalIssueViews.objects.get_record(project_uuid)
        if not record:
            error_msg = 'The views does not exists.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        if view_id not in record.views_ids:
            error_msg = 'view_id %s does not exists.' % view_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            new_view = PortalIssueViews.objects.duplicate_view(view_id, record)
            if not new_view:
                return api_error(status.HTTP_400_BAD_REQUEST, 'duplicate view failed')
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'view': new_view})


class PortalIssueTrashAPIView(APIView):
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
            issues, columns = list_trash_portal_issues(seadb_api, project_uuid, start, limit)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        ticket_pk_to_ticket_title = build_linked_ticket_titles_map(seadb_api, project_uuid, issues, columns, 'linked_ticket')
        return Response({
            'issues': issues,
            'columns': columns,
            'ticket_pk_to_ticket_title': ticket_pk_to_ticket_title,
        })

    @require_org_context
    def put(self, request, project_uuid):
        issue_ids = request.data.get('issue_ids')
        if not issue_ids:
            error_msg = 'issue_ids is required.'
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
        for issue_id in issue_ids:
            updated_row = {
                PortalIssuesTable.modified_time.name: now_datetime,
                PortalIssuesTable.deleted.name: False,
            }
            update_rows.append({
                'pk': int(issue_id),
                'row': updated_row,
            })

        if update_rows:
            try:
                seadb_api.update_rows(project_uuid, TABLE_PORTAL_ISSUES, update_rows)
            except Exception as e:
                logger.exception(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

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
            sql = f"SELECT _pk, `linked_ticket` FROM `{TABLE_PORTAL_ISSUES}` WHERE `deleted` = True"
            res = seadb_api.query_rows(project_uuid, sql)
            deleted_issues = res.get('results', [])
            need_delete_ids = [row.get('_pk') for row in deleted_issues]
            if not need_delete_ids:
                return Response({'success': True}, status=status.HTTP_200_OK)

            for issue_id in need_delete_ids:
                delete_record_attachments_from_s3(project_uuid, 'portal_issue', int(issue_id))
            # Remove portal_{issue_id} from linked tickets' linked_connection_records
            linked_ticket_ids = set()
            issue_id_to_ticket_id = {}
            for issue in deleted_issues:
                linked_ticket = issue.get('linked_ticket')
                if linked_ticket:
                    ticket_id = int(linked_ticket)
                    linked_ticket_ids.add(ticket_id)
                    issue_id_to_ticket_id[int(issue.get('_pk'))] = ticket_id

            if linked_ticket_ids:
                tickets = get_tickets_by_ids(seadb_api, project_uuid, list(linked_ticket_ids))
                ticket_rows = []
                for ticket in tickets:
                    ticket_rows.append({
                        '_pk': ticket.get('_pk'),
                        'linked_connection_records': ticket.get('linked_connection_records') or [],
                    })

                now_datetime = datetime.datetime.now(datetime.UTC).isoformat()
                ticket_update_rows = []
                for ticket in ticket_rows:
                    ticket_pk = int(ticket.get('_pk'))
                    linked_records = ticket.get('linked_connection_records') or []
                    if not isinstance(linked_records, list):
                        linked_records = []

                    # Find and remove portal_{issue_id} entries for issues being deleted
                    portal_keys_to_remove = {f'portal_{issue_id}' for issue_id in need_delete_ids}
                    new_linked_records = [r for r in linked_records if r not in portal_keys_to_remove]

                    if len(new_linked_records) != len(linked_records):
                        ticket_update_rows.append({
                            'pk': ticket_pk,
                            'row': {
                                'linked_connection_records': new_linked_records,
                                'modified_time': now_datetime,
                            }
                        })

                if ticket_update_rows:
                    seadb_api.update_rows(project_uuid, TABLE_TICKETS, ticket_update_rows)

            # Delete portal issue comments
            for issue_id in need_delete_ids:
                comment_sql = f"DELETE FROM `{TABLE_PORTAL_ISSUE_COMMENTS}` WHERE `issue_id` = {int(issue_id)}"
                seadb_api.query_rows(project_uuid, comment_sql)

            # Hard delete portal issues
            seadb_api.delete_rows(project_uuid, TABLE_PORTAL_ISSUES, need_delete_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)

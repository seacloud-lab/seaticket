# -*- coding: utf-8 -*-
import datetime
import logging
import json

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info
from seahub.project.models import Projects
from seahub.project.utils import replace_file_url_in_content, get_current_table_metadata, \
    check_project_admin_permission
from seahub.utils.storage import upload_files_to_s3
from seahub.utils.hasher import AESPasswordHasher
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.view_utils import SQLGeneratorOptionInvalidError
from seahub.seadb_models.models import TicketsTable, TagTable
from seahub.seadb_models.utils import list_my_tickets, list_knowledge_base_records
from seahub.tickets.ticket_utils import check_ticket_creation_interval, TABLE_TICKETS, get_ticket, get_ticket_comments,\
    convert_ticket_select_column_name_to_option_id, build_linked_record_titles_map_for_keys
from seahub.knowledge_base.models import KnowledgeBaseViews
from seahub.utils.decorators import require_org_context
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.portal.permissions import PortalKnowledgeBasePermission, PortalTicketPermission
from seahub.portal.models import ProjectExternalUser
from django.core.cache import cache
from seahub.utils.verify import get_random_code
from seahub.utils.auth import gen_user_virtual_id
from seahub.utils.mail import send_html_email_with_dj_template
from seahub.portal.models import PortalExternalInvitation
from seahub.utils import is_valid_email, IS_EMAIL_CONFIGURED
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.knowledge_base.knowledge_base_utils import get_knowledge_base_record_by_pk


logger = logging.getLogger(__name__)


class PortalTicketsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalTicketPermission,)
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
    permission_classes = (PortalTicketPermission,)
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


class PortalTicketView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalTicketPermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid, ticket_id):
        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            error_msg = 'Project not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = getattr(request.user, 'username', '')
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


class PortalTagsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalTicketPermission | PortalKnowledgeBasePermission,)
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

        username = request.user.username if request.user else 'Anonymous'
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
            seadb_api = SeaDBAPI(username)
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
    permission_classes = (PortalTicketPermission | PortalKnowledgeBasePermission,)
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


class PortalTicketMetadataView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (PortalTicketPermission | PortalKnowledgeBasePermission,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, project_uuid):
        username = request.user.username if request.user else 'Anonymous'
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
        show_knowledge_base = bool(portal_settings.get('show_knowledge_base', False))

        return Response({
            'allow_anonymous': allow_anonymous,
            'enable_password_protection': enable_password_protection,
            'show_knowledge_base': show_knowledge_base,
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
            err_resp = {'error_msg': 'Internal Server Error', 'detail': _('External user not found. Please use the invitation link first.')}
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

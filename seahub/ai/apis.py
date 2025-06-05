# -*- coding: utf-8 -*-
import logging

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.dtable.utils import get_user_admin_dtables, check_dtable_admin_permission
from seahub.settings import DTABLE_WEB_SERVICE_URL
from seahub.utils import SessionAuthentication, get_inner_dtable_server_url, is_org_context
from seahub.api2.authentication import TokenAuthentication, AIAssistantTokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables

from django.http import HttpResponse
from django.shortcuts import render

from seahub.ai.utils import assistant_history, delete_ai_assistant, add_ai_assistant, receipt_recognition, text_information_extraction, update_ai_assistant, \
    get_ai_assistants, is_assistant_admin, get_assistant_tables, add_assistant_table, delete_assistant_table, \
    delete_assistant_member, get_assistant_members, add_assistant_member, add_task_record, \
    check_assistant_admin_permission, add_recognition_record, get_ai_assistant, \
    add_issue_record, check_assistant_permission, tasks_detail, \
    get_candidate_members, update_assistant_tables_index, get_assistant_tables_index, \
    tasks_stats_by_assignee, assignee_future_tasks, assignee_task_details, get_assistant_settings, \
    update_assistant_settings, issue_details, update_row, upload_file, download_img, query_row, check_universal_app_permission, \
    agent, extract_web_page_info, extract_selected_content_info, is_ai_exceed_by_assistant, \
    add_assistant_template_tables, add_qa_record
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.group.utils import is_group_admin_or_owner, get_user_groups, get_user_admin_group_ids, group_id_to_name
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.ai.models import AIAssistantOwner
from seahub.base.accounts import User

from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)


class AIAssistants(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: list all assistants include this user
    permission: None
    caller: all
    """
    def get(self, request):
        username = request.user.username
        group_ids = [g.id for g in get_user_groups(username)]

        owners = ['%s@seafile_group' % group_id for group_id in group_ids]
        owners.append(username)

        try:
            assistants = AIAssistantOwner.objects.get_assistants_by_owners(owners)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistants:
            return Response({'assistants': []}, status.HTTP_200_OK)

        assistants_info = {assistant.assistant_uuid: assistant.owner for assistant in assistants}

        params = {
            'assistant_uuids': list(assistants_info.keys()),
        }

        try:
            resp = get_ai_assistants(params)
            if resp.status_code == 500:
                logger.error('get_ai_assistants error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        admin_group_ids = get_user_admin_group_ids(username)
        admin_group_ids = set(admin_group_ids)

        for item in resp_json['assistants']:
            assistant_uuid = item.get('assistant_uuid')
            owner = assistants_info.get(assistant_uuid, '')
            if '@seafile_group' in owner:
                group_id = owner[:-len('@seafile_group')]
                item['owner_name'] = group_id_to_name(group_id)
            else:
                item['owner_name'] = email2nickname(owner)
            item['is_admin'] = is_assistant_admin(owner, username, admin_group_ids)
            item['owner'] = owner
        resp_json['username'] = username

        return Response(resp_json, resp.status_code)

    """
    function: create an assistant
    permission: need group admin if create a group assistant
    caller: all
    """
    def post(self, request):
        username = request.user.username

        assistant_name = request.data.get('assistant_name')
        assistant_type = request.data.get('assistant_type')
        assistant_avatar = request.data.get('assistant_avatar', None)
        assistant_owner = request.data.get('assistant_owner')
        config = request.data.get('config')

        if not assistant_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_name invalid')
        if not assistant_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_type invalid')

        if assistant_owner == 'me':
            assistant_owner = request.user.username
        else:
            try:
                int(assistant_owner)
            except:
                api_error(status.HTTP_400_BAD_REQUEST, 'assistant_owner invalid')

            group_id = assistant_owner
            # only group owner/admin can manage assistant
            if not is_group_admin_or_owner(group_id, username):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            assistant_owner = '%s@seafile_group' % group_id

        params = {
            'assistant_name': assistant_name,
            'assistant_type': assistant_type,
            'assistant_avatar': assistant_avatar,
            'assistant_owner': assistant_owner,
            'config': config,
        }

        try:
            resp = add_ai_assistant(params)
            if resp.status_code == 500:
                logger.error('add_ai_assistant error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        assistant_uuid = resp_json.get('assistant').get('assistant_uuid')
        try:
            AIAssistantOwner.objects.add(assistant_uuid, assistant_owner)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(resp_json, resp.status_code)


class AIAssistant(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: list an assistant
    permission: assistant user
    caller: assistant user
    """
    def get(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = get_ai_assistant(assistant_uuid)
            if resp.status_code == 500:
                logger.error('get_ai_assistant error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
            return Response(resp_json, resp.status_code)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    """
    function: delete an assistant
    permission: assistant admin
    caller: assistant admin
    """
    def delete(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            return Response({'success': True}, status=status.HTTP_200_OK)

        username = request.user.username
        if not check_assistant_admin_permission(assistant.owner, username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = delete_ai_assistant(assistant_uuid)
            if resp.status_code == 500:
                logger.error('delete_ai_assistant error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        assistant.delete()

        return Response(resp_json, resp.status_code)

    """
    function: update an assistant
    permission: assistant admin
    caller: assistant admin
    """
    def put(self, request, assistant_uuid):
        assistant_name = request.data.get('assistant_name')
        assistant_type = request.data.get('assistant_type')
        assistant_avatar = request.data.get('assistant_avatar')
        assistant_owner = request.data.get('assistant_owner')
        config = request.data.get('config')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_assistant_admin_permission(assistant.owner, username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_owner': assistant_owner,
            'assistant_name': assistant_name,
            'assistant_type': assistant_type,
            'assistant_avatar': assistant_avatar,
            'config': config,
        }

        try:
            resp = update_ai_assistant(assistant_uuid, params)
            if resp.status_code == 500:
                logger.error('update_ai_assistant error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if assistant_owner:
            AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).update(owner=assistant_owner)

        return Response(resp_json, resp.status_code)


class AssistantTable(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: delete an assistant table
    permission: assistant admin
    caller: assistant admin
    """
    def delete(self, request, assistant_uuid):
        dtable_uuid = request.GET.get('dtable_uuid')
        table_id = request.GET.get('table_id')
        type = request.GET.get('type')
        # If duplicate tables exist, the deleted id needs to be specified
        _id = request.GET.get('_id')

        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'table_id': table_id,
            'type': type,
        }

        if _id:
            params['_id'] = _id

        try:
            resp = delete_assistant_table(assistant_uuid, params)
            if resp.status_code == 500:
                logger.error('delete assistant table error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantTables(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: list all assistant tables for this assistant
    permission: assistant user
    caller: assistant user
    """
    def get(self, request, assistant_uuid):
        type = request.GET.get('type')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'type': type,
        }

        try:
            resp = get_assistant_tables(assistant_uuid, params)
            if resp.status_code == 500:
                logger.error('get assistant tables error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        owner_info_map = {}
        assistant_tables = resp_json.get('assistant_tables', [])
        tables = []
        for table in assistant_tables:
            dtable_uuid = table.get('dtable_uuid', '')
            owner_info = owner_info_map.get(dtable_uuid, None)
            if not owner_info:
                dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
                if dtable:
                    owner = dtable.workspace.owner
                    if "@seafile_group" in owner:
                        group_id = int(owner.split("@")[0])
                        owner_name = group_id_to_name(group_id)
                    else:
                        owner_name = email2nickname(owner)
                    owner_info = {
                        'owner': owner,
                        'owner_name': owner_name
                    }
                    owner_info_map[dtable_uuid] = owner_info
            if owner_info:
                table['owner'] = owner_info['owner']
                table['owner_name'] = owner_info['owner_name']
                tables.append(table)

        return Response({'tables': tables}, resp.status_code)

    """
    function: add an assistant table for this assistant
    permission: base admin, assistant admin
    caller: assistant admin
    """
    def post(self, request, assistant_uuid):
        dtable_uuid = request.data.get('dtable_uuid')
        table_id = request.data.get('table_id')
        model = request.data.get('model')
        type = request.data.get('type')

        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        if not model:
            return api_error(status.HTTP_400_BAD_REQUEST, 'model invalid')

        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'table_id': table_id,
            'type': type,
            'model': model
        }

        try:
            resp = add_assistant_table(assistant_uuid, params)
            if resp.status_code == 500:
                logger.error('add assistant tables error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantMember(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: delete an assistant member for this assistant
    permission: assistant admin
    caller: assistant admin
    """
    def delete(self, request, assistant_uuid):
        member_username = request.GET.get('member_username')

        if not member_username:
            return api_error(status.HTTP_400_BAD_REQUEST, 'member_username invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'member_username': member_username,
        }

        try:
            resp = delete_assistant_member(assistant_uuid, params)
            if resp.status_code == 500:
                logger.error('delete assistant member error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantMembers(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: list all assistant members for this assistant
    permission: assistant user
    caller: assistant user
    """
    def get(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = get_assistant_members(assistant_uuid)
            if resp.status_code == 500:
                logger.error('get assistant members error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)

    """
    function: add an assistant member for this assistant
    permission: assistant admin
    caller: assistant admin
    """
    def post(self, request, assistant_uuid):
        member_usernames = request.data.get('member_usernames')

        if not member_usernames:
            return api_error(status.HTTP_400_BAD_REQUEST, 'member_usernames invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'member_usernames': member_usernames,
        }

        try:
            resp = add_assistant_member(assistant_uuid, params)
            if resp.status_code == 500:
                logger.error('add assistant member error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AddTaskRecord(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: add an task record row
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        message_id = request.data.get('message_id')
        dtable_uuid = request.data.get('dtable_uuid')
        table_id = request.data.get('table_id')
        assignees = request.data.get('assignees')
        task_name = request.data.get('task_name')
        finish_time = request.data.get('finish_time')
        task_description = request.data.get('task_description')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        if not task_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_name invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'table_id': table_id,
            'assignees': assignees,
            'task_name': task_name,
            'task_description': task_description,
            'finish_time': finish_time,
            'username': request.user.username,
            'assistant_uuid': assistant_uuid,
            'message_id': message_id,
        }

        try:
            resp = add_task_record(params)
            if resp.status_code == 500:
                logger.error('add task record error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class UserAdminBases(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: list all personal bases and admin group bases
    permission: None
    caller: assistant admin
    """
    def get(self, request):

        # resource check
        username = request.user.username
        try:
            user_admin_dtables = get_user_admin_dtables(username)
            dtables = []
            for dtable in user_admin_dtables:
                admin_dtable_uuid = str(dtable.uuid)
                owner = dtable.workspace.owner
                if "@seafile_group" in owner:
                    group_id = int(owner.split("@")[0])
                    owner_name = group_id_to_name(group_id)
                else:
                    owner_name = email2nickname(owner)
                dtables.append({
                    'dtable_uuid': admin_dtable_uuid,
                    'dtable_name': dtable.name,
                    'workspace_id': dtable.workspace_id,
                    'icon': dtable.icon,
                    'color': dtable.color,
                    'owner_name': owner_name,
                    'owner': owner,
                })
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'admin_bases': dtables})


class UserAdminBaseTables(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: list all tables for a base
    permission: base admin
    caller: assistant admin
    """
    def get(self, request, dtable_uuid):

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        try:
            dtable_server_url = get_inner_dtable_server_url()
            dtable_server_api = DTableServerAPI(username, dtable_uuid, dtable_server_url)
            metadata = dtable_server_api.get_metadata()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'tables': metadata['tables']})


class AddRecognitionRecord(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: add an record for invoice submission assistant
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        row_data = request.data.get('row_data')
        assistant_uuid = request.data.get('assistant_uuid')

        if not row_data:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_data invalid')
        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')

        username = request.user.username
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'row_data': row_data,
            'assistant_uuid': assistant_uuid,
            'username': username,
        }

        try:
            resp = add_recognition_record(params)
            if resp.status_code == 500:
                logger.error('add recognition record error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AddIssueRecord(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: add an issue record row
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        dtable_uuid = request.data.get('dtable_uuid')
        message_id = request.data.get('message_id')
        table_id = request.data.get('table_id')
        assignees = request.data.get('assignees')
        issue_name = request.data.get('issue_name')
        finish_time = request.data.get('finish_time')
        issue_description = request.data.get('issue_description')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        if not issue_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'issue_name invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'dtable_uuid': dtable_uuid,
            'message_id': message_id,
            'table_id': table_id,
            'assignees': assignees,
            'issue_name': issue_name,
            'issue_description': issue_description,
            'finish_time': finish_time,
            'username': request.user.username,
        }

        try:
            resp = add_issue_record(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class TasksDetail(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: get task detail by row_ids
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        row_ids = request.data.get('row_ids')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not row_ids:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_ids invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'row_ids': row_ids,
        }

        try:
            resp = tasks_detail(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssigneeTasksStats(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: Get someone's tasks status for the past year
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        group_by = request.data.get('group_by')
        assignee_username = request.data.get('assignee_username')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not group_by or group_by not in ['week', 'month']:
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_by invalid. parameter optional value is month or week')
        if not start_date:
            return api_error(status.HTTP_400_BAD_REQUEST, 'start_date invalid')
        if not end_date:
            return api_error(status.HTTP_400_BAD_REQUEST, 'end_date invalid')
        if not assignee_username:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assignee_username invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'group_by': group_by,
            'start_date': start_date,
            'end_date': end_date,
            'assignee_username': assignee_username
        }

        try:
            resp = tasks_stats_by_assignee(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssigneeFutureTasks(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: Get someone's future tasks
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        assignee_username = request.data.get('assignee_username')
        timestamp = request.data.get('timestamp')
        num = request.data.get('num')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not assignee_username:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assignee_username invalid')
        if not timestamp:
            return api_error(status.HTTP_400_BAD_REQUEST, 'timestamp invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'assignee_username': assignee_username,
            'timestamp': timestamp,
        }
        if num is not None:
            params.update(num=num)
        try:
            resp = assignee_future_tasks(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssigneeTasksDetails(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: Get someone's tasks details for the past year
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        assignee_username = request.data.get('assignee_username')
        task_status = request.data.get('task_status')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not start_date:
            return api_error(status.HTTP_400_BAD_REQUEST, 'start_date invalid')
        if not end_date:
            return api_error(status.HTTP_400_BAD_REQUEST, 'end_date invalid')
        if not assignee_username:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assignee_username invalid')
        if not task_status or task_status not in ('all', 'completed', 'incompleted'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'task_status invalid, optional: all、completed、incompleted')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'start_date': start_date,
            'end_date': end_date,
            'assignee_username': assignee_username,
            'task_status': task_status,
        }

        try:
            resp = assignee_task_details(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class ReceiptRecognition(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        url = request.data.get('url')
        assistant_uuid = request.data.get('assistant_uuid')

        if not url:
            return api_error(status.HTTP_400_BAD_REQUEST, 'url invalid')
        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')

        username = request.user.username
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_ai_exceed_by_assistant(assistant):
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Credit not enough')

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'url': url,
            'username': username,
            'org_id': request.user.org.org_id if is_org_context(request) else '',
        }

        try:
            resp = receipt_recognition(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class TextInformationExtraction(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        message = request.data.get('message')
        assistant_uuid = request.data.get('assistant_uuid')

        if not message:
            return api_error(status.HTTP_400_BAD_REQUEST, 'message invalid')
        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')

        username = request.user.username
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_ai_exceed_by_assistant(assistant):
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Credit not enough')

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'message': message,
            'username': username,
            'org_id': request.user.org.org_id if is_org_context(request) else '',
        }

        try:
            resp = text_information_extraction(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class CandidateMembers(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        active_candidate_members = []

        try:
            candidate_members = get_candidate_members(assistant_uuid)
            candidate_members = candidate_members.json()['candidate_members']
            for candidate_member in candidate_members:
                email = candidate_member['email']
                user = User.objects.get(email=email)
                if user.is_active:
                    active_candidate_members.append(candidate_member)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'candidate_members': active_candidate_members})


class AssistantTablesIndex(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: get assistant index by uuid
    permission: assistant admin
    caller: assistant admin
    """
    def get(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = get_assistant_tables_index(assistant_uuid)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)

    """
    function: update assistant index by uuid
    permission: assistant admin
    caller: assistant admin
    """
    def put(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = update_assistant_tables_index(assistant_uuid)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantSettings(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = get_assistant_settings(assistant_uuid)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantSetting(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, assistant_uuid):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = update_assistant_settings(assistant_uuid, request.data)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class IssueDetails(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: get issues details within a time range
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        status = request.data.get('status', 'all')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not start_date:
            return api_error(status.HTTP_400_BAD_REQUEST, 'start_date invalid')
        if not end_date:
            return api_error(status.HTTP_400_BAD_REQUEST, 'end_date invalid')
        if not status or status not in ('all', 'handled'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'status invalid, optional: all、handled')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'start_date': start_date,
            'end_date': end_date,
            'status': status
        }

        try:
            resp = issue_details(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class UploadFile(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, assistant_uuid):
        file = request.FILES.get('file')
        upload_type = request.data.get('upload_type')

        if not file:
            return api_error(status.HTTP_400_BAD_REQUEST, 'file invalid')
        if not upload_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'upload_type invalid')

        if file.size > 20 * 1024 * 1024:
            return api_error(status.HTTP_400_BAD_REQUEST, 'The uploaded image exceeds the specified size: 20MB')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file = {'file': (file.name, file, file.content_type)} if file else None
        params = {
            'upload_type': upload_type
        }

        try:
            resp = upload_file(assistant_uuid, file, params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantAssetAccess(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, assistant_uuid, path):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        app_uuid = request.GET.get('app_uuid')
        page_id = request.GET.get('page_id')
        if app_uuid and page_id:
            if not check_universal_app_permission(request, assistant_uuid):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        else:
            if not check_assistant_permission(assistant.owner, request):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            resp = download_img(assistant_uuid, path)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return HttpResponse(resp.content, content_type=resp.headers['content-type'], status=resp.status_code)


class Row(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, assistant_uuid):
        dtable_uuid = request.GET.get('dtable_uuid')
        table_id = request.GET.get('table_id')
        row_id = request.GET.get('row_id')

        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        if not row_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_id invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'table_id': table_id,
            'row_id': row_id
        }

        try:
            resp = query_row(assistant_uuid, params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)

    def put(self, request, assistant_uuid):
        dtable_uuid = request.data.get('dtable_uuid')
        table_id = request.data.get('table_id')
        row_id = request.data.get('row_id')
        row_data = request.data.get('row_data')

        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        if not row_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_id invalid')
        if not row_data:
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_data invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'table_id': table_id,
            'row_id': row_id,
            'row_data': row_data,
            'username': request.user.username
        }

        try:
            resp = update_row(assistant_uuid, params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantAssetPreview(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, assistant_uuid, path):
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        app_uuid = request.GET.get('app_uuid')
        page_id = request.GET.get('page_id')
        if app_uuid and page_id:
            if not check_universal_app_permission(request, assistant_uuid):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        else:
            if not check_assistant_permission(assistant.owner, request):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        file_name = path.rstrip('/').rsplit('/')[-1]
        if app_uuid and page_id:
            raw_path = '%s/api/v2.1/ai/asset/%s/%s?app_uuid=%s&page_id=%s' % (DTABLE_WEB_SERVICE_URL.strip('/'), assistant_uuid, path, app_uuid, page_id)
        else:
            raw_path = '%s/api/v2.1/ai/asset/%s/%s' % (DTABLE_WEB_SERVICE_URL.strip('/'), assistant_uuid, path)
        return_dict = {
            'filename': file_name,
            'file_type': 'PDF',
            'file_ext': 'pdf',
            'file_content': '',
            'raw_path': raw_path
        }

        return render(request, 'ai_asset_file_view_react.html', return_dict)


class Agent(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, assistant_uuid):
        lang = request.data.get('lang')
        dtable_uuid = request.data.get('dtable_uuid', '')
        message = request.data.get('message')
        file_url = request.data.get('file_url')

        if not message and not file_url:
            return api_error(status.HTTP_400_BAD_REQUEST, 'message invalid')
        if not lang:
            return api_error(status.HTTP_400_BAD_REQUEST, 'lang invalid')

        username = request.user.username
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_ai_exceed_by_assistant(assistant):
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Credit not enough')

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'lang': lang,
            'dtable_uuid': dtable_uuid,
            'message': message,
            'file_url': file_url,
            'username': username,
            'org_id': request.user.org.org_id if is_org_context(request) else '',
        }

        try:
            resp = agent(assistant_uuid, params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantHistory(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, assistant_uuid):
        username = request.user.username
        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'username': username,
        }

        try:
            resp = assistant_history(assistant_uuid, params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)
    

class ExtractSelectedWebInfo(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: chrome extension/extract web selection info
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        selected_content = request.data.get('selected_content')
        assistant_uuid = request.data.get('assistant_uuid')
        url = request.data.get('url')
        type = request.data.get('type')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not selected_content:
            return api_error(status.HTTP_400_BAD_REQUEST, 'selected_content invalid')
        if not type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'type invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'selected_content': selected_content,
            'url': url,
            'lang': request.LANGUAGE_CODE,
            'org_id': request.user.org.org_id if is_org_context(request) else '',
            'username': request.user.username,
            'type': type,
        }

        try:
            resp = extract_selected_content_info(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class ExtractWholeWebPageInfo(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: chrome extension/extract page info
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        page_html = request.data.get('page_html')
        assistant_uuid = request.data.get('assistant_uuid')
        url = request.data.get('url')
        type = request.data.get('type')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not page_html:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page_html invalid')
        if not type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'type invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        params = {
            'assistant_uuid': assistant_uuid,
            'page_html': page_html,
            'url': url,
            'lang': request.LANGUAGE_CODE,
            'org_id': request.user.org.org_id if is_org_context(request) else '',
            'username': request.user.username,
            'type': type,
        }

        try:
            resp = extract_web_page_info(params)
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AssistantTemplateTables(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, assistant_uuid):
        """
        function: add an assistant template table for this assistant
        permission: base admin, assistant admin
        caller: assistant admin
        """
        dtable_uuid = request.data.get('dtable_uuid')
        lang = request.data.get('lang')

        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        
        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_admin_permission(assistant.owner, username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'lang': lang,
            'username': username,
        }

        try:
            resp = add_assistant_template_tables(assistant_uuid, params)
            if resp.status_code == 500:
                logger.error('add assistant template tables error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)


class AddQARecord(APIView):
    authentication_classes = (AIAssistantTokenAuthentication, TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    """
    function: add a qa record row
    permission: assistant user
    caller: assistant user
    """
    def post(self, request):
        assistant_uuid = request.data.get('assistant_uuid')
        message_id = request.data.get('message_id')
        dtable_uuid = request.data.get('dtable_uuid')
        table_id = request.data.get('table_id')
        question = request.data.get('question')
        answer = request.data.get('answer')

        if not assistant_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'assistant_uuid invalid')
        if not dtable_uuid:
            return api_error(status.HTTP_400_BAD_REQUEST, 'dtable_uuid invalid')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        if not question:
            return api_error(status.HTTP_400_BAD_REQUEST, 'question invalid')

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_assistant_permission(assistant.owner, request):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'table_id': table_id,
            'question': question,
            'answer': answer,
            'username': request.user.username,
            'assistant_uuid': assistant_uuid,
            'message_id': message_id,
        }

        try:
            resp = add_qa_record(params)
            if resp.status_code == 500:
                logger.error('add qa record error status: %s body: %s', resp.status_code, resp.text)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            resp_json = resp.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(resp_json, resp.status_code)

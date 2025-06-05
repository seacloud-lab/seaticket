# -*- coding: utf-8 -*-
import os
import logging
import time
import json
from datetime import datetime, date
from urllib.parse import quote, unquote
import re

import jwt
import requests
from django.conf import settings
from django.db.models import F
from django.http import QueryDict
from django.urls import reverse
from django.utils.translation import gettext as _
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from seaserv import seafile_api, ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import CanUseAdvancedCustomizaiton
from seahub.api2.status import HTTP_443_ABOVE_QUOTA
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.constants import ColumnTypes
from seahub.dtable.message_formatters import fill_message_by_dtable_db
from seahub.dtable.models import Workspaces, DTables, DTableForms, DTableFormShare, DTableFormCustomURLs, IdInOrgTuple
from seahub.dtable.utils import PUBLIC_RELATIVE_PATH, UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH, check_dtable_permission, PUBLIC_FORMS_RELATIVE_PATH, \
    UPLOAD_IMG_RELATIVE_PATH, UPLOAD_FILE_RELATIVE_PATH, ANONYMOUS, LOGIN_USERS, SHARED_GROUPS, \
    check_form_submit_permission, check_quota_by_workspace, check_row_limit_by_workspace, generate_upload_link, \
    is_form_expired, migrate_image
from seahub.dtable.signals import submit_form
from seahub.constants import PERMISSION_READ_WRITE
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.workflow.apis import DTableWorkflowSubmitTaskView
from seahub.settings import DTABLE_WEB_SERVICE_URL, INNER_DTABLE_DB_URL
from seahub.utils import gen_file_upload_url, is_org_context, check_filename_with_rename, is_image_asset_type, \
    get_inner_dtable_server_url
from seahub.group.utils import get_user_groups, group_id_to_name, is_group_member
from seahub.dtable_apps.workflow.models import DTableWorkflows
from seahub.dtable_apps.workflow.utils import get_table_id_from_config
from seahub.dtable.settings import DTABLE_FORM_QUOTA

logger = logging.getLogger(__name__)


class SharedFormsView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """get shared forms
        """
        username = request.user.username

        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        groups = get_user_groups(username, return_ancestors=True)

        group_ids = [group.id for group in groups]
        group_name_map = {group.id: group.group_name for group in groups}

        try:
            shared_queryset = DTableFormShare.objects.list_by_group_ids(group_ids)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        shared_list = list()
        for item in shared_queryset:
            form = item.form
            if form.share_type != SHARED_GROUPS:
                continue
            data = form.to_dict()

            group_id = item.group_id
            data["group_name"] = group_name_map.get(group_id)
            data["group_id"] = group_id

            shared_list.append(data)

        return Response({'shared_list': shared_list}, status=status.HTTP_200_OK)


def _resource_check(workspace_id, table_name):
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        error_msg = 'Workspace %s not found.' % workspace_id
        return None, None, error_msg

    repo_id = workspace.repo_id
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        error_msg = 'Library %s not found.' % repo_id
        return None, None, error_msg

    dtable = DTables.objects.get_dtable(workspace, table_name)
    if not dtable:
        error_msg = 'Base %s not found.' % table_name
        return None, None, error_msg

    return workspace, dtable, None


class DTableFormsView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """get dtable forms
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        username = request.user.username
        # argument check
        workspace_id = request.GET.get('workspace_id')
        table_name = request.GET.get('name')

        # get user forms
        if not workspace_id and not table_name:
            org_id = -1
            if is_org_context(request):
                org_id = request.user.org.org_id

            groups = get_user_groups(username, return_ancestors=True)

            owner_list = list()
            owner_list.append(username)
            for group in groups:
                group_user = '%s@seafile_group' % group.id
                owner_list.append(group_user)

            try:
                # workspaces
                workspace_queryset = Workspaces.objects.filter(owner__in=owner_list)
                workspace_id_map = {workspace.id: workspace for workspace in workspace_queryset}
                workspace_ids = [workspace.id for workspace in workspace_queryset]
                form_queryset = DTableForms.objects.filter(workspace_id__in=workspace_ids)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            # forms
            group_name_map = {group.id: group.group_name for group in groups}
            form_list = list()
            for form in form_queryset:
                data = form.to_dict()

                workspace_id = form.workspace_id
                workspace = workspace_id_map.get(workspace_id)
                if not workspace:
                    continue
                owner = workspace.owner
                if '@seafile_group' in owner:
                    group_id = int(owner.split('@')[0])
                    data["group_name"] = group_name_map.get(group_id)
                    data["group_id"] = group_id

                form_list.append(data)

            return Response({"form_list": form_list}, status=status.HTTP_200_OK)

        # get dtable forms 
        else:
            if not workspace_id:
                error_msg = 'workspace_id invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if not table_name:
                error_msg = 'name invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            # resource check
            workspace, dtable, error_msg = _resource_check(workspace_id, table_name)
            if error_msg:
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            # permission check
            if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            dtable_uuid = dtable.uuid.hex
            try:
                forms = DTableForms.objects.get_forms_by_dtable_uuid(dtable_uuid)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            form_list = [form_obj.to_dict() for form_obj in forms]

            return Response({"form_list": form_list}, status=status.HTTP_200_OK)

    def post(self, request):
        """create a dtable form
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # argument check
        workspace_id = request.POST.get('workspace_id')
        if not workspace_id:
            error_msg = 'workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.POST.get('name')
        if not table_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        form_config = request.POST.get('form_config', None)

        # resource check
        workspace, dtable, error_msg = _resource_check(workspace_id, table_name)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        dtable_uuid = dtable.uuid.hex

        dtable_form_count = DTableForms.objects.get_forms_by_dtable_uuid(dtable_uuid).count()
        if dtable_form_count >= DTABLE_FORM_QUOTA:
            error_msg = _('Number of forms exceeds the %s limit.') % DTABLE_FORM_QUOTA
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        form_obj = DTableForms.objects.get_form_by_form_config(dtable_uuid, form_config)
        if form_obj:
            error_msg = 'Table form %s already exists.' % json.loads(form_config).get('form_name')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            form_obj = DTableForms.objects.add_form_obj(
                username, workspace_id, dtable_uuid, form_config
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        form = form_obj.to_dict()

        return Response({"form": form}, status=status.HTTP_201_CREATED)


class DTableFormView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def delete(self, request, token):
        """ delete a form.
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # resource check
        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            return Response({'success': True}, status=status.HTTP_200_OK)

        # permission check
        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(form_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % form_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            DTableForms.objects.delete_form(token)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)

    def put(self, request, token):
        """update a dtable form config
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # argument check
        form_config = request.POST.get('form_config')

        try:
            form_config_dict = json.loads(form_config)
        except Exception as e:
            logger.error('form_config: %s, invalid error: %s', form_config, e)
            return api_error(status.HTTP_400_BAD_REQUEST, 'form_config invalid.')

        # check deadline
        submit_deadline_option = form_config_dict.get('submit_deadline_option', {})
        is_submit_deadline_show = submit_deadline_option.get('is_submit_deadline_show', False)
        submit_deadline_str = submit_deadline_option.get('submit_deadline')
        if is_submit_deadline_show and submit_deadline_str:
            try:
                datetime.strptime(submit_deadline_str, '%Y-%m-%d %H:%M:%S')
            except Exception as e:
                logger.error('submit_deadline: %s error: %s', submit_deadline_str, e)
                return api_error(status.HTTP_400_BAD_REQUEST, _('Submission deadline invalid'))

        # resource check
        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(form_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % form_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        old_form_config = json.loads(form_obj.form_config)
        trigger_workflow_option = form_config_dict.get('trigger_workflow_option', {})

        can_trigger_workflow = False
        workflow_name = ''
        if not settings.ENABLE_WORKFLOW:
            trigger_workflow_option['can_trigger_workflow'] = False
        else:
            old_table_id = old_form_config.get('table_id')
            new_table_id = form_config_dict.get('table_id', '')

            workflows = list(DTableWorkflows.objects.get_workflows_by_dtable_uuid(form_obj.dtable_uuid))
            if new_table_id != old_table_id:
                trigger_workflow_option['is_trigger_workflow'] = False
            trigger_workflow_option['workflow_token'] = ''
            for workflow in workflows:
                workflow_table_id = get_table_id_from_config(workflow.workflow_config)
                if new_table_id and workflow_table_id and new_table_id == workflow_table_id:
                    workflow_name = json.loads(workflow.workflow_config).get('workflow_name')
                    trigger_workflow_option['workflow_token'] = workflow.token
                    can_trigger_workflow = True
                    break

        form_config_dict['trigger_workflow_option'] = trigger_workflow_option
        form_config = json.dumps(form_config_dict)

        try:
            form_obj.form_config = form_config
            form_obj.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        form = form_obj.to_dict()
        new_form_config = json.loads(form.get('form_config'))
        trigger_workflow_option = new_form_config.get('trigger_workflow_option', {})
        trigger_workflow_option['can_trigger_workflow'] = can_trigger_workflow
        trigger_workflow_option['workflow_name'] = workflow_name
        new_form_config['trigger_workflow_option'] = trigger_workflow_option
        form['form_config'] = json.dumps(new_form_config)

        return Response({"form": form}, status=status.HTTP_200_OK)


class DTableFormShareView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, token):
        """share form to groups
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # argument check
        share_type = request.data.get('share_type')
        if share_type not in (ANONYMOUS, LOGIN_USERS, SHARED_GROUPS) :
            error_msg = 'share_type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if share_type == SHARED_GROUPS:
            group_ids = request.data.get('group_ids')
            try:
                group_ids = [int(group_id) for group_id in group_ids]
                group_ids = list(set(group_ids))
            except Exception as e:
                error_msg = 'group_ids invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(form_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % form_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        last_share_type = form_obj.share_type
        try:
            if share_type != last_share_type:
                form_obj.share_type = share_type
                form_obj.save(update_fields=['share_type'])

            if share_type != SHARED_GROUPS and last_share_type == SHARED_GROUPS:
                DTableFormShare.objects.filter(form=form_obj).delete()

            if share_type == SHARED_GROUPS:
                exists_group_ids = DTableFormShare.objects.list_by_form(form_obj)
                delete_list = [group_id for group_id in exists_group_ids if group_id not in group_ids]
                add_list = [group_id for group_id in group_ids if group_id not in exists_group_ids]
                if delete_list:
                    DTableFormShare.objects.filter(form=form_obj, group_id__in=delete_list).delete()
                for group_id in add_list:
                    if not is_group_member(group_id, username):
                        error_msg = 'Group %d permission denied.' % group_id
                        return api_error(status.HTTP_403_FORBIDDEN, error_msg)
                    DTableFormShare.objects.share_by_group_id(form_obj, group_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True}, status=status.HTTP_200_OK)


class DTableFormSubmitView(APIView):

    throttle_classes = (UserRateThrottle, )

    def post(self, request, token):
        """Submit a form
        """
        # argument check
        row_data = request.POST.get("row_data", None)
        if not row_data:
            error_msg = 'row_data invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_id = request.POST.get("table_id", None)
        if not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        form_config = json.loads(form_obj.form_config)
        config_table_id = form_config.get('table_id')
        if table_id != config_table_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # deadline check
        if is_form_expired(form_obj):
            return api_error(status.HTTP_404_NOT_FOUND, 'Form %s not found.' % token)

        workspace_id = form_obj.workspace_id
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = form_obj.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_form_submit_permission(request, form_obj):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # quota check
        if not check_quota_by_workspace(workspace):
            error_msg = 'Asset quota exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)
        # rows check
        if not check_row_limit_by_workspace(workspace):
            error_msg = 'Rows exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        username = request.user.username if request.user.is_authenticated else 'anonymous'
        dtable_server_api = DTableServerAPI(username, str(dtable.uuid), get_inner_dtable_server_url())
        try:
            metadata = dtable_server_api.get_metadata()
            tables = metadata['tables']
            table = None
            for tmp_table in tables:
                if tmp_table['_id'] == table_id:
                    table = tmp_table
                    break
            if not table:
                return api_error(status.HTTP_404_NOT_FOUND, 'Form table not found')
            columns = table['columns']
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # migrate image files from assets/xxx/forms/xxx to assets/xxx/images/xxx
        row_data_dict = json.loads(row_data)
        form_column_keys = [col['key'] for col in form_config['columns']]
        image_col_names, long_text_col_names, digital_sign_col_names = [], [], []
        for col in columns:
            if col['key'] in form_column_keys and col['type'] == 'image':
                image_col_names.append(col['name'])
            elif col['key'] in form_column_keys and col['type'] == 'long-text':
                long_text_col_names.append(col['name'])
            elif col['key'] in form_column_keys and col['type'] == 'digital-sign':
                digital_sign_col_names.append(col['name'])

        for name in image_col_names:
            image_links = row_data_dict.get(name)
            if not image_links:
                continue
            new_links = []
            for link in image_links:
                try:
                    new_link = migrate_image(link, dtable, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH)
                except Exception as e:
                    logger.error('migrate image: %s from: %s to: %s error: %s', link, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH, e)
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
                if not new_link:
                    new_link = link
                new_links.append(new_link)
            row_data_dict[name] = new_links

        for name in long_text_col_names:
            long_text_value = row_data_dict.get(name, {})
            long_text_images = long_text_value.get('images', [])
            if (len(long_text_images) == 0):
                row_data_dict[name] = long_text_value
            else:
                long_text_text = long_text_value.get('text', '')
                new_long_text_images = []
                for long_text_image in long_text_images:
                    try:
                        new_link = migrate_image(long_text_image, dtable, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH)
                    except Exception as e:
                        logger.error('migrate image: %s from: %s to: %s error: %s', long_text_image, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH, e)
                        return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
                    if not new_link:
                        new_link = long_text_image
                    new_long_text_images.append(new_link)
                    long_text_text = long_text_text.replace(long_text_image.strip(), new_link)
                long_text_value['text'] = long_text_text
                long_text_value['images'] = new_long_text_images
                row_data_dict[name] = long_text_value

        for name in digital_sign_col_names:
            digital_sign_dict = row_data_dict.get(name)
            if not digital_sign_dict or not isinstance(digital_sign_dict, dict) or not digital_sign_dict.get('sign_image_url'):
                continue
            sign_image_url = digital_sign_dict.get('sign_image_url').strip('/')
            domain_sign_image_url = '%s/%s' % (DTABLE_WEB_SERVICE_URL.rstrip('/'), reverse('dtable:dtable_asset_access', args=(workspace_id, str(dtable.uuid), unquote(sign_image_url))).strip('/'))
            try:
                new_link = migrate_image(domain_sign_image_url, dtable, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH)
            except Exception as e:
                logger.error('migrate image: %s from: %s to: %s error: %s', domain_sign_image_url, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH, e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            if not new_link:
                new_link = sign_image_url
            else:
                new_link = new_link[new_link.find('/digital-signs'):]
            digital_sign_dict['sign_image_url'] = new_link
            row_data_dict[name] = digital_sign_dict

        # insert row
        # dtable_server_url = get_inner_dtable_server_url()
        # url = '%s/api/v1/dtables/%s/rows/?from=dtable_web' % \
        #       (dtable_server_url.rstrip('/'), str(dtable.uuid))

        # operation = {
        #     "table_name": table['name'],
        #     "row": row_data_dict,
        #     "apply_default": True
        # }

        try:
            # req = requests.post(url, json=operation, headers=headers)
            # if req.status_code == 429:
            #     error_msg = _('Too many users use the form. Please try again later.')
            #     return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

            # req_dict = json.loads(req.content)
            resp_dict = dtable_server_api.append_row(table['name'], row_data_dict, apply_default=True)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # handle link data
        row_id = resp_dict.get('_id', '')
        link_data = request.POST.get("link_data", None)
        if link_data:
            # url = '%s/api/v1/dtables/%s/batch-update-links/?from=dtable_web' % \
            #       (dtable_server_url.rstrip('/'), str(dtable.uuid))
            link_data_dict = json.loads(link_data)
            for key, value in link_data_dict.items():
                column_data = value['column']['data']
                if column_data['table_id'] == table_id:
                    other_table_id = column_data['other_table_id']
                else:
                    other_table_id = column_data['table_id']
                # link_dict = {
                #     "link_id": column_data['link_id'],
                #     "table_id": table_id,
                #     "other_table_id": other_table_id,
                #     "row_id_list": [row_id, ],
                #     "other_rows_ids_map": {
                #         row_id: value['other_rows_ids']
                #     }
                # }
                try:
                    other_rows_ids_map = {row_id: value['other_rows_ids']}
                    dtable_server_api.batch_update_links(column_data['link_id'], table_id, other_table_id, [row_id], other_rows_ids_map)
                except Exception as e:
                    logger.exception(e)
                    error_msg = 'Internal Server Error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            DTableForms.objects.filter(token=token).update(submit_count=F('submit_count')+1)
        except Exception as e:
            logger.error('form: %s update submit count error: %s', token, e)

        notification_config = form_config.get('notification_config', {})

        if notification_config and notification_config.get('is_send_notification', False):
            for user in notification_config.get('notification_selected_users', []):
                try:
                    submit_form.send(sender=None,
                                     dtable_id=dtable.id,
                                     table_id=table_id,
                                     form_name=form_config.get('form_name', ''),
                                     submit_user=request.user.username,
                                     to_user=user.get('email', ''),
                                     row_id=row_id
                                     )
                except Exception as e:
                    logging.error(e)

        workflow_token = form_config.get('trigger_workflow_option', {}).get('workflow_token')
        is_trigger_workflow = form_config.get('trigger_workflow_option', {}).get('is_trigger_workflow')
        share_type = form_obj.share_type

        if settings.ENABLE_WORKFLOW and is_trigger_workflow and share_type != 'anonymous' and request.user.is_authenticated:
            if isinstance(request.data, QueryDict):
                request.data._mutable = True

            request.data['row_id'] = row_id
            request.data['form_token'] = token
            try:
                submit_workflow_result = DTableWorkflowSubmitTaskView().post(request, workflow_token)
            except Exception as e:
                logger.exception(e)
                logger.error('form trigger workflow failed error: %s', e)
            else:
                if submit_workflow_result.status_code != 200:
                    resp_data = submit_workflow_result.data
                    logger.error('form trigger workflow failed status code: %s error_msg: %s',
                                 submit_workflow_result.status_code, resp_data)

        # end remark
        success_message_option = form_config.get('success_message_option', {})
        success_message = ''
        if success_message_option.get('is_success_message_show', False):
            success_message = success_message_option.get('success_message')
            success_message = fill_message_by_dtable_db(request.user.username, str(dtable.uuid), table['name'], row_id, success_message)

        return Response({"success": True, 'success_message': success_message})


class DTableFormPublicUploadLinkView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, token):
        """ upload link
        """
        # resource check
        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = form_obj.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        workspace = dtable.workspace
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        parent_dir = os.path.join('/asset', str(dtable.uuid), PUBLIC_RELATIVE_PATH)

        try:
            public_upload_link = generate_upload_link(parent_dir, dtable)
        except Exception as e:
            logger.error('generate upload link error: %s, parent_dir: %s', e, parent_dir)

        return Response({
            'parent_path': parent_dir,
            'upload_link': public_upload_link
        })


class DTableFormUploadLinkView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        upload_type = request.GET.get('upload_type', 'file')
        # resource check
        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace_id = form_obj.workspace_id
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = form_obj.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_form_submit_permission(request, form_obj):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # quota and rows check
        if not check_quota_by_workspace(workspace):
            error_msg = 'Asset quota exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)
        if not check_row_limit_by_workspace(workspace):
            error_msg = 'Rows exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        if upload_type == 'image':
            parent_dir = os.path.join('/asset', str(dtable.uuid), PUBLIC_FORMS_RELATIVE_PATH)
        else:
            parent_dir = os.path.join('/asset', str(dtable.uuid), UPLOAD_FILE_RELATIVE_PATH, str(date.today())[:7])

        try:
            upload_link = generate_upload_link(parent_dir, dtable)
        except Exception as e:
            logger.error('generate upload link error: %s, parent_dir: %s', e, parent_dir)

        return Response({
            'parent_path': parent_dir,
            'upload_link': upload_link
        })


class DTableFormLinkedTableRowsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        # arguments check
        if not isinstance(request.data, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request')
        custom_url = request.GET.get('custom_url')
        form_token = request.GET.get('form_token')
        if not (custom_url or form_token):
            return api_error(status.HTTP_400_BAD_REQUEST, 'custom_url or form_token invalid')
        link_column_key = request.GET.get('link_column_key')
        if not link_column_key:
            return api_error(status.HTTP_400_BAD_REQUEST, 'link_column_key invalid')

        # resource check
        ## dtable form
        if custom_url:
            dtable_form_custom_url = DTableFormCustomURLs.objects.filter(custom_url=custom_url).first()
            if not dtable_form_custom_url:
                return api_error(status.HTTP_404_NOT_FOUND, 'Form url not found')
            dtable_form = DTableForms.objects.filter(token=dtable_form_custom_url.form_token).first()
            if not dtable_form:
                return api_error(status.HTTP_404_NOT_FOUND, 'Form not found')
        elif form_token:
            dtable_form = DTableForms.objects.filter(token=form_token).first()
            if not dtable_form:
                return api_error(status.HTTP_404_NOT_FOUND, 'Form not found')
        ## dtable
        dtable = DTables.objects.get_dtable_by_uuid(dtable_form.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        ## form config
        try:
            form_config = json.loads(dtable_form.form_config)
        except Exception:
            logger.error('form: %s load config error: %s', dtable_form.token, form_config)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        ## form link column
        form_columns = form_config.get('columns') or []
        form_link_column = next(filter(lambda column: column['key'] == link_column_key, form_columns), None)
        if not form_link_column:
            return api_error(status.HTTP_404_NOT_FOUND, 'Link column not found in form')
        ## form table
        form_table_id = form_config.get('table_id')
        dtable_server_url = get_inner_dtable_server_url()
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), dtable_server_url)
        try:
            metadata = dtable_server_api.get_metadata()
        except Exception as e:
            logger.error('request form: %s dtable: %s metadata error: %s', dtable_form.token, dtable.uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        tables = metadata.get('tables') or []
        form_table = next(filter(lambda table: table['_id'] == form_table_id, tables), None)
        if not form_table:
            return api_error(status.HTTP_404_NOT_FOUND, 'Form table not found')
        ## form table link column
        link_column = next(filter(lambda column: column['key'] == link_column_key, form_table['columns']), None)
        if not link_column:
            return api_error(status.HTTP_404_NOT_FOUND, 'Link column not found in table')
        if link_column['type'] != ColumnTypes.LINK:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Column %s is not a link column' % link_column['name'])
        ## form table link column linked table
        link_column_data = link_column.get('data') or {}
        link_table_id = link_column_data.get('table_id')
        link_other_table_id = link_column_data.get('other_table_id')
        link_table_id = link_other_table_id if link_table_id == form_table_id else link_table_id
        is_row_from_view = link_column_data.get('is_row_from_view')
        link_view_id = link_column_data.get('other_view_id')
        linked_table = next(filter(lambda table: table['_id'] == link_table_id, tables), None)
        if not linked_table:
            return api_error(status.HTTP_404_NOT_FOUND, 'Linked table not found')
        linked_view = None
        if is_row_from_view and link_view_id:
            linked_view = next(filter(lambda view: view['_id'] == link_view_id, linked_table.get('views') or []), None)
            if not linked_view:
                return Response({'linked_table_rows': []})  # empty view rows

        # permission check
        if not check_form_submit_permission(request, dtable_form):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # query rows
        ## gen sql
        filter_conditions = {
            'start': 0,
            'limit': 10000
        }
        if linked_view:
            username = request.user.username
            id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
            id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
            link_filters = linked_view.get('filters') or []
            link_filter_conjunction = linked_view.get('link_filter_conjunction') or 'And'
            if link_filters:
                for item in link_filters:
                    if item.get('filter_predicate') == 'include_me':
                        item['filter_term'] = [username]
                    if item.get('filter_predicate') == 'is_current_user_ID':
                        item['filter_term'] = id_in_org
                filter_conditions['filters'] = link_filters
                filter_conditions['filter_conjunction'] = link_filter_conjunction

        import dtable_events
        try:
            sql = dtable_events.filter2sql(
                linked_table['name'],
                linked_table['columns'],
                filter_conditions,
                by_group=False
            )
            dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
            rows = dtable_db_api.query(sql, server_only=True)['results']
        except dtable_events.SQLGeneratorOptionInvalidError:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid option in single or multiple select columns')
        except dtable_events.DateTimeQueryInvalidError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid query in column %s' % e.column_name)
        except Exception as e:
            logger.exception('query dtable: %s sql: %s error: %s', dtable.uuid, sql, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'linked_table_rows': rows})


class DTableFormDuplicateView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, token):
        """duplicate a dtable form
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # resource check
        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(form_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % form_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        form_config = json.loads(form_obj.form_config)
        form_config['form_name'] = form_config.get('form_name') + ' (1)'
        form_config = json.dumps(form_config)

        dtable_uuid = form_obj.dtable_uuid
        try:
            form_obj = DTableForms.objects.add_form_obj(username, workspace.id, dtable_uuid, form_config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        form = form_obj.to_dict()

        return Response({"form": form}, status=status.HTTP_200_OK)


class DTableFormCustomURLsView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedCustomizaiton)
    throttle_classes = (UserRateThrottle,)

    def _check_custom_url(self, custom_url):

        return True if re.search(r'^[-0-9a-zA-Z]+$', custom_url) else False

    def post(self, request, token):

        custom_url = request.data.get('custom_url', None)
        if not custom_url:
            error_msg = 'custom url invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(form_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % form_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        custom_url = custom_url.strip()
        if not self._check_custom_url(custom_url):
            error_msg = _('URL is invalid')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(custom_url) < 5 or len(custom_url) > 30:
            error_msg = _('The custom part of URL should have 5-30 characters.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if DTableFormCustomURLs.objects.filter(custom_url=custom_url).exists():
            error_msg = _('This custom domain is already in use and cannot be used for the form')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        try:
            form_link = DTableFormCustomURLs.objects.create(
                form_token = token,
                custom_url = custom_url
            )
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            "form_custom_link": form_link.to_dict(),
        })

    def delete(self, request, token):
        custom_url = request.data.get('custom_url', None)
        if not custom_url:
            error_msg = 'custom url invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        form_obj = DTableForms.objects.get_form_by_token(token)
        if not form_obj:
            error_msg = 'Form %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(form_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % form_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if check_dtable_permission(username, workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            DTableFormCustomURLs.objects.filter(
                form_token = token,
                custom_url = custom_url
            ).delete()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})

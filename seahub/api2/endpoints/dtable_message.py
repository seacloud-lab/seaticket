# -*- coding: utf-8 -*-
import logging
import json

import os
from email.utils import make_msgid
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seaserv import seafile_api
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, BoundThirdPartyAccounts, ACCOUNT_TYPE_EMAIL, ACCOUNT_TYPE_WECHAT_ROBOT, \
    _decrypt_detail, ACCOUNT_TYPE_DINGTALK, NOTIFICATION
from seahub.dtable.utils import check_dtable_permission, add_dtable_message_task, query_dtable_message_send_status, \
    cancel_dtable_message_send_task
from seahub.utils import uuid_str_to_32_chars, normalize_file_path, gen_file_get_url

logger = logging.getLogger(__name__)

class DTableEmailMessageSendView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def _handle_file_path(self, request, workspace, dtable, repo_id, file_path):
        asset_path = normalize_file_path(os.path.join('/asset', str(dtable.uuid), file_path))
        asset_id = seafile_api.get_file_id_by_path(repo_id, asset_path)
        asset_name = os.path.basename(normalize_file_path(file_path))
        if not asset_id:
            err_msg = 'Asset file %s does not exist.' % asset_name
            err_code = 404
            return err_msg, err_code, None, None
        
        token = seafile_api.get_fileserver_access_token(
            repo_id, asset_id, 'download', '', use_onetime=False
        )

        url = gen_file_get_url(token, asset_name)
        return  None, 200, asset_name, url


    def post(self, request, dtable_uuid):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        uuid_str = uuid_str_to_32_chars(dtable_uuid)


        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library does not exist'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        org_id = request.user.org and request.user.org.org_id or None
        if not check_dtable_permission(username, dtable.workspace, dtable, org_id=org_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        account_name = request.data.get('account_name', None)
        email_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name)
        if not email_account:
            error_msg = 'Account does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if email_account.account_type != ACCOUNT_TYPE_EMAIL:
            error_msg = 'Account type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        send_to = request.data.get('send_to', None)
        message = request.data.get('message', None)
        html_message = request.data.get('html_message', None)
        subject = request.data.get('subject', None)
        source = request.data.get('source', '')
        copy_to = request.data.get('copy_to', [])
        reply_to = request.data.get('reply_to', None)
        file_paths = request.data.get('attachments', []) # [files/2020-1-1/<filename>]
        need_message_id = request.data.get('need_message_id')
        in_reply_to = request.data.get('in_reply_to')
        images_info = request.data.get('images_info', {})  # {'cid1': 'images/2022-10/image001.png'}
        file_name_url_map = {}

        if not send_to:
            error_msg = 'Email sent to is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not message and not html_message:
            error_msg = 'Email content cannot be empty.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not subject:
            error_msg = 'Email subject cannot be empty.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        for file_path in file_paths:
            error_msg, err_code, file_name, file_url = self._handle_file_path(request, dtable.workspace, dtable, repo_id, file_path)
            if error_msg and err_code != 200:
                continue
            file_name_url_map[file_name] = file_url

        image_cid_url_map = {}
        for cid, image_path in images_info.items():
            error_msg, err_code, image_name, image_url = self._handle_file_path(request, dtable.workspace, dtable, repo_id, image_path)
            if error_msg and err_code != 200:
                continue
            image_cid_url_map[cid] = image_url

        params = {
            'send_to': send_to,
            'message': message,
            'html_message': html_message,
            'subject': subject,
            'source': source,
            'copy_to': copy_to,
            'reply_to': reply_to,
            'username': username,
            'file_download_urls': json.dumps(file_name_url_map),
            'account_id': email_account.pk,
        }

        message_id = ''
        if need_message_id:
            message_id = make_msgid(domain='seatable.com')
            params['message_id'] = message_id

        if in_reply_to:
            params['in_reply_to'] = in_reply_to

        if image_cid_url_map:
            params['image_cid_url_map'] = json.dumps(image_cid_url_map)

        try:
            task_id = add_dtable_message_task(type=ACCOUNT_TYPE_EMAIL, params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'task_id': task_id, 'message_id': message_id})


class DTableWechatMessageSendView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid):

        msg_type = request.data.get('msg_type', 'text')
        if msg_type and msg_type not in ['text', 'markdown']:
            error_msg = 'msg_type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        uuid_str = uuid_str_to_32_chars(dtable_uuid)

        # permission check
        username = request.user.username
        org_id = request.user.org and request.user.org.org_id or None
        if not check_dtable_permission(username, dtable.workspace, dtable, org_id=org_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        account_name = request.data.get('account_name', None)
        wechat_robot_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name)
        if not wechat_robot_account:
            error_msg = 'Account does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if wechat_robot_account.account_type != ACCOUNT_TYPE_WECHAT_ROBOT:
            error_msg = 'Account type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        message = request.data.get('message', None)
        account_detail = _decrypt_detail(json.loads(wechat_robot_account.detail))
        params = {
            'webhook_url': account_detail.get('webhook_url'),
            'msg': message,
            'msg_type': msg_type,
        }
        try:
            task_id = add_dtable_message_task(type=ACCOUNT_TYPE_WECHAT_ROBOT, params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'task_id': task_id})


class DTableDingtalkMessageSendView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid):
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        uuid_str = uuid_str_to_32_chars(dtable_uuid)

        # permission check
        username = request.user.username
        org_id = request.user.org and request.user.org.org_id or None
        if not check_dtable_permission(username, dtable.workspace, dtable, org_id=org_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        account_name = request.data.get('account_name', None)
        dingtalk_robot_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name)
        if not dingtalk_robot_account:
            error_msg = 'Account does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if dingtalk_robot_account.account_type != ACCOUNT_TYPE_DINGTALK:
            error_msg = 'Account type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        message = request.data.get('message', None)
        account_detail = _decrypt_detail(json.loads(dingtalk_robot_account.detail))
        params = {
            'webhook_url': account_detail.get('webhook_url'),
            'msg': message
        }
        try:
            task_id = add_dtable_message_task(type=ACCOUNT_TYPE_DINGTALK, params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'task_id': task_id})

class DTableNotificationSendView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid):

        emails = request.data.get('emails', [])
        user_col_key = request.data.get('user_col_key', '')
        if not (emails or user_col_key):
            error_msg = 'User is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        msg = request.data.get('msg', None)
        if not msg:
            error_msg = 'Sending message is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        table_id = request.data.get('table_id', None)
        row_id = request.data.get('row_id', None)


        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        org_id = request.user.org and request.user.org.org_id or None
        if not check_dtable_permission(username, dtable.workspace, dtable, org_id=org_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        params = {
            'dtable_uuid': dtable_uuid,
            'username': username,
            'emails': emails and ','.join(emails) or None,
            'msg': msg,
            'table_id': table_id,
            'row_id': row_id,
            'user_col_key': user_col_key
        }
        try:
            task_id = add_dtable_message_task(type=NOTIFICATION, params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'task_id': task_id})


class DTableMessageSendStatus(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """
        Get task status by task id
        :param request:
        :return:
        """

        task_id = request.GET.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        resp = query_dtable_message_send_status(task_id)

        if resp.status_code == 400:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not resp.ok:
            logger.error(resp.content)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        resp_info = json.loads(resp.content)
        is_finished = resp_info['is_finished']
        result = resp_info['result']

        err_msg = result.get('err_msg')
        if err_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, err_msg)

        return Response({'is_finished': is_finished})

    def delete(self, request):
        """
        Delete task by task_id
        :param request:
        :return:
        """

        task_id = request.query_params.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        resp = cancel_dtable_message_send_task(task_id)

        if resp.status_code == 400:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not resp.ok:
            logger.error(resp.content)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

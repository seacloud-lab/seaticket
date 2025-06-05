# -*- coding: utf-8 -*-
import logging
import json
import base64
import requests
import os
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.cache import cache
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, BoundThirdPartyAccounts, _decrypt_detail, ACCOUNT_TYPE_IMAGE_RECOGNITION
from seahub.dtable.settings import EASY_DL_TOKEN_CACHE_PREFIX, EASY_DL_TOKEN_TIMEOUT
from seahub.dtable.utils import check_dtable_permission
from seahub.utils import uuid_str_to_32_chars, normalize_file_path, gen_file_get_url, normalize_cache_key
from seaserv import seafile_api


logger = logging.getLogger(__name__)

def get_baidu_dl_access_token(api_key, secret_key, account_id_str):

    err = False
    cache_key = normalize_cache_key(account_id_str, EASY_DL_TOKEN_CACHE_PREFIX)
    token = cache.get(cache_key)
    if token:
        return err, token

    auth_url = "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials" \
               "&client_id={}&client_secret={}".format(api_key, secret_key)

    try:
        auth_resp = requests.get(auth_url)
        auth_resp_json = auth_resp.json()
        token = auth_resp_json["access_token"]
        cache.set(cache_key, token, EASY_DL_TOKEN_TIMEOUT)
    except Exception as e:
        logger.error(e)
        err, token = True, None

    return err, token

def get_api_url(api_url, access_token):
    return "{}?access_token={}".format(api_url, access_token)


class DTableImageRecognitionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def _handle_file_path(self, dtable, repo_id, file_path):
        asset_path = normalize_file_path(os.path.join('/asset', str(dtable.uuid), file_path))
        asset_id = seafile_api.get_file_id_by_path(repo_id, asset_path)
        asset_name = os.path.basename(normalize_file_path(file_path))
        if not asset_id:
            return None

        token = seafile_api.get_fileserver_access_token(
            repo_id, asset_id, 'download', '', use_onetime=False
        )

        url = gen_file_get_url(token, asset_name)
        return url

    def _parse_image_to_base64(self, image_path, dtable=None, repo_id=None):
        if image_path.startswith("http://") or image_path.startswith("https://"):
            # parse base64 of image of url
            res = requests.get(image_path)
            base64_data = base64.b64encode(res.content)
            base64_str = base64_data.decode('UTF8')

        else:
            # parse base64 of image of path such as files/xxx/xxx or images/xxx/xx,
            # or in local path /Users/xxx/xxx/..
            url = self._handle_file_path(dtable, repo_id, image_path)
            if url:
                res = requests.get(url)
                base64_data = base64.b64encode(res.content)
                base64_str = base64_data.decode('UTF8')
            else:
                try:
                    with open(image_path, 'rb') as f:
                        base64_data = base64.b64encode(f.read())
                        base64_str = base64_data.decode('UTF8')
                except FileNotFoundError as e:
                    logger.error(e)
                    base64_str = None
        return base64_str

    def post(self, request, dtable_uuid):
        # params check
        account_name = request.data.get('account_name', None)
        image_path = request.data.get('image_path', None)
        if not image_path:
            error_msg = 'Image path is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not account_name:
            error_msg = 'Account name is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            top_num = int(request.data.get('top_num', 2))
        except ValueError:
            top_num = 2

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

        fr_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name)
        if not fr_account:
            error_msg = 'Account does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if fr_account.account_type != ACCOUNT_TYPE_IMAGE_RECOGNITION:
            error_msg = 'Account type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        account_detail = _decrypt_detail(json.loads(fr_account.detail))
        api_url = account_detail.get('api_url', '')
        api_key = account_detail.get('api_key', '')
        secret_key = account_detail.get('secret_key', '')
        token_cache_key = normalize_cache_key(str(fr_account.id), EASY_DL_TOKEN_CACHE_PREFIX)

        err, access_token = get_baidu_dl_access_token(api_key, secret_key, str(fr_account.id))
        if err:
            error_msg = "API key or secret key is invalid."
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        image_code_base64 = self._parse_image_to_base64(image_path, dtable, repo_id)
        if not image_code_base64:
            error_msg = 'Image is invalid'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dl_api_url = get_api_url(api_url, access_token)
        params = {
            "top_num": top_num,
            "image" : image_code_base64
        }
        try:
            response = requests.post(url=dl_api_url, json=params)
            error_code = response.json().get('error_code')
            if error_code == 110: # token invalid or expired code
                cache.delete(token_cache_key)
                err, access_token_new = get_baidu_dl_access_token(api_key, secret_key, str(fr_account.id))
                dl_api_url_new = get_api_url(api_url, access_token_new)
                response = requests.post(url=dl_api_url_new, json=params)
                return Response(response.json())

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')
        return Response(response.json())

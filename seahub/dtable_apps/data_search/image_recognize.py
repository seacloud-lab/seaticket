# -*- coding: utf-8 -*-
import time
import json
import logging
import base64
import requests
from django.core.cache import cache
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.settings import EASY_DL_TOKEN_CACHE_PREFIX, EASY_DL_TOKEN_TIMEOUT
from seahub.utils import normalize_cache_key, uuid_str_to_32_chars, get_file_type_and_ext, IMAGE, PREVIEW_FILEEXT
from seahub.dtable.utils import check_dtable_permission
from seahub.dtable.models import Workspaces, DTables, DTableExternalApps, BoundThirdPartyAccounts, \
    ACCOUNT_TYPE_IMAGE_RECOGNITION, _decrypt_detail
from seahub.utils.error_msg import file_type_error_msg

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

class DataImageRecognizeView(APIView):
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        # argument check
        token = request.data.get('token', None)
        if not token:
            error_msg = 'token invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        image = request.FILES.get('image', None)
        if not image:
            error_msg = 'Image is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_type, ext = get_file_type_and_ext(image.name)
        if file_type != IMAGE:
            error_msg = file_type_error_msg(ext, PREVIEW_FILEEXT.get(IMAGE))
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        account_name = request.data.get('account_name', None)
        if not account_name:
            error_msg = 'Account name is invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            top_num = int(request.data.get('top_num', 2))
        except ValueError:
            top_num = 2

        # resource check
        external_app = DTableExternalApps.objects.get_external_app_by_uuid(token)
        if not external_app:
            error_msg = 'External app %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = external_app.dtable_uuid
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable_uuid = uuid_str_to_32_chars(dtable_uuid)

        fr_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(dtable_uuid, account_name)
        if not fr_account:
            error_msg = 'Account does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if fr_account.account_type != ACCOUNT_TYPE_IMAGE_RECOGNITION:
            error_msg = 'Account type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        account_detail = _decrypt_detail(json.loads(fr_account.detail))
        api_url = account_detail.get('api_url', '')
        api_key = account_detail.get('api_key', '')
        secret_key = account_detail.get('secret_key', '')
        token_cache_key = normalize_cache_key(str(fr_account.id), EASY_DL_TOKEN_CACHE_PREFIX)

        err, access_token = get_baidu_dl_access_token(api_key, secret_key, str(fr_account.id))
        if err:
            error_msg = "API key or secret key is invalid."
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        base64_data = base64.b64encode(image.read())
        image_code_base64 = base64_data.decode('UTF8')
        if not image_code_base64:
            error_msg = 'Image is invalid'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dl_api_url = get_api_url(api_url, access_token)
        params = {
            "top_num": top_num,
            "image": image_code_base64
        }

        try:
            response = requests.post(url=dl_api_url, json=params)
            error_code = response.json().get('error_code')
            if error_code == 110:  # token invalid or expired code
                cache.delete(token_cache_key)
                err, access_token_new = get_baidu_dl_access_token(api_key, secret_key, str(fr_account.id))
                dl_api_url_new = get_api_url(api_url, access_token_new)
                response = requests.post(url=dl_api_url_new, json=params)
                return Response(response.json())

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response(response.json())

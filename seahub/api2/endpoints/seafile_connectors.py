import json
import logging
import os

import requests
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from seaserv import seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, BoundThirdPartyAccounts, _decrypt_detail
from seahub.dtable.utils import transfer_dtable_asset_files_to_seafile, check_dtable_permission
from seahub.constants import PERMISSION_READ_WRITE

logger = logging.getLogger(__name__)

class SeafileTransferTaskView(APIView):
    '''
    Files of seatable save into seafile repo
    '''
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid):

        username = request.user.username
        #arguments check
        files_map = request.data.get('files_map', None)
        parent_dir = request.data.get('parent_dir', '/')
        relative_path = request.data.get('relative_path','')
        replace = request.data.get('replace',False)
        if not files_map or not isinstance(files_map, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'files_map is invalid.')
        files = list(files_map.keys())
        if len(files) > 200:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Transfer save up to 200 files at a time')
        #resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        repo_id = dtable.workspace.repo_id
        if not seafile_api.get_repo(repo_id):
            return api_error(status.HTTP_404_NOT_FOUND, 'Library not found.')
        asset_dir = os.path.join('/asset', str(dtable.uuid))
        if not seafile_api.get_dirent_by_path(repo_id, asset_dir):
            return api_error(status.HTTP_404_NOT_FOUND, 'Files not found.')
        # connector check
        seafile_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_type(dtable.uuid.hex, 'seafile').first()
        if not seafile_account:
            return api_error(status.HTTP_403_FORBIDDEN,'Permission denied')
        detail = _decrypt_detail(json.loads(seafile_account.detail))
        seafile_url = detail.get('seafile_url', '')
        repo_api_token = detail.get('repo_api_token', '')
        params = {
            'username': username,
            'repo_id' : repo_id,
            'dtable_uuid' : str(dtable.uuid),
            'files': files,
            'files_map': json.dumps(files_map),
            'parent_dir': parent_dir,
            'relative_path': relative_path,
            'replace': replace,
            'repo_api_token': repo_api_token,
            'seafile_server_url': seafile_url,
        }
        try:
            task_id = transfer_dtable_asset_files_to_seafile(params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'task_id': task_id})


REPO_INFO_URL = '/api/v2.1/via-repo-token/repo-info/'
REPO_DIR_URL = '/api/v2.1/via-repo-token/dir/'
REPO_DOWNLOAD_LINK_URL = '/api/v2.1/via-repo-token/download-link/'
SEAFILE_TIMEOUT = 10


def get_repo_info(seafile_url, repo_api_token):
    """repo info

    Return: info -> dict or None, error_msg -> str or None
    """
    url = f"{seafile_url.strip('/')}{REPO_INFO_URL}"
    headers = {'Authorization': f'Token {repo_api_token}'}
    try:
        resp = requests.get(url, headers=headers, timeout=SEAFILE_TIMEOUT)
        if resp.status_code != 200:
            return None, 'seafile_url or api_token invalid'
        return resp.json(), None
    except Exception as e:
        logger.warning('request seafile: %s api token: %s error: %s', seafile_url, repo_api_token, e)
        return None, 'seafile_url or api_token invalid'


class SeafileRepoInfoView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        # arguments check
        seafile_url = request.data.get('seafile_url')
        if not seafile_url:
            return api_error(status.HTTP_400_BAD_REQUEST, 'seafile_url invalid')
        repo_api_token = request.data.get('repo_api_token')
        if not repo_api_token:
            return api_error(status.HTTP_400_BAD_REQUEST, 'repo_api_token invalid')

        repo_info, error_msg = get_repo_info(seafile_url, repo_api_token)
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        return Response(repo_info)


class SeafileRepoDirView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        # arguments check
        path = request.data.get('path')
        seafile_url = request.data.get('seafile_url')
        if not seafile_url:
            return api_error(status.HTTP_400_BAD_REQUEST, 'seafile_url invalid')
        repo_api_token = request.data.get('repo_api_token')
        if not repo_api_token:
            return api_error(status.HTTP_400_BAD_REQUEST, 'repo_api_token invalid')

        # resource check
        _, error_msg = get_repo_info(seafile_url, repo_api_token)
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        url = f"{seafile_url.strip('/')}{REPO_DIR_URL}"
        headers = {'Authorization': f'Token {repo_api_token}'}
        params = {}
        if path:
            params['path'] = path

        try:
            resp = requests.get(url, params=params, headers=headers, timeout=SEAFILE_TIMEOUT)
            return Response(resp.json(), resp.status_code)
        except Exception as e:
            logger.warning('get dir seafile: %s api token: %s path: %s error: %s', seafile_url, repo_api_token, path, e)
            return api_error(status.HTTP_400_BAD_REQUEST, "Can not access seafile")


class SeafileRepoDownloadLinkView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        # arguments check
        path = request.data.get('path')
        if not path:
            return api_error(status.HTTP_400_BAD_REQUEST, 'path invalid')
        seafile_url = request.data.get('seafile_url')
        if not seafile_url:
            return api_error(status.HTTP_400_BAD_REQUEST, 'seafile_url invalid')
        repo_api_token = request.data.get('repo_api_token')
        if not repo_api_token:
            return api_error(status.HTTP_400_BAD_REQUEST, 'repo_api_token invalid')

        # resource check
        _, error_msg = get_repo_info(seafile_url, repo_api_token)
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        url = f"{seafile_url.strip('/')}{REPO_DOWNLOAD_LINK_URL}"
        headers = {'Authorization': f'Token {repo_api_token}'}
        params = {'path': path}
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=SEAFILE_TIMEOUT)
            return Response(resp.json(), resp.status_code)
        except Exception as e:
            logger.warning('get downloadlink seafile: %s api token: %s path: %s error: %s', seafile_url, repo_api_token, path, e)
            return api_error(status.HTTP_400_BAD_REQUEST, "Can not access seafile")

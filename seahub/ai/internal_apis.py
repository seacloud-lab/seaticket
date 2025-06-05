import os
import re
import urllib
import logging
import json
from datetime import datetime

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seaserv import ccnet_api, seafile_api

from seahub.ai.models import AIAssistantOwner
from seahub.api2.status import HTTP_443_ABOVE_QUOTA
from seahub.dtable.models import Workspaces, DTables
from seahub.base.accounts import User
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info
from seahub.profile.models import Profile
from seahub.ai.utils import is_valid_jwt, check_assistant_admin_permission, check_assistant_permission
from seahub.utils import normalize_file_path, gen_file_get_url, gen_file_upload_url
from seahub.dtable.utils import check_dtable_admin_permission, check_quota_by_workspace, check_row_limit_by_workspace, \
    UPLOAD_IMG_RELATIVE_PATH, UPLOAD_FILE_RELATIVE_PATH, UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH
from seahub.settings import DTABLE_WEB_SERVICE_URL

try:
    from seahub.settings import CLOUD_MODE, MULTI_TENANCY
except ImportError:
    CLOUD_MODE = False
    MULTI_TENANCY = False

logger = logging.getLogger(__name__)


class AIGetUserByNameView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """Get user by nickname
        """
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # arguments check
        query_str = request.GET.get('query', '').strip()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.GET.get('username')
        if not username:
            error_msg = 'username invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            err_msg = 'User %s not found.' % username
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        if (CLOUD_MODE and MULTI_TENANCY):
            orgs = ccnet_api.get_orgs_by_user(username)
            if not orgs:
                error_msg = 'Feature is not enabled.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            else:
                org = orgs[0]
                org_all_users = ccnet_api.get_org_users_by_url_prefix(
                    org.url_prefix, -1, -1)
                all_org_users = [x.email for x in org_all_users]

                profile_queryset = Profile.objects.filter(
                    user__in=all_org_users,
                    nickname=query_str
                )
        else:
            profile_queryset = Profile.objects.filter(
                nickname=query_str
            )

        user_list = []
        for profile in profile_queryset:
            user_info = get_user_common_info(profile.user)
            user_list.append(user_info)

        return Response({'user_list': user_list})


class AIDTableAssetDownloadLinkView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    def post(self, request):
        """Get dtable asset download link
        """
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # arguments check
        asset_url = request.data.get('url')
        if not asset_url:
            error_msg = 'url invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # {service_url}/workspace/{workspace_id}/asset/{dtable_uuid}/{file_path}
        service_url = DTABLE_WEB_SERVICE_URL.rstrip('/')
        asset_url = asset_url.replace(service_url, '').lstrip('/')
        pattern = r'^workspace/(?P<workspace_id>\d+)/asset/(?P<dtable_uuid>[-0-9a-f]{36})/(?P<path>.*)$'
        match = re.match(pattern, asset_url)
        if not match:
            error_msg = 'url invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not match.group(1) and not match.group(2) and not match.group(3):
            error_msg = 'url invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace_id = int(match.group(1))
        dtable_uuid = match.group(2)
        path = match.group(3)
        path = urllib.parse.unquote(path)
        asset_name = os.path.basename(normalize_file_path(path))
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo_id = workspace.repo_id
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'DTable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            asset_path = normalize_file_path(os.path.join('/asset', dtable_uuid, path))
            asset_id = seafile_api.get_file_id_by_path(repo_id, asset_path)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not asset_id:
            error_msg = 'Asset %s not found.' % path
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        operation = 'download'
        token = seafile_api.get_fileserver_access_token(
            repo_id, asset_id, operation, '', use_onetime=False
        )
        url = gen_file_get_url(token, asset_name)

        return Response(url)


class AIDTableInfoView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    def post(self, request):
        """Get dtable info
        """
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # arguments check
        dtable_uuids = request.data.get('dtable_uuids')
        if not dtable_uuids or not isinstance(dtable_uuids, list):
            error_msg = 'dtable_uuids invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_list = []
        dtable_queryset = DTables.objects.filter(
            uuid__in=dtable_uuids).select_related('workspace')
        for dtable in dtable_queryset:
            info = dtable.to_dict()
            dtable_list.append(info)

        return Response({'dtable_list': dtable_list})


class AssistantAdminPermission(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    def post(self, request):
        """check assistant permission
        """
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.data.get('username')
        assistant_uuid = request.data.get('assistant_uuid')
        if not username:
            error_msg = 'username invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not assistant_uuid:
            error_msg = 'assistant_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            err_msg = 'User %s not found.' % username
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if check_assistant_admin_permission(assistant.owner, username):
            return Response({'is_admin': True})
        elif check_assistant_permission(assistant.owner, username):
            return Response({'is_admin': False})
        else:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)


class DtableAdminPermission(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)
    def post(self, request):
        """check assistant permission
        """
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.data.get('username')
        dtable_uuid = request.data.get('dtable_uuid')
        if not username:
            error_msg = 'username invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            err_msg = 'User %s not found.' % username
            return api_error(status.HTTP_404_NOT_FOUND, err_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        if check_dtable_admin_permission(username, dtable.workspace.owner):
            return Response({'is_admin': True})
        else:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)


class GetOwnerInfoByAssistant(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """Get org_id by assistant_uuid
        """
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth):
            error_msg = 'Permission denied'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        assistant_uuid = request.GET.get('assistant_uuid')
        if not assistant_uuid:
            error_msg = 'assistant_uuid invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            assistant = AIAssistantOwner.objects.filter(assistant_uuid=assistant_uuid).first()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if not assistant:
            error_msg = 'Assistant not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        owner = assistant.owner

        owner_info = {
            'owner': owner,
            'org_id': None
        }

        if '@seafile_group' in owner:
            group_id = owner[:-len('@seafile_group')]
            if CLOUD_MODE and MULTI_TENANCY:
                org_id = ccnet_api.get_org_id_by_group(int(group_id))
                if org_id:
                    owner_info['org_id'] = org_id
        else:
            if CLOUD_MODE and MULTI_TENANCY:
                orgs = ccnet_api.get_orgs_by_user(owner)
                if orgs:
                    owner_info['org_id'] = orgs[0].org_id

        return Response(owner_info)


class AIDTableAssetUploadLink(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id):
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth):
            error_msg = 'Permission denied'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_name = request.GET.get('name', None)
        if not dtable_name:
            error_msg = 'dtable_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, dtable_name)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # quota check
        if not check_quota_by_workspace(workspace):
            error_msg = 'Asset quota exceeded.'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)
        # rows check
        if not check_row_limit_by_workspace(workspace):
            error_msg = 'Rows exceeded'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        # create asset dir
        asset_dir_path = os.path.join('/asset', str(dtable.uuid))
        asset_dir_id = seafile_api.get_dir_id_by_path(repo_id, asset_dir_path)
        if not asset_dir_id:
            seafile_api.mkdir_with_parents(repo_id, '/', asset_dir_path[1:], 'seatable-ai')

        # get token
        obj_id = json.dumps({'parent_dir': asset_dir_path})
        try:
            token = seafile_api.get_fileserver_access_token(repo_id, obj_id, 'upload', '', use_onetime=False)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        upload_link = gen_file_upload_url(token, 'upload-api')

        dtable.modifier = 'seatable-ai'
        dtable.save()

        res = dict()
        res['upload_link'] = upload_link
        res['parent_path'] = asset_dir_path
        res['img_relative_path'] = os.path.join(UPLOAD_IMG_RELATIVE_PATH, str(datetime.today())[:7])
        res['file_relative_path'] = os.path.join(UPLOAD_FILE_RELATIVE_PATH, str(datetime.today())[:7])
        res['digital_signs_relative_path'] = os.path.join(UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH, str(datetime.today())[:7])
        res['public_path'] = 'public'
        return Response(res)

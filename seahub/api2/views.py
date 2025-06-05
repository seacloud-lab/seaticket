# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import logging
from importlib import import_module

import requests
from rest_framework import parsers
from rest_framework import status
from rest_framework import renderers
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings as dj_settings
from django.utils.translation import gettext as _

from .throttling import ScopedRateThrottle, AnonRateThrottle, UserRateThrottle
from .authentication import TokenAuthentication
from .serializers import AuthTokenSerializer
from .utils import api_error
from seahub.api2.base import APIView
from seahub.auth.models import UserQuota
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import Workspaces, UserRowsCount, OrgRowsCount, OrgBigDataStorageStats, \
    StatsAPIGatewayByOwner, StatsAPIGatewayByTeam
from seahub.dtable.utils import can_user_run_python, can_org_run_python
from seahub.options.models import UserOptions
from seahub.organizations.models import OrgQuota, OrgSettings
from seahub.profile.models import Profile
from seahub.utils import is_org_context
from seahub.utils.file_size import get_quota_from_string
from seaserv import seafile_api
import seahub.settings as settings
from seahub.subscription.utils import subscription_check
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from seahub.ai.utils import get_ai_cost_by_org_id, get_ai_cost_by_owner_id, get_ai_credit_by_org_id, get_ai_credit_by_owner_id

logger = logging.getLogger(__name__)
json_content_type = 'application/json; charset=utf-8'


########## Test
class Ping(APIView):
    """
    Returns a simple `pong` message when client calls `api2/ping/`.
    For example:
        curl http://127.0.0.1:8000/api2/ping/
    """
    throttle_classes = (ScopedRateThrottle, )
    throttle_scope = 'ping'

    def get(self, request, format=None):
        return Response('pong')

    def head(self, request, format=None):
        return Response(headers={'foo': 'bar',})

class AuthPing(APIView):
    """
    Returns a simple `pong` message when client provided an auth token.
    For example:
        curl -H "Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b" http://127.0.0.1:8000/api2/auth/ping/
    """
    authentication_classes = (TokenAuthentication, )
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    def get(self, request, format=None):
        return Response('pong')

########## Token
class ObtainAuthToken(APIView):
    """
    Returns auth token if username and password are valid.
    For example:
        curl -d "username=foo@example.com&password=123456" http://127.0.0.1:8000/api2/auth-token/
    """
    throttle_classes = (AnonRateThrottle, )
    permission_classes = ()
    parser_classes = (parsers.FormParser, parsers.MultiPartParser, parsers.JSONParser,)
    renderer_classes = (renderers.JSONRenderer,)

    def post(self, request):
        headers = {}
        context = { 'request': request }
        serializer = AuthTokenSerializer(data=request.data, context=context)
        if serializer.is_valid():
            key = serializer.validated_data

            trust_dev = False
            try:
                trust_dev_header = int(request.META.get('HTTP_X_SEAFILE_2FA_TRUST_DEVICE', ''))
                trust_dev = True if trust_dev_header == 1 else False
            except ValueError:
                trust_dev = False

            skip_2fa_header = request.META.get('HTTP_X_SEAFILE_S2FA', None)
            if skip_2fa_header is None:
                if trust_dev:
                    # 2fa login with trust device,
                    # create new session, and return session id.
                    pass
                else:
                    # No 2fa login or 2fa login without trust device,
                    # return token only.
                    return Response({'token': key})
            else:
                # 2fa login without OTP token,
                # get or create session, and return session id
                pass

            SessionStore = import_module(dj_settings.SESSION_ENGINE).SessionStore
            s = SessionStore(skip_2fa_header)
            if not s.exists(skip_2fa_header) or s.is_empty():
                from seahub.two_factor.views.login import remember_device
                s = remember_device(request.data['username'])

            headers = {
                'X-SEAFILE-S2FA': s.session_key
            }
            return Response({'token': key}, headers=headers)

        if serializer.two_factor_auth_failed:
            # Add a special response header so the client knows to ask the user
            # for the 2fa token.
            headers = {
                'X-Seafile-OTP': 'required',
            }

        return Response(serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST,
                        headers=headers)


class AccountInfo(APIView):
    """ Show account info.
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle, )

    def _get_account_info(self, request):
        info = {}
        email = request.user.username
        p = Profile.objects.get_profile_by_user(email)
        can_run_python = False
        is_cloud_personal_account = False
        if is_org_context(request):
            org_id = request.user.org.org_id
            is_org_staff = request.user.org.is_staff
            info['org_id'] = org_id
            info['is_org_staff'] = is_org_staff
            # quota
            quota_total = OrgQuota.objects.get_asset_quota(org_id)
            quota_usage = Workspaces.objects.get_org_total_storage(org_id)
            if quota_total is not None and quota_total > 0:
                info['space_usage'] = str(float(quota_usage) / quota_total * 100) + '%'
            else:                       # no space quota set in config
                info['space_usage'] = '0%'
            info['total'] = quota_total
            info['usage'] = quota_usage
            # rows
            row_usage = OrgRowsCount.objects.get_org_rows_count(org_id)
            row_total = OrgQuota.objects.get_row_limit(org_id)
            if row_total is not None and row_total > 0:
                info['row_usage_rate'] = str(float(row_usage) / row_total * 100) + '%'
            else:
                info['row_usage_rate'] = '0%'
            info['row_total'] = row_total
            info['row_usage'] = row_usage
            # scripts running
            role = OrgSettings.objects.get_role_by_org(request.user.org)
            can_run_python = can_org_run_python(request.user.org)
            # org big_data info
            big_data_total_rows = OrgBigDataStorageStats.objects.get_org_big_data_total_rows(org_id)
            big_data_row_limit = OrgQuota.objects.get_big_data_row_limit(org_id)
            big_data_total_storage = OrgBigDataStorageStats.objects.get_org_big_data_total_storage(org_id)
            big_data_storage_quota = OrgQuota.objects.get_big_data_storage_quota(org_id)

            info['big_data_total_rows'] = big_data_total_rows
            info['big_data_row_limit'] = big_data_row_limit
            if big_data_row_limit is not None and big_data_row_limit > 0:
                info['big_data_row_usage_rate'] = str(float(big_data_total_rows) / big_data_row_limit * 100) + '%'
            else:
                info['big_data_row_usage_rate'] = '0%'

            info['big_data_total_storage'] = big_data_total_storage
            info['big_data_storage_quota'] = big_data_storage_quota
            if big_data_storage_quota is not None and big_data_storage_quota > 0:
                info['big_data_storage_usage_rate'] = str(float(big_data_total_storage) / big_data_storage_quota * 100) + '%'
            else:
                info['big_data_storage_usage_rate'] = '0%'

            # api calls
            info['api_calls_count'] = StatsAPIGatewayByTeam.objects.get_month_all_count(org_id)
            info['api_calls_limit'] = OrgQuota.objects.get_monthly_api_call_limit(org_id)
            if info['api_calls_limit'] > 0:
                info['api_calls_usage_rate'] = str(float(info['api_calls_count']) / info['api_calls_limit'] * 100) + '%'
            else:
                info['api_calls_usage_rate'] = '0%'
        else:
            if request.cloud_mode:
                is_cloud_personal_account = True
            # quota
            quota_total = UserQuota.objects.get_asset_quota(request.user.username, user_obj=request.user)[0]
            quota_usage = Workspaces.objects.get_owner_total_storage(request.user.username)
            if quota_total is not None and quota_total > 0:
                info['space_usage'] = str(float(quota_usage) / quota_total * 100) + '%'
            else:                       # no space quota set in config
                info['space_usage'] = '0%'
            info['total'] = quota_total
            info['usage'] = quota_usage
            # rows
            row_usage = UserRowsCount.objects.get_user_rows_count(email)
            row_total = UserQuota.objects.get_row_limit(request.user.username, user_obj=request.user)[0]
            if row_total is not None and row_total > 0:
                info['row_usage_rate'] = str(float(row_usage) / row_total * 100) + '%'
            else:
                info['row_usage_rate'] = '0%'
            info['row_total'] = row_total
            info['row_usage'] = row_usage
            # run scripts
            role = request.user.role
            can_run_python = can_user_run_python(request.user.username)
            # api calls
            info['api_calls_count'] = StatsAPIGatewayByOwner.objects.get_month_all_count(request.user.username)
            info['api_calls_limit'] = UserQuota.objects.get_monthly_api_call_limit_per_user(request.user.username, user_obj=request.user)
            if info['api_calls_limit'] > 0:
                info['api_calls_usage_rate'] = str(float(info['api_calls_count']) / info['api_calls_limit'] * 100) + '%'
            else:
                info['api_calls_usage_rate'] = '0%'

        url, _, _ = api_avatar_url(email)
        info['is_cloud_personal_account'] = is_cloud_personal_account
        info['avatar_url'] = url
        info['email'] = email
        info['name'] = email2nickname(email)
        info['login_id'] = p.login_id if p and p.login_id else ""
        info['contact_email'] = p.contact_email if p else ""
        info['institution'] = p.institution if p and p.institution else ""
        info['is_staff'] = request.user.is_staff
        info['enable_subscription'] = subscription_check()

        if dj_settings.SEATABLE_FAAS_URL and can_run_python:
            info['scripts_running_total'] = get_enabled_role_permissions_by_role(role).get('scripts_running_limit', -1)
            # get user/org scripts-running count
            try:
                url = dj_settings.SEATABLE_FAAS_URL.strip('/') + '/scripts-running-count/'
                headers = {'Authorization': 'Token ' + dj_settings.SEATABLE_FAAS_AUTH_TOKEN}
                if is_org_context(request):
                    params = {'org_id': request.user.org.org_id}
                else:
                    params = {'username': request.user.username}
                response = requests.get(url, params=params, headers=headers, timeout=10)
                if response.status_code != 200:
                    logger.error('get scripts_running_count error response: %s', response)
                    scripts_running_count = -1
                else:
                    scripts_running_count = response.json()['count']
            except Exception as e:
                logger.error('scripts_running_count error: %s', e)
                scripts_running_count = -1

            info['scripts_running_count'] = scripts_running_count
            if scripts_running_count == -1 or info['scripts_running_total'] == -1:
                info['scripts_running_usage_rate'] = '0%'
            else:
                info['scripts_running_usage_rate'] = str(float(scripts_running_count) / info['scripts_running_total'] * 100) + '%'

        if getattr(settings, 'ENABLE_SEATABLE_AI', False) and getattr(settings, 'SEATABLE_AI_SERVER_URL', ''):
            if is_org_context(request):
                org_id = request.user.org.org_id
                info['ai_credit'] = get_ai_credit_by_org_id(org_id)
                info['ai_cost'] = round(get_ai_cost_by_org_id(org_id), 2)
            else:
                info['ai_credit'] = get_ai_credit_by_owner_id(request.user.username)
                info['ai_cost'] = round(get_ai_cost_by_owner_id(request.user.username), 2)
            if info['ai_credit'] == -1:
                info['ai_usage_rate'] = '0%'
            else:
                info['ai_usage_rate'] = str(info['ai_cost'] / info['ai_credit'] * 100) + '%'

        if getattr(settings, 'MULTI_INSTITUTION', False):
            info['is_inst_admin'] = request.user.inst_admin

        dtable_updates_email_interval = UserOptions.objects.get_dtable_updates_email_interval(email)
        info['dtable_updates_email_interval'] = dtable_updates_email_interval if dtable_updates_email_interval is not None else 0
        dtable_collaborate_email_interval = UserOptions.objects.get_dtable_collaborate_email_interval(email)
        info['dtable_collaborate_email_interval'] = dtable_collaborate_email_interval if dtable_collaborate_email_interval is not None else 0
        return info

    def get(self, request, format=None):
        return Response(self._get_account_info(request))

    def put(self, request, format=None):
        """Update account info.
        """
        username = request.user.username

        name = request.data.get("name", None)
        if name is not None:
            if len(name) > 64:
                return api_error(status.HTTP_400_BAD_REQUEST,
                        _('Name is too long (maximum is 64 characters)'))

            if "/" in name:
                return api_error(status.HTTP_400_BAD_REQUEST,
                        _("Name should not include '/'."))

        dtable_updates_email_interval = request.data.get("dtable_updates_email_interval", None)
        if dtable_updates_email_interval is not None:
            try:
                dtable_updates_email_interval = int(dtable_updates_email_interval)
            except ValueError:
                return api_error(
                    status.HTTP_400_BAD_REQUEST, 'dtable_updates_email_interval invalid')

        dtable_collaborate_email_interval = request.data.get("dtable_collaborate_email_interval", None)
        if dtable_collaborate_email_interval is not None:
            try:
                dtable_collaborate_email_interval = int(dtable_collaborate_email_interval)
            except ValueError:
                return api_error(
                    status.HTTP_400_BAD_REQUEST, 'dtable_collaborate_email_interval invalid')

        # update user info

        if name is not None:
            profile = Profile.objects.get_profile_by_user(username)
            if profile is None:
                profile = Profile(user=username)
            profile.nickname = name
            profile.save()

        if dtable_updates_email_interval is not None:
            if dtable_updates_email_interval <= 0:
                UserOptions.objects.unset_dtable_updates_email_interval(username)
            else:
                UserOptions.objects.set_dtable_updates_email_interval(
                    username, dtable_updates_email_interval)

        if dtable_collaborate_email_interval is not None:
            UserOptions.objects.set_dtable_collaborate_email_interval(
                username, dtable_collaborate_email_interval)

        return Response(self._get_account_info(request))

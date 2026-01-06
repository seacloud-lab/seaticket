# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import logging
from importlib import import_module

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
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.options.models import UserOptions
from seahub.profile.models import Profile
from seahub.utils import is_org_context
import seahub.settings as settings
from seahub.project.utils import get_ai_credit_by_org_id, get_ai_cost_by_org_id, \
    get_ai_credit_by_owner_id, get_ai_cost_by_owner_id


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
        is_cloud_personal_account = False
        if is_org_context(request):
            org_id = request.user.org.org_id
            is_org_staff = request.user.org.is_staff
            info['org_id'] = org_id
            info['is_org_staff'] = is_org_staff
        else:
            if request.cloud_mode:
                is_cloud_personal_account = True

        url, _, _ = api_avatar_url(email)
        info['is_cloud_personal_account'] = is_cloud_personal_account
        info['avatar_url'] = url
        info['email'] = email
        info['name'] = email2nickname(email)
        info['login_id'] = p.login_id if p and p.login_id else ""
        info['contact_email'] = p.contact_email if p else ""
        info['institution'] = p.institution if p and p.institution else ""
        info['is_staff'] = request.user.is_staff

        if getattr(settings, 'MULTI_INSTITUTION', False):
            info['is_inst_admin'] = request.user.inst_admin

        project_updates_email_interval = UserOptions.objects.get_project_updates_email_interval(email)
        info[
            'project_updates_email_interval'] = project_updates_email_interval if project_updates_email_interval is not None else 0
        collaborate_email_interval = UserOptions.objects.get_collaborate_email_interval(email)
        info['collaborate_email_interval'] = collaborate_email_interval if collaborate_email_interval is not None else 0

        # AI statistics
        if getattr(settings, 'SEAQA_AI_INNER_SERVER_URL', ''):
            if is_org_context(request):
                org_id = request.user.org.org_id
                info['ai_credit'] = get_ai_credit_by_org_id(org_id)
                info['ai_cost'] = round(get_ai_cost_by_org_id(org_id), 2)
            else:
                info['ai_credit'] = get_ai_credit_by_owner_id(request.user.username)
                info['ai_cost'] = round(get_ai_cost_by_owner_id(request.user.username), 2)

            if info['ai_credit'] <= 0:
                info['ai_usage_rate'] = '0%'
            else:
                info['ai_usage_rate'] = str(info['ai_cost'] / info['ai_credit'] * 100) + '%'

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

        project_updates_email_interval = request.data.get("project_updates_email_interval", None)
        if project_updates_email_interval is not None:
            try:
                project_updates_email_interval = int(project_updates_email_interval)
            except ValueError:
                return api_error(
                    status.HTTP_400_BAD_REQUEST, 'project_updates_email_interval invalid')

        collaborate_email_interval = request.data.get("collaborate_email_interval", None)
        if collaborate_email_interval is not None:
            try:
                collaborate_email_interval = int(collaborate_email_interval)
            except ValueError:
                return api_error(
                    status.HTTP_400_BAD_REQUEST, 'collaborate_email_interval invalid')

        # update user info

        if name is not None:
            profile = Profile.objects.get_profile_by_user(username)
            if profile is None:
                profile = Profile(user=username)
            profile.nickname = name
            profile.save()

        if project_updates_email_interval is not None:
            if project_updates_email_interval <= 0:
                UserOptions.objects.unset_project_updates_email_interval(username)
            else:
                UserOptions.objects.set_project_updates_email_interval(
                    username, project_updates_email_interval)

        if collaborate_email_interval is not None:
            UserOptions.objects.set_collaborate_email_interval(
                username, collaborate_email_interval)

        return Response(self._get_account_info(request))

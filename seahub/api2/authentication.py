# Copyright (c) 2012-2016 Seafile Ltd.
import datetime
import logging
import jwt

from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import APIException

from seaserv import ccnet_api
from seahub.base.accounts import User
from seahub.api2.models import Token, TokenV2
from seahub.api2.utils import get_client_ip
from seahub.constants import DEFAULT_USER
from seahub.profile.settings import ROLE_CACHE_PREFIX, ROLE_CACHE_TIMEOUT
from seahub.utils import within_time_range, normalize_cache_key
from seahub.utils.auth import AUTHORIZATION_PREFIX
from django.core.cache import cache
from seahub.settings import DTABLE_PRIVATE_KEY
try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False

logger = logging.getLogger(__name__)


HEADER_CLIENT_VERSION = 'HTTP_X_SEAFILE_CLIENT_VERSION'
HEADER_PLATFORM_VERSION = 'HTTP_X_SEAFILE_PLATFORM_VERSION'

class AuthenticationFailed(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Incorrect authentication credentials.'

    def __init__(self, detail=None):
        self.detail = detail or self.default_detail

class DeviceRemoteWipedException(AuthenticationFailed):
    pass

class TokenAuthentication(BaseAuthentication):
    """
    Simple token based authentication.

    Clients should authenticate by passing the token key in the "Authorization"
    HTTP header, prepended with the string "Token ".  For example:

        Authorization: Token 401f7ac837da42b97f613d789819ff93537bee6a

    A custom token model may be used, but must have the following properties.

    * key -- The string identifying the token
    * user -- The user to which the token belongs
    """
    def user_role(self, user):
        role_cache_key = normalize_cache_key(str(user.org.org_id), ROLE_CACHE_PREFIX)
        role = cache.get(role_cache_key, None)
        if role:
            return role
        if not user.role or user.role == DEFAULT_USER:
            from seahub.organizations.models import OrgSettings
            role = OrgSettings.objects.get_role_by_org(user.org)
            cache.set(role_cache_key, role, ROLE_CACHE_TIMEOUT)
            return role


    def authenticate(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX:
            return None

        if len(auth) == 1:
            msg = 'Invalid token header. No credentials provided.'
            raise AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = 'Invalid token header. Token string should not contain spaces.'
            raise AuthenticationFailed(msg)

        key = auth[1]

        return self.authenticate_v1(request, key)

    def authenticate_v1(self, request, key):
        try:
            token = Token.objects.get(key=key)
        except Token.DoesNotExist:
            raise AuthenticationFailed('Invalid token')

        try:
            user = User.objects.get(email=token.user)
        except User.DoesNotExist:
            raise AuthenticationFailed('User inactive or deleted')

        if MULTI_TENANCY:
            orgs = ccnet_api.get_orgs_by_user(token.user)
            if orgs:
                user.org = orgs[0]
                user.role = self.user_role(user)

        if user.is_active:
            return (user, token)


class SdocJWTTokenAuthentication(BaseAuthentication):

    def authenticate(self, request):
        """ sdoc jwt token
        """
        from seahub.seadoc.utils import is_valid_seadoc_access_token
        file_uuid = request.parser_context['kwargs'].get('file_uuid')
        if not file_uuid:
            if request._request.method == 'POST':
                file_uuid = request._request.POST.get('file_uuid')
            elif request._request.method == 'GET':
                file_uuid = request._request.GET.get('file_uuid')
        auth = request.headers.get('authorization', '').split()
        is_valid, payload = is_valid_seadoc_access_token(auth, file_uuid, return_payload=True)
        if not is_valid:
            return None

        username = payload.get('username')
        if not username:
            return None
        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            user = None
        if not user or not user.is_active:
            return None

        return user, auth[1]

class AIAssistantTokenAuthentication(BaseAuthentication):
    """
    Simple token based authentication.

    Clients should authenticate by passing the token key in the "Authorization"
    HTTP header, prepended with the string "Token ".  For example:

        Authorization: Token 401f7ac837da42b97f613d789819ff93537bee6a

    A custom token model may be used, but must have the following properties.

    * key -- The string identifying the token
    * user -- The user to which the token belongs
    """
    def user_role(self, user):
        role_cache_key = normalize_cache_key(str(user.org.org_id), ROLE_CACHE_PREFIX)
        role = cache.get(role_cache_key, None)
        if role:
            return role
        if not user.role or user.role == DEFAULT_USER:
            from seahub.organizations.models import OrgSettings
            role = OrgSettings.objects.get_role_by_org(user.org)
            cache.set(role_cache_key, role, ROLE_CACHE_TIMEOUT)
            return role

    def authenticate(self, request):
        from seahub.ai.utils import is_valid_ai_assistant_access_token
        assistant_uuid = request.resolver_match.kwargs.get('assistant_uuid')

        if not assistant_uuid:
            assistant_uuid = request.data.get('assistant_uuid')

        if not assistant_uuid:
            assistant_uuid = request.GET.get('assistant_uuid')

        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_ai_assistant_access_token(auth, assistant_uuid)

        if not is_valid:
            return None

        username = payload.get('username')
        if not username:
            return None
        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            raise AuthenticationFailed('User inactive or deleted')

        if MULTI_TENANCY:
            orgs = ccnet_api.get_orgs_by_user(username)
            if orgs:
                user.org = orgs[0]
                user.role = self.user_role(user)

        user.is_auth_by_jwt = True
        if user.is_active:
            return user, auth[1]

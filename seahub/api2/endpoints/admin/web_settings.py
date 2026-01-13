# Copyright (c) 2012-2019 Seafile Ltd.

import logging
import re

from django.conf import settings as dj_settings
from django.utils.translation import gettext as _

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
logger = logging.getLogger(__name__)

DIGIT_WEB_SETTINGS = [
    'ENABLE_SIGNUP',
    'LOGIN_REMEMBER_DAYS', 'USER_STRONG_PASSWORD_REQUIRED',
    'FORCE_PASSWORD_CHANGE',
    'LOGIN_ATTEMPT_LIMIT', 'FREEZE_USER_ON_LOGIN_FAILED',
    'ENABLE_TWO_FACTOR_AUTH',
    'ENABLE_BRANDING_CSS',
]

STRING_WEB_SETTINGS = ('SITE_NAME', 'SITE_TITLE', 'CUSTOM_CSS')


SITE_NAME_REGEX = r'^[^\\<>/]+$'
def validate_settings_value(key, value):
    if key in ['SITE_NAME', 'SITE_TITLE']:
        if re.match(SITE_NAME_REGEX, value):
            return value
        else:
            return None
    return value

class AdminWebSettings(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        error_msg = 'Web settings not supported.'
        return api_error(status.HTTP_404_NOT_FOUND, error_msg)

    def put(self, request):
        error_msg = 'Web settings not supported.'
        return api_error(status.HTTP_404_NOT_FOUND, error_msg)

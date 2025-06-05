# Copyright (c) 2012-2019 Seafile Ltd.

import logging
import re
from constance import config

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
        if not dj_settings.ENABLE_SETTINGS_VIA_WEB or not dj_settings.CONSTANCE_ENABLED:
            error_msg = 'Web settings not supported.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not request.user.admin_permissions.can_config_system():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        config_dict = {}
        for key in DIGIT_WEB_SETTINGS:
            value = getattr(config, key)
            config_dict[key] = value

        for key in STRING_WEB_SETTINGS:
            value = getattr(config, key)
            config_dict[key] = value

        return Response(config_dict)

    def put(self, request):

        if not dj_settings.ENABLE_SETTINGS_VIA_WEB or not dj_settings.CONSTANCE_ENABLED:
            error_msg = 'Web settings not supported.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not request.user.admin_permissions.can_config_system():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        for key, value in request.data.items():

            if key not in DIGIT_WEB_SETTINGS and key not in STRING_WEB_SETTINGS:
                error_msg = _(u'setting invalid.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if key in DIGIT_WEB_SETTINGS:
                if not value.isdigit():
                    error_msg = _(u'value invalid.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                else:
                    value = int(value)

                if key == 'USER_PASSWORD_STRENGTH_LEVEL' and value not in (1, 2, 3, 4):
                    error_msg = _(u'value invalid.')
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if key in STRING_WEB_SETTINGS and not value:
                error_msg = _(u'value invalid.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
             
            value = validate_settings_value(key, value)
            if value is None:
                error_msg = _(u'value invalid.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            try:
                setattr(config, key, value)
            except AttributeError as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        config_dict = {}
        for key in DIGIT_WEB_SETTINGS:
            value = getattr(config, key)
            config_dict[key] = value

        for key in STRING_WEB_SETTINGS:
            value = getattr(config, key)
            config_dict[key] = value

        return Response(config_dict)

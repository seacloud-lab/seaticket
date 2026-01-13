# Copyright (c) 2012-2016 Seafile Ltd.
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response

from seahub.base.accounts import User
from seahub.api2.base import APIView
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.api2.authentication import TokenAuthentication
from seahub.options.models import UserOptions
from seahub.two_factor.models import devices_for_user
import logging
from seahub.settings import ENABLE_TWO_FACTOR_AUTH

logger = logging.getLogger(__name__)


class TwoFactorAuthView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def put(self, request, email):
        """Set/unset force 2FA for the user `email`.
        """
        if not ENABLE_TWO_FACTOR_AUTH:
            error_msg = 'Two factor auth is not enabled'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = "User %s not found" % email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        force_2fa = request.data.get('force_2fa', None)
        if str(force_2fa) == '1':
            UserOptions.objects.set_force_2fa(email)
        elif str(force_2fa) == '0':
            UserOptions.objects.unset_force_2fa(email)

        return Response({'success': True})

    def delete(self, request, email):
        if not ENABLE_TWO_FACTOR_AUTH:
            error_msg = 'Two factor auth is not enabled'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not email:
            error_msg = "email can not be empty"
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            error_msg = "User %s not found" % email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            devices = devices_for_user(user)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        if devices:
            for device in devices:
                device.delete()

        return Response({'success': True})

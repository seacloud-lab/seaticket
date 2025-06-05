# Copyright (c) 2012-2016 Seafile Ltd.

import re

from constance import config
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.utils.deprecation import MiddlewareMixin

from . import DEVICE_ID_SESSION_KEY
from .models import Device
from seahub.options.models import UserOptions
from seahub.organizations.models import OrgAdminSettings
from seahub.settings import SITE_ROOT, ENABLE_FORCE_2FA_TO_ALL_USERS
from seahub.utils import is_org_context


class IsVerified(object):
    """ A pickle-friendly lambda. """
    def __init__(self, user):
        self.user = user

    def __call__(self):
        return (self.user.otp_device is not None)


class OTPMiddleware(MiddlewareMixin):
    """
    This must be installed after
    :class:`~django.contrib.auth.middleware.AuthenticationMiddleware` and
    performs an analagous function. Just as AuthenticationMiddleware populates
    ``request.user`` based on session data, OTPMiddleware populates
    ``request.user.otp_device`` to the :class:`~seahub.django_otp.models.Device`
    object that has verified the user, or ``None`` if the user has not been
    verified.  As a convenience, this also installs ``user.is_verified()``,
    which returns ``True`` if ``user.otp_device`` is not ``None``.
    """
    def process_request(self, request):
        if not config.ENABLE_TWO_FACTOR_AUTH:
            return None

        user = getattr(request, 'user', None)

        if user is None:
            return None

        user.otp_device = None
        user.is_verified = IsVerified(user)

        if user.is_anonymous:
            return None

        device_id = request.session.get(DEVICE_ID_SESSION_KEY)
        device = Device.from_persistent_id(device_id) if device_id else None

        if (device is not None) and (device.user != user.email):
            device = None

        if (device is None) and (DEVICE_ID_SESSION_KEY in request.session):
            del request.session[DEVICE_ID_SESSION_KEY]

        user.otp_device = device

        return None


class ForceTwoFactorAuthMiddleware(MiddlewareMixin):
    def filter_request(self, request):
        path = request.path
        black_list = (r'^%s$' % SITE_ROOT, r'sys/.+', r'repo/.+', r'lib/', r'profile/$')

        for patt in black_list:
            if re.search(patt, path) is not None:
                return True
        return False

    def _is_redirect_2fa(self, request):
        user = request.user
        if ENABLE_FORCE_2FA_TO_ALL_USERS:
            return True
        if UserOptions.objects.is_force_2fa(user.username):
            return True
        if is_org_context(request):
            return OrgAdminSettings.objects.is_enable_force_2fa_by_org_id(user.org.org_id)
        return False

    def process_request(self, request):
        if not config.ENABLE_TWO_FACTOR_AUTH:
            return None

        user = getattr(request, 'user', None)
        if user is None:
            return None

        if user.is_anonymous:
            return None

        if not self.filter_request(request):
            return None

        if user.otp_device is not None:
            return None

        if self._is_redirect_2fa(request):
            return HttpResponseRedirect(reverse('two_factor:setup'))

        return None


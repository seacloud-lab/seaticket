import os
import pytest
from django.urls import reverse
from django.test import override_settings

from seahub.options.models import (UserOptions, KEY_FORCE_2FA, VAL_FORCE_2FA)
from seahub.test_utils import BaseTestCase
from seahub.two_factor.models import TOTPDevice, devices_for_user
from constance import config


class TwoFactorAuthViewTest(BaseTestCase):
    def setUp(self):
        self.login_as(self.admin)

    def tearDown(self):
        try:
            for device in devices_for_user(self.admin):
                device.delete()
        except:
            pass

    def test_force_2fa(self):
        setattr(config, 'ENABLE_TWO_FACTOR_AUTH', True)
        assert len(UserOptions.objects.filter(email=self.user.email,
                                              option_key=KEY_FORCE_2FA)) == 0

        resp = self.client.put(
            reverse('two-factor-auth-view', args=[self.user.username]),
            'force_2fa=1',
            'application/x-www-form-urlencoded',
        )
        self.assertEqual(200, resp.status_code)

        assert len(UserOptions.objects.filter(email=self.user.email,
                                              option_key=KEY_FORCE_2FA)) == 1

        resp = self.client.put(
            reverse('two-factor-auth-view', args=[self.user.username]),
            'force_2fa=0',
            'application/x-www-form-urlencoded',
        )
        self.assertEqual(200, resp.status_code)

        assert len(UserOptions.objects.filter(email=self.user.email,
                                              option_key=KEY_FORCE_2FA)) == 0

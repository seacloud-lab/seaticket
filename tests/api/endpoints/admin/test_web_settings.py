import json
from django.urls import reverse
from django.test import override_settings

from seahub.test_utils import BaseTestCase


class AdminWebSettingsTest(BaseTestCase):
    def setUp(self):
        self.url = reverse('api-v2.1-web-settings')
        self.login_as(self.admin)

    def test_get_web_settings_info(self):
        resp = self.client.get(self.url)
        self.assertEqual(200, resp.status_code)

        json_resp = json.loads(resp.content)
        assert len(json_resp) == 11

    @override_settings(ENABLE_SETTINGS_VIA_WEB = False)
    def test_get_with_enable_settings(self):
        resp = self.client.get(self.url)
        self.assertEqual(404, resp.status_code)

    def test_update_web_settings_info(self):
        data = {
            "ENABLE_BRANDING_CSS": False,
            "CUSTOM_CSS": "test_style",
            "SITE_NAME": "Seafile",
            "LOGIN_REMEMBER_DAYS": 7,
            "SITE_TITLE": "Private Seafile",
            "USER_STRONG_PASSWORD_REQUIRED": 0,
            "FORCE_PASSWORD_CHANGE": True,
            "FREEZE_USER_ON_LOGIN_FAILED": False,
            "ENABLE_TWO_FACTOR_AUTH": False,
            "ENABLE_SIGNUP": False,
            "LOGIN_ATTEMPT_LIMIT": 5
        }
        for key, value in data.items():
            if value in (True, False):
                value = '1' if value else '0'
            data_pair = key + '=' + str(value)

            resp = self.client.put(self.url, data_pair, 'application/x-www-form-urlencoded')
            json_resp = json.loads(resp.content)
            self.assertEqual(200, resp.status_code)
            assert str(json_resp[key]) == str(value)

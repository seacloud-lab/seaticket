#coding: UTF-8
"""
Test auth related api, such as login/logout.
"""

import os
import time
import requests
import pytest

from tests.common.common import USERNAME, PASSWORD, BASE_URL, SEAFILE_BASE_URL
from tests.common.utils import randstring, urljoin
from tests.api.urls import (
    AUTH_PING_URL, TOKEN_URL, DOWNLOAD_REPO_URL, LOGOUT_DEVICE_URL,
    CLIENT_LOGIN_TOKEN_URL
)
from tests.api.apitestbase import ApiTestBase

if not BASE_URL.endswith('/'):
    BASE_URL = BASE_URL + '/'


def fake_ccnet_id():
    return randstring(length=40)

class AuthTest(ApiTestBase):
    """This tests involves creating/deleting api tokens, so for this test we
    use a specific auth token so that it won't affect other test cases.
    """
    def test_auth_token_missing(self):
        return self.get(AUTH_PING_URL, token=None, use_token=False,
                        expected=403)

    def test_auth_token_is_empty(self):
        return self.get(AUTH_PING_URL, token='', expected=401)

    def test_auth_token_contains_space(self):
        return self.get(AUTH_PING_URL, token='token with space', expected=401)

    def test_random_auth_token(self):
        return self.get(AUTH_PING_URL, token='randomtoken', expected=401)

    def _do_auth_ping(self, token, **kwargs):
        return self.get(AUTH_PING_URL, token=token, **kwargs)

    def _clone_repo(self, token, repo_id):
        return self.get(DOWNLOAD_REPO_URL % repo_id, token=token).json()['token']

    def _get_repo_info(self, sync_token, repo_id, **kwargs):
        headers = {
            'Seafile-Repo-Token': sync_token
        }
        url = urljoin(SEAFILE_BASE_URL,
                      'repo/%s/permission-check/?op=upload' % repo_id)
        self.get(url, use_token=False, headers=headers, **kwargs)

    def _logout(self, token):
        self.post(LOGOUT_DEVICE_URL, token=token)

    def _get_client_login_url(self, admin=False):
        post = self.admin_post if admin else self.post
        token = post(CLIENT_LOGIN_TOKEN_URL).json()['token']
        assert len(token) == 32
        return urljoin(BASE_URL, 'client-login/') + '?token=' + token

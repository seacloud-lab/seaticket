# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8

from django.urls import re_path
from seahub.dingtalk.views import dingtalk_login, dingtalk_callback, \
    dingtalk_connect, dingtalk_connect_callback, dingtalk_disconnect

urlpatterns = [
    re_path(r'oauth-login/$', dingtalk_login, name='dingtalk_login'),
    re_path(r'oauth-callback/$', dingtalk_callback, name='dingtalk_callback'),
    re_path(r'oauth-connect/$', dingtalk_connect, name='dingtalk_connect'),
    re_path(r'oauth-connect-callback/$', dingtalk_connect_callback, name='dingtalk_connect_callback'),
    re_path(r'oauth-disconnect/$', dingtalk_disconnect, name='dingtalk_disconnect'),
]

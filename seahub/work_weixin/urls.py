# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8

from django.urls import re_path
from seahub.work_weixin.views import work_weixin_oauth_login, work_weixin_oauth_callback, \
    work_weixin_oauth_connect, work_weixin_oauth_connect_callback, work_weixin_oauth_disconnect

urlpatterns = [
    re_path(r'oauth-login/$', work_weixin_oauth_login, name='work_weixin_oauth_login'),
    re_path(r'oauth-callback/$', work_weixin_oauth_callback, name='work_weixin_oauth_callback'),
    re_path(r'oauth-connect/$', work_weixin_oauth_connect, name='work_weixin_oauth_connect'),
    re_path(r'oauth-connect-callback/$', work_weixin_oauth_connect_callback, name='work_weixin_oauth_connect_callback'),
    re_path(r'oauth-disconnect/$', work_weixin_oauth_disconnect, name='work_weixin_oauth_disconnect'),
]

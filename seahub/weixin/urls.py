# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8

from django.urls import re_path
from seahub.weixin.views import weixin_oauth_login, weixin_oauth_callback, \
    weixin_oauth_connect, weixin_oauth_connect_callback, weixin_oauth_disconnect

urlpatterns = [
    re_path(r'oauth-login/$', weixin_oauth_login, name='weixin_oauth_login'),
    re_path(r'oauth-callback/$', weixin_oauth_callback, name='weixin_oauth_callback'),
    re_path(r'oauth-connect/$', weixin_oauth_connect, name='weixin_oauth_connect'),
    re_path(r'oauth-connect-callback/$', weixin_oauth_connect_callback, name='weixin_oauth_connect_callback'),
    re_path(r'oauth-disconnect/$', weixin_oauth_disconnect, name='weixin_oauth_disconnect'),
]

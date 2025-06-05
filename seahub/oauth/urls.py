# Copyright (c) 2012-2016 Seafile Ltd.

from django.urls import re_path
from seahub.oauth.views import oauth_login, oauth_callback, \
    custom_oauth_login_view, custom_oauth_callback_view

import seahub.settings as settings
ENABLE_CUSTOM_OAUTH = getattr(settings, 'ENABLE_CUSTOM_OAUTH', False)


urlpatterns = [
    re_path(r'^login/$', oauth_login, name='oauth_login'),
    re_path(r'^callback/$', oauth_callback, name='oauth_callback'),
]

if ENABLE_CUSTOM_OAUTH:
    urlpatterns = [
        re_path(r'^login/$', custom_oauth_login_view, name='oauth_login'),
        re_path(r'^callback/$', custom_oauth_callback_view, name='oauth_callback'),
   ]

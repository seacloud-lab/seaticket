# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from .views import *
from .endpoints.admin.two_factor_auth import TwoFactorAuthView
from .endpoints.admin.account import Account
from .endpoints.search_user import SearchUser

urlpatterns = [
    re_path(r'^ping/$', Ping.as_view()),
    re_path(r'^auth/ping/$', AuthPing.as_view()),
    re_path(r'^auth-token/', ObtainAuthToken.as_view()),
    re_path(r'^two-factor-auth/(?P<email>\S+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/$', TwoFactorAuthView.as_view(), name="two-factor-auth-view"),

    # RESTful API
    re_path(r'^accounts/(?P<email>\S+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/$', Account.as_view(), name="api2-account"),
    re_path(r'^account/info/$', AccountInfo.as_view()),
    re_path(r'^account/ai-limit/$', AccountAILimitInfo.as_view()),
    re_path(r'^search-user/$', SearchUser.as_view(), name='search-user'),
]

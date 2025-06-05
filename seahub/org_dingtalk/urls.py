from django.urls import re_path
from seahub.org_dingtalk.views import sync_http_view, \
    org_dingtalk_bind, org_dingtalk_bind_callback, org_dingtalk_oauth_login, \
    org_dingtalk_oauth_callback, org_dingtalk_oauth_connect, \
    org_dingtalk_oauth_connect_callback, org_dingtalk_oauth_disconnect, \
    org_dingtalk_oauth_logon_free

urlpatterns = [
    re_path(r'sync-http/$', sync_http_view, name='org_dingtalk_sync_http'),

    re_path(r'bind/$', org_dingtalk_bind, name='org_dingtalk_bind'),
    re_path(r'bind-callback/$', org_dingtalk_bind_callback, name='org_dingtalk_bind_callback'),

    re_path(r'oauth-logon-free/$', org_dingtalk_oauth_logon_free, name='org_dingtalk_oauth_logon_free'),
    re_path(r'oauth-login/$', org_dingtalk_oauth_login, name='org_dingtalk_oauth_login'),
    re_path(r'oauth-callback/$', org_dingtalk_oauth_callback, name='org_dingtalk_oauth_callback'),
    re_path(r'oauth-connect/$', org_dingtalk_oauth_connect, name='org_dingtalk_oauth_connect'),
    re_path(r'oauth-connect-callback/$', org_dingtalk_oauth_connect_callback, name='org_dingtalk_oauth_connect_callback'),
    re_path(r'oauth-disconnect/$', org_dingtalk_oauth_disconnect, name='org_dingtalk_oauth_disconnect'),
]

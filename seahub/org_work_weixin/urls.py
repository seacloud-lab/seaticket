from django.urls import re_path
from seahub.org_work_weixin.views import receive_msg_view, receive_suite_view, \
    org_work_weixin_bind, org_work_weixin_bind_callback, org_work_weixin_oauth_login, \
    org_work_weixin_oauth_callback, org_work_weixin_oauth_connect, \
    org_work_weixin_oauth_connect_callback, org_work_weixin_oauth_disconnect, \
    org_work_weixin_install, org_work_weixin_install_callback, org_work_weixin_register, \
    org_work_weixin_org_manage_callback

urlpatterns = [
    re_path(r'receive-msg/$', receive_msg_view, name='org_work_weixin_receive_msg'),
    re_path(r'receive-suite/$', receive_suite_view, name='org_work_weixin_receive_suite'),

    re_path(r'bind/$', org_work_weixin_bind, name='org_work_weixin_bind'),
    re_path(r'bind-callback/$', org_work_weixin_bind_callback, name='org_work_weixin_bind_callback'),

    re_path(r'oauth-login/$', org_work_weixin_oauth_login, name='org_work_weixin_oauth_login'),
    re_path(r'oauth-callback/$', org_work_weixin_oauth_callback, name='org_work_weixin_oauth_callback'),
    re_path(r'oauth-connect/$', org_work_weixin_oauth_connect, name='org_work_weixin_oauth_connect'),
    re_path(r'oauth-connect-callback/$', org_work_weixin_oauth_connect_callback, name='org_work_weixin_oauth_connect_callback'),
    re_path(r'oauth-disconnect/$', org_work_weixin_oauth_disconnect, name='org_work_weixin_oauth_disconnect'),

    # push button from seatable.cn
    re_path(r'install/$', org_work_weixin_install, name='org_work_weixin_install'),
    re_path(r'install-callback/$', org_work_weixin_install_callback, name='org_work_weixin_install_callback'),
    re_path(r'register/$', org_work_weixin_register, name='org_work_weixin_register'),
    re_path(r'org-manage-callback/$', org_work_weixin_org_manage_callback, name='org_work_weixin_org_manage_callback'),
]

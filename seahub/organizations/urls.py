# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from .views import org_add, org_register, sms_org_register, org_transfer, react_fake_view, react_fake_department_view

urlpatterns = [
    re_path(r'^add/$', org_add, name='org_add'),
    re_path(r'^register/$', org_register, name='org_register'),
    re_path(r'^sms-register/$', sms_org_register, name='sms_org_register'),
    re_path(r'^transfer/$', org_transfer, name='org_transfer'),

    re_path(r'^useradmin/$', react_fake_view, name='org_user_admin'),
    re_path(r'^search-users/$', react_fake_view, name='org_search_users'),
    re_path(r'^useradmin/admins/$', react_fake_view, name='org_useradmin_admins'),
    re_path(r'^projectadmin/$', react_fake_view, name='org_project_admin'),
    re_path(r'^search-dtables/$', react_fake_view, name='org_admin_search_dtables'),
    re_path(r'^useradmin/info/(?P<email>[^/]+)/$', react_fake_view, name='org_user_info'),
    re_path(r'^useradmin/info/(?P<email>[^/]+)/repos/$', react_fake_view, name='org_user_repos'),
    re_path(r'^useradmin/info/(?P<email>[^/]+)/shared-repos/$', react_fake_view, name='org_user_shared_repos'),
    re_path(r'^repoadmin/$', react_fake_view, name='org_repo_admin'),

    re_path(r'^groupadmin/$', react_fake_view, name='org_group_admin'),
    re_path(r'^groupadmin/(?P<group_id>\d+)/$', react_fake_view, name='org_admin_group_info'),
    re_path(r'^groupadmin/(?P<group_id>\d+)/repos/$', react_fake_view, name='org_admin_group_repos'),
    re_path(r'^groupadmin/(?P<group_id>\d+)/dtables/$', react_fake_view, name='org_admin_group_dtables'),
    re_path(r'^groupadmin/(?P<group_id>\d+)/members/$', react_fake_view, name='org_admin_group_members'),
    re_path(r'^admin-logs/operation/$', react_fake_view, name='org_admin_admin_operation_logs'),
    re_path(r'^login-logs/$', react_fake_view, name='org_admin_admin_login_logs'),
    re_path(r'^audit-logs/$', react_fake_view, name='org_admin_admin_audit_logs'),
    re_path(r'^file-access-logs/$', react_fake_view, name='org_admin_admin_file_access_logs'),

    re_path(r'^publinkadmin/$', react_fake_view, name='org_publink_admin'),
    re_path(r'^logadmin/$', react_fake_view, name='org_log_file_audit'),
    re_path(r'^logadmin/file-update/$', react_fake_view, name='org_log_file_update'),
    re_path(r'^logadmin/perm-audit/$', react_fake_view, name='org_log_perm_audit'),

    re_path(r'^orgmanage/$', react_fake_view, name='org_manage'),
    re_path(r'^departmentadmin/$', react_fake_department_view, name='org_department_admin'),
    re_path(r'^departmentadmin/groups/(?P<group_id>\d+)/', react_fake_department_view, name='org_department_admin'),
    re_path(r'^departmentadmin-v2/$', react_fake_department_view, name='org_department_admin_v2'),
    re_path(r'^settings/$', react_fake_view, name='org_settings'),
    re_path(r'^subscription/$', react_fake_view, name='org_subscription'),
    re_path(r'^work-weixin/$', react_fake_view, name='org_work_weixin'),
    re_path(r'^dingtalk/$', react_fake_view, name='org_dingtalk'),
    re_path(r'^external-link/$', react_fake_view, name='org_external_link'),
    re_path(r'^saml-config/$', react_fake_view, name='saml_config'),
]

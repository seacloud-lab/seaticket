# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from seahub.api2.endpoints.org_admin.users import OrgAdminUser, OrgAdminUsers, \
    OrgAdminSearchUsers
from seahub.api2.endpoints.org_admin.user_set_password import OrgAdminUserSetPassword
from seahub.api2.endpoints.org_admin.groups import OrgAdminGroups, OrgAdminGroup, OrgAdminSearchGroups
from seahub.api2.endpoints.org_admin.info import OrgAdminInfo
from seahub.api2.endpoints.org_admin.settings import OrgAdminSettingsView

urlpatterns = [
    re_path(r'^(?P<org_id>\d+)/admin/search-groups/$', OrgAdminSearchGroups.as_view(), name='api-admin-search-groups'),

    re_path(r'^(?P<org_id>\d+)/admin/groups/$', OrgAdminGroups.as_view(), name='api-v2.1-org-admin-groups'),
    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/$', OrgAdminGroup.as_view(), name='api-admin-group'),

    re_path(r'^(?P<org_id>\d+)/admin/users/$', OrgAdminUsers.as_view(), name='api-v2.1-org-admin-users'),
    re_path(r'^(?P<org_id>\d+)/admin/search-users/$', OrgAdminSearchUsers.as_view(), name='api-v2.1-org-admin-search-users'),
    re_path(r'^(?P<org_id>\d+)/admin/users/(?P<email>[^/]+)/$', OrgAdminUser.as_view(), name='api-v2.1-org-admin-user'),
    re_path(r'^(?P<org_id>\d+)/admin/users/(?P<email>[^/]+)/set-password/', OrgAdminUserSetPassword.as_view(), name='api-v2.1-org-admin-user-reset-password'),

    re_path(r'^admin/info/$', OrgAdminInfo.as_view(), name='api-v2.1-org-admin-info'),
    re_path(r'^admin/settings/$', OrgAdminSettingsView.as_view(), name='api-v2.1-org-admin-setting'),

]

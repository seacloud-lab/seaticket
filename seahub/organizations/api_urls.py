# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from seahub.api2.endpoints.org_admin.users import OrgAdminUser, OrgAdminUsers, \
    OrgAdminSearchUsers
from seahub.api2.endpoints.org_admin.user_set_password import OrgAdminUserSetPassword
from seahub.api2.endpoints.org_admin.groups import OrgAdminGroups, OrgAdminGroup, \
    AdminGroupMembers, AdminGroupMember, OrgAdminGroupProjects, OrgAdminGroupProject
from seahub.api2.endpoints.org_admin.info import OrgAdminInfo
from seahub.api2.endpoints.org_admin.settings import OrgAdminSettingsView
from seahub.api2.endpoints.org_admin.projects import OrgAdminProjectsView, OrgAdminProjectView, \
    OrgAdminTrashProjectsView, OrgAdminTrashProjectView, OrgAdminSearchProjectsView
from seahub.api2.endpoints.org_admin.saml_config import OrgSAMLConfigView, OrgVerifyDomain
from seahub.api2.endpoints.org_admin.statistics import OrgAdminAIStatisticsView

urlpatterns = [
    re_path(r'^(?P<org_id>\d+)/admin/groups/$', OrgAdminGroups.as_view(), name='api-v2.1-org-admin-groups'),
    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/$', OrgAdminGroup.as_view(), name='api-admin-group'),

    re_path(r'^(?P<org_id>\d+)/admin/projects/$', OrgAdminProjectsView.as_view(), name='api-v2.1-org-admin-projects'),
    re_path(r'^(?P<org_id>\d+)/admin/projects/(?P<project_id>\d+)/$', OrgAdminProjectView.as_view(), name='api-v2.1-org-admin-project'),
    re_path(r'^(?P<org_id>\d+)/admin/trash-projects/$', OrgAdminTrashProjectsView.as_view(), name='api-v2.1-org-admin-trash-projects'),
    re_path(r'^(?P<org_id>\d+)/admin/trash-projects/(?P<project_id>\d+)/$', OrgAdminTrashProjectView.as_view(), name='api-v2.1-org-admin-trash-project'),
    re_path(r'^(?P<org_id>\d+)/admin/search-projects/$', OrgAdminSearchProjectsView.as_view(), name='api-v2.1-org-admin-search-projects'),

    re_path(r'^(?P<org_id>\d+)/admin/users/$', OrgAdminUsers.as_view(), name='api-v2.1-org-admin-users'),
    re_path(r'^(?P<org_id>\d+)/admin/search-users/$', OrgAdminSearchUsers.as_view(), name='api-v2.1-org-admin-search-users'),
    re_path(r'^(?P<org_id>\d+)/admin/users/(?P<email>[^/]+)/$', OrgAdminUser.as_view(), name='api-v2.1-org-admin-user'),
    re_path(r'^(?P<org_id>\d+)/admin/users/(?P<email>[^/]+)/set-password/', OrgAdminUserSetPassword.as_view(), name='api-v2.1-org-admin-user-reset-password'),

    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/members/$', AdminGroupMembers.as_view(), name='api-admin-group-members'),
    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/members/(?P<email>[^/]+)/$', AdminGroupMember.as_view(), name='api-admin-group-member'),

    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/projects/$', OrgAdminGroupProjects.as_view(), name='api-v2.1-org-admin-group-projects'),
    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/projects/(?P<project_uuid>[-0-9a-f]+)/$', OrgAdminGroupProject.as_view(), name='api-v2.1-org-admin-group-project'),

    re_path(r'^admin/info/$', OrgAdminInfo.as_view(), name='api-v2.1-org-admin-info'),
    re_path(r'^admin/settings/$', OrgAdminSettingsView.as_view(), name='api-v2.1-org-admin-setting'),

    re_path(r'^(?P<org_id>\d+)/admin/saml-config/$', OrgSAMLConfigView.as_view(), name='api-v2.1-org-admin-saml-config'),
    re_path(r'^(?P<org_id>\d+)/admin/verify-domain/$', OrgVerifyDomain.as_view(), name='api-v2.1-org-admin-verify-domain'),

    # AI statistics
    re_path(r'^(?P<org_id>\d+)/admin/statistics/ai/$', OrgAdminAIStatisticsView.as_view(), name='api-v2.1-org-admin-ai-statistics'),
]

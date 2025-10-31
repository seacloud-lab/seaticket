# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from .sysinfo import SysInfo
from .users import AdminUsers, AdminUser, AdminUserResetPassword, \
    AdminUserGroups, AdminAdminUsers, AdminSearchUser, AdminSearchUserByOrgId
from .groups import AdminGroups, AdminGroup, AdminSearchGroup

from .organizations import AdminOrganizations, AdminOrganization, AdminSearchOrganization, \
    AdminOrganizationsBaseInfo
from .org_users import AdminOrgUsers, AdminOrgUser
from .org_groups import AdminOrgGroups, AdminOrgGroup
from .license import AdminLicense
from .admin_role import AdminAdminRole
from .two_factor_auth import TwoFactorAuthView
from .projects import AdminProjects, AdminProject, AdminTrashProjectsView, AdminTrashProjectView, \
    AdminSearchProjectsView, AdminUserProjects
from .group_projects import AdminGroupProjects, AdminGroupProject
from .group_members import AdminGroupMembers, AdminGroupMember
from .org_projects import OrgProjects

urlpatterns = [
    ## admin::sysinfo
    re_path(r'^sysinfo/$', SysInfo.as_view(), name='api-v2.1-sysinfo'),

    ## admin::users
    re_path(r'^users/$', AdminUsers.as_view(), name='api-v2.1-admin-users'),
    re_path(r'^search-user/$', AdminSearchUser.as_view(), name='api-v2.1-admin-search-user'),
    re_path(r'^search-user-by-org-id/$', AdminSearchUserByOrgId.as_view(), name='api-v2.1-admin-search-user-by-org-id'),

    ## admin::admin-role
    re_path(r'^admin-role/$', AdminAdminRole.as_view(), name='api-v2.1-admin-admin-role'),

    # [^...] Matches any single character not in brackets
    # + Matches between one and unlimited times, as many times as possible
    re_path(r'^users/(?P<email>[^/]+@[^/]+)/$', AdminUser.as_view(), name='api-v2.1-admin-user'),
    re_path(r'^users/(?P<email>[^/]+@[^/]+)/reset-password/$', AdminUserResetPassword.as_view(), name='api-v2.1-admin-user-reset-password'),
    re_path(r'^users/(?P<email>[^/]+@[^/]+)/groups/$', AdminUserGroups.as_view(), name='api-v2.1-admin-user-groups'),
    re_path(r'^users/(?P<email>[^/]+@[^/]+)/projects/$', AdminUserProjects.as_view(), name='api-v2.1-admin-user-projects'),
    re_path(r'^users/(?P<email>[^/]+@[^/]+)/two-factor-auth/$', TwoFactorAuthView.as_view(), name='api-v2.1-admin-user-two-factor-auth'),

    re_path(r'^admin-users/$', AdminAdminUsers.as_view(), name='api-v2.1-admin-admin-users'),

    ## admin::groups
    re_path(r'^groups/$', AdminGroups.as_view(), name='api-v2.1-admin-groups'),
    re_path(r'^search-group/$', AdminSearchGroup.as_view(), name='api-v2.1-admin-search-group'),
    re_path(r'^groups/(?P<group_id>\d+)/$', AdminGroup.as_view(), name='api-v2.1-admin-group'),
    re_path(r'^groups/(?P<group_id>\d+)/members/$', AdminGroupMembers.as_view(), name='api-v2.1-admin-group-members'),
    re_path(r'^groups/(?P<group_id>\d+)/members/(?P<email>[^/]+)/$', AdminGroupMember.as_view(), name='api-v2.1-admin-group-member'),
    re_path(r'^groups/(?P<group_id>\d+)/projects/$', AdminGroupProjects.as_view(), name='api-v2.1-admin-group-projects'),
    re_path(r'^groups/(?P<group_id>\d+)/projects/(?P<project_uuid>[-0-9a-f]+)/$', AdminGroupProject.as_view(), name='api-v2.1-admin-group-delete-project'),

    ## admin::organizations
    re_path(r'^organizations/$', AdminOrganizations.as_view(), name='api-v2.1-admin-organizations'),
    re_path(r'^organizations/(?P<org_id>\d+)/$', AdminOrganization.as_view(), name='api-v2.1-admin-organization'),
    re_path(r'^organizations/(?P<org_id>\d+)/users/$', AdminOrgUsers.as_view(), name='api-v2.1-admin-org-users'),
    re_path(r'^organizations/(?P<org_id>\d+)/users/(?P<email>[^/]+)/$', AdminOrgUser.as_view(), name='api-v2.1-admin-org-user'),
    re_path(r'^organizations/(?P<org_id>\d+)/groups/$', AdminOrgGroups.as_view(), name='api-v2.1-admin-org-groups'),
    re_path(r'^organizations/(?P<org_id>\d+)/groups/(?P<group_id>\d+)/$', AdminOrgGroup.as_view(), name='api-v2.1-admin-org-group'),
    re_path(r'^organizations/(?P<org_id>\d+)/projects/$', OrgProjects.as_view(), name='api-v2.1-admin-org-projects'),
    # re_path(r'^organizations/(?P<org_id>\d+)/groups/(?P<group_id>\d+)/$', AdminOrgGroup.as_view(), name='api-v2.1-admin-org-group'),

    re_path(r'^search-organization/$', AdminSearchOrganization.as_view(), name='api-v2.1-admin-search-org'),
    re_path(r'^organizations-basic-info/$', AdminOrganizationsBaseInfo.as_view(), name='api-v2.1-admin-orgs-base-info'),

    ## admin::projects
    re_path(r'^projects/$', AdminProjects.as_view(), name='api-v2.1-admin-projects'),
    re_path(r'^projects/(?P<project_uuid>[-0-9a-f]+)/$', AdminProject.as_view(), name='api-v2.1-admin-project'),
    re_path(r'^trash-projects/$', AdminTrashProjectsView.as_view(), name='api-v2.1-admin-trash-projects'),
    re_path(r'^trash-projects/(?P<project_id>\d+)/$', AdminTrashProjectView.as_view(), name='api-v2.1-admin-trash-project'),
    re_path(r'^search-projects/$', AdminSearchProjectsView.as_view(), name='api-v2.1-admin-search-projects'),

    ## admin::logo
    re_path(r'^license/$', AdminLicense.as_view(), name='api-v2.1-admin-license'),
]

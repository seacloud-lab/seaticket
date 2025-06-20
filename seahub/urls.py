# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path, include
from django.views.generic import TemplateView

from seahub.api2.endpoints.server_info import ServerInfoView
from seahub.views import *
from seahub.views.mobile import mobile_login
from seahub.views.sysadmin import *
from seahub.views.sso import *

from seahub.api2.endpoints.groups import Groups, Group, GroupMoveView

from seahub.api2.endpoints.group_members import GroupMembers, GroupMember, GroupSearchMember
from seahub.api2.endpoints.search_group import SearchGroup
from seahub.api2.endpoints.user_avatar import UserAvatarView
from seahub.api2.endpoints.user import User, UserContactEmailView, RemovePasswordView, \
    UserResetPasswordByPhoneView, ResetPasswordView
from seahub.api2.endpoints.profile import BindPhoneView, UnbindPhoneView
from seahub.api2.endpoints.verify import SmsVerifyCodeView
from seahub.api2.endpoints.slide_captcha import SlideCaptchaView
from seahub.api2.endpoints.project import WorkspacesView, ProjectsView, ProjectView, WebsitesView, WebsiteView
from seahub.api2.endpoints.folder import FoldersView, FolderView
from seahub.api2.endpoints.organization import OrganizationView, OrganizationMembersView

from seahub.api2.endpoints.admin.sysinfo import SysInfo
from seahub.api2.endpoints.admin.users import AdminUsers, AdminUser, AdminUserResetPassword, \
    AdminUserGroups, AdminAdminUsers, AdminSearchUser, AdminSearchUserByOrgId
from seahub.api2.endpoints.admin.groups import AdminGroups, AdminGroup, AdminSearchGroup

from seahub.api2.endpoints.admin.organizations import AdminOrganizations, AdminOrganization, AdminSearchOrganization, \
    AdminOrganizationsBaseInfo
from seahub.api2.endpoints.admin.org_users import AdminOrgUsers, AdminOrgUser
from seahub.api2.endpoints.admin.org_groups import AdminOrgGroups, AdminOrgGroup
from seahub.api2.endpoints.admin.logo import AdminLogo
from seahub.api2.endpoints.admin.favicon import AdminFavicon
from seahub.api2.endpoints.admin.license import AdminLicense
from seahub.api2.endpoints.admin.login_bg_image import AdminLoginBgImage
from seahub.api2.endpoints.admin.admin_role import AdminAdminRole
from seahub.api2.endpoints.admin.two_factor_auth import TwoFactorAuthView

urlpatterns = [
    re_path(r'^accounts/', include('seahub.registration.urls')),

    re_path(r'^sso/$', sso, name='sso'),
    re_path(r'^sso-auto-login/$', sso_auto_login, name='sso-auto-login'),
    re_path(r'^mobile-login/', mobile_login, name="mobile_login"),

    re_path(r'^$', seaqa_fake_view, name='projects'),
    re_path(r'^robots\.txt$', TemplateView.as_view(template_name='robots.txt', content_type='text/plain')),

    ### PWA ###
    re_path('', include('pwa.urls')),

    ### Misc ###
    re_path(r'^image-view/(?P<filename>.*)$', image_view, name='image_view'),
    re_path(r'^custom-css/$', custom_css_view, name='custom_css'),
    re_path(r'^i18n/$', i18n, name='i18n'),
    re_path(r'^choose_register/$', choose_register, name="choose_register"),
    re_path(r'^server-info/$', ServerInfoView.as_view(), name="server_info"),

    ### React ###
    re_path(r'^projects/$', seaqa_fake_view, name='projects_list'),

    ### Apps ###
    re_path(r'^api2/', include('seahub.api2.urls')),

    ## slide captcha
    re_path(r'^api/v2.1/slide-captcha/$', SlideCaptchaView.as_view(), name="api-v2.1-slide-captcha"),

    ## user
    re_path(r'^api/v2.1/user/$', User.as_view(), name="api-v2.1-user"),

    ## user: update contact email
    re_path(r'^api/v2.1/user/contact-email/$', UserContactEmailView.as_view(), name="api-v2.1-user-contact-email"),

    ## user:phone
    re_path(r'^api/v2.1/user/sms-verify/$', SmsVerifyCodeView.as_view(), name="api-v2.1-user-sms-verify"),
    re_path(r'^api/v2.1/user/bind-phone/$', BindPhoneView.as_view(), name="api-v2.1-user-phone-bind"),
    re_path(r'^api/v2.1/user/unbind-phone/$', UnbindPhoneView.as_view(), name="api-v2.1-user-phone-unbind"),

    # user:password
    re_path(r'^api/v2.1/user/remove-password/$', RemovePasswordView.as_view(), name="api-v2.1-user-remove-password"),

    # user:reset password by phone
    re_path(r'^api/v2.1/user/reset-password-by-phone/$', UserResetPasswordByPhoneView.as_view(), name="api-v2.1-user-reset-password-by-phone"),
    re_path(r'^api/v2.1/user/reset-password/$', ResetPasswordView.as_view(), name="api-v2.1-user-reset-password"),

    ## user::groups
    re_path(r'^api/v2.1/groups/$', Groups.as_view(), name='api-v2.1-groups'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/$', Group.as_view(), name='api-v2.1-group'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/$', GroupMembers.as_view(), name='api-v2.1-group-members'),
    re_path(r'^api/v2.1/groups/move-group/$', GroupMoveView.as_view(), name='api-v2.1-group-move'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/search-member/$', GroupSearchMember.as_view(), name='api-v2.1-group-search-member'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/(?P<email>[^/]+)/$', GroupMember.as_view(), name='api-v2.1-group-member'),
    re_path(r'^api/v2.1/search-group/$', SearchGroup.as_view(), name='api-v2.1-search-group'),

    ## org
    re_path(r'^api/v2.1/organizations/(?P<org_id>\d+)/$', OrganizationView.as_view(), name='api-v2.1-organization'),
    re_path(r'^api/v2.1/organizations/(?P<org_id>\d+)/members/$', OrganizationMembersView.as_view(), name='api-v2.1-organization-members'),

    # user: project
    re_path(r'^api/v2.1/workspaces/$', WorkspacesView.as_view(), name='api-v2.1-workspaces'),
    re_path(r'^api/v2.1/projects/$', ProjectsView.as_view(), name='api-v2.1-projects'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/$', ProjectView.as_view(), name='api-v2.1-workspace-project'),

    ## user::avatar
    re_path(r'^api/v2.1/user-avatar/$', UserAvatarView.as_view(), name='api-v2.1-user-avatar'),

    ## admin::sysinfo
    re_path(r'^api/v2.1/admin/sysinfo/$', SysInfo.as_view(), name='api-v2.1-sysinfo'),

    ## admin::users
    re_path(r'^api/v2.1/admin/users/$', AdminUsers.as_view(), name='api-v2.1-admin-users'),
    re_path(r'^api/v2.1/admin/search-user/$', AdminSearchUser.as_view(), name='api-v2.1-admin-search-user'),
    re_path(r'^api/v2.1/admin/search-user-by-org-id/$', AdminSearchUserByOrgId.as_view(), name='api-v2.1-admin-search-user-by-org-id'),

    ## admin::admin-role
    re_path(r'^api/v2.1/admin/admin-role/$', AdminAdminRole.as_view(), name='api-v2.1-admin-admin-role'),

    # [^...] Matches any single character not in brackets
    # + Matches between one and unlimited times, as many times as possible
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/$', AdminUser.as_view(), name='api-v2.1-admin-user'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/reset-password/$', AdminUserResetPassword.as_view(), name='api-v2.1-admin-user-reset-password'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/groups/$', AdminUserGroups.as_view(), name='api-v2.1-admin-user-groups'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/two-factor-auth/$', TwoFactorAuthView.as_view(), name='api-v2.1-admin-user-two-factor-auth'),

    re_path(r'^api/v2.1/admin/admin-users/$', AdminAdminUsers.as_view(), name='api-v2.1-admin-admin-users'),

    ## admin::groups
    re_path(r'^api/v2.1/admin/groups/$', AdminGroups.as_view(), name='api-v2.1-admin-groups'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/$', AdminGroup.as_view(), name='api-v2.1-admin-group'),
    re_path(r'^api/v2.1/admin/search-group/$', AdminSearchGroup.as_view(), name='api-v2.1-admin-search-group'),

    ## admin::organizations
    re_path(r'^api/v2.1/admin/organizations/$', AdminOrganizations.as_view(), name='api-v2.1-admin-organizations'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/$', AdminOrganization.as_view(), name='api-v2.1-admin-organization'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/users/$', AdminOrgUsers.as_view(), name='api-v2.1-admin-org-users'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/users/(?P<email>[^/]+)/$', AdminOrgUser.as_view(), name='api-v2.1-admin-org-user'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/groups/$', AdminOrgGroups.as_view(), name='api-v2.1-admin-org-groups'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/groups/(?P<group_id>\d+)/$', AdminOrgGroup.as_view(), name='api-v2.1-admin-org-group'),
    re_path(r'^api/v2.1/admin/search-organization/$', AdminSearchOrganization.as_view(), name='api-v2.1-admin-search-org'),
    re_path(r'^api/v2.1/admin/organizations-basic-info/$', AdminOrganizationsBaseInfo.as_view(), name='api-v2.1-admin-orgs-base-info'),

    ## admin::logo
    re_path(r'^api/v2.1/admin/logo/$', AdminLogo.as_view(), name='api-v2.1-admin-logo'),
    re_path(r'^api/v2.1/admin/favicon/$', AdminFavicon.as_view(), name='api-v2.1-admin-favicon'),
    re_path(r'^api/v2.1/admin/license/$', AdminLicense.as_view(), name='api-v2.1-admin-license'),
    re_path(r'^api/v2.1/admin/login-background-image/$', AdminLoginBgImage.as_view(), name='api-v2.1-admin-login-background-image'),

    re_path(r'^options/', include('seahub.options.urls')),
    re_path(r'^profile/', include('seahub.profile.urls')),
    re_path(r'^captcha/', include('captcha.urls')),

    # website
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/(?P<name>.*)/websites/$', WebsitesView.as_view(), name='api-v2.1-websites'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/(?P<name>.*)/websites/(?P<website_id>\d+)/$', WebsiteView.as_view(), name='api-v2.1-website'),

    # folder
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/folders/$', FoldersView.as_view(), name='api-v2.1-folders'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/folders/(?P<folder_id>\d+)/$', FolderView.as_view(), name='api-v2.1-folder'),

    re_path(r'^', include(('seahub.project.urls', 'project'), namespace='workspace')),

    ### system admin ###
    re_path(r'^sys/info/$', sysadmin_react_fake_view, name="sys_info"),
    re_path(r'^sys/sudo/', sys_sudo_mode, name='sys_sudo_mode'),
    re_path(r'^sys/web-settings/$', sysadmin_react_fake_view, name="sys_web_settings"),

    re_path(r'^sys/users/$', sysadmin_react_fake_view, name="sys_users"),
    re_path(r'^sys/users/admins/$', sysadmin_react_fake_view, name="sys_users_admin"),
    re_path(r'^sys/users/(?P<email>[^/]+)/$', sysadmin_react_fake_view, name="sys_user"),
    re_path(r'^sys/users/(?P<email>[^/]+)/groups/$', sysadmin_react_fake_view, name="sys_user_groups"),
    re_path(r'^sys/users/(?P<email>[^/]+)/dtables/$', sysadmin_react_fake_view, name="sys_user_dtables"),
    re_path(r'^sys/search-users/$', sysadmin_react_fake_view, name="sys_search_users"),
    re_path(r'^sys/search-dtables/$', sysadmin_react_fake_view, name="sys_search_dtables"),
    re_path(r'^sys/all-dtables/$', sysadmin_react_fake_view, name="sys_all_dtables"),
    re_path(r'^sys/organizations/$', sysadmin_react_fake_view, name="sys_organizations"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/info/$', sysadmin_react_fake_view, name="sys_organization_info"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/users/$', sysadmin_react_fake_view, name="sys_organization_users"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/admin-users/$', sysadmin_react_fake_view, name="sys_organization_admin_users"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/groups/$', sysadmin_react_fake_view, name="sys_organization_groups"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/dtables/$', sysadmin_react_fake_view, name="sys_organization_dtables"),
    re_path(r'^sys/search-organizations/$', sysadmin_react_fake_view, name="sys_search_orgs"),
    re_path(r'^sys/groups/$', sysadmin_react_fake_view, name="sys_groups"),
    re_path(r'^sys/groups/(?P<group_id>\d+)/dtables/$', sysadmin_react_fake_view, name="sys_group_dtables"),
    re_path(r'^sys/groups/(?P<group_id>\d+)/members/$', sysadmin_react_fake_view, name="sys_group_members"),
    re_path(r'^sys/search-groups/$', sysadmin_react_fake_view, name="sys_search_groups"),
]

if settings.SERVE_STATIC:
    from django.views.static import serve as static_view
    media_url = settings.MEDIA_URL.strip('/')
    urlpatterns += [
        re_path(r'^%s/(?P<path>.*)$' % (media_url), static_view,
            {'document_root': settings.MEDIA_ROOT}),
    ]

urlpatterns += [
    re_path(r'^demo/', demo),
]


if getattr(settings, 'MULTI_TENANCY', False):
    urlpatterns += [
        re_path(r'^api/v2.1/org/', include('seahub.organizations.api_urls')),
        re_path(r'^org/', include('seahub.organizations.urls')),
        re_path(r'^org-work-weixin/', include('seahub.org_work_weixin.urls')),
        re_path(r'^org-dingtalk/', include('seahub.org_dingtalk.urls')),
    ]

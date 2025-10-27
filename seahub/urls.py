# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path, include
from django.views.generic import TemplateView

from seahub.api2.endpoints.server_info import ServerInfoView
from seahub.views import *
from seahub.views.mobile import mobile_login
from seahub.views.sysadmin import *
from seahub.views.sso import *
from seahub.group.views import group_invite

from seahub.api2.endpoints.groups import GroupsView, GroupView, GroupMoveView, GroupTrashProjectsView, GroupTrashProjectView
from seahub.api2.endpoints.group_invite_links import GroupInviteLinks, GroupInviteLink
from seahub.api2.endpoints.group_members import GroupMembers, GroupMember, GroupSearchMember, GroupMembersBulk
from seahub.api2.endpoints.search_group import SearchGroup
from seahub.api2.endpoints.user_avatar import UserAvatarView
from seahub.api2.endpoints.user import User, UserContactEmailView, RemovePasswordView, \
    UserResetPasswordByPhoneView, ResetPasswordView
from seahub.api2.endpoints.profile import BindPhoneView, UnbindPhoneView
from seahub.api2.endpoints.sessions import SessionsView, OnlineSessionView, SessionView
from seahub.api2.endpoints.verify import SmsVerifyCodeView
from seahub.api2.endpoints.slide_captcha import SlideCaptchaView
from seahub.api2.endpoints.project import WorkspacesView, ProjectsView, ProjectView, SearchView, \
    ChatSessionsView, ChatSessionView, ChatMessagesView

from seahub.api2.endpoints.organization import OrganizationView, OrganizationMembersView

from seahub.api2.endpoints.user_list import UserListView

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
    re_path(r'^project/(?P<workspace_id>\d+)/$', seaqa_fake_view, name="project_workspace"),

    ### Apps ###
    re_path(r'^api2/', include('seahub.api2.urls')),

    ## slide captcha
    re_path(r'^api/v2.1/slide-captcha/$', SlideCaptchaView.as_view(), name="api-v2.1-slide-captcha"),

    ## user
    re_path(r'^api/v2.1/user/$', User.as_view(), name="api-v2.1-user"),

    ## user: update contact email
    re_path(r'^api/v2.1/user/contact-email/$', UserContactEmailView.as_view(), name="api-v2.1-user-contact-email"),

    # user list
    re_path(r'^api/v2.1/user-list/$', UserListView.as_view(), name='api-v2.1-user-list'),

    ## user:phone
    re_path(r'^api/v2.1/user/sms-verify/$', SmsVerifyCodeView.as_view(), name="api-v2.1-user-sms-verify"),
    re_path(r'^api/v2.1/user/bind-phone/$', BindPhoneView.as_view(), name="api-v2.1-user-phone-bind"),
    re_path(r'^api/v2.1/user/unbind-phone/$', UnbindPhoneView.as_view(), name="api-v2.1-user-phone-unbind"),

    # user:password
    re_path(r'^api/v2.1/user/remove-password/$', RemovePasswordView.as_view(), name="api-v2.1-user-remove-password"),

    # user:reset password by phone
    re_path(r'^api/v2.1/user/reset-password-by-phone/$', UserResetPasswordByPhoneView.as_view(), name="api-v2.1-user-reset-password-by-phone"),
    re_path(r'^api/v2.1/user/reset-password/$', ResetPasswordView.as_view(), name="api-v2.1-user-reset-password"),

    ## sessions
    re_path(r'^api/v2.1/sessions/$', SessionsView.as_view(), name='api-v2.1-sessions'),
    re_path(r'^api/v2.1/sessions/(?P<session_id>\d+)/$', SessionView.as_view(), name='api-v2.1-session'),
    re_path(r'^api/v2.1/online-sessions/(?P<session_id>\d+)/$', OnlineSessionView.as_view(), name='api-v2.1-online-session'),

    ## user::groups
    re_path(r'^api/v2.1/groups/$', GroupsView.as_view(), name='api-v2.1-groups'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/$', GroupView.as_view(), name='api-v2.1-group'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/$', GroupMembers.as_view(), name='api-v2.1-group-members'),
    re_path(r'^api/v2.1/groups/move-group/$', GroupMoveView.as_view(), name='api-v2.1-group-move'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/search-member/$', GroupSearchMember.as_view(), name='api-v2.1-group-search-member'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/bulk/$', GroupMembersBulk.as_view(), name='api-v2.1-group-members-bulk'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/(?P<email>[^/]+)/$', GroupMember.as_view(), name='api-v2.1-group-member'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/trash-projects/$', GroupTrashProjectsView.as_view(), name='api-v2.1-group-trash-projects'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/trash-projects/(?P<project_uuid>[-0-9a-f]+)/$', GroupTrashProjectView.as_view(), name='api-v2.1-group-trash-project'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/invite-links/$', GroupInviteLinks.as_view(), name='api-v2.1-group-invite-links'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/invite-links/(?P<token>[-0-9a-f]{8})/$', GroupInviteLink.as_view(), name='api-v2.1-group-invite-link'),
    re_path(r'^api/v2.1/search-group/$', SearchGroup.as_view(), name='api-v2.1-search-group'),

    ## org
    re_path(r'^api/v2.1/organizations/(?P<org_id>\d+)/$', OrganizationView.as_view(), name='api-v2.1-organization'),
    re_path(r'^api/v2.1/organizations/(?P<org_id>\d+)/members/$', OrganizationMembersView.as_view(), name='api-v2.1-organization-members'),

    # user: project
    re_path(r'^api/v2.1/workspaces/$', WorkspacesView.as_view(), name='api-v2.1-workspaces'),
    re_path(r'^api/v2.1/projects/$', ProjectsView.as_view(), name='api-v2.1-projects'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/project/$', ProjectView.as_view(), name='api-v2.1-workspace-project'),

    # search
    re_path(r'^api/v2.1/search/$', SearchView.as_view(), name='api-v2.1-search'),

    # chat
    re_path(r'^api/v2.1/chat/sessions/$', ChatSessionsView.as_view(), name='chat-sessions'),
    re_path(r'^api/v2.1/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/$', ChatSessionView.as_view(), name='chat-session'),
    re_path(r'^api/v2.1/chat/sessions/(?P<session_uuid>[-0-9a-f]+)/messages/$', ChatMessagesView.as_view(), name='chat-messages'),

    ## user::avatar
    re_path(r'^api/v2.1/user-avatar/$', UserAvatarView.as_view(), name='api-v2.1-user-avatar'),

    re_path(r'^api/v2.1/admin/', include('seahub.api2.endpoints.admin.urls')),

    re_path(r'^options/', include('seahub.options.urls')),
    re_path(r'^profile/', include('seahub.profile.urls')),
    re_path(r'^captcha/', include('captcha.urls')),

    re_path(r'^', include(('seahub.project.urls', 'project'), namespace='workspace')),

    ### system admin page ###
    re_path(r'^sys/info/$', sysadmin_react_fake_view, name="sys_info"),
        re_path(r'^sys/sudo/', sys_sudo_mode, name='sys_sudo_mode'),
    re_path(r'^sys/web-settings/$', sysadmin_react_fake_view, name="sys_web_settings"),

    re_path(r'^sys/users/$', sysadmin_react_fake_view, name="sys_users"),
    re_path(r'^sys/users/admins/$', sysadmin_react_fake_view, name="sys_users_admin"),
    re_path(r'^sys/users/(?P<email>[^/]+)/$', sysadmin_react_fake_view, name="sys_user"),
    re_path(r'^sys/users/(?P<email>[^/]+)/groups/$', sysadmin_react_fake_view, name="sys_user_groups"),
    re_path(r'^sys/users/(?P<email>[^/]+)/projects/$', sysadmin_react_fake_view, name="sys_user_projects"),
    re_path(r'^sys/search-users/$', sysadmin_react_fake_view, name="sys_search_users"),
    re_path(r'^sys/search-projects/$', sysadmin_react_fake_view, name="sys_search_projects"),
    re_path(r'^sys/all-projects/$', sysadmin_react_fake_view, name="sys_all_projects"),
    re_path(r'^sys/trash-projects/$', sysadmin_react_fake_view, name="sys_trash_projects"),
    re_path(r'^sys/organizations/$', sysadmin_react_fake_view, name="sys_organizations"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/info/$', sysadmin_react_fake_view, name="sys_organization_info"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/users/$', sysadmin_react_fake_view, name="sys_organization_users"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/admin-users/$', sysadmin_react_fake_view, name="sys_organization_admin_users"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/groups/$', sysadmin_react_fake_view, name="sys_organization_groups"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/projects/$', sysadmin_react_fake_view, name="sys_organization_projects"),
    re_path(r'^sys/search-organizations/$', sysadmin_react_fake_view, name="sys_search_orgs"),
    re_path(r'^sys/groups/$', sysadmin_react_fake_view, name="sys_groups"),
    re_path(r'^sys/groups/(?P<group_id>\d+)/projects/$', sysadmin_react_fake_view, name="sys_group_projects"),
    re_path(r'^sys/groups/(?P<group_id>\d+)/members/$', sysadmin_react_fake_view, name="sys_group_members"),
    re_path(r'^sys/search-groups/$', sysadmin_react_fake_view, name="sys_search_groups"),

    re_path(r'^group-invite/(?P<token>[-0-9a-f]{8})/$', group_invite, name='group_invite'),
]

if settings.SERVE_STATIC:
    from django.views.static import serve as static_view
    media_url = settings.MEDIA_URL.strip('/')
    urlpatterns += [
        re_path(r'^%s/(?P<path>.*)$' % (media_url), static_view,
            {'document_root': settings.MEDIA_ROOT}),
    ]


if getattr(settings, 'MULTI_TENANCY', False):
    urlpatterns += [
        re_path(r'^api/v2.1/org/', include('seahub.organizations.api_urls')),
        re_path(r'^org/', include('seahub.organizations.urls')),
    ]

if getattr(settings, 'ENABLE_MULTI_SAML', False):
    from seahub.saml.views import *
    urlpatterns += [
        re_path(r'^multi_saml_sso/$', multi_saml_sso, name='multi_saml_sso'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/login/$', login, name='org_saml_login'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/acs/$', acs, name='org_saml_acs'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/metadata/$', metadata, name='org_saml_metadata'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/connect/$', saml_connect, name='org_saml_connect'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/disconnect/$', saml_disconnect, name='org_saml_disconnect'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/ls/$', SamlLogoutView.as_view(), name='org_saml_ls'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/ls/post/$', SamlLogoutView.as_view(), name='org_saml_ls_post'),
        re_path(r'^org/custom/(?P<org_id>\d+)/saml/', include('djangosaml2.urls')),
        re_path(r'^saml/complete/$', saml_complete, name='saml_complete'),
    ]

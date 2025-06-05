# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path

from seahub.api2.endpoints.org_admin.address_book.groups import (
    AdminAddressBookGroups, AdminAddressBookGroup
)
from seahub.api2.endpoints.org_admin.department_v2 import OrgAdminAddUserToDepartmentsView, OrgAdminAddressBookV2DepartmentGroupView, \
    OrgAdminAddressBookV2DepartmentMemberView, OrgAdminAddressBookV2DepartmentMembersView, \
    OrgAdminAddressBookV2DepartmentView, OrgAdminAddressBookV2DepartmentsView, OrgAdminDepartmentsMigrateView, \
    OrgAdminNonAddressBookV2UsersView
from seahub.api2.endpoints.org_admin.dtable_export import OrgAdminExportDTable
from seahub.api2.endpoints.org_admin.dtable_shares import OrgAdminDTableSharePermissions, OrgAdminDTableShares, \
    OrgAdminDTableShareUsers, OrgAdminDTableShareUser, \
    OrgAdminDTableShareGroups, OrgAdminDTableShareGroup
from seahub.api2.endpoints.org_admin.external_links import OrgAdminExternalLinks, OrgAdminExternalLink, \
    OrgAdminViewExternalLinks, OrgAdminViewExternalLink

from seahub.api2.endpoints.org_admin.group_members import AdminGroupMembers, AdminGroupMember
from seahub.api2.endpoints.org_admin.login_logs import OrgAdminUserLoginLogs, OrgAdminUserLoginLog
from seahub.api2.endpoints.org_admin.users import OrgAdminUser, OrgAdminUsers, OrgAdminInviteUserEmail, \
    OrgAdminSearchUsers
from seahub.api2.endpoints.org_admin.user_set_password import OrgAdminUserSetPassword
from seahub.api2.endpoints.org_admin.groups import OrgAdminGroups, OrgAdminGroup, OrgAdminSearchGroups
from seahub.api2.endpoints.org_admin.info import OrgAdminInfo
from seahub.api2.endpoints.org_admin.dtables import OrgAdminDTablesView, OrgAdminDTableView, \
     OrgAdminTrashDTablesView, OrgAdminTrashDTableView, OrgAdminSearchDTables
from seahub.api2.endpoints.org_admin.settings import OrgAdminSettingsView, OrgAdminOrgLogoView
from seahub.api2.endpoints.org_admin.work_weixin import OrgAdminWorkWeixinInfo, OrgAdminWorkWeixinUsers, \
    OrgAdminWorkWeixinCreateLicenseOrder, OrgAdminWorkWeixinUser
from seahub.api2.endpoints.org_admin.dingtalk import OrgAdminDingtalkInfo
from seahub.api2.endpoints.org_admin.two_factor_auth import OrgAdminTwoFactorAuthView
from seahub.api2.endpoints.org_admin.group_dtables import OrgAdminGroupDTables, OrgAdminGroupDTable
from seahub.api2.endpoints.org_admin.invite_links import OrgAdminInviteLinks, OrgAdminInviteLink
from seahub.api2.endpoints.org_admin.operation_logs import OrgAdminOperationLogs
from seahub.api2.endpoints.org_admin.audit_logs import OrgAdminAuditLogs, OrgAdminFileAccessLogsView
from seahub.api2.endpoints.org_admin.saml_config import OrgSAMLConfigView, OrgVerifyDomain

urlpatterns = [
    re_path(r'^(?P<org_id>\d+)/admin/search-groups/$', OrgAdminSearchGroups.as_view(), name='api-admin-search-groups'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book/groups/$', AdminAddressBookGroups.as_view(), name='api-admin-address-book-groups'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book/groups/(?P<group_id>\d+)/$', AdminAddressBookGroup.as_view(), name='api-admin-address-book-group'),

    re_path(r'^(?P<org_id>\d+)/admin/groups/$', OrgAdminGroups.as_view(), name='api-v2.1-org-admin-groups'),
    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/$', OrgAdminGroup.as_view(), name='api-admin-group'),

    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/dtables/$', OrgAdminGroupDTables.as_view(), name='api-v2.1-org-admin-group-dtables'),
    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/dtables/(?P<dtable_uuid>[-0-9a-f]+)/$', OrgAdminGroupDTable.as_view(), name='api-v2.1-org-admin-group-dtable'),

    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/members/$', AdminGroupMembers.as_view(), name='api-admin-group-members'),
    re_path(r'^(?P<org_id>\d+)/admin/groups/(?P<group_id>\d+)/members/(?P<email>[^/]+)/$', AdminGroupMember.as_view(), name='api-admin-group-member'),

    # addressbook-v2
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/departments/$', OrgAdminAddressBookV2DepartmentsView.as_view(), name='api-v2.1-org-admin-address-book-v2-departments'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/departments/(?P<department_id>\d+)/$', OrgAdminAddressBookV2DepartmentView.as_view(), name='api-v2.1-org-admin-address-book-v2-department'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/departments/(?P<department_id>\d+)/members/$', OrgAdminAddressBookV2DepartmentMembersView.as_view(), name='api-v2.1-org-admin-address-book-v2-department-members'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/departments/(?P<department_id>\d+)/members/(?P<email>[^/]+@[^/]+)/$', OrgAdminAddressBookV2DepartmentMemberView.as_view(), name='api-v2.1-org-admin-address-book-v2-department-member'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/departments/add-to-departments/$', OrgAdminAddUserToDepartmentsView.as_view(), name='api-v2.1-org-admin-address-book-v2-add-user-to-departments'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/departments/(?P<department_id>\d+)/group/$', OrgAdminAddressBookV2DepartmentGroupView.as_view(), name='api-v2.1-org-admin-address-book-v2-department-group'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/departments-migrate/$', OrgAdminDepartmentsMigrateView.as_view(), name='api-v2.1-org-admin-address-book-v2-departments-migrate'),
    re_path(r'^(?P<org_id>\d+)/admin/address-book-v2/non-department-users/$', OrgAdminNonAddressBookV2UsersView.as_view(), name='api-v2.1-org-admin-address-book-v2-non-department-users'),

    re_path(r'^(?P<org_id>\d+)/admin/users/$', OrgAdminUsers.as_view(), name='api-v2.1-org-admin-users'),
    re_path(r'^(?P<org_id>\d+)/admin/search-users/$', OrgAdminSearchUsers.as_view(), name='api-v2.1-org-admin-search-users'),
    re_path(r'^(?P<org_id>\d+)/admin/users/(?P<email>[^/]+)/$', OrgAdminUser.as_view(), name='api-v2.1-org-admin-user'),
    re_path(r'^(?P<org_id>\d+)/admin/users/(?P<email>[^/]+)/set-password/', OrgAdminUserSetPassword.as_view(), name='api-v2.1-org-admin-user-reset-password'),
    # re_path(r'^(?P<org_id>\d+)/admin/invite-user-email/$', OrgAdminInviteUserEmail.as_view(), name='api-v2.1-org-admin-create-user-email'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/$', OrgAdminDTablesView.as_view(), name='api-v2.1-org-admin-dtables'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_id>\d+)/$', OrgAdminDTableView.as_view(), name='api-v2.1-org-admin-dtable'),
    re_path(r'^(?P<org_id>\d+)/admin/trash-dtables/$', OrgAdminTrashDTablesView.as_view(), name='api-v2.1-org-admin-trash-dtables'),
    re_path(r'^(?P<org_id>\d+)/admin/trash-dtables/(?P<dtable_id>\d+)/$', OrgAdminTrashDTableView.as_view(), name='api-v2.1-org-admin-trash-dtable'),
    re_path(r'^(?P<org_id>\d+)/admin/search-dtables/$', OrgAdminSearchDTables.as_view(), name='api-v2.1-org-admin-search-dtables'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/export-dtable/$', OrgAdminExportDTable.as_view(), name='api-v2.1-org-admin--dtable'),
    re_path(r'^(?P<org_id>\d+)/admin/external-links/$', OrgAdminExternalLinks.as_view(), name='api-v2.1-org-admin-external-links'),
    re_path(r'^(?P<org_id>\d+)/admin/view-external-links/$', OrgAdminViewExternalLinks.as_view(), name='api-v2.1-org-admin-view-external-links'),
    re_path(r'^(?P<org_id>\d+)/admin/external-links/(?P<token>.*)/$', OrgAdminExternalLink.as_view(), name='api-v2.1-org-admin-external-link'),
    re_path(r'^(?P<org_id>\d+)/admin/view-external-links/(?P<token>.*)/$', OrgAdminViewExternalLink.as_view(), name='api-v2.1-org-admin-view-external-link'),
    re_path(r'^(?P<org_id>\d+)/admin/invite-links/$', OrgAdminInviteLinks.as_view(), name='api-v2.1-org-admin-invite-links'),
    re_path(r'^(?P<org_id>\d+)/admin/invite-links/(?P<token>.*)/$', OrgAdminInviteLink.as_view(), name='api-v2.1-org-admin-invite-link'),
    re_path(r'^admin/info/$', OrgAdminInfo.as_view(), name='api-v2.1-org-admin-info'),
    re_path(r'^admin/settings/$', OrgAdminSettingsView.as_view(), name='api-v2.1-org-admin-setting'),

    re_path(r'^(?P<org_id>\d+)/admin/work-weixin/info/$', OrgAdminWorkWeixinInfo.as_view(), name='api-v2.1-org-admin-work-weixin-info'),
    re_path(r'^(?P<org_id>\d+)/admin/work-weixin/users/$', OrgAdminWorkWeixinUsers.as_view(), name='api-v2.1-org-admin-work-weixin-users'),
    re_path(r'^(?P<org_id>\d+)/admin/work-weixin/user/$', OrgAdminWorkWeixinUser.as_view(), name='api-v2.1-org-admin-work-weixin-user'),
    re_path(r'^(?P<org_id>\d+)/admin/work-weixin/create-license-order/$', OrgAdminWorkWeixinCreateLicenseOrder.as_view(), name='api-v2.1-org-admin-work-weixin-create-license-order'),
    re_path(r'^(?P<org_id>\d+)/admin/dingtalk/info/$', OrgAdminDingtalkInfo.as_view(), name='api-v2.1-org-admin-dingtalk-info'),
    re_path(r'^(?P<org_id>\d+)/admin/users/(?P<email>[^/]+)/two-factor-auth/$', OrgAdminTwoFactorAuthView.as_view(), name='api-v2.1-org-admin-user-two-factor-auth'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_uuid>[-0-9a-f]+)/share-permissions/$', OrgAdminDTableSharePermissions.as_view(), name='api-v2.1-org-admin-dtable-share-Permissions'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/shares/$', OrgAdminDTableShares.as_view(), name='api-v2.1-org-admin-dtable-shares'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_uuid>[-0-9a-f]+)/shares/users/(?P<email>[^/]+)/$', OrgAdminDTableShareUser.as_view(), name='api-v2.1-org-admin-dtable-share-user'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/shares/users/$', OrgAdminDTableShareUsers.as_view(), name='api-v2.1-org-admin-dtable-share-users'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_uuid>[-0-9a-f]+)/shares/groups/(?P<group_id>\d+)/$', OrgAdminDTableShareGroup.as_view(), name='api-v2.1-org-admin-dtable-share-group'),
    re_path(r'^(?P<org_id>\d+)/admin/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/shares/groups/$', OrgAdminDTableShareGroups.as_view(), name='api-v2.1-org-admin-dtable-share-groups'),
    re_path(r'^(?P<org_id>\d+)/admin/admin-logs/$', OrgAdminOperationLogs.as_view(), name='api-v2.1-org-admin-admin-logs'),
    re_path(r'^(?P<org_id>\d+)/admin/org-logo/$', OrgAdminOrgLogoView.as_view(), name='api-v2.1-org-admin-org-logo'),
    re_path(r'^(?P<org_id>\d+)/admin/audit-logs/$', OrgAdminAuditLogs.as_view(), name='api-v2.1-org-admin-audit-logs'),
    re_path(r'^(?P<org_id>\d+)/admin/file-access-logs/$', OrgAdminFileAccessLogsView.as_view(), name='api-v2.1-org-admin-file-access-logs'),

    re_path(r'^(?P<org_id>\d+)/admin/saml-config/$', OrgSAMLConfigView.as_view(), name='api-v2.1-org-admin-saml-config'),
    re_path(r'^(?P<org_id>\d+)/admin/verify-domain/$', OrgVerifyDomain.as_view(), name='api-v2.1-org-admin-verify-domain'),
    re_path(r'^(?P<org_id>\d+)/admin/login-logs/$', OrgAdminUserLoginLogs.as_view(), name='api-v2.1-org-admin-login-logs'),
    re_path(r'^(?P<org_id>\d+)/admin/login-logs/(?P<email>[^/]+)/$', OrgAdminUserLoginLog.as_view(), name='api-v2.1-org-admin-login-log'),

]

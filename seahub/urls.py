# Copyright (c) 2012-2016 Seafile Ltd.
from django.urls import re_path, include
from django.views.generic import TemplateView

from seahub.api2.endpoints.departments_v2 import AddressBookV2DepartmentMemberDTablesView, \
    AddressBookV2DepartmentMembersView, AddressBookV2Departments, AddressBookV2SubDepartmentsView, \
    AddressBookV2UserDepartmentsView, AddressBookV2DepartmentGroupMembersCountView
from seahub.api2.endpoints.dtable_big_data import DTableImportBigDataView, \
    DTableBigDataStatusView, DTableUpdateBigDataView
from seahub.api2.endpoints.dtable_image_recognition import DTableImageRecognitionView
from seahub.api2.endpoints.dtable_message import DTableEmailMessageSendView, DTableWechatMessageSendView, \
    DTableMessageSendStatus, DTableDingtalkMessageSendView, DTableNotificationSendView
from seahub.api2.endpoints.dtable_server.dtable_big_data import DTableArchiveView, DTableDbMetadataView, \
    DTableDbIndexView, DTableDbIndexTaskStatusView, DTableDbBigDataFeatureView, DTableConnectedCollaboratorView
from seahub.api2.endpoints.dtable_server.dtable_delete_operation_log import DTableDeleteOperationLogsView, DTableDeleteOperationLogView
from seahub.api2.endpoints.dtable_server.dtable_departments import DTableDepartmentsView
from seahub.api2.endpoints.dtable_server.dtable_operation_logs import DTableOprationLogsView
from seahub.api2.endpoints.dtable_server.dtable_big_data_operation_logs import DTableBigDataOprationLogsView
from seahub.api2.endpoints.dtable_server.dtable_row_activities import DTableRowActivitiesView
from seahub.api2.endpoints.dtable_third_party_accounts import DTableThirdPartyAccountsView, DTableThirdPartyAccountView, \
    DTableThirdPartyAccountDetailView, DTableThirdPartyEmailOAuthAccountQueryView, DTableThirdPartyEmailOAuthAccountAuthURLView
from seahub.api2.endpoints.item_search import DTableItemsSearchView
from seahub.api2.endpoints.server_info import ServerInfoView
from seahub.api2.endpoints.api_gateway_calls_stats import InternalUpdateExceedAPIQuotaView
from seahub.dtable_apps.big_data_screen.apis import BigDataScreensElementStatisticView, BigDataScreensExportView, BigDataScreensMetadataView, \
    BigDataScreensAdminUploadLinkView, BigDataScreensElementStatisticDetailView, BigDataScreensImportView, BigDataScreensCustomURLView
from seahub.dtable_apps.data_search.image_recognize import DataImageRecognizeView
from seahub.dtable_apps.gallery.apis import DTableGalleryMetadataView, DTableGalleryRowsView
from seahub.dtable_apps.map_cn.apis import DTableMapCNMetadataView, DTableMapCNRowsView
from seahub.dtable_apps.universal_app.admin_apis import DTableUniversalAppUsersView, DTableUniversalAppUserView, \
    DTableUniversalAppRolesView, DTableUniversalAppRoleView, DTableUniversalAppInviteLinksView, \
    DTableUniversalAppInviteLinkView, DTableUniversalAppsView, DTableUniversalAppUserSyncView, \
    DTableUniversalAppUsersBatch, DTableAppUsersView, DTableUniversalAppCustomURLView, \
    AddressBookDepartmentMembersForApp, OrganizationMembersForApp, DTableUniversalAppSearchUserView, \
    AddressBookDepartmentV2MembersForApp, DTableUniversalAppSnapshotsView, DTableUniversalAppSnapshotRestoreView, \
    DTableUniversalAppVersionUpdateView, DTableUniversalAppSnapshotView, DTableUniversalAnonymousPassword, \
    DTableUniversalAppsPagesView, DTableUniversalAppsMovePageView, DTableUniversalAppsPageView
from seahub.dtable_apps.workflow.apis import DTableWorkflowHandledTasksView, DTableWorkflowLinkedTableRowsView, \
    DTableWorkflowOngoingTasksView, DTableWorkflowOngoingTasksCountView, DTableWorkflowPublicUploadLinkView, \
    DTableWorkflowShareView, DTableWorkflowSharesView, DTableWorkflowSubmitTaskView, DTableWorkflowSubmittedTasksView, \
    DTableWorkflowTaskAdminView, DTableWorkflowTaskCancelView, DTableWorkflowTaskInitiatorView, \
    DTableWorkflowTaskLogsView, \
    DTableWorkflowTaskParticipantView, DTableWorkflowTaskParticipantsView, DTableWorkflowTaskResubmitView, DTableWorkflowTasksView, \
    DTableWorkflowTransferView, DTableWorkflowUploadLinkView, DTableWorkflowView, DTableWorkflowsView, \
    InternalDTableWorkflowSubmitView, \
    SharedDTableWorkflowsView, DTableWorkflowTaskView, DTableWorkflowInitFormView, DTableWorkflowTaskByRowIdView, \
    DTableWorkflowTasksByRowIdsView, ExternalDTableWorkflowSubmitView, UserWorkflowFoldersView, UserWorkflowFolderView, \
    MoveWorkflowToFolderView
from seahub.views import *
from seahub.views.mobile import mobile_login
from seahub.views.sysadmin import *
from seahub.views.sso import *
from seahub.views.external_team_admin import external_team_admin
from seahub.dtable.views import app_templates_fake_view
from seahub.group.views import group_invite

from seahub.api2.endpoints.groups import Groups, Group, GroupMoveView
from seahub.api2.endpoints.group_invite_links import GroupInviteLinks, GroupInviteLink
from seahub.api2.endpoints.departments import Departments
from seahub.api2.endpoints.shareable_groups import ShareableGroups
from seahub.api2.endpoints.address_book.groups import AddressBookGroupsSubGroups
from seahub.api2.endpoints.address_book.members import AddressBookGroupsSearchMember
from seahub.api2.endpoints.group_trash_dtables import GroupTrashDTableView, GroupTrashDTablesView

from seahub.api2.endpoints.group_members import GroupMembers, GroupMembersBulk, GroupMember, GroupSearchMember
from seahub.api2.endpoints.search_group import SearchGroup
from seahub.api2.endpoints.invitations import InvitationsView, InvitationsBatchView
from seahub.api2.endpoints.invitation import InvitationView, InvitationRevokeView
from seahub.api2.endpoints.invitation_links import InvitationLinkView
from seahub.api2.endpoints.notifications import InternalNotificationsView, NotificationsView, NotificationView, \
    SysUserNotificationSeenView, \
    SysUserNotificationUnseenView, NotificationsCenterView
from seahub.api2.endpoints.user_avatar import UserAvatarView
from seahub.api2.endpoints.user import User, UserCommonInfoView, UserContactEmailView, RemovePasswordView, UserResetPasswordByPhoneView, \
    UserConvertToTeamView, ResetPasswordView
from seahub.api2.endpoints.user_list import UserListView
from seahub.api2.endpoints.profile import BindPhoneView, UnbindPhoneView
from seahub.api2.endpoints.subscription import SubscriptionView, SubscriptionPlansView, SubscriptionLogsView, \
    RedeemCodeExchangeView
from seahub.api2.endpoints.verify import SmsVerifyCodeView
from seahub.api2.endpoints.slide_captcha import SlideCaptchaView
from seahub.api2.endpoints.templates import TemplatesView
from seahub.api2.endpoints.dtable import PageDesignFileView, \
    DTableMetadataView, UserAdminDTablesView, WorkspacesView, DTableView, \
    DTablesView, DTableSizeView, DTableRepairView, \
    DTableAssetUploadLinkView, DTableAccessTokenView, DTableUserViewShareAccessTokenView, DTableUpdateLinkView, \
    DTableDownloadLinkView, DTableRowSharesView, DTableRowShareView, InternalDTableRelatedUsersView, \
    DTableImageRotateView, DTableGroupViewShareAccessTokenView, TrashDTablesView, TrashDTableView, DTablePasswordView
from seahub.api2.endpoints.dtable_api_token import DTableAPITokensView, DTableAPITokenView, \
    DTableAppAccessTokenView, DTableAppUploadLinkView, DTableAppDownloadLinkView, DTableAppAssetView, DTableTempAPITokenView, \
    DTableAppThirdPartyAccountView, DTableAppCustomAssetDownloadLinkView, DTableAppCustomAssetFileView, \
    DTableAppCustomAssetUploadLinkView, DTableAppCustomAssetDirView, DTableAppUserInfoView
from seahub.api2.endpoints.dtable_forms import DTableFormPublicUploadLinkView, DTableFormsView, DTableFormView, \
    DTableFormSubmitView, DTableFormLinkedTableRowsView, \
    DTableFormUploadLinkView, DTableFormShareView, SharedFormsView, DTableFormDuplicateView, DTableFormCustomURLsView
from seahub.api2.endpoints.dtable_share import SharedDTablesView, DTableShareView, \
    DTableGroupSharesView, DTableGroupShareView, GroupSharedDTablesView
from seahub.api2.endpoints.dtable_share_permission import DTableSharePermissionsView, \
    DTableSharePermissionView, DTableBaseSharePermissionView, DTableSharedPermissionView
from seahub.api2.endpoints.dtable_related_users import DTableRelatedUsersView
from seahub.api2.endpoints.dtable_share_links import DTableShareLinksView, DTableSharedLinkView
from seahub.api2.endpoints.dtable_excel import DTableExportExcel, DTableConvertViewToExcel, DTableConvertTableToExcel, \
    DTableExportTableToExcel, DTableSynchronousConvertTableToExcel, DTableSynchronousConvertViewToExcel, DTableConvertBigDataViewToExcel
from seahub.api2.endpoints.dtable_io import DTableIOStatus, DTableImportDTable, DTableExportDTable, \
    DTableImportExcelCSV, \
    DTablePageDesignConvertToPdfView, DTableAppendExcelCSVAppendParsedFile, DTableAppendExcelCSVUploadFile, \
    DTableImportExcelCSVUploadFile, DTableImportExcelCSVImportParsedFile, DTableExcelCommonGetParsedFile, \
    DTableExcelCommonDeleteExcel, DTableUpdateExcelUploadExcel, DTableUpdateExcelCSVUpdateParsedFile, \
    DTableUpdateExcelCSVGetCheckedResult, DTableUpdateCSVUploadCSV, DTableCSVCommonDeleteCSV, \
    DTableSynchronousImportExcelCSVToBase, DTableSynchronousImportExcelCSVToTable, \
    DTableSynchronousUpdateTableViaExcelCSV, DTableSynchronousAppendExcelCSV, \
    DTableSynchronousExportDTable, DTableImportTableFromBase, DTablePluginBigDataScreenExport, \
    DTablePluginBigDataScreenImport, DTableDocumentConvertToPdfView
from seahub.api2.endpoints.dtable_common_dataset import DTableCommonDatasetsView, DTableCommonDatasetView, \
    DTableCommonDatasetTableImportView, DTableCommonDatasetTableSyncView, DTableCommonDatasetSyncsView, \
    CommonDatasetSyncWithExistTableView, DTableCommonDatasetInfoView, DTableCommonDatasetForceSyncView
from seahub.api2.endpoints.dtable_common_dataset_access_group import DTableCommonDatasetAccessGroupsView, DTableCommonDatasetAccessGroupView
from seahub.api2.endpoints.seafile_connectors import SeafileRepoInfoView, SeafileRepoDirView, SeafileRepoDownloadLinkView, SeafileTransferTaskView
from seahub.api2.endpoints.dtable_activities import DTableActivitiesView, DTableActivitiesDetailView
from seahub.api2.endpoints.dtable_snapshot import DTableSnapshotsView, DTableSnapshotView, DTableLatestCommitIdView, \
    DTableSnapshotRestoreView, DTableSnapshotContentView, DTableArchiveBackupsView, DTableBigDataStateView
from seahub.api2.endpoints.dtable_plugins import DTablePluginsView, DTableSystemPluginsView, \
    DTablePluginsInstallCountView
from seahub.api2.endpoints.dtable_external_links import DTableExternalLinksView, DTableExternalLinkView, \
    DTableExternalLinkAccessTokenView
from seahub.api2.endpoints.dtable_copy import DTableCopyView, DTableExternalLinkCopyView, DTableCopyStatusView, \
    DTableDoTaskAfterCopyView, DTableCopyPreCDSsCheckView
from seahub.api2.endpoints.dtable_storage import DTableAssetRevertView, DTableAssetTrashView, DTableStorageView, \
    DTableAssetExistsView, DTableAssetZipTask, \
    DTableListRecentFileView, DTableStorageBatchDeleteAssets, DTableStorageRenameView, DTableCustomAssetUploadLinkView, \
    DTableCustomAssetDirView, DTableCustomAssetFileView, DTableCustomAssetBatchMoveItemView, \
    DTableCustomAssetBatchDeleteItemView, \
    DTableCustomAssetQueryZipProgressView, DTableCustomAssetZipTaskView, DTableCustomAssetCancelZipTaskView, \
    DTableCustomAssetBatchCopyItemView, DTableAssetFileSearchView, DTableAssetSizeView, DTableStorageZipTaskView
from seahub.api2.endpoints.user_starred_dtables import UserStarredDTablesView
from seahub.api2.endpoints.dtable_notification_rules import DTableNotificationRulesView, DTableNotificationRuleView
from seahub.api2.endpoints.dtable_view_user_share import DTableUserViewSharesView, DTableUserViewShareView, \
    ViewSharesUserSharedView, ViewShareUserSharedView
from seahub.api2.endpoints.dtable_view_group_share import DTableGroupViewSharesView, DTableGroupViewShareView, \
    ViewSharesGroupSharedView, ViewShareGroupSharedView
from seahub.api2.endpoints.organization import OrganizationView, OrganizationMembersView
from seahub.api2.endpoints.run_script import RunScriptView, ScriptPermissionsView, ScriptResultView, ScriptTaskLogsView, \
    ScriptTaskLogView, ScriptTaskFileView, ScriptTaskView, ScriptsRunningLimitView
from seahub.api2.endpoints.webhook import WebhooksView, WebhookView
from seahub.api2.endpoints.dtable_abuse_report import AbuseReports
from seahub.api2.endpoints.dtable_collection_tables import DTableCollectionTableAccessToken, \
     DTableCollectionTablesView, DTableCollectionTableView, DTableCollectionTableDuplicateView
from seahub.api2.endpoints.dtable_view_external_links import DTableViewExternalLinksView, DTableViewExternalLinkView, \
    DTableViewExternalLinkAccessTokenView
from seahub.api2.endpoints.folder import FoldersView, FolderView, FolderItemMovingView, UserShareFoldersView, \
    UserShareFolderView, DTableUserShareMoveView, DTableViewUserShareMoveView
from seahub.api2.endpoints.dtable_external_apps import DTableExternalAppsView, DTableExternalAppView, \
    DTableExternalAppDuplicateView, DTableExternalAppStatusView
from seahub.dtable_apps.universal_app.apis import DTableUniversalAppsLinksView, DTableUniversalAppsUploadLinkView, \
    DTableUniversalAppsFormUploadLinkView, DTableUniversalAppMessageSendStatusView, \
    DTableUniversalAppsEmailMessageSendViaButtonView, \
    DTableUniversalAppsMetadataView, DTableUniversalAppsPublicUploadLinkView, \
    DTableUniversalAppsRowsView, DTableUniversalAppsLockRowViaButtonView, DTableUniversalAppsModifyRowViaButtonView, \
    DTableUniversalAppsSubmitForm, DTableUniversalAppsLinkedRecordView, DTableUniversalAppsLinkedRecordsView, \
    DTableUniversalAppsColumnLinkedRecordsView, DTableUniversalAppsLinkedTableRowsView, DTableAppElementStatisticView, \
    DTableUniversalAppsRowsBatchRecoverView, DTableUniversalAppsLinksBatchView, \
    DTableUniversalAppRunScriptView, DTableAppElementStatisticDetailView, \
    DTableUniversalAppScriptResultView, DTableUniversalAppsRowsBatchView, DTableUniversalAppsSearchLinkedTableRowsView, \
    DTableUniversalAppsSearchQueryView, DTableUniversalAppSearchQueryRowView, DTableUniversalAppRowsRetrievalView, DTableUniversalAppUserNotificationsView, \
    DTableUniversalAppUserNotificationView, DTableUniversalAppDingtalkMessageSendViaButtonView, \
    DTableUniversalAppNotificationViaButtonView, DTableUniversalAppWechatMessageSendViaButtonView, \
    DTableUniversalAppPageDesignFileViaButton, DTableUniversalAppSnapshotRowsView, DTableAppSnapshotElementStatistic, \
    DTableAppRelatedUsersView, DTableUniversalAppRowCommentsView, DTableUniversalAppRowParticipantView, DTableUniversalAppRowCommentView, DTableUniversalAppRowParticipantsView, DTableAppRowsCommentsNumView, \
    MoveDtableUniversalAppToFolderView, DTableUniversalAppFoldersView, DtableUniversalAppFolderView, \
    DTableUniversalAppsAssetZipTaskView, DTableUniversalAppConvertTablePageToExcelView, DTableUniversalAppTablePageExportExcel, DTableUniversalAppTaskStatusView
from seahub.api2.endpoints.dtable_automation_rules import DTableAutomationRulesView, DTableAutomationRuleView, \
    DTableAutomationRuleRunTestView, DTableAutomationRuleTaskLogsView
from seahub.api2.endpoints.page_design_snapshot import PageDesignSnapshotsView, PageDesignSnapshotView, \
     PageDesignSnapshotRestoreView
from seahub.api2.endpoints.dtable_data_syncs import DTableDataSyncsView, DTableDataSyncView, RunDtableDataSyncView, \
    DtablePluginEmailSendEmail, DTableDataSyncStatus, DTablePluginEmailSendStatus

# apis from dtable-server
from seahub.api2.endpoints.dtable_server.dtable_notifications import DTableNotificationsView, DTableNotificationView
from seahub.api2.endpoints.dtable_server.dtable_row_comments import DTableRowCommentsView, DTableRowCommentView, \
    DTableRowsCommentsNumView, DTableRowCommentsCountView
from seahub.api2.endpoints.dtable_server.dtable_related_users import DTableRelatedUsersView as DTableRelatedUsersViewFromDTableServer
from seahub.api2.endpoints.dtable_server.user_list import UsersCommonInfoView

# dtable_apps
from seahub.dtable_apps.data_search.query import DTableDataSearchMetadataView, DTableDataSearchQueryView

# dtable plugins
from seahub.api2.endpoints.page_design import PageDesignRowLinkRecordView, PageDesignRowsLinkRecordView, \
    PageDesignExportView, PageDesignExportContentView, PageDesignImportView

# Admin
from seahub.api2.endpoints.admin.automation_rules import AdminAutomationRulesView, AdminAutomationRuleView, \
    AdminAutomationInvalidRulesView
from seahub.api2.endpoints.admin.department_v2 import AdminAddUserToDepartmentsView, AdminAddressBookV2DepartmentGroupView, AdminAddressBookV2DepartmentMemberView, \
    AdminAddressBookV2DepartmentMembersView, AdminAddressBookV2DepartmentView, \
    AdminAddressBookV2DepartmentsView, AdminDepartmentsMigrateView, AdminNonAddressBookV2UsersView
from seahub.api2.endpoints.admin.email_sending_log import EmailSendingLogsView
from seahub.api2.endpoints.address_book.departments import AddressBookDepartments, AddressBookDepartmentMembers
from seahub.api2.endpoints.admin.org_universal_apps import AdminOrgUniversalAppStats
from seahub.api2.endpoints.admin.registration_logs import RegistrationLogsView
from seahub.api2.endpoints.admin.collection_tables import AdminCollectionTablesView, AdminCollectionTableView
from seahub.api2.endpoints.admin.login_logs import AdminLoginLogs, AdminLogsLoginLogs
from seahub.api2.endpoints.admin.audit_logs import AdminAuditLogsView, AdminFileAccessLogsView
from seahub.api2.endpoints.admin.abuse_report import AdminAbuseReports, AdminAbuseReport
from seahub.api2.endpoints.admin.sysinfo import SysInfo
from seahub.api2.endpoints.admin.web_settings import AdminWebSettings
from seahub.api2.endpoints.admin.users import AdminUsers, AdminUser, AdminUserResetPassword, \
    AdminUserGroups, AdminAdminUsers, AdminSearchUser, AdminSearchUserByOrgId
from seahub.api2.endpoints.admin.system_library import AdminSystemLibrary, \
        AdminSystemLibraryUploadLink
from seahub.api2.endpoints.admin.trash_libraries import AdminTrashLibraries, AdminTrashLibrary
from seahub.api2.endpoints.admin.groups import AdminGroups, AdminGroup, AdminSearchGroup
from seahub.api2.endpoints.admin.group_members import AdminGroupMembers, AdminGroupMember
from seahub.api2.endpoints.admin.users_batch import AdminUsersBatch, AdminAdminUsersBatch, \
        AdminImportUsers
from seahub.api2.endpoints.admin.user_dtables import AdminUserDTablesView, AdminUserSharedDTablesView
from seahub.api2.endpoints.admin.operation_logs import AdminOperationLogs
from seahub.api2.endpoints.admin.organizations import AdminOrganizations, AdminOrganization, AdminSearchOrganization, \
    AdminOrganizationsBaseInfo, AdminOrgBigDataStorageStats, AdminOrganizationOrgWorkWeixinCorpInfo
from seahub.api2.endpoints.admin.org_users import AdminOrgUsers, AdminOrgUser
from seahub.api2.endpoints.admin.org_groups import AdminOrgGroups, AdminOrgGroup
from seahub.api2.endpoints.admin.org_dtables import OrgDTables
from seahub.api2.endpoints.admin.org_external_apps import AdminOrgExternalApps
from seahub.api2.endpoints.admin.logo import AdminLogo
from seahub.api2.endpoints.admin.favicon import AdminFavicon
from seahub.api2.endpoints.admin.license import AdminLicense
from seahub.api2.endpoints.admin.invitations import InvitationsView as AdminInvitationsView
from seahub.api2.endpoints.admin.login_bg_image import AdminLoginBgImage
from seahub.api2.endpoints.admin.admin_role import AdminAdminRole
from seahub.api2.endpoints.admin.address_book.groups import AdminAddressBookGroups, \
        AdminAddressBookGroup
from seahub.api2.endpoints.admin.address_book.org_groups import AdminOrgAddressBookGroup
from seahub.api2.endpoints.admin.work_weixin import AdminWorkWeixinDepartments, \
    AdminWorkWeixinDepartmentMembers, AdminWorkWeixinUsersBatch, AdminWorkWeixinDepartmentsImport
from seahub.api2.endpoints.admin.dtables import AdminDtables, AdminTrashDTablesView, AdminTrashDTableView, \
    AdminSearchDTable, AdminDtable, AdminDTableExternalLinksView, AdminDTableArchives, AdminUnsetDTablePasswordView,  AdminRepairDTableView, \
    AdminArchiveBackups, AdminDTableAPITokensView, AdminDTableAPITokenView, AdminExportDTable, AdminCopyDTable, \
    AdminDTableDoTaskAfterCopyView, AdminSynchronousExportDTable, \
    AdminDTableSharePermissionsView, AdminDTableShareView, \
    AdminDTableGroupSharesView
from seahub.api2.endpoints.admin.group_dtables import AdminGroupDTables, AdminGroupDTable
from seahub.api2.endpoints.admin.forms import AdminFormsView, AdminFormView
from seahub.api2.endpoints.admin.sys_notifications import AdminSysNotificationsView, AdminSysNotificationView, \
    AdminSysUserNotificationsView, AdminSysUserNotificationView
from seahub.api2.endpoints.admin.statistics import ActiveUsersView, AdminRunScriptStatisticsView, \
    AdminAutomationRulesStatisticView, AdminAutomationRulesStatisticDetailView, AdminExternalAppsStatisticView
from seahub.api2.endpoints.admin.active_users import DailyActiveUsersView
from seahub.api2.endpoints.admin.external_links import AdminExternalLinks, AdminExternalLink, AdminViewExternalLinks, \
    AdminViewExternalLink, AdminSearchExternalLinksView, AdminSearchViewExternalLinksView
from seahub.api2.endpoints.admin.sys_plugins import AdminDTableSystemPluginsView, AdminDTableSystemPluginView, \
    AdminDTableSystemPluginsInstallCountView
from seahub.api2.endpoints.admin.storage import AdminGroupStorageFileView, AdminUserStorageFileView, \
    AdminGroupStorages, AdminUserStorage
from seahub.api2.endpoints.admin.notification_rules import AdminNotificationRulesView, AdminNotificationRuleView, \
    AdminNotificationInvalidRulesView
from seahub.api2.endpoints.admin.external_apps import AdminExternalApps, AdminExternalApp, AdminSearchExternalApps, \
    AdminExternalAppOpenAccess
from seahub.api2.endpoints.sessions import SessionsView, OnlineSessionView, SessionView
from seahub.api2.endpoints.admin.dtable_notifications import AdminDTableNotifications
from seahub.api2.endpoints.admin.two_factor_auth import TwoFactorAuthView
from seahub.api2.endpoints.admin.common_datasets import AdminCommonDatasetsView, \
    AdminCommonDatasetPeriodicalSyncsView, AdminCommonDatasetInvalidSyncsView, AdminCommonDatasetSyncView
from seahub.api2.endpoints.admin.workflows import AdminWorkflows
from seahub.ai.apis import AssistantHistory, ReceiptRecognition, AIAssistant, AIAssistants, AssistantTable, AssistantTables, AssistantMember, \
    AssistantMembers, AddTaskRecord, UserAdminBases, UserAdminBaseTables, AddRecognitionRecord, \
    AddIssueRecord, TasksDetail, TextInformationExtraction, CandidateMembers, AssistantTablesIndex, AssigneeTasksStats, \
    AssigneeFutureTasks, AssigneeTasksDetails, AssistantSettings, AssistantSetting, IssueDetails, UploadFile, \
    AssistantAssetAccess, Row, AssistantAssetPreview, Agent, \
    ExtractWholeWebPageInfo, ExtractSelectedWebInfo, \
    AssistantTemplateTables, AddQARecord
from seahub.ai.internal_apis import AIGetUserByNameView, AIDTableAssetDownloadLinkView, AIDTableInfoView, \
    AssistantAdminPermission, DtableAdminPermission, GetOwnerInfoByAssistant, AIDTableAssetUploadLink
from seahub.api2.endpoints.dtable_document import DTableDocumentPluginFileView, DTableDocumentPluginDuplicateDocumentView, \
    DTableDocumentPluginDocumentsView, DTableDocumentPluginDocumentView, DtableDocumentPluginDocumentExportView, \
    DtableDocumentPluginDocumentImportView, DtableDocumentPluginExportFileView
from seahub.api2.endpoints.admin.virus_scan_records import AdminVirusFilesView, AdminVirusFileView, \
    AdminVirusFilesBatchView
from seahub.oauth.views import thirdparty_email_account_oauth_callback

urlpatterns = [
    re_path(r'^accounts/', include('seahub.registration.urls')),

    re_path(r'^sso/$', sso, name='sso'),
    re_path(r'^sso-auto-login/$', sso_auto_login, name='sso-auto-login'),
    re_path(r'^external-team-admin/$', external_team_admin, name='external-team-admin'),
    re_path(r'^shib-login/', shib_login, name="shib_login"),
    re_path(r'^mobile-login/', mobile_login, name="mobile_login"),

    re_path(r'^$', dtable_fake_view, name='dtable'),
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
    re_path(r'^dtable/$', dtable_fake_view, name='dtable_bases'),
    re_path(r'^dtable/(?P<workspace_id>\d+)/$', dtable_fake_view, name="dtable_workspace"),
    re_path(r'^dtable/starred/$', dtable_fake_view, name="dtable_starred"),
    re_path(r'^dtable/shared/$', dtable_fake_view, name="dtable_shared"),
    re_path(r'^dtable/trash/$', dtable_fake_view, name="dtable_trash"),
    re_path(r'^forms/$', dtable_fake_view, name='forms'),
    re_path(r'^universal-apps/$', dtable_fake_view, name='universal-apps'),
    re_path(r'^user-guide/$', dtable_fake_view, name='user-guide'),
    re_path(r'^activities/$', dtable_fake_view, name='dtable_activities'),
    re_path(r'^common-datasets/$', dtable_fake_view, name='dtable_common_datasets'),
    re_path(r'^dtable/apps/$', dtable_fake_view, name='dtable_apps'),
    re_path(r'^dtable/templetes/$', dtable_fake_view, name='dtable_templetes'),
    re_path(r'^invitation-link/$', dtable_fake_view, name='invitation-link'),
    re_path(r'^more/$', dtable_fake_view, name='more'),
    re_path(r'^more/data-sync/$', dtable_fake_view, name='more/data-sync'),
    re_path(r'^workflows/$', dtable_fake_view, name='workflows'),
    re_path(r'^workflows/shared/$', dtable_fake_view, name='workflows/shared'),
    re_path(r'^workflows/ongoing-tasks/$', dtable_fake_view, name='workflows/ongoing-tasks'),
    re_path(r'^workflows/submitted-tasks/$', dtable_fake_view, name='workflows/submitted-tasks'),
    re_path(r'^workflows/panel/$', dtable_fake_view, name='workflows/panel'),
    re_path(r'^departments-v2/$', dtable_fake_view, name='departments-v2'),


    ### Apps ###
    re_path(r'^api2/', include('seahub.api2.urls')),

    ## slide captcha
    re_path(r'^api/v2.1/slide-captcha/$', SlideCaptchaView.as_view(), name="api-v2.1-slide-captcha"),

    ## user
    re_path(r'^api/v2.1/user/$', User.as_view(), name="api-v2.1-user"),

    ## user: update contact email
    re_path(r'^api/v2.1/user/contact-email/$', UserContactEmailView.as_view(), name="api-v2.1-user-contact-email"),

    ## user:common info
    re_path(r'^api/v2.1/user-common-info/(?P<email>.+)/$', UserCommonInfoView.as_view(), name='api-v2.1-user-common-info'),

    ## user:phone
    re_path(r'^api/v2.1/user/sms-verify/$', SmsVerifyCodeView.as_view(), name="api-v2.1-user-sms-verify"),
    re_path(r'^api/v2.1/user/bind-phone/$', BindPhoneView.as_view(), name="api-v2.1-user-phone-bind"),
    re_path(r'^api/v2.1/user/unbind-phone/$', UnbindPhoneView.as_view(), name="api-v2.1-user-phone-unbind"),

    # user:password
    re_path(r'^api/v2.1/user/remove-password/$', RemovePasswordView.as_view(), name="api-v2.1-user-remove-password"),

    # user:reset password by phone
    re_path(r'^api/v2.1/user/reset-password-by-phone/$', UserResetPasswordByPhoneView.as_view(), name="api-v2.1-user-reset-password-by-phone"),
    re_path(r'^api/v2.1/user/reset-password/$', ResetPasswordView.as_view(), name="api-v2.1-user-reset-password"),

    # user:convert to team account
    re_path(r'^api/v2.1/user/convert-to-team/$', UserConvertToTeamView.as_view(), name="api-v2.1-user-convert-to-team"),

    # departments
    re_path(r'api/v2.1/departments/$', Departments.as_view(), name='api-v2.1-all-departments'),

    ## user::groups
    re_path(r'^api/v2.1/shareable-groups/$', ShareableGroups.as_view(), name='api-v2.1-shareable-groups'),
    re_path(r'^api/v2.1/groups/$', Groups.as_view(), name='api-v2.1-groups'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/$', Group.as_view(), name='api-v2.1-group'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/$', GroupMembers.as_view(), name='api-v2.1-group-members'),
    re_path(r'^api/v2.1/groups/move-group/$', GroupMoveView.as_view(), name='api-v2.1-group-move'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/search-member/$', GroupSearchMember.as_view(), name='api-v2.1-group-search-member'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/bulk/$', GroupMembersBulk.as_view(), name='api-v2.1-group-members-bulk'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/members/(?P<email>[^/]+)/$', GroupMember.as_view(), name='api-v2.1-group-member'),
    re_path(r'^api/v2.1/search-group/$', SearchGroup.as_view(), name='api-v2.1-search-group'),

    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/invite-links/$', GroupInviteLinks.as_view(), name='api-v2.1-group-invite-links'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/invite-links/(?P<token>[-0-9a-f]{8})/$', GroupInviteLink.as_view(), name='api-v2.1-group-invite-link'),

    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/trash-dtables/$', GroupTrashDTablesView.as_view(), name='api-v2.1-group-trash-dtables'),
    re_path(r'^api/v2.1/groups/(?P<group_id>\d+)/trash-dtables/(?P<dtable_uuid>[-0-9a-f]+)/$', GroupTrashDTableView.as_view(), name='api-v2.1-group-trash-dtable'),

    ## sessions
    re_path(r'^api/v2.1/sessions/$', SessionsView.as_view(), name='api-v2.1-sessions'),
    re_path(r'^api/v2.1/sessions/(?P<session_id>\d+)/$', SessionView.as_view(), name='api-v2.1-session'),
    re_path(r'^api/v2.1/online-sessions/(?P<session_id>\d+)/$', OnlineSessionView.as_view(), name='api-v2.1-online-session'),

    ## org
    re_path(r'^api/v2.1/organizations/(?P<org_id>\d+)/$', OrganizationView.as_view(), name='api-v2.1-organization'),
    re_path(r'^api/v2.1/organizations/(?P<org_id>\d+)/members/$', OrganizationMembersView.as_view(), name='api-v2.1-organization-members'),

    ## address book
    re_path(r'^api/v2.1/address-book/groups/(?P<group_id>\d+)/sub-groups/$', AddressBookGroupsSubGroups.as_view(), name='api-v2.1-address-book-groups-sub-groups'),
    re_path(r'^api/v2.1/address-book/groups/(?P<group_id>\d+)/search-member/$', AddressBookGroupsSearchMember.as_view(), name='api-v2.1-address-book-search-member'),
    re_path(r'^api/v2.1/address-book/departments/$', AddressBookDepartments.as_view(), name='api-v2.1-address-book-groups-departments'),
    re_path(r'^api/v2.1/address-book/departments/(?P<department_id>\d+)/members/$', AddressBookDepartmentMembers.as_view(), name='api-v2.1-address-book-groups-department-members'),

    ## address book v2
    re_path(r'^api/v2.1/address-book-v2/user-departments/$', AddressBookV2UserDepartmentsView.as_view(), name='api-v2.1-address-book-v2-user-departments'),
    re_path(r'^api/v2.1/address-book-v2/departments/$', AddressBookV2Departments.as_view(), name='api-v2.1-address-book-v2-departments'),
    re_path(r'^api/v2.1/address-book-v2/departments/(?P<department_id>\d+)/sub-departments/$', AddressBookV2SubDepartmentsView.as_view(), name='api-v2.1-address-book-v2-sub-departments'),
    re_path(r'^api/v2.1/address-book-v2/departments/(?P<department_id>\d+)/members/$', AddressBookV2DepartmentMembersView.as_view(), name='api-v2.1-address-book-v2-department-members'),
    re_path(r'^api/v2.1/address-book-v2/departments/(?P<department_id>\d+)/members/(?P<email>[^/]+@[^/]+)/dtables/$', AddressBookV2DepartmentMemberDTablesView.as_view(), name='api-v2.1-address-book-v2-department-member-dtables'),
    re_path(r'^api/v2.1/address-book-v2/departments/groups/(?P<group_id>\d+)/members-count/$', AddressBookV2DepartmentGroupMembersCountView.as_view(), name='api-v2.1-address-book-v2-department-group-members-count'),

    # user: dtable
    re_path(r'^api/v2.1/workspaces/$', WorkspacesView.as_view(), name='api-v2.1-workspaces'),
    re_path(r'^api/v2.1/dtables/$', DTablesView.as_view(), name='api-v2.1-dtables'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/size/$', DTableSizeView.as_view(), name='api-v2.1-dtable-size'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/repair/$', DTableRepairView.as_view(), name='api-v2.1-dtable-repair'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/$', DTableView.as_view(), name='api-v2.1-workspace-dtable'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable-asset-upload-link/$', DTableAssetUploadLinkView.as_view(), name='api-v2.1-workspace-dtable-asset-upload-link'),


    # user: workspace folder
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/folders/$', FoldersView.as_view(), name='api-v2.1-folders'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/folders/(?P<folder_id>\d+)/$', FolderView.as_view(), name='api-v2.1-folder'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/folder-item-moving/$', FolderItemMovingView.as_view(), name='api-v2.1-folder-item-moving'),

    # user: share folders
    re_path(r'^api/v2.1/dtables/share-folders/$', UserShareFoldersView.as_view(), name='api-v2.1-share-folders'),
    re_path(r'^api/v2.1/dtables/share-folders/(?P<share_folder_id>\d+)/$', UserShareFolderView.as_view(), name='api-v2.1-share-folders'),
    re_path(r'^api/v2.1/dtables/share-table-move-to-folder/(?P<dtable_share_id>\d+)/$', DTableUserShareMoveView.as_view(), name='api-v2.1-user-share-move-to-folder'),
    re_path(r'^api/v2.1/dtables/share-view-move-to-folder/(?P<view_share_id>\d+)/$', DTableViewUserShareMoveView.as_view(), name='api-v2.1-user-view-share-move-to-folder'),

    re_path(r'^api/v2.1/dtables/invite-links/$', DTableShareLinksView.as_view(), name='api-v2.1-dtables-share-links'),
    re_path(r'^api/v2.1/dtables/invite-links/(?P<token>[0-9a-f]+)/$', DTableSharedLinkView.as_view(), name='api-v2.1-dtables-share-link'),

    # user: admin dtables
    re_path(r'^api/v2.1/user-admin-dtables/$', UserAdminDTablesView.as_view(), name='api-v2.1-user-admin-dtables'),

    # user: dtable share
    re_path(r'^api/v2.1/dtables/shared/$', SharedDTablesView.as_view(), name='api-v2.1-dtables-share'),
    re_path(r'^api/v2.1/dtables/group-shared/$', GroupSharedDTablesView.as_view(), name='api-v2.1-group-dtables-share'),

    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/base-share-permission/$', DTableBaseSharePermissionView.as_view(), name='api-v2.1-dtable-base-share-permission'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/share-permissions/$', DTableSharePermissionsView.as_view(), name='api-v2.1-dtable-share-permissions'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/share-permissions/(?P<permission_id>\d+)/$', DTableSharePermissionView.as_view(), name='api-v2.1-dtable-share-permission'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/shared-permissions/(?P<permission_id>\d+)/$', DTableSharedPermissionView.as_view(), name='api-v2.1-dtable-shared-permission'),

    re_path(r'^api/v2.1/dtables/view-shares-user-shared/$', ViewSharesUserSharedView.as_view(), name='api-v2.1-view-shares-user-shared'),
    re_path(r'^api/v2.1/dtables/view-shares-user-shared/(?P<user_view_share_id>\d+)/$', ViewShareUserSharedView.as_view(), name='api-v2.1-view-share-user-shared'),
    re_path(r'^api/v2.1/dtables/view-shares-group-shared/$', ViewSharesGroupSharedView.as_view(), name='api-v2.1-view-shares-group-shared'),
    re_path(r'^api/v2.1/dtables/view-shares-group-shared/(?P<group_view_share_id>\d+)/$', ViewShareGroupSharedView.as_view(), name='api-v2.1-view-share-group-shared'),

    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/share/$', DTableShareView.as_view(), name='api-v2.1-dtable-share'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/group-shares/$', DTableGroupSharesView.as_view(), name='api-v2.1-dtable-group-shares'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/group-shares/(?P<group_id>\d+)/$', DTableGroupShareView.as_view(), name='api-v2.1-dtable-group-share'),

    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/user-view-shares/$', DTableUserViewSharesView.as_view(), name='api-v2.1-dtable-user-view-shares'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/user-view-shares/(?P<user_view_share_id>\d+)/$', DTableUserViewShareView.as_view(), name='api-v2.1-dtable-user-view-share'),

    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/group-view-shares/$', DTableGroupViewSharesView.as_view(), name='api-v2.1-dtable-group-view-shares'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/group-view-shares/(?P<group_view_share_id>\d+)/$', DTableGroupViewShareView.as_view(), name='api-v2.1-dtable-group-view-share'),

    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/user-view-share-access-token/$', DTableUserViewShareAccessTokenView.as_view(), name='api-v2.1-dtable-user-view-share-access-token'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/group-view-share-access-token/$', DTableGroupViewShareAccessTokenView.as_view(), name='api-v2.1-dtable-group-view-share-access-token'),

    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/related-users/$', DTableRelatedUsersView.as_view(), name='api-v2.1-dtable-related-users'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/access-token/$', DTableAccessTokenView.as_view(), name='api-v2.1-dtable-access-token'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/api-tokens/$', DTableAPITokensView.as_view(), name='api-v2.1-dtable-api-tokens'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/api-tokens/(?P<app_name>.*)/$', DTableAPITokenView.as_view(), name='api-v2.1-dtable-api-token'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/temp-api-token/$', DTableTempAPITokenView.as_view(), name='api-v2.1-dtable-temp-api-token'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/convert-view-to-excel/$', DTableConvertViewToExcel.as_view(), name='api-v2.1-dtable-parse-view-to-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/convert-big-data-view-to-excel/$', DTableConvertBigDataViewToExcel.as_view(), name='api-v2.1-dtable-convert-big-data-view-to-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/export-excel/$', DTableExportExcel.as_view(), name='api-v2.1-dtable-export-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/convert-table-to-excel/$', DTableConvertTableToExcel.as_view(), name='api-v2.1-dtable-convert-table-to-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/export-table-to-excel/$', DTableExportTableToExcel.as_view(), name='api-v2.1-dtable-export-table-to-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/synchronous-export/export-table-to-excel/$', DTableSynchronousConvertTableToExcel.as_view(), name='api-v2.1-dtable-synchronous-export-table-to-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/synchronous-export/export-view-to-excel/$', DTableSynchronousConvertViewToExcel.as_view(), name='api-v2.1-dtable-synchronous-export-view-to-excel'),

    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/password/$', DTablePasswordView.as_view(), name='api-v2.1-workspace-dtable-password'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/snapshots/$', DTableSnapshotsView.as_view(), name='api-v2.1-dtable-snapshots'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/snapshots/(?P<commit_id>[-0-9a-f]{36,40})/$', DTableSnapshotView.as_view(), name='api-v2.1-dtable-snapshot'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/snapshots/(?P<commit_id>[-0-9a-f]{36,40})/content/$', DTableSnapshotContentView.as_view(), name='api-v2.1-dtable-snapshot-content'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/snapshots/(?P<commit_id>[-0-9a-f]{36,40})/restore/$', DTableSnapshotRestoreView.as_view(), name='api-v2.1-dtable-snapshot-restore'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/archive-backups/$', DTableArchiveBackupsView.as_view(), name='api-v2.1-dtable-archive-backups'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/big-data-state/$', DTableBigDataStateView.as_view(), name='api-v2.1-dtable-big-data-state'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/rotate-image/$', DTableImageRotateView.as_view(), name='api-v2.1-dtable-picture-rotate'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/asset-exists/$', DTableAssetExistsView.as_view(), name='api-v2.1-dtable-asset-exists'),
    re_path(r'^api/v2.1/starred-dtables/', UserStarredDTablesView.as_view(), name='api-v2.1-starred-dtables'),
    re_path(r'^api/v2.1/trash-dtables/$',TrashDTablesView.as_view(), name='api-v2.1-trash-dtables'),
    re_path(r'^api/v2.1/trash-dtables/(?P<dtable_id>\d+)/$', TrashDTableView.as_view(), name='api-v2.1-trash-dtable'),

    # dtable notification rules
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/notification-rules/$', DTableNotificationRulesView.as_view(), name='api-v2.1-dtable-notification-rules'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/notification-rules/(?P<notification_rule_id>\d+)/$', DTableNotificationRuleView.as_view(), name='api-v2.1-dtable-notification-rule'),

    # dtable automation rules
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/automation-rules/$', DTableAutomationRulesView.as_view(), name='api-v2.1-dtable-automation-rules'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/automation-rules/(?P<automation_rule_id>\d+)/$', DTableAutomationRuleView.as_view(), name='api-v2.1-dtable-automation-rule'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/automation-rules/(?P<automation_rule_id>\d+)/run-test/$', DTableAutomationRuleRunTestView.as_view(), name='api-v2.1-dtable-automation-rule-run-test'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/automation-rules/(?P<automation_rule_id>\d+)/task-logs/$', DTableAutomationRuleTaskLogsView.as_view(), name='api-v2.1-dtable-automation-rule-task-logs'),

    # dtable external apps
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/external-apps/$', DTableExternalAppsView.as_view(), name='api-v2.1-dtable-external-apps'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/external-apps/(?P<external_app_id>\d+)/$', DTableExternalAppView.as_view(), name='api-v2.1-dtable-external-app'),
    re_path(r'^api/v2.1/external-apps/(?P<app_uuid>[-0-9a-f]{36})/duplicate/$', DTableExternalAppDuplicateView.as_view(), name='api-v2.1-dtable-external-app-duplicate'),
    re_path(r'^api/v2.1/external-apps/(?P<app_uuid>[-0-9a-f]{36})/status/$', DTableExternalAppStatusView.as_view(), name='api-v2.1-dtable-external-app-suspend'),

    # dtable universal apps
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/metadata/$', DTableUniversalAppsMetadataView.as_view(),name='api-v2.1-dtable-universal-apps-metadata'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/rows/$', DTableUniversalAppsRowsView.as_view(),name='api-v2.1-dtable-universal-apps-rows'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/rows-retrieval/$', DTableUniversalAppRowsRetrievalView.as_view(),name='api-v2.1-dtable-universal-apps-rows-retrieval'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/rows/batch-recover/$', DTableUniversalAppsRowsBatchRecoverView.as_view(),name='api-v2.1-dtable-universal-apps-batch-recover'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/rows/batch/$', DTableUniversalAppsRowsBatchView.as_view(),name='api-v2.1-dtable-universal-apps-batch'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/lock-row-via-button/$', DTableUniversalAppsLockRowViaButtonView.as_view(),name='api-v2.1-dtable-universal-apps-lock-row-via-button'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/modify-row-via-button/$', DTableUniversalAppsModifyRowViaButtonView.as_view(),name='api-v2.1-dtable-universal-apps-modify-row-via-button'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/linked-record/$', DTableUniversalAppsLinkedRecordView.as_view(),name='api-v2.1-dtable-universal-apps-linked-record'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/linked-records/$', DTableUniversalAppsLinkedRecordsView.as_view(),name='api-v2.1-dtable-universal-apps-linked-records'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/column-linked-records/$', DTableUniversalAppsColumnLinkedRecordsView.as_view(),name='api-v2.1-dtable-universal-apps-column-linked-records'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/links/$', DTableUniversalAppsLinksView.as_view(),name='api-v2.1-dtable-universal-apps-links'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/links/batch/$', DTableUniversalAppsLinksBatchView.as_view(),name='api-v2.1-dtable-universal-apps-links'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/asset/public-upload-link/$', DTableUniversalAppsPublicUploadLinkView.as_view(),name='api-v2.1-dtable-universal-apps-public-upload-link'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/asset/upload-link/$', DTableUniversalAppsUploadLinkView.as_view(),name='api-v2.1-dtable-universal-apps-asset-upload-link'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/asset/form-upload-link/$', DTableUniversalAppsFormUploadLinkView.as_view(),name='api-v2.1-dtable-universal-apps-form-upload-link'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/form-submit/$', DTableUniversalAppsSubmitForm.as_view(), name='api-v2.1-dtable-universal-apps-form-submit'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/linked-table-rows/$', DTableUniversalAppsLinkedTableRowsView.as_view(), name='api-v2.1-dtable-universal-linked-table-rows'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/linked-table-rows/search/$', DTableUniversalAppsSearchLinkedTableRowsView.as_view(), name='api-v2.1-dtable-universal-linked-table-rows'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/app-users/$', DTableUniversalAppUsersView.as_view(),name='api-v2.1-dtable-universal-app-users'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/search-user/$', DTableUniversalAppSearchUserView.as_view(),name='api-v2.1-dtable-universal-app-search-user'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/app-users/batch/$', DTableUniversalAppUsersBatch.as_view(),name='api-v2.1-dtable-universal-app-users-batch'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/app-users/sync/$', DTableUniversalAppUserSyncView.as_view(),name='api-v2.1-dtable-universal-app-users-sync'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/app-users/(?P<app_user_id>\d+)/$', DTableUniversalAppUserView.as_view(),name='api-v2.1-dtable-universal-app-user'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/app-roles/$', DTableUniversalAppRolesView.as_view(),name='api-v2.1-dtable-universal-app-roles'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/app-roles/(?P<app_role_id>\d+)/$', DTableUniversalAppRoleView.as_view(),name='api-v2.1-dtable-universal-app-role'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/invite-links/$', DTableUniversalAppInviteLinksView.as_view(),name='api-v2.1-dtable-universal-app-invite-links'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/query/$', DTableUniversalAppsSearchQueryView.as_view(),name='api-v2.1-dtable-universal-app-db-query'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/query/row/$', DTableUniversalAppSearchQueryRowView.as_view(),name='api-v2.1-dtable-universal-app-db-query-row'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/invite-links/(?P<link_token>[0-9a-f]+)/$', DTableUniversalAppInviteLinkView.as_view(),name='api-v2.1-dtable-universal-invite-link'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/statistic/$', DTableAppElementStatisticView.as_view(),name='api-v2.1-dtable-universal-statistic'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/statistic-detail/$', DTableAppElementStatisticDetailView.as_view(),name='api-v2.1-dtable-universal-statistic'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/notification-via-button/$', DTableUniversalAppNotificationViaButtonView.as_view(),name='api-v2.1-dtable-universal-apps-notification-via-button'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/email-via-button/$', DTableUniversalAppsEmailMessageSendViaButtonView.as_view(),name='api-v2.1-dtable-universal-apps-email-via-button'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/wechat-via-button/$', DTableUniversalAppWechatMessageSendViaButtonView.as_view(),name='api-v2.1-dtable-universal-apps-wechat-via-button'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/dingtalk-via-button/$', DTableUniversalAppDingtalkMessageSendViaButtonView.as_view(),name='api-v2.1-dtable-universal-apps-dingtalk-via-button'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/dtable-message-status/$', DTableUniversalAppMessageSendStatusView.as_view(),name='api-v2.1-dtable-universal-apps-message-send-status'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/page-design-file-via-button/$', DTableUniversalAppPageDesignFileViaButton.as_view(),name='api-v2.1-dtable-universal-apps-page-design-file-via-button'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/result/(?P<script_id>\d+)/$', DTableUniversalAppScriptResultView.as_view(),name='api-v2.1-dtable-universal-script-result'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/$', DTableUniversalAppRunScriptView.as_view(),name='api-v2.1-dtable-universal-run-script'),
    re_path(r'^api/v2.1/universal-apps/$', DTableUniversalAppsView.as_view(),name='api-v2.1-dtable-universal-apps'),
    re_path(r'^api/v2.1/app-users/(?P<app_user_id>\d+)/$', DTableAppUsersView.as_view(), name='api-v2.1-dtable-app-users'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/custom-url/$', DTableUniversalAppCustomURLView.as_view(), name='api-v2.1-dtable-universal-app-custom-url'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/departments/(?P<department_id>\d+)/members/$', AddressBookDepartmentMembersForApp.as_view(), name='api-v2.1-dtable-department-members-for-universal-app'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/departments-v2/(?P<department_id>\d+)/members/$', AddressBookDepartmentV2MembersForApp.as_view(), name='api-v2.1-dtable-department-v2-members-for-universal-app'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/organizations/(?P<org_id>\d+)/members/$', OrganizationMembersForApp.as_view(), name='api-v2.1-dtable-department-members-for-universal-app'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/snapshots/$', DTableUniversalAppSnapshotsView.as_view(), name='api-v2.1-dtable-universal-app-snapshots'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/snapshots/(?P<snapshot_id>\d+)/$', DTableUniversalAppSnapshotView.as_view(), name='api-v2.1-dtable-universal-app-snapshot'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/snapshots/(?P<snapshot_id>\d+)/restore/$', DTableUniversalAppSnapshotRestoreView.as_view(), name='api-v2.1-dtable-universal-app-snapshot-restore'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/snapshots/(?P<snapshot_id>\d+)/rows/$', DTableUniversalAppSnapshotRowsView.as_view(), name='api-v2.1-dtable-universal-app-snapshot-rows'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/snapshots/(?P<snapshot_id>\d+)/statistic/$', DTableAppSnapshotElementStatistic.as_view(), name='api-v2.1-dtable-universal-app-snapshot-statistic'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/version-update/$', DTableUniversalAppVersionUpdateView.as_view(), name='api-v2.1-dtable-universal-app-version-update'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/related-users/$', DTableAppRelatedUsersView.as_view(), name='api-v2.1-dtable-universal-app-related-users'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/pages/$', DTableUniversalAppsPagesView.as_view(),name='api-v2.1-dtable-universal-apps-pages'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/pages/(?P<page_id>[0-9a-zA-Z]{4})/$', DTableUniversalAppsPageView.as_view(),name='api-v2.1-dtable-universal-apps-pages'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/pages/move-page/$', DTableUniversalAppsMovePageView.as_view(),name='api-v2.1-dtable-universal-apps-pages'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/anonymous-access-password/$', DTableUniversalAnonymousPassword.as_view(), name='api-v2.1-dtable-universal-app-anonymous-access-password'),

    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/notifications/$', DTableUniversalAppUserNotificationsView.as_view(),name='api-v2.1-dtable-universal-app-notifications'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/notifications/(?P<notification_id>\d+)/$', DTableUniversalAppUserNotificationView.as_view(),name='api-v2.1-dtable-universal-app-notification'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/row-comments/$', DTableUniversalAppRowCommentsView.as_view(),name='api-v2.1-dtable-universal-app-row-comment'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/row-comments/(?P<comment_id>\d+)/$', DTableUniversalAppRowCommentView.as_view(),name='api-v2.1-dtable-universal-app-row-comments'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/row-participants/$', DTableUniversalAppRowParticipantsView.as_view(),name='api-v2.1-dtable-universal-app-row-participants'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/row-participants/(?P<participant_id>\d+)/$', DTableUniversalAppRowParticipantView.as_view(),name='api-v2.1-dtable-universal-app-row-participant'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/rows-comments-num/$', DTableAppRowsCommentsNumView.as_view(), name='api-v2.1-dtable-server-dtable-rows-comments-num'),
    re_path(r'^api/v2.1/universal-apps/folders/$', DTableUniversalAppFoldersView.as_view(), name='api-v2.1-dtable-universal-app-folders'),
    re_path(r'^api/v2.1/universal-apps/folders/(?P<app_folder_id>\d+)/$', DtableUniversalAppFolderView.as_view(), name='api-v2.1-dtable-universal-app-folder'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/move-app-to-folder/$', MoveDtableUniversalAppToFolderView.as_view(), name='api-v2.1-move-dtable-universal-app-to-folder'),

    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/asset/zip-task/$', DTableUniversalAppsAssetZipTaskView.as_view(), name='api-v2.1-dtable-apps-asset-zip-task'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/convert-table-to-excel/$', DTableUniversalAppConvertTablePageToExcelView.as_view(), name='api-v2.1-dtable-universal-app-convert-table-page-to-excel'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/export-table-to-excel/$', DTableUniversalAppTablePageExportExcel.as_view(), name='api-v2.1-dtable-universal-app-export-table-to-excel'),
    re_path(r'^api/v2.1/universal-apps/(?P<app_uuid>[-0-9a-f]{36})/task-status/$', DTableUniversalAppTaskStatusView.as_view(), name='api-v2.1-dtable-universal-app-export-status'),
    # dtable_apps
    ## data-search
    re_path(r'^api/v2.1/dtable-apps/data-search/(?P<app_uuid>[-0-9a-f]{36})/query/$', DTableDataSearchQueryView.as_view(), name='api-v2.1-data-search-query'),
    re_path(r'^api/v2.1/dtable-apps/data-search/(?P<app_uuid>[-0-9a-f]{36})/metadata/$', DTableDataSearchMetadataView.as_view(), name='api-v2.1-data-search-metadata'),
    re_path(r'^api/v2.1/dtable-apps/data-search/image-recognize/$', DataImageRecognizeView.as_view(), name='api-v2.1-data-image-recognize'),
    ## gallery
    re_path(r'^api/v2.1/dtable-apps/gallery/(?P<app_uuid>[-0-9a-f]{36})/rows/$', DTableGalleryRowsView.as_view(), name='api-v2.1-gallery-rows'),
    re_path(r'^api/v2.1/dtable-apps/gallery/(?P<app_uuid>[-0-9a-f]{36})/metadata/$', DTableGalleryMetadataView.as_view(), name='api-v2.1-gallery-metadata'),
    ## map-cn
    re_path(r'^api/v2.1/dtable-apps/map-cn/(?P<app_uuid>[-0-9a-f]{36})/rows/$', DTableMapCNRowsView.as_view(), name='api-v2.1-map-cn-rows'),
    re_path(r'^api/v2.1/dtable-apps/map-cn/(?P<app_uuid>[-0-9a-f]{36})/metadata/$', DTableMapCNMetadataView.as_view(), name='api-v2.1-map-cn-metadata'),
    ## big-data-screen
    re_path(r'^api/v2.1/big-data-screens/(?P<app_uuid>[-0-9a-f]{36})/metadata/$', BigDataScreensMetadataView.as_view(),name='api-v2.1-dtable-big-data-screens-metadata'),
    re_path(r'^api/v2.1/big-data-screens/(?P<app_uuid>[-0-9a-f]{36})/statistic/$', BigDataScreensElementStatisticView.as_view(),name='api-v2.1-dtable-big-data-screens-statistic'),
    re_path(r'^api/v2.1/big-data-screens/(?P<app_uuid>[-0-9a-f]{36})/statistic-detail/$', BigDataScreensElementStatisticDetailView.as_view(),name='api-v2.1-dtable-big-data-screens-statistic-detail'),
    re_path(r'^api/v2.1/big-data-screens/(?P<app_uuid>[-0-9a-f]{36})/admin-upload-link/$', BigDataScreensAdminUploadLinkView.as_view(),name='api-v2.1-dtable-big-data-admin-upload-link'),
    re_path(r'^api/v2.1/big-data-screens/(?P<app_uuid>[-0-9a-f]{36})/import/$', BigDataScreensImportView.as_view(),name='api-v2.1-dtable-big-data-screens-import'),
    re_path(r'^api/v2.1/big-data-screens/(?P<app_uuid>[-0-9a-f]{36})/export/$', BigDataScreensExportView.as_view(),name='api-v2.1-dtable-big-data-screens-export'),
    re_path(r'^api/v2.1/big-data-screens/(?P<app_uuid>[-0-9a-f]{36})/custom-url/$', BigDataScreensCustomURLView.as_view(), name='api-v2.1-dtable-big-data-screens-custom-url'),

    # workflow
    re_path(r'^api/v2.1/workflows/$', DTableWorkflowsView.as_view(), name='api-v2.1-workflows'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/$', DTableWorkflowView.as_view(), name='api-v2.1-workflow'),
    re_path(r'^api/v2.1/workflows/ongoing-tasks/count/$', DTableWorkflowOngoingTasksCountView.as_view(), name='api-v2.1-workflows-ongoing-tasks-count'),
    re_path(r'^api/v2.1/workflows/ongoing-tasks/$', DTableWorkflowOngoingTasksView.as_view(), name='api-v2.1-workflows-ongoing-tasks'),
    re_path(r'^api/v2.1/workflows/submitted-tasks/$', DTableWorkflowSubmittedTasksView.as_view(), name='api-v2.1-workflows-submitted-tasks'),
    re_path(r'^api/v2.1/workflows/handled-tasks/$', DTableWorkflowHandledTasksView.as_view(), name='api-v2.1-workflows-handled-tasks'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/$', DTableWorkflowTasksView.as_view(), name='api-v2.1-dtable-workflow-tasks'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/$', DTableWorkflowTaskView.as_view(), name='api-v2.1-dtable-workflow-task'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/admin-view/$', DTableWorkflowTaskAdminView.as_view(), name='api-v2.1-dtable-workflow-task-admin-view'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/participant-view/$', DTableWorkflowTaskParticipantView.as_view(), name='api-v2.1-dtable-workflow-task-participant-view'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/initiator-view/$', DTableWorkflowTaskInitiatorView.as_view(), name='api-v2.1-dtable-workflow-task-initiator-view'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/participants/$', DTableWorkflowTaskParticipantsView.as_view(), name='api-v2.1-dtable-workflow-task-participants'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/logs/$', DTableWorkflowTaskLogsView.as_view(), name='api-v2.1-dtable-workflow-task-logs'),
    re_path(r'^api/v2.1/workflows/shared/$', SharedDTableWorkflowsView.as_view(), name='api-v2.1-user-dtable-workflows'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/transfer/$', DTableWorkflowTransferView.as_view(), name='api-v2.1-workflows-task-transfer'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/cancel/$', DTableWorkflowTaskCancelView.as_view(), name='api-v2.1-workflows-task-cancel'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/resubmit/$', DTableWorkflowTaskResubmitView.as_view(), name='api-v2.1-workflows-task-resubmit'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/task-submit/$', DTableWorkflowSubmitTaskView.as_view(), name='api-v2.1-dtable-workflows-task-submit'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/internal-task-submit/$', InternalDTableWorkflowSubmitView.as_view(), name='api-v2.1-dtable-workflows-internal-task-submit'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/external-task-submit/$', ExternalDTableWorkflowSubmitView.as_view(), name='api-v2.1-dtable-workflows-external-task-submit'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/public-upload-link/$', DTableWorkflowPublicUploadLinkView.as_view(), name='api-v2.1-dtable-workflows-public-upload-link'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/upload-link/$', DTableWorkflowUploadLinkView.as_view(), name='api-v2.1-dtable-workflows-upload-link'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/shares/$', DTableWorkflowSharesView.as_view(), name='api-v2.1-dtable-workflows-shares'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/shares/(?P<group_id>\d+)/$', DTableWorkflowShareView.as_view(), name='api-v2.1-dtable-workflows-share'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/init-form/$', DTableWorkflowInitFormView.as_view(), name='api-v2.1-list-dtable-workflows-init-form'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/task-row-id/(?P<task_row_id>[-0-9a-zA-Z_]*)/$', DTableWorkflowTaskByRowIdView.as_view(), name='api-v2.1-get-dtable-workflow-task-by-row-id'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/task-row-ids/$', DTableWorkflowTasksByRowIdsView.as_view(), name='api-v2.1-get-dtable-workflow-task-by-row-ids'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/linked-rows/$', DTableWorkflowLinkedTableRowsView.as_view(), name='api-v2.1-workflow-linked-table-rows'),

    # workflow folder
    re_path(r'^api/v2.1/workflows/folders/$', UserWorkflowFoldersView.as_view(), name='api-v2.1-workflow-folders'),
    re_path(r'^api/v2.1/workflows/folders/(?P<workflow_folder_id>\d+)/$', UserWorkflowFolderView.as_view(), name='api-v2.1-workflow-folder'),
    re_path(r'^api/v2.1/workflows/(?P<token>[-0-9a-f]{36})/move-workflow-to-folder/$', MoveWorkflowToFolderView.as_view(), name='api-v2.1-workflow-move-workflow-to-folder'),


    # dtable external link
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/external-links/$', DTableExternalLinksView.as_view(), name='api-v2.1-dtable-external-link-tokens'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/external-links/(?P<token>.*)/$', DTableExternalLinkView.as_view(), name='api-v2.1-dtable-external-link-token'),
    re_path(r'^api/v2.1/external-link-tokens/(?P<token>.*)/access-token/$', DTableExternalLinkAccessTokenView.as_view(), name='api-v2.1-dtable-external-link-token-access-token'),

    # dtable view external link
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/view-external-links/$', DTableViewExternalLinksView.as_view(), name='api-v2.1-dtable-view-external-link-tokens'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/view-external-links/(?P<token>.*)/$', DTableViewExternalLinkView.as_view(), name='api-v2.1-dtable-view-external-link-token'),
    re_path(r'^api/v2.1/view-external-link-tokens/(?P<token>.*)/access-token/$', DTableViewExternalLinkAccessTokenView.as_view(), name='api-v2.1-dtable-view-external-link-token-access-token'),

    re_path(r'^api/v2.1/dtable/app-access-token/$', DTableAppAccessTokenView.as_view(), name='api-v2.1-dtable-app-access-token'),
    re_path(r'^api/v2.1/dtable/app-upload-link/$', DTableAppUploadLinkView.as_view(), name='api-v2.1-dtable-app-upload-link'),
    re_path(r'^api/v2.1/dtable/app-download-link/$', DTableAppDownloadLinkView.as_view(), name='api-v2.1-dtable-app-download-link'),
    re_path(r'^api/v2.1/dtable/app-asset/$', DTableAppAssetView.as_view(), name='api-v2.1-dtable-app-asset'),
    re_path(r'^api/v2.1/dtable/custom/app-download-link/$', DTableAppCustomAssetDownloadLinkView.as_view(), name='api-v2.1-dtable-app-custom-download-link'),
    re_path(r'^api/v2.1/dtable/custom/app-asset-file/$', DTableAppCustomAssetFileView.as_view(), name='api-v2.1-dtable-app-custom-asset-file'),
    re_path(r'^api/v2.1/dtable/custom/app-asset-dir/$', DTableAppCustomAssetDirView.as_view(), name='api-v2.1-dtable-app-custom-asset-dir'),
    re_path(r'^api/v2.1/dtable/custom/app-upload-link/$', DTableAppCustomAssetUploadLinkView.as_view(), name='api-v2.1-dtable-app-custom-upload-link'),
    re_path(r'^api/v2.1/dtable/third-party-account/$', DTableAppThirdPartyAccountView.as_view(), name='api-v2.1-dtable-third-party-account'),
    re_path(r'^api/v2.1/dtable/app-user-info/$', DTableAppUserInfoView.as_view(), name='api-v2.1-dtable-app-user-info'),
    re_path(r'^api/v2.1/dtable/items-search/$', DTableItemsSearchView.as_view(), name='api-v2.1-dtable-items-search'),

    re_path(r'^api/v2.1/forms/$', DTableFormsView.as_view(), name='api-v2.1-dtable-forms'),
    re_path(r'^api/v2.1/forms/shared/$', SharedFormsView.as_view(), name='api-v2.1-forms-shared'),
    re_path(r'^api/v2.1/forms/(?P<token>[-0-9a-f]{36})/$', DTableFormView.as_view(), name='api-v2.1-dtable-form'),
    re_path(r'^api/v2.1/form-submit/(?P<token>[-0-9a-f]{36})/$', DTableFormSubmitView.as_view(), name='api-v2.1-dtable-form-submit'),
    re_path(r'^api/v2.1/forms/linked-rows/$', DTableFormLinkedTableRowsView.as_view(), name='api-v2.1-dtable-form-linked-rows'),
    re_path(r'^api/v2.1/forms/(?P<token>[-0-9a-f]{36})/public-upload-link/$', DTableFormPublicUploadLinkView.as_view(), name='api-v2.1-dtable-form-public-upload-link'),
    re_path(r'^api/v2.1/forms/(?P<token>[-0-9a-f]{36})/upload-link/$', DTableFormUploadLinkView.as_view(), name='api-v2.1-dtable-form-upload-link'),
    re_path(r'^api/v2.1/forms/(?P<token>[-0-9a-f]{36})/share/$', DTableFormShareView.as_view(), name='api-v2.1-dtable-form-share'),
    re_path(r'^api/v2.1/forms/(?P<token>[-0-9a-f]{36})/duplicate/$', DTableFormDuplicateView.as_view(), name='api-v2.1-dtable-form-duplicate'),
    re_path(r'^api/v2.1/forms/(?P<token>[-0-9a-f]{36})/custom-urls/$', DTableFormCustomURLsView.as_view(), name='api-v2.1-dtable-form-custom-urls'),

    re_path(r'^api/v2.1/collection-tables/$', DTableCollectionTablesView.as_view(), name='api-v2.1-dtable-collection-tables'),
    re_path(r'^api/v2.1/collection-tables/(?P<token>[-0-9a-f]{36})/$', DTableCollectionTableView.as_view(), name='api-v2.1-dtable-collection-table'),
    re_path(r'^api/v2.1/collection-tables/access-token/$', DTableCollectionTableAccessToken.as_view(), name='api-v2.1-dtable-collection-tables-access-token'),
    re_path(r'^api/v2.1/collection-tables/(?P<token>[-0-9a-f]{36})/duplicate/$', DTableCollectionTableDuplicateView.as_view(), name='api-v2.1-dtable-collection-table-duplicate'),

    re_path(r'^api/v2.1/dtable-row-shares/$', DTableRowSharesView.as_view(), name='api-v2.1-dtable-row-shares'),
    re_path(r'^api/v2.1/dtable-row-shares/(?P<token>[-0-9a-f]{36})/$', DTableRowShareView.as_view(), name='api-v2.1-dtable-row-share'),

    re_path(r'^api/v2.1/dtable-internal/get-file-update-link/$', DTableUpdateLinkView.as_view(), name='api-v2.1-dtable-update-link'),
    re_path(r'^api/v2.1/dtable-internal/get-file-download-link/$', DTableDownloadLinkView.as_view(), name='api-v2.1-dtable-download-link'),
    re_path(r'^api/v2.1/dtable-internal/get-latest-commit-id/$', DTableLatestCommitIdView.as_view(), name='api-v2.1-dtable-latest-commit-id'),
    re_path(r'^api/v2.1/dtable-internal/get-related-users/$', InternalDTableRelatedUsersView.as_view(), name='api-v2.1-internal-dtable-related-users'),
    re_path(r'^api/v2.1/dtable-copy/$', DTableCopyView.as_view(), name='api-v2.1-dtable-copy'),
    re_path(r'^api/v2.1/dtable-copy/status/$', DTableCopyStatusView.as_view(), name='api-v2.1-dtable-copy-status'),
    re_path(r'^api/v2.1/dtable-copy/do-task-after-copy/$', DTableDoTaskAfterCopyView.as_view(), name='api-v2.1-dtable-do-task-after-copy'),
    re_path(r'^api/v2.1/dtable-copy/pre-common-dataset-syncs-check/$', DTableCopyPreCDSsCheckView.as_view(), name='api-v2.1-dtable-copy-pre-common-dataset-syncs-check'),
    re_path(r'^api/v2.1/dtable-external-link/dtable-copy/$', DTableExternalLinkCopyView.as_view(), name='api-v2.1-dtable-external-link-copy'),

    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/$', DTableStorageView.as_view(), name='api-v2.1-dtable-storage'),
    re_path(r'^api/v2.1/dtable-recent-asset/(?P<dtable_uuid>[-0-9a-f]{36})/$', DTableListRecentFileView.as_view(), name='api-v2.1-dtable-recent-asset'),
    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/zip-task/$', DTableAssetZipTask.as_view(), name='api-v2.1-dtable-storage-zip-task'),
    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/batch-delete-assets/$', DTableStorageBatchDeleteAssets.as_view(), name='api-v2.1-dtable-storage-batch-delete-assets'),
    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/rename/$', DTableStorageRenameView.as_view(), name='api-v2.1-dtable-storage-rename'),
    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/file-search/$', DTableAssetFileSearchView.as_view(), name='api-v2.1-dtable-asset-search'),


    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/trash/$', DTableAssetTrashView.as_view(), name='api-v2.1-dtable-storage-trash'),
    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/trash/(?P<trash_item_id>\d+)/revert/$', DTableAssetRevertView.as_view(), name='api-v2.1-dtable-storage-trash-revert'),
    re_path(r'^api/v2.1/dtable-asset/(?P<dtable_uuid>[-0-9a-f]{36})/asset-size/$', DTableAssetSizeView.as_view(), name='api-v2.1-dtable-asset-size'),

    re_path(r'^api/v2.1/dtable-system-asset/(?P<dtable_uuid>[-0-9a-f]{36})/zip-task/$', DTableStorageZipTaskView.as_view(), name='api-v2.1-dtable-system-asset-zip-task'),

    re_path(r'^api/v2.1/dtable-custom-asset/(?P<dtable_uuid>[-0-9a-f]{36})/upload-link/$', DTableCustomAssetUploadLinkView.as_view(), name='api-v2.1-dtable-custom-asset-upload-link'),
    re_path(r'^api/v2.1/dtable-custom-asset/(?P<dtable_uuid>[-0-9a-f]{36})/dir/$', DTableCustomAssetDirView.as_view(), name='api-v2.1-dtable-custom-asset-dir'),
    re_path(r'^api/v2.1/dtable-custom-asset/(?P<dtable_uuid>[-0-9a-f]{36})/file/$', DTableCustomAssetFileView.as_view(), name='api-v2.1-dtable-custom-asset-file'),
    re_path(r'^api/v2.1/dtable-custom-asset/(?P<dtable_uuid>[-0-9a-f]{36})/batch-move/$', DTableCustomAssetBatchMoveItemView.as_view(), name='api-v2.1-dtable-custom-asset-batch-move-item'),
    re_path(r'^api/v2.1/dtable-custom-asset/(?P<dtable_uuid>[-0-9a-f]{36})/batch-copy/$', DTableCustomAssetBatchCopyItemView.as_view(), name='api-v2.1-dtable-custom-asset-batch-copy-item'),
    re_path(r'^api/v2.1/dtable-custom-asset/(?P<dtable_uuid>[-0-9a-f]{36})/batch-delete/$', DTableCustomAssetBatchDeleteItemView.as_view(), name='api-v2.1-dtable-custom-asset-batch-delete-item'),
    re_path(r'^api/v2.1/dtable-custom-asset/(?P<dtable_uuid>[-0-9a-f]{36})/zip-task/$', DTableCustomAssetZipTaskView.as_view(), name='api-v2.1-dtable-custom-asset-zip-task'),
    re_path(r'^api/v2.1/dtable-custom-asset/query-zip-progress/$', DTableCustomAssetQueryZipProgressView.as_view(), name='api-v2.1-dtable-custom-asset-query-zip-progress'),
    re_path(r'^api/v2.1/dtable-custom-asset/cancel-zip-task/$', DTableCustomAssetCancelZipTaskView.as_view(), name='api-v2.1-dtable-custom-asset-cancel-zip-task'),

    re_path(r'^api/v2.1/dtable-document-plugin/(?P<dtable_uuid>[-0-9a-f]{36})/file/$', DTableDocumentPluginFileView.as_view(), name='api-v2.1-dtable-document-plugin-file'),
    re_path(r'^api/v2.1/dtable-document-plugin/(?P<dtable_uuid>[-0-9a-f]{36})/duplicate-document/$', DTableDocumentPluginDuplicateDocumentView.as_view(), name='api-v2.1-dtable-document-plugin-duplicate-document'),
    re_path(r'^api/v2.1/dtable-document-plugin/(?P<dtable_uuid>[-0-9a-f]{36})/documents/$', DTableDocumentPluginDocumentsView.as_view(), name='api-v2.1-dtable-document-plugin-documents'),
    re_path(r'^api/v2.1/dtable-document-plugin/(?P<dtable_uuid>[-0-9a-f]{36})/documents/(?P<doc_uuid>[-0-9a-f]{36})/$', DTableDocumentPluginDocumentView.as_view(), name='api-v2.1-dtable-document-plugin-document'),
    re_path(r'^api/v2.1/dtable-document-plugin/(?P<dtable_uuid>[-0-9a-f]{36})/export-document/$', DtableDocumentPluginDocumentExportView.as_view(), name='api-v2.1-dtable-document-plugin-export-document'),
    re_path(r'^api/v2.1/dtable-document-plugin/(?P<dtable_uuid>[-0-9a-f]{36})/export-file/$', DtableDocumentPluginExportFileView.as_view(), name='api-v2.1-dtable-document-plugin-export-file'),
    re_path(r'^api/v2.1/dtable-document-plugin/(?P<dtable_uuid>[-0-9a-f]{36})/import-document/$', DtableDocumentPluginDocumentImportView.as_view(), name='api-v2.1-dtable-document-plugin-import-document'),

    # user: plugins
    re_path(r'^api/v2.1/dtable-system-plugins/$', DTableSystemPluginsView.as_view(), name='api-v2.1-system-plugins'),
    re_path(r'^api/v2.1/dtable-plugins/$', DTablePluginsView.as_view(), name='api-v2.1-plugins'),
    re_path(r'^api/v2.1/dtables/plugins-install-count/$', DTablePluginsInstallCountView.as_view(), name='api-v2.1-plugins-install-count'),

    # dtable global db
    re_path(r'^api/v2.1/dtable/common-datasets/$', DTableCommonDatasetsView.as_view(), name='api-v2.1-dtable-common-datasets'),
    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/$', DTableCommonDatasetView.as_view(), name='api-v2.1-dtable-common-dataset'),
    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/access-groups/$', DTableCommonDatasetAccessGroupsView.as_view(), name='api-v2.1-dtable-common-dataset-access-groups'),
    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/access-groups/(?P<group_id>\d+)/$', DTableCommonDatasetAccessGroupView.as_view(), name='api-v2.1-dtable-common-dataset-access-group'),
    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/info/$', DTableCommonDatasetInfoView.as_view(),  name='api-v2.1-dtable-common-dataset-info'),

    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/import/$', DTableCommonDatasetTableImportView.as_view(), name='api-v2.1-dtable-common-dataset-import'),
    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/sync-with-exist-table/$', CommonDatasetSyncWithExistTableView.as_view(), name='api-v2.1-dtable-common-dataset-sync-with-exist-table'),
    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/sync/$', DTableCommonDatasetTableSyncView.as_view(), name='api-v2.1-dtable-common-dataset-sync'),
    re_path(r'^api/v2.1/dtable/common-datasets/(?P<dataset_id>\d+)/force-sync/$', DTableCommonDatasetForceSyncView.as_view(), name='api-v2.1-dtable-common-dataset-force-sync'),

    re_path(r'^api/v2.1/dtable/common-datasets/syncs/$', DTableCommonDatasetSyncsView.as_view(), name='api-v2.1-dtable-common-dataset-syncs'),

    # dtable-seafile
    re_path(r'^api/v2.1/seafile-connectors/(?P<dtable_uuid>[-0-9a-f]+)/file-transfer-task/$', SeafileTransferTaskView.as_view(), name='api-v2.1-dtable-storage-file-transfer-task'),
    re_path(r'^api/v2.1/seafile-connectors/repo-info/$', SeafileRepoInfoView.as_view(), name='api-v2.1-seafile-repo-info'),
    re_path(r'^api/v2.1/seafile-connectors/dir/$', SeafileRepoDirView.as_view(), name='api-v2.1-seafile-repo-dir'),
    re_path(r'^api/v2.1/seafile-connectors/download-link/$', SeafileRepoDownloadLinkView.as_view(), name='api-v2.1-seafile-repo-download-link'),

    # dtable-third-party-accounts
    re_path(r'^api/v2.1/third-party-accounts/(?P<dtable_uuid>[-0-9a-f]+)/$', DTableThirdPartyAccountsView.as_view(), name='api-v2.1-dtable-third-party-accounts'),
    re_path(r'^api/v2.1/third-party-accounts/(?P<dtable_uuid>[-0-9a-f]+)/(?P<account_id>\d+)/$', DTableThirdPartyAccountView.as_view(), name='api-v2.1-dtable-third-party-account'),
    re_path(r'^api/v2.1/third-party-accounts/(?P<dtable_uuid>[-0-9a-f]+)/detail/$', DTableThirdPartyAccountDetailView.as_view(), name='api-v2.1-dtable-third-party-account-detail'),
    re_path(r'^api/v2.1/third-party-accounts/email/oauth/login/', DTableThirdPartyEmailOAuthAccountAuthURLView.as_view(), name='thirdparty_email_account_oauth_login'),
    re_path(r'^api/v2.1/third-party-accounts/email/oauth/query/', DTableThirdPartyEmailOAuthAccountQueryView.as_view(), name='thirdparty_email_account_oauth_query'),

    # dtable-message-sending-by-third-party-accounts
    re_path(r'^api/v2.1/dtable-message/(?P<dtable_uuid>[-0-9a-f]+)/wechat/$', DTableWechatMessageSendView.as_view(), name='api-v2.1-dtable-send-wechat-message'),
    re_path(r'^api/v2.1/dtable-message/(?P<dtable_uuid>[-0-9a-f]+)/email/$', DTableEmailMessageSendView.as_view(), name='api-v2.1-dtable-send-email-message'),
    re_path(r'^api/v2.1/dtable-message/(?P<dtable_uuid>[-0-9a-f]+)/dingtalk/$', DTableDingtalkMessageSendView.as_view(),  name='api-v2.1-dtable-send-dingtalk-message'),
    re_path(r'^api/v2.1/dtable-message/(?P<dtable_uuid>[-0-9a-f]+)/notification/$', DTableNotificationSendView.as_view(),  name='api-v2.1-dtable-send-notification-message'),
    re_path(r'^api/v2.1/dtable-message-status/$', DTableMessageSendStatus.as_view(), name='api-v2.1-dtable-message-send-status'),

    # dtable-image-recognition-by-third-party-accounts
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]+)/image-recognition/$', DTableImageRecognitionView.as_view(), name='api-v2.1-dtable-dl-figure-recognition'),

    # dtable activities
    re_path(r'^api/v2.1/dtable-activities/$', DTableActivitiesView.as_view(), name='api-v2.1-dtable-activities'),
    re_path(r'^api/v2.1/dtable-activities/detail/$', DTableActivitiesDetailView.as_view(), name='api-v2.1-dtable-activities-detail'),

    # dtable import export
    re_path(r'^api/v2.1/dtable-io-status/$', DTableIOStatus.as_view(), name='api-v2.1-dtable-io-status'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/import-dtable/$', DTableImportDTable.as_view(),  name='api-v2.1-dtable-import-dtable'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/export-dtable/$', DTableExportDTable.as_view(), name='api-v2.1-dtable-export-dtable'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/export-big-data-screen/$', DTablePluginBigDataScreenExport.as_view(), name='api-v2.1-dtable-export-plugin-bds'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/import-big-data-screen/$', DTablePluginBigDataScreenImport.as_view(), name='api-v2.1-dtable-import-plugin-bds'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/import-excel-csv/$', DTableImportExcelCSV.as_view(), name='api-v2.1-dtable-import-excel-csv'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/convert-page-design-to-pdf/$', DTablePageDesignConvertToPdfView.as_view(), name='api-v2.1-dtable-page-design-convert-to-pdf'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/convert-document-to-pdf/$', DTableDocumentConvertToPdfView.as_view(), name='api-v2.1-dtable-document-convert-to-pdf'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/append-excel-csv/upload-file/$', DTableAppendExcelCSVUploadFile.as_view(),  name=' api-v2.1-dtable-append-excel-csv-upload-file'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/append-excel-csv/append-parsed-file/$', DTableAppendExcelCSVAppendParsedFile.as_view(),  name='api-v2.1-dtable-append-excel-csv-append-parsed-file'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/excel-common/get-parsed-file/$', DTableExcelCommonGetParsedFile.as_view(),  name='api-v2.1-dtable-excel-common-get-parsed-file'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/import-excel-csv/upload-file/$', DTableImportExcelCSVUploadFile.as_view(),  name='api-v2.1-dtable-import-excel-csv-upload-file'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/import-excel-csv/import-parsed-file/$', DTableImportExcelCSVImportParsedFile.as_view(), name='api-v2.1-dtable-import-excel-csv-import-parsed-file'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/excel-common/delete-excel/$', DTableExcelCommonDeleteExcel.as_view(),  name='api-v2.1-dtable-excel-common-delete-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/csv-common/delete-csv/$', DTableCSVCommonDeleteCSV.as_view(), name='api-v2.1-dtable-csv-common-delete-csv'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/update-excel/upload-excel/$', DTableUpdateExcelUploadExcel.as_view(), name='api-v2.1-dtable-update-excel-upload-excel'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/update-excel-csv/update-parsed-file/$', DTableUpdateExcelCSVUpdateParsedFile.as_view(), name='api-v2.1-dtable-update-excel-csv-update-parsed-file'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/update-excel-csv/get-checked-result/$', DTableUpdateExcelCSVGetCheckedResult.as_view(), name='api-v2.1-dtable-update-excel-csv-get-checked-result'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/update-csv/upload-csv/$', DTableUpdateCSVUploadCSV.as_view(), name='api-v2.1-dtable-update-csv-upload-csv'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/synchronous-import/import-excel-csv-to-base/$', DTableSynchronousImportExcelCSVToBase.as_view(), name='api-v2.1-dtable-synchronous-import-import-excel-csv-to-base'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/synchronous-import/import-excel-csv-to-table/$', DTableSynchronousImportExcelCSVToTable.as_view(), name='api-v2.1-dtable-synchronous-import-import-excel-csv-to-table'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/synchronous-import/update-table-via-excel-csv/$', DTableSynchronousUpdateTableViaExcelCSV.as_view(), name='api-v2.1-dtable-synchronous-import-update-table-via-excel-csv'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/synchronous-import/append-excel-csv-to-table/$', DTableSynchronousAppendExcelCSV.as_view(), name='api-v2.1-dtable-synchronous-append-excel-csv-to-table'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/synchronous-export/export-dtable/$', DTableSynchronousExportDTable.as_view(), name='api-v2.1-dtable-synchronous-export-dtable'),
    re_path(r'^api/v2.1/dtable/import-table-from-base/$', DTableImportTableFromBase.as_view(), name='api-v2.1-dtable-import-table-from-base'),

    # dtable webhook
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/webhooks/$', WebhooksView.as_view(), name='api-v2.1-dtable-webhooks'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/webhooks/(?P<webhook_id>\d+)/$', WebhookView.as_view(), name='api-v2.1-dtable-webhook'),

    # page design
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/page-design-file/$', PageDesignFileView.as_view(), name='api-v2.1-dtable-page-design-file'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/page-design-export/$', PageDesignExportView.as_view(), name='api-v2.1-dtable-page-design-export'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/page-design-export-content/$', PageDesignExportContentView.as_view(), name='api-v2.1-dtable-page-design-export-content'),
    re_path(r'^api/v2.1/workspace/(?P<workspace_id>\d+)/dtable/(?P<name>.*)/page-design-import/$', PageDesignImportView.as_view(), name='api-v2.1-dtable-page-design-import'),
    re_path(r'^api/v2.1/page-design/row-link-records/(?P<dtable_uuid>[-0-9a-f]{36})/', PageDesignRowLinkRecordView.as_view(), name='dtable_db_row_link_record_api'),
    re_path(r'^api/v2.1/page-design/rows-link-records/(?P<dtable_uuid>[-0-9a-f]{36})/', PageDesignRowsLinkRecordView.as_view(), name='dtable_db_rows_link_record_api'),

    # page design snapshot
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/page-design/(?P<page_id>[-0-9a-zA-Z]{4})/snapshots/$', PageDesignSnapshotsView.as_view(), name='api-v2.1-page-design-snapshots'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/page-design/(?P<page_id>[-0-9a-zA-Z]{4})/snapshots/(?P<commit_id>[-0-9a-f]{40})/$', PageDesignSnapshotView.as_view(), name='api-v2.1-page-design-snapshot'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/page-design/(?P<page_id>[-0-9a-zA-Z]{4})/snapshots/(?P<commit_id>[-0-9a-f]{40})/restore/$', PageDesignSnapshotRestoreView.as_view(), name='api-v2.1-page-design-snapshot-restore'),

    # user list
    re_path(r'^api/v2.1/user-list/$', UserListView.as_view(), name='api-v2.1-user-list'),

    re_path(r'^api/v2.1/notifications/$', NotificationsView.as_view(), name='api-v2.1-notifications'),
    re_path(r'^api/v2.1/notifications-center/$', NotificationsCenterView.as_view(), name='api-v2.1-notifications-center'),
    re_path(r'^api/v2.1/internal-notifications/$', InternalNotificationsView.as_view(), name='api-v2.1-internal-notifications'),
    re_path(r'^api/v2.1/notification/$', NotificationView.as_view(), name='api-v2.1-notification'),
    re_path(r'^api/v2.1/sys-user-notifications/(?P<nid>\d+)/seen/$', SysUserNotificationSeenView.as_view(), name='api-v2.1-notification-seen'),
    re_path(r'^api/v2.1/sys-user-notifications/unseen/$', SysUserNotificationUnseenView.as_view(), name='api-v2.1-notification-unseen'),

    ## user::invitations
    re_path(r'^api/v2.1/invitations/$', InvitationsView.as_view()),
    re_path(r'^api/v2.1/invitations/batch/$', InvitationsBatchView.as_view()),
    re_path(r'^api/v2.1/invitations/(?P<token>[a-f0-9]{32})/$', InvitationView.as_view()),
    re_path(r'^api/v2.1/invitations/(?P<token>[a-f0-9]{32})/revoke/$', InvitationRevokeView.as_view()),

    # user::dtable-invitations
    re_path(r'^api/v2.1/invitation-link/$', InvitationLinkView.as_view(), name='api-v2.1-invitation-link'),

    ## user::avatar
    re_path(r'^api/v2.1/user-avatar/$', UserAvatarView.as_view(), name='api-v2.1-user-avatar'),

    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/task/logs/(?P<log_id>\d+)/$', ScriptTaskLogView.as_view(), name='api-v2.1-script-task-log'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/task/logs/$', ScriptTaskLogsView.as_view(), name='api-v2.1-script-task-logs'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/task/file/$', ScriptTaskFileView.as_view(), name='api-v2.1-script-task-file'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/task/$', ScriptTaskView.as_view(), name='api-v2.1-script-task'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/result/(?P<script_id>\d+)/$', ScriptResultView.as_view(), name='api-v2.1-script-result'),
    re_path(r'^api/v2.1/dtable/(?P<dtable_uuid>[-0-9a-f]{36})/run-script/(?P<script_name>.+)/$', RunScriptView.as_view(), name='api-v2.1-run-script'),

    re_path(r'^api/v2.1/scripts-running-limit/$', ScriptsRunningLimitView.as_view(), name='api-v2.1-scripts-running-limit'),
    re_path(r'^api/v2.1/script-permissions/$', ScriptPermissionsView.as_view(), name='api-v2.1-script-permissions'),


    re_path(r'^api/v2.1/abuse-reports/$', AbuseReports.as_view(), name='api-v2.1-abuse-reports'),

    # dtable-server apis
    # dtable notifications
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/notifications/$', DTableNotificationsView.as_view(), name='api-v2.1-dtable-server-dtable-notifications'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/notifications/(?P<notification_id>\d+)/$', DTableNotificationView.as_view(), name='api-v2.1-dtable-server-dtable-notification'),
    # dtable comments
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/comments/$', DTableRowCommentsView.as_view(), name='api-v2.1-dtable-server-dtable-row-comments'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/comments/(?P<comment_id>\d+)/$', DTableRowCommentView.as_view(), name='api-v2.1-dtable-server-dtable-row-comment'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/rows-comments-num/$', DTableRowsCommentsNumView.as_view(), name='api-v2.1-dtable-server-dtable-rows-comments-num'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/comments-count/$', DTableRowCommentsCountView.as_view(), name='api-v2.1-dtable-server-dtable-row-comments-count'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/related-users/$', DTableRelatedUsersViewFromDTableServer.as_view(), name='api-v2.1-dtable-server-related-users'),

    # dtable row activities
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/row-activities/$', DTableRowActivitiesView.as_view(), name='api-v2.1-dtable-row-activities'),

    # dtable opration logs
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/operation-logs/$', DTableOprationLogsView.as_view(), name='api-v2.1-dtable-opration-logs'),

    # dtable big data ops
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/archive-view/$', DTableArchiveView.as_view(), name='api-v2.1-dtable-archive-view'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/db-metadata/$', DTableDbMetadataView.as_view(), name='api-v2.1-dtable-db-metadata'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/db-index/$', DTableDbIndexView.as_view(), name='api-v2.1-dtable-db-index'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/db-index-task-status/$', DTableDbIndexTaskStatusView.as_view(), name='api-v2.1-dtable-db-task-status'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/db-big-data-feature/$', DTableDbBigDataFeatureView.as_view(), name='api-v2.1-dtable-db-big-data-feature'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/connected-collaborators/$', DTableConnectedCollaboratorView.as_view(), name='api-v2.1-dtable-connected-collaborators'),

    # dtable big data opration logs
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/big-data-operation-logs/$', DTableBigDataOprationLogsView.as_view(), name='api-v2.1-dtable-big-data-opration-logs'),

    # dtable departments
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/departments/$', DTableDepartmentsView.as_view(), name='api-v2.1-dtable-server-departments'),
    # user common info
    re_path(r'^api/v2.1/users-common-info/$', UsersCommonInfoView.as_view(), name='api-v2.1-dtable-server-users-common-info'),

    # dtable metabse
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/metadata/$', DTableMetadataView.as_view(), name='api-v2.1-dtable-metadata'),

    re_path(r'^api/v2.1/admin/abuse-reports/$', AdminAbuseReports.as_view(), name='api-v2.1-admin-abuse-reports'),
    re_path(r'^api/v2.1/admin/abuse-reports/(?P<report_id>\d+)/$', AdminAbuseReport.as_view(), name='api-v2.1-admin-abuse-report'),

    # dtable delete operation logs
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/delete-operation-logs/$', DTableDeleteOperationLogsView.as_view(),name='api-v2.1-dtable-delete-operation-logs'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/delete-operation-logs/(?P<log_id>\d+)/$', DTableDeleteOperationLogView.as_view(),name='api-v2.1-dtable-delete-operation-log'),

    # dtable big data
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/big-data-task/import-file/$', DTableImportBigDataView.as_view(), name='api-v2.1-big-data-task-import'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/big-data-task/update-file/$', DTableUpdateBigDataView.as_view(), name='api-v2.1-big-data-task-update'),
    re_path(r'^api/v2.1/dtables/big-data-status/$', DTableBigDataStatusView.as_view(), name='api-v2.1-big-data-status'),

    # dtable data sync
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/data-syncs/$', DTableDataSyncsView.as_view(), name='api-v2.1-dtable-data-syncs'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/data-syncs/(?P<data_sync_id>\d+)/$', DTableDataSyncView.as_view(), name='api-v2.1-dtable-data-sync'),
    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/data-syncs/(?P<data_sync_id>\d+)/run/$', RunDtableDataSyncView.as_view(), name='api-v2.1-run-dtable-data-sync'),
    re_path(r'^api/v2.1/dtable-data-sync-status/$', DTableDataSyncStatus.as_view(), name='api-v2.1-dtable-data-sync-status'),

    re_path(r'^api/v2.1/dtables/(?P<dtable_uuid>[-0-9a-f]{36})/plugin-email-send-email/$', DtablePluginEmailSendEmail.as_view(), name='api-v2.1-dtable-plugin-email-send-email'),
    re_path(r'^api/v2.1/plugin-email-send-status/$', DTablePluginEmailSendStatus.as_view(), name='api-v2.1-dtable-plugin-email-send-status'),

    # stats
    re_path(r'^api/v2.1/internal/update-exceed-api-quota/$', InternalUpdateExceedAPIQuotaView.as_view(), name='api-v2.1-internal-update-exceed-api-quota'),

    ## admin::sysinfo
    re_path(r'^api/v2.1/admin/sysinfo/$', SysInfo.as_view(), name='api-v2.1-sysinfo'),

    ## admin:web settings
    re_path(r'^api/v2.1/admin/web-settings/$', AdminWebSettings.as_view(), name='api-v2.1-web-settings'),

    ## admin::users
    re_path(r'^api/v2.1/admin/users/$', AdminUsers.as_view(), name='api-v2.1-admin-users'),
    re_path(r'^api/v2.1/admin/users/batch/$', AdminUsersBatch.as_view(), name='api-v2.1-admin-users-batch'),
    re_path(r'^api/v2.1/admin/search-user/$', AdminSearchUser.as_view(), name='api-v2.1-admin-search-user'),
    re_path(r'^api/v2.1/admin/search-user-by-org-id/$', AdminSearchUserByOrgId.as_view(), name='api-v2.1-admin-search-user-by-org-id'),

    ## admin::admin-role
    re_path(r'^api/v2.1/admin/admin-role/$', AdminAdminRole.as_view(), name='api-v2.1-admin-admin-role'),
    re_path(r'^api/v2.1/admin/import-users/$', AdminImportUsers.as_view(), name='api-v2.1-admin-import-users'),

    # [^...] Matches any single character not in brackets
    # + Matches between one and unlimited times, as many times as possible
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/$', AdminUser.as_view(), name='api-v2.1-admin-user'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/reset-password/$', AdminUserResetPassword.as_view(), name='api-v2.1-admin-user-reset-password'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/groups/$', AdminUserGroups.as_view(), name='api-v2.1-admin-user-groups'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/dtables/$', AdminUserDTablesView.as_view(), name='api-v2.1-admin-user-dtables'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/shared-dtables/$', AdminUserSharedDTablesView.as_view(), name='api-v2.1-admin-user-shared-dtables'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/storage/$', AdminUserStorage.as_view(), name='api-v2.1-admin-user-shared-dtables'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/storage/(?P<path>.+)$', AdminUserStorageFileView.as_view(), name='api-v2.1-admin-user-storage-file'),
    re_path(r'^api/v2.1/admin/users/(?P<email>[^/]+@[^/]+)/two-factor-auth/$', TwoFactorAuthView.as_view(), name='api-v2.1-admin-user-two-factor-auth'),

    re_path(r'^api/v2.1/admin/admin-users/$', AdminAdminUsers.as_view(), name='api-v2.1-admin-admin-users'),
    re_path(r'^api/v2.1/admin/admin-users/batch/$', AdminAdminUsersBatch.as_view(), name='api-v2.1-admin-users-batch'),

    ## admin::system-library
    re_path(r'^api/v2.1/admin/system-library/$', AdminSystemLibrary.as_view(), name='api-v2.1-admin-system-library'),
    re_path(r'^api/v2.1/admin/system-library/upload-link/$', AdminSystemLibraryUploadLink.as_view(), name='api-v2.1-admin-system-library-upload-link'),

    ## admin::trash-libraries
    re_path(r'^api/v2.1/admin/trash-libraries/$', AdminTrashLibraries.as_view(), name='api-v2.1-admin-trash-libraries'),
    re_path(r'^api/v2.1/admin/trash-libraries/(?P<repo_id>[-0-9a-f]{36})/$', AdminTrashLibrary.as_view(), name='api-v2.1-admin-trash-library'),

    ## admin::groups
    re_path(r'^api/v2.1/admin/groups/$', AdminGroups.as_view(), name='api-v2.1-admin-groups'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/$', AdminGroup.as_view(), name='api-v2.1-admin-group'),
    re_path(r'^api/v2.1/admin/search-group/$', AdminSearchGroup.as_view(), name='api-v2.1-admin-search-group'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/dtables/$', AdminGroupDTables.as_view(), name='api-v2.1-admin-group-dtables'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/dtables/(?P<dtable_uuid>[-0-9a-f]+)/$', AdminGroupDTable.as_view(), name='api-v2.1-admin-group-dtable'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/members/$', AdminGroupMembers.as_view(), name='api-v2.1-admin-group-members'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/members/(?P<email>[^/]+)/$', AdminGroupMember.as_view(), name='api-v2.1-admin-group-member'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/storages/$', AdminGroupStorages.as_view(), name='api-v2.1-admin-group-storages'),
    re_path(r'^api/v2.1/admin/groups/(?P<group_id>\d+)/storage/(?P<path>.+)$', AdminGroupStorageFileView.as_view(), name='api-v2.1-admin-group-storage-file'),

    ## admin::audit-logs
    re_path(r'^api/v2.1/admin/audit-logs/$', AdminAuditLogsView.as_view(), name='api-v2.1-admin-audit-logs'),
    re_path(r'^api/v2.1/admin/file-access-logs/$', AdminFileAccessLogsView.as_view(), name='api-v2.1-admin-file-access-logs'),

    ## admin::logs
    re_path(r'^api/v2.1/admin/logs/login-logs/$', AdminLogsLoginLogs.as_view(), name='api-v2.1-admin-logs-login-logs'),

    ## admin::admin logs
    re_path(r'^api/v2.1/admin/admin-logs/$', AdminOperationLogs.as_view(), name='api-v2.1-admin-admin-operation-logs'),
    re_path(r'^api/v2.1/admin/admin-login-logs/$', AdminLoginLogs.as_view(), name='api-v2.1-admin-admin-login-logs'),

    ## admin::organizations
    re_path(r'^api/v2.1/admin/organizations/$', AdminOrganizations.as_view(), name='api-v2.1-admin-organizations'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/$', AdminOrganization.as_view(), name='api-v2.1-admin-organization'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/users/$', AdminOrgUsers.as_view(), name='api-v2.1-admin-org-users'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/users/(?P<email>[^/]+)/$', AdminOrgUser.as_view(), name='api-v2.1-admin-org-user'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/groups/$', AdminOrgGroups.as_view(), name='api-v2.1-admin-org-groups'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/groups/(?P<group_id>\d+)/$', AdminOrgGroup.as_view(), name='api-v2.1-admin-org-group'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/address-book/groups/(?P<group_id>\d+)/$', AdminOrgAddressBookGroup.as_view(), name='api-v2.1-admin-org-address-book-group'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/dtables/$', OrgDTables.as_view(), name='api-v2.1-admin-org-dtables'),
    re_path(r'^api/v2.1/admin/organizations/(?P<org_id>\d+)/external-apps/$', AdminOrgExternalApps.as_view(), name='api-v2.1-admin-org-external-apps'),
    re_path(r'^api/v2.1/admin/org-work-weixin-corp-info/$', AdminOrganizationOrgWorkWeixinCorpInfo.as_view(), name='api-v2.1-admin-org-work-weixin-corp-info'),
    re_path(r'^api/v2.1/admin/search-organization/$', AdminSearchOrganization.as_view(), name='api-v2.1-admin-search-org'),
    re_path(r'^api/v2.1/admin/organizations-basic-info/$', AdminOrganizationsBaseInfo.as_view(), name='api-v2.1-admin-orgs-base-info'),
    re_path(r'^api/v2.1/admin/organizations/big-data-storage-stats/$', AdminOrgBigDataStorageStats.as_view(), name='api-v2.1-admin-orgs-big-data-storage-stats'),
    re_path(r'^api/v2.1/admin/organizations/universal-app-stats/$', AdminOrgUniversalAppStats.as_view(), name='api-v2.1-admin-orgs-universal-app-stats'),

    ## admin::logo
    re_path(r'^api/v2.1/admin/logo/$', AdminLogo.as_view(), name='api-v2.1-admin-logo'),
    re_path(r'^api/v2.1/admin/favicon/$', AdminFavicon.as_view(), name='api-v2.1-admin-favicon'),
    re_path(r'^api/v2.1/admin/license/$', AdminLicense.as_view(), name='api-v2.1-admin-license'),
    re_path(r'^api/v2.1/admin/login-background-image/$', AdminLoginBgImage.as_view(), name='api-v2.1-admin-login-background-image'),

    ## admin::invitations
    re_path(r'^api/v2.1/admin/invitations/$', AdminInvitationsView.as_view(), name='api-v2.1-admin-invitations'),

    ## admin: registration logs
    re_path(r'^api/v2.1/admin/registration-logs/$', RegistrationLogsView.as_view(), name='api-v2.1-admin-registration-logs'),
    re_path(r'^api/v2.1/admin/email-sending-logs/$', EmailSendingLogsView.as_view(), name='api-v2.1-admin-email-sending-logs'),

    ## admin:: workflows
    re_path(r'^api/v2.1/admin/workflows/$', AdminWorkflows.as_view(), name='api-v2.1-admin-workflows'),

    ## admin::dtables
    re_path(r'^api/v2.1/admin/dtables/$', AdminDtables.as_view(), name='api-v2.1-admin-dtables'),
    re_path(r'^api/v2.1/admin/dtable/(?P<dtable_uuid>[-0-9a-f]+)/$', AdminDtable.as_view(), name='api-v2.1-admin-dtable'),
    re_path(r'^api/v2.1/admin/dtable/(?P<dtable_id>\d+)/external-links/$', AdminDTableExternalLinksView.as_view(), name='api-v2.1-admin-dtable-external-links'),
    re_path(r'^api/v2.1/admin/trash-dtables/$', AdminTrashDTablesView.as_view(), name='api-v2.1-admin-trash-dtables'),
    re_path(r'^api/v2.1/admin/trash-dtables/(?P<dtable_id>\d+)/$', AdminTrashDTableView.as_view(), name='api-v2.1-admin-trash-dtable'),
    re_path(r'^api/v2.1/admin/search-dtable/$', AdminSearchDTable.as_view(), name='api-v2.1-admin-search-dtables'),
    re_path(r'^api/v2.1/admin/dtable-archives/$', AdminDTableArchives.as_view(), name='api-v2.1-admin-dtable-archives'),
    re_path(r'^api/v2.1/admin/dtable/(?P<dtable_uuid>[-0-9a-f]+)/unset-password/$', AdminUnsetDTablePasswordView.as_view(), name='api-v2.1-unset-dtable-password'),
    re_path(r'^api/v2.1/admin/dtable/(?P<dtable_uuid>[-0-9a-f]+)/repair/$', AdminRepairDTableView.as_view(), name='api-v2.1-repair-dtable'),
    re_path(r'^api/v2.1/admin/dtable-archives/(?P<dtable_uuid>[-0-9a-f]+)/backups/$', AdminArchiveBackups.as_view(), name='api-v2.1-admin-dtable-archive-backups'),
    re_path(r'^api/v2.1/admin/dtables/(?P<dtable_uuid>[-0-9a-f]+)/api-tokens/$', AdminDTableAPITokensView.as_view(), name='api-v2.1-admin-dtable-api-tokens'),
    re_path(r'^api/v2.1/admin/dtables/(?P<dtable_uuid>[-0-9a-f]+)/api-tokens/(?P<token>.+)/$', AdminDTableAPITokenView.as_view(), name='api-v2.1-admin-dtable-api-token'),
    re_path(r'^api/v2.1/admin/dtables/(?P<dtable_uuid>[-0-9a-f]+)/export-dtable/$', AdminExportDTable.as_view(), name='api-v2.1-admin-export-dtable'),
    re_path(r'^api/v2.1/admin/dtable-copy/$', AdminCopyDTable.as_view(), name='api-v2.1-admin-dtable-copy'),
    re_path(r'^api/v2.1/admin/dtable-copy/do-task-after-copy/$', AdminDTableDoTaskAfterCopyView.as_view(), name='api-v2.1-admin-dtable-do-task-after-copy'),
    re_path(r'^api/v2.1/admin/dtables/(?P<dtable_uuid>[-0-9a-f]+)/synchronous-export/export-dtable/$', AdminSynchronousExportDTable.as_view(), name='api-v2.1-admin-synchronous-export-dtable'),
    re_path(r'^api/v2.1/admin/dtables/share-permissions/(?P<dtable_uuid>[-0-9a-f]+)/$', AdminDTableSharePermissionsView.as_view(), name='api-v2.1-admin-dtable-share-permissions'),
    re_path(r'^api/v2.1/admin/dtables/share/(?P<dtable_uuid>[-0-9a-f]+)/$', AdminDTableShareView.as_view(), name='api-v2.1-admin-dtable-share'),
    re_path(r'^api/v2.1/admin/dtables/group-shares/(?P<dtable_uuid>[-0-9a-f]+)/$', AdminDTableGroupSharesView.as_view(), name='api-v2.1-admin-dtable-group-shares'),

    ## admin::dtable notifications
    re_path(r'api/v2.1/admin/dtable-notifications/', AdminDTableNotifications.as_view(), name='api-v2.1-admin-dtable-notifications'),

    ## admin:forms
    re_path(r'^api/v2.1/admin/forms/$', AdminFormsView.as_view(), name='api-v2.1-admin-forms'),
    re_path(r'^api/v2.1/admin/forms/(?P<token>.+)/$', AdminFormView.as_view(), name='api-v2.1-admin-form'),

    ## admin:collection-tables
    re_path(r'^api/v2.1/admin/collection-tables/$', AdminCollectionTablesView.as_view(), name='api-v2.1-admin-collection-tables'),
    re_path(r'^api/v2.1/admin/collection-tables/(?P<token>.+)/$', AdminCollectionTableView.as_view(), name='api-v2.1-admin-collection-table'),

    ## admin::external-links
    re_path(r'^api/v2.1/admin/external-links/$', AdminExternalLinks.as_view(), name='api-v2.1-admin-external-links'),
    re_path(r'^api/v2.1/admin/external-links/(?P<token>.*)/$', AdminExternalLink.as_view(), name='api-v2.1-admin-external-link'),
    re_path(r'^api/v2.1/admin/search-external-links/$', AdminSearchExternalLinksView.as_view(), name='api-v2.1-admin-external-link'),
    re_path(r'^api/v2.1/admin/view-external-links/$', AdminViewExternalLinks.as_view(), name='api-v2.1-admin-view-external-links'),
    re_path(r'^api/v2.1/admin/view-external-links/(?P<token>.*)/$', AdminViewExternalLink.as_view(), name='api-v2.1-admin-view-external-link'),
    re_path(r'^api/v2.1/admin/search-view-external-links/$', AdminSearchViewExternalLinksView.as_view(), name='api-v2.1-admin-external-link'),

    # admin::statistics
    re_path(r'^api/v2.1/admin/statistics/active-users/$', ActiveUsersView.as_view(), name='api-v2.1-admin-statistics-active-users'),
    re_path(r'^api/v2.1/admin/statistics/scripts-running/$', AdminRunScriptStatisticsView.as_view(), name='api-v2.1-admin-statistics-run-python'),
    re_path(r'^api/v2.1/admin/statistics/auto-rules/$', AdminAutomationRulesStatisticView.as_view(), name='api-v2.1-admin-statistics-auto-rules'),
    re_path(r'^api/v2.1/admin/statistics/auto-rules-details/$', AdminAutomationRulesStatisticDetailView.as_view(), name='api-v2.1-admin-statistics-auto-rules-details'),
    re_path(r'^api/v2.1/admin/statistics/external-apps/$', AdminExternalAppsStatisticView.as_view(), name='api-v2.1-admin-statistics-external-apps'),
    # admin::active users
    re_path(r'^api/v2.1/admin/daily-active-users/$', DailyActiveUsersView.as_view(), name='api-v2.1-admin-daily-active-users'),

    # admin::plugins
    re_path(r'^api/v2.1/admin/dtable-system-plugins/$', AdminDTableSystemPluginsView.as_view(), name='api-v2.1-admin-dtable-system-plugins'),
    re_path(r'^api/v2.1/admin/dtable-system-plugins/(?P<plugin_id>\d+)/$', AdminDTableSystemPluginView.as_view(), name='api-v2.1-admin-system-dtable-plugin'),
    re_path(r'^api/v2.1/admin/plugins-install-count/$', AdminDTableSystemPluginsInstallCountView.as_view(), name='api-v2.1-admin-dtable-system-plugins-install-count'),

    # admin::external apps
    re_path(r'^api/v2.1/admin/external-apps/$', AdminExternalApps.as_view(), name='api-v2.1-admin-external-apps'),
    re_path(r'^api/v2.1/admin/external-apps/search/$', AdminSearchExternalApps.as_view(), name='api-v2.1-admin-external-apps-search'),
    re_path(r'^api/v2.1/admin/external-apps/(?P<app_uuid>[-0-9a-f]{36})/$', AdminExternalApp.as_view(), name='api-v2.1-admin-external-app'),
    re_path(r'^api/v2.1/admin/external-apps/(?P<app_uuid>[-0-9a-f]{36})/open-access/$', AdminExternalAppOpenAccess.as_view(), name='api-v2.1-admin-external-app-open-access'),


    # admin::virus-files
    re_path(r'^api/v2.1/admin/virus-files/$', AdminVirusFilesView.as_view(), name='api-v2.1-admin-virus-files'),
    re_path(r'^api/v2.1/admin/virus-files/(?P<virus_id>\d+)/$', AdminVirusFileView.as_view(), name='api-v2.1-admin-virus-file'),
    re_path(r'^api/v2.1/admin/virus-files/batch/$', AdminVirusFilesBatchView.as_view(), name='api-v2.1-admin-virus-files-batch'),

    re_path(r'^notification/', include('seahub.notifications.urls')),
    re_path(r'^options/', include('seahub.options.urls')),
    re_path(r'^profile/', include('seahub.profile.urls')),
    re_path(r'^captcha/', include('captcha.urls')),
    re_path(r'^thumbnail/', include('seahub.thumbnail.urls')),
    re_path(r'^invite/', include(('seahub.invitations.urls', 'invitations'), namespace='invitations')),
    re_path(r'^work-weixin/', include('seahub.work_weixin.urls')),
    re_path(r'^dingtalk/', include('seahub.dingtalk.urls')),
    re_path(r'^weixin/', include('seahub.weixin.urls')),

    # Must specify a namespace if specifying app_name.
    re_path(r'^', include(('seahub.dtable.urls', 'dtable'), namespace='workspace')),

    ## admin::address book
    re_path(r'^api/v2.1/admin/address-book/groups/$', AdminAddressBookGroups.as_view(), name='api-v2.1-admin-address-book-groups'),
    re_path(r'^api/v2.1/admin/address-book/groups/(?P<group_id>\d+)/$', AdminAddressBookGroup.as_view(), name='api-v2.1-admin-address-book-group'),

    ## admin::address book v2
    re_path(r'^api/v2.1/admin/address-book-v2/departments/$', AdminAddressBookV2DepartmentsView.as_view(), name='api-v2.1-admin-address-book-v2-departments'),
    re_path(r'^api/v2.1/admin/address-book-v2/departments/(?P<department_id>\d+)/$', AdminAddressBookV2DepartmentView.as_view(), name='api-v2.1-admin-address-book-v2-department'),
    re_path(r'^api/v2.1/admin/address-book-v2/departments/(?P<department_id>\d+)/members/$', AdminAddressBookV2DepartmentMembersView.as_view(), name='api-v2.1-admin-address-book-v2-department-members'),
    re_path(r'^api/v2.1/admin/address-book-v2/departments/(?P<department_id>\d+)/members/(?P<email>[^/]+@[^/]+)/$', AdminAddressBookV2DepartmentMemberView.as_view(), name='api-v2.1-admin-address-book-v2-department-member'),
    re_path(r'^api/v2.1/admin/address-book-v2/departments/add-to-departments/$', AdminAddUserToDepartmentsView.as_view(), name='api-v2.1-admin-address-book-v2-add-user-to-departments'),
    re_path(r'^api/v2.1/admin/address-book-v2/departments/(?P<department_id>\d+)/group/$', AdminAddressBookV2DepartmentGroupView.as_view(), name='api-v2.1-admin-address-book-v2-department-group'),
    re_path(r'^api/v2.1/admin/address-book-v2/departments-migrate/$', AdminDepartmentsMigrateView.as_view(), name='api-v2.1-admin-address-book-v2-departments-migrate'),
    re_path(r'^api/v2.1/admin/address-book-v2/non-department-users/$', AdminNonAddressBookV2UsersView.as_view(), name='api-v2.1-admin-address-book-v2-non-department-users'),

    ## admin::notifications
    re_path(r'^api/v2.1/admin/sys-notifications/$', AdminSysNotificationsView.as_view(), name='api-2.1-admin-sys-notifications'),
    re_path(r'^api/v2.1/admin/sys-notifications/(?P<nid>\d+)/$', AdminSysNotificationView.as_view(),name='api-2.1-admin-sys-notification'),
    re_path(r'^api/v2.1/admin/sys-user-notifications/$', AdminSysUserNotificationsView.as_view(), name='api-2.1-admin-sys-user-notifications'),
    re_path(r'^api/v2.1/admin/sys-user-notifications/(?P<nid>\d+)/$', AdminSysUserNotificationView.as_view(), name='api-2.1-admin-sys-user-notification'),

    ## admin::notification-rules
    re_path(r'^api/v2.1/admin/notification-rules/$', AdminNotificationRulesView.as_view(), name='api-v2.1-admin-notification-rules'),
    re_path(r'^api/v2.1/admin/notification-rules/(?P<rid>\d+)/$', AdminNotificationRuleView.as_view(), name='api-v2.1-admin-notification-rule'),
    re_path(r'^api/v2.1/admin/invalid-notification-rules/$', AdminNotificationInvalidRulesView.as_view(), name='api-v2.1-admin-invalid-notification-rules'),

    ## admin::automation-rules
    re_path(r'^api/v2.1/admin/automation-rules/$', AdminAutomationRulesView.as_view(), name='api-v2.1-admin-automation-rules'),
    re_path(r'^api/v2.1/admin/automation-rules/(?P<rid>\d+)/$', AdminAutomationRuleView.as_view(), name='api-v2.1-admin-automation-rule'),
    re_path(r'^api/v2.1/admin/invalid-automation-rules/$', AdminAutomationInvalidRulesView.as_view(), name='api-v2.1-admin-invalid-automation-rules'),

    ## admin::common-datasets
    re_path(r'^api/v2.1/admin/common-datasets/$', AdminCommonDatasetsView.as_view(), name='api-v2.1-admin-common-datasets'),
    re_path(r'^api/v2.1/admin/common-dataset/periodical-syncs/$', AdminCommonDatasetPeriodicalSyncsView.as_view(), name='api-v2.1-admin-common-dataset-periodical-syncs'),
    re_path(r'^api/v2.1/admin/common-dataset/invalid-syncs/$', AdminCommonDatasetInvalidSyncsView.as_view(), name='api-v2.1-admin-common-dataset-invalid-syncs'),
    re_path(r'^api/v2.1/admin/common-dataset/sync/(?P<sid>\d+)/$', AdminCommonDatasetSyncView.as_view(), name='api-v2.1-admin-common-dataset-sync'),

    ## admin::work weixin departments
    re_path(r'^api/v2.1/admin/work-weixin/departments/$', AdminWorkWeixinDepartments.as_view(), name='api-v2.1-admin-work-weixin-departments'),
    re_path(r'^api/v2.1/admin/work-weixin/departments/(?P<department_id>\d+)/members/$', AdminWorkWeixinDepartmentMembers.as_view(), name='api-v2.1-admin-work-weixin-department-members'),
    re_path(r'^api/v2.1/admin/work-weixin/users/batch/$', AdminWorkWeixinUsersBatch.as_view(), name='api-v2.1-admin-work-weixin-users'),
    re_path(r'^api/v2.1/admin/work-weixin/departments/import/$', AdminWorkWeixinDepartmentsImport.as_view(), name='api-v2.1-admin-work-weixin-department-import'),

    ## ai
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/$', AIAssistant.as_view(), name='api-v2.1-ai-assistant'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/assistant-table/$', AssistantTable.as_view(), name='api-v2.1-assistant-table'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/assistant-tables/$', AssistantTables.as_view(), name='api-v2.1-assistant-tables'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/assistant-template-tables/$', AssistantTemplateTables.as_view(), name='api-v2.1-assistant-template-tables'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/assistant-member/$', AssistantMember.as_view(), name='api-v2.1-assistant-member'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/assistant-members/$', AssistantMembers.as_view(), name='api-v2.1-assistant-members'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/candidate-members/$', CandidateMembers.as_view(), name='api-v2.1-get-candidate-members'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/tables-index/$', AssistantTablesIndex.as_view(), name='api-v2.1-assistant-tables-index'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/settings/$', AssistantSettings.as_view(), name='api-v2.1-assistant-settings'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/setting/$', AssistantSetting.as_view(), name='api-v2.1-assistant-setting'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/upload-file/$', UploadFile.as_view(), name='api-v2.1-upload-file'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/row/$', Row.as_view(), name='api-v2.1-row'),

    re_path(r'^api/v2.1/ai/asset/(?P<assistant_uuid>[-0-9a-f]{36})/(?P<path>.*)$', AssistantAssetAccess.as_view(), name='api-v2.1-assistant-asset-access'),
    re_path(r'^api/v2.1/ai/asset-preview/(?P<assistant_uuid>[-0-9a-f]{36})/(?P<path>.*)$', AssistantAssetPreview.as_view(), name='api-v2.1-assistant-asset-preview'),

    re_path(r'^api/v2.1/ai/assistants/$', AIAssistants.as_view(), name='api-v2.1-ai-assistants'),
    re_path(r'^api/v2.1/ai/task-manager/tasks-detail/$', TasksDetail.as_view(), name='api-v2.1-ai-tasks-detail'),
    re_path(r'^api/v2.1/ai/task-manager/tasks-by-assignee/tasks-stats/$', AssigneeTasksStats.as_view(), name='api-v2.1-ai-tasks-completion-by-assignee'),
    re_path(r'^api/v2.1/ai/task-manager/tasks-by-assignee/future-tasks/$', AssigneeFutureTasks.as_view(), name='api-v2.1-ai-tasks-completion-by-assignee-future-tasks'),
    re_path(r'^api/v2.1/ai/task-manager/tasks-by-assignee/tasks-details/$', AssigneeTasksDetails.as_view(), name='api-v2.1-ai-tasks-completion-by-assignee-task-details'),
    re_path(r'^api/v2.1/ai/task-manager/add-task-record/$', AddTaskRecord.as_view(), name='api-v2.1-add-task-record'),
    re_path(r'^api/v2.1/ai/document-and-receipt-recognition/add-recognition-record/$', AddRecognitionRecord.as_view(), name='api-v2.1-add-recognition-record'),
    re_path(r'^api/v2.1/ai/document-and-receipt-recognition/receipt-recognition/$', ReceiptRecognition.as_view(), name='api-v2.1-receipt-recognition'),
    re_path(r'^api/v2.1/ai/text-information-extraction/record/$', TextInformationExtraction.as_view(), name='api-v2.1-ai-text-information-extraction-record'),
    re_path(r'^api/v2.1/ai/issue-manage/add-issue-record/$', AddIssueRecord.as_view(), name='api-v2.1-add-issue-record'),
    re_path(r'^api/v2.1/ai/issue-manage/issue-details/$', IssueDetails.as_view(), name='api-v2.1-issue-details'),
    re_path(r'^api/v2.1/ai/qa/add-qa-record/$', AddQARecord.as_view(), name='api-v2.1-add-qa-record'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/agent/$', Agent.as_view(), name='api-v2.1-ai-agent'),
    re_path(r'^api/v2.1/ai/assistant/(?P<assistant_uuid>[-0-9a-f]{36})/history/$', AssistantHistory.as_view(), name='api-v2.1-ai-assistant-history'),

    re_path(r'^api/v2.1/user-admin-bases/$', UserAdminBases.as_view(), name='api-v2.1-user-admin-bases'),
    re_path(r'^api/v2.1/bases/(?P<dtable_uuid>[-0-9a-f]{36})/tables/$', UserAdminBaseTables.as_view(), name='api-v2.1-user-admin-base-tables'),
    # ai internal
    re_path(r'^api/v2.1/ai/internal/get-user-by-name/$', AIGetUserByNameView.as_view(), name='api-v2.1-ai-internal-get-user-by-name'),
    re_path(r'^api/v2.1/ai/internal/dtable-asset-download-link/$', AIDTableAssetDownloadLinkView.as_view(), name='api-v2.1-ai-internal-dtable-asset-download-link'),
    re_path(r'^api/v2.1/ai/internal/dtable-info/$', AIDTableInfoView.as_view(), name='api-v2.1-ai-internal-dtable-info'),
    re_path(r'^api/v2.1/ai/internal/assistant-admin-permission/$', AssistantAdminPermission.as_view(), name='api-v2.1-ai-internal-assistant-admin-permission'),
    re_path(r'^api/v2.1/ai/internal/dtable-admin-permission/$', DtableAdminPermission.as_view(), name='api-v2.1-ai-internal-dtable-admin-permission'),
    re_path(r'^api/v2.1/ai/internal/get-owner-info-by-assistant/$', GetOwnerInfoByAssistant.as_view(), name='api-v2.1-ai-internal-get-owner-info-by-assistant'),
    re_path(r'^api/v2.1/ai/internal/workspace/(?P<workspace_id>\d+)/dtable-asset-upload-link/$', AIDTableAssetUploadLink.as_view(), name='api-v2.1-ai-dtable-asset-upload-link'),
    # ai chrome extension
    re_path(r'^api/v2.1/ai/chrome-extension/extract/full-page/$', ExtractWholeWebPageInfo.as_view(), name='api-v2.1-ai-chrome-extension-extract-whole-page-info'),
    re_path(r'^api/v2.1/ai/chrome-extension/extract/selected-content/$', ExtractSelectedWebInfo.as_view(), name='api-v2.1-ai-chrome-extension-extract-web-selection-info'),

    ### system admin ###
    re_path(r'^sys/useradmin/export-excel/$', sys_useradmin_export_excel, name='sys_useradmin_export_excel'),
    re_path(r'^sys/groupadmin/export-excel/$', sys_group_admin_export_excel, name='sys_group_admin_export_excel'),
    re_path(r'^sys/sudo/', sys_sudo_mode, name='sys_sudo_mode'),
    re_path(r'^useradmin/batchadduser/example/$', batch_add_user_example, name='batch_add_user_example'),
    re_path(r'^sys/dtableadmin/export-dtable/$', sys_dtable_admin_export_dtable, name='sys_dtable_admin_export_dtable'),

    re_path(r'^sys/info/$', sysadmin_react_fake_view, name="sys_info"),
    re_path(r'^sys/desktop-devices/$', sysadmin_react_fake_view, name="sys_desktop_devices"),
    re_path(r'^sys/mobile-devices/$', sysadmin_react_fake_view, name="sys_mobile_devices"),
    re_path(r'^sys/device-errors/$', sysadmin_react_fake_view, name="sys_device_errors"),
    re_path(r'^sys/web-settings/$', sysadmin_react_fake_view, name="sys_web_settings"),
    re_path(r'^sys/all-libraries/$', sysadmin_react_fake_view, name="sys_all_libraries"),
    re_path(r'^sys/system-library/$', sysadmin_react_fake_view, name="sys_system_library"),
    re_path(r'^sys/trash-libraries/$', sysadmin_react_fake_view, name="sys_trash_libraries"),
    re_path(r'^sys/libraries/(?P<repo_id>[-0-9a-f]{36})/$', sysadmin_react_fake_view, name="sys_libraries_template"),
    re_path(r'^sys/libraries/(?P<repo_id>[-0-9a-f]{36})/(?P<repo_name>[^/]+)/(?P<path>.*)$', sysadmin_react_fake_view, name="sys_libraries_template_dirent"),

    re_path(r'^sys/users/$', sysadmin_react_fake_view, name="sys_users"),
    re_path(r'^sys/users/admins/$', sysadmin_react_fake_view, name="sys_users_admin"),
    re_path(r'^sys/users/(?P<email>[^/]+)/$', sysadmin_react_fake_view, name="sys_user"),
    re_path(r'^sys/users/(?P<email>[^/]+)/groups/$', sysadmin_react_fake_view, name="sys_user_groups"),
    re_path(r'^sys/users/(?P<email>[^/]+)/dtables/$', sysadmin_react_fake_view, name="sys_user_dtables"),
    re_path(r'^sys/users/(?P<email>[^/]+)/shared-dtables/$', sysadmin_react_fake_view, name="sys_user_shared_dtables"),
    re_path(r'^sys/users/(?P<email>[^/]+)/storage/(?P<path>.*)$', sysadmin_react_fake_view, name="sys_user_storage"),
    re_path(r'^sys/search-users/$', sysadmin_react_fake_view, name="sys_search_users"),
    re_path(r'^sys/search-dtables/$', sysadmin_react_fake_view, name="sys_search_dtables"),
    re_path(r'^sys/all-dtables/$', sysadmin_react_fake_view, name="sys_all_dtables"),
    re_path(r'^sys/search-apps/$', sysadmin_react_fake_view, name="sys_search_apps"),
    re_path(r'^sys/all-apps/$', sysadmin_react_fake_view, name="sys_all_apps"),
    re_path(r'^sys/trash-dtables/$', sysadmin_react_fake_view, name="sys_deleted_dtables"),
    re_path(r'^sys/database-storage/$', sysadmin_react_fake_view, name="sys_dtable_archives"),
    re_path(r'^sys/all-forms/$', sysadmin_react_fake_view, name="sys_all_forms"),
    re_path(r'^sys/all-collection-tables/$', sysadmin_react_fake_view, name="sys_all_collection_tables"),
    re_path(r'^sys/work-weixin/$', sysadmin_react_fake_view, name="sys_work_weixin"),
    re_path(r'^sys/organizations/$', sysadmin_react_fake_view, name="sys_organizations"),
    re_path(r'^sys/organizations/big-data-storage/$', sysadmin_react_fake_view, name="sys_organizations_big_data_storage"),
    re_path(r'^sys/organizations/universal-apps/$', sysadmin_react_fake_view, name="sys_organizations_universal_apps"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/info/$', sysadmin_react_fake_view, name="sys_organization_info"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/users/$', sysadmin_react_fake_view, name="sys_organization_users"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/admin-users/$', sysadmin_react_fake_view, name="sys_organization_admin_users"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/groups/$', sysadmin_react_fake_view, name="sys_organization_groups"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/dtables/$', sysadmin_react_fake_view, name="sys_organization_dtables"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/external-apps/$', sysadmin_react_fake_view, name="sys_organization_external_apps"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/external-links/$', sysadmin_react_fake_view, name="sys_organization_external_links"),
    re_path(r'^sys/organizations/(?P<org_id>\d+)/view-external-links/$', sysadmin_react_fake_view, name="sys_organization_view_external_links"),
    re_path(r'^sys/search-organizations/$', sysadmin_react_fake_view, name="sys_search_orgs"),
    re_path(r'^sys/groups/$', sysadmin_react_fake_view, name="sys_groups"),
    re_path(r'^sys/groups/(?P<group_id>\d+)/dtables/$', sysadmin_react_fake_view, name="sys_group_dtables"),
    re_path(r'^sys/groups/(?P<group_id>\d+)/members/$', sysadmin_react_fake_view, name="sys_group_members"),
    re_path(r'^sys/groups/(?P<group_id>\d+)/storages/(?P<path>.*)$', sysadmin_react_fake_view, name="sys_group_storage"),
    re_path(r'^sys/external-links/$', sysadmin_react_fake_view, name="sys_external_links"),
    re_path(r'^sys/search-external-links/$', sysadmin_react_fake_view, name="sys_search_external_links"),
    re_path(r'^sys/view-external-links/$', sysadmin_react_fake_view, name="sys_view_external_links"),
    re_path(r'^sys/search-view-external-links/$', sysadmin_react_fake_view, name="sys_search_view_external_links"),
    re_path(r'^sys/search-groups/$', sysadmin_react_fake_view, name="sys_search_groups"),
    re_path(r'^sys/notifications/$', sysadmin_react_fake_view, name="sys_notifications"),
    re_path(r'^sys/user-notifications/$', sysadmin_react_fake_view, name="sys_user_notifications"),
    re_path(r'^sys/logs/login/$', sysadmin_react_fake_view, name="sys_logs_login"),
    re_path(r'^sys/audit-logs/$', sysadmin_react_fake_view, name="sys_logs_audit"),
    re_path(r'^sys/file-access-logs/$', sysadmin_react_fake_view, name="sys_logs_file_access"),
    re_path(r'^sys/admin-logs/operation/$', sysadmin_react_fake_view, name="sys_admin_operation"),
    re_path(r'^sys/admin-logs/login/$', sysadmin_react_fake_view, name="sys_admin_operation"),
    re_path(r'^sys/statistics/users/$', sysadmin_react_fake_view, name="sys_admin_statistics_users"),
    re_path(r'^sys/statistics/auto-rules/$', sysadmin_react_fake_view, name="sys_admin_statistics_users"),
    re_path(r'^sys/statistics/scripts-running/$', sysadmin_react_fake_view, name="sys_admin_statistics_users"),
    re_path(r'^sys/statistics/external-apps/$', sysadmin_react_fake_view, name="sys_admin_statistics_external-apps"),
    re_path(r'^sys/plugins/$', sysadmin_react_fake_view, name="sys_admin_plugins"),
    re_path(r'^sys/plugins-install-count/$', sysadmin_react_fake_view, name="sys_admin_plugins_install_count"),
    re_path(r'^sys/notification-rules/$', sysadmin_react_fake_view, name="sys_notification_rules"),
    re_path(r'^sys/automation-rules/$', sysadmin_react_fake_view, name="sys_automation_rules"),
    re_path(r'^sys/invalid-notification-rules/$', sysadmin_react_fake_view, name="sys_notification_invalid_rules"),
    re_path(r'^sys/invalid-automation-rules/$', sysadmin_react_fake_view, name="sys_automation_invalid_rules"),
    re_path(r'^sys/common-datasets/$', sysadmin_react_fake_view, name="sys_common_datasets"),
    re_path(r'^sys/periodical-syncs/$', sysadmin_react_fake_view, name="sys_periodical_syncs"),
    re_path(r'^sys/invalid-syncs/$', sysadmin_react_fake_view, name="sys_invalid_syncs"),
    re_path(r'^sys/abuse-reports/$', sysadmin_react_fake_view, name="sys_admin_abuse_reports"),
    re_path(r'^sys/email-sending-logs/$', sysadmin_react_fake_view, name="sys_email_sending_logs"),
    re_path(r'^sys/departments/$', sysadmin_react_fake_view, name="sys_admin_departments"),
    re_path(r'^sys/departments/(?P<group_id>\d+)/$', sysadmin_react_fake_view, name="sys_admin_department"),
    re_path(r'^sys/departments/(?P<group_id>\d+)/members/$', sysadmin_react_fake_view, name="sys_admin_department"),
    re_path(r'^sys/departments/(?P<group_id>\d+)/bases/$', sysadmin_react_fake_view, name="sys_admin_department"),
    re_path(r'^sys/departments-v2/$', sysadmin_react_fake_view, name="sys_admin_departments_v2"),
    re_path(r'^sys/workflows/$', sysadmin_react_fake_view, name="workflows"),
    re_path(r'^sys/virus-files/all/$', sysadmin_react_fake_view, name="sys_virus_scan_records"),
    re_path(r'^sys/virus-files/unhandled/$', sysadmin_react_fake_view, name="sys_virus_scan_records"),

    re_path(r'^group-invite/(?P<token>[-0-9a-f]{8})/$', group_invite, name='group_invite'),
    re_path(r'^dtable-download/$', dtable_download_view, name='dtable_download'),

]

if not settings.SEATABLE_MARKET_URL:
    urlpatterns += [
        re_path(r'^templates/$', app_templates_fake_view, name="templates"),
        re_path(r'^api/v2.1/templates/$', TemplatesView.as_view(), name='api-v2.1-templates'),
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


if getattr(settings, 'ENABLE_COLLABORA', False):
    from seahub.collabora.views import CollaboraFilesInfoView, CollaboraFilesContentView
    urlpatterns += [
        re_path(r'^files/(?P<file_id>[-0-9-a-f]{40})$', CollaboraFilesInfoView, name='CollaboraFilesInfoView'),
        re_path(r'^files/(?P<file_id>[-0-9-a-f]{40})/contents$', CollaboraFilesContentView, name='CollaboraFilesContentView'),
    ]


if getattr(settings, 'ENABLE_ONLYOFFICE', False):
    from seahub.onlyoffice.views import onlyoffice_editor_callback
    urlpatterns += [
        re_path(r'^onlyoffice/editor-callback/$', onlyoffice_editor_callback, name='onlyoffice_editor_callback'),
    ]


if getattr(settings, 'ENABLE_SIMPLE_SSO_LOGIN', False):
    urlpatterns += [
        re_path(r'^simple_sso/$', simple_sso_login, name="simple-sso-login"),
    ]


if getattr(settings, 'ENABLE_SHIB_LOGIN', False):
    urlpatterns += [
        re_path(r'^shib-complete/', TemplateView.as_view(template_name='shibboleth/complete.html'), name="shib_complete"),
        re_path(r'^shib-success/', TemplateView.as_view(template_name="shibboleth/success.html"), name="shib_success"),
    ]


if getattr(settings, 'ENABLE_KRB5_LOGIN', False):
    urlpatterns += [
        re_path(r'^krb5-login/', shib_login, name="krb5_login"),
    ]

if is_pro_version() and getattr(settings, 'ENABLE_SAML', False):
    urlpatterns += [
        re_path(r'^saml/', include('seahub.saml.urls')),
        re_path(r'^saml/', include('djangosaml2.urls')),
    ]

if is_pro_version() and getattr(settings, 'ENABLE_MULTI_SAML', False):
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
    ]

if is_pro_version() and (getattr(settings, 'ENABLE_SAML', False) or getattr(settings, 'ENABLE_MULTI_SAML', False)):
    from seahub.saml.views import saml_complete
    urlpatterns += [
        re_path(r'^saml/complete/$', saml_complete, name='saml_complete'),
    ]

if is_pro_version() and (getattr(settings, 'ENABLE_OAUTH', False) or getattr(settings, 'ENABLE_CUSTOM_OAUTH', False)):
    urlpatterns += [
        re_path(r'^oauth/', include('seahub.oauth.urls')),
    ]
urlpatterns += [
    re_path(r'^oauth/third-party-email-accounts/callback/', thirdparty_email_account_oauth_callback, name='thirdparty_email_account_oauth_callback')
]


if getattr(settings, 'ENABLE_SUBSCRIPTION', False):
    urlpatterns += [
        re_path(r'^subscription/', include('seahub.subscription.urls')),
        re_path(r'^api/v2.1/subscription/$', SubscriptionView.as_view(), name='api-v2.1-subscription'),
        re_path(r'^api/v2.1/subscription/plans/$', SubscriptionPlansView.as_view(), name='api-v2.1-subscription-plans'),
        re_path(r'^api/v2.1/subscription/logs/$', SubscriptionLogsView.as_view(), name='api-v2.1-subscription-logs'),
        re_path(r'^api/v2.1/subscription/coin-exchange/$', RedeemCodeExchangeView.as_view(), name='api-v2.1-subscription-coin-exchange'),
    ]


# serve office converter static files
from seahub.settings import HAS_OFFICE_CONVERTER
if HAS_OFFICE_CONVERTER:
    from seahub.views.file import (
        office_convert_query_status, office_convert_get_page
    )
    urlpatterns += [
        re_path(r'^office-convert/static/(?P<repo_id>[-0-9a-f]{36})/(?P<commit_id>[0-9a-f]{40})/(?P<path>.+)/(?P<filename>[^/].+)$',
            office_convert_get_page, name='office_convert_get_page'),
        re_path(r'^office-convert/status/$', office_convert_query_status, name='office_convert_query_status'),
    ]

if getattr(settings, 'ENABLE_TSINGHUA_AUTH', False):
    from seahub.custom.tsinghua_auth.views import *
    urlpatterns += [
        re_path(r'^accounts/tsinghua-login/$', tsinghua_login, name='tsinghua_login'),
        re_path(r'^tsinghua-auth/callback/$', tsinghua_auth_callback, name='tsinghua_auth_callback'),
    ]


from seahub.dtable_apps.workflow.views import dtable_workflow_task_submitted_view, dtable_workflow_task_transfer_view, \
    workflow_edit_view
urlpatterns += [
    re_path(r'^dtable/workflows/(?P<token>[-0-9a-f]{36})/tasks/(?P<task_id>\d+)/transfer/$', dtable_workflow_task_transfer_view, name='dtable_workflow_task_transfer'),
    re_path(r'^dtable/workflows/(?P<token>[-0-9a-f]{36})/submitted-tasks/(?P<task_id>\d+)/$', dtable_workflow_task_submitted_view, name='dtable_workflow_task_submitted'),
    re_path(r'^dtable/workflows/(?P<token>[-0-9a-f]{36})/edit/$', workflow_edit_view, name='dtable_workflow_edit'),
]

if getattr(settings, 'ENABLE_SEADOC', False):
    urlpatterns += [
        re_path(r'^api/v2.1/seadoc/', include('seahub.seadoc.urls')),
    ]

export const gettext = window.gettext;

export const isPro = window.app.config.isPro === 'True';
export const siteRoot = window.app.config.siteRoot;
export const loginUrl = window.app.config.loginUrl;
export const mediaUrl = window.app.config.mediaUrl;
export const siteTitle = window.app.config.siteTitle;
export const siteName = window.app.config.siteName;
export const logoPath = window.app.config.logoPath;
export const logoWidth = window.app.config.logoWidth;
export const logoHeight = window.app.config.logoHeight;
export const lang = window.app.config.lang;
export const seafileVersion = window.app.config.seafileVersion;
export const serviceURL = window.app.config.serviceURL;
export const appAvatarURL = window.app.config.avatarURL;
export const faviconPath = window.app.config.faviconPath;
export const faviconNotificationPath = window.app.config.faviconNotificationPath;
export const loginBGPath = window.app.config.loginBGPath;

// pageOptions
export const server = window.app.pageOptions.server;
export const apiGatewayUrl = (server || '').replace(/\/*$/, '') + '/api-gateway/';
export const name = window.app.pageOptions.name;
export const contactEmail = window.app.pageOptions.contactEmail;
export const username = window.app.pageOptions.username;
export const canAddGroup = window.app.pageOptions.canAddGroup;
export const canAddProject = window.app.pageOptions.canAddProject;
export const canGenerateExternalLink = window.app.pageOptions.canGenerateExternalLink;
export const canUseAdvancedPerms = window.app.pageOptions.canUseAdvancedPerms;
export const canUseAdvancedCustomization = window.app.pageOptions.canUseAdvancedCustomization;
export const enableAbuseReport = window.app.pageOptions.enableAbuseReport;
export const canGenerateUploadLink = window.app.pageOptions.canGenerateUploadLink;
export const canSendShareLinkEmail = window.app.pageOptions.canSendShareLinkEmail;
export const canViewOrg = window.app.pageOptions.canViewOrg === 'True';
export const fileAuditEnabled = window.app.pageOptions.fileAuditEnabled;
export const enableFileComment = window.app.pageOptions.enableFileComment ? true : false;
export const folderPermEnabled = window.app.pageOptions.folderPermEnabled;
export const thumbnailSizeForOriginal = window.app.pageOptions.thumbnailSizeForOriginal;
export const shareLinkPasswordMinLength = window.app.pageOptions.shareLinkPasswordMinLength;
export const shareLinkExpireDaysMin = window.app.pageOptions.shareLinkExpireDaysMin;
export const shareLinkExpireDaysMax = window.app.pageOptions.shareLinkExpireDaysMax;
export const shareLinkExpireDaysDefault = window.app.pageOptions.shareLinkExpireDaysDefault;
export const enableUpdateUserInfo = window.app.pageOptions.enableUpdateUserInfo;
export const enableUserSetContactEmail = window.app.pageOptions.enableUserSetContactEmail;
export const enableUserSetName = window.app.pageOptions.enableUserSetName;
export const customNavItems = window.app.pageOptions.customNavItems;
export const canRemoveBasePasswordViaPhone = window.app.pageOptions.canRemoveBasePasswordViaPhone;
export const hasBoundPhone = window.app.pageOptions.hasBoundPhone;
export const disableAddingPersonalBases = window.app.pageOptions.disableAddingPersonalBases;
export const enableSeatableAI = window.app.pageOptions.enableSeatableAI;

export const curNoteMsg = window.app.pageOptions.curNoteMsg;
export const curNoteID = window.app.pageOptions.curNoteID;
export const curNoteList = window.app.pageOptions.curNoteList;

export const canRunPython = window.app.pageOptions.canRunPython;
export const trashCleanExpireDays = window.app.pageOptions.trashCleanExpireDays;

export const disableAddressBookV1 = window.app.pageOptions.disableAddressBookV1;
export const enableAddressBookV2 = window.app.pageOptions.enableAddressBookV2;
export const enableDepartmentAdminManageMemberBases = window.app.pageOptions.enableDepartmentAdminManageMemberBases;
export const enableShowIDInOrgWhenSearchUser = window.app.pageOptions.enableShowIDInOrgWhenSearchUser;


// dtable
export const workspaceID = window.app.pageOptions.workspaceID;
export const showWechatSupportGroup = window.app.pageOptions.showWechatSupportGroup;

export const showTemplatesLink = window.app.pageOptions.showTemplatesLink;

export const enableCreateBaseFromTemplate = window.app.pageOptions.enableCreateBaseFromTemplate;
export const enableOrgCommonDataset = window.app.pageOptions.enableOrgCommonDataset;
export const enableUniversalApp = window.app.pageOptions.enableUniversalApp;

let seatablemarketurl = '';
if (window.app.pageOptions.seatableMarketUrl) {
  seatablemarketurl = window.app.pageOptions.seatableMarketUrl;
} else if (window.sysadmin) {
  seatablemarketurl = window.sysadmin.pageOptions.seatableMarketUrl;
}
export const seatableMarketUrl = seatablemarketurl;

export const helpLink = window.app.pageOptions.helpLink;
export const cloudMode = window.app.pageOptions.cloudMode;
export const isOrgContext = window.app.pageOptions.isOrgContext;
export const orgName = window.app.pageOptions.orgName;
export const enableSubscription = window.app.pageOptions.enableSubscription;
export const enableSlideCaptcha = window.app.pageOptions.enableSlideCaptcha;
export const videoTutorialsLink = window.app.pageOptions.videoTutorialsLink;
export const enableUserGuide = window.app.pageOptions.enableUserGuide;
export const traingingServicesLink = window.app.pageOptions.traingingServicesLink;
export const gettingStartLink = window.app.pageOptions.gettingStartLink;
export const useCaseLink = window.app.pageOptions.useCaseLink;

export const enableTellAFriend = window.app.pageOptions.enableTellAFriend;
export const enableInviteAFriend = window.app.pageOptions.enableInviteAFriend;
export const friendInvitationLink = window.app.pageOptions.friendInvitationLink;
export const useExternalTeamAdmin = window.app.pageOptions.useExternalTeamAdmin;
export const orgSamlConnected = window.app.pageOptions.orgSamlConnected;

// org admin
export const orgID = window.org ? window.org.pageOptions.orgID : '';
export const invitationLink = window.org ? window.org.pageOptions.invitationLink : '';
export const orgMemberQuotaEnabled = window.org ? window.org.pageOptions.orgMemberQuotaEnabled : '';
export const displayTwoFactorAuth = window.org ? window.org.pageOptions.displayTwoFactorAuth : false;
export const enableOrgDepartment = window.org ? window.org.pageOptions.enable_org_department : false;
export const enableOrgAdminInviteViaEmail = window.org ? window.org.pageOptions.enable_org_admin_invite_via_email : false;
export const enableOrgWorkWeixin = window.org ? window.org.pageOptions.enableOrgWorkWeixin : false;
export const enableOrgDingtalk = window.org ? window.org.pageOptions.enableOrgDingtalk : false;
export const orgCorpBindType = window.org ? window.org.pageOptions.orgCorpBindType : '';
export const enableOrgLogo = window.org ? window.org.pageOptions.enable_org_logo : false;
export const enableMultiSAML = window.org ? window.org.pageOptions.enableMultiSAML : false;
export const canUseSAML = window.org ? window.org.pageOptions.canUseSAML : false;

// sys admin
export const storages = window.app.pageOptions.storages; // storage backends
export const isShowUint = window.sysadmin ? window.sysadmin.pageOptions.is_show_unit : '';
export const constanceEnabled = window.sysadmin ? window.sysadmin.pageOptions.constance_enabled : '';
export const multiTenancy = window.sysadmin ? window.sysadmin.pageOptions.multi_tenancy : '';
export const multiInstitution = window.sysadmin ? window.sysadmin.pageOptions.multi_institution : '';
export const sysadminExtraEnabled = window.sysadmin ? window.sysadmin.pageOptions.sysadmin_extra_enabled : '';
export const twoFactorAuthEnabled = window.sysadmin ? window.sysadmin.pageOptions.two_factor_auth_enabled : '';
export const enableGuestInvitation = window.sysadmin ? window.sysadmin.pageOptions.enable_guest_invitation : '';
export const isDefaultAdmin = window.sysadmin ? window.sysadmin.pageOptions.is_default_admin : '';
export const enableFileScan = window.sysadmin ? window.sysadmin.pageOptions.enable_file_scan : '';
export const canViewSystemInfo = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_system_info : '';
export const canViewStatistic = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_statistic : '';
export const canConfigSystem = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_config_system : '';
export const canManageLibrary = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_library : '';
export const canManageUser = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_user : '';
export const canManageSpecificUser = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_update_user : '';
export const canManageGroup = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_group : '';
export const canManageExternalLink = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_external_link : '';
export const canViewUserLog = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_user_log : '';
export const canViewAuditLog = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_audit_log : '';
export const canViewAdminLog = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_admin_log : '';
export const enableWorkWeixin = window.sysadmin ? window.sysadmin.pageOptions.enable_work_weixin : '';
export const canManageOrganization = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_organization : '';
export const canUpdateOrganization = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_update_organization : '';
export const canManageApp = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_app : '';
export const otherPermission = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.other_permission : '';


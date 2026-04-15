export const gettext = window.gettext;

export const siteRoot = window.app.config.siteRoot;
export const loginUrl = window.app.config.loginUrl;
export const mediaUrl = window.app.config.mediaUrl;
export const siteTitle = window.app.config.siteTitle;
export const siteName = window.app.config.siteName;
export const logoPath = window.app.config.logoPath;
export const logoWidth = window.app.config.logoWidth;
export const logoHeight = window.app.config.logoHeight;
export const lang = window.app.config.lang;
export const serviceURL = window.app.config.serviceURL;
export const faviconPath = window.app.config.faviconPath;
export const faviconNotificationPath = window.app.config.faviconNotificationPath;
export const loginBGPath = window.app.config.loginBGPath;

// pageOptions
export const server = window.app.pageOptions.server;
export const name = window.app.pageOptions.name;
export const contactEmail = window.app.pageOptions.contactEmail;
export const username = window.app.pageOptions.username;
export const avatarURL = window.app.pageOptions.avatarURL;
export const canAddGroup = window.app.pageOptions.canAddGroup;
export const canAddProject = window.app.pageOptions.canAddProject;
export const canUseAdvancedPerms = window.app.pageOptions.canUseAdvancedPerms;
export const canUseAdvancedCustomization = window.app.pageOptions.canUseAdvancedCustomization;
export const canGenerateUploadLink = window.app.pageOptions.canGenerateUploadLink;
export const canViewOrg = window.app.pageOptions.canViewOrg === 'True';
export const fileAuditEnabled = window.app.pageOptions.fileAuditEnabled;
export const enableFileComment = window.app.pageOptions.enableFileComment ? true : false;
export const folderPermEnabled = window.app.pageOptions.folderPermEnabled;
export const enableUpdateUserInfo = window.app.pageOptions.enableUpdateUserInfo;
export const enableUserSetContactEmail = window.app.pageOptions.enableUserSetContactEmail;
export const enableUserSetName = window.app.pageOptions.enableUserSetName;
export const customNavItems = window.app.pageOptions.customNavItems;
export const disableAddingPersonalProjects = window.app.pageOptions.disableAddingPersonalProjects;
export const isOrgStaff = window.app.pageOptions.isOrgStaff;

export const trashCleanExpireDays = window.app.pageOptions.trashCleanExpireDays;

export const enableShowIDInOrgWhenSearchUser = window.app.pageOptions.enableShowIDInOrgWhenSearchUser;


// project
export const workspaceID = window.app.pageOptions.workspaceID;
export const projectName = window.app.pageOptions.projectName;

export const isOrgContext = window.app.pageOptions.isOrgContext;
export const orgName = window.app.pageOptions.orgName;

export const useExternalTeamAdmin = window.app.pageOptions.useExternalTeamAdmin;
export const orgSamlConnected = window.app.pageOptions.orgSamlConnected;

// org admin
export const orgID = window.org ? window.org.pageOptions.orgID : '';
export const invitationLink = window.org ? window.org.pageOptions.invitationLink : '';
export const orgMemberQuotaEnabled = window.org ? window.org.pageOptions.orgMemberQuotaEnabled : '';
export const displayTwoFactorAuth = window.org ? window.org.pageOptions.displayTwoFactorAuth : false;
export const enableOrgLogo = window.org ? window.org.pageOptions.enable_org_logo : false;
export const enableMultiSAML = window.org ? window.org.pageOptions.enableMultiSAML : false;
export const canUseSAML = window.org ? window.org.pageOptions.canUseSAML : false;
export const enableExternalBillingService = window.org ? window.org.pageOptions.enableExternalBillingService : false;

// sys admin
export const isShowUint = window.sysadmin ? window.sysadmin.pageOptions.is_show_unit : '';
export const multiTenancy = window.sysadmin ? window.sysadmin.pageOptions.multi_tenancy : '';
export const multiInstitution = window.sysadmin ? window.sysadmin.pageOptions.multi_institution : '';
export const twoFactorAuthEnabled = window.sysadmin ? window.sysadmin.pageOptions.two_factor_auth_enabled : '';
export const isDefaultAdmin = window.sysadmin ? window.sysadmin.pageOptions.is_default_admin : '';
export const canViewSystemInfo = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_system_info : '';
export const canViewStatistic = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_statistic : '';
export const canConfigSystem = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_config_system : '';
export const canManageUser = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_user : '';
export const canManageSpecificUser = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_update_user : '';
export const canManageGroup = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_group : '';
export const canViewUserLog = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_user_log : '';
export const canViewAuditLog = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_audit_log : '';
export const canViewAdminLog = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_view_admin_log : '';
export const canManageOrganization = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_manage_organization : '';
export const canUpdateOrganization = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.can_update_organization : '';
export const otherPermission = window.sysadmin ? window.sysadmin.pageOptions.admin_permissions.other_permission : '';

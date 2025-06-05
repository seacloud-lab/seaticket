import React from 'react';
import { createRoot } from 'react-dom/client';
import ViewFileDtable from '@seafile/dtable/es';
import { I18nextProvider } from 'react-i18next';
import { toaster } from 'dtable-ui-component';
import i18n from './i18n-dtable';
import { apiGatewayUrl, gettext } from './utils/constants';

const {
  lang,
  siteRoot,
  mediaUrl,
  loginUrl,
  faviconPath,
  faviconNotificationPath,
  dtableBaiduMapKey,
  dtableMineMapKey,
  dtableMineMapCustomConfig,
  dtableGoogleMapKey,
  dtableEnableEmailColumn,
} = window.app.config;

const {
  // common url
  server,
  seafileUrl,
  seatableMarketUrl,
  seatableFaasUrl,
  helpLink,
  fileServerRoot,

  // user info
  username,
  id_in_org: userId,
  userNickName: name,
  contactEmail,
  isAdmin,
  permission,
  isFirstOpen,
  orgID,
  userDepartmentIdsMap,


  // user limit
  isBelongToUserOrInTheSameOrg,
  assetQuotaExceeded,
  rowsExceeded,

  // org limit
  bigDataRowLimitExceeded,
  bigDataStorageLimitExceeded,
  disableBigDataFeature,

  // dtable info
  workspaceID,
  dtableUuid,
  fileName,
  filePath,
  repoApiToken,
  shareLinkPasswordMinLength,
  shareLinkExpireDaysDefault,
  shareLinkExpireDaysMin,
  shareLinkExpireDaysMax,
  dtableColor,

  // base limit
  baseWritableLimit,

  // feature control
  canCreateCommonDataset,
  canGenerateExternalLink,
  canUseAdvancedPerms,
  canUseAdvancedCustomization,
  canUseAutomationRules,
  canRunPythonScript,
  isScriptRunningConfigured,
  enableWeixin,
  enableAbuseReport,
  enableUserToSetNumberSeparator,
  enableArchivingRows,
  enableAddressBookV2,
  enableDepartmentColumnForAll,
  isOpenDepartmentFeature,

  // external app | plugins
  internalPlugins,
  advancedPlugins,
  canUseExternalApp,
  dtableAppsConfig,

  // workflow
  enableWorkflow,

  // seadoc
  enableSeaDoc,
  seadocServerUrl,

  // visit method
  snapshotCommitID, // dtable snapshot
  shareLinkToken, // dtable share link
  externalLinkToken, // dtable external link
  externalLinkSupportDownloadType,
  externalLinkSupportDownloadSize,
  currentGroupId,
  isOwnedByGroup,
  userGroupIds,
  userViewShareId, // user's view share link
  groupViewShareId, // group's view share link
  viewExternalLinkToken, // view external link

  // deployment method
  cloudMode,
  isOrgContext,
  appUserTableIds,
  mobileLogin,
  customColors,
  isOrgStaff,
  useExternalTeamAdmin,

  // seafile
  defaultSeafileServer,
  dtableServer,
  dtableSocket,
  accessToken,

  isEncrypted,
  isMobile,

  // assistant
  enabledAssistantTypes,

  // api-gateway
  loadDtableFromAPIGateway,
  enableAPIGatewayProxySocket,
} = window.app.pageOptions;

const isSharedView = userViewShareId || groupViewShareId || viewExternalLinkToken;

window.dtable = {};
window.dtable = {
  lang,
  siteRoot,
  mediaUrl,
  loginUrl,
  faviconPath,
  faviconNotificationPath,
  dtableBaiduMapKey,
  dtableMineMapKey,
  dtableMineMapCustomConfig,
  dtableGoogleMapKey,
  dtableEnableEmailColumn,

  // common url
  server,
  seafileUrl,
  seatableMarketUrl,
  seatableFaasUrl,
  helpLink,
  fileServerRoot,

  // user info
  username,
  name, // userNickName
  userId, // id_in_org
  contactEmail,
  isAdmin,
  permission,
  isFirstOpen,
  orgID,
  userDepartmentIdsMap,

  // user limit
  isBelongToUserOrInTheSameOrg,
  assetQuotaExceeded,
  rowsExceeded,

  // org limit
  bigDataRowLimitExceeded,
  bigDataStorageLimitExceeded,
  disableBigDataFeature,

  // dtable info
  workspaceID,
  dtableUuid,
  fileName,
  filePath,
  repoApiToken,
  shareLinkPasswordMinLength,
  shareLinkExpireDaysDefault,
  shareLinkExpireDaysMin,
  shareLinkExpireDaysMax,
  dtableColor,

  // base limit
  baseWritableLimit,

  // feature control
  canCreateCommonDataset,
  canGenerateExternalLink,
  canUseAdvancedPerms,
  canUseAdvancedCustomization,
  canUseAutomationRules,
  canRunPythonScript,
  isScriptRunningConfigured,
  enableWeixin,
  enableAbuseReport,
  enableUserToSetNumberSeparator,
  enableArchivingRows,
  enableAddressBookV2,
  enableDepartmentColumnForAll,
  isOpenDepartmentFeature,

  // external app | plugins
  internalPlugins,
  advancedPlugins,
  canUseExternalApp,
  dtableAppsConfig,

  // workflow
  enableWorkflow,

  // seadoc
  enableSeaDoc,
  sdocServer: seadocServerUrl,

  // visit method
  snapshotCommitID, // dtable snapshot
  shareLinkToken, // dtable share link
  externalLinkToken, // dtable external link
  externalLinkSupportDownloadType,
  externalLinkSupportDownloadSize,
  isSharedView,
  currentGroupId,
  isOwnedByGroup,
  userGroupIds,
  userViewShareId, // user's view share link
  groupViewShareId, // group's view share link
  viewExternalLinkToken, // view external link

  // deployment method
  cloudMode,
  isOrgContext,
  isOrgStaff,
  useExternalTeamAdmin,

  appUserTableIds,
  mobileLogin,
  customColors,

  // seafile
  defaultSeafileServer,

  dtableServer,
  dtableSocket,
  accessToken,
  dtableDb: apiGatewayUrl,

  isEncrypted,
  isMobile,

  // assistant
  enabledAssistantTypes,

  // api-gateway
  loadDtableFromAPIGateway,
  enableAPIGatewayProxySocket,
};

class ViewFileSDB extends React.Component {

  componentDidMount() {
    if (assetQuotaExceeded) {
      if (isBelongToUserOrInTheSameOrg) {
        toaster.warning(gettext('Your attachments have exceeded quota and all bases will be read-only. Please upgrade your plan to have full access again.'));
      } else {
        toaster.warning(gettext('The attachments of the user or organization who shared the base with you have exceeded quota and the base will be read-only.'));
      }
    }
    if (rowsExceeded) {
      if (isBelongToUserOrInTheSameOrg) {
        toaster.warning(gettext('You exceed the limit of your plan. You can either reduce the rows used or upgrade your plan to have full access again.'));
      } else {
        toaster.warning(gettext('User or organization who shared the base with you exceeds the limit of plan and the base will be read-only.'));
      }
    }
    if (bigDataRowLimitExceeded || bigDataStorageLimitExceeded) {
      if (isBelongToUserOrInTheSameOrg) {
        toaster.warning(gettext('You exceed the limit of your plan for big data storage. Big data feature is disabled now.'));
      } else {
        toaster.warning(gettext('User or organization who shared the base with you exceeds the limit of big data storage.'));
      }
    }
  }

  render() {
    return (
      <ViewFileDtable />
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={ i18n }>
    <ViewFileSDB />
  </I18nextProvider>
);

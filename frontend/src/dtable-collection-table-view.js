import React from 'react';
import { createRoot } from 'react-dom/client';
import ViewFileDtable from '@seafile/dtable/es';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n-dtable';
import { apiGatewayUrl } from './utils/constants';

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
  server,
  seatableMarketUrl,
  seatableFaasUrl,
  seafileUrl,
  helpLink,

  username,
  id_in_org: userId,
  userNickName,
  contactEmail,
  isAdmin,
  permission,
  isFirstOpen,

  workspaceID,
  dtableUuid,
  fileName,
  filePath,
  shareLinkPasswordMinLength,
  shareLinkExpireDaysDefault,
  shareLinkExpireDaysMin,
  shareLinkExpireDaysMax,
  repoApiToken,
  dtableColor,

  canCreateCommonDataset,
  canGenerateExternalLink,
  canUseAdvancedPerms,
  canRunPythonScript,
  isScriptRunningConfigured,
  enableWeixin,
  enableAbuseReport,
  enableAddressBookV2,
  enableUserToSetNumberSeparator,
  enableDepartmentColumnForAll,
  isOpenDepartmentFeature,

  internalPlugins,

  collectionTableToken,
  isCollectionTableDesignView,
  isMobile,

  cloudMode,
  isOrgContext,
  dtableServer,
  dtableSocket,
  accessToken,

  // api-gateway
  loadDtableFromAPIGateway,
  enableAPIGatewayProxySocket,
} = window.app.pageOptions;

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

  server,
  seatableMarketUrl,
  seatableFaasUrl,
  seafileUrl,
  helpLink,

  username,
  id_in_org: userId,
  userNickName,
  contactEmail,
  isAdmin,
  permission,
  isFirstOpen,
  dtableColor,

  workspaceID,
  dtableUuid,
  fileName,
  filePath,
  shareLinkPasswordMinLength,
  shareLinkExpireDaysDefault,
  shareLinkExpireDaysMin,
  shareLinkExpireDaysMax,
  repoApiToken,

  canCreateCommonDataset,
  canGenerateExternalLink,
  canUseAdvancedPerms,
  canRunPythonScript,
  isScriptRunningConfigured,
  enableWeixin,
  enableAbuseReport,
  enableAddressBookV2,
  enableUserToSetNumberSeparator,
  enableDepartmentColumnForAll,
  isOpenDepartmentFeature,

  internalPlugins,

  collectionTableToken,
  isCollectionTableDesignView,

  cloudMode,
  isOrgContext,
  isMobile,

  dtableServer,
  dtableSocket,
  dtableDb: apiGatewayUrl,

  accessToken,
  loadDtableFromAPIGateway,
  enableAPIGatewayProxySocket,
};

class DTableCollectionTableView extends React.Component {

  render() {
    return (<ViewFileDtable />);
  }

}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={ i18n }>
    <DTableCollectionTableView />
  </I18nextProvider>
);

const paths = require('./paths');

const entryFiles = {
  settings: '/settings.js',
  subscription: '/subscription.js',
  orgAdmin: '/pages/org-admin',
  sysAdmin: '/pages/sys-admin',
  appTemplates: '/pages/templates',
  viewDataGrid: '/view-file-dtable.js',
  baseStatistic: '/dtable-statistic/es/index.js',
  appDTable: '/app-dtable',
  dtableAssetFileView: '/dtable-asset-file-view.js',
  dtableEmbedView: '/dtable-embed-view.js',
  dtableSharedRowView: '/dtable-shared-row-view.js',
  dtableFormView: '/dtable-shared-form-view.js',
  dtableEditFormView: '/dtable-edit-form-view.js',
  dtableEditCollectionTableView: '/dtable-edit-collection-table-view.js',
  dtableCollectionTableView: '/dtable-collection-table-view.js',
  invitePoster: '/invite-poster.js',
  pageDesign: '/dtable-page-design.js',
  rowPageDesign: '/dtable-row-page-design.js',
  rowDocument: '/dtable-row-document.js',
  dtableWorkflowEdit: '/workflow/dtable-workflow-edit.js',
  dtableWorkflowTransfer: '/workflow/dtable-workflow-transfer.js',
  dtableWorkflowSubmitted: '/workflow/dtable-workflow-submitted.js',
  viewFileSdoc: '/view-file-sdoc.js',
};

const getEntries = (isEnvDevelopment) => {
  let entries = {};
  Object.keys(entryFiles).forEach(key => {
    let entry = [];
    if (isEnvDevelopment) {
      entry.push(require.resolve('react-dev-utils/webpackHotDevClient'));
    }
    if (key === 'baseStatistic') {
      entry.push(paths.appNodeModules + entryFiles[key]);
    } else {
      entry.push(paths.appSrc + entryFiles[key]);
    }

    entries[key] = entry;
  });
  return entries;
};

module.exports = getEntries;

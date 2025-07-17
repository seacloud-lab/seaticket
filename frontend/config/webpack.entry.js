const paths = require('./paths');

const entryFiles = {
  settings: '/settings.js',
  orgAdmin: '/pages/org-admin',
  sysAdmin: '/pages/sys-admin',
  home: '/home',
  project: '/project',
  eyeIcon: '/icon-page/eye-icon',
  checkCircleIcon: '/icon-page/check-circle',
  exclamationCircleIcon: '/icon-page/exclamation-circle',
  moreIcon: '/icon-page/more',
  downIcon: '/icon-page/down',
};

const getEntries = (isEnvDevelopment) => {
  let entries = {};
  Object.keys(entryFiles).forEach(key => {
    let entry = [];
    if (isEnvDevelopment) {
      entry.push(require.resolve('react-dev-utils/webpackHotDevClient'));
    }
    entry.push(paths.appSrc + entryFiles[key]);
    entries[key] = entry;
  });
  return entries;
};

module.exports = getEntries;

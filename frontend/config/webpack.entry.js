const paths = require('./paths');

const entryFiles = {
  settings: '/settings.js',
  orgAdmin: '/pages/org-admin',
  sysAdmin: '/pages/sys-admin',
  home: '/home',
  project: '/project',
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

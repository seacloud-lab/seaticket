import { gettext, siteRoot, enableMultiSAML, canUseSAML } from '@/constants';

export const BAR_TYPE = {
  MANAGE: 'manage',
  SETTINGS: 'settings',
  STATISTICS: 'statistics',
  PROJECTS: 'projects',
  USERS: 'users',
  GROUPS: 'groups',
  SAML: 'saml-config',
};

export const BAR_CONFIG = {
  [BAR_TYPE.MANAGE]: {
    icon: 'info-navbar',
    name: gettext('Info'),
    value: BAR_TYPE.MANAGE,
    link: `${siteRoot}org/${BAR_TYPE.MANAGE}/`,
    isActive: (bar) => bar === BAR_TYPE.MANAGE,
  },
  [BAR_TYPE.SETTINGS]: {
    icon: 'settings-navbar',
    name: gettext('Settings'),
    value: BAR_TYPE.SETTINGS,
    link: `${siteRoot}org/${BAR_TYPE.SETTINGS}/`,
    isActive: (bar) => bar === BAR_TYPE.SETTINGS,
  },
  [BAR_TYPE.STATISTICS]: {
    icon: 'statistic-navbar',
    name: gettext('Statistics'),
    value: BAR_TYPE.STATISTICS,
    link: `${siteRoot}org/${BAR_TYPE.STATISTICS}/`,
    isActive: (bar) => bar === BAR_TYPE.STATISTICS,
  },
  [BAR_TYPE.PROJECTS]: {
    icon: 'projects-navbar',
    name: gettext('Projects'),
    value: BAR_TYPE.PROJECTS,
    link: `${siteRoot}org/${BAR_TYPE.PROJECTS}/`,
    isActive: (bar) => bar === BAR_TYPE.PROJECTS || bar === 'trash' || bar === 'search-projects',
  },
  [BAR_TYPE.USERS]: {
    icon: 'user-navbar',
    name: gettext('Users'),
    value: BAR_TYPE.USERS,
    link: `${siteRoot}org/users/`,
    isActive: (bar) => bar === BAR_TYPE.USERS || bar === 'admins' || bar === 'search-users',
  },
  [BAR_TYPE.GROUPS]: {
    icon: 'group-navbar',
    name: gettext('Groups'),
    value: BAR_TYPE.GROUPS,
    link: `${siteRoot}org/${BAR_TYPE.GROUPS}/`,
    isActive: (bar) => bar === BAR_TYPE.GROUPS,
  },
  [BAR_TYPE.SAML]: {
    icon: 'saml-config-navbar',
    name: gettext('SAML config'),
    value: BAR_TYPE.SAML,
    link: `${siteRoot}org/${BAR_TYPE.SAML}/`,
    isActive: (bar) => bar === BAR_TYPE.SAML,
  },
};

export const BARS = [
  BAR_CONFIG[BAR_TYPE.MANAGE],
  BAR_CONFIG[BAR_TYPE.SETTINGS],
  BAR_CONFIG[BAR_TYPE.STATISTICS],
  BAR_CONFIG[BAR_TYPE.PROJECTS],
  BAR_CONFIG[BAR_TYPE.USERS],
  BAR_CONFIG[BAR_TYPE.GROUPS],
  enableMultiSAML && canUseSAML ? BAR_CONFIG[BAR_TYPE.SAML] : null,
];

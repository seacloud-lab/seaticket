import { gettext, siteRoot, isDefaultAdmin, canViewSystemInfo, canManageUser, canManageGroup, multiTenancy,
  canManageOrganization,
} from '@/constants';

export const BAR_TYPE = {
  INFO: 'info',
  STATISTICS: 'statistics',
  PROJECTS: 'projects',
  USERS: 'users',
  GROUPS: 'groups',
  ORG: 'organizations',
};

export const BAR_CONFIG = {
  [BAR_TYPE.INFO]: {
    icon: 'info-navbar',
    name: gettext('Info'),
    value: BAR_TYPE.INFO,
    link: `${siteRoot}sys/${BAR_TYPE.INFO}/`,
    isActive: (bar) => bar === BAR_TYPE.INFO,
  },
  [BAR_TYPE.STATISTICS]: {
    icon: 'statistic-navbar',
    name: gettext('Statistics'),
    value: BAR_TYPE.STATISTICS,
    link: `${siteRoot}sys/${BAR_TYPE.STATISTICS}/`,
    isActive: (bar) => bar === BAR_TYPE.STATISTICS,
  },
  [BAR_TYPE.PROJECTS]: {
    icon: 'projects-navbar',
    name: gettext('Projects'),
    value: BAR_TYPE.PROJECTS,
    link: `${siteRoot}sys/all-projects/`,
    isActive: (bar) => bar === BAR_TYPE.PROJECTS || bar === 'trash-projects' || bar === 'search-projects' || bar === 'all-projects',
  },
  [BAR_TYPE.USERS]: {
    icon: 'user-navbar',
    name: gettext('Users'),
    value: BAR_TYPE.USERS,
    link: `${siteRoot}sys/users/`,
    isActive: (bar) => bar === BAR_TYPE.USERS || bar === 'search-users',
  },
  [BAR_TYPE.GROUPS]: {
    icon: 'group-navbar',
    name: gettext('Groups'),
    value: BAR_TYPE.GROUPS,
    link: `${siteRoot}sys/${BAR_TYPE.GROUPS}/`,
    isActive: (bar) => bar === BAR_TYPE.GROUPS || bar === 'search-groups',
  },
  [BAR_TYPE.ORG]: {
    icon: 'organizations-navbar',
    name: gettext('Organizations'),
    value: BAR_TYPE.ORG,
    link: `${siteRoot}sys/${BAR_TYPE.ORG}/`,
    isActive: (bar) => bar === BAR_TYPE.ORG,
  }
};

export const BARS = [
  canViewSystemInfo ? BAR_CONFIG[BAR_TYPE.INFO] : null,
  isDefaultAdmin ? BAR_CONFIG[BAR_TYPE.STATISTICS] : null,
  isDefaultAdmin ? BAR_CONFIG[BAR_TYPE.PROJECTS] : null,
  canManageUser ? BAR_CONFIG[BAR_TYPE.USERS] : null,
  canManageGroup ? BAR_CONFIG[BAR_TYPE.GROUPS] : null,
  multiTenancy && canManageOrganization ? BAR_CONFIG[BAR_TYPE.ORG] : null,
];

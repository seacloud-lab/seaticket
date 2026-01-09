import { gettext } from '@/constants';

export const BAR_TYPE = {
  CHAT: 'chat',
  SEARCH: 'search',
  TICKET: 'tickets',
  MY_TICKET: 'my-tickets',
  TRASH: 'tickets/trash',
  CONNECTION: 'connections',
  SETTINGS: 'settings',
  EXTERNAL_PORTAL: 'external-portal',
  KNOWLEDGE: 'knowledge-base',
  ANALYZE: 'analyze',
  TAGS: 'tickets/tags',
  TYPES: 'tickets/types',
  SUBSTATES: 'tickets/substates',
};

export const BAR_TYPE_CONFIG = {
  [BAR_TYPE.CHAT]: { key: BAR_TYPE.CHAT, name: gettext('Chat'), icon: 'chat' },
  [BAR_TYPE.SEARCH]: { key: BAR_TYPE.SEARCH, name: gettext('Search'), icon: 'search' },
  [BAR_TYPE.CONNECTION]: { key: BAR_TYPE.CONNECTION, name: gettext('Connections'), icon: 'connection' },
  [BAR_TYPE.SETTINGS]: { key: BAR_TYPE.SETTINGS, name: gettext('Settings'), icon: 'set-up' },
  [BAR_TYPE.EXTERNAL_PORTAL]: { key: BAR_TYPE.EXTERNAL_PORTAL, name: gettext('External portal'), icon: 'external-portal' },
  [BAR_TYPE.ANALYZE]: { key: BAR_TYPE.ANALYZE, name: gettext('Analyze'), icon: 'analyze' },
  [BAR_TYPE.KNOWLEDGE]: { key: BAR_TYPE.KNOWLEDGE, name: gettext('Knowledge base'), icon: 'knowledge-base' },
  [BAR_TYPE.TICKET]: { key: BAR_TYPE.TICKET, name: gettext('All tickets'), icon: 'all-tickets' },
  [BAR_TYPE.MY_TICKET]: { key: BAR_TYPE.MY_TICKET, name: gettext('My tickets'), icon: 'my-tickets' },
  [BAR_TYPE.TRASH]: { key: BAR_TYPE.TRASH, name: gettext('Trash') },
  [BAR_TYPE.TAGS]: { key: BAR_TYPE.TAGS, name: gettext('Manage tags') },
  [BAR_TYPE.TYPES]: { key: BAR_TYPE.TYPES, name: gettext('Manage types') },
  [BAR_TYPE.SUBSTATES]: { key: BAR_TYPE.SUBSTATES, name: gettext('Manage substates') },
};

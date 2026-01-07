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

export const BAR_TYPES = [
  { key: BAR_TYPE.CHAT, name: gettext('Chat'), icon: 'ask' },
  { key: BAR_TYPE.SEARCH, name: gettext('Search'), icon: 'search' },
  { key: BAR_TYPE.CONNECTION, name: gettext('Connections'), icon: 'connection' },
  { key: BAR_TYPE.SETTINGS, name: gettext('Settings'), icon: 'set-up' },
  { key: BAR_TYPE.EXTERNAL_PORTAL, name: gettext('External portal'), icon: 'external-portal' },
  { key: BAR_TYPE.ANALYZE, name: gettext('Analyze'), icon: 'analyze' },
  { key: BAR_TYPE.KNOWLEDGE, name: gettext('Knowledge base'), icon: 'knowledge-base' },
  { key: BAR_TYPE.TICKET, name: gettext('All tickets'), icon: 'all-tickets' },
  { key: BAR_TYPE.MY_TICKET, name: gettext('My tickets'), icon: 'my-tickets' },
  { key: BAR_TYPE.TRASH, name: gettext('Trash') },
  { key: BAR_TYPE.TAGS, name: gettext('Manage tags') },
  { key: BAR_TYPE.TYPES, name: gettext('Manage types') },
  { key: BAR_TYPE.SUBSTATES, name: gettext('Manage substates') }
];

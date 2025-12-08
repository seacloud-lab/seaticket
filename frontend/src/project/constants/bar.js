import { gettext } from '@/constants';

export const BAR_TYPE = {
  CHAT: 'chat',
  SEARCH: 'search',
  TICKET: 'tickets',
  MY_TICKET: 'my-tickets',
  CONNECTION: 'connections',
  SETTINGS: 'settings',
  KNOWLEDGE: 'knowledge-base',
};

export const BAR_TYPES = [
  { key: BAR_TYPE.CHAT, name: gettext('Chat'), icon: 'ask' },
  { key: BAR_TYPE.SEARCH, name: gettext('Search'), icon: 'search' },
  { key: BAR_TYPE.CONNECTION, name: gettext('Connections'), icon: 'connection' },
  { key: BAR_TYPE.SETTINGS, name: gettext('Settings'), icon: 'settings-thin' },
  { key: BAR_TYPE.KNOWLEDGE, name: gettext('Knowledge bases'), icon: 'knowledge-bases' },
  { key: BAR_TYPE.TICKET, name: gettext('All tickets'), icon: 'all-tickets' },
  { key: BAR_TYPE.MY_TICKET, name: gettext('My tickets'), icon: 'my-tickets' },
];

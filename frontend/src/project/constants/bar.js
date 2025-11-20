import { gettext } from '@/constants';

export const BAR_TYPE = {
  CHAT: 'chat',
  SEARCH: 'search',
  TICKET: 'tickets',
  CONNECTION: 'connections',
  SETTINGS: 'settings',
  KNOWLEDGE: 'knowledge-base',
};

export const BAR_TYPES = [
  { key: BAR_TYPE.CHAT, name: gettext('Chat'), icon: 'ask' },
  { key: BAR_TYPE.SEARCH, name: gettext('Search'), icon: 'search' },
  { key: BAR_TYPE.TICKET, name: gettext('Tickets'), icon: 'ticket' },
  { key: BAR_TYPE.CONNECTION, name: gettext('Connections'), icon: 'connection' },
  { key: BAR_TYPE.SETTINGS, name: gettext('Settings'), icon: 'settings-thin' },
  { key: BAR_TYPE.KNOWLEDGE, name: gettext('Knowledge base'), icon: 'knowledge-base' },
];

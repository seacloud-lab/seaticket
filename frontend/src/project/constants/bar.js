import { gettext } from '../../constants';

export const BAR_TYPE = {
  ASK: 'ask',
  SEARCH: 'search',
  TICKET: 'tickets',
  CONNECTION: 'connections'
};

export const BAR_TYPES = [
  { key: BAR_TYPE.ASK, name: gettext('Ask'), icon: 'ask' },
  { key: BAR_TYPE.SEARCH, name: gettext('Search'), icon: 'search' },
  { key: BAR_TYPE.TICKET, name: gettext('Tickets'), icon: 'ticket' },
  { key: BAR_TYPE.CONNECTION, name: gettext('Connections'), icon: 'connection' },
];

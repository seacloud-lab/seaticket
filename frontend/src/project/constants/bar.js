import { gettext } from '../../constants';

export const BAR_TYPE = {
  ASK: 'ask',
  SEARCH: 'search',
  TICKETS: 'tickets',
};

export const BAR_TYPES = [
  { key: BAR_TYPE.ASK, name: gettext('Ask'), icon: 'ask' },
  { key: BAR_TYPE.SEARCH, name: gettext('Search'), icon: 'search' },
  { key: BAR_TYPE.TICKETS, name: gettext('Tickets'), icon: 'ticket' }
];

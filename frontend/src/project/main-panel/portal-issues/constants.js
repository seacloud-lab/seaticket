import { gettext } from '@/constants';

import {
  TICKET_STATE,
  TICKET_STATE_OPTIONS,
  PREDEFINED_TICKET_COLUMN_NAME,
  PREDEFINED_TICKET_SUBSTATE_OPTION,
  TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_COLUMNS_ORDER_CONFIG,
  TICKET_COLUMNS_WIDTH_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS,
  AUTO_UPDATE_PARTICIPANTS_KEY,
} from '../tickets/constants';

export const PORTAL_ISSUE_STATE = TICKET_STATE;

export const PORTAL_ISSUE_STATE_CONFIG = {
  [PORTAL_ISSUE_STATE.OPEN]: {
    value: PORTAL_ISSUE_STATE.OPEN,
    icon: 'dot-circle-stroked',
    statusName: gettext('Open'), // Applied to ticket status display
    shortName: gettext('Open'), // Applied to status toggle btn
  },
  [PORTAL_ISSUE_STATE.CLOSED]: {
    value: PORTAL_ISSUE_STATE.CLOSED,
    icon: 'check-circle-stroked',
    statusName: gettext('Close'),
    shortName: gettext('Close issue'),
  }
};

export const PORTAL_ISSUE_STATE_OPTIONS = TICKET_STATE_OPTIONS;

export const PREDEFINED_PORTAL_ISSUE_SUBSTATE_OPTION = PREDEFINED_TICKET_SUBSTATE_OPTION;

export const PORTAL_ISSUE_PAGE_SLUG_ID = {
  ALL: 'all',
  TYPES: 'types',
  SUBSTATES: 'substates',
  TRASH: 'trash',
};

export const PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID = {
  ALL: 'all',
};

export const PREDEFINED_PORTAL_ISSUE_COLUMN_NAME = PREDEFINED_TICKET_COLUMN_NAME;

export const PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG = {
  ...TICKET_PREDEFINED_COLUMN_CONFIG,

};

export const PORTAL_ISSUE_NOT_DISPLAY_COLUMNS = TICKET_NOT_DISPLAY_COLUMNS;

export const PORTAL_ISSUE_COLUMNS_ORDER_CONFIG = TICKET_COLUMNS_ORDER_CONFIG;

export const PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG = TICKET_COLUMNS_WIDTH_CONFIG;

export const PORTAL_ISSUE_TABLE_NAME = 'portal_issues';

export const PORTAL_ISSUE_TYPE = 'portal_issue';

export {
  AUTO_UPDATE_PARTICIPANTS_KEY,
};

import { gettext } from '@/constants';
import CellType from '@/sea-metadata/constants/column/type';

import {
  TICKET_STATE,
  TICKET_STATE_OPTIONS,
  PREDEFINED_TICKET_COLUMN_NAME,
  PREDEFINED_TICKET_SUBSTATE_OPTION,
  TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS,
  TICKET_TABLE_NAME,
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

export const PREDEFINED_PORTAL_ISSUE_COLUMN_NAME = {
  ...PREDEFINED_TICKET_COLUMN_NAME,
  LINKED_TICKET: 'linked_ticket'
};

export const PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG = {
  ...TICKET_PREDEFINED_COLUMN_CONFIG,
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.ASSIGNEES]: undefined,
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PARTICIPANTS]: undefined,
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.DUE_DATE]: undefined,
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET]: {
    type: CellType.LINK,
    display_name: gettext('Linked ticket'),
    data: {
      linked_table: TICKET_TABLE_NAME,
    },
    editable: false,
  }
};

export const PORTAL_ISSUE_NOT_DISPLAY_COLUMNS = [
  ...TICKET_NOT_DISPLAY_COLUMNS,
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.ASSIGNEES,
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PARTICIPANTS,
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.DUE_DATE,
];

export const PORTAL_ISSUE_COLUMNS_ORDER_CONFIG = {
  'priority': 1,
  'title': 2,
  'type': 3,
  'state': 4,
  'substate': 5,
  'tags': 6,
  'linked_ticket': 7,
  'content': 8,
  'ai_summary': 9,
  'ai_processed_time': 10,
  'creator': 11,
  'created_time': 12,
  'modified_time': 13,
  'closed_time': 14,
};

export const PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG = {
  'priority': 33,
  'title': 400,
  'type': 120,
  'state': 120,
  'substate': 120,
  'tags': 200,
  'linked_ticket': 200,
  'content': 400,
  'ai_summary': 200,
  'ai_processed_time': 200,
  'creator': 200,
  'created_time': 200,
  'modified_time': 200,
  'closed_time': 200,
};

export const PORTAL_ISSUE_TABLE_NAME = 'portal_issues';

export const PORTAL_ISSUE_TYPE = 'portal_issue';

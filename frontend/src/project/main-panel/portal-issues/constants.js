import { gettext } from '@/constants';
import CellType from '@/sea-metadata/constants/column/type';
import { TICKET_TABLE_NAME } from '../tickets/constants';

export const PORTAL_ISSUE_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
};

export const PORTAL_ISSUE_STATUS_OPTIONS = [
  { id: 'open', name: 'open', display_name: gettext('Open'), text_color: '#FFF', color: '#1a7f37', border_color: '#1a7f37' },
  { id: 'closed', name: 'closed', display_name: gettext('Closed'), text_color: '#FFF', color: '#8250df', border_color: '#8250df' },
];

export const PORTAL_ISSUE_PAGE_SLUG_ID = {
  ALL: 'all',
  TYPES: 'types',
  SUBSTATES: 'substates',
  TRASH: 'trash',
};

export const PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID = {
  ALL: 'all',
};

export const PORTAL_ISSUE_TABLE_NAME = 'portal_issues';

export const PREDEFINED_PORTAL_ISSUE_COLUMN_NAME = {
  PK: '_pk',
  PRIORITY: 'priority',
  TITLE: 'title',
  TYPE: 'type',
  SUBSTATE: 'substate',
  ASSIGNEES: 'assignees',
  PARTICIPANTS: 'participants',
  TAGS: 'tags',
  CONTENT: 'content',
  CREATOR: 'creator',
  STATE: 'state',
  LINKED_TICKET: 'linked_ticket',
  CREATED_TIME: 'created_time',
  MODIFIED_TIME: 'modified_time',
  CLOSED_TIME: 'closed_time',
  DUE_DATE: 'due_date',
  COMMENT_COUNT: 'comment_count',
  DELETED: 'deleted',
};

export const PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG = {
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PRIORITY]: {
    type: CellType.PRIORITY,
    display_name: gettext('Priority'),
    editable: true,
    is_width_fixed: true,
    frozen: true,
    width: 33,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE]: {
    type: CellType.TEXT,
    display_name: gettext('Title'),
    is_name_column: true,
    frozen: true,
    editable: false,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TYPE]: {
    type: CellType.TYPE,
    display_name: gettext('Type'),
    editable: true,
    modify_data_able: true,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.SUBSTATE]: {
    type: CellType.SINGLE_SELECT,
    display_name: gettext('Substate'),
    editable: true,
    is_predefined: false,
    modify_data_able: true,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.ASSIGNEES]: {
    type: CellType.COLLABORATOR,
    display_name: gettext('Assignees'),
    editable: true,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PARTICIPANTS]: {
    type: CellType.COLLABORATOR,
    display_name: gettext('Participants'),
    editable: true,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TAGS]: {
    type: CellType.TAGS,
    display_name: gettext('Tags'),
    editable: true,
    modify_data_able: true,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.CONTENT]: {
    type: CellType.LONG_TEXT,
    display_name: gettext('Content'),
    editable: false,
    is_hover_show_content: true,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.CREATOR]: {
    type: CellType.TEXT,
    display_name: gettext('Creator'),
    editable: false,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.STATE]: {
    type: CellType.SINGLE_SELECT,
    display_name: gettext('State'),
    editable: true,
    data: {
      options: PORTAL_ISSUE_STATUS_OPTIONS
    }
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET]: {
    type: CellType.LINK,
    display_name: gettext('Linked ticket'),
    editable: false,
    data: {
      linked_table: TICKET_TABLE_NAME,
    },
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.CREATED_TIME]: {
    type: CellType.CTIME,
    display_name: gettext('Created time'),
    editable: false,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.MODIFIED_TIME]: {
    type: CellType.MTIME,
    display_name: gettext('Last modified time'),
    editable: false,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.CLOSED_TIME]: {
    type: CellType.MTIME,
    display_name: gettext('Closed time'),
    editable: false,
  },
  [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.DUE_DATE]: {
    type: CellType.DATE,
    display_name: gettext('Due date'),
    editable: true,
    modify_data_able: true,
  },
};

export const PORTAL_ISSUE_NOT_DISPLAY_COLUMNS = [
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PK,
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.COMMENT_COUNT,
  PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.DELETED,
];

export const PORTAL_ISSUE_COLUMNS_ORDER_CONFIG = {
  'priority': 1,
  'title': 2,
  'type': 3,
  'state': 4,
  'substate': 5,
  'assignees': 6,
  'participants': 7,
  'tags': 8,
  'linked_ticket': 9,
  'content': 10,
  'creator': 11,
  'created_time': 12,
  'modified_time': 13,
  'closed_time': 14,
  'due_date': 15,
};

export const PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG = {
  'priority': 33,
  'title': 400,
  'type': 120,
  'state': 120,
  'substate': 120,
  'assignees': 200,
  'participants': 200,
  'tags': 200,
  'linked_ticket': 150,
  'content': 400,
  'creator': 200,
  'created_time': 200,
  'modified_time': 200,
  'closed_time': 200,
  'due_date': 180,
};

export const PORTAL_ISSUE_TYPE = 'portal_issue';

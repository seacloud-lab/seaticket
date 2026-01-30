import { gettext } from '@/constants';
import CellType from '@/sea-metadata/constants/column/type';

export const TICKET_STATE = {
  OPEN: '0001',
  CLOSED: '0002'
};

export const PREDEFINED_TICKET_COLUMN_NAME = {
  PK: '_pk',
  PRIORITY: 'priority',
  DUE_DATE: 'due_date',
  TITLE: 'title',
  STATE: 'state',
  SUB_STATE: 'substate',
  TYPE: 'type',
  CONTENT: 'content',
  AI_SUMMARY: 'ai_summary',
  AI_PROCESSED_TIME: 'ai_processed_time',
  ASSIGNEES: 'assignees',
  TAGS: 'tag_ids',
  PARTICIPANTS: 'participants',
  CREATED_TIME: 'created_time',
  MODIFIED_TIME: 'modified_time',
  CLOSED_TIME: 'closed_time',
  CREATOR: 'creator',
  DELETED: 'deleted',
  COMMENT_COUNT: 'comment_count',
};

export const TICKET_STATE_CONFIG = {
  [TICKET_STATE.OPEN]: {
    value: TICKET_STATE.OPEN,
    icon: 'dot-circle-stroked',
    statusName: gettext('Open'), // Applied to ticket status display
    shortName: gettext('Open'), // Applied to status toggle btn
  },
  [TICKET_STATE.CLOSED]: {
    value: TICKET_STATE.CLOSED,
    icon: 'check-circle-stroked',
    statusName: gettext('Close'),
    shortName: gettext('Close ticket'),
  }
};

export const TICKET_STATE_OPTIONS = [
  { id: '0001', name: 'open', display_name: gettext('Open'), text_color: '#FFF', color: '#1a7f37', border_color: '#1a7f37' },
  { id: '0002', name: 'closed', display_name: gettext('Closed'), text_color: '#FFF', color: '#8250df', border_color: '#8250df' },
];

export const PREDEFINED_TICKET_SUBSTATE_OPTION = {
  '0010': {
    name: gettext('New'),
    description: gettext('New'),
    text_color: '#FFF',
    color: '#1a7f37',
    border_color: '#59CB74',
  },
  '0011': {
    name: gettext('Working on'),
    description: gettext('In progress'),
    text_color: '#FFF',
    color: '#1a7f37',
    border_color: '#46A1FD',
  },
  '0012': {
    name: gettext('Backlog'),
    description: gettext('To be worked on'),
    text_color: '#FFF',
    color: '#9c9c9e',
    border_color: '#9c9c9e',
  },
  '0013': {
    name: gettext('Waiting on user'),
    description: gettext('Waiting on user'),
    text_color: '#FFF',
    color: '#EAA775',
    border_color: '#EAA775',
  },
  '0014': {
    name: gettext('Completed'),
    description: gettext('Done, closed, fixed, resolved'),
    text_color: '#FFF',
    color: '#8250df',
    border_color: '#8250df',
  },
  '0015': {
    name: gettext('Not planned'),
    description: gettext('Won\'t fix, can\'t repro, stale'),
    text_color: '#FFF',
    color: '#59636e',
    border_color: '#59636e',
  },
  '0016': {
    name: gettext('Duplicate'),
    description: gettext('Duplicate of another ticket'),
    text_color: '#FFF',
    color: '#59636e',
    border_color: '#59636e',
  },
};

export const TICKET_PAGE_SLUG_ID = {
  ALL: 'all',
  NEW: 'new',
  TAGS: 'tags',
  TYPES: 'types',
  SUBSTATES: 'substates',
};

export const TICKET_CHILDREN_PAGE_SLUG_ID = {
  ALL: 'all',
};

export const TICKET_PREDEFINED_COLUMN_CONFIG = {
  [PREDEFINED_TICKET_COLUMN_NAME.PRIORITY]: {
    type: CellType.PRIORITY,
    display_name: gettext('Priority'),
    editable: true,
    is_width_fixed: true,
    frozen: true,
    width: 33,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.TITLE]: {
    type: CellType.TEXT,
    display_name: gettext('Title'),
    editable: false,
    is_name_column: true,
    frozen: true,
    is_required: true,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.STATE]: {
    type: CellType.SINGLE_SELECT,
    display_name: gettext('State'),
    editable: true,
    is_required: true,
    data: {
      options: TICKET_STATE_OPTIONS
    }
  },
  [PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE]: {
    type: CellType.SINGLE_SELECT,
    display_name: gettext('Substate'),
    editable: true,
    is_predefined: false,
    modify_data_able: true,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.TYPE]: {
    type: CellType.TYPE,
    display_name: gettext('Type'),
    editable: true,
    modify_data_able: true,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.CONTENT]: {
    type: CellType.LONG_TEXT,
    display_name: gettext('Content'),
    editable: true,
    is_required: true,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.AI_SUMMARY]: {
    type: CellType.TEXT,
    display_name: gettext('AI Summary'),
    editable: false,
    is_hover_show_content: true,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.AI_PROCESSED_TIME]: {
    type: CellType.DATE,
    display_name: gettext('AI processed time'),
    editable: false,
    data: { format: 'YYYY-MM-DD HH:mm:ss' },
  },
  [PREDEFINED_TICKET_COLUMN_NAME.ASSIGNEES]: {
    type: CellType.COLLABORATOR,
    display_name: gettext('Assignees'),
    editable: true,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.TAGS]: {
    type: CellType.TAGS,
    display_name: gettext('Tags'),
    editable: true,
    modify_data_able: true,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.PARTICIPANTS]: {
    type: CellType.COLLABORATOR,
    display_name: gettext('Participants'),
    editable: false,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.CREATED_TIME]: {
    type: CellType.CTIME,
    display_name: gettext('Created time'),
    editable: false,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.MODIFIED_TIME]: {
    type: CellType.MTIME,
    display_name: gettext('Last modified time'),
    editable: false,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.CLOSED_TIME]: {
    type: CellType.MTIME,
    display_name: gettext('Closed time'),
    editable: false,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.CREATOR]: {
    type: CellType.CREATOR,
    display_name: gettext('Creator'),
    editable: false,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.DELETED]: {
    type: CellType.CHECKBOX,
    display_name: gettext('Deleted'),
    editable: false,
  },
  [PREDEFINED_TICKET_COLUMN_NAME.DUE_DATE]: {
    type: CellType.DATE,
    display_name: gettext('Due date'),
    editable: true,
    modify_data_able: true,
  }
};

export const TICKET_NOT_DISPLAY_COLUMNS = [
  PREDEFINED_TICKET_COLUMN_NAME.PK,
  PREDEFINED_TICKET_COLUMN_NAME.COMMENT_COUNT,
];

export const TICKET_COLUMNS_ORDER_CONFIG = {
  'priority': 1,
  'title': 2,

  'type': 3,
  'state': 4,
  'substate': 5,

  'assignees': 6,
  'participants': 7,
  'tags': 8,

  'content': 9,
  'ai_summary': 10,
  'ai_processed_time': 11,
  'creator': 12,
  'created_time': 13,
  'modified_time': 14,
  'closed_time': 15,
  'due_date': 16,
};

export const TICKET_COLUMNS_WIDTH_CONFIG = {
  'priority': 33,
  'title': 400,

  'type': 120,
  'state': 120,
  'substate': 120,

  'assignees': 200,
  'participants': 200,
  'tags': 200,

  'content': 400,
  'ai_summary': 200,
  'ai_processed_time': 200,
  'creator': 200,
  'created_time': 200,
  'modified_time': 200,
  'closed_time': 200,
};

export const TICKET_TYPE = 'ticket';

export const TICKET_TABLE_NAME = 'tickets';

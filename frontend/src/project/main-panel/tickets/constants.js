import { gettext } from '@/constants';
import { CellType } from '@/sea-metadata';

export const TICKET_STATE = {
  OPEN: '0001',
  CLOSED: '0002'
};

export const TICKET_STATE_CONFIG = {
  [TICKET_STATE.OPEN]: {
    value: TICKET_STATE.OPEN,
    icon: 'circle-dot',
    statusName: gettext('Open'), // Applied to ticket status display
    shortName: gettext('Open'), // Applied to status toggle btn
    name: gettext('Open'), // Applied to status editor
  },
  [TICKET_STATE.CLOSED]: {
    value: TICKET_STATE.CLOSED,
    icon: 'circle-check',
    statusName: gettext('Close'),
    shortName: gettext('Close ticket'),
    name: gettext('Close'),
    description: gettext('Done, closed, fixed, resolved'),
  }
};

export const TICKET_STATE_OPTIONS = [
  { id: '0001', name: 'open', display_name: gettext('Open'), text_color: '#FFF', color: '#1a7f37', border_color: '#1a7f37' },
  { id: '0002', name: 'closed', display_name: gettext('Closed'), text_color: '#FFF', color: '#8250df', border_color: '#8250df' },
];

export const TICKET_SUBSTATE_OPTIONS = [
  { id: '0010', name: gettext('New'), text_color: '#FFF', color: '#1a7f37', border_color: '#59CB74' },
  { id: '0011', name: gettext('Reopen'), text_color: '#FFF', color: '#1a7f37', border_color: '#1a7f37' },
  { id: '0012', name: gettext('Working on'), text_color: '#FFF', color: '#1a7f37', border_color: '#46A1FD' },
  { id: '0013', name: gettext('Completed'), text_color: '#FFF', color: '#8250df', border_color: '#8250df' },
  { id: '0014', name: gettext('Not planned'), text_color: '#FFF', color: '#59636e', border_color: '#59636e' },
  { id: '0015', name: gettext('Duplicate'), text_color: '#FFF', color: '#59636e', border_color: '#59636e' },
];

export const PREDEFINED_TICKET_TAG_NAME = {
  BUG: '_bug',
  DOCUMENTATION: '_documentation',
  DUPLICATE: '_duplicate',
  ENHANCEMENT: '_enhancement',
  GOOD_FIRST_TICKET: '_good_first_ticket',
  HELP_WANTED: '_help_wanted',
  INVALID: '_invalid',
  QUESTION: '_question',
  WONTFIX: '_wontfix',
};

export const PREDEFINED_TICKET_TAG_NAMES = [
  PREDEFINED_TICKET_TAG_NAME.BUG,
  PREDEFINED_TICKET_TAG_NAME.DOCUMENTATION,
  PREDEFINED_TICKET_TAG_NAME.DUPLICATE,
  PREDEFINED_TICKET_TAG_NAME.ENHANCEMENT,
  PREDEFINED_TICKET_TAG_NAME.GOOD_FIRST_TICKET,
  PREDEFINED_TICKET_TAG_NAME.HELP_WANTED,
  PREDEFINED_TICKET_TAG_NAME.INVALID,
  PREDEFINED_TICKET_TAG_NAME.QUESTION,
  PREDEFINED_TICKET_TAG_NAME.WONTFIX,
];

export const PREDEFINED_TICKET_TAG = {
  [PREDEFINED_TICKET_TAG_NAME.BUG]: {
    name: gettext('Bug'),
    description: gettext('Something isn\'t working'),
    color: '#F4667C',
    text_color: '#FFF',
  },
  [PREDEFINED_TICKET_TAG_NAME.DOCUMENTATION]: {
    name: gettext('Documentation'),
    description: gettext('Improvements or additions to documentation'),
    color: '#46A1FD',
    text_color: '#FFF',
  },
  [PREDEFINED_TICKET_TAG_NAME.DUPLICATE]: {
    name: gettext('Duplicate'),
    description: gettext('This ticket or pull request already exists'),
    color: '#C2C2C2',
    text_color: '#FFF',
  },
  [PREDEFINED_TICKET_TAG_NAME.ENHANCEMENT]: {
    name: gettext('Enhancement'),
    description: gettext('New feature or request'),
    color: '#4ECCCB',
    text_color: '#FFF',
  },
  [PREDEFINED_TICKET_TAG_NAME.GOOD_FIRST_TICKET]: {
    name: gettext('Good first ticket'),
    description: gettext('Good for newcomers'),
    color: '#9860E5',
    text_color: '#FFF',
  },
  [PREDEFINED_TICKET_TAG_NAME.HELP_WANTED]: {
    name: gettext('Help wanted'),
    description: gettext('Extra attention is needed'),
    color: '#59CB74',
    text_color: '#FFF',
  },
  [PREDEFINED_TICKET_TAG_NAME.INVALID]: {
    name: gettext('Invalid'),
    description: gettext('This doesn\'t seem right'),
    color: '#FFFCB5',
    TEXT_COLOR: '#212529',
  },
  [PREDEFINED_TICKET_TAG_NAME.QUESTION]: {
    name: gettext('Question'),
    description: gettext('Further information is requested'),
    color: '#DC82D2',
    TEXT_COLOR: '#FFF',
  },
  [PREDEFINED_TICKET_TAG_NAME.WONTFIX]: {
    name: gettext('Wontfix'),
    description: gettext('This will not be worked on'),
    color: '#E9E9E9',
    TEXT_COLOR: '#212529',
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
  'priority': {
    type: CellType.PRIORITY,
    display_name: gettext('Priority'),
    editable: true,
    is_width_fixed: true,
    frozen: true,
    width: 33,
  },
  'title': {
    type: CellType.TEXT,
    display_name: gettext('Title'),
    editable: false,
    is_name_column: true,
    frozen: true,
    is_required: true,
  },
  'state': {
    type: CellType.SINGLE_SELECT,
    display_name: gettext('State'),
    editable: true,
    is_required: true,
    data: {
      options: TICKET_STATE_OPTIONS
    }
  },
  'type': {
    type: CellType.TYPE,
    display_name: gettext('Type'),
    editable: true,
    modify_data_able: true,
  },
  'substate': {
    type: CellType.SINGLE_SELECT,
    display_name: gettext('Substate'),
    editable: true,
    is_predefined: false,
    modify_data_able: true,
  },
  'content': {
    type: CellType.LONG_TEXT,
    display_name: gettext('Description'),
    editable: true,
    is_required: true,
  },
  'assignees': {
    type: CellType.COLLABORATOR,
    display_name: gettext('Assignees'),
    editable: true,
  },
  'tags': {
    type: CellType.TAGS,
    display_name: gettext('Tags'),
    editable: true,
    modify_data_able: true,
  },
  'participants': {
    type: CellType.COLLABORATOR,
    display_name: gettext('Participants'),
    editable: false,
  },
  'created_time': {
    type: CellType.CTIME,
    display_name: gettext('Create time'),
    editable: false,
  },
  'modified_time': {
    type: CellType.MTIME,
    display_name: gettext('Last updated time'),
    editable: false,
  },
  'creator': {
    type: CellType.CREATOR,
    display_name: gettext('Creator'),
    editable: false,
  },
  'deleted': {
    type: CellType.CHECKBOX,
    display_name: gettext('Deleted'),
    editable: false,
  }
};

export const TICKET_NOT_DISPLAY_COLUMNS = [
  '_pk',
  'reply_count',
  'client_token',
];

export const TICKET_COLUMNS = [
];

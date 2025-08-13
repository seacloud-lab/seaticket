import { gettext } from '../../constants';

export const TICKET_STATUS = {
  OPEN: 'open',
  REOPEN: 're_open',
  COMPLETED: 'completed',
  NOT_PLANNED: 'not_planned',
  DUPLICATE: 'duplicate',
};

export const TICKET_OPENED_STATUS = [
  '',
  TICKET_STATUS.REOPEN,
  TICKET_STATUS.OPEN,
];

export const TICKET_CLOSED_STATUS = [
  TICKET_STATUS.COMPLETED,
  TICKET_STATUS.NOT_PLANNED,
  TICKET_STATUS.DUPLICATE,
];

export const TICKET_STATUS_CONFIG = {
  [TICKET_STATUS.OPEN]: {
    value: TICKET_STATUS.OPEN,
    icon: 'circle-dot',
    statusName: gettext('Open'), // Applied to ticket status display
    shortName: gettext('Open'), // Applied to status toggle btn
    name: gettext('Open'), // Applied to status editor
  },
  [TICKET_STATUS.REOPEN]: {
    value: TICKET_STATUS.REOPEN,
    icon: 'loop-dot',
    statusName: gettext('Reopen'),
    shortName: gettext('Reopen ticket'),
    name: gettext('Reopen ticket'),
  },
  [TICKET_STATUS.COMPLETED]: {
    value: TICKET_STATUS.COMPLETED,
    icon: 'circle-check',
    statusName: gettext('Close'),
    shortName: gettext('Close ticket'),
    name: gettext('Close as completed'),
    description: gettext('Done, closed, fixed, resolved'),
  },
  [TICKET_STATUS.NOT_PLANNED]: {
    value: TICKET_STATUS.NOT_PLANNED,
    icon: 'circle-invalid',
    statusName: gettext('Not planned'),
    shortName: gettext('Close ticket'),
    name: gettext('Close as not planned'),
    description: gettext('Won\'t fix, can\'t repro, stale'),
  },
  [TICKET_STATUS.DUPLICATE]: {
    value: TICKET_STATUS.DUPLICATE,
    icon: 'circle-invalid',
    statusName: gettext('Duplicate'),
    shortName: gettext('Close as duplicate'),
    name: gettext('Close as duplicate'),
    description: gettext('Duplicate of another ticket'),
  }
};

export const TICKET_STATUS_OPTIONS = [
  { id: TICKET_STATUS.OPEN, value: TICKET_STATUS.OPEN, name: gettext('Open'), textColor: '#FFF', color: '#1a7f37', borderColor: '#1a7f37' },
  { id: TICKET_STATUS.COMPLETED, value: TICKET_STATUS.COMPLETED, name: gettext('Completed'), textColor: '#FFF', color: '#8250df', borderColor: '#8250df' },
  { id: TICKET_STATUS.NOT_PLANNED, value: TICKET_STATUS.NOT_PLANNED, name: gettext('Not planned'), textColor: '#FFF', color: '#59636e', borderColor: '#59636e' },
  { id: TICKET_STATUS.DUPLICATE, value: TICKET_STATUS.DUPLICATE, name: gettext('Duplicate'), textColor: '#FFF', color: '#59636e', borderColor: '#59636e' },
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

export const TICKET_TYPES = [
  { id: 'bug', value: 'bug', name: gettext('Bug'), textColor: '#FFF', color: '#F4667C', borderColor: '#DC556A' },
  { id: 'feature', value: 'feature', name: gettext('Feature'), textColor: '#FFF', color: '#46A1FD', borderColor: '#3C8FE4' },
  { id: 'request', value: 'request', name: gettext('Request'), textColor: '#212529', color: '#FFFCB5', borderColor: '#E8E79D' },
  { id: 'support', value: 'support', name: gettext('Support'), textColor: '#212529', color: '#DDFFE6', borderColor: '#BBEBCD' },
];

export const TICKET_PAGE_TYPE = {
  ALL: 'all',
  NEW: 'new',
  TAGS: 'tags',
};

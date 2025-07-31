import { gettext } from '../../constants';

export const TICKET_STATUS = {
  OPEN: 'open',
  COMPLETE: 'completed',
  NOT_PLANNED: 'not planned',
  DUPLICATE: 'duplicate',
};

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
  { id: 'bug', value: 'bug', name: gettext('Bug'), color: '#FFF', bgColor: '#F4667C', borderColor: '#DC556A' },
  { id: 'feature', value: 'feature', name: gettext('Feature'), color: '#FFF', bgColor: '#46A1FD', borderColor: '#3C8FE4' },
  { id: 'request', value: 'request', name: gettext('Request'), color: '#212529', bgColor: '#FFFCB5', borderColor: '#E8E79D' },
  { id: 'support', value: 'support', name: gettext('Support'), color: '#212529', bgColor: '#DDFFE6', borderColor: '#BBEBCD' },
];

export const TICKET_PAGE_TYPE = {
  ALL: 'all',
  NEW: 'new',
  TAGS: 'tags',
};

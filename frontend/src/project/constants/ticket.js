import { gettext } from '../../constants';

export const TICKET_STATUS = {
  OPEN: 'open',
  COMPLETE: 'completed',
  NOT_PLANNED: 'not planned',
  DUPLICATE: 'duplicate',
};

export const TICKET_TAG = {
  BUG: 'bug',
  DOCUMENTATION: 'documentation',
  DUPLICATE: 'duplicate',
  ENHANCEMENT: 'enhancement',
  GOOD_FIRST_ISSUE: 'good first issue',
  HELP_WANTED: 'help wanted',
  INVALID: 'invalid',
  QUESTION: 'question',
  WONTFIX: 'wontfix',
};

export const TICKET_TYPES = [
  { id: 'bug', name: gettext('bug'), color: '#FFF', bgColor: '#F4667C', borderColor: '#DC556A' },
  { id: 'feature', name: gettext('Feature'), color: '#FFF', bgColor: '#46A1FD', borderColor: '#3C8FE4' },
  { id: 'request', name: gettext('Request'), color: '#212529', bgColor: '#FFFCB5', borderColor: '#E8E79D' },
  { id: 'support', name: gettext('Support'), color: '#212529', bgColor: '#DDFFE6', borderColor: '#BBEBCD' },
];

export const TICKET_PAGE_TYPE = {
  ALL: 'all',
  NEW: 'new',
};

import { gettext } from '@/constants';

export const PORTAL_PAGE = {
  SUBMIT_ISSUE: 'submit-issue',
  MY_ISSUES: 'my-issues',
  KNOWLEDGE_BASE: 'knowledge-base',
  CHAT: 'chat',
};

export const SOURCE_TYPE_OPTIONS = [
  { value: 'site', label: 'Site' },
  { value: 'seafile', label: 'Seafile' },
  { value: 'knowledge_base', label: 'Knowledge Base' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'github_issue', label: 'GitHub Issues' },
  { value: 'discourse_forum', label: 'Discourse Forum' },
  { value: 'email', label: 'Email' },
];

export const TICKETS_TAB = 'tickets';

export const BASE_PRIMARY_TABS = [
  { value: PORTAL_PAGE.CHAT, label: gettext('Chat') },
  { value: TICKETS_TAB, label: gettext('Issues') },
];

export const TICKET_SECONDARY_TABS = [
  { value: PORTAL_PAGE.SUBMIT_ISSUE, label: gettext('Submit issue') },
  { value: PORTAL_PAGE.MY_ISSUES, label: gettext('My issues') },
];

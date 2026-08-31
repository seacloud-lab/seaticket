import { gettext } from '@/constants';

export const PORTAL_PAGE = {
  HOME: 'home',
  SUBMIT_ISSUE: 'submit-issue',
  MY_ISSUES: 'my-issues',
  TEAM_ISSUES: 'team-issues',
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

export const HOME_TAB = {
  value: PORTAL_PAGE.HOME,
  label: gettext('Home'),
};

export const CHAT_TAB = {
  value: PORTAL_PAGE.CHAT,
  label: gettext('Chat'),
};

export const ISSUES_TAB = {
  value: TICKETS_TAB,
  label: gettext('Issues'),
};

export const TICKET_SECONDARY_TABS = [
  { value: PORTAL_PAGE.SUBMIT_ISSUE, label: gettext('Submit issue') },
  { value: PORTAL_PAGE.MY_ISSUES, label: gettext('My issues') },
  { value: PORTAL_PAGE.TEAM_ISSUES, label: gettext('Team issues') },
];

export const getPrimaryTabs = ({ isAnonymous, canAccessIssues = true }) => {
  const tabs = isAnonymous || !canAccessIssues ? [HOME_TAB, CHAT_TAB] : [HOME_TAB, CHAT_TAB, ISSUES_TAB];
  return tabs;
};

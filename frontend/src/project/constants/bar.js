import { gettext } from '@/constants';

export const BAR_TYPE = {
  CHAT: 'chat',
  AGENT: 'agent',
  SEARCH: 'search',
  TICKET: 'tickets',
  MY_TICKET: 'my-tickets',
  NEW_TICKET: 'new-ticket',
  TRASH: 'tickets/trash',
  CONNECTION: 'connections',
  SETTINGS: 'settings',
  SUPPORT_PORTAL: 'support-portal',
  INBOX: 'inbox',
  KNOWLEDGE: 'knowledge-base',
  KNOWLEDGE_TRASH: 'knowledge/trash',
  ANALYZE: 'analyze',
  TAGS: 'tags',
  TYPES: 'tickets/types',
  SUBSTATES: 'tickets/substates',
};

export const BAR_TYPE_CONFIG = {
  [BAR_TYPE.CHAT]: {
    key: BAR_TYPE.CHAT,
    name: gettext('Chat'),
    icon: 'chat'
  },
  [BAR_TYPE.AGENT]: {
    key: BAR_TYPE.AGENT,
    name: gettext('Agent'),
    icon: 'ai-processing'
  },
  [BAR_TYPE.SEARCH]: {
    key: BAR_TYPE.SEARCH,
    name: gettext('Search'),
    icon: 'search'
  },
  [BAR_TYPE.CONNECTION]: {
    key: BAR_TYPE.CONNECTION,
    name: gettext('Connections'),
    icon: 'connection'
  },
  [BAR_TYPE.SETTINGS]: {
    key: BAR_TYPE.SETTINGS,
    name: gettext('Settings'),
    icon: 'set-up'
  },
  [BAR_TYPE.SUPPORT_PORTAL]: {
    key: BAR_TYPE.SUPPORT_PORTAL,
    name: gettext('Support portal'),
    icon: 'support-portal'
  },
  [BAR_TYPE.ANALYZE]: {
    key: BAR_TYPE.ANALYZE,
    name: gettext('Analyze'),
    icon: 'analyze'
  },
  [BAR_TYPE.KNOWLEDGE]: {
    key: BAR_TYPE.KNOWLEDGE,
    name: gettext('Knowledge base'),
    icon: 'knowledge-base'
  },
  [BAR_TYPE.KNOWLEDGE_TRASH]: {
    key: BAR_TYPE.KNOWLEDGE_TRASH,
    name: gettext('Trash'),
    icon: 'trash',
  },
  [BAR_TYPE.TICKET]: {
    key: BAR_TYPE.TICKET,
    name: gettext('All tickets'),
    icon: 'all-tickets'
  },
  [BAR_TYPE.MY_TICKET]: {
    key: BAR_TYPE.MY_TICKET,
    name: gettext('My tickets'),
    icon: 'my-tickets'
  },
  [BAR_TYPE.NEW_TICKET]: {
    key: BAR_TYPE.NEW_TICKET,
    name: gettext('New ticket'),
    icon: 'new-ticket'
  },
  [BAR_TYPE.TRASH]: {
    key: BAR_TYPE.TRASH,
    name: gettext('Trash')
  },
  [BAR_TYPE.TAGS]: {
    key: BAR_TYPE.TAGS,
    name: gettext('Tags'),
    icon: 'tag-stroked'
  },
  [BAR_TYPE.TYPES]: {
    key: BAR_TYPE.TYPES,
    name: gettext('Manage types')
  },
  [BAR_TYPE.SUBSTATES]: {
    key: BAR_TYPE.SUBSTATES,
    name: gettext('Manage substates')
  },
  [BAR_TYPE.INBOX]: {
    key: BAR_TYPE.INBOX,
    name: gettext('Inbox'),
    icon: 'inbox',
  },
};

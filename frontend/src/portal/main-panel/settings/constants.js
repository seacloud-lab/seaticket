import { gettext } from '@/constants';

export const SETTING_TAB = {
  PORTAL_CUSTOMIZATION: 'portal_customization',
  OPEN_ACCESS: 'open_access',
  KNOWLEDGE_BASE: 'knowledge_base',
  CHAT: 'chat',
};

export const SETTING_TABS = [
  {
    value: SETTING_TAB.PORTAL_CUSTOMIZATION,
    label: gettext('Portal customization')
  }, {
    value: SETTING_TAB.OPEN_ACCESS,
    label: gettext('Open access')
  }, {
    value: SETTING_TAB.KNOWLEDGE_BASE,
    label: gettext('Knowledge base')
  }, {
    value: SETTING_TAB.CHAT,
    label: gettext('Chat')
  },
];

export const CHAT_EXTRA_SOURCES = ['knowledge_base', 'ticket'];

export const EMPTY_CHAT_ALLOWED_SOURCES = { connection_ids: [], extra_sources: [] };

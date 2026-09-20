import { gettext } from '@/constants';

export const SETTING_TAB = {
  PORTAL_CUSTOMIZATION: 'portal_customization',
  OPEN_ACCESS: 'open_access',
  PORTAL_DOMAIN: 'portal_domain',
  CUSTOM_DOMAIN: 'custom_domain',
  CHAT: 'chat',
  EMAIL_NOTIFICATIONS: 'email_notifications',
};

export const SETTING_TABS = [
  {
    value: SETTING_TAB.PORTAL_CUSTOMIZATION,
    label: gettext('Portal customization')
  }, {
    value: SETTING_TAB.OPEN_ACCESS,
    label: gettext('Open access')
  }, {
    value: SETTING_TAB.PORTAL_DOMAIN,
    label: gettext('Portal domain')
  }, {
    value: SETTING_TAB.CUSTOM_DOMAIN,
    label: gettext('Custom domain')
  }, {
    value: SETTING_TAB.CHAT,
    label: gettext('Chat')
  }, {
    value: SETTING_TAB.EMAIL_NOTIFICATIONS,
    label: gettext('Email notifications')
  },
];

export const CHAT_EXTRA_SOURCES = ['knowledge_base', 'ticket'];

export const EMPTY_CHAT_ALLOWED_SOURCES = { connection_ids: [], extra_sources: [] };

export const DEFAULT_WELCOME_EMAIL_SUBJECT = 'Welcome to {portal_name} Support';

export const DEFAULT_WELCOME_EMAIL_CONTENT = `Dear Customer,

You are invited to join {portal_name} support portal.

Through the {portal_name} support portal, you can submit requests, follow their progress, and communicate with our support team.

If you did not expect this message or believe it was sent in error, please reply to this email to contact our support team. We look forward to assisting you.

Best regards,
{portal_name} Support Team`;

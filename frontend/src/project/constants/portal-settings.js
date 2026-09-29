import { gettext, mediaUrl } from '@/constants';

export const PORTAL_CHAT_EXTRA_SOURCES = ['knowledge_base', 'ticket'];

export const PORTAL_CHAT_ALLOWED_SOURCES_DEFAULT = { connection_ids: [], extra_sources: [] };

export const WELCOME_EMAIL_SUBJECT_MAX_LENGTH = 50;
export const WELCOME_EMAIL_CONTENT_MAX_LENGTH = 1000;

export const PORTAL_DEFAULT_SETTINGS = {
  portal_name: gettext('Support portal'),
  portal_logo: `${mediaUrl}img/portal-logo.png`,

  allow_anonymous: false,
  enable_password_protection: false,
  password: '',

  chat_allowed_sources: PORTAL_CHAT_ALLOWED_SOURCES_DEFAULT,
  external_chat_user_rate_limit: 20,
  external_chat_project_rate_limit: 100,
  anonymous_chat_session_daily_limit: 20,
  anonymous_chat_ip_daily_limit: 50,

  enable_send_email: false,
  welcome_email_subject: '',
  welcome_email_content: '',

  daily_chat_credit_limit: 50,
};

export const PORTAL_CUSTOM_DOMAIN_DEFAULT_SETTINGS = {
  custom_domain: '',
  custom_domain_verified: false,
  custom_domain_txt_record_name: '',
  custom_domain_txt_record_value: '',
  current_subdomain_domain: '',
  custom_domain_verified_at: null,
};

export const PORTAL_DOMAIN_ALIAS_DEFAULT_SETTINGS = {
  portal_service_root_domain: '',
  subdomain_prefix: '',
  public_url: '',
};

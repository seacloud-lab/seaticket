import { gettext } from '@/constants';

export const CONNECTION_TYPE = {
  EMAIL: 'email',
  GITHUB_ISSUE: 'github_issue',
  DISCOURSE_FORUM: 'discourse_forum',
  SITE: 'site',
  SEAFILE: 'seafile',
};

export const CONNECTION_FIELD_TYPE = {
  TEXT: 'text',
  URL: 'url',
  OP: 'op',
  DATE: 'date',
  LONG_TEXT: 'long_text',
  PASSWORD: 'password',
  CONNECTION_NAME: 'connection_name',
  EMPTY: 'empty',
  ACTIVE_STATUS: 'active_status',
};

export const CONNECTION_FIELDS = {
  [CONNECTION_TYPE.EMAIL]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true
    }, {
      key: 'host',
      name: gettext('Host'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true,
      is_custom: true
    }, {
      key: 'username',
      name: gettext('Username'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_custom: true
    }, {
      key: 'password',
      name: gettext('Password'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_custom: true
    },
  ],
  [CONNECTION_TYPE.GITHUB_ISSUE]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true
    }, {
      key: 'repository',
      name: gettext('Repository'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true,
      helpText: gettext('Your The URL of the repository, like https://github.com/haiwen/seafile')
    }, {
      key: 'access_token',
      name: gettext('Access token'),
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: true,
      is_custom: true,
      helpText: gettext('Your personal access token in GitHub Developer Settings')
    }
  ],
  [CONNECTION_TYPE.DISCOURSE_FORUM]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true
    }, {
      key: 'url',
      name: gettext('URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true
    }, {
      key: 'api_key',
      name: gettext('API Key'),
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: true,
      is_custom: true
    }, {
      key: 'api_username',
      name: gettext('API Username'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_custom: true
    },
  ],
  [CONNECTION_TYPE.SITE]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true
    }, {
      key: 'url',
      name: gettext('URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true
    }, {
      key: 'sitemap_url',
      name: gettext('Sitemap URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_custom: true
    },
  ],
  [CONNECTION_TYPE.SEAFILE]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true
    }, {
      key: 'server_url',
      name: gettext('Server URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true
    }, {
      key: 'api_token',
      name: gettext('Library API token'),
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: true,
      can_edit_multiple_times: false,
      is_custom: true
    },
  ]
};

export const CONNECTION_TYPES = [
  {
    type: CONNECTION_TYPE.EMAIL,
    icon: 'email',
    name: gettext('Emails'),
  }, {
    type: CONNECTION_TYPE.GITHUB_ISSUE,
    icon: 'github-issues',
    name: gettext('GitHub'),
  }, {
    type: CONNECTION_TYPE.DISCOURSE_FORUM,
    icon: 'discourse-logo',
    name: gettext('Discourse forums'),
  }, {
    type: CONNECTION_TYPE.SITE,
    icon: 'sites',
    name: gettext('Sites'),
  }, {
    type: CONNECTION_TYPE.SEAFILE,
    icon: 'seafile',
    name: gettext('Seafile libraries'),
  }
];

export const CONNECTION_PAGE_TYPE = {
  ALL: 'all',
  NEW: 'new',
};

export const GITHUB_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  REOPEN: 're_open',
  COMPLETED: 'completed',
  NOT_PLANNED: 'not_planned',
  DUPLICATE: 'duplicate',
};

export const GITHUB_STATUS_OPTIONS = [
  { id: GITHUB_STATUS.OPEN, value: GITHUB_STATUS.OPEN, name: gettext('Open'), textColor: '#FFF', color: '#1a7f37', borderColor: '#1a7f37' },
  { id: GITHUB_STATUS.CLOSED, value: GITHUB_STATUS.CLOSED, name: gettext('Closed'), textColor: '#FFF', color: '#8250df', borderColor: '#8250df' },
  { id: GITHUB_STATUS.COMPLETED, value: GITHUB_STATUS.COMPLETED, name: gettext('Completed'), textColor: '#FFF', color: '#8250df', borderColor: '#8250df' },
  { id: GITHUB_STATUS.NOT_PLANNED, value: GITHUB_STATUS.NOT_PLANNED, name: gettext('Not planned'), textColor: '#FFF', color: '#59636e', borderColor: '#59636e' },
  { id: GITHUB_STATUS.DUPLICATE, value: GITHUB_STATUS.DUPLICATE, name: gettext('Duplicate'), textColor: '#FFF', color: '#59636e', borderColor: '#59636e' },
];

export const SUPPORT_DETAILS_CONNECTION_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SITE,
];

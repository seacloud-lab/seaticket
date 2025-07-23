import { gettext } from '../../constants';
import { TABLE_COLUMN_TYPE } from './table-column';

export const CONNECTION_TYPE = {
  EMAIL: 'email',
  GITHUB_ISSUE: 'github_issue',
  DISCOURSE_FORUM: 'discourse_forum',
  SITE: 'site',
  SEAFILE: 'seafile',
};

export const CONNECTION_FIELDS = {
  [CONNECTION_TYPE.EMAIL]: [
    { key: 'name', name: gettext('Name'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%', is_required: true, is_unique: true, is_display: true },
    { key: 'host', name: gettext('Host'), type: TABLE_COLUMN_TYPE.TEXT, width: '25%', is_required: true, is_unique: true, is_display: true, is_custom: true },
    { key: 'username', name: gettext('Username'), type: TABLE_COLUMN_TYPE.TEXT, is_required: true, is_custom: true },
    { key: 'password', name: gettext('Password'), type: TABLE_COLUMN_TYPE.TEXT, is_required: true, is_custom: true },
  ],
  [CONNECTION_TYPE.GITHUB_ISSUE]: [
    { key: 'name', name: gettext('Name'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%', is_required: true, is_unique: true, is_display: true },
    { key: 'repository', name: gettext('Repository'), type: TABLE_COLUMN_TYPE.URL, width: '25%', is_required: true, is_unique: true, is_display: true, is_custom: true },
  ],
  [CONNECTION_TYPE.DISCOURSE_FORUM]: [
    { key: 'name', name: gettext('Name'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%', is_required: true, is_unique: true, is_display: true },
    { key: 'url', name: gettext('URL'), type: TABLE_COLUMN_TYPE.URL, width: '25%', is_required: true, is_unique: true, is_display: true, is_custom: true },
  ],
  [CONNECTION_TYPE.SITE]: [
    { key: 'name', name: gettext('Name'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%', is_required: true, is_unique: true, is_display: true },
    { key: 'url', name: gettext('URL'), type: TABLE_COLUMN_TYPE.URL, width: '25%', is_required: true, is_unique: true, is_display: true, is_custom: true },
    { key: 'sitemap_url', 'name': gettext('Sitemap URL'), type: TABLE_COLUMN_TYPE.URL, is_custom: true },
  ],
  [CONNECTION_TYPE.SEAFILE]: [
    { key: 'name', name: gettext('Library name'), placeholder: gettext('Please input library name'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%', is_required: true, is_unique: true, is_display: true },
    { key: 'server_url', name: gettext('Server URL'), type: TABLE_COLUMN_TYPE.URL, width: '25%', is_required: true, is_unique: true, is_display: true, is_custom: true },
    { key: 'api_token', 'name': gettext('Library API token'), type: TABLE_COLUMN_TYPE.PASSWORD, is_required: true, is_unique: true, can_edit_multiple_times: false, is_custom: true },
  ]
};

export const CONNECTION_TYPES = [
  {
    key: CONNECTION_TYPE.EMAIL,
    type: CONNECTION_TYPE.EMAIL,
    icon: 'email',
    name: gettext('Emails'),
  }, {
    key: CONNECTION_TYPE.GITHUB_ISSUE,
    type: CONNECTION_TYPE.GITHUB_ISSUE,
    icon: 'github-issue',
    name: gettext('Github issues'),
  }, {
    key: CONNECTION_TYPE.DISCOURSE_FORUM,
    type: CONNECTION_TYPE.DISCOURSE_FORUM,
    icon: 'discourse-forum',
    name: gettext('Discourse forums'),
  }, {
    key: CONNECTION_TYPE.SITE,
    type: CONNECTION_TYPE.SITE,
    icon: 'site',
    name: gettext('Sites'),
  }, {
    key: CONNECTION_TYPE.SEAFILE,
    type: CONNECTION_TYPE.SEAFILE,
    icon: 'seafile',
    name: gettext('Seafile'),
  }
];

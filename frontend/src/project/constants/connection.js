import { gettext } from '../../constants';

export const CONNECTION_TYPE = {
  EMAIL: 'email',
  GITHUB_ISSUE: 'github_issue',
  DISCOURSE_FORUM: 'discourse_forum',
  SITE: 'site'
};

export const CONNECTION_FIELDS = {
  [CONNECTION_TYPE.EMAIL]: [
    { key: 'host', name: gettext('Host'), is_required: true, is_unique: true, is_display: true },
    { key: 'username', name: gettext('Username'), is_required: true },
    { key: 'password', name: gettext('Password'), is_required: true },
  ],
  [CONNECTION_TYPE.GITHUB_ISSUE]: [
    { key: 'repository', name: gettext('Repository'), is_required: true, is_unique: true, is_display: true },
  ],
  [CONNECTION_TYPE.DISCOURSE_FORUM]: [
    { key: 'url', name: gettext('URL'), is_required: true, is_unique: true, is_display: true },
  ],
  [CONNECTION_TYPE.SITE]: [
    { key: 'url', name: gettext('URL'), is_required: true, is_unique: true, is_display: true },
    { key: 'sitemap_url', 'name': gettext('Sitemap URL') },
  ],
};

export const CONNECTION_TYPES = [
  {
    key: CONNECTION_TYPE.EMAIL,
    type: CONNECTION_TYPE.EMAIL,
    name: gettext('Emails'),
  }, {
    key: CONNECTION_TYPE.GITHUB_ISSUE,
    type: CONNECTION_TYPE.GITHUB_ISSUE,
    name: gettext('Github issues'),
  }, {
    key: CONNECTION_TYPE.DISCOURSE_FORUM,
    type: CONNECTION_TYPE.DISCOURSE_FORUM,
    name: gettext('Discourse forums'),
  }, {
    key: CONNECTION_TYPE.SITE,
    type: CONNECTION_TYPE.SITE,
    name: gettext('Sites'),
  }
];

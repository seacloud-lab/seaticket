import { gettext } from '@/constants';
import { CellType } from '@/sea-metadata';
import { DATE_FORMAT_MAP } from '@/sea-metadata/constants/column';

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
  NUMBER: 'number',
  SYNC_STATUS: 'sync_status',
  SELECT: 'select',
};

export const CONNECTION_FIELDS = {
  [CONNECTION_TYPE.EMAIL]: [
    {
      key: 'server_provider',
      name: gettext('Server provider'),
      type: CONNECTION_FIELD_TYPE.SELECT,
      is_required: false,
      is_display: true,
      is_custom: true,
      options: [
        { 'key': 'general_email_provider', 'name': gettext('General email provider') }
      ]
    }, {
      key: 'sender_name',
      name: gettext('"From" display name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: false,
      is_display: true,
      is_custom: true
    }, {
      key: 'sender_email',
      name: gettext('"From" address'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: false,
      is_display: true,
      is_custom: true
    }, {
      key: 'smtp_host',
      name: gettext('SMTP host'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: false,
      is_display: true,
      is_custom: true
    }, {
      key: 'smtp_port',
      name: gettext('SMTP port'),
      type: CONNECTION_FIELD_TYPE.NUMBER,
      is_required: false,
      is_display: true,
      is_custom: true
    }, {
      key: 'imap_host',
      name: gettext('IMAP host'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: false,
      is_display: true,
      is_custom: true
    }, {
      key: 'imap_port',
      name: gettext('IMAP port'),
      type: CONNECTION_FIELD_TYPE.NUMBER,
      is_required: false,
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
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: true,
      is_custom: true
    }, {
      key: 'sync_years',
      name: gettext('Only sync email sent within following number of years'),
      type: CONNECTION_FIELD_TYPE.NUMBER,
      is_required: false,
      is_custom: true,
      placeholder: '5',
      defaultValue: 5,
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
    }, {
      key: 'webhook_secret',
      name: gettext('Webhook secret (optional)'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: false,
      is_custom: true,
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
    }, {
      key: 'sync_years',
      name: gettext('Only sync topics updated within following number of years'),
      type: CONNECTION_FIELD_TYPE.NUMBER,
      is_required: false,
      is_custom: true,
      placeholder: '5',
      defaultValue: 5,
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
    }
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

export const GITHUB_STATE_OPTION_NAME_MAP = {
  'open': gettext('Open'),
  'closed': gettext('Closed'),
};

export const GITHUB_STATE_REASON_NAME_MAP = {
  'reopened': gettext('Reopen'),
  'completed': gettext('Completed'),
  'not_planned': gettext('Not planned'),
  'duplicate': gettext('Duplicate'),
};

export const SUPPORT_DETAILS_CONNECTION_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.SEAFILE,
  CONNECTION_TYPE.EMAIL,
];

export const CONNECTION_SYNC_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  CRAWLING: 'crawling',
  PENDING: 'pending',
};

export const CONNECTION_SYNC_STATUS_NAME = {
  [CONNECTION_SYNC_STATUS.COMPLETED]: gettext('Completed'),
  [CONNECTION_SYNC_STATUS.FAILED]: gettext('Failed'),
  [CONNECTION_SYNC_STATUS.CRAWLING]: gettext('Crawling'),
  [CONNECTION_SYNC_STATUS.PENDING]: gettext('Pending')
};

export const CONNECTION_SYNC_COMPLETED_STATUS = [
  CONNECTION_SYNC_STATUS.COMPLETED,
  CONNECTION_SYNC_STATUS.FAILED,
];

export const CONNECTION_PREDEFINED_COLUMN_CONFIG = {
  [CONNECTION_TYPE.GITHUB_ISSUE]: {
    'title': {
      display_name: gettext('Title'),
      is_name_column: true,
      frozen: true,
      is_predefined: true,
      click: (row) => {
        if (row && row.url) {
          window.open(row.url);
        }
      }
    },
    'ai_title': {
      display_name: gettext('AI Title'),
      type: CellType.TEXT,
      is_predefined: true,
      editable: true,
    },
    'author': {
      display_name: gettext('Author'),
      is_predefined: true,
    },
    'state': {
      display_name: gettext('State'),
      is_predefined: true,
    },
    'state_reason': {
      display_name: gettext('State reason'),
      is_predefined: true,
    },
    'issue_type': {
      display_name: gettext('Type'),
      is_predefined: true,
    },
    'labels': {
      display_name: gettext('Labels'),
      is_predefined: true,
    },
    'comments_count': {
      display_name: gettext('Total comments'),
      type: CellType.NUMBER,
      is_predefined: true,
    },
    'updated_at': {
      display_name: gettext('Last updated'),
      type: CellType.MTIME,
      is_predefined: true,
    },
    'closed_at': {
      display_name: gettext('Closed at'),
      type: CellType.DATE,
      data: { format: 'YYYY-MM-DD HH:mm:ss' },
      is_predefined: true,
    },
    'created_at': {
      display_name: gettext('Create time'),
      type: CellType.CTIME,
      is_predefined: true,
    },
  },
  [CONNECTION_TYPE.DISCOURSE_FORUM]: {
    'title': {
      display_name: gettext('Title'),
      editable: false, is_name_column: true, frozen: true,
    },
    'topic_id': {
      display_name: gettext('Topic ID'),
      type: CellType.NUMBER,
    },
    'views': {
      display_name: gettext('Views count'),
      type: CellType.NUMBER,
    },
    'bumped_at': {
      display_name: gettext('Last activity'),
      type: CellType.DATE,
      data: { format: 'YYYY-MM-DD HH:mm:ss' },
    },
    'created_at': {
      display_name: gettext('Created at'),
      type: CellType.CTIME,
    }
  },
  [CONNECTION_TYPE.SITE]: {
    'title': {
      display_name: gettext('Title'),
      editable: false, is_name_column: true, frozen: true, expand_able: true,
    },
    'url': {
      display_name: gettext('URL'),
      type: CellType.URL,
    },
    'last_modified': {
      display_name: gettext('Last modify time'),
      type: CellType.MTIME,
      sort_able: true, filter_able: true
    }
  },
  [CONNECTION_TYPE.SEAFILE]: {
    'filename': {
      display_name: gettext('File name'),
      editable: false, is_name_column: true, frozen: true,
    },
    'path': {
      display_name: gettext('Parent folder'),
      type: CellType.TEXT,
    },
    'mtime': {
      display_name: gettext('Last modified time'),
      type: CellType.MTIME,
    },
    'updated_at': {
      display_name: gettext('Last sync time'),
      type: CellType.DATE,
      data: {
        format: DATE_FORMAT_MAP['YYYY_MM_DD_HH_MM_SS'],
      }
    }
  },
  [CONNECTION_TYPE.EMAIL]: {
    'subject': {
      display_name: gettext('Subject'),
      editable: false, is_name_column: true, frozen: true,
    },
    'email_from': {
      display_name: gettext('From'),
      type: CellType.TEXT,
    },
    'email_to': {
      display_name: gettext('To'),
      type: CellType.TEXT,
    },
    'content': {
      display_name: gettext('Content'),
      type: CellType.TEXT,
    },
    'cc': {
      display_name: gettext('Cc'),
      type: CellType.TEXT,
    },
    'is_sender': {
      display_name: gettext('Is sender'),
      type: CellType.TEXT,
    },
    'email_date': {
      display_name: gettext('Date'),
      type: CellType.MTIME,
    },
    'updated_at': {
      display_name: gettext('Last sync time'),
      type: CellType.DATE,
      data: {
        format: DATE_FORMAT_MAP['YYYY_MM_DD_HH_MM_SS'],
      }
    }
  }
};


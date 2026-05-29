import { gettext } from '@/constants';
import CellType from '@/sea-metadata/constants/column/type';
import { DATE_FORMAT_MAP } from '@/sea-metadata/constants/column';
import { TICKET_TABLE_NAME } from '../tickets/constants';

export const STEP = {
  TYPE: 'type',
  CONFIG: 'config',
};

export const STEPS = [
  { key: STEP.TYPE },
  { key: STEP.CONFIG },
];

export const CONNECTION_TYPE = {
  EMAIL: 'email',
  GITHUB_ISSUE: 'github_issue',
  DISCOURSE_FORUM: 'discourse_forum',
  GENERAL_TASK: 'general_task',
  SITE: 'site',
  SEAFILE: 'seafile',
  NOTION: 'notion',
  LINEAR: 'linear',
};

export const DOCUMENT_CONNECTION_TYPE_MAP = {
  [CONNECTION_TYPE.SITE]: true,
  [CONNECTION_TYPE.SEAFILE]: true,
  [CONNECTION_TYPE.NOTION]: true,
};

export const ISSUE_CONNECTION_TYPE_MAP = {
  [CONNECTION_TYPE.EMAIL]: true,
  [CONNECTION_TYPE.GITHUB_ISSUE]: true,
  [CONNECTION_TYPE.DISCOURSE_FORUM]: true,
  [CONNECTION_TYPE.GENERAL_TASK]: true,
  [CONNECTION_TYPE.LINEAR]: true,
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
  SYNC_SELECT: 'sync_select',
  GROUP: 'group',
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
        { value: 'general_email_provider', label: gettext('General email provider') }
      ],
      default_value: 'general_email_provider',
      tip: gettext('The authentication type for third-party accounts to log in to the email service provider. For most email service providers, you can use \"General Email Service Provider\", which is authenticated by username and password; for Gmail accounts, users can choose \"General Email Service Provider\" or \"Gmail\", the latter will authenticate Google accounts in OAuth2 mode; for MS365 mailbox users, only \"Outlook\" mode can be selected to authenticate accounts through OAuth2"')
    }, {
      key: 'sender_name',
      name: gettext('"From" display name (optional)'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: false,
      is_display: true,
      is_custom: true,
      tip: gettext('The display name is an arbitrary description prepended to an email address. When a display name is used, the email address is enclosed in angle brackets. Example: \'Bill Smith <william.smith@example.com>\''),
    }, {
      key: 'sender_email',
      name: gettext('"From" address (optional)'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: false,
      is_display: true,
      is_custom: true,
      tip: gettext('The address is the full email address of the sender. It need not be identical to the username of the account.')
    }, {
      type: CONNECTION_FIELD_TYPE.GROUP,
      key: '1',
      children: [
        {
          key: 'smtp_host',
          name: gettext('SMTP host'),
          type: CONNECTION_FIELD_TYPE.TEXT,
          is_required: true,
          is_display: true,
          is_custom: true,
        }, {
          key: 'smtp_port',
          name: gettext('SMTP port'),
          type: CONNECTION_FIELD_TYPE.NUMBER,
          is_required: true,
          is_display: true,
          is_custom: true,
          default_value: 587,
        }
      ]
    }, {
      type: CONNECTION_FIELD_TYPE.GROUP,
      key: '2',
      children: [
        {
          key: 'imap_host',
          name: gettext('IMAP host'),
          type: CONNECTION_FIELD_TYPE.TEXT,
          is_required: true,
          is_display: true,
          is_custom: true,
        }, {
          key: 'imap_port',
          name: gettext('IMAP port'),
          type: CONNECTION_FIELD_TYPE.NUMBER,
          is_required: true,
          is_display: true,
          is_custom: true,
          default_value: 993,
        }
      ]
    }, {
      type: CONNECTION_FIELD_TYPE.GROUP,
      key: '3',
      children: [
        {
          key: 'username',
          name: gettext('Username'),
          type: CONNECTION_FIELD_TYPE.TEXT,
          is_required: true,
          is_custom: true,
          tip: gettext('The username is the email address of the account.'),
        }, {
          key: 'password',
          name: gettext('Password'),
          type: CONNECTION_FIELD_TYPE.PASSWORD,
          is_required: true,
          is_custom: true,
          can_edit_multiple_times: false,
          tip: gettext('The password for your email account. For some email providers, you may need to create an app password and use that app password here.'),
        }
      ]
    }, {
      key: 'sync_years',
      name: gettext('Only sync email sent within following number of years'),
      type: CONNECTION_FIELD_TYPE.NUMBER,
      is_required: false,
      is_custom: true,
      placeholder: '5',
      default_value: 5,
    },
  ],
  [CONNECTION_TYPE.GITHUB_ISSUE]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true,
    }, {
      key: 'repository',
      name: gettext('Repository'),
      placeholder: gettext('Select a repository'),
      type: CONNECTION_FIELD_TYPE.SYNC_SELECT,
      can_edit_multiple_times: false,
      is_required: true,
      is_display: true,
      is_custom: true,
    },
  ],
  [CONNECTION_TYPE.DISCOURSE_FORUM]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true,
    }, {
      key: 'url',
      name: gettext('URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true,
      tip: gettext('The URL is the URL of the forum.'),
    }, {
      key: 'api_key',
      name: gettext('API key'),
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: true,
      is_custom: true,
    }, {
      key: 'api_username',
      name: gettext('API username'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_custom: true,
    }, {
      key: 'sync_years',
      name: gettext('Only sync topics updated within following number of years'),
      type: CONNECTION_FIELD_TYPE.NUMBER,
      is_required: false,
      is_custom: true,
      placeholder: '5',
      default_value: 5,
    },
  ],
  [CONNECTION_TYPE.SITE]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true,
    }, {
      key: 'url',
      name: gettext('URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true,
      tip: gettext('The URL is the URL of the site. Example: \'https://www.example.com\''),
    }, {
      key: 'sitemap_url',
      name: gettext('Sitemap URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_custom: true,
      tip: gettext('The sitemap URL is the URL of the sitemap. Example: \'https://www.example.com/sitemap.xml\''),
    },
  ],
  [CONNECTION_TYPE.SEAFILE]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true,
    }, {
      key: 'server_url',
      name: gettext('Seafile server URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true,
    }, {
      key: 'api_token',
      name: gettext('Library API token'),
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: true,
      can_edit_multiple_times: false,
      is_custom: true,
      tip: gettext('The API token is the API token of the Seafile library.'),
    }
  ],
  [CONNECTION_TYPE.NOTION]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true,
    }, {
      key: 'integration_secret',
      name: gettext('Token'),
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: true,
      can_edit_multiple_times: false,
      is_custom: true
    }
  ],
  [CONNECTION_TYPE.GENERAL_TASK]: [
    {
      key: 'name',
      name: gettext('Name'),
      type: CONNECTION_FIELD_TYPE.TEXT,
      is_required: true,
      is_display: true,
    }, {
      key: 'base_url',
      name: gettext('API base URL'),
      type: CONNECTION_FIELD_TYPE.URL,
      is_required: true,
      is_display: true,
      is_custom: true,
    }, {
      key: 'api_token',
      name: gettext('API token'),
      type: CONNECTION_FIELD_TYPE.PASSWORD,
      is_required: false,
      can_edit_multiple_times: false,
      is_custom: true,
    }
  ],
  [CONNECTION_TYPE.LINEAR]: [
    {
      key: 'team_id',
      name: gettext('Team'),
      placeholder: gettext('Select a team'),
      type: CONNECTION_FIELD_TYPE.SYNC_SELECT,
      is_required: true,
      is_display: true,
      is_custom: true,
    }
  ]
};

const HELP_WEB_URL = 'https://user-docs.seaticket.ai/Connect-';

export const CONNECTION_TYPES = [
  {
    type: CONNECTION_TYPE.EMAIL,
    icon: 'email',
    name: gettext('Emails'),
    help_text: gettext('The connection requires an App Password generated by your email provider. Do not use your regular account password. If any problem occurs, check the'),
    help_link: HELP_WEB_URL + 'Email',
  }, {
    type: CONNECTION_TYPE.GITHUB_ISSUE,
    icon: 'github-issues',
    name: gettext('GitHub'),
    help_text: gettext('Only GitHub organization or repository Admin/Owner accounts can be connected. If any problem occurs, check the'),
    help_link: HELP_WEB_URL + 'Github',
  }, {
    type: CONNECTION_TYPE.DISCOURSE_FORUM,
    icon: 'discourse-logo',
    name: gettext('Discourse forums'),
    help_text: gettext('Before connecting, please prepare Discourse admin access, forum URL, API-linked username and admin-generated API key. If any problem occurs, check the'),
    help_link: HELP_WEB_URL + 'Discourse-Forums',
  }, {
    type: CONNECTION_TYPE.SITE,
    icon: 'sites',
    name: gettext('Sites'),
    help_text: gettext('Make sure to prepare the full publicly accessible website URL and its sitemap URL, which lists all site pages. If any problem occurs, check the'),
    help_link: HELP_WEB_URL + 'Sites',
  }, {
    type: CONNECTION_TYPE.SEAFILE,
    icon: 'seafile',
    name: gettext('Seafile libraries'),
    help_text: gettext('Please provide your Seafile server URL and the API token of the library to be connected. If any problem occurs, check the'),
    help_link: HELP_WEB_URL + 'Seafile-Libraries',
  }, {
    type: CONNECTION_TYPE.NOTION,
    icon: 'notion',
    name: gettext('Notion'),
    help_text: gettext('Before connecting, prepare your Notion integration token and ensure you have workspace admin/owner access, plus read permissions for target pages and databases. If any problem occurs, check the'),
    help_link: HELP_WEB_URL + 'Notion',
  }, {
    type: CONNECTION_TYPE.GENERAL_TASK,
    icon: 'general-tasks',
    name: gettext('General tasks'),
    help_text: gettext('Provide the base URL of your API endpoint that list tasks, create a task and so on. If any problem occurs, check the'),
    // TODO: add General Tasks help document
    help_link: HELP_WEB_URL + 'General-Tasks',
  }, {
    type: CONNECTION_TYPE.LINEAR,
    icon: 'linear',
    name: gettext('Linear'),
  }
];

export const getAvailableConnectionTypes = (enableGeneralTask = false) => {
  if (enableGeneralTask) return CONNECTION_TYPES;
  return CONNECTION_TYPES.filter(typeOption => typeOption.type !== CONNECTION_TYPE.GENERAL_TASK);
};

export const CONNECTION_PAGE_SLUG_ID = {
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

export const GENERAL_TASK_STATUS_NAME_MAP = {
  'new': gettext('New'),
  'in_progress': gettext('In progress'),
  'canceled': gettext('Canceled'),
  'done': gettext('Done'),
};

export const GENERAL_TASK_SIZE_NAME_MAP = {
  'large': gettext('Large'),
  'medium': gettext('Medium'),
  'small': gettext('Small'),
};

export const GENERAL_TASK_PRIORITY_NAME_MAP = {
  'high': gettext('High'),
  'medium': gettext('Medium'),
  'low': gettext('Low'),
};

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

export const CONNECTION_PREDEFINED_COLUMN_NAME = {
  _PK: '_pk',
  TITLE: 'title',
  AI_SUMMARY: 'ai_summary',
  AI_PROCESSED_TIME: 'ai_processed_time',
  AUTHOR: 'author',
  CREATOR: 'creator',
  LAST_MODIFIER: 'last_modifier',
  STATE: 'state',
  STATE_REASON: 'state_reason',
  ISSUE_TYPE: 'issue_type',
  LABELS: 'labels',
  COMMENT_COUNT: 'comment_count',
  MODIFIED_TIME: 'modified_time',
  CLOSED_TIME: 'closed_time',
  CREATED_TIME: 'created_time',
  VIEWS: 'views',
  URL: 'url',
  PATH: 'path',
  UNREAD: 'unread',
  OUTDATED: 'outdated',
  SLUG: 'slug',
  TOPIC_ID: 'topic_id',
  RESOLVED: 'resolved',
  LINKED_TICKET: 'linked_ticket',
  TAGS: 'tags',
  PAGE_ID: 'page_id',
  STATUS: 'status',
  SIZE: 'size',
  PRIORITY: 'priority',
  ASSIGNEES: 'assignees',
  PARTICIPANTS: 'participants',
  VERSION: 'version',
  OTHERS: 'others',
  ISSUE_ID: 'issue_id',
  IDENTIFIER: 'identifier',
};

const CONNECTION_PREDEFINED_COLUMN = {
  [CONNECTION_PREDEFINED_COLUMN_NAME.MODIFIED_TIME]: {
    display_name: gettext('Last modified time'),
    type: CellType.MTIME,
    data: {
      format: DATE_FORMAT_MAP['YYYY_MM_DD_HH_MM_SS'],
    }
  },
  [CONNECTION_PREDEFINED_COLUMN_NAME.AI_SUMMARY]: {
    display_name: gettext('AI summary'),
    type: CellType.TEXT,
    is_hover_show_content: true,
  },
  [CONNECTION_PREDEFINED_COLUMN_NAME.AI_PROCESSED_TIME]: {
    display_name: gettext('AI processed time'),
    type: CellType.DATE,
    data: { format: 'YYYY-MM-DD HH:mm:ss' },
  },
  [CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED]: {
    display_name: gettext('Outdated'),
    type: CellType.CHECKBOX,
    editable: true,
  },
  [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: {
    display_name: gettext('Linked ticket'),
    data: {
      linked_table: TICKET_TABLE_NAME,
    },
    type: CellType.LINK,
    editable: false,
  },
};

export const CONNECTION_PREDEFINED_COLUMN_CONFIG = {
  [CONNECTION_TYPE.GITHUB_ISSUE]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('Title'),
      is_name_column: true,
      frozen: true,
      is_predefined: true,
      editable: true,
      click: (row) => {
        if (row && row.url) {
          window.open(row.url);
        }
      }
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.AUTHOR]: {
      display_name: gettext('Author'),
      is_predefined: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.STATE]: {
      display_name: gettext('State'),
      is_predefined: true,
      editable: true,
      is_required: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON]: {
      display_name: gettext('State reason'),
      is_predefined: true,
      editable: true,
      is_required: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.ISSUE_TYPE]: {
      display_name: gettext('Type'),
      is_predefined: false,
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.LABELS]: {
      display_name: gettext('Labels'),
      is_predefined: false,
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.COMMENT_COUNT]: {
      display_name: gettext('Total comments'),
      type: CellType.NUMBER,
      is_predefined: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CLOSED_TIME]: {
      display_name: gettext('Closed time'),
      type: CellType.DATE,
      data: { format: 'YYYY-MM-DD HH:mm:ss' },
      is_predefined: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CREATED_TIME]: {
      display_name: gettext('Created time'),
      type: CellType.CTIME,
      is_predefined: true,
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  },
  [CONNECTION_TYPE.DISCOURSE_FORUM]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('Title'),
      is_name_column: true,
      frozen: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.VIEWS]: {
      display_name: gettext('Views count'),
      type: CellType.NUMBER,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CREATED_TIME]: {
      display_name: gettext('Created time'),
      type: CellType.CTIME,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.RESOLVED]: {
      display_name: gettext('Resolved'),
      type: CellType.CHECKBOX,
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  },
  [CONNECTION_TYPE.SITE]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('Title'),
      is_name_column: true,
      frozen: true,
      click: (row) => {
        if (row && row.url) {
          window.open(row.url);
        }
      }
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.URL]: {
      display_name: gettext('URL'),
      type: CellType.URL,
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  },
  [CONNECTION_TYPE.SEAFILE]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('File name'),
      is_name_column: true,
      frozen: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.PATH]: {
      display_name: gettext('Parent folder'),
      type: CellType.TEXT,
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  },
  [CONNECTION_TYPE.EMAIL]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('Subject'),
      is_name_column: true,
      frozen: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.UNREAD]: {
      display_name: gettext('unread'),
      type: CellType.CHECKBOX,
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.TAGS]: {
      display_name: gettext('Tags'),
      type: CellType.TAGS,
      editable: true,
      modify_data_able: true,
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  },
  [CONNECTION_TYPE.NOTION]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('Title'),
      is_name_column: true,
      frozen: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CREATED_TIME]: {
      display_name: gettext('Created time'),
      type: CellType.CTIME,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.MODIFIED_TIME]: {
      display_name: gettext('Modified time'),
      type: CellType.CTIME,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CREATOR]: {
      display_name: gettext('Creator'),
      type: CellType.TEXT,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.LAST_MODIFIER]: {
      display_name: gettext('Last modifier'),
      type: CellType.TEXT,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED]: {
      display_name: gettext('Outdated'),
      type: CellType.CHECKBOX,
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  },
  [CONNECTION_TYPE.GENERAL_TASK]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('Title'),
      is_name_column: true,
      frozen: true,
      editable: true,
      is_required: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.STATUS]: {
      display_name: gettext('Status'),
      editable: true,
      is_required: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.SIZE]: {
      display_name: gettext('Size'),
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY]: {
      display_name: gettext('Priority'),
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.ASSIGNEES]: {
      type: CellType.COLLABORATOR,
      display_name: gettext('Assignees'),
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.PARTICIPANTS]: {
      type: CellType.COLLABORATOR,
      display_name: gettext('Participants'),
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.VERSION]: {
      display_name: gettext('Version'),
      type: CellType.TEXT,
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.OTHERS]: {
      display_name: gettext('Others'),
      editable: false,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.DUE_DATE]: {
      display_name: gettext('Due date'),
      type: CellType.DATE,
      editable: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CREATED_TIME]: {
      display_name: gettext('Created time'),
      type: CellType.CTIME,
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  },
  [CONNECTION_TYPE.LINEAR]: {
    [CONNECTION_PREDEFINED_COLUMN_NAME.TITLE]: {
      display_name: gettext('Title'),
      is_name_column: true,
      frozen: true,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.AUTHOR]: {
      display_name: gettext('Author'),
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.ASSIGNEES]: {
      display_name: gettext('Assignees'),
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.STATE]: {
      display_name: gettext('State'),
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON]: {
      display_name: gettext('State reason'),
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.LABELS]: {
      display_name: gettext('Labels'),
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY]: {
      display_name: gettext('Priority'),
      type: CellType.NUMBER,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.DUE_DATE]: {
      display_name: gettext('Due date'),
      type: CellType.DATE,
      data: { format: 'YYYY-MM-DD' },
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CREATED_TIME]: {
      display_name: gettext('Created time'),
      type: CellType.CTIME,
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.MODIFIED_TIME]: {
      display_name: gettext('Last modified time'),
      type: CellType.MTIME,
      data: {
        format: DATE_FORMAT_MAP['YYYY_MM_DD_HH_MM_SS'],
      }
    },
    [CONNECTION_PREDEFINED_COLUMN_NAME.CLOSED_TIME]: {
      display_name: gettext('Closed time'),
      type: CellType.DATE,
      data: { format: 'YYYY-MM-DD HH:mm:ss' },
    },
    ...CONNECTION_PREDEFINED_COLUMN,
  }
};

export const CONNECTION_COLUMNS_WIDTH_CONFIG = {
  'title': 400,
};

export const SUPPORT_ROW_DETAILS_CONNECTION_TYPES = [
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.SEAFILE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.EMAIL,
  CONNECTION_TYPE.LINEAR,
  CONNECTION_TYPE.NOTION,
  CONNECTION_TYPE.GENERAL_TASK,
];

export const SUPPORT_OPEN_ORIGINAL_PAGE_CONNECTION_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.SEAFILE,
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.LINEAR,
  CONNECTION_TYPE.NOTION,
];

export const SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.EMAIL,
];

export const SUPPORT_LINK_EXISTING_TICKET_CONNECTION_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.EMAIL,
  CONNECTION_TYPE.GENERAL_TASK,
  CONNECTION_TYPE.LINEAR,
];

export const SUPPORT_AI_CONNECTION_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
  // CONNECTION_TYPE.SEAFILE,
  // CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.EMAIL,
  // CONNECTION_TYPE.NOTION,
  CONNECTION_TYPE.GENERAL_TASK,
  CONNECTION_TYPE.LINEAR,
];

export const SUPPORT_FIND_RELATED_ISSUES_CONNECTION_TYPES = [
  CONNECTION_TYPE.EMAIL,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
];

export const SUPPORT_MARK_OUTDATED_CONNECTION_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SEAFILE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.EMAIL,
  CONNECTION_TYPE.NOTION,
];

export const SUPPORT_MODIFY_CONNECTION_RECORDS_TYPES = [
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SEAFILE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.EMAIL,
  CONNECTION_TYPE.NOTION,
  CONNECTION_TYPE.GENERAL_TASK,
  CONNECTION_TYPE.LINEAR,
];

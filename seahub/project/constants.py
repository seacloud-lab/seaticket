from enum import Enum

from django.utils.translation import gettext as _


# cache
ORG_STORAGE_SIZE_PREFIX = 'ORG_STORAGE_SIZE_'
ORG_STORAGE_SIZE_CACHE_TIMEOUT = 60 * 60 * 24

USER_PROJECT_CACHE_PREFIX = 'USER_PROJECT_'
USER_PROJECT_CACHE_CACHE_TIMEOUT = 60 * 60 * 24

TICKET_DEFAULT_SUBSTATE_CACHE_TIMEOUT = 10 * 60
TICKET_DEFAULT_SUBSTATE_CACHE_PREFIX =  'TICKET_DEFAULT_SUBSTATE_'

PORTAL_ISSUE_DEFAULT_SUBSTATE_CACHE_TIMEOUT = 10 * 60
PORTAL_ISSUE_DEFAULT_SUBSTATE_CACHE_PREFIX =  'PORTAL_ISSUE_DEFAULT_SUBSTATE_'

IMAGE_EXTS = ['gif', 'jpeg', 'jpg', 'png', 'ico', 'bmp', 'tif', 'tiff', 'jfif', 'heic', 'webp']

GITHUB_ISSUE_ACTIVITY_TYPES = {'github_issue_added', 'github_issue_updated', 'github_issue_closed', 'github_issue_reopened', 'github_issue_comment_added'}

DISCOURSE_TOPIC_ACTIVITY_TYPES = {'discourse_topic_added', 'discourse_topic_updated', 'discourse_topic_reply_added'}

EMAIL_ACTIVITY_TYPES = {'email_thread_added', 'email_message_added'}

MANUAL_SYNC_INTERVAL = 1 * 60
MANUAL_CRAWL_INTERVAL = 24 * 60 * 60

# connection types
class ConnectionType(Enum):
    EMAIL = 'email'
    GITHUB_ISSUE = 'github_issue'
    DISCOURSE_FORUM = 'discourse_forum'
    GENERAL_TASK = 'general_task'
    SITE = 'site'
    SEAFILE = 'seafile'
    NOTION = 'notion'

    @classmethod
    def is_valid(cls, value):
        return value in {item.value for item in cls}

class ExtraSourceType(Enum):
    KNOWLEDGE_BASE = 'knowledge_base'
    TICKET = 'ticket'
    PORTAL_ISSUE = 'portal_issue'

class AIScenario(Enum):
    SUMMARY = 'summary'
    AGENT = 'agent'
    CHAT = 'chat'
    PORTAL_CHAT = 'portal-chat'
    SEARCH = 'search'
    RECORD_GENERATION = 'record-generation'
    UNKNOWN = 'unknown'

    @classmethod
    def is_valid(cls, value):
        return value in {item.value for item in cls}

class DataEventType(Enum):
    TICKET_ADDED = 'ticket_added'
    TICKET_UPDATED = 'ticket_updated'
    TICKET_CLOSED = 'ticket_closed'
    TICKET_REOPENED = 'ticket_reopened'
    TICKET_COMMENT_ADDED = 'ticket_comment_added'
    TICKET_COMMENT_UPDATED = 'ticket_comment_updated'
    TICKET_RESTORED = 'ticket_restored'

    @classmethod
    def is_valid(cls, value):
        return value in {item.value for item in cls}

class ConnectionField(object):
    def __init__(self, key, is_required=False, is_unique=False):
        self.key = key
        self.is_required = is_required
        self.is_unique = is_unique

    def to_dict(self):
        return {
            'key': self.key,
            'is_required': self.is_required,
            'is_unique': self.is_unique,
        }


CONNECTION_FIELDS = {
    ConnectionType.EMAIL.value: [
        ConnectionField('sender_name', False, False).to_dict(),
        ConnectionField('sender_email', False, False).to_dict(),
        ConnectionField('smtp_host', False, False).to_dict(),
        ConnectionField('smtp_port', False, False).to_dict(),
        ConnectionField('imap_host', False, False).to_dict(),
        ConnectionField('imap_port', False, False).to_dict(),
        ConnectionField('username', True, False).to_dict(),
        ConnectionField('password', True, False).to_dict(),
    ],
    ConnectionType.GITHUB_ISSUE.value: [
        ConnectionField('repository', True, False).to_dict(),
        ConnectionField('installation_id', True, False).to_dict(),
        # ConnectionField('webhook_secret', False, False).to_dict(),
    ],
    ConnectionType.DISCOURSE_FORUM.value: [
        ConnectionField('url', True, False).to_dict(),
    ],
    ConnectionType.SITE.value: [
        ConnectionField('url', True, False).to_dict(),
        ConnectionField('sitemap_url', False, False).to_dict(),
    ],
    ConnectionType.SEAFILE.value: [
        ConnectionField('server_url', True, False).to_dict(),
        ConnectionField('api_token', True, False).to_dict(),
    ],
    ConnectionType.GENERAL_TASK.value: [
        ConnectionField('base_url', True, False).to_dict(),
        ConnectionField('api_token', False, False).to_dict(),
    ],
    ConnectionType.NOTION.value: [
        ConnectionField('integration_secret', True, False).to_dict(),
    ]
}

GENERAL_TASK_MUTABLE_FIELDS = {
    'title',
    'status',
    'size',
    'priority',
    'assignees',
    'participants',
    'others',
    'due_date',
    'content',
    'description',
    'version',
}


class CrawlStatus:
    PENDING = 'pending'
    CRAWLING = 'crawling'
    COMPLETED = 'completed'
    FAILED = 'failed'


# tickets
TICKET_DEFAULT_DETAILS = {
    'views': [
        {
            '_id': 'open',
            'name': _('Open'),
            'type': 'table',
            'basic_filters': [
                {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                {'column_key': 'type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                {'column_key': 'tags', 'filter_predicate': 'is_any_of', 'filter_term': []},
            ],
            'columns_keys': [],
            'filter_conjunction': 'Or',
            'filters': [],
            'sorts': [{ 'column_key': 'created_time', 'sort_type': 'down' }],
            'groupbys': [],
            'hidden_columns': [],
        }, {
            '_id': 'closed',
            'name': _('Closed'),
            'type': 'table',
            'basic_filters': [
                {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['closed']},
                {'column_key': 'type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                {'column_key': 'tags', 'filter_predicate': 'is_any_of', 'filter_term': []},
            ],
            'columns_keys': [],
            'filter_conjunction': 'Or',
            'filters': [],
            'sorts': [{ 'column_key': 'created_time', 'sort_type': 'down' }],
            'groupbys': [],
            'hidden_columns': [],
        }
    ],
    'navigation': [
        {'_id': 'open', 'type': 'view'},
        {'_id': 'closed', 'type': 'view'}
    ]
}

CONNECTION_DEFAULT_DETAILS = {
    ConnectionType.GITHUB_ISSUE.value: {
        'views': [
            {
                '_id': 'open',
                'name': _('Open'),
                'type': 'table',
                'basic_filters': [
                    {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                    {'column_key': 'issue_type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                ],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [{ 'column_key': 'created_time', 'sort_type': 'down' }],
                'groupbys': [],
                'hidden_columns': [],
            }, {
                '_id': 'closed',
                'name': _('Closed'),
                'type': 'table',
                'basic_filters': [
                    {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['closed']},
                    {'column_key': 'issue_type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                ],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [{ 'column_key': 'created_time', 'sort_type': 'down' }],
                'groupbys': [],
                'hidden_columns': [],
            }
        ],
        'navigation': [
            {'_id': 'open', 'type': 'view'},
            {'_id': 'closed', 'type': 'view'}
        ]
    },
    ConnectionType.SITE.value: {
        'views': [
            {
                '_id': '0000',
                'name': _('All'),
                'type': 'table',
                'basic_filters': [],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [],
                'groupbys': [],
                'hidden_columns': [],
            }
        ],
        'navigation': [
            {'_id': '0000', 'type': 'view'},
        ]
    },
    ConnectionType.DISCOURSE_FORUM.value: {
        'views': [
            {
                '_id': '0000',
                'name': _('All'),
                'type': 'table',
                'basic_filters': [],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [],
                'groupbys': [],
                'hidden_columns': [],
            }
        ],
        'navigation': [
            {'_id': '0000', 'type': 'view'},
        ]
    },
    ConnectionType.SEAFILE.value: {
        'views': [
            {
                '_id': '0000',
                'name': _('All'),
                'type': 'table',
                'basic_filters': [],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [],
                'groupbys': [],
                'hidden_columns': [],
            }
        ],
        'navigation': [
            {'_id': '0000', 'type': 'view'},
        ]
    },
    ConnectionType.EMAIL.value: {
        'views': [
            {
                '_id': '0000',
                'name': _('All'),
                'type': 'table',
                'basic_filters': [],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [],
                'groupbys': [],
                'hidden_columns': [],
            }
        ],
        'navigation': [
            {'_id': '0000', 'type': 'view'},
        ]
    },
    ConnectionType.NOTION.value: {
        'views': [
            {
                '_id': '0000',
                'name': _('All'),
                'type': 'table',
                'basic_filters': [],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [],
                'groupbys': [],
                'hidden_columns': [],
            }
        ],
        'navigation': [
            {'_id': '0000', 'type': 'view'},
        ]
    },
    ConnectionType.GENERAL_TASK.value: {
        'views': [
            {
                '_id': '0000',
                'name': _('All'),
                'type': 'table',
                'basic_filters': [],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [],
                'groupbys': [],
                'hidden_columns': [],
            }
        ],
        'navigation': [
            {'_id': '0000', 'type': 'view'},
        ]
    },
}


class FilterPredicateTypes(object):
    CONTAINS = 'contains'
    NOT_CONTAIN = 'does_not_contain'
    IS = 'is'
    IS_NOT = 'is_not'
    EQUAL = 'equal'
    NOT_EQUAL = 'not_equal'
    LESS = 'less'
    GREATER = 'greater'
    LESS_OR_EQUAL = 'less_or_equal'
    GREATER_OR_EQUAL = 'greater_or_equal'
    EMPTY = 'is_empty'
    NOT_EMPTY = 'is_not_empty'
    IS_WITHIN = 'is_within'
    IS_BEFORE = 'is_before'
    IS_AFTER = 'is_after'
    IS_ON_OR_BEFORE = 'is_on_or_before'
    IS_ON_OR_AFTER = 'is_on_or_after'
    HAS_ANY_OF = 'has_any_of'
    HAS_ALL_OF = 'has_all_of'
    HAS_NONE_OF = 'has_none_of'
    IS_EXACTLY = 'is_exactly'
    IS_ANY_OF = 'is_any_of'
    IS_NONE_OF = 'is_none_of'
    INCLUDE_ME = 'include_me'


class FilterTermModifier(object):
    TODAY = 'today'
    TOMORROW = 'tomorrow'
    YESTERDAY = 'yesterday'
    ONE_WEEK_AGO = 'one_week_ago'
    ONE_WEEK_FROM_NOW = 'one_week_from_now'
    ONE_MONTH_AGO = 'one_month_ago'
    ONE_MONTH_FROM_NOW = 'one_month_from_now'
    NUMBER_OF_DAYS_AGO = 'number_of_days_ago'
    NUMBER_OF_DAYS_FROM_NOW = 'number_of_days_from_now'
    EXACT_DATE = 'exact_date'
    THE_PAST_WEEK = 'the_past_week'
    THE_PAST_MONTH = 'the_past_month'
    THE_PAST_YEAR = 'the_past_year'
    THE_NEXT_WEEK = 'the_next_week'
    THE_NEXT_MONTH = 'the_next_month'
    THE_NEXT_YEAR = 'the_next_year'
    THE_NEXT_NUMBERS_OF_DAYS = 'the_next_numbers_of_days'
    THE_PAST_NUMBERS_OF_DAYS = 'the_past_numbers_of_days'
    THIS_WEEK = 'this_week'
    THIS_MONTH = 'this_month'
    THIS_YEAR = 'this_year'


TICKET_DISPLAY_ALL_COLUMNS = ['_pk', 'title', 'content', 'ai_summary', 'ai_processed_time', 'state', 'substate', 'type', 'tags', 'assignees', 'participants', 'priority', 'creator', 'created_time', 'modified_time', 'closed_time', 'due_date', 'linked_connection_records']
PORTAL_ISSUE_DISPLAY_ALL_COLUMNS = ['_pk', 'title', 'content', 'creator', 'state', 'substate', 'type', 'tags', 'priority', 'linked_ticket', 'created_time', 'modified_time', 'closed_time', 'ai_summary', 'ai_processed_time']
CONNECTION_DISPLAY_ALL_COLUMNS = {
    ConnectionType.GITHUB_ISSUE.value: ['_pk', 'title', 'author', 'state', 'state_reason', 'issue_type', 'labels', 'comment_count', 'closed_time', 'created_time', 'modified_time', 'ai_summary', 'ai_processed_time', 'linked_ticket', 'outdated'],
    ConnectionType.DISCOURSE_FORUM.value: ['_pk', 'title', 'views', 'modified_time', 'created_time', 'ai_summary', 'ai_processed_time', 'linked_ticket', 'outdated'],
    ConnectionType.SITE.value: ['_pk', 'url', 'title', 'modified_time', 'ai_summary', 'ai_processed_time', 'outdated'],
    ConnectionType.SEAFILE.value: ['_pk', 'path', 'title', 'modified_time', 'ai_summary', 'ai_processed_time', 'outdated'],
    ConnectionType.EMAIL.value: ['_pk', 'title', 'modified_time', 'unread', 'ai_summary', 'ai_processed_time', 'linked_ticket', 'outdated', 'tags'],
    ConnectionType.NOTION.value: ['_pk', 'title', 'creator', 'modified_time', 'ai_summary', 'ai_processed_time', 'created_time', 'last_modifier', 'outdated'],
    ConnectionType.GENERAL_TASK.value: ['_pk', 'title', 'status', 'size', 'priority', 'assignees', 'participants', 'version', 'others', 'due_date', 'modified_time', 'created_time', 'ai_summary', 'ai_processed_time', 'linked_ticket', 'outdated']
}


# These columns are must returned to the front end to make some frontend functions work
CONNECTION_MUST_RETURN_COLUMNS = {
    ConnectionType.GITHUB_ISSUE.value: ['url'],
    ConnectionType.DISCOURSE_FORUM.value: ['slug', 'topic_id', 'resolved'],
    ConnectionType.NOTION.value: ['page_id'],
}

LLM_INPUT_CHARACTERS_LIMIT = 4000


KNOWLEDGE_BASE_DISPLAY_ALL_COLUMNS = ['_pk', 'title', 'tags', 'ai_summary', 'ai_processed_time', 'creator', 'created_time', 'last_modifier', 'modified_time']


# Connection categories
class ConnectionCategory:
    ISSUE = 'issue'
    DOCUMENT = 'document'
    OTHER = 'other'

    # Category to connection types mapping
    _TYPE_MAPPING = {
        ISSUE: [
            ConnectionType.EMAIL.value,
            ConnectionType.DISCOURSE_FORUM.value,
            ConnectionType.GITHUB_ISSUE.value,
            ConnectionType.GENERAL_TASK.value,
        ],
        DOCUMENT: [
            ConnectionType.SEAFILE.value,
            ConnectionType.SITE.value,
        ]
    }

    @classmethod
    def from_type(cls, connection_type):
        for category, types in cls._TYPE_MAPPING.items():
            if connection_type in types:
                return category
        return cls.OTHER

ISSUE_CONNECTION_TYPES = ConnectionCategory._TYPE_MAPPING[ConnectionCategory.ISSUE]
DOCUMENT_CONNECTION_TYPES = ConnectionCategory._TYPE_MAPPING[ConnectionCategory.DOCUMENT]


ITEMS_SEARCH_QUERY_TYPES_SUPPORT = [
    'project'
]

PERMISSION_READ = 'r'
PERMISSION_READ_WRITE = 'rw'
API_TOKEN_PERMISSION_TUPLE = (
    PERMISSION_READ,
    PERMISSION_READ_WRITE,
)

EMAIL_ATTACHMENT_TEMP_DIR = '/tmp/seaqa-io/email-attachment/'
EMAIL_ATTACHMENTS_ZIP_NAME = 'attachments.zip'

# portal issues
PORTAL_ISSUES_DEFAULT_DETAILS = {
    'views': [
        {
            '_id': 'open',
            'name': _('Open'),
            'type': 'table',
            'basic_filters': [
                {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                {'column_key': 'type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                {'column_key': 'tags', 'filter_predicate': 'is_any_of', 'filter_term': []},
            ],
            'columns_keys': [],
            'filter_conjunction': 'Or',
            'filters': [],
            'sorts': [{ 'column_key': 'created_time', 'sort_type': 'down' }],
            'groupbys': [],
            'hidden_columns': [],
        }, {
            '_id': 'closed',
            'name': _('Closed'),
            'type': 'table',
            'basic_filters': [
                {'column_key': 'state', 'filter_predicate': 'is_any_of', 'filter_term': ['closed']},
                {'column_key': 'type', 'filter_predicate': 'is_any_of', 'filter_term': []},
                {'column_key': 'tags', 'filter_predicate': 'is_any_of', 'filter_term': []},
            ],
            'columns_keys': [],
            'filter_conjunction': 'Or',
            'filters': [],
            'sorts': [{ 'column_key': 'created_time', 'sort_type': 'down' }],
            'groupbys': [],
            'hidden_columns': [],
        }
    ],
    'navigation': [
        {'_id': 'open', 'type': 'view'},
        {'_id': 'closed', 'type': 'view'}
    ]
}

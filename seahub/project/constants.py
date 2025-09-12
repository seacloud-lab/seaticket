from enum import Enum

from django.utils.translation import gettext as _


# cache
ORG_STORAGE_SIZE_PREFIX = 'ORG_STORAGE_SIZE_'
ORG_STORAGE_SIZE_CACHE_TIMEOUT = 60 * 60 * 24

IMAGE_EXTS = ['gif', 'jpeg', 'jpg', 'png', 'ico', 'bmp', 'tif', 'tiff', 'jfif', 'heic', 'webp']

# connection types
class ConnectionType(Enum):
    EMAIL = 'email'
    GITHUB_ISSUE = 'github_issue'
    DISCOURSE_FORUM = 'discourse_forum'
    SITE = 'site'
    SEAFILE = 'seafile'

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
    ConnectionType.EMAIL: [
        ConnectionField('host', True, False).to_dict(),
        ConnectionField('username', True, False).to_dict(),
        ConnectionField('password', True, False).to_dict(),
    ],
    ConnectionType.GITHUB_ISSUE: [
        ConnectionField('repository', True, False).to_dict(),
        ConnectionField('access_token', True, False).to_dict(),
        ConnectionField('webhook_secret', False, False).to_dict(),
    ],
    ConnectionType.DISCOURSE_FORUM: [
        ConnectionField('url', True, False).to_dict(),
    ],
    ConnectionType.SITE: [
        ConnectionField('url', True, False).to_dict(),
        ConnectionField('sitemap_url', False, False).to_dict(),
    ],
    ConnectionType.SEAFILE: [
        ConnectionField('server_url', True, False).to_dict(),
        ConnectionField('api_token', True, False).to_dict(),
    ]
}


class CrawlStatus:
    PENDING = 'pending'
    CRAWLING = 'crawling'
    COMPLETED = 'completed'
    FAILED = 'failed'


# tickets
TICKET_STATUS = (
    '',
    'open',
    'completed',
    'not_planned',
    'duplicate',
)

TICKET_DEFAULT_DETAILS = {
    'views': [
        {
            '_id': 'open',
            'name': _('Open'),
            'type': 'table',
            'basic_filters': [
                {'column_key': 'status', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                {'column_key': 'tags', 'filter_predicate': 'is_any_of', 'filter_term': []},
            ],
            'columns_keys': [],
            'filter_conjunction': 'Or',
            'filters': [],
            'sorts': [{ 'column_key': 'created_at', 'sort_type': 'down' }],
            'groupbys': [],
            'hidden_columns': [],
        }, {
            '_id': 'closed',
            'name': _('Closed'),
            'type': 'table',
            'basic_filters': [
                {'column_key': 'status', 'filter_predicate': 'is_any_of', 'filter_term': ['completed', 'not_planned', 'duplicate']},
                {'column_key': 'tags', 'filter_predicate': 'is_any_of', 'filter_term': []},
            ],
            'columns_keys': [],
            'filter_conjunction': 'Or',
            'filters': [],
            'sorts': [{ 'column_key': 'created_at', 'sort_type': 'down' }],
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
                    {'column_key': 'status', 'filter_predicate': 'is_any_of', 'filter_term': ['open']},
                ],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [{ 'column_key': 'created_at', 'sort_type': 'down' }],
                'groupbys': [],
                'hidden_columns': [],
            }, {
                '_id': 'closed',
                'name': _('Closed'),
                'type': 'table',
                'basic_filters': [
                    {'column_key': 'status', 'filter_predicate': 'is_any_of', 'filter_term': ['completed', 'not_planned', 'duplicate']}
                ],
                'columns_keys': [],
                'filter_conjunction': 'Or',
                'filters': [],
                'sorts': [{ 'column_key': 'created_at', 'sort_type': 'down' }],
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
    ConnectionType.DISCOURSE_FORUM.value: {},
    ConnectionType.EMAIL.value: {},
    ConnectionType.SEAFILE.value: {},
}


# web crawl table
class PropertyTypes:
    TEXT = 'text'
    DATETIME = 'datetime'
    INT = 'int64'
    FLOAT = 'float64'
    SINGLE_SELECT = 'single-select'
    MULTIPLE_SELECT = 'multiple-select'
    BOOL = 'bool'


class WebCrawlTable(object):
    def __init__(self, table_id, name):
        self.id = table_id
        self.name = name

    @property
    def columns(self):
        return WebCrawlColumns()


class WebCrawlColumns(object):
    def __init__(self):
        self.url = WebCrawlColumn('url', PropertyTypes.TEXT)
        self.title = WebCrawlColumn('title', PropertyTypes.TEXT)
        self.etag = WebCrawlColumn('etag', PropertyTypes.TEXT)
        self.last_modified = WebCrawlColumn('last_modified', PropertyTypes.DATETIME)


class WebCrawlColumn(object):
    def __init__(self, name, type, data=None):
        self.name = name
        self.type = type
        self.data = data

    def to_dict(self, data=None):
        column_data = {
            'name': self.name,
            'type': self.type,
        }
        if self.data:
            column_data['data'] = self.data

        if data:
            column_data['data'] = data

        return column_data


WEB_CRAWL_TABLE = WebCrawlTable('0000', 'Table1')
WEB_CRAWL_COLUMNS = [
    WEB_CRAWL_TABLE.columns.url.to_dict(),
    WEB_CRAWL_TABLE.columns.title.to_dict(),
    WEB_CRAWL_TABLE.columns.etag.to_dict(),
    WEB_CRAWL_TABLE.columns.last_modified.to_dict(),
]


class DiscourseTopicsTable(object):
    def __init__(self, table_id, name):
        self.id = table_id
        self.name = name

    @property
    def columns(self):
        return DiscourseTopicsColumns()


class DiscourseTopicsColumns(object):
    def __init__(self):
        self.topic_id = DiscourseColumn('topic_id', PropertyTypes.INT)
        self.title = DiscourseColumn('title', PropertyTypes.TEXT)
        self.slug = DiscourseColumn('slug', PropertyTypes.TEXT)
        self.views = DiscourseColumn('views', PropertyTypes.INT)
        self.category_id = DiscourseColumn('category_id', PropertyTypes.INT)
        self.connection_id = DiscourseColumn('connection_id', PropertyTypes.INT)
        self.bumped_at = DiscourseColumn('bumped_at', PropertyTypes.DATETIME)
        self.need_index = DiscourseColumn('need_index', PropertyTypes.BOOL)
        self.deleted = DiscourseColumn('deleted', PropertyTypes.BOOL)


class DiscourseRepliesTable(object):
    def __init__(self, table_id, name):
        self.id = table_id
        self.name = name

    @property
    def columns(self):
        return DiscourseRepliesColumns()


class DiscourseRepliesColumns(object):
    def __init__(self):
        self.topic_id = DiscourseColumn('topic_id', PropertyTypes.INT)
        self.post_number = DiscourseColumn('post_number', PropertyTypes.INT)
        self.content = DiscourseColumn('content', PropertyTypes.TEXT)
        self.author = DiscourseColumn('author', PropertyTypes.TEXT)
        self.updated_at = DiscourseColumn('updated_at', PropertyTypes.DATETIME)
        self.connection_id = DiscourseColumn('connection_id', PropertyTypes.INT)


class DiscourseColumn(object):
    def __init__(self, name, type, data=None):
        self.name = name
        self.type = type
        self.data = data

    def to_dict(self, data=None):
        column_data = {
            'name': self.name,
            'type': self.type,
        }
        if self.data:
            column_data['data'] = self.data
        if data:
            column_data['data'] = data
        return column_data


# discourse table instances
DISCOURSE_TOPICS_TABLE = DiscourseTopicsTable('0000', 'DiscourseTopics')
DISCOURSE_REPLIES_TABLE = DiscourseRepliesTable('0000', 'DiscourseReplies')


DISCOURSE_TOPICS_COLUMNS = [
    DISCOURSE_TOPICS_TABLE.columns.topic_id.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.title.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.slug.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.views.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.category_id.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.connection_id.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.bumped_at.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.need_index.to_dict(),
    DISCOURSE_TOPICS_TABLE.columns.deleted.to_dict(),
]


DISCOURSE_REPLIES_COLUMNS = [
    DISCOURSE_REPLIES_TABLE.columns.topic_id.to_dict(),
    DISCOURSE_REPLIES_TABLE.columns.post_number.to_dict(),
    DISCOURSE_REPLIES_TABLE.columns.content.to_dict(),
    DISCOURSE_REPLIES_TABLE.columns.author.to_dict(),
    DISCOURSE_REPLIES_TABLE.columns.updated_at.to_dict(),
    DISCOURSE_REPLIES_TABLE.columns.connection_id.to_dict(),
]


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
    IS_CURRENT_USER_ID = 'is_current_user_ID'


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

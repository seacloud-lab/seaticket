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
    ConnectionType.SITE.value: {},
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
        self.last_modified = WebCrawlColumn('last_modified', PropertyTypes.TEXT)


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


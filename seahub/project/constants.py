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

TICKET_TYPE =  (
    '',
    'bug',
    'feature',
    'request',
    'support',
)

PREDEFINED_TICKET_TAGS = [
    '_bug',
    '_documentation',
    '_duplicate',
    '_enhancement',
    '_good_first_ticket',
    '_help_wanted',
    '_invalid',
    '_question',
    '_wontfix',
]

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

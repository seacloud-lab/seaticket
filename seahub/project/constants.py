from enum import Enum


# cache
ORG_STORAGE_SIZE_PREFIX = 'ORG_STORAGE_SIZE_'
ORG_STORAGE_SIZE_CACHE_TIMEOUT = 60 * 60 * 24


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
        ConnectionField('host', True, True).to_dict(),
        ConnectionField('username', True, False).to_dict(),
        ConnectionField('password', True, False).to_dict()
    ],
    ConnectionType.GITHUB_ISSUE: [
        ConnectionField('repository', True, True).to_dict()
    ],
    ConnectionType.DISCOURSE_FORUM: [
        ConnectionField('url', True, True).to_dict()
    ],
    ConnectionType.SITE: [
        ConnectionField('url', True, True).to_dict(),
        ConnectionField('sitemap_url', False, False).to_dict()
    ]
}

TICKET_STATUS = (
    '',
    'open',
    'completed',
    'not planned',
    'duplicate',
)

TICKET_TYPE =  (
    '',
    'bug',
    'feature',
    'request',
    'support',
)

TICKET_TAG =  (
    'bug',
    'documentation',
    'duplicate',
    'enhancement',
    'good first issue',
    'help wanted',
    'invalid',
    'question',
    'wontfix',
)

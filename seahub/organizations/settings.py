# Copyright (c) 2012-2016 Seafile Ltd.
from django.conf import settings

RESERVED_SUBDOMAINS = getattr(settings, 'RESERVED_SUBDOMAINS', ('www', 'api'))

ORG_REDIRECT = getattr(settings, 'ORG_REDIRECT', False)

ORG_MEMBER_QUOTA_ENABLED = getattr(settings, 'ORG_MEMBER_QUOTA_ENABLED', False)

ORG_MEMBER_QUOTA_DEFAULT = getattr(settings, 'ORG_MEMBER_QUOTA_DEFAULT', 10)

ORG_AUTO_URL_PREFIX = getattr(settings, 'ORG_AUTO_URL_PREFIX', True)

ORG_GROUP_QUOTA = getattr(settings, 'ORG_GROUP_QUOTA', 3000)

FREE_ORG_GROUP_LIMIT = getattr(settings, 'FREE_ORG_GROUP_LIMIT', 100)

ADVANCE_ORG_GROUP_LIMIT = getattr(settings, 'ADVANCE_ORG_GROUP_LIMIT', 1000)

FREE_ORG_PROJECT_LIMIT = getattr(settings, 'FREE_ORG_PROJECT_LIMIT', 500)

ENABLE_ORG_LOGO = getattr(settings, 'ENABLE_ORG_LOGO', False)

ORG_ENABLE_ADMIN_DELETE_ORG = getattr(settings, 'ORG_ENABLE_ADMIN_DELETE_ORG', False)

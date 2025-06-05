# -*- coding: utf-8 -*-
from django.conf import settings

ENABLE_COLLABORA = getattr(settings, 'ENABLE_COLLABORA', False)
COLLABORA_DISCOVERY_URL = getattr(settings, 'COLLABORA_DISCOVERY_URL', '')
COLLABORA_FILE_EXTENSION = getattr(settings, 'COLLABORA_FILE_EXTENSION', ('doc', 'docx', 'ppt', 'pptx',  'odt', 'fodt', 'odp', 'fodp', 'rtf', 'txt', 'odg', 'xls', 'xlsx', 'ods', 'fods', 'csv'))

WOPI_ACCESS_TOKEN_EXPIRATION = getattr(settings, 'WOPI_ACCESS_TOKEN_EXPIRATION', 12 * 60 * 60)
OFFICE_WEB_APP_DISCOVERY_EXPIRATION = getattr(settings, 'OFFICE_WEB_APP_DISCOVERY_EXPIRATION', 7 * 24 * 60 * 60)

# path to client.cert when use client authentication
OFFICE_WEB_APP_CLIENT_CERT = getattr(settings, 'OFFICE_WEB_APP_CLIENT_CERT', '')
# path to client.key when use client authentication
OFFICE_WEB_APP_CLIENT_KEY = getattr(settings, 'OFFICE_WEB_APP_CLIENT_KEY', '')

# path to client.pem when use client authentication
OFFICE_WEB_APP_CLIENT_PEM = getattr(settings, 'OFFICE_WEB_APP_CLIENT_PEM', '')

# Path to a CA_BUNDLE file or directory with certificates of trusted CAs
OFFICE_WEB_APP_SERVER_CA = getattr(settings, 'OFFICE_WEB_APP_SERVER_CA', True)

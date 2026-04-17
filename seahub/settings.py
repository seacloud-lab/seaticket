# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
# Django settings for seaqa-web project.

import sys
import os
import re
from .config_parser import ConfigParser

# The usage of following three settings should be removed
SERVICE_URL = 'http://127.0.0.1'

PROJECT_ROOT = os.path.join(os.path.dirname(__file__), os.pardir)

DEBUG = False

ADMINS = [
    # ('Your Name', 'your_email@domain.com'),
]

MANAGERS = ADMINS

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',  # Add 'postgresql_psycopg2', 'mysql', 'sqlite3' or 'oracle'.
        'NAME': 'sea_qa',
        'USER': 'root',
        'PASSWORD': 'root',
        'HOST': '127.0.0.1',
        'PORT': '3306',
    }
}

# New in Django 3.2
# Default primary key field type to use for models that don’t have a field with primary_key=True.
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# If running in a Windows environment this must be set to the same as your
# system time zone.
TIME_ZONE = os.environ.get('TIME_ZONE', 'UTC')

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en'

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale.
USE_L10N = True

# If you set this to False, Django will not use timezone-aware datetimes.
USE_TZ = True

# Absolute filesystem path to the directory that will hold user-uploaded files.
# Example: "/home/media/media.lawrence.com/media/"
MEDIA_ROOT = '%s/media/' % PROJECT_ROOT

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
MEDIA_URL = '/media/'

# Absolute path to the directory static files should be collected to.
# Don't put anything in this directory yourself; store your static files
# in apps' "static/" subdirectories and in STATICFILES_DIRS.
# Example: "/home/media/media.lawrence.com/static/"
STATIC_ROOT = '%s/assets/' % MEDIA_ROOT

# URL prefix for static files.
# Example: "http://media.lawrence.com/static/"
STATIC_URL = '/media/assets/'

# Additional locations of static files
STATICFILES_DIRS = [
    # Put strings here, like "/home/html/static" or "C:/www/django/static".
    # Always use forward slashes, even on Windows.
    # Don't forget to use absolute paths, not relative paths.
    '%s/static' % PROJECT_ROOT,
]
# %s/frontend/build perhaps not exists
if os.path.isdir('%s/frontend/build' % PROJECT_ROOT):
    STATICFILES_DIRS.append('%s/frontend/build' % PROJECT_ROOT)

WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': 'frontend/',
        'STATS_FILE': os.path.join(PROJECT_ROOT, 'frontend/webpack-stats.pro.json'),
    }
}

DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# StaticI18N config
STATICI18N_ROOT = '%s/static/scripts' % PROJECT_ROOT
STATICI18N_OUTPUT_DIR = 'i18n'


STATICFILES_FINDERS = (
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
    # 'django.contrib.staticfiles.finders.DefaultStorageFinder',
    'compressor.finders.CompressorFinder',
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = ''

ENABLE_REMOTE_USER_AUTHENTICATION = False

# Order is important
MIDDLEWARE = [
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'seahub.auth.middleware.AuthenticationMiddleware',
    'seahub.base.middleware.BaseMiddleware',
    'seahub.password_session.middleware.CheckPasswordHash',
    'seahub.base.middleware.ForcePasswdChangeMiddleware',
    'seahub.two_factor.middleware.OTPMiddleware',
    'seahub.two_factor.middleware.ForceTwoFactorAuthMiddleware',
    'seahub.base.middleware.UserAgentMiddleWare',
    # 'seahub.base.middleware.SqlPrintMiddleware',
]


SITE_ROOT_URLCONF = 'seahub.urls'
ROOT_URLCONF = 'seahub.utils.rooturl'
SITE_ROOT = '/'
CSRF_COOKIE_NAME = 'seaqa_csrftoken'

# Python dotted path to the WSGI application used by Django's runserver.
WSGI_APPLICATION = 'seahub.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(PROJECT_ROOT, '../seaqa-web-data/custom/templates'),
            os.path.join(PROJECT_ROOT, 'seahub/templates'),
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.i18n',
                'django.template.context_processors.media',
                'django.template.context_processors.static',
                'django.template.context_processors.request',
                'django.contrib.messages.context_processors.messages',

                'seahub.auth.context_processors.auth',
                'seahub.base.context_processors.base',
                'seahub.base.context_processors.debug',
            ],
        },
    },
]


LANGUAGES = [
    ('en', 'English'),
    ('zh-cn', '简体中文'),
]

LOCALE_PATHS = [
    os.path.join(PROJECT_ROOT, 'locale'),
]

FORCE_DEFAULT_LANGUAGE = ''

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # In order to override command `createsuperuser`, base app *must* before auth app.
    # ref: https://docs.djangoproject.com/en/1.11/howto/custom-management-commands/#overriding-commands
    'seahub.base',
    'django.contrib.auth',

    'captcha',
    'compressor',
    'statici18n',
    'post_office',
    'webpack_loader',
    'pwa',
    'djangosaml2',

    'seahub.api2',
    'seahub.avatar',
    'seahub.invitations',
    'seahub.group',
    'seahub.options',
    'seahub.profile',
    'seahub.password_session',
    'seahub.admin_log',
    'seahub.two_factor',
    'seahub.role_permissions',
    'seahub.project',
    'seahub.tickets',
    'seahub.chats',
    'seahub.knowledge_base',
    'seahub.organizations',
    'seahub.registration',
    'seahub.sysadmin_extra',
    'seahub.notifications',
    'seahub.portal',
    'seahub.billing',
]

AUTHENTICATION_BACKENDS = (
    'seahub.base.accounts.AuthBackend',
)

# if ENABLE_HTTP_OAUTH set to True will enable OAuth when use http
ENABLE_CUSTOM_OAUTH = False
ENABLE_OAUTH = False
ENABLE_SAML = False
ENABLE_MULTI_SAML = False

ENABLE_EXTERNAL_BILLING_SERVICE = False

DISABLE_SSO_USER_PWD_LOGIN = False

LDAP_SAML_USE_SAME_UID = False

# is show user's unit
IS_SHOW_UNIT = False

ENABLE_LDAP = False
LDAP_USER_FIRST_NAME_ATTR = ''
LDAP_USER_LAST_NAME_ATTR = ''
LDAP_USER_NAME_REVERSE = False
LDAP_FILTER = ''
LDAP_CONTACT_EMAIL_ATTR = ''
LDAP_EMPLOYEE_ID_ATTR = ''
LDAP_USER_ROLE_ATTR = ''
ACTIVATE_USER_WHEN_IMPORT = True

# ldap group sync
LDAP_SYNC_GROUP = False
LDAP_GROUP_FILTER = ''
LDAP_GROUP_MEMBER_ATTR = 'member'
LDAP_GROUP_MEMBER_UID_ATTR = 'uid'
LDAP_USER_OBJECT_CLASS = 'person'
LDAP_GROUP_OBJECT_CLASS = 'group'
LDAP_GROUP_UUID_ATTR = 'objectGUID'

# ldap sasl auth
ENABLE_SASL = False
SASL_MECHANISM = ''
SASL_AUTHC_ID_ATTR = ''

LOGIN_REDIRECT_URL = '/'
LOGIN_URL = '/accounts/login/'
LOGIN_ERROR_DETAILS = False
LOGOUT_URL = '/accounts/logout/'
LOGOUT_REDIRECT_URL = None

ACCOUNT_ACTIVATION_DAYS = 7

# mininum length for user's password
USER_PASSWORD_MIN_LENGTH = 6

# LEVEL based on four types of input:
# num, upper letter, lower letter, other symbols
# '3' means password must have at least 3 types of the above.
USER_PASSWORD_STRENGTH_LEVEL = 3

# default False, only check USER_PASSWORD_MIN_LENGTH
# when True, check password strength level, STRONG(or above) is allowed
USER_STRONG_PASSWORD_REQUIRED = True

# Force user to change password when admin add/reset a user.
FORCE_PASSWORD_CHANGE = True

# Enable a sso user to change password in 'settings' page.
ENABLE_SSO_USER_CHANGE_PASSWORD = True
ENABLE_LDAP_USER_CHANGE_PASSWORD = False

ENABLE_DELETE_ACCOUNT = True
ENABLE_UPDATE_USER_INFO = True

ENABLE_CONVERT_TO_TEAM_ACCOUNT = False

# Enable or disable sharing to all groups
ENABLE_SHARE_TO_ALL_GROUPS = False

# File preview
FILE_PREVIEW_MAX_SIZE = 30 * 1024 * 1024
FILE_ENCODING_LIST = ['auto', 'utf-8', 'gbk', 'ISO-8859-1', 'ISO-8859-5']
FILE_ENCODING_TRY_LIST = ['utf-8', 'gbk']

# extensions of previewed files
TEXT_PREVIEW_EXT = """ac, am, bat, c, cc, cmake, cpp, cs, css, diff, el, h, html, htm, java, js, json, less, make, org, php, pl, properties, py, rb, scala, script, sh, sql, txt, text, tex, vi, vim, xhtml, xml, log, csv, groovy, rst, patch, go, yml"""

# Common settings(file extension, storage) for avatar and group avatar.
AVATAR_FILE_STORAGE = '' # Replace with 'seahub.base.database_storage.DatabaseStorage' if save avatar files to database
AVATAR_ALLOWED_FILE_EXTS = ('.jpg', '.png', '.jpeg', '.gif')
# Avatar
AVATAR_STORAGE_DIR = 'avatars'
AVATAR_HASH_USERDIRNAMES = True
AVATAR_HASH_FILENAMES = True
AVATAR_GRAVATAR_BACKUP = False
AVATAR_DEFAULT_URL = '/avatars/default.png'
AVATAR_DEFAULT_NON_REGISTERED_URL = '/avatars/default.png'
AVATAR_CACHE_TIMEOUT = 14 * 24 * 60 * 60
AVATAR_DEFAULT_SIZE = 256
APP_AVATAR_DEFAULT_URL = '/avatars/app.png'
# Group avatar
GROUP_AVATAR_STORAGE_DIR = 'avatars/groups'
GROUP_AVATAR_DEFAULT_URL = 'avatars/groups/default.png'
AUTO_GENERATE_GROUP_AVATAR_SIZES = (20, 24, 32, 36, 48, 56)

LOG_DIR = os.environ.get('LOG_PATH', '/tmp')
CACHE_DIR = "/tmp"
CONF_DIR = os.environ.get('CONF_PATH', '')

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379',
    },
}
REDIS_HOST = 'redis'
REDIS_PORT = 6379
REDIS_PASSWORD = ''
BROWSER_CACHE_MAX_AGE = 60 * 60 * 24 * 30

# rest_framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'ping': '3000/minute',
        'anon': '60/minute',
        'user': '3000/minute',
        'sync_common_dataset': '60/minute',
        'org-admin': '1000/day',
        'org_register': '3/day',
        'app': '1000/minute',
        'import': '20/minute',
        'export': '20/minute',
        'repair-base': '6/minute'
    },
    # https://github.com/tomchristie/django-rest-framework/issues/2891
    'UNICODE_JSON': False,
    # Authentication
    'UNAUTHENTICATED_USER': 'seahub.auth.models.AnonymousUser',
}

API_THROTTLE_RATES = {}

REST_FRAMEWORK_THROTTING_WHITELIST = []

# trash cleanning interval by days
TRASH_CLEAN_AFTER_DAYS = 30

# Whether or not activate user when registration complete.
# If set to ``False``, new user will be activated by admin or via activate link.
ACTIVATE_AFTER_REGISTRATION = True
# Whether or not send activation Email to user when registration complete.
# This option will be ignored if ``ACTIVATE_AFTER_REGISTRATION`` set to ``True``.
REGISTRATION_SEND_MAIL = True

# Whether or not activate inactive user on first login. Mainly used in LDAP user sync.
ACTIVATE_AFTER_FIRST_LOGIN = False

# Account initial password, for password resetting.
# INIT_PASSWD can either be a string, or a function (function has to be set without the brackets)
def genpassword():
    from django.utils.crypto import get_random_string
    return get_random_string(10)
INIT_PASSWD = genpassword

# browser tab title
SITE_TITLE = 'SeaTicket'

# Base name used in email sending
SITE_NAME = 'SeaTicket'

# Path to the license file(relative to the media path)
LICENSE_PATH = os.path.join(PROJECT_ROOT, '../../seatable-license.txt')

# Path to the background image file of login page(relative to the media path)
LOGIN_BG_IMAGE_PATH = 'img/login-bg.jpg'

# Path to the favicon file (relative to the media path)
# tip: use a different name when modify it.
FAVICON_PATH = 'favicons/favicon.ico'
FAVICON_NOTIFICATION_PATH = 'favicons/notification-favicon.ico'
APPLE_TOUCH_ICON_PATH = 'favicons/favicon.ico'

# Path to the Logo Imagefile (relative to the media path)
LOGO_PATH = 'img/SeaTicket.png'
# logo size. the unit is 'px'
LOGO_WIDTH = ''
LOGO_HEIGHT = 32

CUSTOM_LOGO_PATH = 'custom/mylogo.png'
CUSTOM_FAVICON_PATH = 'custom/favicon.ico'
CUSTOM_FAVICON_NOTIFICATION_PATH = 'custom/notification-favicon.ico'
CUSTOM_LOGIN_BG_PATH = 'custom/login-bg.jpg'

# Using Django to server static file. Set to `False` if deployed behind a web
# server.
SERVE_STATIC = True

# Enable or disable registration on web.
ENABLE_SIGNUP = False

# privacy policy link and service link
PRIVACY_POLICY_LINK = ''
TERMS_OF_SERVICE_LINK = ''

# slide captcha
ENABLE_SLIDE_CAPTCHA = False
SLIDE_CAPTCHA_IMAGE_URL = ''

# rate limit
REQUEST_RATE_LIMIT_NUMBER = 3
REQUEST_RATE_LIMIT_PERIOD = 60  # seconds

# For security consideration, please set to match the host/domain of your site, e.g., ALLOWED_HOSTS = ['.example.com'].
# Please refer https://docs.djangoproject.com/en/dev/ref/settings/#allowed-hosts for details.
ALLOWED_HOSTS = ['*']

CSRF_TRUSTED_ORIGINS = ["https://*", "http://*"]

# Logging
LOG_LEVEL = os.environ.get('SEAQA_LOG_LEVEL', '"INFO"')
SEAQA_LOGS_HANDLERS = ['console'] if os.environ.get('SEAQA_LOG_TO_STDOUT', 'false') == 'true' else ['file']
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '[seaqa-web] [%(asctime)s] [%(levelname)s] %(filename)s[line:%(lineno)s] %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
        'file': {
            'format': '[%(asctime)s] [%(levelname)s] %(filename)s[line:%(lineno)s] %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard'
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(LOG_DIR, 'seaqa-web.log'),
            'formatter': 'file'
        },
    },
    'loggers': {
        '': {
            'level': "INFO",
            'handlers': SEAQA_LOGS_HANDLERS,
            'propagate': False
        },
        'django.request': {
            'level': "INFO",
            'handlers': SEAQA_LOGS_HANDLERS,
            'propagate': False
        },
        'py.warnings': {
            'level': "INFO",
            'handlers': SEAQA_LOGS_HANDLERS,
            'propagate': False
        }
    }
}

#Login Attempt
LOGIN_ATTEMPT_LIMIT = 5
LOGIN_ATTEMPT_TIMEOUT = 15 * 60 # in seconds (default: 15 minutes)
FREEZE_USER_ON_LOGIN_FAILED = False # deactivate user account when login attempts exceed limit

# Age of cookie, in seconds (default: 1 day).
SESSION_COOKIE_AGE = 24 * 60 * 60

# Days of remembered login info (default: 7 days)
LOGIN_REMEMBER_DAYS = 7

CAPTCHA_IMAGE_SIZE = (90, 42)

# Absolute filesystem path to the directory that will hold thumbnail files.
SEAHUB_DATA_ROOT = os.path.join(PROJECT_ROOT, '../seaqa-web-data')

ENABLE_WEBDAV_SECRET = False
ENABLE_USER_SET_CONTACT_EMAIL = True
ENABLE_USER_SET_NAME = True

ENABLE_SHOW_ID_IN_ORG_WHEN_SEARCH_USER = False

########################
# Security Enhancements #
########################

ENABLE_SUDO_MODE = True
FILESERVER_TOKEN_ONCE_ONLY = True

#################
# Email sending #
#################

EMAIL_USE_TLS = False
EMAIL_HOST = ''
EMAIL_HOST_USER = ''
EMAIL_HOST_PASSWORD = ''
EMAIL_PORT = 25
DEFAULT_FROM_EMAIL = ''

SEND_EMAIL_ON_ADDING_SYSTEM_MEMBER = True # Whether to send email when a system staff adding new member.
SEND_EMAIL_ON_RESETTING_USER_PASSWD = True # Whether to send email when a system staff resetting user's password.
SEND_EMAIL_ON_ORG_ADD_NEW_USER = True  # Whether to send email when add new user.
SEND_EMAIL_ON_ACTIVATING_USER = True  # Whether to send email when a system staff activating a member
SEND_EMAIL_ON_ACTIVATING_ORG_USER = False # Whether to send email when org admin activating a member


##########################
# Settings for seaqa    #
##########################

SEAQA_WEB_SERVICE_URL = ''

SSO_SECRET_KEY = ''

USE_EXTERNAL_TEAM_ADMIN = False
EXTERNAL_TEAM_ADMIN_SECRET_KEY = ''
EXTERNAL_TEAM_ADMIN_URL = ''

ENABLE_TWO_FACTOR_AUTH = False
OTP_LOGIN_URL = '/profile/two_factor_authentication/setup/'
TWO_FACTOR_DEVICE_REMEMBER_DAYS = 90
ENABLE_FORCE_2FA_TO_ALL_USERS = False

GROUP_MEMBER_LIMIT = 500

PERSONAL_GROUP_LIMIT = 500

PERSONAL_PROJECT_LIMIT = 500

DISABLE_ADDING_PERSONAL_PROJECTS = False

FREE_ORG_PROJECT_LIMIT = 500

GROUP_PROJECT_LIMIT = 500

S3_HOST = ''
S3_FILE_BUCKET = ''
S3_WEB_CRAWL_BUCKET = ''
S3_KEY_ID = ''
S3_SECRET_KEY = ''


# seadb config
SEADB_SERVER_URL = 'http://seadb:8888'
SEADB_SERVER_ACCESS_TOKEN = ''

PROJECT_IMAGE_MAX_SIZE = 10  # 10MB
PROJECT_FILE_MAX_SIZE = 25  # 25MB

# PWA
PWA_SERVICE_WORKER_PATH = os.path.join(PROJECT_ROOT, 'media/pwa/js', 'service-worker.js')
PWA_APP_NAME = 'SeaTicket'
PWA_APP_DESCRIPTION = "Online rich form application"
PWA_APP_THEME_COLOR = '#0A0302'
PWA_APP_BACKGROUND_COLOR = '#ffffff'
PWA_APP_DISPLAY = 'standalone'
PWA_APP_SCOPE = '/'
PWA_APP_ORIENTATION = 'any'
PWA_APP_START_URL = '/'
PWA_APP_STATUS_BAR_COLOR = 'default'
PWA_APP_ICONS = [
    {
        'src': '/media/favicons/favicon.ico',
        'sizes': '512x512',
    }
]
PWA_APP_ICONS_APPLE = [
    {
        'src': '/media/favicons/favicon.ico',
        'sizes': '512x512',
    }
]
PWA_APP_DIR = 'ltr'
PWA_APP_LANG = 'en-US'

# If False, the configuration will always be read from settings.py instead of from the database
d = os.path.dirname

# custom navigation settings
CUSTOM_NAV_ITEMS = []

SEAQA_INDEXER_INNER_SERVER_URL = 'http://seaqa-indexer:8888'
SEAQA_AI_INNER_SERVER_URL = 'http://seaqa-ai:8887'
SEAQA_EVENTS_INNER_SERVER_URL = 'http://seaqa-events:6001'
SEAQA_IO_LOCAL_SERVER_URL = 'http://127.0.0.1:6002'
ATTACHMENT_CONTENT_MAX_SIZE = 20000
ATTACHMENT_ISSUE_MAX_COMMENTS = 50

LLM_MODELS = []

TEMP_EXPORT_VIEW_DIR = '/tmp/seaqa-io/export-view-to-excel/'

GITHUB_APP_NAME = ''
GITHUB_WEBHOOK_SECRET = ''
GITHUB_APP_ID = ''
GITHUB_PRIVATE_KEY_PATH = ''


def validate_llm_models(models):
    if not models or not isinstance(models, list):
        return []
    validated_models = []

    for model in models:
        if not isinstance(model, dict) or model.get('disable', False):
            continue
        if model.get('type') in ('other', 'hosted_vllm'):
            required_fields = ('model', 'url')
        else:
            required_fields = ('model', 'key')
        if not all(field in model for field in required_fields):
            continue
        model['label'] = model.get('label', model['model'])
        validated_models.append(model)

    return validated_models

#####################
# External settings #
#####################

def load_local_settings(module):
    '''Import any symbols that begin with A-Z. Append to lists any symbols
    that begin with "EXTRA_".

    '''
    for attr in dir(module):
        match = re.search(r'^EXTRA_(\w+)', attr)
        if match:
            name = match.group(1)
            value = getattr(module, attr)
            try:
                globals()[name] += value
            except KeyError:
                globals()[name] = value
        elif re.search(r'^[A-Z]', attr):
            globals()[attr] = getattr(module, attr)

# Load local_settings.py
try:
    import seahub.local_settings
except ImportError:
    pass
else:
    load_local_settings(seahub.local_settings)
    del seahub.local_settings

# Load seahub_settings.py in server release
try:
    if os.path.exists(CONF_DIR):
        sys.path.insert(0, CONF_DIR)
    import seaqa_web_settings
except ImportError:
    pass
else:
    INSTALLED_APPS.append('gunicorn')

    load_local_settings(seaqa_web_settings)
    del seaqa_web_settings

# config in yaml & env
yaml_file_path = os.path.join(CONF_DIR, os.environ.get('SEAQA_CONFIG_NAME', 'seaqa_config.yaml'))
configs = ConfigParser(yaml_file_path, 'seaqa-web')

# Available AI Models for user selection
LLM_MODELS = validate_llm_models(configs.get('LLM_MODELS', LLM_MODELS))

# jwt private key
JWT_PRIVATE_KEY = configs.get('JWT_PRIVATE_KEY')

# For database conf., now only support mysql
if 'default' in DATABASES and 'mysql' in DATABASES['default'].get('ENGINE', ''):
    ## For dtable_db
    _rewrite_db_env_key_map = {
        'HOST': 'SEAQA_MYSQL_DB_HOST',
        'PORT': 'SEAQA_MYSQL_DB_PORT',
        'USER': 'SEAQA_MYSQL_DB_USER',
        'PASSWORD': 'SEAQA_MYSQL_DB_PASSWORD',
        'NAME': 'SEAQA_MYSQL_SEAQA_DB_NAME'
    }

    for db_key, env_key in _rewrite_db_env_key_map.items():
        if env_value := configs.get(env_key):
            DATABASES['default'][db_key] = env_value

    if DATABASES['default'].get('PORT'):
        try:
            isinstance(DATABASES['default']['PORT'], int) or int(DATABASES['default']['PORT'])
        except:
            raise ValueError(f"Invalid database port: {DATABASES['default']['PORT']}")

    DATABASES['default'].setdefault('OPTIONS', {})
    DATABASES['default']['OPTIONS']['charset'] = 'utf8mb4'

## For cache
if 'default' in CACHES and CACHES['default'].get('LOCATION') and CACHES['default'].get('BACKEND'):
    redis_cache = 'RedisCache' in CACHES['default'].get('BACKEND')
    cache_cfg = CACHES['default'].get('LOCATION').split('://', 1)[-1]
    if redis_cache:
        try:
            REDIS_PASSWORD, redis_host_info = cache_cfg.split('@', 1)
            REDIS_HOST, REDIS_PORT = redis_host_info.split(':', 1)
        except:
            REDIS_PASSWORD = ''
            REDIS_HOST, REDIS_PORT = cache_cfg.split(':', 1)
        REDIS_HOST = configs.get('REDIS_HOST', REDIS_HOST)
        REDIS_PORT = configs.get('REDIS_PORT', REDIS_PORT)
        try:
            isinstance(REDIS_PORT, int) or int(REDIS_PORT.split('/', 1)[0])
        except:
            raise ValueError(f"Invalid redis port: {REDIS_PORT}")
        REDIS_PASSWORD = configs.get('REDIS_PASSWORD', REDIS_PASSWORD)

        CACHES['default']['LOCATION'] = f'redis://{(REDIS_PASSWORD + "@") if REDIS_PASSWORD else ""}{REDIS_HOST}:{REDIS_PORT}'

        if REDIS_PASSWORD:
            try:
                del CACHES['default']['OPTIONS']['PASSWORD']
            except:
                pass
    else:
        REDIS_HOST = configs.get('REDIS_HOST', REDIS_HOST)
        REDIS_PORT = configs.get('REDIS_PORT', REDIS_PORT)
        REDIS_PASSWORD = configs.get('REDIS_PASSWORD', REDIS_PASSWORD)
else:
    REDIS_HOST = configs.get('REDIS_HOST', REDIS_HOST)
    REDIS_PORT = configs.get('REDIS_PORT', REDIS_PORT)
    REDIS_PASSWORD = configs.get('REDIS_PASSWORD', REDIS_PASSWORD)

# merge RESTFUL API RATES
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update(API_THROTTLE_RATES)

# Remove install_topdir from path
sys.path.pop(0)

# Following settings are private, can not be overwrite.
MULTI_TENANCY = True

# service url
SEATICKET_SERVER_HOSTNAME = os.environ.get('SEATICKET_SERVER_HOSTNAME', '')
SEATICKET_SERVER_PROTOCOL = os.environ.get('SEATICKET_SERVER_PROTOCOL', '')
if SEATICKET_SERVER_HOSTNAME and SEATICKET_SERVER_PROTOCOL:
    SEAQA_WEB_SERVICE_URL = f'{SEATICKET_SERVER_PROTOCOL}://{SEATICKET_SERVER_HOSTNAME}'

# if Seafile admin enable remote user authentication in conf/seahub_settings.py
# then add 'seahub.auth.middleware.SeafileRemoteUserMiddleware' and
# 'seahub.auth.backends.SeafileRemoteUserBackend' to settings.
if ENABLE_REMOTE_USER_AUTHENTICATION:
    MIDDLEWARE.append('seahub.auth.middleware.SeafileRemoteUserMiddleware')
    AUTHENTICATION_BACKENDS += ('seahub.auth.backends.SeafileRemoteUserBackend',)

if ENABLE_CUSTOM_OAUTH or ENABLE_OAUTH:
    AUTHENTICATION_BACKENDS += ('seahub.oauth.backends.OauthRemoteUserBackend',)

if ENABLE_SAML or ENABLE_MULTI_SAML:
    MIDDLEWARE.append('djangosaml2.middleware.SamlSessionMiddleware')
    AUTHENTICATION_BACKENDS += ('seahub.saml.backends.SAMLRemoteUserBackend',)
    SAML_CONFIG_LOADER = 'seahub.saml.utils.config_settings_loader'

if ENABLE_LDAP:
    AUTHENTICATION_BACKENDS += ('seahub.base.accounts.CustomLDAPBackend',)

# set the log level
if LOG_LEVEL in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
    try:
        LOGGING['loggers']['']['level'] = LOG_LEVEL
        LOGGING['loggers']['django.request']['level'] = LOG_LEVEL
        LOGGING['loggers']['py.warnings']['level'] = LOG_LEVEL
    except:
        pass


S3_HOST = configs.get('S3_HOST', S3_HOST)
S3_FILE_BUCKET = configs.get('S3_FILE_BUCKET', S3_FILE_BUCKET)
S3_WEB_CRAWL_BUCKET = configs.get('S3_WEB_CRAWL_BUCKET', S3_WEB_CRAWL_BUCKET)
S3_KEY_ID = configs.get('S3_KEY_ID', S3_KEY_ID)
S3_SECRET_KEY = configs.get('S3_SECRET_KEY', S3_SECRET_KEY)

SEADB_SERVER_URL = configs.get('SEADB_SERVER_URL', SEADB_SERVER_URL)
SEADB_SERVER_ACCESS_TOKEN = configs.get('SEADB_SERVER_ACCESS_TOKEN', SEADB_SERVER_ACCESS_TOKEN)

SEAQA_INDEXER_INNER_SERVER_URL = configs.get('SEAQA_INDEXER_INNER_SERVER_URL', SEAQA_INDEXER_INNER_SERVER_URL)
SEAQA_AI_INNER_SERVER_URL = configs.get('SEAQA_AI_INNER_SERVER_URL', SEAQA_AI_INNER_SERVER_URL)
SEAQA_EVENTS_INNER_SERVER_URL = configs.get('SEAQA_EVENTS_INNER_SERVER_URL', SEAQA_EVENTS_INNER_SERVER_URL)

TEMP_EXPORT_VIEW_DIR = configs.get('TEMP_EXPORT_VIEW_DIR', TEMP_EXPORT_VIEW_DIR)

EMAIL_HOST = configs.get('EMAIL_HOST', EMAIL_HOST)
EMAIL_HOST_USER = configs.get('EMAIL_HOST_USER', EMAIL_HOST_USER)
EMAIL_HOST_PASSWORD = configs.get('EMAIL_HOST_PASSWORD', EMAIL_HOST_PASSWORD)
EMAIL_PORT = configs.get('EMAIL_PORT', EMAIL_PORT)
DEFAULT_FROM_EMAIL = configs.get('DEFAULT_FROM_EMAIL', DEFAULT_FROM_EMAIL)
SERVER_EMAIL = configs.get('SERVER_EMAIL', EMAIL_HOST_USER)

SECRET_KEY = configs.get('SECRET_KEY', SECRET_KEY)
if not SECRET_KEY:
    raise ValueError("SECRET_KEY is required in configs")

GITHUB_APP_NAME = configs.get('GITHUB_APP_NAME', GITHUB_APP_NAME)
GITHUB_WEBHOOK_SECRET = configs.get('GITHUB_WEBHOOK_SECRET', GITHUB_WEBHOOK_SECRET)
GITHUB_APP_ID = configs.get('GITHUB_APP_ID', GITHUB_APP_ID)
GITHUB_PRIVATE_KEY_PATH = configs.get('GITHUB_PRIVATE_KEY_PATH', GITHUB_PRIVATE_KEY_PATH)

# compatible for seaqa-ai's config
ATTACHMENT_CONTENT_MAX_SIZE = configs.get('ATTACHMENT_CONTENT_MAX_SIZE', 0) or configs.get('SEARCH_TOOL_CONTENT_MAX_SIZE', 0) or ATTACHMENT_CONTENT_MAX_SIZE
ATTACHMENT_ISSUE_MAX_COMMENTS = configs.get('ATTACHMENT_ISSUE_MAX_COMMENTS', 0) or configs.get('SEARCH_TOOL_ISSUES_MAX_COMMENTS', 0) or ATTACHMENT_ISSUE_MAX_COMMENTS

try:
    with open(GITHUB_PRIVATE_KEY_PATH, "r") as f:
        GITHUB_PRIVATE_KEY = f.read()
except:
    GITHUB_PRIVATE_KEY = ''

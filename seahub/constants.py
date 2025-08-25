# Copyright (c) 2012-2016 Seafile Ltd.
import seahub.settings as settings
# Default user have common operations, like creating group and library.
DEFAULT_USER = 'default'

# Guest user have limited operations, can not create group and library.
GUEST_USER = 'guest'

# Default org member
ORG_DEFAULT = 'org_default'

# Plus
USER_PLUS = 'user_plus'
ORG_PLUS = 'org_plus'
ORG_ENTERPRISE = 'org_enterprise'

# Repo status
REPO_STATUS_NORMAL = 'normal'
REPO_STATUS_READ_ONLY = 'read-only'

# Repo/folder permissions
PERMISSION_PREVIEW = 'preview'  # preview only on the web, can not be downloaded
PERMISSION_PREVIEW_EDIT = 'cloud-edit'  # preview only with edit on the web
PERMISSION_READ = 'r'
PERMISSION_READ_WRITE = 'rw'
PERMISSION_CUSTOM = 'custom'
PERMISSION_ADMIN = 'admin'
PERMISSION_PREFIX = 'c-'  # custom permission prefix

# datble notification/automation rule run connditions
RUN_CONDITION_PER_DAY = 'per_day'
RUN_CONDITION_PER_WEEK = 'per_week'
RUN_CONDITION_PER_MONTH = 'per_month'
RUN_CONDITION_PER_UPDATE = 'per_update'
RUN_CONDITION_LIST = [RUN_CONDITION_PER_DAY, RUN_CONDITION_PER_WEEK, RUN_CONDITION_PER_UPDATE]

DEFAULT_ADMIN = 'default_admin'
SYSTEM_ADMIN = 'system_admin'
DAILY_ADMIN = 'daily_admin'
AUDIT_ADMIN = 'audit_admin'

HASH_URLS = {
        'GROUP_MEMBERS': settings.SITE_ROOT + '#group/%(group_id)s/members/',
        'GROUP_DISCUSS': settings.SITE_ROOT + '#group/%(group_id)s/discussions/',
        'SYS_REPO_ADMIN': settings.SITE_ROOT + 'sysadmin/#all-libs/',
        }

# external link abuse report type
COPYRIGHT_ISSUE = 'copyright'
VIRUS_ISSUE = 'virus'
ABUSE_CONTENT_ISSUE = 'abuse_content'
OTHER_ISSUE = 'other'

ABUSE_TYPE_LIST = [COPYRIGHT_ISSUE, VIRUS_ISSUE, ABUSE_CONTENT_ISSUE, OTHER_ISSUE]

# {<:node_id>:<:domain>} such as {"project-server-01": "https://project-server-01.seatable.cn", "project-server-02": ...}
ETCD_SERVER_KEY_PREFIX = 'project-server-'
ETCD_ASSIGN_KEY_PREFIX = 'assign-'


SAML_CERTS_DIR = '/opt/seaqa/seaqa-data/certs'
SAML_ATTRIBUTE_MAPPING = {
    'name': ('display_name', ),
    'mail': ('contact_email', ),
}

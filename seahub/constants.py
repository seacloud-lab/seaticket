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
# dtable notification/automation rule trigger condition
TRIGGER_CONDITION_ROWS_MODIFIED = 'rows_modified'
TRIGGER_CONDITION_ROWS_ADDED = 'rows_added'
TRIGGER_CONDITION_FILTERS_SATISFY = 'filters_satisfy'
TRIGGER_CONDITION_NEAR_DEADLINE = 'near_deadline'
TRIGGER_CONDITION_PERIODICALLY = 'run_periodically'
TRIGGER_CONDITION_PERIODICALLY_BY_CONDITION = 'run_periodically_by_condition'
TRIGGER_CONDITION_LIST = [TRIGGER_CONDITION_ROWS_MODIFIED, TRIGGER_CONDITION_FILTERS_SATISFY, TRIGGER_CONDITION_NEAR_DEADLINE]

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

# {<:node_id>:<:domain>} such as {"dtable-server-01": "https://dtabler-server-01.seatable.cn", "dtable-server-02": ...}
ETCD_SERVER_KEY_PREFIX = 'dtable-server-'
ETCD_ASSIGN_KEY_PREFIX = 'assign-'

PASSWORD_ADD = 'password_add'
PASSWORD_MODIFY = 'password_modify'
PASSWORD_UNSET = 'password_unset'
PASSWORD_UNSET_BY_PHONE = 'password_unset_by_phone'


SAML_CERTS_DIR = '/opt/seatable/seahub-data/certs'
SAML_ATTRIBUTE_MAP = {
  'uid': 'uid',
  'contact_email': 'contact_email',
  'name': 'name',
  'employee_id': 'employee_id',
  'user_role': 'user_role',
}

# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from django.conf import settings
from seahub.constants import DEFAULT_USER, DEFAULT_ADMIN, SYSTEM_ADMIN, \
    DAILY_ADMIN, AUDIT_ADMIN, TEAM_FREE, TEAM_START, TEAM_PRO, \
        TEAM_BUSINESS, TEAM_ENTERPRISE

# Get an instance of a logger
logger = logging.getLogger(__name__)


def merge_roles(default, custom, fallback_role):
    """
        used for both user role perms and admin role perms
        because two have same structure

        user's role should use 'default' as fallback_role
        admin'r role should use 'dummy_admin' as fallback_role, which set all perms to False

        merge all role's permission based on fallback_role
        inherit prority order (descending order):
            attr in custom setting
            attr in this file except fallback_role
            attr in fallback_role
    """
    merged_perms = {}
    for role in default:
        default_role_copy = default[fallback_role].copy()
        default_role_copy.update(default[role])
        merged_perms[role] = default_role_copy

    for role in custom:
        if role in merged_perms:
            default_role_copy = merged_perms[role].copy()
        else:
            default_role_copy = default[fallback_role].copy()
        default_role_copy.update(custom[role])
        merged_perms[role] = default_role_copy

    return merged_perms


DEFAULT_ENABLED_ROLE_PERMISSIONS = {
    DEFAULT_USER: {
        'can_add_project': True,
        'can_add_group': True,
        'can_use_saml': False,
        'monthly_api_call_limit_per_user': -1,
    },
    TEAM_FREE: {
        'can_add_project': True,
        'can_add_group': True,
        'can_use_saml': False,
        'monthly_api_call_limit_per_user': -1,
    },
    TEAM_START: {
        'can_add_project': True,
        'can_add_group': True,
        'can_use_saml': False,
        'monthly_api_call_limit_per_user': -1,
    },
    TEAM_PRO: {
        'can_add_project': True,
        'can_add_group': True,
        'can_use_saml': False,
        'monthly_api_call_limit_per_user': -1,
    },
    TEAM_BUSINESS: {
        'can_add_project': True,
        'can_add_group': True,
        'can_use_saml': True,
        'monthly_api_call_limit_per_user': -1,
    },
    TEAM_ENTERPRISE: {
        'can_add_project': True,
        'can_add_group': True,
        'can_use_saml': True,
        'monthly_api_call_limit_per_user': -1,
    },
}

try:
    custom_role_permissions = settings.ENABLED_ROLE_PERMISSIONS
except AttributeError:
    custom_role_permissions = {}

ENABLED_ROLE_PERMISSIONS = merge_roles(
    DEFAULT_ENABLED_ROLE_PERMISSIONS,
    custom_role_permissions,
    fallback_role=DEFAULT_USER
)

# role permission for administraror
# this role is used for perm merge, all other admin role are base on this role
DUMMY_ADMIN = 'dummy_admin'

DEFAULT_ENABLED_ADMIN_ROLE_PERMISSIONS = {
    DUMMY_ADMIN: {
        'can_view_system_info': False,
        'can_view_statistic': False,
        'can_config_system': False,
        'can_manage_user': False,
        'can_update_user': False,
        'can_manage_group': False,
        'can_view_user_log': False,
        'can_view_audit_log': False,
        'can_view_admin_log': False,

        'can_manage_project': False,
        'can_manage_organization': False,
        'can_update_organization': False,
        'can_manage_sys_notification': False,

        'other_permission': False,
    },
    DEFAULT_ADMIN: {
        'can_view_system_info': True,
        'can_view_statistic': True,
        'can_config_system': True,
        'can_manage_user': True,
        'can_update_user': True,
        'can_manage_group': True,
        'can_view_user_log': True,
        'can_view_audit_log': True,
        'can_view_admin_log': True,
        'can_manage_project': True,
        'can_manage_organization': True,
        'can_update_organization': True,
        'can_manage_sys_notification': True,
        'other_permission': True,
    },
    # SYSTEM_ADMIN can ONLY view system-info(without upload licence), settings pages.
    SYSTEM_ADMIN: {
        'can_view_system_info': True,
        'can_config_system': True,
    },
    # DAILY_ADMIN can ONLY view system-info(without upload licence), statistic,
    # libraries, users(except 'Admins'), groups, user-logs pages.
    DAILY_ADMIN: {
        'can_view_system_info': True,
        'can_view_statistic': True,
        'can_manage_user': True,
        'can_update_user': True,
        'can_manage_group': True,
        'can_view_user_log': True,
        'can_view_audit_log': True,
    },
    # AUDIT_ADMIN can ONLY view system-info(without upload licence), admin-logs pages.
    AUDIT_ADMIN: {
        'can_view_system_info': True,
        'can_view_admin_log': True,
        'can_view_user_log': True,
        'can_view_audit_log': True,
    }
}

try:
    custom_admin_role_permissions = settings.ENABLED_ADMIN_ROLE_PERMISSIONS
except AttributeError:
    custom_admin_role_permissions = {}

ENABLED_ADMIN_ROLE_PERMISSIONS = merge_roles(
    DEFAULT_ENABLED_ADMIN_ROLE_PERMISSIONS,
    custom_admin_role_permissions,
    fallback_role=DUMMY_ADMIN,
)
ENABLED_ADMIN_ROLE_PERMISSIONS.pop(DUMMY_ADMIN)

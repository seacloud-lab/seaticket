# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from seahub.constants import DEFAULT_USER, \
        DEFAULT_ADMIN, SYSTEM_ADMIN, DAILY_ADMIN, AUDIT_ADMIN, \
        TEAM_FREE, TEAM_ROLES

logger = logging.getLogger(__name__)


def get_basic_user_roles():
    """Get predefined user roles.
    """
    return [DEFAULT_USER]

def get_user_role(user):
    """Get a user's role.

    Org (team) users inherit their team's role from OrgSettings.
    Non-org users fall back to DEFAULT_USER.
    """
    from seahub.organizations.models import Organization, OrgSettings

    try:
        org = Organization.objects.get_org_by_username(user.email)
    except Exception:
        org = None

    if org:
        role = OrgSettings.objects.get_role_by_org(org)
        return role

    return DEFAULT_USER

def get_basic_admin_roles():
    """Get predefined admin roles.
    """
    return [DEFAULT_ADMIN, SYSTEM_ADMIN, DAILY_ADMIN, AUDIT_ADMIN]


# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from seahub.constants import TEAM_FREE

logger = logging.getLogger(__name__)


def get_user_role(user):
    """Get a user's role.

    Org (team) users inherit their team's role from OrgSettings.
    Non-org users fall back to TEAM_FREE.
    """
    from seahub.organizations.models import Organization, OrgSettings

    try:
        org = Organization.objects.get_org_by_username(user.email)
    except Exception:
        org = None

    if org:
        role = OrgSettings.objects.get_role_by_org(org)
        return role

    return TEAM_FREE

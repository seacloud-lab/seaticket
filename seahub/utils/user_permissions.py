# Copyright (c) 2012-2016 Seafile Ltd.
from seahub.constants import DEFAULT_USER, GUEST_USER, \
        DEFAULT_ADMIN, SYSTEM_ADMIN, DAILY_ADMIN, AUDIT_ADMIN
from seahub.role_permissions.models import UserRole

def get_basic_user_roles():
    """Get predefined user roles.
    """
    return [DEFAULT_USER, GUEST_USER]

def get_user_role(user):
    """Get a user's role.
    """

    try:
        user_role = UserRole.objects.get_user_role(user.email)
    except UserRole.DoesNotExist:
        user_role = None

    if not user_role or user_role is None:
        return DEFAULT_USER

    if user_role.role is None or user_role.role == '' or user_role.role == DEFAULT_USER:
        return DEFAULT_USER

    if user_role.role == GUEST_USER:
        return GUEST_USER

    return user_role.role            # custom user role

def get_basic_admin_roles():
    """Get predefined admin roles.
    """
    return [DEFAULT_ADMIN, SYSTEM_ADMIN, DAILY_ADMIN, AUDIT_ADMIN]


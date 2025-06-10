from django.conf import settings


from seahub.auth.backends import RemoteUserBackend
from seahub.base.accounts import User
from seahub.registration.models import notify_admins_on_register_complete,\
     notify_admins_on_activate_request


class SAMLRemoteUserBackend(RemoteUserBackend):
    """
    This backend is to be used in conjunction with the ``RemoteUserMiddleware``
    found in the middleware module of this package, and is used when the server
    is handling authentication outside of Django.
    """

    # Create a User object if not already in the database
    create_unknown_user = getattr(settings, 'SAML_CREATE_UNKNOWN_USER', True)
    # Create active user by default.
    activate_after_creation = getattr(settings, 'SAML_ACTIVATE_USER_AFTER_CREATION', True)

    def get_user(self, username):
        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            user = None
        return user

    def authenticate(self, request=None, saml_username=None, org_id=None):
        """
        The username passed as ``saml_username`` is considered trusted.  This
        method simply returns the ``User`` object with the given username
        """
        if saml_username:
            username = self.clean_username(saml_username)
            user = self.get_user(username)
        else:
            user = None

        if not user and self.create_unknown_user:
            user = User.objects.create_saml_user(is_active=self.activate_after_creation)
            # add org user
            if org_id and org_id > 0:
                ccnet_api.add_org_user(org_id, user.username, 0)

            if not self.activate_after_creation:
                notify_admins_on_activate_request(user.username)
            elif settings.NOTIFY_ADMIN_AFTER_REGISTRATION:
                notify_admins_on_register_complete(user.username)

        return user

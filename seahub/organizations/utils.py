import requests
import logging
from rest_framework import status
from django.core.cache import cache
from django.urls import reverse

from seahub.api2.utils import api_error
from seahub.utils import gen_token, get_site_scheme_and_netloc
from seahub.weixin.utils import weixin_check
from seahub.project.models import Workspaces
from seahub.organizations.models import OrgSettings
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from django.utils.crypto import get_random_string

logger = logging.getLogger(__name__)


def check_org_admin(func):
    # return decorated function if request.user is admin of the specific org,
    # raise 403 otherwise
    def _decorated(view, request, org_id, *args, **kwargs):
        org = request.user.org
        if org and org.is_staff:
            org_id = int(org_id)
            if org_id == request.user.org.org_id:
                return func(view, request, org_id, *args, **kwargs)
            else:
                return api_error(status.HTTP_403_FORBIDDEN, '')
        else:
            return api_error(status.HTTP_403_FORBIDDEN, '')

    return _decorated

def update_log_perm_audit_type(event):
    if event.to.isdigit():
        etype = event.etype.replace('-', '-group-', 1)
    elif event.to == 'all':
        etype = event.etype.replace('-', '-public-', 1)
    else:
        etype = event.etype.replace('-', '-user-', 1)

    etype = etype.replace('perm', 'permission')
    return etype

def get_or_create_invitation_link(org_id):
    """Invitation link for an org. Users will be redirected to WeChat QR page.
    """
    if not weixin_check():
        return None

    org_id = int(org_id)
    expires = 3 * 24 * 60 * 60

    def get_token_by_org_id(org_id):
        return cache.get('org_associate_%d' % org_id, None)

    def set_token_by_org_id(org_id, token):
        cache.set('org_associate_%d' % org_id, token, expires)

    def get_org_id_by_token(token):
        return cache.get('org_associate_%s' % token, -1)

    def set_org_id_by_token(token, org_id):
        cache.set('org_associate_%s' % token, org_id, expires)

    token = get_token_by_org_id(org_id)
    cached_org_id = get_org_id_by_token(token)

    if not token or org_id != cached_org_id:
        token = gen_token(32)
        set_token_by_org_id(org_id, token)
        set_org_id_by_token(token, org_id)

    link = get_site_scheme_and_netloc() + reverse('weixin_oauth_login') \
        + '?org_token=' + token
    return link


def transfer_user_to_org(username, org_id):
    from seahub.base.accounts import User
    from seahub.constants import DEFAULT_USER
    try:
        # transfer user to org
        ccnet_api.add_org_user(org_id, username, int(False))

        # reset role
        User.objects.update_role(username, DEFAULT_USER)

        # transfer workspace to org
        workspace = Workspaces.objects.get_workspace_by_owner(username)
        if workspace:
            workspace.org_id = org_id
            workspace.save(update_fields=['org_id'])

        return True

    except Exception as e:
        logger.error('Transfer user %s to org error: %s' % (username, e))
        return False


def user_convert_to_org(username, org_id):
    try:
        # transfer workspace to org
        workspace = Workspaces.objects.get_workspace_by_owner(username)
        workspace.org_id = org_id
        workspace.save(update_fields=['org_id'])

        return True

    except Exception as e:
        logger.error('User convert %s to org error: %s' % (username, e))
        return False


def gen_org_url_prefix(max_trial=None):
    """Generate organization url prefix automatically.
    If ``max_trial`` is large than 0, then re-try that times if failed.

    Arguments:
    - `max_trial`:

    Returns:
        Url prefix if succed, otherwise, ``None``.
    """
    def _gen_prefix():
        url_prefix = 'org-' + get_random_string(
            6, allowed_chars='abcdefghijklmnopqrstuvwxyz0123456789')
        if ccnet_api.get_org_by_url_prefix(url_prefix) is not None:
            logger.info("org url prefix, %s is duplicated" % url_prefix)
            return None
        else:
            return url_prefix

    try:
        max_trial = int(max_trial)
    except (TypeError, ValueError):
        max_trial = 0

    while max_trial >= 0:
        ret = _gen_prefix()
        if ret is not None:
            return ret
        else:
            max_trial -= 1

    logger.warning("Failed to generate org url prefix, retry: %d" % max_trial)
    return None


def get_org_corp_bind_type(org_id):
    from seahub.organizations.models import OrgCorpAuth
    from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
    from seahub.org_dingtalk.settings import ORG_DINGTALK_PROVIDER
    org_corp_bind_type = ''
    org_corp = OrgCorpAuth.objects.get_by_org_id(org_id=org_id)
    if org_corp:
        if org_corp.permanent_code:
            org_corp_bind_type = ORG_WORK_WEIXIN_PROVIDER
        else:
            org_corp_bind_type = ORG_DINGTALK_PROVIDER
    return org_corp_bind_type


def can_org_use_saml(org):
    role = OrgSettings.objects.get_role_by_org(org)
    return get_enabled_role_permissions_by_role(role).get('can_use_saml', False)

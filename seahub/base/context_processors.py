# Copyright (c) 2012-2016 Seafile Ltd.
"""
A set of request processors that return dictionaries to be merged into a
template context. Each function takes the request object as its only parameter
and returns a dictionary to add to the context.

These are referenced from the setting TEMPLATE_CONTEXT_PROCESSORS and used by
RequestContext.
"""

import re
import os

from django.conf import settings as dj_settings
from django.utils import translation
from django.utils.functional import lazy
from constance import config

from seahub.settings import SITE_TITLE, SITE_NAME, ENABLE_BRANDING_CSS, \
    LOGO_PATH, BRANDING_CSS, LOGO_WIDTH, LOGO_HEIGHT,\
    SITE_ROOT, FAVICON_PATH, APPLE_TOUCH_ICON_PATH, FAVICON_NOTIFICATION_PATH, \
    MEDIA_ROOT, SHOW_LOGOUT_ICON, CUSTOM_LOGO_PATH, CUSTOM_FAVICON_PATH, CUSTOM_FAVICON_NOTIFICATION_PATH, \
    LOGIN_BG_IMAGE_PATH, CUSTOM_LOGIN_BG_PATH, PRIVACY_POLICY_LINK, TERMS_OF_SERVICE_LINK, \
    ENABLE_SIGNUP, CN_FORCE_USER_AGREE_TERMS

from seahub.constants import DEFAULT_ADMIN
from seahub.utils import get_site_name, get_service_url
from seahub.avatar.templatetags.avatar_tags import api_avatar_url


from seahub.utils import is_pro_version

try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False

from seahub.organizations.settings import ENABLE_ORG_LOGO
SEAQA_VERSION = getattr(dj_settings, 'SEAQA_VERSION', 'Dev')


def base(request):
    """
    Add seahub base configure to the context.

    """
    try:
        org = request.user.org
    except AttributeError:
        org = None

    # extra repo id from request path, use in search
    repo_id_patt = r".*/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})/.*"
    m = re.match(repo_id_patt, request.get_full_path())
    search_repo_id = m.group(1) if m is not None else None
    logo_path = LOGO_PATH
    favicon_path = FAVICON_PATH
    apple_touch_icon_path = APPLE_TOUCH_ICON_PATH
    favicon_notification_path = FAVICON_NOTIFICATION_PATH
    login_bg_path = LOGIN_BG_IMAGE_PATH

    # filter ajax/api request out
    avatar_url = ''
    username = request.user.username
    if (not request.headers.get('x-requested-with') == 'XMLHttpRequest') and ("api2/" not in request.path) and \
            ("api/v2.1/" not in request.path):

        # get logo path
        custom_logo_file = os.path.join(MEDIA_ROOT, CUSTOM_LOGO_PATH)
        if os.path.exists(custom_logo_file):
            logo_path = CUSTOM_LOGO_PATH

        from seahub.utils.user_permissions import get_user_role
        from seahub.organizations.models import OrgAdminSettings

        if ENABLE_ORG_LOGO and org and request.user.permissions.can_use_advanced_customization():
            org_logo_url = OrgAdminSettings.objects.get_org_logo_url(org.org_id)
            if org_logo_url:
                logo_path = org_logo_url

        # get favicon path
        custom_favicon_file = os.path.join(MEDIA_ROOT, CUSTOM_FAVICON_PATH)
        if os.path.exists(custom_favicon_file):
            favicon_path = CUSTOM_FAVICON_PATH
        custom_favicon_notification_file = os.path.join(MEDIA_ROOT, CUSTOM_FAVICON_NOTIFICATION_PATH)
        if os.path.exists(custom_favicon_notification_file):
            favicon_notification_path = CUSTOM_FAVICON_NOTIFICATION_PATH

        # get login bg path
        custom_login_bg_file = os.path.join(MEDIA_ROOT, CUSTOM_LOGIN_BG_PATH)
        if os.path.exists(custom_login_bg_file):
            login_bg_path = CUSTOM_LOGIN_BG_PATH

        avatar_url, is_default, date_uploaded = api_avatar_url(username)

    result = {
        'version': SEAQA_VERSION,
        'site_title': SITE_TITLE,
        'branding_css': BRANDING_CSS,
        'enable_branding_css': ENABLE_BRANDING_CSS,
        'favicon_path': favicon_path,
        'apple_touch_icon_path': apple_touch_icon_path,
        'favicon_notification_path': favicon_notification_path,
        'login_bg_path': login_bg_path,
        'logo_path': logo_path,
        'logo_width': LOGO_WIDTH,
        'logo_height': LOGO_HEIGHT,
        'cloud_mode': request.cloud_mode,
        'org': org,
        'site_name': get_site_name(),
        'enable_signup': ENABLE_SIGNUP,
        'events_enabled': False,
        'multi_tenancy': MULTI_TENANCY,
        'multi_institution': getattr(dj_settings, 'MULTI_INSTITUTION', False),
        'search_repo_id': search_repo_id,
        'SITE_ROOT': SITE_ROOT,
        'CSRF_COOKIE_NAME': dj_settings.CSRF_COOKIE_NAME,
        'LOGIN_URL': dj_settings.LOGIN_URL,
        'trash_clean_expire_days': dj_settings.TRASH_CLEAN_AFTER_DAYS,
        'show_logout_icon': SHOW_LOGOUT_ICON,
        'is_pro': True if is_pro_version() else False,
        'service_url': get_service_url().rstrip('/'),
        'avatar_url': avatar_url if avatar_url else '',
        'is_mobile': request.is_mobile,
        'is_tablet': request.is_tablet,
        'privacy_policy_link': PRIVACY_POLICY_LINK,
        'terms_of_service_link': TERMS_OF_SERVICE_LINK,
        'cn_force_check_user_agreement': request.cloud_mode and CN_FORCE_USER_AGREE_TERMS,
        'enable_user_set_contact_email': dj_settings.ENABLE_USER_SET_CONTACT_EMAIL
    }

    if request.user.is_staff:
        result['is_default_admin'] = request.user.admin_role == DEFAULT_ADMIN

    return result

def debug(request):
    """
    Returns context variables helpful for debugging.
    """
    context_extras = {}
    if dj_settings.DEBUG and request.META.get('REMOTE_ADDR') in dj_settings.INTERNAL_IPS or \
       dj_settings.DEBUG and request.GET.get('_dev', '') == '1':
        context_extras['debug'] = True
        from django.db import connection
        # Return a lazy reference that computes connection.queries on access,
        # to ensure it contains queries triggered after this function runs.
        context_extras['sql_queries'] = lazy(lambda: connection.queries, list)
    return context_extras

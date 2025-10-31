# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8

import logging
from constance import config

from django.conf import settings as dj_settings
from django.urls import reverse
from django.http import Http404, HttpResponseRedirect, HttpResponseNotAllowed
from django.shortcuts import render
from django.utils.translation import gettext as _

from seahub.base.decorators import sys_staff_required
from seahub.base.sudo_mode import update_sudo_mode_ts
from seahub.auth import authenticate
from seahub.auth.decorators import login_required
from seahub.role_permissions.utils import get_available_roles, get_available_admin_roles
from seahub.utils import send_html_email, get_site_name
from seahub.utils.ip import get_remote_ip
from seahub.utils.auth import get_login_bg_image_path
import seahub.settings as settings
from seahub.settings import IS_SHOW_UNIT, SEND_EMAIL_ON_ADDING_SYSTEM_MEMBER, \
    LOGIN_ATTEMPT_LIMIT
try:
    from seahub.settings import MULTI_TENANCY
    from seahub.organizations.models import OrgSettings
except ImportError:
    MULTI_TENANCY = False

from seahub.utils.two_factor_auth import has_two_factor_auth


logger = logging.getLogger(__name__)
FILE_TYPE = '.project'

@login_required
@sys_staff_required
def sysadmin_react_fake_view(request, **kwargs):

    expire_days = -1

    return render(request, 'sysadmin/sysadmin_react_app.html', {
        'is_show_unit': IS_SHOW_UNIT,
        'multi_tenancy': MULTI_TENANCY,
        'multi_institution': getattr(dj_settings, 'MULTI_INSTITUTION', False),
        'send_email_on_adding_system_member': SEND_EMAIL_ON_ADDING_SYSTEM_MEMBER,
        'trash_repos_expire_days': expire_days if expire_days > 0 else 30,
        'available_roles': get_available_roles(),
        'available_admin_roles': get_available_admin_roles(),
        'two_factor_auth_enabled': has_two_factor_auth(),
        'trash_clean_expire_days': dj_settings.TRASH_CLEAN_AFTER_DAYS,
    })


def send_user_reset_email(request, email, password):
    """
    Send email when reset user password.
    """

    c = {
        'email': email,
        'password': password,
        }
    send_html_email(_('Password has been reset on %s') % get_site_name(),
            'sysadmin/user_reset_email.html', c, None, [email])

def send_user_add_mail(request, email, password):
    """Send email when add new user."""
    c = {
        'user': request.user.username,
        'org': request.user.org,
        'email': email,
        'password': password,
        }
    send_html_email(_('You are invited to join %s') % get_site_name(),
            'sysadmin/user_add_email.html', c, None, [email])

@login_required
def sys_sudo_mode(request):
    if request.method not in ('GET', 'POST'):
        return HttpResponseNotAllowed

    # here we can't use @sys_staff_required
    if not request.user.is_staff:
        raise Http404

    next_page = request.GET.get('next', reverse('sys_info'))
    password_error = False
    if request.method == 'POST':
        password = request.POST.get('password')
        username = request.user.username
        ip = get_remote_ip(request)
        if password:
            user = authenticate(username=username, password=password)
            if user:
                update_sudo_mode_ts(request)

                from seahub.auth.utils import clear_login_failed_attempts
                clear_login_failed_attempts(request, username)

                return HttpResponseRedirect(next_page)
        password_error = True

        from seahub.auth.utils import get_login_failed_attempts, incr_login_failed_attempts
        failed_attempt = get_login_failed_attempts(username=username, ip=ip)
        if failed_attempt >= LOGIN_ATTEMPT_LIMIT:
            # logout user
            from seahub.auth import logout
            logout(request)
            return HttpResponseRedirect(reverse('auth_login'))
        else:
            incr_login_failed_attempts(username=username, ip=ip)

    enable_shib_login = getattr(settings, 'ENABLE_SHIB_LOGIN', False)
    enable_saml_login = getattr(settings, 'ENABLE_SAML', False)

    login_bg_image_path = get_login_bg_image_path()

    return render(request,
        'sysadmin/sudo_mode.html', {
            'password_error': password_error,
            'enable_sso': enable_shib_login or enable_saml_login,
            'next': next_page,
            'login_bg_image_path': login_bg_image_path,
        })

# Copyright (c) 2012-2016 Seafile Ltd.
import os
import sys
import logging

from saml2.ident import decode
from rest_framework.decorators import api_view, throttle_classes
from django.conf import settings
# Avoid shadowing the login() view below.
from django.views.decorators.csrf import csrf_protect
from django.urls import reverse
from django.contrib import messages
from django.shortcuts import render
from django.contrib.sites.shortcuts import get_current_site
from django.http import HttpResponseRedirect

from django.utils.http import base36_to_int, url_has_allowed_host_and_scheme
from urllib.parse import quote
from django.utils import translation
from django.utils.translation import gettext as _
from django.views.decorators.cache import never_cache

from seahub.auth import REDIRECT_FIELD_NAME
from seahub.auth import login as auth_login
from seahub.auth.decorators import login_required
from seahub.auth.forms import AuthenticationForm, CaptchaAuthenticationForm, \
        PasswordResetForm, SetPasswordForm, PasswordChangeForm, \
        SetContactEmailPasswordForm
from seahub.auth.signals import user_logged_in_failed
from seahub.auth.tokens import default_token_generator
from seahub.auth.utils import (
    get_login_failed_attempts, incr_login_failed_attempts,
    clear_login_failed_attempts)
from seahub.auth.models import SocialAuthUser
from seahub.base.accounts import User, UNUSABLE_PASSWORD
from seahub.options.models import UserOptions
from seahub.profile.models import Profile
from seahub.two_factor.views.login import is_device_remembered
from seahub.utils import render_error, get_site_name
from seahub.utils.ip import get_remote_ip
from seahub.utils.two_factor_auth import two_factor_auth_enabled, handle_two_factor_auth
from seahub.utils.auth import get_login_bg_image_path
from seahub.utils.http import rate_limit
from seahub.settings import LOGIN_ATTEMPT_LIMIT, FREEZE_USER_ON_LOGIN_FAILED, \
    LOGIN_REMEMBER_DAYS, USER_PASSWORD_MIN_LENGTH, USER_STRONG_PASSWORD_REQUIRED, \
    USER_PASSWORD_STRENGTH_LEVEL

try:
    from seahub.settings import LDAP_PROVIDER
except ImportError:
    LDAP_PROVIDER = ''

ENABLE_CUSTOM_AUTH = getattr(settings, 'ENABLE_CUSTOM_AUTH', False)
if ENABLE_CUSTOM_AUTH:
    try:
        current_path = os.path.dirname(os.path.abspath(__file__))
        conf_dir = os.path.join(current_path, '../../../../conf')
        sys.path.append(conf_dir)
        from seatable_custom_functions.custom_auth import custom_auth_login, custom_auth_logout
        ENABLE_CUSTOM_AUTH = True
    except ImportError:
        ENABLE_CUSTOM_AUTH = False

# Get an instance of a logger
logger = logging.getLogger(__name__)


def log_user_in(request, user, redirect_to):
    # Ensure the user-originating redirection url is safe.
    if not url_has_allowed_host_and_scheme(url=redirect_to, allowed_hosts=request.get_host()):
        redirect_to = settings.LOGIN_REDIRECT_URL

    if request.session.test_cookie_worked():
        request.session.delete_test_cookie()

    clear_login_failed_attempts(request, user.username)

    if two_factor_auth_enabled(user):
        if is_device_remembered(request.COOKIES.get('S2FA', ''), user):
            from seahub.two_factor.models import default_device
            user.otp_device = default_device(user)
        else:
            return handle_two_factor_auth(request, user, redirect_to)

    # Okay, security checks complete. Log the user in.
    auth_login(request, user)

    return HttpResponseRedirect(redirect_to)

def _handle_login_form_valid(request, user, redirect_to, remember_me):
    if UserOptions.objects.passwd_change_required(
            user.username):
        redirect_to = reverse('auth_password_change')
        request.session['force_passwd_change'] = True

    # password is valid, log user in
    request.session['remember_me'] = remember_me
    return log_user_in(request, user, redirect_to)

@csrf_protect
@never_cache
def login(request, template_name='registration/login.html',
          redirect_if_logged_in='project',
          redirect_field_name=REDIRECT_FIELD_NAME,
          authentication_form=AuthenticationForm):
    """Displays the login form and handles the login action."""

    redirect_to = request.GET.get(redirect_field_name, '')
    if request.user.is_authenticated:
        if redirect_to:
            return HttpResponseRedirect(redirect_to)
        else:
            return HttpResponseRedirect(reverse('projects_list'))

    source = request.GET.get('source', None)
    invitation_token = request.GET.get('invitation_token', None)
    ip = get_remote_ip(request)

    if request.method == "POST":
        login = request.POST.get('login', '').strip()
        failed_attempt = get_login_failed_attempts(username=login, ip=ip)
        remember_me = True if request.POST.get('remember_me',
                                               '') == 'on' else False
        redirect_to = request.POST.get(redirect_field_name, '') or redirect_to

        query_string = request.META.get('QUERY_STRING', '')
        query_index = query_string.find('&')
        if query_index != -1:
            if redirect_to.find('?') == -1:
                redirect_to += '?' + query_string[query_index + 1:]
            else:
                redirect_to += query_string[query_index:]

        # check the form
        used_captcha_already = False
        if bool(FREEZE_USER_ON_LOGIN_FAILED) is True:
            form = authentication_form(data=request.POST)
        else:
            if failed_attempt >= LOGIN_ATTEMPT_LIMIT:
                form = CaptchaAuthenticationForm(data=request.POST)
                used_captcha_already = True
            else:
                form = authentication_form(data=request.POST)

        if form.is_valid():
            return _handle_login_form_valid(request, form.get_user(),
                                            redirect_to, remember_me)

        # form is invalid
        user_logged_in_failed.send(sender=None, request=request)
        failed_attempt = incr_login_failed_attempts(username=login,
                                                    ip=ip)

        if failed_attempt >= LOGIN_ATTEMPT_LIMIT:
            if bool(FREEZE_USER_ON_LOGIN_FAILED) is True:
                # log user in if password is valid otherwise freeze account
                logger.warn('Login attempt limit reached, try freeze the user, email/username: %s, ip: %s, attemps: %d' %
                            (login, ip, failed_attempt))
                email = Profile.objects.convert_login_str_to_username(login)
                if email is None:
                    email = login
                try:
                    user = User.objects.get(email)
                    if user.is_active:
                        user.freeze_user(notify_admins=True)
                        logger.warn('Login attempt limit reached, freeze the user email/username: %s, ip: %s, attemps: %d' %
                                    (login, ip, failed_attempt))
                except User.DoesNotExist:
                    logger.warn('Login attempt limit reached with invalid email/username: %s, ip: %s, attemps: %d' %
                                (login, ip, failed_attempt))
                    pass
                form.errors['freeze_account'] = _('This account has been frozen due to too many failed login attempts.')
            else:
                # use a new form with Captcha
                logger.warn('Login attempt limit reached, show Captcha, email/username: %s, ip: %s, attemps: %d' %
                            (login, ip, failed_attempt))
                if not used_captcha_already:
                    form = CaptchaAuthenticationForm()

    else:
        ### GET
        failed_attempt = get_login_failed_attempts(ip=ip)
        if failed_attempt >= LOGIN_ATTEMPT_LIMIT:
            if bool(FREEZE_USER_ON_LOGIN_FAILED) is True:
                form = authentication_form()
            else:
                logger.warn('Login attempt limit reached, show Captcha, ip: %s, attempts: %d' %
                            (ip, failed_attempt))
                form = CaptchaAuthenticationForm()
        else:
            form = authentication_form()

    request.session.set_test_cookie()
    current_site = get_current_site(request)

    multi_tenancy = getattr(settings, 'MULTI_TENANCY', False)

    if getattr(settings, 'ENABLE_SIGNUP', False):
        if multi_tenancy:
            signup_url = reverse('org_register')
        else:
            signup_url = reverse('registration_register')
    else:
        signup_url = ''

    enable_sso = getattr(settings, 'ENABLE_SAML', False) or \
                 getattr(settings, 'ENABLE_OAUTH', False) or \
                 getattr(settings, 'ENABLE_CUSTOM_OAUTH', False) or \
                 getattr(settings, 'ENABLE_CAS', False) or \
                 getattr(settings, 'ENABLE_REMOTE_USER_AUTHENTICATION', False)

    login_bg_image_path = get_login_bg_image_path()
    cur_language = translation.get_language()

    response = render(request, template_name, {
        'form': form,
        redirect_field_name: redirect_to,
        'site': current_site,
        'site_name': get_site_name(),
        'remember_days': LOGIN_REMEMBER_DAYS,
        'signup_url': signup_url,
        'enable_sso': enable_sso,
        'enable_multi_saml': getattr(settings, 'ENABLE_MULTI_SAML', False),
        'login_bg_image_path': login_bg_image_path,
        'email_host': settings.EMAIL_HOST,
        'cur_language': cur_language,
    })

    if source:
        response.set_cookie('REGISTRATION_SOURCE', source)
    if invitation_token:
        response.set_cookie('INVITATION_TOKEN', invitation_token)

    return response


def logout(request, next_page=None,
           template_name='registration/logged_out.html',
           redirect_field_name=REDIRECT_FIELD_NAME):
    "Logs out the user and displays 'You are logged out' message."

    if getattr(settings, 'ENABLE_MULTI_SAML', False) or getattr(settings, 'ENABLE_SAML', False):
        try:
            saml_subject_id = decode(request.saml_session["_saml2_subject_id"])
            if saml_subject_id:
                from seahub.utils import is_org_context
                if is_org_context(request):
                    org_id = request.user.org.org_id
                    response = HttpResponseRedirect('/org/custom/%s/saml/logout/' % str(org_id))
                else:
                    response = HttpResponseRedirect('/saml/logout/')
                response.delete_cookie('seahub_auth')
                return response
        except Exception as e:
            logger.warning(e)

    from seahub.auth import logout
    logout(request)

    # Local logout for ouath user.
    via_oauth = request.COOKIES.get('via_oauth', '')
    oauth_logout_url = getattr(settings, 'OAUTH_LOGOUT_URL', '')
    if (getattr(settings, 'ENABLE_OAUTH', False) or getattr(settings, 'ENABLE_CUSTOM_OAUTH', False)) and via_oauth and oauth_logout_url:
        response = HttpResponseRedirect(oauth_logout_url)
        response.delete_cookie('via_oauth')
        response.delete_cookie('seahub_auth')
        return response

    # Local logout for cas user.
    if getattr(settings, 'ENABLE_CAS', False):
        response = HttpResponseRedirect(reverse('cas_ng_logout'))

    if redirect_field_name in request.GET:
        next_page = request.GET[redirect_field_name]
        # Security check -- don't allow redirection to a different host.
        if not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
            next_page = request.path

    if next_page is None:
        redirect_to = request.GET.get(redirect_field_name, '')
        if redirect_to:
            response = HttpResponseRedirect(redirect_to)
        else:
            response = render(request, template_name, {
                'title': _('Logged out')
            })
    else:
        # Redirect to this page until the session has been cleared.
        response = HttpResponseRedirect(next_page or request.path)

    response.delete_cookie('seahub_auth')
    return response

def logout_then_login(request, login_url=None):
    "Logs out the user if he is logged in. Then redirects to the log-in page."
    if not login_url:
        login_url = settings.LOGIN_URL
    return logout(request, login_url)

def redirect_to_login(next, login_url=None, redirect_field_name=REDIRECT_FIELD_NAME):
    "Redirects the user to the login page, passing the given 'next' page"
    if not login_url:
        login_url = settings.LOGIN_URL
    return HttpResponseRedirect('%s?%s=%s' % (login_url, quote(redirect_field_name), quote(next)))


### Custom Auth Login
def custom_login(request, template_name='registration/login.html',
          redirect_if_logged_in='project',
          redirect_field_name=REDIRECT_FIELD_NAME,
          authentication_form=AuthenticationForm):
    if not ENABLE_CUSTOM_AUTH:
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        # already authenticated
        redirect_url = request.GET.get(REDIRECT_FIELD_NAME, settings.LOGIN_REDIRECT_URL)
        return HttpResponseRedirect(redirect_url)

    return custom_auth_login(request, template_name, redirect_if_logged_in, redirect_field_name, authentication_form)


def custom_logout(request, next_page=None,
           template_name='registration/logged_out.html',
           redirect_field_name=REDIRECT_FIELD_NAME):
    if not ENABLE_CUSTOM_AUTH:
        return render_error(request, _('Feature is not enabled.'))

    return custom_auth_logout(request, next_page, template_name, redirect_field_name)


# 4 views for password reset:
# - password_reset sends the mail
# - password_reset_done shows a success message for the above
# - password_reset_confirm checks the link the user clicked and
#   prompts for a new password
# - password_reset_complete shows a success message for the above


@csrf_protect
@api_view(['GET', 'POST'])
@rate_limit()
def password_reset(request, is_admin_site=False, template_name='registration/password_reset_form.html',
        email_template_name='registration/password_reset_email.html',
        password_reset_form=PasswordResetForm, token_generator=default_token_generator,
        post_reset_redirect=None):

    has_bind_social_auth = False
    if SocialAuthUser.objects.filter(username=request.user.username).exists():
        has_bind_social_auth = True

    has_bind_ldap_auth = False
    if SocialAuthUser.objects.filter(username=request.user.username, provider=LDAP_PROVIDER).exists():
        has_bind_ldap_auth = True

    can_reset_password = True
    if (not settings.ENABLE_SSO_USER_CHANGE_PASSWORD) and has_bind_social_auth:
        can_reset_password = False

    if settings.ENABLE_LDAP and (not settings.ENABLE_LDAP_USER_CHANGE_PASSWORD) and has_bind_ldap_auth:
        can_reset_password = False

    if not can_reset_password:
        return render_error(request, _('Unable to reset password.'))

    if post_reset_redirect is None:
        post_reset_redirect = reverse('auth_password_reset_done')
    if request.method == "POST":
        form = password_reset_form(request.POST)
        if form.is_valid():
            opts = {}
            opts['use_https'] = request.is_secure()
            opts['token_generator'] = token_generator
            if is_admin_site:
                opts['domain_override'] = request.META['HTTP_HOST']
            else:
                opts['email_template_name'] = email_template_name
                opts['domain_override'] = get_current_site(request).domain
            try:
                form.save(**opts)
            except Exception as e:
                logger.error(str(e))
                messages.error(request, _('Failed to send email, please contact administrator.'))
                return render(request, template_name, {
                        'form': form,
                        })
            else:
                return HttpResponseRedirect(post_reset_redirect)
    else:
        form = password_reset_form()

    login_bg_image_path = get_login_bg_image_path()

    return render(request, template_name, {
        'form': form,
        'login_bg_image_path': login_bg_image_path,
    })

def password_reset_done(request, template_name='registration/password_reset_done.html'):

    login_bg_image_path = get_login_bg_image_path()

    return render(request, template_name, {
        'login_bg_image_path': login_bg_image_path,
    })


@csrf_protect
@never_cache
def password_reset_confirm(request, uidb36=None, token=None,
        template_name='registration/password_reset_confirm.html',
        token_generator=default_token_generator,
        set_password_form=SetPasswordForm,
        post_reset_redirect=None,
        extra_context=None):

    if post_reset_redirect is None:
        post_reset_redirect = reverse('auth_password_reset_complete')

    user = None
    try:
        uid_int = base36_to_int(uidb36)
        user = User.objects.get(id=uid_int)
    except (TypeError, ValueError, User.DoesNotExist):
        pass

    validlink = bool(user and token_generator.check_token(user, token))
    form = None
    if validlink:
        if request.method == 'POST':
            form = set_password_form(user, request.POST)
            if form.is_valid():
                form.save()
                return HttpResponseRedirect(post_reset_redirect)
        else:
            form = set_password_form(user)

    login_bg_image_path = get_login_bg_image_path()
    context = {
        'form': form,
        'validlink': validlink,
        'login_bg_image_path': login_bg_image_path,
        'strong_pwd_required': int(USER_STRONG_PASSWORD_REQUIRED),
    }
    if extra_context is not None:
        context.update(extra_context)

    return render(request, template_name, context)


def password_reset_complete(request, template_name='registration/password_reset_complete.html'):

    login_bg_image_path = get_login_bg_image_path()

    return render(request, template_name, {
        'login_bg_image_path': login_bg_image_path,
    })


@login_required
@csrf_protect
@never_cache
def password_change(request, template_name='registration/password_change_form.html',
        password_change_form=PasswordChangeForm, post_change_redirect=None,
        extra_context=None):

    if post_change_redirect is None:
        post_change_redirect = reverse('auth_password_change_done')

    if request.method == 'POST':
        form = password_change_form(request.user, request.POST)
        if form.is_valid():
            form.save()
            UserOptions.objects.unset_force_passwd_change(request.user.username)
            request.session.pop('force_passwd_change', None)
            return HttpResponseRedirect(post_change_redirect)
    else:
        form = password_change_form(request.user)

    context = {
        'form': form,
        'strong_pwd_required': int(USER_STRONG_PASSWORD_REQUIRED),
    }
    if extra_context is not None:
        context.update(extra_context)

    return render(request, template_name, context)


def password_change_done(request, template_name='registration/password_change_done.html'):
    return render(request, template_name)

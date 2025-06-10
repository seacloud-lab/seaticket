# Copyright (c) 2012-2016 Seafile Ltd.
import jwt
import hashlib
import logging
from datetime import datetime

from django.conf import settings
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.utils.http import url_has_allowed_host_and_scheme
from urllib.parse import quote
from django.utils.translation import gettext as _
from django.shortcuts import render

from seahub.auth import REDIRECT_FIELD_NAME
from seahub.auth import login as auth_login
from seahub.utils import render_error, is_valid_email
from seahub.utils.auth import get_login_bg_image_path
from seahub.settings import SSO_SECRET_KEY, SITE_ROOT
from seahub.base.accounts import User
from seahub.base.accounts import AuthBackend
from seahub.profile.models import Profile
from seahub.organizations.models import OrgSAMLConfig


def sso(request):
    # Ensure the user-originating redirection url is safe.
    if REDIRECT_FIELD_NAME in request.GET:
        next_page = request.GET[REDIRECT_FIELD_NAME]
        if not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
            next_page = settings.LOGIN_REDIRECT_URL
    else:
        next_page = reverse('dtable')

    if getattr(settings, 'ENABLE_REMOTE_USER_AUTHENTICATION', False):
        return HttpResponseRedirect(next_page)

    if getattr(settings, 'ENABLE_SHIB_LOGIN', False):
        return HttpResponseRedirect(next_page)

    if getattr(settings, 'ENABLE_KRB5_LOGIN', False):
        return HttpResponseRedirect(next_page)

    # send next page back to other views
    next_param = '?%s=' % REDIRECT_FIELD_NAME + quote(next_page)
    if getattr(settings, 'ENABLE_SAML', False):
        return HttpResponseRedirect(reverse('saml_login') + next_param)

    if getattr(settings, 'ENABLE_OAUTH', False):
        return HttpResponseRedirect(reverse('oauth_login') + next_param)

    if getattr(settings, 'ENABLE_CUSTOM_OAUTH', False):
        return HttpResponseRedirect(reverse('oauth_login') + next_param)

    if getattr(settings, 'ENABLE_CAS', False):
        return HttpResponseRedirect(reverse('cas_ng_login') + next_param)

    if getattr(settings, 'ENABLE_WORK_WEIXIN', False):
        return HttpResponseRedirect(reverse('work_weixin_oauth_login') + next_param)

    if getattr(settings, 'ENABLE_DINGTALK', False):
        return HttpResponseRedirect(reverse('dingtalk_login') + next_param)

    if getattr(settings, 'ENABLE_TSINGHUA_AUTH', False):
        return HttpResponseRedirect(reverse('tsinghua_login'))

    return HttpResponseRedirect(next_page)


def shib_login(request):
    # client platform args used to create api v2 token
    next_page = request.GET.get(REDIRECT_FIELD_NAME, '')
    query_string = request.META.get('QUERY_STRING', '')
    params = '?%s=%s&%s' % (REDIRECT_FIELD_NAME, quote(next_page), query_string)

    if getattr(settings, 'ENABLE_MULTI_SAML', False):
        return HttpResponseRedirect(reverse('multi_saml_sso') + params)

    return HttpResponseRedirect(reverse('sso') + params)


def sso_auto_login(request):

    if not SSO_SECRET_KEY:
        return render_error(request, 'Permission denied.')

    login_token = request.GET.get('token', '')
    if not login_token:
        return render_error(request, 'token invalid.')

    try:
        payload = jwt.decode(login_token, SSO_SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return render_error(request, 'token expired.')
    except jwt.PyJWTError:
        return render_error(request, 'token invalid.')

    if 'exp' not in payload:
        return render_error(request, 'token invalid.')

    user_id = payload.get('user_id')
    if not user_id:
        return render_error(request, 'token invalid.')

    try:
        user = User.objects.get(email=user_id)
    except User.DoesNotExist:
        return render_error(request, 'token invalid.')
    user.backend = AuthBackend.__module__ + ".AuthBackend"

    auth_login(request, user)

    redirect_to = request.GET.get(REDIRECT_FIELD_NAME, SITE_ROOT)
    return HttpResponseRedirect(redirect_to)


def simple_sso_login(request):
    """A simple check for sso login called by thirdpart systems(OA, etc).

    Token generation: MD5(sso_secret_key + username + 2021-05-01).hexdigest()
    Token length: 32 hexadecimal digits.
    """

    if not SSO_SECRET_KEY:
        return render_error(request,  _('Feature is not enabled.'))

    login_str = request.GET.get('user', '')
    random_key = request.GET.get('token', '')

    if not login_str or not random_key:
        return render_error(request, 'user or token invalid.')

    today = datetime.now().strftime('%Y-%m-%d')
    expect = hashlib.md5((SSO_SECRET_KEY + login_str + today).encode('utf-8')).hexdigest()
    if expect != random_key:
        return render_error(request, 'token invalid.')

    username = Profile.objects.convert_login_str_to_username(login_str)
    try:
        user = User.objects.get(email=username)
    except User.DoesNotExist:
        return render_error(request, 'user not found.')

    user.backend = AuthBackend.__module__ + ".AuthBackend"
    auth_login(request, user)

    redirect_to = request.GET.get(REDIRECT_FIELD_NAME, SITE_ROOT)
    return HttpResponseRedirect(redirect_to)


def multi_saml_sso(request):
    if not getattr(settings, 'ENABLE_MULTI_SAML', False):
        return HttpResponseRedirect(settings.LOGIN_URL)

    template_name = 'registration/multi_saml_sso.html'
    render_data = {'login_bg_image_path': get_login_bg_image_path()}

    if request.method == "POST":
        login_email = request.POST.get('login', '')
        if not is_valid_email(login_email):
            render_data['error_msg'] = 'Email invalid.'
            return render(request, template_name, render_data)

        domain = login_email.split('@')[-1]
        if not domain:
            render_data['error_msg'] = 'Email invalid.'
            return render(request, template_name, render_data)

        try:
            org_saml_config = OrgSAMLConfig.objects.get_config_by_domain(domain)
            if not org_saml_config:
                render_data['error_msg'] = \
                    "Cannot find a SAML config for the team related to domain %s." % domain
                return render(request, template_name, render_data)
            if not org_saml_config.domain_verified:
                render_data['error_msg'] = \
                    "The ownership of domain %s has not been verified. Please ask your team admin to verify it." % domain
                return render(request, template_name, render_data)

            org_id = org_saml_config.org_id
            org = ccnet_api.get_org_by_id(org_id)
            if not org:
                render_data['error_msg'] = 'Cannot find a SAML config for the team related to domain %s.' % domain
                return render(request, template_name, render_data)
        except Exception as e:
            logging.error(e)
            render_data['error_msg'] = 'Internal server error. Please contact system administrator.'
            return render(request, template_name, render_data)

        return HttpResponseRedirect('/org/custom/%s/saml/login/' % str(org_id))

    if request.method == "GET":
        return render(request, template_name, render_data)

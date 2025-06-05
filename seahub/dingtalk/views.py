# -*- coding: utf-8 -*-

import uuid
import urllib
import logging

from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import gettext as _

from seahub.api2.utils import get_api_token
from seahub import auth
from seahub.profile.models import Profile
from seahub.utils import render_error, get_site_scheme_and_netloc
from seahub.utils.auth import gen_user_virtual_id, VIRTUAL_ID_EMAIL_DOMAIN
from seahub.base.accounts import User
from seahub.auth.models import SocialAuthUser
from seahub.auth.decorators import login_required
from seahub.dingtalk.utils import dingtalk_get_detailed_user_info, update_dingtalk_user_info, \
    dingtalk_get_user_access_token, dingtalk_get_user_info

from seahub.dingtalk.settings import ENABLE_DINGTALK, DINGTALK_UID_PREFIX, \
    DINGTALK_PROVIDER, DINGTALK_AUTH_LOGIN_REMEMBER_ME, \
    DINGTALK_AUTH_RESPONSE_TYPE, DINGTALK_APP_KEY, \
    DINGTALK_AUTH_SCOPE, DINGTALK_AUTH_PROMPT, DINGTALK_AUTH_URL

logger = logging.getLogger(__name__)


def dingtalk_login(request):
    if not ENABLE_DINGTALK:
        return render_error(request, _('Error, please contact administrator.'))

    state = str(uuid.uuid4())
    request.session['dingtalk_login_redirect'] = request.GET.get(auth.REDIRECT_FIELD_NAME, '/')

    data = {
        'redirect_uri': get_site_scheme_and_netloc() + reverse('dingtalk_callback'),
        'response_type': DINGTALK_AUTH_RESPONSE_TYPE,
        'client_id': DINGTALK_APP_KEY,
        'scope': DINGTALK_AUTH_SCOPE,
        'state': state,
        'prompt': DINGTALK_AUTH_PROMPT,
    }

    url = DINGTALK_AUTH_URL + '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(url)


def dingtalk_callback(request):
    if not ENABLE_DINGTALK:
        return render_error(request, _('Error, please contact administrator.'))

    code = request.GET.get('authCode')

    user_access_token = dingtalk_get_user_access_token(code)
    if not user_access_token:
        logger.warning('Get user access token error.')
        return render_error(request, _('Error, please contact administrator.'))

    user_info = dingtalk_get_user_info(user_access_token)
    union_id = user_info.get('unionId', '')
    name = user_info.get('nick', '')

    # seahub authenticate user
    if not union_id:
        logger.warning('Required user info not found.')
        logger.warning(user_info)
        return render_error(request, _('Error, please contact administrator.'))

    uid = DINGTALK_UID_PREFIX + union_id
    auth_user = SocialAuthUser.objects.get_by_provider_and_uid(DINGTALK_PROVIDER, uid)
    if auth_user:
        email = auth_user.username
        is_new_user = False
    else:
        email = None
        is_new_user = True

    try:
        user = auth.authenticate(oauth_username=email)
        email = user.username
    except User.DoesNotExist:
        user = None
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Error, please contact administrator.'))

    if not user or not user.is_active:
        return render_error(request, _('User %s not found or inactive.') % email)

    # bind
    if is_new_user:
        SocialAuthUser.objects.add(user.username, DINGTALK_PROVIDER, uid)

    # User is valid.  Set request.user and persist user in the session
    # by logging the user in.
    request.user = user
    request.session['remember_me'] = DINGTALK_AUTH_LOGIN_REMEMBER_ME
    auth.login(request, user)

    # update user's profile
    if name:
        profile = Profile.objects.get_profile_by_user(email)
        if not profile:
            profile = Profile(user=email)

        profile.nickname = name.strip()
        profile.save()

    user_detail_info = dingtalk_get_detailed_user_info(union_id)
    contact_email = user_detail_info.get('email', '')
    phone = user_detail_info.get('mobile', '')
    avatar_url = user_detail_info.get('avatar', '')
    update_dingtalk_user_info(email, name, contact_email, avatar_url, phone)

    # generate auth token for Seafile client
    api_token = get_api_token(request)

    # redirect user to home page
    response = HttpResponseRedirect(request.session.get('dingtalk_login_redirect', '/'))
    response.set_cookie('seahub_auth', email + '@' + api_token.key)
    return response


@login_required
def dingtalk_connect(request):
    if not ENABLE_DINGTALK:
        return render_error(request, _('Error, please contact administrator.'))

    state = str(uuid.uuid4())
    request.session['dingtalk_connect_redirect'] = request.GET.get(auth.REDIRECT_FIELD_NAME, '/')

    data = {
        'redirect_uri': get_site_scheme_and_netloc() + reverse('dingtalk_connect_callback'),
        'response_type': DINGTALK_AUTH_RESPONSE_TYPE,
        'client_id': DINGTALK_APP_KEY,
        'scope': DINGTALK_AUTH_SCOPE,
        'state': state,
        'prompt': DINGTALK_AUTH_PROMPT,
    }

    url = DINGTALK_AUTH_URL + '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(url)


@login_required
def dingtalk_connect_callback(request):
    if not ENABLE_DINGTALK:
        return render_error(request, _('Error, please contact administrator.'))

    code = request.GET.get('authCode')
    user_access_token = dingtalk_get_user_access_token(code)
    if not user_access_token:
        logger.warning('Get user access token error.')
        return render_error(request, _('Error, please contact administrator.'))

    user_info = dingtalk_get_user_info(user_access_token)
    union_id = user_info.get('unionId', '')
    name = user_info.get('nick', '')

    # seahub authenticate user
    if not union_id:
        logger.warning('Required user info not found.')
        logger.warning(user_info)
        return render_error(request, _('Error, please contact administrator.'))

    username = request.user.username

    uid = DINGTALK_UID_PREFIX + union_id
    auth_user = SocialAuthUser.objects.get_by_provider_and_uid(DINGTALK_PROVIDER, uid)
    if auth_user:
        logger.warning('dingtalk account already exists %s' % uid)
        return render_error(request, '出错了，此钉钉账号已被绑定')

    SocialAuthUser.objects.add(username, DINGTALK_PROVIDER, uid)

    # update user's profile
    if name:
        profile = Profile.objects.get_profile_by_user(username)
        if not profile:
            profile = Profile(user=username)

        profile.nickname = name.strip()
        profile.save()

    user_detail_info = dingtalk_get_detailed_user_info(union_id)
    contact_email = user_detail_info.get('email', '')
    phone = user_detail_info.get('mobile', '')
    avatar_url = user_detail_info.get('avatar', '')
    update_dingtalk_user_info(username, name, contact_email, avatar_url, phone)

    response = HttpResponseRedirect(request.session['dingtalk_connect_redirect'])
    return response


@login_required
def dingtalk_disconnect(request):
    if not ENABLE_DINGTALK:
        return render_error(request, _('Error, please contact administrator.'))

    username = request.user.username
    if username[-(len(VIRTUAL_ID_EMAIL_DOMAIN)):] == VIRTUAL_ID_EMAIL_DOMAIN:
        profile = Profile.objects.get_profile_by_user(username)
        if not profile or not (profile.contact_email or profile.phone):
            return render_error(request, '出错了，当前账号不能解绑钉钉，请绑定手机号或邮箱后再试')

    username = request.user.username
    SocialAuthUser.objects.delete_by_username_and_provider(username, DINGTALK_PROVIDER)
    response = HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, '/'))
    return response

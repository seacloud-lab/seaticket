# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8

import uuid
import logging
import requests
import urllib.request, urllib.parse, urllib.error

from django.http import HttpResponseRedirect
from django.utils.translation import gettext as _
from seahub.auth.decorators import login_required
from seahub.utils import get_site_scheme_and_netloc
from seahub.api2.utils import get_api_token
from seahub import auth, settings
from seahub.utils import render_error
from seahub.base.accounts import User
from seahub.work_weixin.settings import WORK_WEIXIN_AUTHORIZATION_URL, WORK_WEIXIN_CORP_ID, \
    WORK_WEIXIN_AGENT_ID, WORK_WEIXIN_PROVIDER, WORK_WEIXIN_AUTH_CALLBACK_URL, \
    WORK_WEIXIN_GET_USER_INFO_URL, WORK_WEIXIN_GET_USER_PROFILE_URL, WORK_WEIXIN_UID_PREFIX, \
    WORK_WEIXIN_USER_INFO_AUTO_UPDATE, REMEMBER_ME
from seahub.work_weixin.utils import work_weixin_oauth_check, get_work_weixin_access_token, \
    handler_work_weixin_api_response, update_work_weixin_user_info
from seahub.utils.auth import gen_user_virtual_id, VIRTUAL_ID_EMAIL_DOMAIN
from seahub.auth.models import SocialAuthUser
from django.urls import reverse
from seahub.profile.models import Profile
from seahub.invitations.utils import record_registration_logs

logger = logging.getLogger(__name__)
redirect_to = settings.LOGIN_REDIRECT_URL

# # uid = corpid + '_' + userid


def work_weixin_oauth_login(request):
    if not work_weixin_oauth_check():
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        return HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))

    state = str(uuid.uuid4())
    request.session['work_weixin_oauth_redirect'] = request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to)

    callback_url = get_site_scheme_and_netloc() if not WORK_WEIXIN_AUTH_CALLBACK_URL else WORK_WEIXIN_AUTH_CALLBACK_URL.rstrip('/')
    data = {
        'appid': WORK_WEIXIN_CORP_ID,
        'agentid': WORK_WEIXIN_AGENT_ID,
        'redirect_uri': callback_url + reverse('work_weixin_oauth_callback'),
        'state': state,
    }
    authorization_url = WORK_WEIXIN_AUTHORIZATION_URL + '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(authorization_url)


def work_weixin_oauth_callback(request):
    if not work_weixin_oauth_check():
        return render_error(request, _('Feature is not enabled.'))

    code = request.GET.get('code', None)
    state = request.GET.get('state', None)

    work_weixin_oauth_redirect = request.session.get('work_weixin_oauth_redirect', redirect_to)
    # clear session
    try:
        del request.session['work_weixin_oauth_redirect']
    except Exception as e:
        logger.warning(e)

    source = request.COOKIES.get('REGISTRATION_SOURCE', '')
    invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')

    # get api user
    access_token = get_work_weixin_access_token()
    if not access_token:
        logger.warning('can not get work weixin access_token')
        return render_error(request, _('Internal Server Error'))

    data = {
        'access_token': access_token,
        'code': code,
    }
    api_response = requests.get(WORK_WEIXIN_GET_USER_INFO_URL, params=data)
    api_response_dic = handler_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin user info')
        return render_error(request, '登录出错，请尝试重启企业微信或浏览器')

    if not api_response_dic.get('UserId', None):
        logger.warning('can not get UserId in work weixin user info response')
        return render_error(request, '登录出错，请尝试重启企业微信或浏览器')

    # main
    user_id = api_response_dic.get('UserId')
    uid = WORK_WEIXIN_UID_PREFIX + user_id

    work_weixin_user = SocialAuthUser.objects.get_by_provider_and_uid(WORK_WEIXIN_PROVIDER, uid)
    if work_weixin_user:
        username = work_weixin_user.username
        is_new_user = False
    else:
        username = None
        is_new_user = True

    try:
        user = auth.authenticate(oauth_username=username)
    except User.DoesNotExist:
        user = None
    except Exception as e:
        logger.warning(e)
        return render_error(request, _('Internal Server Error'))

    if not user:
        return render_error(
            request, _('Error, new user registration is not allowed, please contact administrator.'))

    # bind
    if is_new_user:
        SocialAuthUser.objects.add(user.username, WORK_WEIXIN_PROVIDER, uid)
        try:
            record_registration_logs(user, source, invitation_token)
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

    # update user info
    if is_new_user or WORK_WEIXIN_USER_INFO_AUTO_UPDATE:
        user_info_data = {
            'access_token': access_token,
            'userid': user_id,
        }
        user_info_api_response = requests.get(WORK_WEIXIN_GET_USER_PROFILE_URL, params=user_info_data)
        user_info_api_response_dic = handler_work_weixin_api_response(user_info_api_response)
        if user_info_api_response_dic:
            api_user = user_info_api_response_dic
            api_user['username'] = user.username
            api_user['contact_email'] = api_user.get('email', '')
            update_work_weixin_user_info(api_user)

    if not user.is_active:
        return render_error(
            request, _('Your account is created successfully, please wait for administrator to activate your account.'))

    # User is valid.  Set request.user and persist user in the session
    # by logging the user in.
    request.user = user
    request.session['remember_me'] = REMEMBER_ME
    auth.login(request, user)

    # generate auth token for Seafile client
    api_token = get_api_token(request)

    # redirect user to page
    response = HttpResponseRedirect(work_weixin_oauth_redirect)
    if source:
        response.delete_cookie('REGISTRATION_SOURCE')
    if invitation_token:
        response.delete_cookie('INVITATION_TOKEN')
    response.set_cookie('seahub_auth', user.username + '@' + api_token.key)
    return response


@login_required
def work_weixin_oauth_connect(request):
    if not work_weixin_oauth_check():
        return render_error(request, _('Feature is not enabled.'))

    state = str(uuid.uuid4())
    request.session['work_weixin_oauth_connect_redirect'] = request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to)

    callback_url = get_site_scheme_and_netloc() if not WORK_WEIXIN_AUTH_CALLBACK_URL else WORK_WEIXIN_AUTH_CALLBACK_URL.rstrip('/')
    data = {
        'appid': WORK_WEIXIN_CORP_ID,
        'agentid': WORK_WEIXIN_AGENT_ID,
        'redirect_uri': callback_url + reverse('work_weixin_oauth_connect_callback'),
        'state': state,
    }
    authorization_url = WORK_WEIXIN_AUTHORIZATION_URL + '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(authorization_url)


@login_required
def work_weixin_oauth_connect_callback(request):
    if not work_weixin_oauth_check():
        return render_error(request, _('Feature is not enabled.'))

    work_weixin_oauth_connect_redirect = request.session.get('work_weixin_oauth_connect_redirect', redirect_to)
    # clear session
    try:
        del request.session['work_weixin_oauth_connect_redirect']
    except Exception as e:
        logger.warning(e)

    # get api user
    code = request.GET.get('code', None)
    state = request.GET.get('state', None)

    access_token = get_work_weixin_access_token()
    if not access_token:
        logger.warning('can not get work weixin access_token')
        return render_error(request, _('Internal Server Error'))

    data = {
        'access_token': access_token,
        'code': code,
    }
    api_response = requests.get(WORK_WEIXIN_GET_USER_INFO_URL, params=data)
    api_response_dic = handler_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin user info')
        return render_error(request, '绑定出错，请尝试重启企业微信或浏览器')

    if not api_response_dic.get('UserId', None):
        logger.warning('can not get UserId in work weixin user info response')
        return render_error(request, '绑定出错，请尝试重启企业微信或浏览器')

    # main
    user_id = api_response_dic.get('UserId')
    uid = WORK_WEIXIN_UID_PREFIX + user_id
    email = request.user.username

    work_weixin_user = SocialAuthUser.objects.get_by_provider_and_uid(WORK_WEIXIN_PROVIDER, uid)
    if work_weixin_user:
        logger.warning('work weixin account already exists %s' % user_id)
        return render_error(request, '出错了，此企业微信账号已被绑定')

    SocialAuthUser.objects.add(email, WORK_WEIXIN_PROVIDER, uid)

    # update user info
    if WORK_WEIXIN_USER_INFO_AUTO_UPDATE:
        user_info_data = {
            'access_token': access_token,
            'userid': user_id,
        }
        user_info_api_response = requests.get(WORK_WEIXIN_GET_USER_PROFILE_URL, params=user_info_data)
        user_info_api_response_dic = handler_work_weixin_api_response(user_info_api_response)
        if user_info_api_response_dic:
            api_user = user_info_api_response_dic
            api_user['username'] = email
            api_user['contact_email'] = api_user.get('email', '')
            update_work_weixin_user_info(api_user)

    # redirect user to page
    response = HttpResponseRedirect(work_weixin_oauth_connect_redirect)
    return response


@login_required
def work_weixin_oauth_disconnect(request):
    if not work_weixin_oauth_check():
        return render_error(request, _('Feature is not enabled.'))

    username = request.user.username
    if username[-(len(VIRTUAL_ID_EMAIL_DOMAIN)):] == VIRTUAL_ID_EMAIL_DOMAIN:
        profile = Profile.objects.get_profile_by_user(username)
        if not profile or not (profile.contact_email or profile.phone):
            return render_error(request, '出错了，当前账号不能解绑企业微信，请绑定手机号或邮箱后再试')

    SocialAuthUser.objects.delete_by_username_and_provider(username, WORK_WEIXIN_PROVIDER)

    # redirect user to page
    response = HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))
    return response

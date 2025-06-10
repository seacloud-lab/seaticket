# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8

import json
import uuid
import logging
import requests
import urllib.request, urllib.parse, urllib.error

from django.shortcuts import render
from django.core.cache import cache
from django.urls import reverse
from django.http import HttpResponseRedirect, HttpResponse
from django.utils.translation import gettext as _

from seahub.auth.decorators import login_required
from seahub.utils import get_site_scheme_and_netloc
from seahub.api2.utils import get_api_token
from seahub import auth, settings
from seahub.utils import render_error
from seahub.base.accounts import User
from seahub.weixin.settings import WEIXIN_AUTHORIZATION_URL, WEIXIN_APP_ID, \
    WEIXIN_PROVIDER, WEIXIN_GET_USER_INFO_URL, WEIXIN_UID_PREFIX, MP_OPENID, \
    WEIXIN_USER_INFO_AUTO_UPDATE, REMEMBER_ME, MP_WEIXIN_APP_ID, \
    MP_WEIXIN_AUTHORIZATION_URL
from seahub.weixin.utils import weixin_check, get_weixin_access_token_and_openid, \
    handler_weixin_api_response, update_weixin_user_info, get_weixin_api_user_info, \
    mp_weixin_check, logger
from seahub.utils.auth import gen_user_virtual_id, VIRTUAL_ID_EMAIL_DOMAIN
from seahub.auth.models import SocialAuthUser
from seahub.profile.models import Profile
from seahub.organizations.settings import ORG_MEMBER_QUOTA_ENABLED
from seahub.invitations.utils import record_registration_logs

redirect_to = settings.LOGIN_REDIRECT_URL

# # uid = appid + '_' + unionid


def weixin_oauth_login(request):
    if not weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    # org invite for new user
    org_token = request.GET.get('org_token', None)
    org_id = None
    if org_token:
        # validate token
        org_id = cache.get('org_associate_%s' % org_token, -1)
        if org_id <= 0:
            return render_error(request, '邀请链接无效')
        # get org info
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            return render_error(request, 'Organization %s not found.' % org_id)
        # check org member quota
        if ORG_MEMBER_QUOTA_ENABLED:
            from seahub.organizations.models import OrgMemberQuota
            org_members = ccnet_api.get_org_users_by_url_prefix(org.url_prefix, -1, -1)
            org_active_members = len([m for m in org_members if m.is_active])
            org_members_quota = OrgMemberQuota.objects.get_quota(org_id)
            if org_members_quota is not None and org_active_members >= org_members_quota:
                return render_error(request, '用户数已超')

    redirect_url = request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to)
    # already authenticated
    if request.user.is_authenticated:
        if org_id:
            # transfer user to org
            request.session['org_transfer_org_id'] = org_id
            request.session['org_transfer_redirect'] = redirect_url
            return render(request, "organizations/org_transfer.html",
                {'org_transfer': reverse('org_transfer'),
                'redirect_to': redirect_url,})
        else:
            return HttpResponseRedirect(redirect_url)

    # mobile weixin
    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    if 'mobile' in user_agent and 'micromessenger' not in user_agent:
        return render(request, 'redirect_mobile_weixin.html')

    if 'micromessenger' in user_agent:
        if not mp_weixin_check():
            return render_error(request, '微信客户端登录功能未启用，请联系管理员')

        is_mobile_weixin = True
        scope = 'snsapi_userinfo'
        weixin_authorization_url = MP_WEIXIN_AUTHORIZATION_URL
        appid = MP_WEIXIN_APP_ID
    else:
        is_mobile_weixin = False
        scope = 'snsapi_login'
        weixin_authorization_url = WEIXIN_AUTHORIZATION_URL
        appid = WEIXIN_APP_ID

    # main
    state = str(uuid.uuid4())
    logger.info('user login state: %s, is_mobile: %s' % (state, is_mobile_weixin))

    request.session['weixin_oauth_redirect'] = redirect_url
    request.session['weixin_oauth_org_id'] = org_id

    response_type = 'code'  # from weixn official document
    wechat_redirect = '#wechat_redirect'

    data = {
        'appid': appid,
        'redirect_uri': get_site_scheme_and_netloc() + reverse('weixin_oauth_callback'),
        'response_type': response_type,
        'scope': scope,
        'state': state,
    }
    authorization_url = weixin_authorization_url + '?' + urllib.parse.urlencode(data) + wechat_redirect

    response = HttpResponseRedirect(authorization_url)
    if org_token:
        response.set_cookie('REGISTRATION_SOURCE', 'org-admin-add')
    return response


def weixin_oauth_callback(request):
    if not weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    code = request.GET.get('code', None)
    state = request.GET.get('state', None)
    is_android_weixin = request.GET.get('from_android', None)

    weixin_oauth_redirect = request.session.get('weixin_oauth_redirect', redirect_to)
    org_id = request.session.get('weixin_oauth_org_id', None)

    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    is_mobile_weixin = 'micromessenger' in user_agent
    logger.info('user login callback state: %s, method: %s, is_mobile: %s, auth_code: %s' % (
        state, request.method, is_mobile_weixin, code))

    # clear session
    try:
        del request.session['weixin_oauth_redirect']
        del request.session['weixin_oauth_org_id']
    except Exception as e:
        logger.warning(e)

    source = request.COOKIES.get('REGISTRATION_SOURCE', '')
    invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')

    # check org member quota
    if org_id and ORG_MEMBER_QUOTA_ENABLED:
        from seahub.organizations.models import OrgMemberQuota
        org = ccnet_api.get_org_by_id(org_id)
        org_members = ccnet_api.get_org_users_by_url_prefix(org.url_prefix, -1, -1)
        org_active_members = len([m for m in org_members if m.is_active])
        org_members_quota = OrgMemberQuota.objects.get_quota(org_id)
        if org_members_quota is not None and org_active_members >= org_members_quota:
            return render_error(request, '用户数已超')

    # get api user info
    access_token, openid = get_weixin_access_token_and_openid(code, is_mobile_weixin, is_android_weixin)
    if not access_token or not openid:
        logger.warning('can not get weixin access_token or openid, state: %s' % state)
        return render_error(request, '登录出错，请尝试重启微信或浏览器')

    weixin_api_user_info = get_weixin_api_user_info(access_token, openid)
    if not weixin_api_user_info:
        logger.warning('can not get weixin userinfo, state: %s' % state)
        return render_error(request, '登录出错，请尝试重启微信或浏览器')

    # main
    user_id = weixin_api_user_info.get('unionid')
    uid = WEIXIN_UID_PREFIX + user_id

    weixin_user = SocialAuthUser.objects.get_by_provider_and_uid(WEIXIN_PROVIDER, uid)
    if weixin_user:
        username = weixin_user.username
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
    username = user.username
    if is_new_user:
        weixin_user = SocialAuthUser.objects.add(username, WEIXIN_PROVIDER, uid)
        # org invite for new user
        if org_id:
            ccnet_api.add_org_user(org_id, username, int(False))

        try:
            record_registration_logs(user, source, invitation_token)
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

    # mp weixin openid
    if is_mobile_weixin and not weixin_user.extra_data:
        extra_data = json.dumps({MP_OPENID: openid})
        weixin_user.extra_data = extra_data
        weixin_user.save(update_fields=['extra_data'])

    # update user info
    if is_new_user or WEIXIN_USER_INFO_AUTO_UPDATE:
        api_user = weixin_api_user_info
        api_user['username'] = username
        update_weixin_user_info(api_user)

    if not user.is_active:
        orgs = ccnet_api.get_orgs_by_user(username)
        if orgs:
            return render_error(
                request, '您微信关联的账号在团队 %s 中，现在是非激活状态，请联系团队管理员激活。' % orgs[0].org_name)
        else:
            return render_error(
                request, '您微信关联的账号现在是非激活状态，请联系客服。')

    # User is valid.  Set request.user and persist user in the session
    # by logging the user in.
    request.user = user
    request.session['remember_me'] = REMEMBER_ME
    auth.login(request, user)

    # generate auth token for Seafile client
    api_token = get_api_token(request)

    # android
    if is_android_weixin:
        return HttpResponse(json.dumps({'token': api_token.key}), content_type='application/json')

    # redirect user to page
    response = HttpResponseRedirect(weixin_oauth_redirect)

    # transfer user to org
    if org_id and not is_new_user:
        request.session['org_transfer_org_id'] = org_id
        request.session['org_transfer_redirect'] = weixin_oauth_redirect
        response = render(request, "organizations/org_transfer.html",
            {'org_transfer': reverse('org_transfer'),
            'redirect_to': weixin_oauth_redirect,})

    if source:
        response.delete_cookie('REGISTRATION_SOURCE')
    if invitation_token:
        response.delete_cookie('INVITATION_TOKEN')
    response.set_cookie('seahub_auth', user.username + '@' + api_token.key)
    return response


@login_required
def weixin_oauth_connect(request):
    if not weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    # mobile weixin
    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    if 'mobile' in user_agent and 'micromessenger' not in user_agent:
        return render_error(request, '请在微信客户端打开链接')

    if 'micromessenger' in user_agent:
        if not mp_weixin_check():
            return render_error(request, '微信客户端登录功能未启用，请联系管理员')

        is_mobile_weixin = True
        scope = 'snsapi_userinfo'
        weixin_authorization_url = MP_WEIXIN_AUTHORIZATION_URL
        appid = MP_WEIXIN_APP_ID
    else:
        is_mobile_weixin = False
        scope = 'snsapi_login'
        weixin_authorization_url = WEIXIN_AUTHORIZATION_URL
        appid = WEIXIN_APP_ID

    state = str(uuid.uuid4())
    logger.info('user bind state: %s, is_mobile: %s' % (state, is_mobile_weixin))

    request.session['weixin_oauth_connect_redirect'] = request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to)

    response_type = 'code'  # from weixn official document
    wechat_redirect = '#wechat_redirect'

    data = {
        'appid': appid,
        'redirect_uri': get_site_scheme_and_netloc() + reverse('weixin_oauth_connect_callback'),
        'response_type': response_type,
        'scope': scope,
        'state': state,
    }
    authorization_url = weixin_authorization_url + '?' + urllib.parse.urlencode(data) + wechat_redirect

    return HttpResponseRedirect(authorization_url)


@login_required
def weixin_oauth_connect_callback(request):
    if not weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    code = request.GET.get('code', None)
    state = request.GET.get('state', None)

    weixin_oauth_connect_redirect = request.session.get('weixin_oauth_connect_redirect', redirect_to)
    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    is_mobile_weixin = 'micromessenger' in user_agent
    logger.info('user bind callback state: %s, method: %s, is_mobile: %s, auth_code: %s' % (
        state, request.method, is_mobile_weixin, code))

    # clear session
    try:
        del request.session['weixin_oauth_connect_redirect']
    except Exception as e:
        logger.warning(e)

    # get api user info
    access_token, openid = get_weixin_access_token_and_openid(code, is_mobile_weixin)
    if not access_token or not openid:
        logger.warning('can not get weixin access_token or openid, state: %s' % state)
        return render_error(request, '绑定出错，请尝试重启微信或浏览器')

    weixin_api_user_info = get_weixin_api_user_info(access_token, openid)
    if not weixin_api_user_info:
        logger.warning('can not get weixin userinfo, state: %s' % state)
        return render_error(request, '绑定出错，请尝试重启微信或浏览器')

    # main
    user_id = weixin_api_user_info.get('unionid')
    uid = WEIXIN_UID_PREFIX + user_id
    username = request.user.username

    weixin_user = SocialAuthUser.objects.get_by_provider_and_uid(WEIXIN_PROVIDER, uid)
    if weixin_user:
        logger.warning('weixin account already exists %s' % user_id)
        return render_error(request, '出错了，此微信账号已被绑定')

    SocialAuthUser.objects.add(username, WEIXIN_PROVIDER, uid)

    # update user info
    if WEIXIN_USER_INFO_AUTO_UPDATE:
        api_user = weixin_api_user_info
        api_user['username'] = username
        update_weixin_user_info(api_user)

    # redirect user to page
    response = HttpResponseRedirect(weixin_oauth_connect_redirect)
    return response


@login_required
def weixin_oauth_disconnect(request):
    if not weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    username = request.user.username
    if username[-(len(VIRTUAL_ID_EMAIL_DOMAIN)):] == VIRTUAL_ID_EMAIL_DOMAIN:
        profile = Profile.objects.get_profile_by_user(username)
        if not profile or not (profile.contact_email or profile.phone):
            return render_error(request, '出错了，当前账号不能解绑微信，请绑定手机号或邮箱后再试')

    SocialAuthUser.objects.delete_by_username_and_provider(username, WEIXIN_PROVIDER)

    # redirect user to page
    response = HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))
    return response

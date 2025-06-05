# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8

import logging
import json
import requests

from django.core.cache import cache
from django.core.files.base import ContentFile

from seahub.weixin.settings import WEIXIN_APP_ID, WEIXIN_APP_SECRET, \
    WEIXIN_ACCESS_TOKEN_URL, ENABLE_WEIXIN, WEIXIN_AUTHORIZATION_URL, \
    WEIXIN_GET_USER_INFO_URL, MP_WEIXIN_APP_ID, MP_WEIXIN_APP_SECRET, \
    MP_WEIXIN_AUTHORIZATION_URL, MP_WEIXIN_ACCESS_TOKEN_URL, \
    MP_WEIXIN_MESSAGE_TEMPLATE_ID, MP_WEIXIN_NOTIFICATIONS_URL, \
    MP_WEIXIN_USERS_OPENID_URL, ANDROID_WEIXIN_APP_ID, ANDROID_WEIXIN_APP_SECRET
from seahub.profile.models import Profile
from seahub.avatar.models import Avatar
from seahub.utils import normalize_cache_key, setup_logger, is_pro_version

if ENABLE_WEIXIN:
    logger = setup_logger('weixin_oauth.log')
else:
    logger = logging.getLogger(__name__)
WEIXIN_ACCESS_TOKEN_CACHE_KEY = 'WEIXIN_ACCESS_TOKEN'
MP_WEIXIN_ACCESS_TOKEN_CACHE_KEY = 'MP_WEIXIN_ACCESS_TOKEN'
MP_WEIXIN_USERS_OPENID_CACHE_KEY = 'MP_WEIXIN_USERS_OPENID'


# get access_token: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html

def get_weixin_access_token_and_openid(code, is_mobile_weixin, is_android_weixin=False):
    """ get weixin access_token by code
    """
    grant_type = 'authorization_code'  # from weixn official document

    if is_android_weixin:
        appid = ANDROID_WEIXIN_APP_ID
        secret = ANDROID_WEIXIN_APP_SECRET
    elif is_mobile_weixin:
        appid = MP_WEIXIN_APP_ID
        secret = MP_WEIXIN_APP_SECRET
    else:
        appid = WEIXIN_APP_ID
        secret = WEIXIN_APP_SECRET

    data = {
        'appid': appid,
        'secret': secret,
        'code': code,
        'grant_type': grant_type,
    }
    api_response = requests.get(WEIXIN_ACCESS_TOKEN_URL, params=data)
    api_response_dic = handler_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get weixin response')
        return None, None
    access_token = api_response_dic.get('access_token', None)
    openid = api_response_dic.get('openid', None)

    return access_token, openid


def get_mp_weixin_access_token():
    """ get global mp weixin access_token
    """
    cache_key = normalize_cache_key(MP_WEIXIN_ACCESS_TOKEN_CACHE_KEY)
    access_token = cache.get(cache_key, None)

    if not access_token:
        grant_type = 'client_credential',  # from weixn official document
        data = {
            'grant_type': grant_type,
            'appid': MP_WEIXIN_APP_ID,
            'secret': MP_WEIXIN_APP_SECRET,
        }
        api_response = requests.get(MP_WEIXIN_ACCESS_TOKEN_URL, params=data)
        api_response_dic = handler_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get mp weixin response')
            return None
        access_token = api_response_dic.get('access_token', None)
        expires_in = api_response_dic.get('expires_in', None)
        if access_token and expires_in:
            cache.set(cache_key, access_token, expires_in)

    return access_token


def get_mp_weixin_users_openid():
    """ get global mp weixin users openid
    https://developers.weixin.qq.com/doc/offiaccount/User_Management/Getting_a_User_List.html
    """
    cache_key = normalize_cache_key(MP_WEIXIN_USERS_OPENID_CACHE_KEY)
    users_openid = cache.get(cache_key, None)

    if not users_openid:
        access_token = get_mp_weixin_access_token()
        users_openid = []
        total = 0
        next_openid = None
        has_more = True

        while has_more:
            data = {
                'access_token': access_token,
            }
            if next_openid:
                data['next_openid'] = next_openid
            api_response = requests.get(MP_WEIXIN_USERS_OPENID_URL, params=data)
            api_response_dic = handler_weixin_api_response(api_response)
            if not api_response_dic:
                logger.warning('can not get mp weixin users openid response')
                break

            users_openid += api_response_dic.get('data', {}).get('openid', [])
            count = api_response_dic.get('count', 0)
            total = api_response_dic.get('total', 0)
            next_openid = api_response_dic.get('next_openid', None)
            if count == 10000 and total > 10000 and next_openid:
                has_more = True
            else:
                has_more = False

        logger.debug('got %s weixin users openid, total %s' % (len(users_openid), total))
        if users_openid:
            cache.set(cache_key, users_openid, 3600)

    return users_openid


def get_weixin_api_user_info(access_token, openid):
    data = {
        'access_token': access_token,
        'openid': openid,
    }
    api_response = requests.get(WEIXIN_GET_USER_INFO_URL, params=data)
    api_response_dic = handler_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get weixin user info')

    if not api_response_dic.get('unionid', None):
        logger.warning('can not get unionid in weixin user info response')
        api_response_dic = None
    
    return api_response_dic


def handler_weixin_api_response(response):
    """ handler weixin response and errcode
    """
    try:
        response = response.json()
    except ValueError:
        logger.warning(response)
        return None

    errcode = response.get('errcode', None)
    if errcode:
        logger.warning(json.dumps(response))
        return None
    return response


def weixin_check():
    """ weixin check
    """
    if not is_pro_version():
        return False
    if not ENABLE_WEIXIN:
        return False

    if not WEIXIN_APP_ID \
        or not WEIXIN_APP_SECRET \
        or not WEIXIN_ACCESS_TOKEN_URL \
        or not WEIXIN_AUTHORIZATION_URL \
        or not WEIXIN_GET_USER_INFO_URL:
        logger.warning('weixin relevant settings invalid.')
        logger.warning('please check WEIXIN_APP_ID, WEIXIN_APP_SECRET')
        logger.warning('WEIXIN_ACCESS_TOKEN_URL: %s' % WEIXIN_ACCESS_TOKEN_URL)
        logger.warning('WEIXIN_AUTHORIZATION_URL: %s' % WEIXIN_AUTHORIZATION_URL)
        logger.warning('WEIXIN_GET_USER_INFO_URL: %s' % WEIXIN_GET_USER_INFO_URL)
        return False

    return True


def mp_weixin_check():
    """ mp weixin check
    """
    if not ENABLE_WEIXIN:
        return False

    if not MP_WEIXIN_APP_ID \
        or not MP_WEIXIN_APP_SECRET \
        or not MP_WEIXIN_AUTHORIZATION_URL:
        logger.warning('mp weixin relevant settings invalid.')
        logger.warning('please check MP_WEIXIN_APP_ID, MP_WEIXIN_APP_SECRET')
        logger.warning('MP_WEIXIN_AUTHORIZATION_URL: %s' % MP_WEIXIN_AUTHORIZATION_URL)
        return False

    return True


def weixin_notifications_check():
    """ weixin notifications check
    """
    if not ENABLE_WEIXIN:
        return False

    if not MP_WEIXIN_APP_ID \
        or not MP_WEIXIN_APP_SECRET \
        or not MP_WEIXIN_ACCESS_TOKEN_URL \
        or not MP_WEIXIN_MESSAGE_TEMPLATE_ID \
        or not MP_WEIXIN_NOTIFICATIONS_URL \
        or not MP_WEIXIN_USERS_OPENID_URL:
        logger.warning('weixin notification relevant settings invalid.')
        logger.warning('please check MP_WEIXIN_APP_ID, MP_WEIXIN_APP_SECRET, MP_WEIXIN_MESSAGE_TEMPLATE_ID')
        logger.warning('MP_WEIXIN_ACCESS_TOKEN_URL: %s' % MP_WEIXIN_ACCESS_TOKEN_URL)
        logger.warning('MP_WEIXIN_NOTIFICATIONS_URL: %s' % MP_WEIXIN_NOTIFICATIONS_URL)
        logger.warning('MP_WEIXIN_USERS_OPENID_URL: %s' % MP_WEIXIN_USERS_OPENID_URL)
        return False

    return True


def update_weixin_user_info(api_user):
    """ update user profile from weixin

    use for weixin login, bind
    """
    # update additional user info
    username = api_user.get('username')
    nickname = api_user.get('nickname').encode('ISO-8859-1').decode('utf8')
    headimgurl = api_user.get('headimgurl')

    profile_kwargs = {}
    if nickname:
        profile_kwargs['nickname'] = nickname

    if profile_kwargs:
        try:
            Profile.objects.add_or_update(username, **profile_kwargs)
        except Exception as e:
            logger.warning(e)

    # avatar
    if headimgurl:
        try:
            image_name = 'weixin_headimgurl'
            image_file = requests.get(headimgurl).content
            avatar = Avatar.objects.filter(emailuser=username, primary=True).first()
            avatar = avatar or Avatar(emailuser=username, primary=True)
            avatar_file = ContentFile(image_file)
            avatar_file.name = image_name
            avatar.avatar = avatar_file
            avatar.save()
        except Exception as e:
            logger.warning(e)

import time
import json
import string
import hashlib
import random
import logging
from urllib import response
import requests
from datetime import datetime

from django.core.cache import cache
from django.urls import reverse
from django.core.files.base import ContentFile

from seahub.avatar.models import Avatar
from seahub.profile.models import Profile
from seahub.utils import normalize_cache_key, setup_logger, is_pro_version, get_site_scheme_and_netloc
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.org_work_weixin.WXBizMsgCrypt3 import WXBizMsgCrypt
from seahub.org_work_weixin.settings import ENABLE_ORG_WORK_WEIXIN, ORG_WORK_WEIXIN_TOKEN, \
    ORG_WORK_WEIXIN_ENCODING_AES_KEY, ORG_WORK_WEIXIN_SUITE_ID, ORG_WORK_WEIXIN_SECRET, \
    ORG_WORK_WEIXIN_CORP_ID, ORG_WORK_WEIXIN_SUITE_ACCESS_TOKEN_URL, ORG_WORK_WEIXIN_PRE_AUTH_CODE_URL, \
    ORG_WORK_WEIXIN_AUTH_TYPE, ORG_WORK_WEIXIN_SET_SESSION_INFO_URL, ORG_WORK_WEIXIN_GET_PERMANENT_CODE_URL, \
    ORG_WORK_WEIXIN_CORP_ACCESS_TOKEN_URL, ORG_WORK_WEIXIN_PROVIDER_SECRET, \
    ORG_WORK_WEIXIN_PROVIDER_ACCESS_TOKEN_URL, ORG_WORK_WEIXIN_CORP_INFO_URL, \
    ORG_WORK_WEIXIN_CORP_JSAPI_TOKEN_URL, ORG_WORK_WEIXIN_AGENT_JSAPI_TOKEN_URL, \
    ORG_WORK_WEIXIN_LIST_DEPARTMENT_MEMBERS_URL, ORG_WORK_WEIXIN_PROVIDER, \
    ORG_WORK_WEIXIN_LIST_ACTIVED_ACCOUNT_URL, ORG_WORK_WEIXIN_GET_ACTIVE_INFO_BY_USER_URL, \
    ORG_WORK_WEIXIN_GET_APP_LICENSE_INFO_URL, ORG_WORK_WEIXIN_GET_REGISTER_CODE_URL, ORG_WORK_WEIXIN_OPEN_PACKAGE_ID

if ENABLE_ORG_WORK_WEIXIN:
    logger = setup_logger('org_work_weixin_oauth.log')
else:
    logger = logging.getLogger(__name__)
SUITE_TICKET_CACHE_KEY = 'ORG_WORK_WEIXIN_SUITE_TICKET'
SUITE_ACCESS_TOKEN_CACHE_KEY = 'ORG_WORK_WEIXIN_SUITE_ACCESS_TOKEN'
PRE_AUTH_CODE_CACHE_KEY = 'ORG_WORK_WEIXIN_PRE_AUTH_CODE'
CORP_ACCESS_TOKEN_CACHE_KEY = 'ORG_WORK_WEIXIN_CORP_ACCESS_TOKEN'
PROVIDER_ACCESS_TOKEN_CACHE_KEY = 'ORG_WORK_WEIXIN_ACCESS_TOKEN_CACHE_KEY'
CORP_JSAPI_TOKEN_CACHE_KEY = 'ORG_WORK_WEIXIN_CORP_JSAPI_TOKEN'
AGENT_JSAPI_TOKEN_CACHE_KEY = 'ORG_WORK_WEIXIN_AGENT_JSAPI_TOKEN'
OPEN_USER_ID_CACHE_KEY = 'ORG_WORK_WEIXIN_OPEN_USER_ID'


def org_work_weixin_check():
    """ org work weixin check
    """
    if not is_pro_version():
        return False
    if not ENABLE_ORG_WORK_WEIXIN:
        return False

    if not ORG_WORK_WEIXIN_CORP_ID \
            or not ORG_WORK_WEIXIN_SUITE_ID \
            or not ORG_WORK_WEIXIN_ENCODING_AES_KEY \
            or not ORG_WORK_WEIXIN_TOKEN \
            or not ORG_WORK_WEIXIN_SECRET \
            or not ORG_WORK_WEIXIN_PROVIDER_SECRET:
        logger.warning('org work weixin relevant settings invalid.')
        logger.warning(
            'please check ORG_WORK_WEIXIN_CORP_ID, SUITE_ID, TOKEN, SECRET, ENCODING_AES_KEY')

        return False

    return True


def get_wxcpt(method):
    """https://work.weixin.qq.com/api/doc/90001/90148/91144
    """
    if not org_work_weixin_check():
        return None

    if method == 'GET':
        wxcpt = WXBizMsgCrypt(
            ORG_WORK_WEIXIN_TOKEN,
            ORG_WORK_WEIXIN_ENCODING_AES_KEY,
            ORG_WORK_WEIXIN_CORP_ID,
        )
    elif method == 'POST':
        wxcpt = WXBizMsgCrypt(
            ORG_WORK_WEIXIN_TOKEN,
            ORG_WORK_WEIXIN_ENCODING_AES_KEY,
            ORG_WORK_WEIXIN_SUITE_ID,
        )
    else:
        wxcpt = None

    return wxcpt


def set_suite_ticket(suite_ticket):
    cache_key = normalize_cache_key(SUITE_TICKET_CACHE_KEY)
    cache.set(cache_key, suite_ticket, timeout=None)
    return suite_ticket


def get_suite_ticket():
    cache_key = normalize_cache_key(SUITE_TICKET_CACHE_KEY)
    suite_ticket = cache.get(cache_key, None)
    return suite_ticket


def handler_org_work_weixin_api_response(response):
    """ handler org work_weixin response and errcode
    """
    try:
        response = response.json()
    except ValueError:
        logger.warning(response)
        return None

    errcode = response.get('errcode', 0)
    if errcode != 0:
        if errcode == 81013:
            # https://developers.weixin.qq.com/community/develop/doc/000c46c305449000b0cb8027e57000
            logger.warning(json.dumps(response))
            try:
                invaliduser = response.get('invaliduser')
                if invaliduser:
                    from seahub.auth.models import SocialAuthUser
                    SocialAuthUser.objects.filter(
                        provider=ORG_WORK_WEIXIN_PROVIDER, uid__contains=invaliduser).delete()
            except Exception as e:
                logger.warning(e)
        else:
            logger.warning(json.dumps(response))
        return None

    return response


def get_suite_access_token():
    """ get global org work weixin suite access_token
    https://work.weixin.qq.com/api/doc/90001/90143/90600
    """
    cache_key = normalize_cache_key(SUITE_ACCESS_TOKEN_CACHE_KEY)
    suite_access_token = cache.get(cache_key, None)

    if not suite_access_token:
        suite_ticket = get_suite_ticket()
        data = {
            'suite_id': ORG_WORK_WEIXIN_SUITE_ID,
            'suite_secret': ORG_WORK_WEIXIN_SECRET,
            'suite_ticket': suite_ticket,
        }
        api_response = requests.post(
            ORG_WORK_WEIXIN_SUITE_ACCESS_TOKEN_URL, json=data)
        api_response_dic = handler_org_work_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get work weixin response')
            return None
        suite_access_token = api_response_dic.get('suite_access_token')
        expires_in = api_response_dic.get('expires_in')
        if suite_access_token and expires_in:
            cache.set(cache_key, suite_access_token, expires_in)

    return suite_access_token


def set_session_info(pre_auth_code):
    """https://work.weixin.qq.com/api/doc/90001/90143/90602
    """
    suite_access_token = get_suite_access_token()
    data = {
        'pre_auth_code': pre_auth_code,
        'session_info': {
            'auth_type': ORG_WORK_WEIXIN_AUTH_TYPE,
        },
    }
    url = ORG_WORK_WEIXIN_SET_SESSION_INFO_URL + \
        '?suite_access_token=' + suite_access_token
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin response')
        return None

    return api_response_dic


def get_pre_auth_code():
    """ create_auth from seatable
    https://work.weixin.qq.com/api/doc/90001/90143/90601
    """
    suite_access_token = get_suite_access_token()
    url = ORG_WORK_WEIXIN_PRE_AUTH_CODE_URL + \
        '?suite_access_token=' + suite_access_token
    api_response = requests.get(url)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin response')
        return None
    pre_auth_code = api_response_dic.get('pre_auth_code')

    # set_session_info
    set_session_info(pre_auth_code)

    return pre_auth_code


def get_permanent_code(auth_code):
    """https://work.weixin.qq.com/api/doc/90001/90143/90603
    """
    suite_access_token = get_suite_access_token()
    data = {
        'auth_code': auth_code,
    }
    url = ORG_WORK_WEIXIN_GET_PERMANENT_CODE_URL + \
            '?suite_access_token=' + suite_access_token
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin response')
        return None

    corp_info = api_response_dic
    return corp_info


def add_corp(corp_info, org_id=None):
    from seahub.organizations.models import OrgCorpAuth

    permanent_code = corp_info.get('permanent_code')
    expires_in = corp_info.get('expires_in')
    corp_access_token = corp_info.get('access_token')
    auth_corp_info = corp_info.get('auth_corp_info')
    corp_id = auth_corp_info.get('corpid')
    corp_name = auth_corp_info.get('corp_name')
    extra_data = json.dumps(corp_info)

    org_corp = OrgCorpAuth.objects.add_corp(
        org_id, corp_id, corp_name, permanent_code, extra_data)

    cache_key = normalize_cache_key(CORP_ACCESS_TOKEN_CACHE_KEY, corp_id)
    if corp_access_token and expires_in:
        cache.set(cache_key, corp_access_token, expires_in)

    return org_corp


def get_corp_access_token(corp_id, permanent_code):
    """https://work.weixin.qq.com/api/doc/90001/90143/90605
    """
    cache_key = normalize_cache_key(CORP_ACCESS_TOKEN_CACHE_KEY, corp_id)
    corp_access_token = cache.get(cache_key, None)

    if not corp_access_token:
        suite_access_token = get_suite_access_token()
        data = {
            'auth_corpid': corp_id,
            'permanent_code': permanent_code,
        }
        url = ORG_WORK_WEIXIN_CORP_ACCESS_TOKEN_URL + \
            '?suite_access_token=' + suite_access_token
        api_response = requests.post(url, json=data)
        api_response_dic = handler_org_work_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get work weixin response')
            return None
        corp_access_token = api_response_dic.get('access_token')
        expires_in = api_response_dic.get('expires_in')
        if corp_access_token and expires_in:
            cache.set(cache_key, corp_access_token, expires_in)

    return corp_access_token


def get_provider_access_token():
    """https://work.weixin.qq.com/api/doc/90001/90142/90593
    """
    cache_key = normalize_cache_key(PROVIDER_ACCESS_TOKEN_CACHE_KEY)
    provider_access_token = cache.get(cache_key, None)

    if not provider_access_token:
        data = {
            'corpid': ORG_WORK_WEIXIN_CORP_ID,
            'provider_secret': ORG_WORK_WEIXIN_PROVIDER_SECRET,
        }
        api_response = requests.post(ORG_WORK_WEIXIN_PROVIDER_ACCESS_TOKEN_URL, json=data)
        api_response_dic = handler_org_work_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get work weixin response')
            return None
        provider_access_token = api_response_dic.get('provider_access_token')
        expires_in = api_response_dic.get('expires_in')
        if provider_access_token and expires_in:
            cache.set(cache_key, provider_access_token, expires_in)

    return provider_access_token


def get_corp_jsapi_ticket(corp_id, permanent_code):
    """https://developer.work.weixin.qq.com/document/path/90506
    """
    cache_key = normalize_cache_key(corp_id, CORP_JSAPI_TOKEN_CACHE_KEY)
    corp_jsapi_ticket = cache.get(cache_key, None)

    if not corp_jsapi_ticket:
        corp_access_token = get_corp_access_token(corp_id, permanent_code)
        url = ORG_WORK_WEIXIN_CORP_JSAPI_TOKEN_URL + 'access_token=' + corp_access_token
        api_response = requests.get(url)
        api_response_dic = handler_org_work_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get work weixin response')
            return None
        corp_jsapi_ticket = api_response_dic.get('ticket')
        expires_in = api_response_dic.get('expires_in')
        if corp_jsapi_ticket and expires_in:
            cache.set(cache_key, corp_jsapi_ticket, expires_in)

    return corp_jsapi_ticket


def get_agent_jsapi_ticket(corp_id, permanent_code):
    """https://developer.work.weixin.qq.com/document/path/90506
    """
    cache_key = normalize_cache_key(corp_id, AGENT_JSAPI_TOKEN_CACHE_KEY)
    agent_jsapi_ticket = cache.get(cache_key, None)

    if not agent_jsapi_ticket:
        corp_access_token = get_corp_access_token(corp_id, permanent_code)
        url = ORG_WORK_WEIXIN_AGENT_JSAPI_TOKEN_URL + \
            '?access_token=' + corp_access_token + '&type=agent_config'
        api_response = requests.get(url)
        api_response_dic = handler_org_work_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get work weixin response')
            return None
        agent_jsapi_ticket = api_response_dic.get('ticket')
        expires_in = api_response_dic.get('expires_in')
        if agent_jsapi_ticket and expires_in:
            cache.set(cache_key, agent_jsapi_ticket, expires_in)

    return agent_jsapi_ticket


def get_agent_config(org_corp):
    """https://developer.work.weixin.qq.com/document/path/90506
    """
    corp_id = org_corp.corp_id
    permanent_code = org_corp.permanent_code
    extra_data = json.loads(org_corp.extra_data)
    agent_id = extra_data['auth_info']['agent'][0]['agentid']

    # signature
    agent_jsapi_ticket = get_agent_jsapi_ticket(corp_id, permanent_code)
    timestamp = int(time.time())
    nonce_str = ''.join(random.choice(
        string.ascii_uppercase + string.ascii_lowercase + string.digits) for _ in range(16))
    url = get_site_scheme_and_netloc() + reverse('org_work_weixin')
    signature_string = 'jsapi_ticket=' + agent_jsapi_ticket + '&noncestr=' + nonce_str + \
        '&timestamp=' + str(timestamp) + '&url=' + url
    signature = hashlib.sha1(signature_string.encode('utf-8')).hexdigest()

    agent_config = {
        'corpid': corp_id,
        'agentid': agent_id,
        'timestamp': timestamp,
        'nonceStr': nonce_str,
        'signature': signature,
        'jsApiList': ['selectExternalContact'],
    }

    return agent_config


def get_corp_info(corp_id, permanent_code):
    suite_access_token = get_suite_access_token()
    url = ORG_WORK_WEIXIN_CORP_INFO_URL + \
        '?suite_access_token=' + suite_access_token
    data = {
        'auth_corpid': corp_id,
        'permanent_code': permanent_code,
    }
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin response')
        return None

    corp_info = api_response_dic
    return corp_info


def update_corp_info(corp_id):
    from seahub.organizations.models import OrgCorpAuth

    org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
    permanent_code = org_corp.permanent_code
    suite_access_token = get_suite_access_token()
    url = ORG_WORK_WEIXIN_CORP_INFO_URL + \
        '?suite_access_token=' + suite_access_token
    data = {
        'auth_corpid': corp_id,
        'permanent_code': permanent_code,
    }
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin response')
        return None

    org_corp.extra_data = json.dumps(api_response_dic)
    org_corp.save(update_fields=['extra_data'])

    return org_corp


def get_org_subscription(org_id):
    from seahub.subscription.settings import SUBSCRIPTION_SERVER_URL, SUBSCRIPTION_ORG_PREFIX
    from seahub.subscription.utils import get_subscription_api_headers, handler_subscription_api_response

    customer_id = SUBSCRIPTION_ORG_PREFIX + str(org_id)
    headers = get_subscription_api_headers()

    data = {
        'customer_id': customer_id,
    }
    url = SUBSCRIPTION_SERVER_URL.rstrip(
        '/') + '/api/subscription/'
    response = requests.get(url, params=data, headers=headers)
    response = handler_subscription_api_response(response)
    subscription = response.json().get('subscription')
    return subscription


def list_corp_orders(corp_id):
    from seahub.subscription.settings import SUBSCRIPTION_SERVER_URL
    from seahub.subscription.utils import get_subscription_api_headers, handler_subscription_api_response

    headers = get_subscription_api_headers()
    provider_access_token = get_provider_access_token()
    data = {
        'corp_id': corp_id,
        'provider_access_token': provider_access_token,
    }
    url = SUBSCRIPTION_SERVER_URL.rstrip(
        '/') + '/api/org-work-weixin-license/orders/'
    response = requests.get(url, params=data, headers=headers)
    response = handler_subscription_api_response(response)
    orders = response.json().get('orders')

    return orders


def org_work_weixin_pay(info_type, order_id, corp_id):
    from seahub.subscription.settings import SUBSCRIPTION_SERVER_URL
    from seahub.subscription.utils import get_subscription_api_headers, handler_subscription_api_response

    headers = get_subscription_api_headers()
    data = {
        'info_type': info_type,
        'order_id': order_id,
        'corp_id': corp_id,
    }
    url = SUBSCRIPTION_SERVER_URL.rstrip(
        '/') + '/api/org-work-weixin-pay/'
    response = requests.post(url, json=data, headers=headers)
    response = handler_subscription_api_response(response)
    return response


def list_corp_license_actived_account(corp_id):
    """https://developer.work.weixin.qq.com/document/path/95544
    """
    provider_access_token = get_provider_access_token()
    url = ORG_WORK_WEIXIN_LIST_ACTIVED_ACCOUNT_URL + \
        '?provider_access_token=' + provider_access_token
    data = {
        'corpid': corp_id,
        'limit': 1000,
    }
    response = requests.post(url, json=data, timeout=30)
    logger.info(str(response.status_code) + ' ' + response.text)
    response = handler_org_work_weixin_api_response(response)
    return response


def get_active_info_by_user(uid):
    """https://developer.work.weixin.qq.com/document/path/95555
    """
    # uid = corp_id + '_' + user_id
    if len(uid) == 65:   # new corp with encrypted corp_id and user_id
        corp_id = uid[:32]
        user_id = uid[33:]
    else:                # old corp is not encrypted
        corp_id = uid[:18]
        user_id = uid[19:]
    provider_access_token = get_provider_access_token()
    url = ORG_WORK_WEIXIN_GET_ACTIVE_INFO_BY_USER_URL + \
        '?provider_access_token=' + provider_access_token
    data = {
        'corpid': corp_id,
        'userid': user_id,
    }
    response = requests.post(url, json=data, timeout=30)
    logger.info(str(response.status_code) + ' ' + response.text)
    response = handler_org_work_weixin_api_response(response)
    return response


def get_app_license_info(corp_id):
    """https://developer.work.weixin.qq.com/document/path/95844
    """
    provider_access_token = get_provider_access_token()
    url = ORG_WORK_WEIXIN_GET_APP_LICENSE_INFO_URL + \
        '?provider_access_token=' + provider_access_token
    data = {
        'corpid': corp_id,
        'suite_id': ORG_WORK_WEIXIN_SUITE_ID,
    }
    response = requests.post(url, json=data, timeout=30)
    logger.info(str(response.status_code) + ' ' + response.text)
    response = handler_org_work_weixin_api_response(response)
    return response


def list_department_members(corp_id, permanent_code, department_id):
    """https://developer.work.weixin.qq.com/document/path/90201
    """
    corp_access_token = get_corp_access_token(corp_id, permanent_code)
    url = ORG_WORK_WEIXIN_LIST_DEPARTMENT_MEMBERS_URL + \
        '?access_token=' + corp_access_token + '&department_id=' + str(department_id) + \
        '&fetch_child=1'
    api_response = requests.get(url)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get work weixin response')
        return None

    user_list = api_response_dic.get('userlist')
    return user_list


def list_all_members(org_corp, allow_party, allow_user):
    """https://developer.work.weixin.qq.com/document/path/90201
    """
    from seahub.auth.models import SocialAuthUser

    social_auth_queryset = SocialAuthUser.objects.filter(
        provider=ORG_WORK_WEIXIN_PROVIDER, uid__contains=org_corp.corp_id)
    user_map = {}

    # allow_party
    for party_id in allow_party:
        time.sleep(0.01)
        member_list = list_department_members(
            org_corp.corp_id, org_corp.permanent_code, party_id)
        for user in member_list:
            user_id = user['userid']
            social_auth = social_auth_queryset.filter(uid__contains=user_id).first()
            username = social_auth.username if social_auth else ''
            name = email2nickname(social_auth.username) if social_auth else ''
            user_info = {
                'name': name,
                'username': username,
                'user_id': user_id,
                'active_status': 0,  # 帐号激活状态。0：未激活、 1：已激活
                'active_expire_time': '',
            }
            user_map[user_id] = user_info

    # allow_user
    for user_id in allow_user:
        social_auth = social_auth_queryset.filter(uid__contains=user_id).first()
        username = social_auth.username if social_auth else ''
        name = email2nickname(social_auth.username) if social_auth else ''
        user_info = {
            'name': name,
            'username': username,
            'user_id': user_id,
            'active_status': 0,  # 帐号激活状态。0：未激活、 1：已激活
            'active_expire_time': '',
        }
        user_map[user_id] = user_info

    # org-work-weixin-license
    license_actived_account = list_corp_license_actived_account(org_corp.corp_id)
    account_list = license_actived_account.get('account_list')
    now = int(time.time())
    for account in account_list:
        try:
            open_user_id = account.get('userid')
            social_auth = social_auth_queryset.filter(extra_data__contains=open_user_id).first()
            if not social_auth:
                continue
            user_id = social_auth.uid[len(org_corp.corp_id)+1:]
            if user_id not in user_map:
                continue
            expire_time = account.get('expire_time')
            user_map[user_id]['active_status'] = 1 if expire_time > now else 0  # 帐号激活状态。0：未激活、 1：已激活
            expire_time = datetime.fromtimestamp(expire_time).strftime('%Y-%m-%d')
            user_map[user_id]['active_expire_time'] = expire_time
        except Exception as e:
            logger.warning(e)

    all_members = list(user_map.values())
    return all_members


def get_register_code():
    """https://developer.work.weixin.qq.com/document/path/90805
    """
    provider_access_token = get_provider_access_token()
    url = ORG_WORK_WEIXIN_GET_REGISTER_CODE_URL + \
        '?provider_access_token=' + provider_access_token
    data = {
        'template_id': ORG_WORK_WEIXIN_OPEN_PACKAGE_ID,
    }
    api_response = requests.post(url, json=data, timeout=30)
    logger.info(str(api_response.status_code) + ' ' + api_response.text)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get org work weixin response')
        return None

    register_code = api_response_dic.get('register_code')
    return register_code


def update_org_work_weixin_user_info(api_user):
    """ update user profile from org work weixin
    """
    # update additional user info
    username = api_user.get('username')
    nickname = '新用户-' + api_user.get('UserId', '')[-2:]
    contact_email = api_user.get('contact_email')
    headimgurl = api_user.get('avatar')
    phone = api_user.get('mobile')

    # make sure the contact_email, phone is unique
    if contact_email and Profile.objects.get_profile_by_contact_email(contact_email):
        logger.warning('contact email %s already exists' % contact_email)
        contact_email = ''

    if phone and Profile.objects.get_profile_by_phone(phone):
        logger.warning('phone %s already exists' % phone)
        phone = ''

    profile_kwargs = {}
    if nickname:
        profile_kwargs['nickname'] = nickname
    if contact_email:
        profile_kwargs['contact_email'] = contact_email
    if phone:
        profile_kwargs['phone'] = phone

    if profile_kwargs:
        try:
            Profile.objects.add_or_update(username, **profile_kwargs)
        except Exception as e:
            logger.warning(e)

    # avatar
    if headimgurl:
        try:
            image_name = 'org_work_weixin_avatar'
            image_file = requests.get(headimgurl).content
            avatar = Avatar.objects.filter(emailuser=username, primary=True).first()
            avatar = avatar or Avatar(emailuser=username, primary=True)
            avatar_file = ContentFile(image_file)
            avatar_file.name = image_name
            avatar.avatar = avatar_file
            avatar.save()
        except Exception as e:
            logger.warning(e)

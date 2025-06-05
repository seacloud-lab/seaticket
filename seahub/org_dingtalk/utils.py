import json
import time
import hmac
import urllib
import base64
import logging
import requests

from django.core.cache import cache
from django.core.files.base import ContentFile

from seahub.utils import normalize_cache_key, setup_logger, is_pro_version
from seahub.org_dingtalk.settings import ENABLE_ORG_DINGTALK, \
    ORG_DINGTALK_SUITE_KEY, ORG_DINGTALK_SUITE_SECRET, \
    ORG_DINGTALK_TOKEN, ORG_DINGTALK_ENCODING_AES_KEY, ORG_DINGTALK_MESSAGE_TEMPLATE_ID, \
    ORG_DINGTALK_SUITE_ACCESS_TOKEN_URL, ORG_DINGTALK_USER_ACCESS_TOKEN_URL, \
    ORG_DINGTALK_GET_USER_INFO_URL, ORG_DINGTALK_GET_CORP_ACCESS_TOKEN_URL, \
    ORG_DINGTALK_LOGON_FREE_GET_CORP_ACCESS_TOKEN_URL, ORG_DINGTALK_LOGON_FREE_GET_USER_INFO_URL, \
    ORG_DINGTALK_LOGON_FREE_GET_USER_URL, ORG_DINGTALK_UNIONID_TO_USERID_URL
from seahub.avatar.models import Avatar
from seahub.profile.models import Profile

if ENABLE_ORG_DINGTALK:
    logger = setup_logger('org_dingtalk_oauth.log')
else:
    logger = logging.getLogger(__name__)
SUITE_TICKET_CACHE_KEY = 'ORG_DINGTALK_SUITE_TICKET'
SUITE_ACCESS_TOKEN_CACHE_KEY = 'ORG_DINGTALK_SUITE_ACCESS_TOKEN'
CORP_ACCESS_TOKEN_CACHE_KEY = 'ORG_DINGTALK_CORP_ACCESS_TOKEN'
LOGON_FREE_CORP_ACCESS_TOKEN_CACHE_KEY = 'LOGON_FREE_ORG_DINGTALK_CORP_ACCESS_TOKEN'
USERID_CACHE_KEY = 'ORG_DINGTALK_USERID'

def org_dingtalk_check():
    """ org dingtalk check
    """
    if not is_pro_version():
        return False
    if not ENABLE_ORG_DINGTALK:
        return False

    if not ORG_DINGTALK_SUITE_KEY \
            or not ORG_DINGTALK_SUITE_SECRET \
            or not ORG_DINGTALK_TOKEN \
            or not ORG_DINGTALK_ENCODING_AES_KEY \
            or not ORG_DINGTALK_MESSAGE_TEMPLATE_ID:
        logger.warning('org dingtalk relevant settings invalid.')
        logger.warning(
            'please check ORG_DINGTALK_SUITE_KEY, SUITE_SECRET, TOKEN, ENCODING_AES_KEY, TEMPLATE_ID')

        return False

    return True


def handler_org_dingtalk_api_response(response):
    """ handler org dingtalk response and errcode
    """
    if not response.ok:
        logger.warning(response.text)
        return None

    try:
        response = response.json()
    except ValueError:
        logger.warning(response)
        return None

    return response


def set_suite_ticket(suite_ticket):
    """https://open.dingtalk.com/document/isv/data-format
    """
    cache_key = normalize_cache_key(SUITE_TICKET_CACHE_KEY)
    cache.set(cache_key, suite_ticket, timeout=None)
    return suite_ticket


def get_suite_ticket():
    cache_key = normalize_cache_key(SUITE_TICKET_CACHE_KEY)
    suite_ticket = cache.get(cache_key, None)
    return suite_ticket


def get_suite_access_token():
    """ get global org dingtalk suite access_token
    https://open.dingtalk.com/document/isvapp-server/obtains-the-suite_acess_token-of-third-party-enterprise-applications
    """
    cache_key = normalize_cache_key(SUITE_ACCESS_TOKEN_CACHE_KEY)
    suite_access_token = cache.get(cache_key, None)

    if not suite_access_token:
        suite_ticket = get_suite_ticket()
        data = {
            'suiteKey': ORG_DINGTALK_SUITE_KEY,
            'suiteSecret': ORG_DINGTALK_SUITE_SECRET,
            'suiteTicket': suite_ticket,
        }
        api_response = requests.post(
            ORG_DINGTALK_SUITE_ACCESS_TOKEN_URL, json=data)
        api_response_dic = handler_org_dingtalk_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get dingtalk response')
            return None
        suite_access_token = api_response_dic.get('accessToken')
        expires_in = api_response_dic.get('expireIn')
        if suite_access_token and expires_in:
            cache.set(cache_key, suite_access_token, expires_in)

    return suite_access_token


def get_user_access_token(code):
    """user_access_token and corp_id
    https://open.dingtalk.com/document/isvapp-server/obtain-user-token
    """
    suite_access_token = get_suite_access_token()
    headers = {
        'x-acs-dingtalk-access-token': suite_access_token,
    }
    data = {
        'clientId': ORG_DINGTALK_SUITE_KEY,
        'clientSecret': ORG_DINGTALK_SUITE_SECRET,
        'code': code,
        'grantType': 'authorization_code',
    }
    url = ORG_DINGTALK_USER_ACCESS_TOKEN_URL
    api_response = requests.post(url, headers=headers, json=data)
    api_response_dic = handler_org_dingtalk_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get dingtalk response')
        return None, None
    user_access_token = api_response_dic.get('accessToken')
    corp_id = api_response_dic.get('corpId')

    return user_access_token, corp_id


def get_api_user(user_access_token):
    """user info
    https://open.dingtalk.com/document/isvapp-server/dingtalk-retrieve-user-information
    """
    headers = {
        'x-acs-dingtalk-access-token': user_access_token,
    }
    url = ORG_DINGTALK_GET_USER_INFO_URL + 'me'
    api_response = requests.get(url, headers=headers)
    api_response_dic = handler_org_dingtalk_api_response(api_response)

    return api_response_dic


def get_logon_free_corp_access_token(corp_id):
    """ get logon free org dingtalk corp access_token
    https://open.dingtalk.com/document/isvapp-server/obtains-the-enterprise-authorized-credential
    """
    cache_key = normalize_cache_key(corp_id, LOGON_FREE_CORP_ACCESS_TOKEN_CACHE_KEY)
    corp_access_token = cache.get(cache_key, None)

    if not corp_access_token:
        timestamp = str(int(time.time() * 1000))
        suite_ticket = get_suite_ticket()
        msg = timestamp + '\n' + suite_ticket
        key = ORG_DINGTALK_SUITE_SECRET.encode('utf-8')
        msg = msg.encode('utf-8')
        obj = hmac.new(key, msg=msg, digestmod='sha256')
        signature = base64.b64encode(obj.digest()).decode('utf-8')

        params = {
            'signature': signature,
            'timestamp': int(timestamp),
            'suiteTicket': suite_ticket,
            'accessKey': ORG_DINGTALK_SUITE_KEY,
        }
        data = {
            'auth_corpid': corp_id
        }
        url = ORG_DINGTALK_LOGON_FREE_GET_CORP_ACCESS_TOKEN_URL + '?' + \
            urllib.parse.urlencode(params) 
        api_response = requests.post(url, json=data)
        api_response_dic = handler_org_dingtalk_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get dingtalk response')
            return None
        corp_access_token = api_response_dic.get('access_token')
        expires_in = api_response_dic.get('expires_in')
        if corp_access_token and expires_in:
            cache.set(cache_key, corp_access_token, expires_in)

    return corp_access_token


def get_logon_free_api_user(code, corp_id):
    """user info
    https://open.dingtalk.com/document/orgapp-server/obtain-the-userid-of-a-user-by-using-the-log-free
    https://open.dingtalk.com/document/isvapp-server/query-user-details
    """
    corp_access_token = get_logon_free_corp_access_token(corp_id)
    data = {
        'code': code,
    }
    url = ORG_DINGTALK_LOGON_FREE_GET_USER_INFO_URL + '?access_token=' + corp_access_token
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_dingtalk_api_response(api_response)
    result = api_response_dic.get('result', {})
    userid = result.get('userid')

    #
    data = {
        'userid': userid,
    }
    url = ORG_DINGTALK_LOGON_FREE_GET_USER_URL + '?access_token=' + corp_access_token
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_dingtalk_api_response(api_response)
    result = api_response_dic.get('result', {})
    result['unionId'] = result.get('unionid')
    result['nick'] = result.get('name')
    result['contact_email'] = result.get('email')
    result['avatarUrl'] = result.get('avatar')
    # result['mobile'] = result.get('mobile')

    return result


def update_dingtalk_user_info(api_user):
    """ update user profile from dingtalk

    use for dingtalk login, profile bind
    """
    # update additional user info
    username = api_user.get('username')
    nickname = api_user.get('nick') or '新用户-' + api_user.get('unionId', '')[-6:-4]
    contact_email = api_user.get('contact_email')
    headimgurl = api_user.get('avatarUrl')
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
            image_name = 'dingtalk_avatar'
            image_file = requests.get(headimgurl).content
            avatar = Avatar.objects.filter(emailuser=username, primary=True).first()
            avatar = avatar or Avatar(emailuser=username, primary=True)
            avatar_file = ContentFile(image_file)
            avatar_file.name = image_name
            avatar.avatar = avatar_file
            avatar.save()
        except Exception as e:
            logger.warning(e)


def get_corp_access_token(corp_id):
    """https://open.dingtalk.com/document/isvapp-server/obtain-the-access_token-of-the-authorized-enterprise
    """
    cache_key = normalize_cache_key(corp_id, CORP_ACCESS_TOKEN_CACHE_KEY)
    corp_access_token = cache.get(cache_key, None)

    if not corp_access_token:
        suite_ticket = get_suite_ticket()
        data = {
            'suiteKey': ORG_DINGTALK_SUITE_KEY,
            'suiteSecret': ORG_DINGTALK_SUITE_SECRET,
            'authCorpId': corp_id,
            'suiteTicket': suite_ticket,
        }
        url = ORG_DINGTALK_GET_CORP_ACCESS_TOKEN_URL
        api_response = requests.post(url, json=data)
        api_response_dic = handler_org_dingtalk_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get dingtalk response')
            return None
        corp_access_token = api_response_dic.get('accessToken')
        expires_in = api_response_dic.get('expireIn')
        if corp_access_token and expires_in:
            cache.set(cache_key, corp_access_token, expires_in)

    return corp_access_token


def unionid_to_userid(unionid, corp_id):
    """
    https://open.dingtalk.com/document/orgapp-server/query-a-user-by-the-union-id
    """
    cache_key = normalize_cache_key(unionid, USERID_CACHE_KEY, corp_id)
    userid = cache.get(cache_key, None)
    if userid:
        return userid

    corp_access_token = get_corp_access_token(corp_id)
    url = ORG_DINGTALK_UNIONID_TO_USERID_URL + '?access_token=' + corp_access_token
    data = {"unionid": unionid}
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_dingtalk_api_response(api_response)
    if not api_response_dic:
        logger.warning('can not get dingtalk response')
        return None
    userid = api_response_dic.get('result', {}).get('userid')
    if userid:
        cache.set(cache_key, userid)

    return userid


def add_corp(corp_info, org_id=None):
    from seahub.organizations.models import OrgCorpAuth

    auth_corp_info = corp_info.get('auth_corp_info')
    corp_id = auth_corp_info.get('corpid')
    corp_name = auth_corp_info.get('corp_name')
    extra_data = json.dumps(corp_info)
    permanent_code = ''  # empty in dingtalk

    org_corp = OrgCorpAuth.objects.add_corp(
        org_id, corp_id, corp_name, permanent_code, extra_data)

    return org_corp


def update_corp_info(org_corp, extra_data):
    org_corp.extra_data = json.dumps(extra_data)
    org_corp.save(update_fields=['extra_data'])

    return org_corp

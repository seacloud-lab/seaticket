import json
import logging
import requests
import urllib

from django.core.cache import cache
from django.core.files.base import ContentFile
from seahub.utils import normalize_cache_key, is_pro_version
from seahub.avatar.models import Avatar
from seahub.profile.models import Profile

from seahub.dingtalk.settings import DINGTALK_APP_KEY, DINGTALK_AGENT_ID, \
    DINGTALK_APP_SECRET, ENABLE_DINGTALK, DINGTALK_GET_APP_ACCESS_TOKEN_URL, \
    DINGTALK_GET_USERID_BY_UNIONID_URL, DINGTALK_GET_DETAILED_USER_INFO_URL, \
    DINGTALK_AUTH_TOKEN_GRANT_TYPE, DINGTALK_USER_ACCESS_TOKEN_URL, \
    DINGTALK_GET_USER_INFO_URL, DINGTALK_UNION_CACHE_PREFIX, \
    DINGTALK_ACCESS_TOKEN_CACHE_KEY

logger = logging.getLogger(__name__)


def dingtalk_check():
    """ dingtalk check
    """
    if not is_pro_version():
        return False
    if not ENABLE_DINGTALK:
        return False

    if not DINGTALK_AGENT_ID or not DINGTALK_APP_KEY or not DINGTALK_APP_SECRET:
        logger.warning('dingtalk relevant settings invalid.')
        logger.warning('please check DINGTALK_AGENT_ID, DINGTALK_APP_KEY, DINGTALK_APP_SECRET')
        return False

    return True


def handler_dingtalk_api_response(response):
    """ handler dingtalk response and errcode
    """
    try:
        response = response.json()
    except ValueError:
        logger.warning(response)
        return None

    errcode = response.get('errcode', None)
    if errcode != 0:
        logger.warning(json.dumps(response))
        return None
    return response


def dingtalk_get_access_token():
    """
    https://open.dingtalk.com/document/orgapp-server/obtain-orgapp-token
    """
    cache_key = normalize_cache_key(DINGTALK_ACCESS_TOKEN_CACHE_KEY)
    access_token = cache.get(cache_key, None)
    if access_token:
        return access_token

    data = {
        'appkey': DINGTALK_APP_KEY,
        'appsecret': DINGTALK_APP_SECRET,
    }
    resp_json = requests.get(DINGTALK_GET_APP_ACCESS_TOKEN_URL,
                             params=data).json()

    access_token = resp_json.get('access_token', '')
    if not access_token:
        logger.warning('failed to get dingtalk access_token')
        logger.warning(DINGTALK_GET_APP_ACCESS_TOKEN_URL)
        logger.warning(data)
        logger.warning(resp_json)
        return ''

    expires_in = resp_json.get('expires_in', 7200)
    cache.set(cache_key, access_token, expires_in)

    return access_token


def dingtalk_get_userid_by_unionid(union_id):
    """
    https://open.dingtalk.com/document/orgapp-server/query-a-user-by-the-union-id
    """
    cache_key = normalize_cache_key(union_id, DINGTALK_UNION_CACHE_PREFIX)
    user_id = cache.get(cache_key, None)
    if user_id:
        return user_id

    access_token = dingtalk_get_access_token()

    parameters = {'access_token': access_token}
    data = {'unionid': union_id}

    get_user_id_by_unionid_url = DINGTALK_GET_USERID_BY_UNIONID_URL + '?' + urllib.parse.urlencode(parameters)
    resp_json = requests.post(get_user_id_by_unionid_url, data=data).json()

    result = resp_json.get('result', {})
    user_id = result.get('userid')

    if not user_id:
        logger.warning('failed to get userid by unionid: %s' % union_id)
        logger.warning(DINGTALK_GET_USERID_BY_UNIONID_URL)
        logger.warning(data)
        logger.warning(resp_json)
        return ''

    cache.set(cache_key, user_id)
    return user_id


def dingtalk_get_detailed_user_info(union_id):
    """
    https://open.dingtalk.com/document/orgapp-server/query-user-details
    """
    access_token = dingtalk_get_access_token()

    parameters = {
        'access_token': access_token,
    }
    data = {'userid': dingtalk_get_userid_by_unionid(union_id)}

    get_user_id_by_unionid_url = DINGTALK_GET_DETAILED_USER_INFO_URL + '?' + urllib.parse.urlencode(parameters)
    resp_json = requests.post(get_user_id_by_unionid_url, data=data).json()

    return resp_json.get('result', {})


def dingtalk_get_user_access_token(code):
    """
    https://open.dingtalk.com/document/orgapp-server/obtain-user-token
    """
    data = {
        "clientId": DINGTALK_APP_KEY,
        "code": code,
        "clientSecret": DINGTALK_APP_SECRET,
        "grantType": DINGTALK_AUTH_TOKEN_GRANT_TYPE,
    }
    headers = {'Content-Type': 'application/json'}

    access_token_resp = requests.post(DINGTALK_USER_ACCESS_TOKEN_URL, headers=headers, data=json.dumps(data))
    access_token = access_token_resp.json().get('accessToken')
    if not access_token:
        logger.warning('failed to get dingtalk user access_token')
        logger.warning(DINGTALK_USER_ACCESS_TOKEN_URL)
        logger.warning(data)
        logger.warning(access_token_resp.text)
        return ''

    return access_token


def dingtalk_get_user_info(access_token, union_id='me'):
    """
    https://open.dingtalk.com/document/orgapp-server/dingtalk-retrieve-user-information
    """

    user_info_url = urllib.parse.urljoin(DINGTALK_GET_USER_INFO_URL, union_id)
    user_info_resp = requests.get(user_info_url, headers={'x-acs-dingtalk-access-token': access_token})

    return user_info_resp.json()


def update_dingtalk_user_info(email, name, contact_email, avatar_url, phone):
    # make sure the contact_email is unique
    if contact_email and Profile.objects.get_profile_by_contact_email(contact_email):
        contact_email = ''

    if phone and Profile.objects.get_profile_by_phone(phone):
        phone = ''

    profile_kwargs = {}
    if name:
        profile_kwargs['nickname'] = name
    if contact_email:
        profile_kwargs['contact_email'] = contact_email
    if phone:
        profile_kwargs['phone'] = phone

    if profile_kwargs:
        try:
            Profile.objects.add_or_update(email, **profile_kwargs)
        except Exception as e:
            logger.error(e)

    if avatar_url:
        try:
            image_name = 'dingtalk_avatar'
            image_file = requests.get(avatar_url).content
            avatar = Avatar.objects.filter(emailuser=email, primary=True).first()
            avatar = avatar or Avatar(emailuser=email, primary=True)
            avatar_file = ContentFile(image_file)
            avatar_file.name = image_name
            avatar.avatar = avatar_file
            avatar.save()
        except Exception as e:
            logger.error(e)

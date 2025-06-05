import os
import re
import time
import urllib.request, urllib.parse, urllib.error
import requests
import hashlib
import logging
import uuid

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET

from django.core.cache import cache
from django.urls import reverse

from seahub.utils import get_file_type_and_ext, get_site_scheme_and_netloc
from .settings import COLLABORA_DISCOVERY_URL, WOPI_ACCESS_TOKEN_EXPIRATION, OFFICE_WEB_APP_DISCOVERY_EXPIRATION, \
     OFFICE_WEB_APP_SERVER_CA, OFFICE_WEB_APP_CLIENT_CERT, OFFICE_WEB_APP_CLIENT_KEY, OFFICE_WEB_APP_CLIENT_PEM


logger = logging.getLogger(__name__)

def generate_access_token_cache_key(token):
    """ Generate cache key for WOPI access token
    """

    return 'wopi_access_token_' + str(token)

def get_file_info_by_token(token):
    """ Get file info from cache by access token

    return tuple: (request_user, repo_id, file_path, obj_id)
    """

    key = generate_access_token_cache_key(token)
    value = cache.get(key)
    if not value:
        logger.debug('No wopi cache value when first get %s' % key)
        value = cache.get(key)

    return value if value else None

def generate_discovery_cache_key(name, ext):
    """ Generate key for caching object containing the urlsrc of the collabora online hosting discovery

    name: Operations that you can perform on an Office document
    ext: The file formats that are supported for the action
    """

    return 'wopi_' + name + '_' + ext

def get_collabora_urlsrc(file_extension):
    """ Get urlsrc from <COLLABORA_DISCOVERY_URL>/hosting/discovery/
    """

    # try to get the xml file
    try:
        if OFFICE_WEB_APP_CLIENT_CERT and OFFICE_WEB_APP_CLIENT_KEY:
            xml = requests.get(COLLABORA_DISCOVERY_URL,
                               cert=(OFFICE_WEB_APP_CLIENT_CERT, OFFICE_WEB_APP_CLIENT_KEY),
                               verify=OFFICE_WEB_APP_SERVER_CA)
        elif OFFICE_WEB_APP_CLIENT_PEM:
            xml = requests.get(COLLABORA_DISCOVERY_URL,
                               cert=OFFICE_WEB_APP_CLIENT_PEM,
                               verify=OFFICE_WEB_APP_SERVER_CA)
        else:
            xml = requests.get(COLLABORA_DISCOVERY_URL, verify=OFFICE_WEB_APP_SERVER_CA)

        # loop all actions and find the matching entry for file_extension
        root = ET.fromstring(xml.content)
        for action in root.iter('action'):
            attr = action.attrib
            ext = attr.get('ext')
            name = attr.get('name')
            urlsrc = attr.get('urlsrc')

            if ext == file_extension and name and urlsrc:
                action_url = re.sub(r'<.*>', '', urlsrc)
                wopi_discovery_key = generate_discovery_cache_key(name, ext)
                cache.set(wopi_discovery_key, action_url, OFFICE_WEB_APP_DISCOVERY_EXPIRATION)
                return action_url
            else:
                continue

        return None

    except Exception as e:
        logger.error(e)
        return None


# used to generate the new browser tab with onlyoffice opening the document
# used in seahub/dtable/views.py
def get_wopi_dict(request_user, repo_id, file_path, action_name='view',
                  can_download=True, language_code='en', obj_id=''):
    """ 
    If a user opens a supported document in SeaTable, it passes the action_url to the template,
    and it generates the dict_data and saves it into cache that collabora can get the info
    by requesting <seatable_url>/files/[a-z0-9]{40}. This link is only valid for some hours
    """

    if action_name not in ('view', 'edit'):
        return None

    file_name = os.path.basename(file_path.rstrip('/'))
    file_type, file_ext = get_file_type_and_ext(file_path)

    wopi_discovery_key = generate_discovery_cache_key(action_name, file_ext)
    action_url = cache.get(wopi_discovery_key)
    if not action_url:
        # can not get action_url from cache
        action_url = get_collabora_urlsrc(file_ext)

    if not action_url:
        logger.error('No collabora urlsrc found.')
        return None

    logger.debug('wopi_discovery_key: %s' % wopi_discovery_key)

    # Generate WOPISrc (like https://cloud.seatable.io/files/[0-9]{40}
    repo_path_info = '_'.join([repo_id, file_path])
    fake_file_id = hashlib.sha1(repo_path_info.encode('utf8')).hexdigest()
    base_url = get_site_scheme_and_netloc()
    check_file_info_endpoint = reverse('CollaboraFilesInfoView', args=[fake_file_id])
    WOPISrc = urllib.parse.urljoin(base_url, check_file_info_endpoint)

    logger.debug('WOPISrc %s' % WOPISrc)
    query_dict = {'WOPISrc': WOPISrc}

    if action_url[-1] in ('?', '&'):
        full_action_url = action_url + urllib.parse.urlencode(query_dict)
    elif '?' in action_url:
        full_action_url = action_url + '&' + urllib.parse.urlencode(query_dict)
    else:
        full_action_url = action_url + '?' + urllib.parse.urlencode(query_dict)

    # key, collected from seahub/settings.py
    # value, collected from https://wopi.readthedocs.io/en/latest/faq/languages.html#languages
    lang_dict = {
        "ar": "ar-SA",
        "ca": "ca-ES",
        "cs": "cs-CZ",
        "de": "de-DE",
        "el": "el-GR",
        "en": "en-US",
        "es": "es-ES",
        "es-ar": "es-ES",
        "es-mx": "es-ES",
        "fi": "fi-FI",
        "fr": "fr-FR",
        "he": "he-IL",
        "hu": "hu-HU",
        "is": "is-IS",
        "it": "it-IT",
        "ja": "ja-JP",
        "ko": "ko-KR",
        "lv": "lv-LV",
        "nl": "nl-NL",
        "pl": "pl-PL",
        "pt": "pt",
        "ru": "ru-Ru",
        "sl": "sl-SI",
        "sv": "sv-SE",
        "th": "th-TH",
        "tr": "tr-TR",
        "uk": "uk-UA",
        "vi": "vi-VN",
        "zh-cn": "zh-CN",
        "zh-tw": "zh-TW",
    }
    WOPI_UI_LLCC = lang_dict[language_code]

    # `lang` parameter is used for Collabora Office
    full_action_url += f'&ui={WOPI_UI_LLCC}&rs={WOPI_UI_LLCC}&lang={WOPI_UI_LLCC}'

    logger.debug('full_action_url: %s' % full_action_url)   

    user_repo_path_info = {
        'request_user': request_user,
        'repo_id': repo_id,
        'file_path': file_path,
        'obj_id': obj_id,
        'can_edit': action_name == 'edit',
        'can_download': can_download,
        'file_name': file_name,
    }
    logger.debug('user_repo_path_info: %s' % user_repo_path_info)

    # collobora office only allowed alphanumeric and _
    uid = uuid.uuid4()
    access_token = uid.hex
    wopi_access_token_key = generate_access_token_cache_key(access_token)
    cache.set(wopi_access_token_key, user_repo_path_info, WOPI_ACCESS_TOKEN_EXPIRATION)

    # access_token_ttl property tells office web app
    # when access token expires
    utc_timestamp = time.time()
    access_token_ttl = int((utc_timestamp + WOPI_ACCESS_TOKEN_EXPIRATION) * 1000)

    wopi_dict = {}
    wopi_dict['repo_id'] = repo_id
    wopi_dict['path'] = file_path
    wopi_dict['can_edit'] = action_name == 'edit'
    wopi_dict['action_url'] = full_action_url
    wopi_dict['access_token'] = access_token
    wopi_dict['access_token_ttl'] = access_token_ttl
    wopi_dict['doc_title'] = file_name

    return wopi_dict

# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import datetime as dt
from datetime import datetime
import re
import time

from django import template
from django.core.cache import cache
from django.utils.safestring import mark_safe
from django.utils import translation, formats
from django.utils.dateformat import DateFormat
from django.utils.translation import gettext as _
from django.utils.translation import gettext, ngettext
from django.utils.html import escape

from seahub.profile.models import Profile
from seahub.profile.settings import NICKNAME_CACHE_TIMEOUT, NICKNAME_CACHE_PREFIX, \
    EMAIL_ID_CACHE_TIMEOUT, EMAIL_ID_CACHE_PREFIX, CONTACT_CACHE_TIMEOUT, \
    CONTACT_CACHE_PREFIX
from seahub.shortcuts import get_first_object_or_none
from seahub.utils import normalize_cache_key
from seahub.utils.html import avoid_wrapping
from seahub.utils.file_size import get_file_size_unit

register = template.Library()

@register.filter(name='tsstr_sec')
def tsstr_sec(value):
    """Turn a timestamp to string"""
    try:
        return datetime.fromtimestamp(value).strftime("%Y-%m-%d %H:%M:%S")
    except:
        return datetime.fromtimestamp(value/1000000).strftime("%Y-%m-%d %H:%M:%S")

@register.filter(name='tsstr_day')
def tsstr_day(value):
    """Turn a timestamp to string"""
    try:
        return datetime.fromtimestamp(value).strftime("%Y-%m-%d")
    except:
        return datetime.fromtimestamp(value/1000000).strftime("%Y-%m-%d")

# Supported file extensions and file icon name.
FILEEXT_ICON_MAP = {

    # text file
    'md': 'txt.png',
    'txt': 'txt.png',

    # pdf file
    'pdf': 'pdf.png',

    # document file
    'doc': 'word.png',
    'docx': 'word.png',
    'odt': 'word.png',
    'fodt': 'word.png',

    'ppt': 'ppt.png',
    'pptx': 'ppt.png',
    'odp': 'ppt.png',
    'fodp': 'ppt.png',

    'xls': 'excel.png',
    'xlsx': 'excel.png',
    'ods': 'excel.png',
    'fods': 'excel.png',

    # video
    'mp4': 'video.png',
    'ogv': 'video.png',
    'webm': 'video.png',
    'mov': 'video.png',
    'flv': 'video.png',
    'wmv': 'video.png',
    'rmvb': 'video.png',

    # music file
    'mp3': 'music.png',
    'oga': 'music.png',
    'ogg': 'music.png',
    'flac': 'music.png',
    'aac': 'music.png',
    'ac3': 'music.png',
    'wma': 'music.png',

    # image file
    'jpg': 'pic.png',
    'jpeg': 'pic.png',
    'png': 'pic.png',
    'svg': 'pic.png',
    'gif': 'pic.png',
    'bmp': 'pic.png',
    'ico': 'pic.png',

    # default
    'default': 'file.png',
}
@register.filter(name='file_icon_filter')
def file_icon_filter(value, size=None):
    """Get file icon according to the file postfix"""
    if value.rfind('.') > 0:
        file_ext = value.split('.')[-1].lower()
    else:
        file_ext = None

    if file_ext and file_ext in FILEEXT_ICON_MAP:
        if size == 192:
            return '192/' + FILEEXT_ICON_MAP.get(file_ext)
        else:
            return '24/' + FILEEXT_ICON_MAP.get(file_ext)
    else:
        if size == 192:
            return '192/' + FILEEXT_ICON_MAP.get('default')
        else:
            return '24/' + FILEEXT_ICON_MAP.get('default')

@register.filter(name='translate_seahub_time')
def translate_seahub_time(value, autoescape=None):
    if isinstance(value, int) or isinstance(value, int): # check whether value is int
        try:
            val = datetime.fromtimestamp(value) # convert timestamp to datetime
        except ValueError as e:
            return ""
    elif isinstance(value, datetime):
        val = value
    else:
        return value

    translated_time = translate_seahub_time_str(val)
    if autoescape:
        translated_time = escape(translated_time)

    timestring = val.isoformat()
    titletime = DateFormat(val).format('r')

    time_with_tag = '<time datetime="'+timestring+'" is="relative-time" title="'+titletime+'" >'+translated_time+'</time>'

    return mark_safe(time_with_tag)

def translate_seahub_time_str(val):
    """Convert python datetime to human friendly format."""

    now = datetime.now()
    # If current time is less than `val`, that means clock at user machine is
    # faster than server, in this case, we just set time description to `just now`
    if now < val:
        return _('Just now')

    limit = 14 * 24 * 60 * 60  # Timestamp with in two weeks will be translated

    delta = now - (val - dt.timedelta(0, 0, val.microsecond))
    seconds = delta.seconds
    days = delta.days
    if days * 24 * 60 * 60 + seconds > limit:
        return val.strftime("%Y-%m-%d")
    elif days > 0:
        ret = ngettext(
            '%(days)d day ago',
            '%(days)d days ago',
            days ) % { 'days': days }
        return ret
    elif seconds > 60 * 60:
        hours = seconds / 3600
        ret = ngettext(
            '%(hours)d hour ago',
            '%(hours)d hours ago',
            hours ) % { 'hours': hours }
        return ret
    elif seconds > 60:
        minutes = seconds/60
        ret = ngettext(
            '%(minutes)d minute ago',
            '%(minutes)d minutes ago',
            minutes ) % { 'minutes': minutes }
        return ret
    elif seconds > 0:
        ret = ngettext(
            '%(seconds)d second ago',
            '%(seconds)d seconds ago',
            seconds ) % { 'seconds': seconds }
        return ret
    else:
        return _('Just now')

@register.filter(name='email2nickname')
def email2nickname(value):
    """
    Return nickname if it exists and it's not an empty string,
    otherwise return short email.
    """
    if not value:
        return ''

    key = normalize_cache_key(value, NICKNAME_CACHE_PREFIX)
    cached_nickname = cache.get(key)
    if cached_nickname and cached_nickname.strip():
        return cached_nickname.strip()

    profile = get_first_object_or_none(Profile.objects.filter(user=value))
    if profile is not None and profile.nickname and profile.nickname.strip():
        nickname = profile.nickname.strip()
    else:
        nickname = value.split('@')[0]

    cache.set(key, nickname, NICKNAME_CACHE_TIMEOUT)
    return nickname

@register.filter(name='email2contact_email')
def email2contact_email(value):
    """
    Return contact_email if it exists and it's not an empty string,
    otherwise return username(login email).
    """
    if not value:
        return ''

    key = normalize_cache_key(value, CONTACT_CACHE_PREFIX)
    contact_email = cache.get(key)
    if contact_email and contact_email.strip():
        if contact_email == 'None':
            return None
        return contact_email

    contact_email = Profile.objects.get_contact_email_by_user(value)
    if contact_email is None:
        cache.set(key, 'None', CONTACT_CACHE_TIMEOUT)
    else:
        cache.set(key, contact_email, CONTACT_CACHE_TIMEOUT)
    return contact_email

@register.filter(name='email2id')
def email2id(value):
    """
    Return the user id of an email. User id can be 0(ldap user),
    positive(registered user) or negtive(unregistered user).

    """
    if not value:
        return -1

    key = normalize_cache_key(value, EMAIL_ID_CACHE_PREFIX)
    user_id = cache.get(key)
    if user_id is None:
        from seahub.base.accounts import User
        try:
            user = User.objects.get(email=value)
            user_id = user.id
        except User.DoesNotExist:
            user_id = -1
        cache.set(key, user_id, EMAIL_ID_CACHE_TIMEOUT)
    return user_id

@register.filter(name='id_or_email')
def id_or_email(value):
    """A wrapper to ``email2id``. Returns origin email if user id is 0(ldap user).
    """
    uid = email2id(value)
    return value if uid == 0 else uid

@register.filter(name='url_target_blank')
def url_target_blank(text):
    return text.replace('<a ', '<a target="_blank" ')
url_target_blank.is_safe=True

at_pattern = re.compile(r'(@\w+)', flags=re.U)

@register.filter(name='trim')
def trim(value, length):
    if len(value) > length:
        return value[:length-2] + '...'
    else:
        return value

@register.filter(name='strip_slash')
def strip_slash(value):
    return value.strip('/')

@register.filter(is_safe=True)
def seahub_filesizeformat(bytes):
    """
    Formats the value like a 'human-readable' file size (i.e. 13 KB, 4.1 MB,
    102 bytes, etc).
    """
    try:
        bytes = float(bytes)
    except (TypeError, ValueError, UnicodeDecodeError):
        value = ngettext("%(size)d byte", "%(size)d bytes", 0) % {'size': 0}
        return avoid_wrapping(value)

    filesize_number_format = lambda value: formats.number_format(round(value, 1), 1)

    KB = get_file_size_unit('KB')
    MB = get_file_size_unit('MB')
    GB = get_file_size_unit('GB')
    TB = get_file_size_unit('TB')
    PB = get_file_size_unit('PB')

    if bytes < KB:
        value = ngettext("%(size)d byte", "%(size)d bytes", bytes) % {'size': bytes}
    elif bytes < MB:
        value = gettext("%s KB") % filesize_number_format(bytes / KB)
    elif bytes < GB:
        value = gettext("%s MB") % filesize_number_format(bytes / MB)
    elif bytes < TB:
        value = gettext("%s GB") % filesize_number_format(bytes / GB)
    elif bytes < PB:
        value = gettext("%s TB") % filesize_number_format(bytes / TB)
    else:
        value = gettext("%s PB") % filesize_number_format(bytes / PB)

    return avoid_wrapping(value)

# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
from functools import partial
import os
import re
import urllib.request, urllib.parse, urllib.error
import urllib.request, urllib.error, urllib.parse
import uuid
import logging
import hashlib
import tempfile
import locale
import configparser
import unicodedata
from datetime import datetime
from urllib.parse import urlparse

from constance import config
from django.utils import translation

from django.urls import reverse
from django.core.mail import EmailMessage
from django.shortcuts import render
from django.template import Context, loader
from django.utils.translation import gettext as _
from django.http import HttpResponseRedirect
from urllib.parse import quote
from django.utils.html import escape
from rest_framework.authentication import SessionAuthentication

from seahub.auth import REDIRECT_FIELD_NAME
from seahub.api2.models import Token, TokenV2
import seahub.settings
from seahub.settings import MEDIA_URL, LOGO_PATH, \
        MEDIA_ROOT, CUSTOM_LOGO_PATH, ENABLE_WORKFLOW
try:
    from seahub.settings import DTABLE_EVENTS_CONFIG_FILE
except ImportError:
    DTABLE_EVENTS_CONFIG_FILE = None
try:
    from seahub.settings import EMAIL_HOST
    IS_EMAIL_CONFIGURED = True
except ImportError:
    IS_EMAIL_CONFIGURED = False
try:
    from seahub.settings import CLOUD_MODE
except ImportError:
    CLOUD_MODE = False
try:
    from seahub.settings import ENABLE_INNER_FILESERVER
except ImportError:
    ENABLE_INNER_FILESERVER = True
try:
    from seahub.settings import CHECK_SHARE_LINK_TRAFFIC
except ImportError:
    CHECK_SHARE_LINK_TRAFFIC = False

logger = logging.getLogger(__name__)


def is_pro_version():
    return getattr(seahub.settings, 'IS_PRO_VERSION', False) is True


def is_cluster_mode():
    cfg = configparser.ConfigParser()
    if 'SEAFILE_CENTRAL_CONF_DIR' in os.environ:
        confdir = os.environ['SEAFILE_CENTRAL_CONF_DIR']
    else:
        confdir = os.environ['SEAFILE_CONF_DIR']
    conf = os.path.join(confdir, 'seafile.conf')
    cfg.read(conf)
    if cfg.has_option('cluster', 'enabled'):
        enabled = cfg.getboolean('cluster', 'enabled')
    else:
        enabled = False

    if enabled:
        logging.debug('cluster mode is enabled')
    else:
        logging.debug('cluster mode is disabled')

    return enabled

CLUSTER_MODE = is_cluster_mode()


def render_permission_error(request, msg=None, extra_ctx=None):
    """
    Return permisson error page.

    """
    ctx = {}
    ctx['error_msg'] = msg or _('permission error')

    if extra_ctx:
        for k in extra_ctx:
            ctx[k] = extra_ctx[k]

    return render(request, 'error.html', ctx)

def render_error(request, msg=None, extra_ctx=None):
    """
    Return normal error page.

    """
    ctx = {}
    ctx['error_msg'] = msg or _('Internal Server Error')

    if extra_ctx:
        for k in extra_ctx:
            ctx[k] = extra_ctx[k]

    return render(request, 'error.html', ctx)

def render_error_form(request):
    """
    Return form passed the submission deadline page.

    """
    return render(request, 'error_form.html')

def redner_error_collection(request):
    '''
    Return collection_table passed the submission deadline page
    '''
    return render(request, 'error_collection_table.html')

def list_to_string(l):
    """
    Return string of a list.

    """
    return ','.join(l)

def get_fileserver_root():
    """ Construct seafile fileserver address and port.

    Returns:
    	Constructed fileserver root.
    """
    return config.FILE_SERVER_ROOT.rstrip('/') if config.FILE_SERVER_ROOT else ''

def get_inner_fileserver_root():
    """Construct inner seafile fileserver address and port.

    Inner fileserver root allows Seahub access fileserver through local
    address, thus avoiding the overhead of DNS queries, as well as other
    related issues, for example, the server can not ping itself, etc.

    Returns:
    	http://127.0.0.1:<port>
    """

    return seahub.settings.INNER_FILE_SERVER_ROOT

def gen_token(max_length=5):
    """
    Generate a random token.

    """

    return uuid.uuid4().hex[:max_length]

def normalize_cache_key(value, prefix=None, token=None, max_length=200):
    """Returns a cache key consisten of ``value`` and ``prefix`` and ``token``. Cache key
    must not include control characters or whitespace.
    """
    key = value if prefix is None else prefix + value
    key = key if token is None else key + '_' + token
    return quote(key)[:max_length]


# modified from django1.5:/core/validators, and remove the support for single
# quote in email address
email_re = re.compile(
    r"(^[-!#$%&*+/=?^_`{}|~0-9A-Z]+(\.[-!#$%&*+/=?^_`{}|~0-9A-Z]+)*"  # dot-atom
    # quoted-string, see also http://tools.ietf.org/html/rfc2822#section-3.2.5
    r'|^"([\001-\010\013\014\016-\037!#-\[\]-\177]|\\[\001-\011\013\014\016-\177])*"'
    r')@((?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)$)'  # domain
    r'|\[(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}\]$', re.IGNORECASE)  # literal form, ipv4 address (SMTP 4.1.3)

def is_valid_email(email):
    """A heavy email format validation.
    """
    return True if email_re.match(email) is not None else False

def is_valid_username(username):
    """Check whether username is valid, currently only email can be a username.
    """
    return is_valid_email(username)


def is_ldap_user(user):
    """Check whether user is a LDAP user.
    """
    return user.source == 'LDAP' or user.source == 'LDAPImport'

def get_no_duplicate_obj_name(obj_name, exist_obj_names):

    def no_duplicate(obj_name):
        for exist_obj_name in exist_obj_names:
            if exist_obj_name == obj_name:
                return False
        return True

    def make_new_name(obj_name, i):
        base, ext = os.path.splitext(obj_name)
        if ext:
            new_base = "%s (%d)" % (base, i)
            return new_base + ext
        else:
            return "%s (%d)" % (obj_name, i)

    if no_duplicate(obj_name):
        return obj_name
    else:
        i = 1
        while True:
            new_name = make_new_name(obj_name, i)
            if no_duplicate(new_name):
                return new_name
            else:
                i += 1

from seahub.utils.file_types import *

PREVIEW_FILEEXT = {
    IMAGE: ('gif', 'jpeg', 'jpg', 'png', 'ico', 'bmp', 'tif', 'tiff', 'psd', 'webp', 'svg'),
    DOCUMENT: ('doc', 'docx', 'ppt', 'pptx', 'odt', 'fodt', 'odp', 'fodp', 'odg', 'xlsx', 'ods'),
    SPREADSHEET: ('xls', 'xlsx', 'ods', 'fods'),
    DRAW: ('draw',),
    PDF: ('pdf', 'ai'),
    MARKDOWN: ('markdown', 'md'),
    VIDEO: ('mp4', 'ogv', 'webm', 'mov'),
    AUDIO: ('mp3', 'oga', 'ogg'),
    #'3D': ('stl', 'obj'),
    XMIND: ('xmind',),
    CDOC: ('cdoc',),
    SEADOC: ('sdoc',),
}

def gen_fileext_type_map():
    """
    Generate previewed file extension and file type relation map.

    """
    d = {}
    for filetype in list(PREVIEW_FILEEXT.keys()):
        for fileext in PREVIEW_FILEEXT.get(filetype):
            d[fileext] = filetype

    return d

FILEEXT_TYPE_MAP = gen_fileext_type_map()

def get_conf_text_ext():
    """
    Get the conf of text ext in constance settings, and remove space.
    """
    if hasattr(config, 'TEXT_PREVIEW_EXT'):
        text_ext = getattr(config, 'TEXT_PREVIEW_EXT').split(',')
        return [x.strip() for x in text_ext]
    return []

def new_merge_with_no_conflict(commit):
    """Check whether a commit is a new merge, and no conflict.

    Arguments:
    - `commit`:
    """
    if commit.second_parent_id is not None and commit.new_merge is True and \
            commit.conflict is False:
        return True
    else:
        return False


def gen_block_get_url(token, blkid):
    """
    Generate fileserver block url.
    Format: http://<domain:port>/blks/<token>/<blkid>
    """
    if blkid:
        return '%s/blks/%s/%s' % (get_fileserver_root(), token, blkid)
    else:
        return '%s/blks/%s/' % (get_fileserver_root(), token)

def gen_file_get_url(token, filename):
    """
    Generate fileserver file url.
    Format: http://<domain:port>/files/<token>/<filename>
    """
    return '%s/files/%s/%s' % (get_fileserver_root(), token, quote(filename))

def gen_file_upload_url(token, op, replace=False):
    url = '%s/%s/%s' % (get_fileserver_root(), op, token)
    if replace is True:
        url += '?replace=1'
    return url

def gen_dir_zip_download_url(token):
    """
    Generate fileserver file url.
    Format: http://<domain:port>/files/<token>/<filename>
    """
    return '%s/zip/%s' % (get_fileserver_root(), token)


def string2list(string):
    """
    Split string contacted with different separators to a list, and remove
    duplicated strings.
    """
    tmp_str = string.replace(';', ',').replace('\n', ',').replace('\r', ',')
    # Remove empty and duplicate strings
    s = set()
    for e in tmp_str.split(','):
        e = e.strip(' ')
        if not e:
            continue
        s.add(e)
    return [ x for x in s ]

def is_org_context(request):
    """An organization context is a virtual private Seafile instance on cloud
    service.

    Arguments:
    - `request`:
    """
    return request.cloud_mode and request.user.org is not None


def calc_file_path_hash(path, bits=12):
    if isinstance(path, str):
        path = path.encode('UTF-8')

    path_hash = hashlib.md5(urllib.parse.quote(path)).hexdigest()[:bits]

    return path_hash

def get_service_url():
    """Get service url from seaserv.
    """
    return seahub.settings.DTABLE_WEB_SERVICE_URL

def get_site_scheme_and_netloc():
    """Return a string contains site scheme and network location part from
    service url.

    For example:
    >>> get_site_scheme_and_netloc("https://example.com:8000/seafile/")
    https://example.com:8000

    """
    parse_result = urlparse(get_service_url())
    return "%s://%s" % (parse_result.scheme, parse_result.netloc)

def get_site_name():
    """Return site name from settings.
    """
    return config.SITE_NAME

def send_html_email(subject, con_template, con_context, from_email, to_email,
                    reply_to=None):
    """Send HTML email
    """

    # get logo path
    logo_path = LOGO_PATH
    custom_logo_file = os.path.join(MEDIA_ROOT, CUSTOM_LOGO_PATH)
    if os.path.exists(custom_logo_file):
        logo_path = CUSTOM_LOGO_PATH

    base_context = {
        'url_base': get_site_scheme_and_netloc(),
        'site_name': get_site_name(),
        'media_url': MEDIA_URL,
        'logo_path': logo_path,
    }
    t = loader.get_template(con_template)
    con_context.update(base_context)

    headers = {}
    if IS_EMAIL_CONFIGURED:
        if reply_to is not None:
            headers['Reply-to'] = reply_to

    msg = EmailMessage(subject, t.render(con_context), from_email,
                       to_email, headers=headers)
    msg.content_subtype = "html"
    msg.send()

def gen_dir_share_link(token):
    """Generate directory share link.
    """
    return gen_shared_link(token, 'd')

def gen_file_share_link(token):
    """Generate file share link.
    """
    return gen_shared_link(token, 'f')

def gen_shared_link(token, s_type):
    service_url = get_service_url()
    assert service_url is not None

    service_url = service_url.rstrip('/')
    if s_type == 'f':
        return '%s/f/%s/' % (service_url, token)
    else:
        return '%s/d/%s/' % (service_url, token)

def gen_shared_upload_link(token):
    service_url = get_service_url()
    assert service_url is not None

    service_url = service_url.rstrip('/')
    return '%s/u/d/%s/' % (service_url, token)


def show_delete_days(request):
    if request.method == 'GET':
        days_str = request.GET.get('days', '')
    elif request.method == 'POST':
        days_str = request.POST.get('days', '')
    else:
        days_str = ''

    try:
        days = int(days_str)
    except ValueError:
        days = 7

    return days

def redirect_to_login(request):
    from django.conf import settings
    login_url = settings.LOGIN_URL
    path = quote(request.get_full_path())
    tup = login_url, REDIRECT_FIELD_NAME, path
    return HttpResponseRedirect('%s?%s=%s' % tup)

def mkstemp():
    '''Returns (fd, filepath), the same as tempfile.mkstemp, except the
    filepath is encoded in UTF-8

    '''
    fd, path = tempfile.mkstemp()

    return fd, path

# File or directory operations
FILE_OP = ('Added or modified', 'Added', 'Modified', 'Renamed', 'Moved',
           'Added directory', 'Renamed directory', 'Moved directory')

OPS = '|'.join(FILE_OP)
CMMT_DESC_PATT = re.compile(r'(%s) "(.*)"\s?(and \d+ more (?:files|directories))?' % OPS)

API_OPS = '|'.join((OPS, 'Deleted', 'Removed'))
API_CMMT_DESC_PATT = r'(%s) "(.*)"\s?(and \d+ more (?:files|directories))?' % API_OPS


def convert_cmmt_desc_link(commit):
    """Wrap file/folder with ``<a></a>`` in commit description.
    """
    repo_id = commit.repo_id
    cmmt_id = commit.id
    conv_link_url = reverse('convert_cmmt_desc_link')

    def link_repl(matchobj):
        op = matchobj.group(1)
        file_or_dir = matchobj.group(2)
        remaining = matchobj.group(3)

        tmp_str = '%s "<a href="%s?repo_id=%s&cmmt_id=%s&nm=%s" class="normal">%s</a>"'
        if remaining:
            return (tmp_str + ' %s') % (op, conv_link_url, repo_id, cmmt_id, quote(file_or_dir),
                                        escape(file_or_dir), remaining)
        else:
            return tmp_str % (op, conv_link_url, repo_id, cmmt_id, quote(file_or_dir), escape(file_or_dir))

    return re.sub(CMMT_DESC_PATT, link_repl, commit.desc)

def api_tsstr_sec(value):
    """Turn a timestamp to string"""
    try:
        return datetime.fromtimestamp(value).strftime("%Y-%m-%d %H:%M:%S")
    except:
        return datetime.fromtimestamp(value/1000000).strftime("%Y-%m-%d %H:%M:%S")

MORE_PATT = r'and \d+ more (?:files|directories)'
def more_files_in_commit(commit):
    """Check whether added/deleted/modified more files in commit description.
    """
    return True if re.search(MORE_PATT, commit.desc) else False


def is_user_password_strong(password):
    """Return ``True`` if user's password is STRONG, otherwise ``False``.
       STRONG means password has at least USER_PASSWORD_STRENGTH_LEVEL(3) types of the bellow:
       num, upper letter, lower letter, other symbols
    """

    if len(password) < config.USER_PASSWORD_MIN_LENGTH:
        return False
    else:
        num = 0
        for letter in password:
            # get ascii dec
            # bitwise OR
            num |= get_char_mode(ord(letter))

        if calculate_bitwise(num) < config.USER_PASSWORD_STRENGTH_LEVEL:
            return False
        else:
            return True

def get_char_mode(n):
    """Return different num according to the type of given letter:
       '1': num,
       '2': upper_letter,
       '4': lower_letter,
       '8': other symbols
    """
    if (n >= 48 and n <= 57): #nums
        return 1;
    if (n >= 65 and n <= 90): #uppers
        return 2;
    if (n >= 97 and n <= 122): #lowers
        return 4;
    else:
        return 8;

def calculate_bitwise(num):
    """Return different level according to the given num:
    """
    level = 0
    for i in range(4):
        # bitwise AND
        if (num&1):
            level += 1
        # Right logical shift
        num = num >> 1
    return level

def do_md5(s):
    if isinstance(s, str):
        s = s.encode('UTF-8')
    return hashlib.md5(s).hexdigest()

def do_urlopen(url, data=None, headers=None):
    headers = headers or {}
    req = urllib.request.Request(url, data=data, headers=headers)
    ret = urllib.request.urlopen(req)
    return ret

def clear_token(username):
    '''
    clear web api and repo sync token
    when delete/inactive an user
    '''
    Token.objects.filter(user = username).delete()
    TokenV2.objects.filter(user = username).delete()


def inactive_user(username):
    # del tokens and personal dtable api tokens (not group)
    from seahub.utils import clear_token
    try:
        clear_token(username)
    except Exception as e:
        logger.error("Failed to delete tokens for user %s: %s." % (username, e))


def within_time_range(d1, d2, maxdiff_seconds):
    '''Return true if two datetime.datetime object differs less than the given seconds'''
    delta = d2 - d1 if d2 > d1 else d1 - d2
    # delta.total_seconds() is only available in python 2.7+
    diff = (delta.microseconds + (delta.seconds + delta.days*24*3600) * 1e6) / 1e6
    return diff < maxdiff_seconds

def get_system_admins():
    db_users = seaserv.get_emailusers('DB', -1, -1)
    ldpa_imported_users = seaserv.get_emailusers('LDAPImport', -1, -1)

    admins = []
    for user in db_users + ldpa_imported_users:
        if user.is_staff:
            admins.append(user)

    return admins


def get_file_type_and_ext(filename):
    """
    Return file type and extension if the file can be previewd online,
    otherwise, return unknown type.
    """
    fileExt = os.path.splitext(filename)[1][1:].lower()
    if fileExt in get_conf_text_ext():
        return (TEXT, fileExt)

    filetype = FILEEXT_TYPE_MAP.get(fileExt)
    if filetype:
        return (filetype, fileExt)
    else:
        return ('Unknown', fileExt)

def is_windows_operating_system(request):
    if 'HTTP_USER_AGENT' not in request.META:
        return False

    if 'windows' in request.META['HTTP_USER_AGENT'].lower():
        return True
    else:
        return False


def is_valid_org_id(org_id):
    if org_id and org_id > 0:
        return True
    else:
        return False


def rreplace(s, old, new, occurrence):
    li = s.rsplit(old, occurrence)
    return new.join(li)


def get_update_contact_email_cache_key(update_key):
    return normalize_cache_key(update_key, prefix='UPDATE_CONTACT_EMAIL_')


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    request.POST is accessed by CsrfViewMiddleware which is enabled by default.
    This means you will need to use csrf_exempt()
    on your view to allow you to change the upload handlers.

    DRF's SessionAuthentication uses Django's session framework
    for authentication which requires CSRF to be checked.

    This Class is override enforce_csrf to solve above problem
    """

    def enforce_csrf(self, request):
        return  # To not perform the csrf check previously happening


def uuid_str_to_32_chars(dtable_uuid):
    if len(dtable_uuid) == 36:
        return uuid.UUID(dtable_uuid).hex
    else:
        return dtable_uuid


def uuid_str_to_36_chars(dtable_uuid):
    if len(dtable_uuid) == 32:
        return str(uuid.UUID(dtable_uuid))
    else:
        return dtable_uuid


def utf8_normalize(raw_str):
    """
    https://docs.python.org/zh-cn/3/library/unicodedata.html#unicodedata.normalize
    same as seafile-server/lib/utils.c # g_utf8_normalize
    eg: Böblingen(b'B\xc3\xb6blingen') -> Böblingen(b'Bo\xcc\x88blingen')
    """
    try:
        return unicodedata.normalize('NFC', raw_str)
    except Exception as e:
        logger.error('%s, %s' % (raw_str, e))
        return raw_str

def get_market_url_by_lang():
    lang = translation.get_language()
    if lang == 'zh-cn':
        return "https://market.seatable.cn"
    return "https://market.seatable.io"

def get_workflow_help_link_by_lang():
    if not ENABLE_WORKFLOW:
        return ''
    lang = translation.get_language()
    if lang == 'zh-cn':
        return 'https://docs.seatable.cn/published/seatable-user-manual/workflow/workflow-introduction.md'
    return ''

uuid_re = re.compile(r'[0-9a-f]{8}(-?[0-9a-f]{4}){3}-?[0-9a-f]{12}', re.IGNORECASE)

def is_valid_uuid(uuid_str):
    return True if uuid_re.match(uuid_str) is not None else False

def setup_logger(logname):
    """
    setup logger for work weixin, weixin oauth
    """
    logdir = os.path.join(os.environ.get('LOG_DIR', ''))
    log_file = os.path.join(logdir, logname)
    handler = logging.handlers.TimedRotatingFileHandler(log_file, when='MIDNIGHT', interval=1, backupCount=7)
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
    handler.setFormatter(formatter)
    handler.addFilter(logging.Filter(logname))

    logger = logging.getLogger(logname)
    logger.addHandler(handler)

    return logger

SESSION_KEY_SLIDE_CAPTCHA_VERIFIED_TIME = 'slide-captcha-verified-time'

def check_slide_captcha_verified_time(request):
    import time
    verified_time = request.session.get(SESSION_KEY_SLIDE_CAPTCHA_VERIFIED_TIME)
    try:
        del request.session[SESSION_KEY_SLIDE_CAPTCHA_VERIFIED_TIME]
    except:
        pass
    if not verified_time or verified_time + 30 < int(time.time()):
        return False
    else:
        return True

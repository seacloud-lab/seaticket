# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
"""
File related views, including view_file, view_history_file, view_trash_file,
view_snapshot_file, view_shared_file, file_edit, etc.
"""

import sys
import os
import json
import stat
import urllib.request, urllib.error, urllib.parse
import chardet
import logging
import posixpath
import re
import mimetypes
import urllib.parse
import datetime

from django.core import signing
from django.core.cache import cache
from django.contrib.sites.shortcuts import get_current_site
from django.contrib import messages
from django.urls import reverse
from django.db.models import F
from django.http import HttpResponse, Http404, HttpResponseRedirect, HttpResponseBadRequest, HttpResponseForbidden
from django.shortcuts import render
from urllib.parse import quote
from django.utils.translation import get_language, gettext as _
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.template.defaultfilters import filesizeformat
from django.views.decorators.csrf import csrf_exempt

from seaserv import seafile_api, ccnet_api
from seaserv import get_repo, get_commits, \
    get_file_id_by_path, get_commit, get_file_size, \
    seafserv_threaded_rpc
from pysearpc import SearpcError

from seahub.settings import SITE_ROOT
from seahub.auth.decorators import login_required
from seahub.base.decorators import repo_passwd_set_required
from seahub.base.accounts import ANONYMOUS_EMAIL
from seahub.base.templatetags.seahub_tags import file_icon_filter
from seahub.utils import render_error, is_org_context, \
    get_file_type_and_ext, gen_file_get_url, gen_file_share_link, \
    render_permission_error, is_pro_version, is_textual_file, \
    mkstemp, EMPTY_SHA1, gen_inner_file_get_url, \
    get_conf_text_ext, PREVIEW_FILEEXT, \
    normalize_file_path, get_service_url, \
    normalize_cache_key
from seahub.utils.ip import get_remote_ip
from seahub.utils.timeutils import utc_to_local
from seahub.utils.file_types import (IMAGE, PDF,
        DOCUMENT, SPREADSHEET, AUDIO, MARKDOWN, TEXT, VIDEO, DRAW, XMIND, CDOC)
from seahub.utils.http import json_response, \
        BadRequestException, RequestForbbiddenException
from seahub.views import check_folder_permission
from seahub.utils.repo import is_repo_owner, parse_repo_perm
from seahub.group.utils import is_group_member
from seahub.thumbnail.utils import extract_xmind_image, get_thumbnail_src, \
        XMIND_IMAGE_SIZE, get_share_link_thumbnail_src, get_thumbnail_image_path


import seahub.settings as settings
from seahub.settings import FILE_ENCODING_LIST, FILE_PREVIEW_MAX_SIZE, \
    FILE_ENCODING_TRY_LIST, MEDIA_URL, DTABLE_SOCKET_URL, \
    SHARE_LINK_EXPIRE_DAYS_MIN, SHARE_LINK_EXPIRE_DAYS_MAX, \
    SHARE_LINK_EXPIRE_DAYS_DEFAULT, HAS_OFFICE_CONVERTER


if HAS_OFFICE_CONVERTER:
    from seahub.utils import (
        query_office_convert_status, get_office_converted_page_by_http
    )



# Get an instance of a logger
logger = logging.getLogger(__name__)

def gen_path_link(path, repo_name):
    """
    Generate navigate paths and links in repo page.

    """
    if path and path[-1] != '/':
        path += '/'

    paths = []
    links = []
    if path and path != '/':
        paths = path[1:-1].split('/')
        i = 1
        for name in paths:
            link = '/' + '/'.join(paths[:i])
            i = i + 1
            links.append(link)
    if repo_name:
        paths.insert(0, repo_name)
        links.insert(0, '/')

    zipped = list(zip(paths, links))

    return zipped

def get_file_content(file_type, raw_path, file_enc):
    """Get textual file content, including txt/markdown/seaf.
    """
    return repo_file_get(raw_path, file_enc) if is_textual_file(
        file_type=file_type) else ('', '', '')

def repo_file_get(raw_path, file_enc):
    """
    Get file content and encoding.
    """
    err = ''
    file_content = ''
    encoding = None
    if file_enc != 'auto':
        encoding = file_enc

    try:
        file_response = urllib.request.urlopen(raw_path)
        content = file_response.read()
    except urllib.error.HTTPError as e:
        logger.error(e)
        err = _('HTTPError: failed to open file online')
        return err, '', None
    except urllib.error.URLError as e:
        logger.error(e)
        err = _('URLError: failed to open file online')
        return err, '', None
    else:
        if encoding:
            try:
                u_content = content.decode(encoding)
            except UnicodeDecodeError:
                err = _('The encoding you chose is not proper.')
                return err, '', encoding
        else:
            for enc in FILE_ENCODING_TRY_LIST:
                try:
                    u_content = content.decode(enc)
                    encoding = enc
                    break
                except UnicodeDecodeError:
                    if enc != FILE_ENCODING_TRY_LIST[-1]:
                        continue
                    else:
                        encoding = chardet.detect(content)['encoding']
                        if encoding:
                            try:
                                u_content = content.decode(encoding)
                            except UnicodeDecodeError:
                                err = _('Unknown file encoding')
                                return err, '', ''
                        else:
                            err = _('Unknown file encoding')
                            return err, '', ''

        file_content = u_content

    return err, file_content, encoding


def get_file_view_path_and_perm(request, repo_id, obj_id, path,
                                use_onetime=settings.FILESERVER_TOKEN_ONCE_ONLY):
    """ Get path and the permission to view file.

    Returns:
    	outer fileserver file url, inner fileserver file url, permission
    """
    username = request.user.username
    filename = os.path.basename(path)

    user_perm = check_folder_permission(request, repo_id, '/')
    if user_perm is None:
        return ('', '', user_perm)
    else:
        # Get a token to visit file
        token = seafile_api.get_fileserver_access_token(repo_id,
                obj_id, 'view', username, use_onetime=use_onetime)

        if not token:
            return ('', '', None)

        outer_url = gen_file_get_url(token, filename)
        inner_url = gen_inner_file_get_url(token, filename)
        return (outer_url, inner_url, user_perm)


def can_preview_file(file_name, file_size, repo):
    """Check whether Seafile supports view file.
    Returns (True, None) if Yes, otherwise (False, error_msg).
    """

    filetype, fileext = get_file_type_and_ext(file_name)

    # Seafile defines 10 kinds of filetype:
    # TEXT, MARKDOWN, IMAGE, DOCUMENT, SPREADSHEET, VIDEO, AUDIO, PDF, DRAW
    if filetype in (TEXT, MARKDOWN, IMAGE) or fileext in get_conf_text_ext():
        if file_size > FILE_PREVIEW_MAX_SIZE:
            error_msg = _('File size surpasses %s, can not be opened online.') % \
                filesizeformat(FILE_PREVIEW_MAX_SIZE)
            return False, error_msg

    elif filetype in (DRAW):
        pass

    elif filetype in (DOCUMENT, SPREADSHEET):

        if repo.encrypted:
            error_msg = _('The library is encrypted, can not open file online.')
            return False, error_msg

        if not HAS_OFFICE_CONVERTER and \
                not ENABLE_OFFICE_WEB_APP and \
                not ENABLE_ONLYOFFICE:
            error_msg = "File preview unsupported"
            return False, error_msg

        # priority of view office file is:
        # OOS > OnlyOffice > Seafile integrated
        if ENABLE_OFFICE_WEB_APP:
            if fileext not in OFFICE_WEB_APP_FILE_EXTENSION:
                error_msg = "File preview unsupported"
                return False, error_msg

        elif ENABLE_ONLYOFFICE:
            if fileext not in ONLYOFFICE_FILE_EXTENSION:
                error_msg = "File preview unsupported"
                return False, error_msg

        else:
            if not HAS_OFFICE_CONVERTER:
                error_msg = "File preview unsupported"
                return False, error_msg

            # HAS_OFFICE_CONVERTER
            if file_size > OFFICE_PREVIEW_MAX_SIZE:
                error_msg = _('File size surpasses %s, can not be opened online.') % \
                        filesizeformat(OFFICE_PREVIEW_MAX_SIZE)
                return False, error_msg
    else:
        # NOT depends on Seafile settings
        if filetype not in list(PREVIEW_FILEEXT.keys()):
            error_msg = "File preview unsupported"
            return False, error_msg

    return True, ''


def _office_convert_get_file_id(request, repo_id=None, commit_id=None, path=None):
    repo_id = repo_id or request.GET.get('repo_id', '')
    commit_id = commit_id or request.GET.get('commit_id', '')
    path = path or request.GET.get('path', '')
    if not (repo_id and path and commit_id):
        raise BadRequestException()
    if '../' in path:
        raise BadRequestException()

    ret = {'dir_share_path': None}

    if ret['dir_share_path']:
        path = posixpath.join(ret['dir_share_path'], path.lstrip('/'))
    return seafserv_threaded_rpc.get_file_id_by_commit_and_path(repo_id, commit_id, path)


@json_response
def office_convert_query_status(request):
    if not request.headers.get('x-requested-with') == 'XMLHttpRequest':
        raise Http404

    doctype = request.GET.get('doctype', None)
    file_id = _office_convert_get_file_id(request)

    ret = {'success': False}
    try:
        ret = query_office_convert_status(file_id, doctype)
    except Exception as e:
        logging.exception('failed to call query_office_convert_status')
        ret['error'] = str(e)

    return ret

_OFFICE_PAGE_PATTERN = re.compile(r'^file\.css|file\.outline|index.html|index_html_.*.png|[a-z0-9]+\.pdf$')
def office_convert_get_page(request, repo_id, commit_id, path, filename):
    """Valid static file path inclueds:
    - index.html for spreadsheets and index_html_xxx.png for images embedded in spreadsheets
    - 77e168722458356507a1f373714aa9b575491f09.pdf
    """
    if not HAS_OFFICE_CONVERTER:
        raise Http404

    if not _OFFICE_PAGE_PATTERN.match(filename):
        return HttpResponseForbidden()

    path = '/' + path
    file_id = _office_convert_get_file_id(request, repo_id, commit_id, path)

    if filename.endswith('.pdf'):
        filename = "{0}.pdf".format(file_id)

    resp = get_office_converted_page_by_http(request, filename, file_id)

    if filename.endswith('.page'):
        content_type = 'text/html'
    else:
        content_type = mimetypes.guess_type(filename)[0] or 'text/html'
    resp['Content-Type'] = content_type
    return resp

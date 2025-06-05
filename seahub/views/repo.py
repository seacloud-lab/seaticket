# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
import os
import posixpath
import logging

from django.urls import reverse
from django.db.models import F
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import render
from django.utils.translation import gettext as _
from urllib.parse import quote

import seaserv
from seaserv import seafile_api

from seahub.auth.decorators import login_required
from seahub.options.models import UserOptions, CryptoOptionNotSetError
from seahub.views import gen_path_link, get_repo_dirents, \
    check_folder_permission

from seahub.utils import  gen_dir_share_link, \
    gen_shared_upload_link, render_error, \
    get_file_type_and_ext, get_service_url
from seahub.settings import ENABLE_RESUMABLE_FILEUPLOAD, ENABLE_THUMBNAIL, \
    THUMBNAIL_ROOT, THUMBNAIL_DEFAULT_SIZE, THUMBNAIL_SIZE_FOR_GRID, SHARE_LINK_EXPIRE_DAYS_MIN, \
    SHARE_LINK_EXPIRE_DAYS_MAX, DTABLE_SOCKET_URL
from seahub.utils.file_types import IMAGE, VIDEO
from seahub.thumbnail.utils import get_share_link_thumbnail_src
from seahub.constants import HASH_URLS

# Get an instance of a logger
logger = logging.getLogger(__name__)

def get_repo(repo_id):
    return seafile_api.get_repo(repo_id)

def get_commit(repo_id, repo_version, commit_id):
    return seaserv.get_commit(repo_id, repo_version, commit_id)

def get_repo_size(repo_id):
    return seafile_api.get_repo_size(repo_id)

def is_password_set(repo_id, username):
    return seafile_api.is_password_set(repo_id, username)

def get_path_from_request(request):
    path = request.GET.get('p', '/')
    if path[-1] != '/':
        path = path + '/'
    return path

def get_next_url_from_request(request):
    return request.GET.get('next', None)

def get_nav_path(path, repo_name):
    return gen_path_link(path, repo_name)

def is_no_quota(repo_id):
    return True if seaserv.check_quota(repo_id) < 0 else False

def get_fileshare(repo_id, username, path):
    if path == '/':    # no shared link for root dir
        return None

    l = FileShare.objects.filter(repo_id=repo_id).filter(
        username=username).filter(path=path)
    return l[0] if len(l) > 0 else None

def get_dir_share_link(fileshare):
    # dir shared link
    if fileshare:
        dir_shared_link = gen_dir_share_link(fileshare.token)
    else:
        dir_shared_link = ''
    return dir_shared_link

def get_uploadlink(repo_id, username, path):
    if path == '/':    # no shared upload link for root dir
        return None

    l = UploadLinkShare.objects.filter(repo_id=repo_id).filter(
        username=username).filter(path=path)
    return l[0] if len(l) > 0 else None

def get_dir_shared_upload_link(uploadlink):
    # dir shared upload link
    if uploadlink:
        dir_shared_upload_link = gen_shared_upload_link(uploadlink.token)
    else:
        dir_shared_upload_link = ''
    return dir_shared_upload_link

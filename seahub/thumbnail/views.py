# Copyright (c) 2012-2016 Seafile Ltd.
import os
import json
import logging
import posixpath
import datetime

from django.utils.translation import gettext as _
from urllib.parse import quote
from django.http import HttpResponse
from django.views.decorators.http import condition
from django.shortcuts import render

from seaserv import seafile_api

from seahub.auth.decorators import login_required_ajax, login_required, bind_token_user, bind_cookie_user
from seahub.dtable.models import Workspaces, DTables
from seahub.utils import render_permission_error, normalize_file_path
from seahub.views import check_folder_permission
from seahub.settings import THUMBNAIL_DEFAULT_SIZE, THUMBNAIL_EXTENSION, \
    THUMBNAIL_ROOT, ENABLE_THUMBNAIL
from seahub.thumbnail.utils import generate_thumbnail, \
    get_thumbnail_src, get_share_link_thumbnail_src
from seahub.dtable.utils import can_access_asset, set_dtable_asset_cache_read_permission

# Get an instance of a logger
logger = logging.getLogger(__name__)

@login_required_ajax
def thumbnail_create(request, repo_id):
    """create thumbnail from repo file list

    return thumbnail src
    """

    content_type = 'application/json; charset=utf-8'
    result = {}

    repo = seafile_api.get_repo(repo_id)
    if not repo:
        err_msg = _("Library does not exist.")
        return HttpResponse(json.dumps({"error": err_msg}), status=400,
                            content_type=content_type)

    path = request.GET.get('path', None)
    if not path:
        err_msg = _("Invalid arguments.")
        return HttpResponse(json.dumps({"error": err_msg}), status=400,
                            content_type=content_type)

    if repo.encrypted or not ENABLE_THUMBNAIL or \
        check_folder_permission(request, repo_id, path) is None:
        err_msg = _("Permission denied.")
        return HttpResponse(json.dumps({"error": err_msg}), status=403,
                            content_type=content_type)

    size = request.GET.get('size', THUMBNAIL_DEFAULT_SIZE)
    success, status_code = generate_thumbnail(request, repo_id, size, path)
    if success:
        src = get_thumbnail_src(repo_id, size, path)
        result['encoded_thumbnail_src'] = quote(src)
        return HttpResponse(json.dumps(result), content_type=content_type)
    else:
        err_msg = _('Failed to create thumbnail.')
        return HttpResponse(json.dumps({'err_msg': err_msg}),
                status=status_code, content_type=content_type)

def latest_entry(request, workspace_id, dtable_uuid, path):
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return None
    repo_id = workspace.repo_id
    path = normalize_file_path(os.path.join('/asset', dtable_uuid, path))
    file_id = seafile_api.get_file_id_by_path(repo_id, path)
    if file_id:
        try:
            size = request.GET.get('size')
            thumbnail_file = os.path.join(THUMBNAIL_ROOT, str(size), file_id)
            last_modified_time = os.path.getmtime(thumbnail_file)
            # convert float to datetime obj
            return datetime.datetime.fromtimestamp(last_modified_time)
        except os.error:
            # no thumbnail file exists
            return None
        except Exception as e:
            # catch all other errors
            logger.error(e, exc_info=True)
            return None
    else:
        return None


@condition(last_modified_func=latest_entry)
@bind_cookie_user
@bind_token_user
def thumbnail_get(request, workspace_id, dtable_uuid, path):
    """ handle thumbnail src from repo file list

    return thumbnail file to web
    """

    try:
        size = int(request.GET.get('size', 256))
    except Exception as e:
        logger.error(e)
        return HttpResponse()
    else:
        if size <= 0:
            return HttpResponse()

    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return HttpResponse()
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return HttpResponse()

    repo_id = workspace.repo_id
    file_path = normalize_file_path(os.path.join('/asset', dtable_uuid, path))
    file_id = seafile_api.get_file_id_by_path(repo_id, file_path)

    if not file_id:
        return HttpResponse()

    asset_permission = can_access_asset(request, workspace, dtable, path, file_id)
    can_access, need_cache = asset_permission[0], asset_permission[1]

    if not can_access:
        return render_permission_error(request, _('Permission denied.'))

    if need_cache:
        set_dtable_asset_cache_read_permission(request, dtable_uuid, file_id)

    success = True
    thumbnail_file = os.path.join(THUMBNAIL_ROOT, str(size), file_id)
    if not os.path.exists(thumbnail_file):
        success, status_code = generate_thumbnail(request, repo_id, size, file_path)

    if success:
        try:
            with open(thumbnail_file, 'rb') as f:
                thumbnail = f.read()
            return HttpResponse(content=thumbnail,
                                content_type='image/' + THUMBNAIL_EXTENSION)
        except IOError as e:
            logger.error(e)
            return HttpResponse(status=500)
    else:
        return HttpResponse(status=status_code)

def get_real_path_by_fs_and_req_path(fileshare, req_path):
    """ Return the real path of a file.

    The file could be a file in a shared dir or a shared file.
    """

    if fileshare.s_type == 'd':
        if fileshare.path == '/':
            real_path = req_path
        else:
            real_path = posixpath.join(fileshare.path, req_path.lstrip('/'))
    else:
        real_path = fileshare.path

    return real_path

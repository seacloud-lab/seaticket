# Copyright (c) 2012-2016 Seafile Ltd.
import os
import stat
import logging
import posixpath

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from urllib.parse import quote

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error, to_python_boolean
from seahub.api2.views import get_dir_file_recursively

from seahub.thumbnail.utils import get_thumbnail_src
from seahub.views import check_folder_permission
from seahub.utils import check_filename_with_rename, is_valid_dirent_name, \
        normalize_dir_path, is_pro_version, FILEEXT_TYPE_MAP
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.utils.file_tags import get_files_tags_in_dir
from seahub.utils.file_types import IMAGE, VIDEO, XMIND
from seahub.base.models import UserStarredFiles
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email

from seahub.settings import ENABLE_VIDEO_THUMBNAIL, \
        THUMBNAIL_ROOT

from seaserv import seafile_api
from pysearpc import SearpcError

logger = logging.getLogger(__name__)


def get_dir_file_info_list(username, request_type, repo_obj, parent_dir,
        with_thumbnail, thumbnail_size):

    repo_id = repo_obj.id
    dir_info_list = []
    file_info_list = []

    # get dirent(folder and file) list
    parent_dir_id = seafile_api.get_dir_id_by_path(repo_id, parent_dir)
    dir_file_list = seafile_api.list_dir_with_perm(repo_id,
            parent_dir, parent_dir_id, username, -1, -1)

    starred_item_path_list = []

    # only get dir info list
    if not request_type or request_type == 'd':
        dir_list = [dirent for dirent in dir_file_list if stat.S_ISDIR(dirent.mode)]
        for dirent in dir_list:
            dir_info = {}
            dir_info["type"] = "dir"
            dir_info["id"] = dirent.obj_id
            dir_info["name"] = dirent.obj_name
            dir_info["mtime"] = dirent.mtime
            dir_info["permission"] = dirent.permission
            dir_info["parent_dir"] = parent_dir
            dir_info_list.append(dir_info)

            # get star info
            dir_info['starred'] = False
            dir_path = posixpath.join(parent_dir, dirent.obj_name)
            if dir_path.rstrip('/') in starred_item_path_list:
                dir_info['starred'] = True

    # only get file info list
    if not request_type or request_type == 'f':

        file_list = [dirent for dirent in dir_file_list if not stat.S_ISDIR(dirent.mode)]

        # Use dict to reduce memcache fetch cost in large for-loop.
        nickname_dict = {}
        contact_email_dict = {}
        modifier_set = {x.modifier for x in file_list}
        lock_owner_set = {x.lock_owner for x in file_list}
        for e in modifier_set | lock_owner_set:
            if e not in nickname_dict:
                nickname_dict[e] = email2nickname(e)
            if e not in contact_email_dict:
                contact_email_dict[e] = email2contact_email(e)

        try:
            files_tags_in_dir = get_files_tags_in_dir(repo_id, parent_dir)
        except Exception as e:
            logger.error(e)
            files_tags_in_dir = {}

        for dirent in file_list:

            file_name = dirent.obj_name
            file_path = posixpath.join(parent_dir, file_name)
            file_obj_id = dirent.obj_id

            file_info = {}
            file_info["type"] = "file"
            file_info["id"] = file_obj_id
            file_info["name"] = file_name
            file_info["mtime"] = dirent.mtime
            file_info["permission"] = dirent.permission
            file_info["parent_dir"] = parent_dir
            file_info["size"] = dirent.size

            modifier_email = dirent.modifier
            file_info['modifier_email'] = modifier_email
            file_info['modifier_name'] = nickname_dict.get(modifier_email, '')
            file_info['modifier_contact_email'] = contact_email_dict.get(modifier_email, '')

            # get lock info
            if is_pro_version():
                file_info["is_locked"] = dirent.is_locked
                file_info["lock_time"] = dirent.lock_time

                lock_owner_email = dirent.lock_owner or ''
                file_info["lock_owner"] = lock_owner_email
                file_info['lock_owner_name'] = nickname_dict.get(lock_owner_email, '')
                file_info['lock_owner_contact_email'] = contact_email_dict.get(lock_owner_email, '')

                if username == lock_owner_email:
                    file_info["locked_by_me"] = True
                else:
                    file_info["locked_by_me"] = False

            # get star info
            file_info['starred'] = False
            if file_path.rstrip('/') in starred_item_path_list:
                file_info['starred'] = True

            # get tag info
            file_tags = files_tags_in_dir.get(file_name, [])
            if file_tags:
                file_info['file_tags'] = []
                for file_tag in file_tags:
                    file_info['file_tags'].append(file_tag)

            # get thumbnail info
            if with_thumbnail and not repo_obj.encrypted:

                # used for providing a way to determine
                # if send a request to create thumbnail.

                fileExt = os.path.splitext(file_name)[1][1:].lower()
                file_type = FILEEXT_TYPE_MAP.get(fileExt)

                if file_type in (IMAGE, XMIND) or \
                        file_type == VIDEO and ENABLE_VIDEO_THUMBNAIL:

                    # if thumbnail has already been created, return its src.
                    # Then web browser will use this src to get thumbnail instead of
                    # recreating it.
                    thumbnail_file_path = os.path.join(THUMBNAIL_ROOT,
                            str(thumbnail_size), file_obj_id)
                    if os.path.exists(thumbnail_file_path):
                        src = get_thumbnail_src(repo_id, thumbnail_size, file_path)
                        file_info['encoded_thumbnail_src'] = quote(src)

            file_info_list.append(file_info)

    dir_info_list.sort(key=lambda x: x['name'].lower())
    file_info_list.sort(key=lambda x: x['name'].lower())

    return dir_info_list, file_info_list

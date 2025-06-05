# Copyright (c) 2012-2016 Seafile Ltd.
import os
import logging
import posixpath
import requests

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from django.utils.translation import gettext as _

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error

from seahub.utils import check_filename_with_rename, is_pro_version, \
    gen_inner_file_upload_url, is_valid_dirent_name, normalize_file_path, \
    normalize_dir_path, get_file_type_and_ext
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.views import check_folder_permission
from seahub.constants import PERMISSION_READ_WRITE
from seahub.utils.repo import parse_repo_perm
from seahub.utils.file_types import MARKDOWN, TEXT

from seahub.settings import MAX_UPLOAD_FILE_NAME_LEN

from seahub.drafts.models import Draft
from seahub.drafts.utils import is_draft_file, get_file_draft

from seaserv import seafile_api
from pysearpc import SearpcError

logger = logging.getLogger(__name__)

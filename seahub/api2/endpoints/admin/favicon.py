# Copyright (c) 2012-2016 Seafile Ltd.
import os
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.settings import SEAHUB_DATA_ROOT, MEDIA_ROOT, \
        CUSTOM_FAVICON_PATH, MEDIA_URL, CUSTOM_FAVICON_NOTIFICATION_PATH
from seahub.utils import get_file_type_and_ext, PREVIEW_FILEEXT, \
    get_site_scheme_and_netloc
from seahub.utils.file_types import IMAGE
from seahub.utils.error_msg import file_type_error_msg, file_size_error_msg

logger = logging.getLogger(__name__)

class AdminFavicon(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle, )
    permission_classes = (IsAdminUser,)

    def post(self, request):
        # permission check
        if not request.user.admin_permissions.can_config_system():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        favicon_file = request.FILES.get('favicon', None)
        if not favicon_file:
            error_msg = 'Favicon can not be found.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        with_notify = request.data.get('with_notify', 'false')
        try:
            with_notify = to_python_boolean(with_notify)
        except:
            error_msg = 'with_notify invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        file_type, ext = get_file_type_and_ext(favicon_file.name)
        if file_type != IMAGE:
            error_msg = file_type_error_msg(ext, PREVIEW_FILEEXT.get(IMAGE))
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if favicon_file.size > 1024 * 1024 * 20: # 20mb
            error_msg = file_size_error_msg(favicon_file.size, 20*1024*1024)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not os.path.exists(SEAHUB_DATA_ROOT):
            os.makedirs(SEAHUB_DATA_ROOT)

        custom_favicon_path = CUSTOM_FAVICON_PATH if not with_notify else CUSTOM_FAVICON_NOTIFICATION_PATH

        custom_dir = os.path.join(SEAHUB_DATA_ROOT,
                os.path.dirname(custom_favicon_path))

        if not os.path.exists(custom_dir):
            os.makedirs(custom_dir)

        try:
            custom_favicon_file = os.path.join(SEAHUB_DATA_ROOT,
                    custom_favicon_path)

            # save favicon file to custom dir
            with open(custom_favicon_file, 'wb') as fd:
                fd.write(favicon_file.read())

            custom_symlink = os.path.join(MEDIA_ROOT,
                    os.path.dirname(custom_favicon_path))

            # create symlink for custom dir
            if not os.path.exists(custom_symlink):
                os.symlink(custom_dir, custom_symlink)

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'favicon_path': get_site_scheme_and_netloc() + MEDIA_URL + custom_favicon_path})

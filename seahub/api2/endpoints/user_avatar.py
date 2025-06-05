# Copyright (c) 2012-2016 Seafile Ltd.
import os
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from django.utils.translation import gettext as _
from django.template.defaultfilters import filesizeformat

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error

from seahub.avatar.models import Avatar
from seahub.avatar.settings import (AVATAR_MAX_SIZE, AVATAR_ALLOWED_FILE_EXTS)
from seahub.avatar.templatetags.avatar_tags import api_avatar_url

logger = logging.getLogger(__name__)

class UserAvatarView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):

        image_file = request.FILES.get('avatar', None)

        if not image_file:
            error_msg = 'avatar invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        (root, ext) = os.path.splitext(image_file.name.lower())
        if AVATAR_ALLOWED_FILE_EXTS and ext not in AVATAR_ALLOWED_FILE_EXTS:
            error_msg = _("%(ext)s is an invalid file extension. Authorized extensions are : %(valid_exts_list)s") % {'ext' : ext, 'valid_exts_list' : ", ".join(AVATAR_ALLOWED_FILE_EXTS)}
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if image_file.size > AVATAR_MAX_SIZE:
            error_msg = _("Your file is too big (%(size)s), the maximum allowed size is %(max_valid_size)s") % { 'size' : filesizeformat(image_file.size), 'max_valid_size' : filesizeformat(AVATAR_MAX_SIZE)}
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username

        try:
            avatar = Avatar.objects.filter(emailuser=username, primary=True).first()
            avatar = avatar or Avatar(emailuser=username, primary=True)
            avatar.avatar = image_file
            avatar.save()
            avatar_url, is_default, date_uploaded = api_avatar_url(username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'avatar_url': avatar_url})

# -*- coding: utf-8 -*-
import logging
import jwt

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.utils import api_error, get_user_common_info
from seahub.api2.throttling import UserRateThrottle
from seahub.settings import DTABLE_PRIVATE_KEY
from pypinyin import lazy_pinyin
from seahub.base.accounts import User

logger = logging.getLogger(__name__)


class UsersCommonInfoView(APIView):
    throttle_classes = (UserRateThrottle, )

    def post(self, request):
        """return user_list by user_id_list
        """
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        token = auth[1]
        if not token:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        try:
            jwt.decode(token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check
        user_id_list = request.data.get('user_id_list')
        if not isinstance(user_id_list, list):
            error_msg = 'user_id_list invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        user_list = list()
        for user_id in user_id_list:
            if not isinstance(user_id, str):
                continue
            try:
                user = User.objects.get(email=user_id)
            except User.DoesNotExist:
                continue
            user_info = get_user_common_info(user_id, include_contact_email=False)
            user_name = user_info.get('name', '')
            user_info['name_pinyin'] = "'".join(lazy_pinyin(user_name)) if user_name else ''
            user_list.append(user_info)

        return Response({'user_list': user_list})

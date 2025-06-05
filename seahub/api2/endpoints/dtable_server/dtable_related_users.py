import logging

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, get_user_common_info
from seahub.dtable.models import DTables, Workspaces, IdInOrgTuple
from seahub.dtable.utils import is_valid_jwt, list_dtable_related_users, \
    list_dtable_related_users_info, set_related_users_info_cache, \
    list_dtable_app_users, list_dtable_app_users_info, set_app_users_info_cache
from seahub.utils import uuid_str_to_32_chars
from seahub.dtable.settings import DTABLE_RELATED_USERS_PER_PAGE
from pypinyin import lazy_pinyin

logger = logging.getLogger(__name__)


class DTableRelatedUsersView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def _list_user_info(self, email_list):
        user_list = []
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)

        for email in email_list:
            user_info = get_user_common_info(email, include_contact_email=False)
            user_info['id_in_org'] = email2id_in_org.get(email, '')
            user_name = user_info.get('name', '')
            user_info['name_pinyin'] = "'".join(lazy_pinyin(user_name)) if user_name else ''
            user_list.append(user_info)
        return user_list

    def get(self, request, dtable_uuid):
        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not is_valid_jwt(auth, dtable_uuid):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            current_page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', DTABLE_RELATED_USERS_PER_PAGE))
        except ValueError:
            current_page = 1
            per_page = DTABLE_RELATED_USERS_PER_PAGE

        # use cache
        if current_page == 1 and per_page == DTABLE_RELATED_USERS_PER_PAGE:
            user_list_cache = list_dtable_related_users_info(dtable_uuid)
            app_user_list_cache = list_dtable_app_users_info(dtable_uuid)
            if user_list_cache is not None and app_user_list_cache is not None:
                return Response({
                    'user_list': user_list_cache,
                    'app_user_list': app_user_list_cache,
                    })

        # user_list
        if user_list_cache is None:
            start = (current_page - 1) * per_page
            end = start + per_page
            try:
                email_list = list_dtable_related_users(workspace, dtable)[start:end]
                user_list = self._list_user_info(email_list)
            except Exception as e:
                logger.exception(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            if current_page == 1 and per_page == DTABLE_RELATED_USERS_PER_PAGE:
                set_related_users_info_cache(dtable_uuid, user_list)
        else:
            user_list = user_list_cache

        # app_user_list [:DTABLE_APP_USERS_PER_PAGE]
        if app_user_list_cache is None:
            try:
                email_list = list_dtable_app_users(dtable.uuid.hex)
                app_user_list = self._list_user_info(email_list)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            if current_page == 1:
                set_app_users_info_cache(dtable_uuid, app_user_list)
        else:
            app_user_list = app_user_list_cache

        return Response({
            'user_list': user_list,
            'app_user_list': app_user_list,
            })

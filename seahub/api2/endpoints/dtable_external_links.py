import logging
import re
import time

import jwt
from django.db import IntegrityError
from dateutil.relativedelta import relativedelta
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.constants import PERMISSION_READ_WRITE
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces, DTables, DTableExternalLinks
from seahub.dtable.utils import gen_dtable_external_link, check_dtable_admin_permission
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import SHARE_LINK_EXPIRE_DAYS_MAX, \
        SHARE_LINK_EXPIRE_DAYS_MIN, SHARE_LINK_EXPIRE_DAYS_DEFAULT, \
        DTABLE_SERVER_URL, DTABLE_SOCKET_URL, DTABLE_DB_URL
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster
from seahub.dtable.settings import DTABLE_EXTERNAL_LINK_QUOTA


logger = logging.getLogger(__name__)


def _permission_check(user, owner):
    if not user.permissions.can_generate_external_link():
        return None
    return check_dtable_admin_permission(user.username, owner)

def _get_external_link_info(dtable_external_link):
        return {
            'url': gen_dtable_external_link(dtable_external_link.token, dtable_external_link.is_custom),
            'token': dtable_external_link.token,
            'is_custom': dtable_external_link.is_custom,
            'permission': 'read-write' if dtable_external_link.permission == PERMISSION_READ_WRITE else 'read-only',
            'is_expired': dtable_external_link.is_expired(),
            'expire_date': datetime_to_isoformat_timestr(dtable_external_link.expire_date)
        }

class DTableExternalLinksView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        username = request.user.username
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not _permission_check(request.user, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dtable_external_links = DTableExternalLinks.objects.get_dtable_external_link(dtable)
        except Exception as e:
            logger.error('user: %s get dtable: %s external link error: %s', username, name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        links = [_get_external_link_info(item) for item in dtable_external_links]

        return Response({'links': links})

    def _check_custom_token(self, token):
        if len(token) > 100:
            return False
        return True if re.search(r'^[-0-9a-zA-Z]+$', token) else False

    def post(self, request, workspace_id, name):
        # arguments check
        token = request.data.get('token')
        if token:
            token = token.strip()
            if not self._check_custom_token(token):
                error_msg = 'URL is invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if DTableExternalLinks.objects.check_token_existed(token):
                error_msg = _('This URL already exists, please try another URL')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        password = request.data.get('password')
        expire_days = request.data.get('expire_days')
        if expire_days:
            try:
                expire_days = int(expire_days)
            except:
                error_msg = 'expire_days is invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if expire_days <= 0:
                if SHARE_LINK_EXPIRE_DAYS_DEFAULT > 0:
                    expire_days = SHARE_LINK_EXPIRE_DAYS_DEFAULT

            if SHARE_LINK_EXPIRE_DAYS_MIN > 0:
                if expire_days < SHARE_LINK_EXPIRE_DAYS_MIN:
                    error_msg = _('Expire days should be greater or equal to %s') % \
                            SHARE_LINK_EXPIRE_DAYS_MIN
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if SHARE_LINK_EXPIRE_DAYS_MAX > 0:
                if expire_days > SHARE_LINK_EXPIRE_DAYS_MAX:
                    error_msg = _('Expire days should be less than or equal to %s') % \
                            SHARE_LINK_EXPIRE_DAYS_MAX
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if expire_days <= 0:
                expire_date = None
            else:
                try:
                    expire_date = timezone.now() + relativedelta(days=expire_days)
                except:
                    error_msg = 'expire_days is invalid.'
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        else:
            expire_date = None

        username = request.user.username
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not _permission_check(request.user, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # quota
        dtable_external_link_count = DTableExternalLinks.objects.get_count_by_dtable(dtable)
        if dtable_external_link_count >= DTABLE_EXTERNAL_LINK_QUOTA:
            error_msg = 'Number of external links exceed the %s limit.' % DTABLE_EXTERNAL_LINK_QUOTA
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            dtable_external_link = DTableExternalLinks.objects.create_dtable_external_link(dtable, username, token=token, password=password, expire_date=expire_date)
        except IntegrityError:
            error_msg = _('This URL already exists, please try another URL')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        except Exception as e:
            logger.error('user: %s create dtable: %s, external link token error: %s', username, name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response(_get_external_link_info(dtable_external_link))


class DTableExternalLinkView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)
    
    def delete(self, request, workspace_id, name, token):
        username = request.user.username
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable_external_link = DTableExternalLinks.objects.filter(token=token, dtable=dtable).first()
        if not dtable_external_link:
            error_msg = 'token %s not found.' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not _permission_check(request.user, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # delete
        try:
            dtable_external_link.delete()
        except Exception as e:
            logger.error('user: %s delete table: %s error: %s', username, name, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableExternalLinkAccessTokenView(APIView):

    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        # resource check
        dtable_external_link = DTableExternalLinks.objects.filter(token=token, dtable__deleted=False).select_related('dtable').first()
        if not dtable_external_link:
            error_msg = 'Token %s not found' % token
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = dtable_external_link.dtable

        if enable_dtable_server_cluster:
            dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
            dtable_socket_url = dtable_server_url
        else:
            dtable_server_url = DTABLE_SERVER_URL
            dtable_socket_url = DTABLE_SOCKET_URL
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), dtable_server_url, permission='base-external-link')
        return Response({
            'access_token': dtable_server_api.view_access_token,
            'dtable_uuid': str(dtable.uuid),
            'dtable_server': dtable_server_url,
            'dtable_socket': dtable_socket_url,
            'dtable_db': DTABLE_DB_URL,
        })

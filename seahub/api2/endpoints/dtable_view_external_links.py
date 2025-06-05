import logging
import re
import jwt
import time

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
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces, DTables, DTableViewExternalLinks
from seahub.dtable.settings import DTABLE_EXTERNAL_VIEW_LINK_QUOTA
from seahub.dtable.utils import check_dtable_admin_permission
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import SHARE_LINK_EXPIRE_DAYS_MAX, \
    SHARE_LINK_EXPIRE_DAYS_MIN, SHARE_LINK_EXPIRE_DAYS_DEFAULT, DTABLE_PRIVATE_KEY, \
    DTABLE_SERVER_URL, DTABLE_SOCKET_URL
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster

logger = logging.getLogger(__name__)


def _permission_check(user, owner):
    if not user.permissions.can_use_advanced_permissions():
        return None
    return check_dtable_admin_permission(user.username, owner)


class DTableViewExternalLinksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):

        table_id = request.GET.get('table_id', '')
        view_id = request.GET.get('view_id', '')

        # table_id is necessary if view_id is given
        if view_id and not table_id:
            error_msg = 'table_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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

        dtable_view_external_links = []
        # if not table_id and not view_id  -> return all links of this dtable
        # if table_id and view_id          -> return all links of this view
        # if table_id and not view_id      -> return all links of this table
        try:
            if not table_id and not view_id:
                dtable_view_external_links = DTableViewExternalLinks.objects.filter(dtable=dtable)
            elif table_id and view_id:
                dtable_view_external_links = DTableViewExternalLinks.objects.filter(dtable=dtable, table_id=table_id, view_id=view_id)
            elif table_id:
                dtable_view_external_links = DTableViewExternalLinks.objects.filter(dtable=dtable, table_id=table_id)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'dtable_view_external_link_list': [link.to_dict() for link in dtable_view_external_links]})


    def _is_valid_custom_token(self, token):
        if len(token) > 100:
            return False
        return True if re.search(r'^[-0-9a-zA-Z]+$', token) else False

    def post(self, request, workspace_id, name):
        # arguments check

        table_id = request.data.get('table_id')
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid.')

        view_id = request.data.get('view_id')
        if not view_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'view_id invalid.')

        token = request.data.get('token')
        if token:
            token = token.strip()
            if not self._is_valid_custom_token(token):
                error_msg = 'token invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if DTableViewExternalLinks.objects.filter(token=token).exists():
                error_msg = 'token exists.'
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
        dtable_external_view_link_count = DTableViewExternalLinks.objects.filter(dtable=dtable).count()
        if dtable_external_view_link_count >= DTABLE_EXTERNAL_VIEW_LINK_QUOTA:
            error_msg = _('Number of external view links exceeds the %s limit.') % DTABLE_EXTERNAL_VIEW_LINK_QUOTA
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            dtable_view_external_link = DTableViewExternalLinks.objects.create(
                dtable=dtable,
                creator=request.user.username,
                table_id=table_id,
                view_id=view_id,
                token=token,
                password=password,
                expire_date=expire_date,
            )
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(dtable_view_external_link.to_dict())


class DTableViewExternalLinkView(APIView):
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

        # permission check
        if not _permission_check(request.user, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dtable_view_external_link = DTableViewExternalLinks.objects.get(token=token, dtable=dtable)
        except DTableViewExternalLinks.DoesNotExist:
            error_msg = 'View external link does not exits.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            dtable_view_external_link.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class DTableViewExternalLinkAccessTokenView(APIView):

    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        # resource check
        dtable_external_link = DTableViewExternalLinks.objects.filter(token=token, dtable__deleted=False).select_related('dtable').first()
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
        kwargs = {
            'table_id': dtable_external_link.table_id,
            'view_id': dtable_external_link.view_id
        }
        dtable_server_api = DTableServerAPI(None, str(dtable.uuid), dtable_server_url, permission='view-external-link', kwargs=kwargs)
        return Response({
            'access_token': dtable_server_api.view_access_token,
            'dtable_uuid': str(dtable.uuid),
            'dtable_server': dtable_server_url,
            'dtable_socket': dtable_socket_url,
        })


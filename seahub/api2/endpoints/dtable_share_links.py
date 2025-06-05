import logging
import time
import jwt

from dateutil.relativedelta import relativedelta
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_PREFIX
from seahub.dtable.models import DTables, DTableShareLinks, Workspaces
from seahub.settings import DTABLE_PRIVATE_KEY, SHARE_LINK_EXPIRE_DAYS_MAX, \
        SHARE_LINK_EXPIRE_DAYS_MIN, SHARE_LINK_EXPIRE_DAYS_DEFAULT, SHARE_LINK_PASSWORD_MIN_LENGTH,\
        DTABLE_SERVER_URL, DTABLE_SOCKET_URL
from seahub.dtable.utils import gen_share_dtable_link, check_dtable_admin_permission, \
    check_quota_and_row_limit_by_workspace, get_share_permission
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster

from seaserv import seafile_api

logger = logging.getLogger(__name__)
permission_tuple = (PERMISSION_READ, PERMISSION_READ_WRITE)


def get_share_dtable_link_info(sdl, dtable):
    data = {
        'username': sdl.username,
        'permission': sdl.permission,
        'token': sdl.token,
        'link': gen_share_dtable_link(sdl.token),
        'dtable': dtable.name,
        'dtable_id': dtable.id,
        'workspace_id': dtable.workspace_id,
        'expire_date': datetime_to_isoformat_timestr(sdl.expire_date),
        'ctime': sdl.ctime,
        'has_password': sdl.is_encrypted()
    }

    return data


class DTableShareLinksView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        get dtable all share links of such user
        :param request:
        :return:
        """
        username = request.user.username
        workspace_id = request.GET.get('workspace_id')
        if not workspace_id:
            error_msg = _('workspace_id invalid.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        table_name = request.GET.get('table_name')
        if not table_name:
            error_msg = _('table_name invalid.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = _('Workspace %(workspace)s not found' % {'workspace': workspace_id})
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo = seafile_api.get_repo(workspace.repo_id)
        if not repo:
            error_msg = _('Library %(workspace)s not found' % {'workspace': workspace_id})
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace_id, table_name)
        if not dtable:
            error_msg = _('DTable %(table)s not found' % {'table': table_name})
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # get table's all links of user
        dsls = DTableShareLinks.objects.filter(dtable=dtable, username=username)
        results = [get_share_dtable_link_info(item, dtable) for item in dsls]
        return Response({
            'dtable_share_links': results
        })

    def post(self, request):
        # argument check
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            error_msg = 'workspace_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        table_name = request.data.get('table_name')
        if not table_name:
            error_msg = 'table_name invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        link_permission = request.data.get('permission')
        if not link_permission or (
                link_permission not in permission_tuple and
                PERMISSION_PREFIX not in link_permission):
            error_msg = _('Permission invalid')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        link_permission = link_permission if link_permission else PERMISSION_READ

        password = request.data.get('password')
        if password and len(password) < SHARE_LINK_PASSWORD_MIN_LENGTH:
            error_msg = _('Password is too short.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

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
            error_msg = _('Workspace %(workspace)s not found' % {'workspace': workspace_id})
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        repo = seafile_api.get_repo(workspace.repo_id)
        if not repo:
            error_msg = _('Library %(repo)s not found' % {'repo': workspace.repo_id})
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace_id, table_name)
        if not dtable:
            error_msg = _('DTable %(table)s not found' % {'table': table_name})
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # share permission check
        if link_permission not in permission_tuple:
            share_permission = get_share_permission(link_permission, dtable.uuid.hex)
            if not share_permission:
                error_msg = 'Share permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # main
        username = request.user.username
        try:
            sdl = DTableShareLinks.objects.create_link(dtable.id, username,
                                                       permission=link_permission,
                                                       expire_date=expire_date,
                                                       password=password)
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        data = get_share_dtable_link_info(sdl, dtable)
        return Response(data)


class DTableSharedLinkView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, token):
        dsl = DTableShareLinks.objects.filter(token=token).first()
        if not dsl:
            return Response({'success': True})

        username = request.user.username
        if not check_dtable_admin_permission(username, dsl.dtable.workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            dsl.delete()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})

import logging
import copy

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.dtable.models import Workspaces, DTables, DTableSharePermission, DTableShare, DTableGroupShare
from seahub.dtable.utils import check_dtable_admin_permission, check_dtable_permission
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_PREFIX
from seahub.utils import get_inner_dtable_server_url
from seahub.dtable.settings import DTABLE_SHARE_PERMISSION_QUOTA

logger = logging.getLogger(__name__)
PERMISSION_DETAIL = 'detail'
table_permissions = (PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_DETAIL)
view_permissions = (PERMISSION_READ, PERMISSION_READ_WRITE)


def _get_base_permission(dtable):
    """tables and views in metadata except private view"""
    dtable_server_url = get_inner_dtable_server_url()
    dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), dtable_server_url)
    dtable_metadata = dtable_server_api.get_metadata()

    # base_permission
    base_permission = []
    tables = dtable_metadata.get('tables', [])
    for table in tables:
        table_data = {}
        table_data['_id'] = table['_id']
        table_data['name'] = table['name']
        table_data['permission'] = None

        table_data['views'] = []
        views = table.get('views', [])
        for view in views:
            view_data = {}
            private_for = view.get('private_for', None)
            if private_for:
                continue
            view_data['_id'] = view['_id']
            view_data['name'] = view['name']
            view_data['type'] = view.get('type', 'table')
            view_data['permission'] = None
            table_data['views'].append(view_data)

        base_permission.append(table_data)

    return base_permission


def _parse_table_permission(table_permission):
    # hide
    if table_permission not in table_permissions:
        return None

    # r, rw, detail
    return table_permission


def _parse_view_permission(table_permission, view_permission):
    # same as table permission
    if table_permission in (PERMISSION_READ, PERMISSION_READ_WRITE, None):
        return table_permission

    # hide
    if view_permission not in view_permissions:
        return None

    # r, rw
    return view_permission


def _gen_raw_permission(permission):
    """Raw permission for database"""
    raw_permission = {}
    for table in permission:
        raw_table = {}
        table_permission = _parse_table_permission(table.get('permission'))
        raw_table['permission'] = table_permission

        views = table.get('views', [])
        for view in views:
            view_permission = _parse_view_permission(
                table_permission, view.get('permission'))
            raw_table[view['_id']] = view_permission

        raw_permission[table['_id']] = raw_table

    return raw_permission


def _get_checked_permission(base_permission, raw_permission):
    """raw permission perhaps not up to date"""
    permission = copy.deepcopy(base_permission)

    for table in permission:
        raw_table = raw_permission.get(table['_id'], {})
        table_permission = _parse_table_permission(raw_table.get('permission'))
        table['permission'] = table_permission

        views = table.get('views', [])
        for view in views:
            view_permission = _parse_view_permission(
                table_permission, raw_table.get(view['_id']))
            view_type = view.get('type', 'table')
            if view_type != 'archive':
                view['permission'] = view_permission

    return permission


class DTableBaseSharePermissionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """Get base share permission for create new one
        """
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        user = request.user
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            base_permission = _get_base_permission(dtable)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'base_permission': base_permission})


class DTableSharePermissionsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """List dtable share premissions
        """
        try:
            detail = to_python_boolean(request.GET.get('detail', 'false'))
        except:
            detail = False
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        user = request.user
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            permission_qs = DTableSharePermission.objects.list_by_dtable(
                dtable.uuid.hex)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if detail:
            permission_list = []
            base_permission = _get_base_permission(dtable)
            for permission in permission_qs:
                raw_permission = permission.get_raw_permission_detail()
                checked_permission = _get_checked_permission(
                    base_permission, raw_permission)
                data = permission.to_dict()
                data['permission'] = checked_permission
                permission_list.append(data)
        else:
            permission_list = [item.to_dict() for item in permission_qs]

        return Response({'permission_list': permission_list})

    def post(self, request, workspace_id, name):
        """Add dtable share premission
        """
        # argument check
        permission = request.data.get('permission')
        if not permission:
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        permission_name = request.data.get('name')
        if not permission_name:
            error_msg = 'name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        description = request.data.get('description', '')

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        user = request.user
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_share_permission_count = DTableSharePermission.objects.list_by_dtable(dtable.uuid.hex).count()
        if dtable_share_permission_count >= DTABLE_SHARE_PERMISSION_QUOTA:
            error_msg = _('Number of share permissions exceeds the %s limit.') % DTABLE_SHARE_PERMISSION_QUOTA
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        try:
            raw_permission = _gen_raw_permission(permission)
            item = DTableSharePermission()
            item.dtable_uuid = dtable.uuid.hex
            item.name = permission_name
            item.description = description
            item.set_raw_permission(raw_permission)
            item.save()

            base_permission = _get_base_permission(dtable)
            checked_permission = _get_checked_permission(
                base_permission, raw_permission)
            data = item.to_dict()
            data['permission'] = checked_permission
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'permission': data})


class DTableSharePermissionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name, permission_id):
        """Get dtable share permission
        """
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        user = request.user
        if not check_dtable_permission(user.username, workspace, dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            item = DTableSharePermission.objects.get_by_id_and_dtable(
                permission_id, dtable.uuid.hex)
            if not item:
                error_msg = 'Permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            raw_permission = item.get_raw_permission_detail()
            base_permission = _get_base_permission(dtable)
            checked_permission = _get_checked_permission(
                base_permission, raw_permission)
            data = item.to_dict()
            data['permission'] = checked_permission
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'permission': data})

    def put(self, request, workspace_id, name, permission_id):
        """Update dtable share permission
        """
        # argument check
        permission = request.data.get('permission')
        permission_name = request.data.get('name')
        description = request.data.get('description')

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        user = request.user
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            item = DTableSharePermission.objects.get_by_id_and_dtable(
                permission_id, dtable.uuid.hex)
            if not item:
                error_msg = 'Permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            if permission_name:
                item.name = permission_name
            if description or description == '':
                item.description = description
            if permission:
                raw_permission = _gen_raw_permission(permission)
                item.set_raw_permission(raw_permission)

            item.save()

            base_permission = _get_base_permission(dtable)
            raw_permission = item.get_raw_permission_detail()
            checked_permission = _get_checked_permission(
                base_permission, raw_permission)
            data = item.to_dict()
            data['permission'] = checked_permission
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'permission': data})

    def delete(self, request, workspace_id, name, permission_id):
        """Delete dtable share permission
        """
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        # permission check
        user = request.user
        if not check_dtable_admin_permission(user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            item = DTableSharePermission.objects.get_by_id_and_dtable(
                permission_id, dtable.uuid.hex)
            if not item:
                error_msg = 'Permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            permision = 'c-' + str(permission_id)
            item.delete()
            DTableShare.objects.filter(dtable=dtable.id, permission=permision).delete()
            DTableGroupShare.objects.filter(dtable=dtable.id, permission=permision).delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableSharedPermissionView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name, permission_id):
        """Get dtable shared permission
        from DTableShare，DTableGroupShare，DTableShareLinks
        """
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % (workspace_id,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        dtable = DTables.objects.get_dtable(workspace, name)
        if not dtable:
            error_msg = 'Base %s not found.' % (name,)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        user = request.user
        recent_permission = check_dtable_permission(user.username, workspace, dtable)
        if not recent_permission \
                or recent_permission != PERMISSION_PREFIX + str(permission_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            item = DTableSharePermission.objects.get_by_id_and_dtable(
                permission_id, dtable.uuid.hex)
            if not item:
                error_msg = 'Permission not found.'
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            raw_permission = item.get_raw_permission_detail()
            base_permission = _get_base_permission(dtable)
            checked_permission = _get_checked_permission(
                base_permission, raw_permission)
            data = item.to_dict()
            data['permission'] = checked_permission
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'permission': data})

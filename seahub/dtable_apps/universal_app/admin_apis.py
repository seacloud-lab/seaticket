import json
import re
import logging
from dateutil.relativedelta import relativedelta
from django.utils import timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated

from django.utils.translation import gettext as _
from seaserv import ccnet_api, seafile_api
from seahub.api2.permissions import CanUseAdvancedCustomizaiton, IsOrgMember
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.utils import api_error, get_user_common_info, to_python_boolean
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_CUSTOM
from seahub.department_v2.models import DepartmentMembersV2, DepartmentsV2
from seahub.dtable.models import DTables, Workspaces, DTableExternalApps
from seahub.dtable.utils import check_dtable_admin_permission, add_app_users_sync_task, \
    clean_app_users_cache
from seahub.dtable_apps.universal_app.models import DTableAppUsers, DTableAppRoles, DTableAppInviteLinks, \
    DTableAppUserSync, DTableAppSnapshot, DtableAppFolders, DtableAppFolderItems, DTableAPPAnonymousAccessPassword
from seahub.dtable_apps.universal_app.utils import get_app_user, backup_custom_pages, revert_custom_pages, \
    delete_custom_pages_backup_dir, backup_single_record_pages, revert_single_record_pages, delete_single_record_pages_backup_dir, \
    get_navigation_ids_set, gen_unique_navigation_id, add_page_to_navigation, del_page_from_navigation, move_page_from_navigation
from seahub.dtable_apps.workflow.models import DTableWorkflows
from seahub.dtable_apps.workflow.utils import get_table_id_from_config
from seahub.utils import is_org_context, uuid_str_to_36_chars, is_valid_username
from seahub.utils.hasher import AESPasswordHasher
from seahub.settings import SHARE_LINK_PASSWORD_MIN_LENGTH, SHARE_LINK_EXPIRE_DAYS_DEFAULT, SHARE_LINK_EXPIRE_DAYS_MIN, \
    SHARE_LINK_EXPIRE_DAYS_MAX, UNIVERSAL_APP_SNAPSHOT_LIMITS, ENABLE_WORKFLOW
from seahub.utils.timeutils import datetime_to_isoformat_timestr

TIMEOUT = 30
logger = logging.getLogger(__name__)


permission_tuple = (PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_CUSTOM)

class DTableUniversalAppUsersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)


    def get(self, request, app_uuid):

        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            page = 1
            per_page = 100

        start = (page - 1) * per_page
        end = start + per_page

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_users = DTableAppUsers.objects.filter(app = universal_app)
        total_count = app_users.count()
        try:
            infos = []
            for app_user in app_users[start: end]:
                infos.append(get_app_user(app_user))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_users': infos, 'total_count': total_count})


    def post(self, request, app_uuid):

        # argument check
        app_user_name = request.data.get('app_user', None)
        if not app_user_name or not is_valid_username(app_user_name):
            error_msg = 'app user invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = User.objects.get(email=app_user_name)
        except User.DoesNotExist:
            error_msg = 'User %s not found.' % app_user_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            app_role_id = int(request.data.get('app_role_id', None))
        except:
            app_role_id = None

        if not app_role_id:
            error_msg = 'app role invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        app_role = DTableAppRoles.objects.filter(app=universal_app, pk=app_role_id).first()
        if not app_role:
            error_msg = 'app role %s not found.' % app_role_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        app_user = DTableAppUsers.objects.filter(app=universal_app, username=app_user_name).first()
        if app_user:
            error_msg = _('app user %s already exists.') % app_user_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            app_user = DTableAppUsers.objects.create(
                app =universal_app,
                role = app_role,
                username = app_user_name
            )
            clean_app_users_cache(dtable_uuid)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_user': get_app_user(app_user)})


class DTableUniversalAppUserView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, app_uuid, app_user_id):

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        is_active = request.data.get('is_active', None)

        try:
            app_role_id = int(request.data.get('app_role_id', None))
        except:
            app_role_id = None

        app_role = None
        if app_role_id:
            app_role = DTableAppRoles.objects.filter(app=universal_app, pk=app_role_id).first()
            if not app_role:
                error_msg = 'app role %s not found.' % app_role_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_user = DTableAppUsers.objects.filter(app=universal_app, pk=app_user_id).first()

        if not app_user:
            error_msg = 'app user %s not found.' % app_user_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            if app_role:
                app_user.role = app_role
                app_user.save()
            if is_active:
                if is_active == 'true':
                    app_user.set_active()
                if is_active == 'false':
                    app_user.set_inactive()

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


        return Response({'app_user': get_app_user(app_user)})

    def delete(self, request, app_uuid, app_user_id):

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_user = DTableAppUsers.objects.filter(app=universal_app, pk=app_user_id).first()

        if not app_user:
            error_msg = 'app user %s not found.' % app_user_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if app_user.username == request.user.username:
            error_msg = 'can not delete self.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            app_user.delete()
            clean_app_users_cache(dtable_uuid)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableUniversalAppRolesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)


    def get(self, request, app_uuid):

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_roles = DTableAppRoles.objects.filter(app = universal_app)

        try:
            infos = []
            for app_role in app_roles:

                infos.append(app_role.to_dict())
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_roles': infos})


    def post(self, request, app_uuid):

        # argument check
        role_name = request.data.get('role_name', None)
        if not role_name:
            error_msg = 'role name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        permission = request.data.get('permission', None)
        if not permission or (permission not in permission_tuple):
            error_msg = 'permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        permission_detail = None
        if permission == PERMISSION_CUSTOM:
            permission_detail = request.data.get('permission_detail', None)

        if not request.user.permissions.can_use_advanced_customization():
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)


        app_role = DTableAppRoles.objects.filter(role_name=role_name, app=universal_app).first()
        if app_role:
            error_msg = _('app role %s already exists.') % role_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            app_role = DTableAppRoles.objects.create(
                app = universal_app,
                role_name = role_name,
                role_permission = permission,
                role_permission_detail = permission_detail and json.dumps(permission_detail) or None
            )
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_role': app_role.to_dict()})

class DTableUniversalAppRoleView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)


    def get(self, request, app_uuid, app_role_id):

        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_role = DTableAppRoles.objects.filter(app=universal_app, pk=app_role_id).first()
        if not app_role:
            error_msg = 'app role %s not found.' % app_role_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        return Response({'app_role': app_role.to_dict()})


    def put(self, request, app_uuid, app_role_id):

        role_name = request.data.get('role_name', None)
        permission = request.data.get('permission', None)
        permission_detail = None
        if permission == PERMISSION_CUSTOM:
            permission_detail = request.data.get('permission_detail', None)

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_role = DTableAppRoles.objects.filter(app=universal_app, pk=app_role_id).first()
        if not app_role:
            error_msg = 'app role %s not found.' % app_role_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if DTableAppRoles.objects.filter(app=universal_app, role_name=role_name).exists():
            error_msg = _('app role %s already exists.') % role_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            if role_name and role_name != app_role.role_name:
                app_role.role_name = role_name
            if permission and permission != app_role.role_permission:
                app_role.role_permission = permission

            if permission != PERMISSION_CUSTOM:
                app_role.role_permission_detail = None
            elif permission_detail and permission_detail != app_role.role_permission_detail:
                app_role.role_permission_detail = json.dumps(permission_detail)

            app_role.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_role': app_role.to_dict()})

    def delete(self, request, app_uuid, app_role_id):

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_role = DTableAppRoles.objects.filter(app=universal_app, pk=app_role_id).first()

        if not app_role:
            error_msg = 'app role %s not found.' % app_role_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            app_role.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

class DTableUniversalAppInviteLinksView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # get table's all links of user
        dsls = DTableAppInviteLinks.objects.filter(app=universal_app, username=username)
        results = [dsl.to_dict() for dsl in dsls]
        return Response({
            'app_share_links': results
        })

    def post(self, request, app_uuid):

        role_name = request.data.get('role_name')

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

        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


        app_role = DTableAppRoles.objects.get_app_role_by_name(universal_app, role_name)

        if not app_role:
            error_msg = 'app_role %s not found' % role_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)


        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        username = request.user.username
        try:
            sdl = DTableAppInviteLinks.objects.create_link(
                universal_app,
                app_role,
                username,
                expire_date=expire_date,
                password=password,
            )
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            "app_share_link": sdl.to_dict()
        })


class DTableUniversalAppInviteLinkView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, app_uuid, link_token):
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dsl = DTableAppInviteLinks.objects.filter(token=link_token).first()
        if not dsl:
            return Response({'success': True})

        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dsl.delete()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})


class DTableUniversalAppCustomURLView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedCustomizaiton)
    throttle_classes = (UserRateThrottle,)

    def _check_custom_url(self, custom_url):

        return True if re.search(r'^[-0-9a-zA-Z]+$', custom_url) else False

    def post(self, request, app_uuid):

        custom_url = request.data.get('custom_url', None)
        if not custom_url:
            error_msg = 'app custom url invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        custom_url = custom_url.strip()
        if not self._check_custom_url(custom_url):
            error_msg = _('URL is invalid')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(custom_url) < 5 or len(custom_url) > 30:
            error_msg = _('The custom part of URL should have 5-30 characters.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if DTableExternalApps.objects.filter(custom_url=custom_url).exists():
            error_msg = _('This custom domain is already in use and cannot be used for your app')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            universal_app.custom_url = custom_url
            universal_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            "custom_url": universal_app.custom_url,
        })

    def delete(self, request, app_uuid):
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not universal_app.custom_url:
            return Response({'success': True})

        try:
            universal_app.custom_url = None
            universal_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})


class DTableUniversalAppsView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        username = request.user.username
        try:
            user_folders = DtableAppFolders.objects.filter(username=username)
            app_folders = [folder.to_dict() for folder in user_folders]

            user_folders_ids = user_folders.values_list("id", flat=True)
            apps_in_folders = DtableAppFolderItems.objects.filter(folder_id__in=user_folders_ids)
            apps_in_folders_ids = apps_in_folders.values_list("app_id", flat=True)

            app_users = DTableAppUsers.objects.filter(username=username, app__inactive=False).exclude(app_id__in=apps_in_folders_ids)
            my_managed_apps, can_use_apps = [], []
            for user in app_users:
                app = user.app
                app_user_id = user.id
                role = user.role
                role_name = role.role_name
                dtable_uuid = app.dtable_uuid
                dtable = DTables.objects.get_dtable_by_uuid(
                    uuid_str_to_36_chars(dtable_uuid)
                )
                if not dtable:
                    continue

                if dtable.deleted:
                    continue

                info_dict = {
                    'app_user_id': app_user_id,
                    'app_id': app.pk,
                    'app_name': app.app_name,
                    'app_uuid': app.app_uuid,
                    'app_config': app.app_config,
                    'role_name': role_name,
                    'permission': role.role_permission,
                    'dtable_uuid': dtable_uuid,
                    'dtable_name': dtable.name,
                    'workspace_id': dtable.workspace_id,
                    'link': app.link,
                    'edit_link': app.edit_link,
                    'joined_at': datetime_to_isoformat_timestr(user.created_at)
                }
                if role_name == 'admin':
                    my_managed_apps.append(info_dict)
                else:
                    can_use_apps.append(info_dict)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            'my_managed_apps': my_managed_apps,
            'can_use_apps': can_use_apps,
            'app_folders': app_folders
        })

class DTableUniversalAppUserSyncView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)


    def get(self, request, app_uuid):
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            sync_info = DTableAppUserSync.objects.filter(app=universal_app).first()
            return Response({
                'sync_info': sync_info and sync_info.to_dict() or None
            })
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


    def post(self, request, app_uuid):
        table_name = request.data.get('table_name', None)
        username = request.user.username
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        syncer = DTableAppUserSync.objects.filter(app = universal_app).first()
        table_id = ''
        if syncer:
            table_id = syncer.dst_table_id

        if not (table_id or table_name):
            error_msg = 'dst table invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        params = {
            'username': username,
            'table_name': table_name,
            'table_id': table_id,
            'dtable_uuid': dtable_uuid,
            'app_name': universal_app.app_name,
            'app_id': universal_app.pk
        }


        try:
            task_id = add_app_users_sync_task(params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})


class DTableUniversalAppUsersBatch(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, app_uuid):

        users_info = request.data.get('users_info')
        if not isinstance(users_info, list):
            error_msg = 'users_info invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        result = {}
        result['failed'] = []
        result['success'] = []

        role_id_list = [user.get('role_id') for user in users_info]

        app_roles = DTableAppRoles.objects.filter(app=universal_app, pk__in=set(role_id_list))

        role_id_to_app_role = {role.id: role for role in app_roles}
        user_list = [user.get('email') for user in users_info if role_id_to_app_role.get(user.get('role_id'))]
        role_filtered_user_list = [user for user in users_info if role_id_to_app_role.get(user.get('role_id'))]

        role_fail_list = [get_role_failed_info(user) for user in users_info if not role_id_to_app_role.get(user.get('role_id'))]
        app_users = DTableAppUsers.objects.filter(app=universal_app, username__in=user_list)
        username_to_app_user = {user.username: user for user in app_users}
        filtered_user_list = [user for user in role_filtered_user_list if not username_to_app_user.get(user.get('email'))]

        email_fail_list = [get_email_failed_info(user) for user in users_info if username_to_app_user.get(user.get('email'))]
        result['failed'] += role_fail_list
        result['failed'] += email_fail_list

        added_user_list = []
        for user_info in filtered_user_list:
            email = user_info.get('email', '')
            email_name = email2nickname(email)
            app_role_id = user_info.get('role_id')
            try:
                User.objects.get(email=email)
            except User.DoesNotExist:
                result['failed'].append({
                    'email': email,
                    'email_name': email_name,
                    'error_msg': 'User %s not found.' % email_name
                    })
            app_user = DTableAppUsers(app=universal_app, role_id=app_role_id, username=email)
            app_user.save()
            added_user_list.append(get_app_user(app_user))

        result['success'] = added_user_list
        clean_app_users_cache(dtable_uuid)

        return Response(result)


def get_role_failed_info(user):
    return {
        'email': user.get('email'),
        'email_name': email2nickname(user.get('email')),
        'error_msg': _('app role %s not found.') % user.get('role_id')
        }


def get_email_failed_info(user):
    return {
        'email': user.get('email'),
        'email_name': email2nickname(user.get('email')),
        'error_msg': _('app user %s already exists.') % email2nickname(user.get('email'))
        }


class DTableAppUsersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, app_user_id):
        username = request.user.username
        try:
            app_user = DTableAppUsers.objects.filter(id=app_user_id, username=username).first()
            if app_user.app.inactive:
                error_msg = _('This app is not available')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            app_user.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


def _get_address_book_group_memeber_info(group_member_obj, app_user_emails=[]):
    email = group_member_obj.user_name
    avatar_url, is_default, date_uploaded = api_avatar_url(email)
    is_app_user = email in app_user_emails
    member_info = {
        'email': email,
        "name": email2nickname(email),
        "contact_email": email2contact_email(email),
        "avatar_url": avatar_url,
        "is_app_user": is_app_user
    }

    return member_info

def _get_org_user_info(email, app_user_emails):

    info = {}
    info['email'] = email
    info['name'] = email2nickname(email)
    info['contact_email'] = email2contact_email(email)
    avatar_url, _, _  = api_avatar_url(email)
    info['avatar_url'] = avatar_url
    info['is_app_user'] = True if email in app_user_emails else False
    return info

class AddressBookDepartmentMembersForApp(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def _check_department_permission(self, org_id, department_id):
        '''
        check if the department belongs to the org
        '''
        owner = "%s@seafile_group" % department_id
        ws = Workspaces.objects.get_workspace_by_owner(owner)
        if ws and ws.org_id == org_id:
            return True
        return False

    def get(self, request, app_uuid, department_id):
        """ List members of a group in address book.
        """

        try:
            department_id = int(department_id)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Department id invalid')

        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        org_id = request.user.org.org_id if request.user.org else None
        if org_id and not self._check_department_permission(org_id, department_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            return_results = []
            members = ccnet_api.get_group_members(department_id)

            member_emails = [m.user_name for m in members]

            app_users = DTableAppUsers.objects.filter(
                app = universal_app,
                username__in = member_emails
            )

            app_user_emails = [u.username for u in app_users]
            for m in members:
                if m.user_name == '':
                    continue
                member_info = _get_address_book_group_memeber_info(m, app_user_emails=app_user_emails)

                return_results.append(member_info)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({
            'members': return_results
        })


class AddressBookDepartmentV2MembersForApp(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def get(self, request, app_uuid, department_id):
        """ List members of a group in address book.
        """

        try:
            department_id = int(department_id)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Department id invalid')

        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = 'Permission denied'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        department = DepartmentsV2.objects.filter(id=department_id).first()
        if not department:
            return api_error(status.HTTP_404_NOT_FOUND, 'Department not found')

        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id
        if org_id != department.org_id:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        members = DepartmentMembersV2.objects.get_department_members_by_id(department_id)
        user_list = []
        for member in members:
            member_info = get_user_common_info(member.username)
            member_info['is_staff'] = member.is_staff
            user_list.append(member_info)
        return Response({
            'members': user_list
        })


class OrganizationMembersForApp(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, IsOrgMember)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid, org_id):
        try:
            org_id = int(org_id)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'org id invalid')

        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if org_id == 0:
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_id invalid.')
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            return api_error(status.HTTP_404_NOT_FOUND, 'Organization not found.')

        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 20))
        except ValueError:
            page = 1
            per_page = 20
        start = (page - 1) * per_page
        org_members = ccnet_api.get_org_users_by_url_prefix(org.url_prefix, start, per_page)
        member_emails = [m.email for m in org_members]
        app_users = DTableAppUsers.objects.filter(
            app = universal_app,
            username__in = member_emails
        )

        app_user_emails = [u.username for u in app_users]
        member_list = []
        for member in org_members:
            member_info = _get_org_user_info(member.email, app_user_emails)
            member_list.append(member_info)
        return Response({
            'members': member_list
        })


class DTableUniversalAppSearchUserView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            page = 1
            per_page = 100

        start = (page - 1) * per_page

        query_str = request.GET.get('query', '').lower()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        query_str = '%%' + query_str + '%%'

        sql = """
            SELECT dau.id, pp.nickname,dau.app_id, dau.role_id
            FROM dtable_app_users dau
            INNER JOIN profile_profile pp ON dau.username=pp.user
            WHERE dau.app_id=%(app_id)s AND pp.nickname LIKE %(query_str)s
            LIMIT %(per_page)s OFFSET %(start)s
        """

        count_sql = """
                    SELECT dau.id, count(*) as total_count
                    FROM dtable_app_users dau
                    INNER JOIN profile_profile pp ON dau.username=pp.user
                    WHERE dau.app_id=%(app_id)s AND pp.nickname LIKE %(query_str)s
                """
        params = {'app_id': universal_app.id,
                  'query_str': query_str,
                  'per_page': per_page,
                  'start': start,
                  }
        app_users = DTableAppUsers.objects.raw(sql, params=params)
        total_count = list(DTableAppUsers.objects.raw(count_sql, params=params))[0].total_count

        app_name = universal_app.app_name
        try:
            infos = []
            for app_user in app_users:
                app_username = app_user.username
                app_user_role = app_user.role
                app_user_info = app_user.to_dict()
                avatar_url, _, _ = api_avatar_url(app_username)

                app_user_info.update({
                    'name': app_user.nickname,
                    'app_name': app_name,
                    'role_id': app_user_role and app_user_role.pk,
                    'role_name': app_user_role and app_user_role.role_name,
                    'role_permission': app_user_role and app_user_role.role_permission,
                    'avatar_url': avatar_url,
                    'email': app_username,

                })

                infos.append(app_user_info)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_users': infos, 'total_count': total_count})

class DTableUniversalAppSnapshotsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):

        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '100'))
        except ValueError:
            page = 1
            per_page = 100

        start = (page - 1) * per_page
        end = start + per_page

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        snap_shots_qset = universal_app.snapshots.all().order_by('-id')
        total_count = snap_shots_qset.count()
        try:
            infos = []
            for snap_shot in snap_shots_qset[start: end]:
                infos.append(snap_shot.to_dict())
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_snapshots': infos, 'total_count': total_count})


    def post(self, request, app_uuid):

        notes = request.data.get('notes', '')
        if len(notes) > 255:
            error_msg = 'notes are too long.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        # permission check
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # snapshot count check
        snapshots_count = DTableAppSnapshot.objects.filter(
            app=universal_app
        ).count()

        if snapshots_count >= UNIVERSAL_APP_SNAPSHOT_LIMITS:
            return Response({'status': 'limit exceeded'})

        latest_snapshot = DTableAppSnapshot.objects.get_app_latest_snapshot(universal_app)
        if latest_snapshot and latest_snapshot.app_version  == universal_app.version:
            return Response({'status': 'no need to save'})

        try:
           new_snapshot = DTableAppSnapshot.objects.add_snapshot(universal_app, notes=notes)

           # backup custom_pages
           backup_custom_pages(universal_app, repo_id, dtable_uuid, username, new_snapshot.pk)

           # backup single_record_pages
           backup_single_record_pages(universal_app, repo_id, dtable_uuid, username, new_snapshot.pk)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_snapshot': new_snapshot.to_dict(), 'status': 'created'})

class DTableUniversalAppSnapshotView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)


    def put(self, request, app_uuid, snapshot_id):

        notes = request.data.get('notes', '')
        if len(notes) > 255:
            error_msg = 'notes are too long.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        app_snapshot = DTableAppSnapshot.objects.filter(
            app=universal_app,
            id=snapshot_id
        ).first()

        if not app_snapshot:
            error_msg = 'snapshot not found'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            app_snapshot.notes = notes
            app_snapshot.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'app_snapshot': app_snapshot.to_dict()})


    def delete(self, request, app_uuid, snapshot_id):
        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        app_snapshot = DTableAppSnapshot.objects.filter(
            app=universal_app,
            id=snapshot_id
        ).first()

        if not app_snapshot:
            error_msg = 'snapshot not found'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            # delete obj
            app_snapshot_id = app_snapshot.id
            app_snapshot_config = json.loads(app_snapshot.app_config)

            app_snapshot.delete()

            # delete backed-up custom pages in snapshot
            delete_custom_pages_backup_dir(app_snapshot_config, repo_id, dtable_uuid, username, app_snapshot_id)

            # delete backed-up single record pages in snapshot
            delete_single_record_pages_backup_dir(app_snapshot_config, repo_id, dtable_uuid, username, app_snapshot_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableUniversalAppSnapshotRestoreView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)


    def post(self, request, app_uuid, snapshot_id):

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        app_snapshot = DTableAppSnapshot.objects.filter(
            app = universal_app,
            id = snapshot_id
        ).first()

        if not app_snapshot:
            error_msg = 'snapshot not found'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
           # 1. revert app config
           universal_app.app_config = app_snapshot.app_config
           universal_app.save()

           #  2. revert custom page
           revert_custom_pages(
               universal_app,
               repo_id,
               dtable_uuid,
               username,
               snapshot_id
           )

           # 3. revert single record page
           revert_single_record_pages(
               universal_app,
               repo_id,
               dtable_uuid,
               username,
               snapshot_id
           )

        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableUniversalAppVersionUpdateView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, app_uuid):

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        app_config = json.loads(universal_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
           universal_app.update_version()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableUniversalAppsPagesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, app_uuid):
        """ insert page
        """
        # argument check
        page_data = request.data.get('page_data')
        if not page_data:
            error_msg = 'page_data invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        try:
            new_page = json.loads(page_data)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page_data invalid')

        folder_id = request.data.get('folder_id', None)

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        app_id = universal_app.pk
        new_app_config = json.loads(universal_app.app_config)
        app_type = new_app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # generate new page
        pages = new_app_config.get('settings').get('pages', [])
        navigation = new_app_config.get('settings').get('navigation', [])
        navigation_ids_set = get_navigation_ids_set(navigation)
        new_page_id = gen_unique_navigation_id(navigation_ids_set)
        new_page['id'] = new_page_id

        # set content_url for some page types
        if new_page['type'] in ['custom_page', 'single_record_page']:
            new_page['content_url'] = '/%s/%s/%s.json' % (app_id, new_page_id, new_page_id)

        # init trigger_workflow_option
        if new_page.get('type') == 'form' and ENABLE_WORKFLOW:
            new_page['trigger_workflow_option'] = { 'can_trigger_workflow': False }
            workflows = list(DTableWorkflows.objects.get_workflows_by_dtable_uuid(dtable.uuid.hex))
            table_to_workflow_dict = {get_table_id_from_config(workflow.workflow_config): workflow for workflow in workflows}
            app_table_id = new_page.get('table_id')
            workflow = table_to_workflow_dict.get(app_table_id)
            if workflow:
                new_page['trigger_workflow_option']['workflow_token'] = workflow.token
                new_page['trigger_workflow_option']['workflow_name'] = json.loads(workflow.workflow_config).get('workflow_name')
                new_page['trigger_workflow_option']['can_trigger_workflow'] = True

        # update pages and navigation
        pages.append(new_page)
        add_page_to_navigation(new_page, navigation, folder_id)
        new_app_config['settings']['pages'] = pages
        new_app_config['settings']['navigation'] = navigation

        # save updated app_config
        str_app_config = json.dumps(new_app_config)
        try:
            universal_app.app_config = str_app_config
            universal_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update the app's version
        universal_app.update_version()

        return Response({ 'page': new_page, 'folder_id': folder_id }, status=status.HTTP_201_CREATED)


class DTableUniversalAppsMovePageView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, app_uuid):
        """ move page
        """
        # argument check
        moved_page_id = request.data.get('moved_page_id')
        if not moved_page_id:
            error_msg = 'moved_page_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        move_position = request.data.get('move_position')

        target_page_id = request.data.get('target_page_id')
        target_folder_id = request.data.get('target_folder_id')
        is_moved_out = request.data.get('is_moved_out', False)
        if is_moved_out is not None:
            try:
                is_moved_out = to_python_boolean(is_moved_out)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'is_moved_out invalid')

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_app_config = json.loads(universal_app.app_config)
        app_type = new_app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        navigation = new_app_config.get('settings').get('navigation', [])
        move_page_from_navigation(moved_page_id, target_page_id, target_folder_id, move_position, is_moved_out, navigation)
        new_app_config['settings']['navigation'] = navigation

        # save updated app_config
        str_app_config = json.dumps(new_app_config)
        try:
            universal_app.app_config = str_app_config
            universal_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update the app's version
        universal_app.update_version()

        return Response({'success': True}, status=status.HTTP_200_OK)


class DTableUniversalAppsPageView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, app_uuid, page_id):
        """ delete page
        """
        # argument check
        if not page_id:
            error_msg = 'page_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        new_app_config = json.loads(universal_app.app_config)
        app_type = new_app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        pages = new_app_config.get('settings').get('pages', [])
        navigation = new_app_config.get('settings').get('navigation', [])

        # check page_id
        page = next(filter(lambda x: x.get('id') == page_id, pages), None)
        if not page:
            return Response({'success': True}, status=status.HTTP_200_OK)

        # delete page
        pages.remove(page)
        del_page_from_navigation(page_id, navigation)

        new_app_config['settings']['pages'] = pages
        new_app_config['settings']['navigation'] = navigation

        # save updated app_config
        str_app_config = json.dumps(new_app_config)
        try:
            universal_app.app_config = str_app_config
            universal_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update the app's version
        universal_app.update_version()

        return Response({'success': True}, status=status.HTTP_200_OK)


class DTableUniversalAnonymousPassword(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        # resource check
        universal_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not universal_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if universal_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)
        try:
            app_config = json.loads(universal_app.app_config)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'App config invalid')

        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        can_anonymous_access = app_config.get('can_anonymous_access') or False
        is_anonymous_need_password = app_config.get('is_anonymous_need_password') or False
        if (not can_anonymous_access) or (not is_anonymous_need_password):
            return Response({'password': ''})

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
        if not workspace:
            error_msg = 'Workspace not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_anonymous_access_password = DTableAPPAnonymousAccessPassword.objects.filter(app=universal_app).first()
        if not app_anonymous_access_password:
            return Response({'password': ''})

        hasher = AESPasswordHasher()
        return Response({'password': hasher.decode(app_anonymous_access_password.password)})

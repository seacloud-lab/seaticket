# -*- coding: utf-8 -*-
import json
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import CanUseExternalApp
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces, DTables, DTableExternalApps
from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_READ
from seahub.dtable.utils import check_dtable_permission, check_dtable_admin_permission
from seahub.dtable_apps.universal_app.models import DTableAppRoles, DTableAPPAnonymousAccessPassword
from seahub.dtable_apps.universal_app.signals import external_app_deleted
from seahub.dtable_apps.workflow.models import DTableWorkflows
from seahub.dtable_apps.workflow.utils import get_table_id_from_config
from seahub.utils import is_org_context
from seahub.utils.hasher import AESPasswordHasher
from seahub.settings import ENABLE_WORKFLOW, SHARE_LINK_PASSWORD_MIN_LENGTH
from seahub.dtable.settings import DTABLE_EXTERNAL_APP_QUOTA
from seahub.dtable_apps.universal_app.utils import get_custom_pages, duplicate_custom_pages, \
    get_single_record_pages, duplicate_single_record_pages

logger = logging.getLogger(__name__)


def _resource_check(workspace_id, table_name):
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        error_msg = 'Workspace %s not found.' % workspace_id
        return None, None, error_msg

    dtable = DTables.objects.get_dtable(workspace, table_name)
    if not dtable:
        error_msg = 'Base %s not found.' % table_name
        return None, None, error_msg

    return workspace, dtable, None

class DTableExternalAppsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseExternalApp)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workspace_id, name):
        """list apps
        Permission:
        1. owner
        2. group member
        3. shared user with `r`
        """
        # resource check
        workspace, dtable, error_msg = _resource_check(workspace_id, table_name=name)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in (
                PERMISSION_READ, PERMISSION_READ_WRITE):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        external_app_list = list()
        external_apps = DTableExternalApps.objects.get_external_apps_by_dtable_uuid(dtable.uuid.hex)
        for external_app in external_apps:
            obj_dict = external_app.to_dict()
            external_app_list.append(obj_dict)

        return Response({"external_app_list": external_app_list}, status=status.HTTP_200_OK)

    def post(self, request, workspace_id, name):
        """create an external app
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # argument check
        app_type = request.POST.get('app_type', None)
        if not app_type:
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        app_config = request.POST.get('app_config', None)
        if not app_config:
            error_msg = 'app_config invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        new_app_config = json.loads(app_config)
        if len(new_app_config["app_name"]) > 50:
            error_msg = 'App name is too long'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace, dtable, error_msg = _resource_check(workspace_id, table_name=name)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_uuid = dtable.uuid.hex
        external_app = DTableExternalApps.objects.get_external_app(
            dtable_uuid, app_type, app_config)
        # big-data-screen is created to be Untitled, so it's allowed to have a repeated name
        if external_app and app_type != 'big-data-screen':
            error_msg = 'App already exists.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if is_org_context(request):
            org_id = request.user.org.org_id
        else:
            org_id = -1

        dtable_external_app_count = DTableExternalApps.objects.get_external_apps_by_dtable_uuid(dtable_uuid).count()
        if dtable_external_app_count >= DTABLE_EXTERNAL_APP_QUOTA:
            error_msg = _('Number of apps exceeds the %s limit.') % DTABLE_EXTERNAL_APP_QUOTA
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            external_app = DTableExternalApps.objects.add_external_app(
                dtable_uuid, app_type, username, org_id, app_config)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if app_type == 'universal-app':
            DTableAppRoles.objects.generate_app_default_role(external_app)

        external_app = external_app.to_dict()

        return Response({"external_app": external_app}, status=status.HTTP_201_CREATED)


class DTableExternalAppView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseExternalApp)
    throttle_classes = (UserRateThrottle,)

    def need_update_anonymous_access_password(self, app, new_app_config):
        """
        only is_anonymous_need_password False -> True or anonymous_access_password changed, update or create anonymous access password
        """
        try:
            old_app_config = json.loads(app.app_config)
        except:
            old_app_config = {}

        old_is_anonymous_need_password = old_app_config.get('is_anonymous_need_password') or False

        can_anonymous_access = new_app_config.get('can_anonymous_access') or False
        is_anonymous_need_password = new_app_config.get('is_anonymous_need_password') or False
        anonymous_access_password = new_app_config.get('anonymous_access_password') or ''

        if not can_anonymous_access:
            return False

        if not is_anonymous_need_password:
            return False

        if not anonymous_access_password:
            return False

        hasher = AESPasswordHasher()
        hasher_anonymous_access_password = hasher.encode(anonymous_access_password)
        old_password_obj = DTableAPPAnonymousAccessPassword.objects.filter(app=app).first()
        if not old_is_anonymous_need_password and is_anonymous_need_password:
            return True
        if not old_password_obj or old_password_obj.password != hasher_anonymous_access_password:
            return True

        return False

    def need_remove_anonymous_access_password(self, new_app_config):
        can_anonymous_access = new_app_config.get('can_anonymous_access') or False
        is_anonymous_need_password = new_app_config.get('is_anonymous_need_password') or False
        return (not can_anonymous_access) or (not is_anonymous_need_password)

    def put(self, request, workspace_id, name, external_app_id):
        """ update an external app
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # argument check
        app_config = request.data.get('app_config', None)
        if not app_config:
            error_msg = 'app_config invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        workspace, dtable, error_msg = _resource_check(workspace_id, table_name=name)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            external_app = DTableExternalApps.objects.get(id=external_app_id, dtable_uuid=dtable.uuid.hex)
        except DTableExternalApps.DoesNotExist:
            error_msg = 'external app %s does not exist.' % external_app_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            new_app_config = json.loads(app_config)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'app_config invalid')

        if len(new_app_config["app_name"]) > 50:
            error_msg = 'App name is too long'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        pages = new_app_config.get('settings', {}).get('pages', [])

        if not ENABLE_WORKFLOW:
            for page in pages:
                trigger_workflow_option = page.get('trigger_workflow_option', {})
                trigger_workflow_option['can_trigger_workflow'] = False
                page['trigger_workflow_option'] = trigger_workflow_option
        else:
            workflows = list(DTableWorkflows.objects.get_workflows_by_dtable_uuid(dtable.uuid.hex))
            table_to_workflow_dict = {get_table_id_from_config(workflow.workflow_config): workflow for workflow in workflows}
            for page in pages:
                trigger_workflow_option = page.get('trigger_workflow_option', {})
                trigger_workflow_option['can_trigger_workflow'] = False
                app_table_id = page.get('table_id')
                workflow = table_to_workflow_dict.get(app_table_id)
                if workflow:
                    trigger_workflow_option['workflow_token'] = workflow.token
                    trigger_workflow_option['workflow_name'] = json.loads(workflow.workflow_config).get('workflow_name')
                    trigger_workflow_option['can_trigger_workflow'] = True
                page['trigger_workflow_option'] = trigger_workflow_option

        if external_app.app_type == 'universal-app':
            auto_archive_to_big_data = new_app_config.pop('auto_archive_to_big_data', None)
            auto_archive_table_ids = new_app_config.pop('auto_archive_table_ids', None)
            if isinstance(auto_archive_to_big_data, bool):
                new_app_config['auto_archive_to_big_data'] = auto_archive_to_big_data
            if isinstance(auto_archive_table_ids, list):
                new_app_config['auto_archive_table_ids'] = auto_archive_table_ids

        if self.need_update_anonymous_access_password(external_app, new_app_config):
            anonymous_access_password = new_app_config.pop('anonymous_access_password', '')

            if len(anonymous_access_password) < SHARE_LINK_PASSWORD_MIN_LENGTH:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Password for anonymous access is too short')
            hasher = AESPasswordHasher()
            try:
                DTableAPPAnonymousAccessPassword.objects.update_or_create(app=external_app, defaults={'password': hasher.encode(anonymous_access_password)})
            except Exception as e:
                logger.exception('create app: %s access password error: %s', external_app_id, e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        if self.need_remove_anonymous_access_password(new_app_config):
            try:
                DTableAPPAnonymousAccessPassword.objects.filter(app=external_app).delete()
            except Exception as e:
                logger.exception('remove app: %s anonymous access password error: %s', external_app_id, e)

        app_config = json.dumps(new_app_config)

        try:
            external_app.app_config = app_config
            external_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        external_app_dict = external_app.to_dict()
        custom_pages = get_custom_pages(app_config, workspace.repo_id, str(dtable.uuid))
        single_record_pages = get_single_record_pages(app_config, workspace.repo_id, str(dtable.uuid))
        external_app.update_version()

        return Response({
            "external_app": external_app_dict,
            "custom_pages": json.dumps(custom_pages),
            "single_record_pages": json.dumps(single_record_pages),
        }, status=status.HTTP_200_OK)

    def get(self, request, workspace_id, name, external_app_id):
        """ get an external app
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        # resource check
        workspace, dtable, error_msg = _resource_check(workspace_id, table_name=name)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in (
                PERMISSION_READ, PERMISSION_READ_WRITE):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            external_app = DTableExternalApps.objects.get(id=external_app_id, dtable_uuid=dtable.uuid.hex)
        except DTableExternalApps.DoesNotExist:
            error_msg = 'external app %s does not exist.' % external_app_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            app_config = json.loads(external_app.app_config)
        except:
            logger.warning('app: %s config invalid', external_app.pk)
            app_config = {}

        external_app_dict = external_app.to_dict()
        app_type = app_config.get('app_type')
        if app_type != 'universal-app':
            custom_pages = []
            single_record_pages = []
        else:
            custom_pages = get_custom_pages(app_config, workspace.repo_id, str(dtable.uuid))
            single_record_pages = get_single_record_pages(app_config, workspace.repo_id, str(dtable.uuid))

        return Response({
            "external_app": external_app_dict,
            "custom_pages": json.dumps(custom_pages),
            "single_record_pages": json.dumps(single_record_pages),
        }, status=status.HTTP_200_OK)

    def delete(self, request, workspace_id, name, external_app_id):
        """ delete an external app
        Permission:
        1. owner
        2. group member
        3. shared user with `rw`
        """
        workspace, dtable, error_msg = _resource_check(workspace_id, table_name=name)
        if error_msg:
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            external_app = DTableExternalApps.objects.get(id=external_app_id, dtable_uuid=dtable.uuid.hex)
            external_app_type = external_app.app_type
            external_app.delete()

            external_app_deleted.send(
                None,
                app_id=external_app_id,
                app_type=external_app_type
            )
        except DTableExternalApps.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True}, status=status.HTTP_200_OK)

class DTableExternalAppDuplicateView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, app_uuid):

        # resource check
        app_obj = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
        if not app_obj:
            error_msg = 'App %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if app_obj.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(app_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % app_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        app_config = json.loads(app_obj.app_config)
        app_config['app_name'] = app_config.get('app_name') + ' (1)'
        app_config = json.dumps(app_config)
        app_type = app_obj.app_type
        org_id = app_obj.org_id
        dtable_uuid = app_obj.dtable_uuid

        try:
            new_app_obj = DTableExternalApps.objects.add_external_app(
                dtable_uuid, app_type, username, org_id, app_config)

            if app_type == 'universal-app':
                DTableAppRoles.objects.generate_app_default_role(new_app_obj)

            new_app_obj = duplicate_custom_pages(app_obj, dtable.workspace.repo_id, dtable.workspace_id, dtable_uuid, new_app_obj, username)
            new_app_obj = duplicate_single_record_pages(app_obj, dtable.workspace.repo_id, dtable.workspace_id, dtable_uuid, new_app_obj, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        app_obj_dict = new_app_obj.to_dict()

        return Response({"external_app": app_obj_dict}, status=status.HTTP_200_OK)

class DTableExternalAppStatusView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseExternalApp)
    throttle_classes = (UserRateThrottle,)


    def put(self, request, app_uuid):

        is_inactive = request.data.get('is_inactive')
        app_obj = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
        if not app_obj:
            error_msg = 'App %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        dtable = DTables.objects.get_dtable_by_uuid(app_obj.dtable_uuid)
        if not dtable:
            error_msg = 'Base %s not found.' % app_obj.dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        workspace = dtable.workspace

        if not check_dtable_admin_permission(username, workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            if is_inactive is not None:
                app_obj.inactive = is_inactive
                app_obj.save()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            "external_app": app_obj.to_dict()
        })




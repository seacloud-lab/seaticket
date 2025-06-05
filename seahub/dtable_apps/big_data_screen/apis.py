import json
import logging
import os
import re
from io import BytesIO
from zipfile import ZipFile, is_zipfile

import requests
from django.conf import settings
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.permissions import CanUseAdvancedCustomizaiton, CanUseAdvancedPerms
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.department_v2.utils import get_departments_map_by_username
from seahub.dtable.models import DTableExternalApps, IdInOrgTuple, DTables
from seahub.dtable.utils import add_dtable_io_big_data_screen_app_task, check_dtable_admin_permission, generate_upload_link, is_valid_app_jwt
from seahub.dtable_apps.dtable_db_api import DTableDBAPI, ExecutionCostExceededError
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.utils import uuid_str_to_36_chars, get_inner_dtable_server_url

logger = logging.getLogger(__name__)


class BigDataScreensMetadataView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        """ get metadata
        """
        # resource check
        screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if screen_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(screen_app.dtable_uuid)
        try:
            app_config = json.loads(screen_app.app_config)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_400_BAD_REQUEST, 'App config invalid')
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()

        is_valid, payload = is_valid_app_jwt(auth, app_uuid, return_payload=True)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # metadata
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, get_inner_dtable_server_url())
        metadata = dtable_server_api.get_metadata()

        return Response(metadata)


class BigDataScreensElementStatisticView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle, )

    def post(self, request, app_uuid):
        # arguments check
        if not isinstance(request.data, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request')
        element_id = request.data.get('element_id')
        if not element_id:
            return api_error(status.HTTP_404_NOT_FOUND, 'element_id invalid')

        # resource check
        screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if screen_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(screen_app.dtable_uuid)
        app_config = json.loads(screen_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()

        is_valid, payload = is_valid_app_jwt(auth, app_uuid, return_payload=True)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        username = payload.get('username')

        # metadata
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, get_inner_dtable_server_url())
        metadata = dtable_server_api.get_metadata()

        try:
            app_config = json.loads(screen_app.app_config)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'App config invalid')

        page_content = app_config.get('settings') or {}
        page_elements = page_content.get('page_elements') or {}
        element_map = page_elements.get('element_map') or {}
        element = element_map.get(element_id)
        if not element:
            return api_error(status.HTTP_404_NOT_FOUND, 'Element not found')
        if element.get('type') != 'statistic':
            return api_error(status.HTTP_400_BAD_REQUEST, 'Element is not a statistic element')
        element_config = element.get('config') or {}
        statistic_type = element_config.get('type')
        table_id = element_config.get('table_id')

        tables = metadata.get('tables')
        table = next(filter(lambda x: x.get('_id') == table_id, tables), None)
        if not table:
            error_msg = 'table %s not found.' % table_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # generator sql
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
        user_department_ids_map = get_departments_map_by_username(username)
        current_user_department_ids = user_department_ids_map['current_user_department_ids']
        current_user_department_and_sub_ids = user_department_ids_map['current_user_department_and_sub_ids']

        import dtable_events

        sql, error = dtable_events.statistic2sql(table, statistic_type, element_config, username, id_in_org, current_user_department_ids, current_user_department_and_sub_ids)

        if error:
            return api_error(status.HTTP_404_NOT_FOUND, error)

        dtable_db_api = DTableDBAPI(username, dtable_uuid, settings.INNER_DTABLE_DB_URL)

        try:
            if not isinstance(sql, list):
                res_data = dtable_db_api.query(sql)
                return Response(res_data)
            else:
                new_res = {
                    'success': True,
                    'results': [],
                }
                for sql_item in sql:
                    if not sql_item:
                        new_res['results'].append([])
                    else:
                        res_data = dtable_db_api.query(sql_item)
                        new_res['results'].append(res_data['results'])
                return Response(new_res)
        except ExecutionCostExceededError as e:
            logger.warning('query dtable-db dtable: %s sql: %s cost exceeded error: %s', dtable_uuid, sql, e)
            return api_error(status.HTTP_400_BAD_REQUEST, 'Execution cost exceeded')
        except requests.Timeout as e:
            logger.error('query dtable-db dtable: %s sql: %s timeout error: %s', dtable_uuid, sql, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        except Exception as e:
            logger.exception('query dtable-db dtable: %s sql: %s error: %s', dtable_uuid, sql, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

class BigDataScreensElementStatisticDetailView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, app_uuid):
        # argument check
        if not isinstance(request.data, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request')
        element_id = request.data.get("element_id", None)
        if not element_id:
            error_msg = 'element_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        detail_filter_conditions = request.data.get('detail_filter_conditions')
        if not detail_filter_conditions or not isinstance(detail_filter_conditions, dict):
            error_msg = 'detail_filter_conditions invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # resource check
        screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if screen_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(screen_app.dtable_uuid)
        app_config = json.loads(screen_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_BAD_REQUEST, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base not found'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()

        is_valid, payload = is_valid_app_jwt(auth, app_uuid, return_payload=True)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        username = payload.get('username') or ''

        # metadata
        dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, get_inner_dtable_server_url())
        metadata = dtable_server_api.get_metadata()

        try:
            app_config = json.loads(screen_app.app_config)
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'App config invalid')

        page_content = app_config.get('settings') or {}
        page_elements = page_content.get('page_elements') or {}
        element_map = page_elements.get('element_map') or {}
        element = element_map.get(element_id)
        if not element:
            return api_error(status.HTTP_404_NOT_FOUND, 'Element not found')
        element_type = element.get('type')
        if element_type == 'chart_bar':
            element_type = 'statistic'
        if element_type != 'statistic':
            return api_error(status.HTTP_400_BAD_REQUEST, 'Element is not a statistic element')
        element_config = element.get('config') or {}
        statistic_type = element_config.get('type')
        table_id = element_config.get('table_id')

        tables = metadata.get('tables')
        table = next(filter(lambda x: x.get('_id') == table_id, tables), None)
        if not table:
            error_msg = 'table %s not found.' % table_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # generator sql
        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
        user_department_ids_map = get_departments_map_by_username(username)
        current_user_department_ids = user_department_ids_map['current_user_department_ids']
        current_user_department_and_sub_ids = user_department_ids_map['current_user_department_and_sub_ids']

        import dtable_events

        sql, error = dtable_events.statistic2sql(table, statistic_type, element_config, username, id_in_org, current_user_department_ids, current_user_department_and_sub_ids, detail_filter_conditions=detail_filter_conditions)

        if error:
            return api_error(status.HTTP_404_NOT_FOUND, error)

        dtable_db_api = DTableDBAPI(username, dtable_uuid, settings.INNER_DTABLE_DB_URL)

        try:
            if not isinstance(sql, list):
                res_data = dtable_db_api.query(sql)
                return Response(res_data)
            else:
                new_res = {
                    'success': True,
                    'results': [],
                }
                for sql_item in sql:
                    if not sql_item:
                        new_res['results'].append([])
                    else:
                        res_data = dtable_db_api.query(sql_item)
                        new_res['results'].append(res_data['results'])
                return Response(new_res)
        except ExecutionCostExceededError as e:
            logger.warning('query dtable-db dtable: %s sql: %s cost exceeded error: %s', dtable_uuid, sql, e)
            return api_error(status.HTTP_400_BAD_REQUEST, 'Execution cost exceeded')
        except requests.Timeout as e:
            logger.error('query dtable-db dtable: %s sql: %s timeout error: %s', dtable_uuid, sql, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        except Exception as e:
            logger.exception('query dtable-db dtable: %s sql: %s error: %s', dtable_uuid, sql, e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)


class BigDataScreensAdminUploadLinkView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        """ upload link
        """
        # resource check
        screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if screen_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(screen_app.dtable_uuid)
        try:
            app_config = json.loads(screen_app.app_config)
        except Exception:
            return api_error(status.HTTP_400_BAD_REQUEST, 'App config invalid')
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_app_jwt(auth, app_uuid, return_payload=True)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        username = payload.get('username')
        if not username:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        parent_dir = os.path.join('/asset', str(dtable.uuid))

        try:
            upload_link = generate_upload_link(parent_dir, dtable)
        except Exception as e:
            logger.error('generate upload link error: %s, parent_dir: %s', e, parent_dir)

        return Response({
            'parent_path': parent_dir,
            'upload_link': upload_link
        })


class BigDataScreensImportView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, app_uuid):
        # arguments check
        request.upload_handlers = [TemporaryFileUploadHandler(request=request)]

        try:
            is_file = to_python_boolean(request.data.get('is_file'))
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'is_file invalid')

        if is_file:
            imported_zip = request.FILES.get('zip_file', None)
            if not imported_zip:
                error_msg = 'zip invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            uploaded_temp_path = BytesIO(imported_zip.read())
            if not is_zipfile(uploaded_temp_path):
                error_msg = _('A *.zip file is required.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            app_name = os.path.splitext(imported_zip.name)[0]
        else:
            uploaded_temp_path = request.data.get('file_url')
            resp = requests.get(uploaded_temp_path)
            uploaded_temp_path = BytesIO(resp.content)
            if not is_zipfile(uploaded_temp_path):
                error_msg = _('A *.zip file is required.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            app_name = ''

        # resource check
        screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if screen_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(screen_app.dtable_uuid)
        try:
            app_config = json.loads(screen_app.app_config)
        except Exception:
            return api_error(status.HTTP_400_BAD_REQUEST, 'App config invalid')
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_app_jwt(auth, app_uuid, return_payload=True)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        username = payload.get('username')
        if not username:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        params = {}
        params['username'] = username
        params['repo_id'] = dtable.workspace.repo_id
        params['dtable_uuid'] = str(dtable.uuid)
        params['app_uuid'] = app_uuid
        params['app_id'] = screen_app.id

        tmp_extracted_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'big_data_screen_zip_extracted', app_uuid)
        try:
            with ZipFile(uploaded_temp_path, 'r') as zip_file:
                zip_file.extractall(tmp_extracted_path)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


        content_json_file_path = os.path.join(tmp_extracted_path, 'content.json')
        with open(content_json_file_path, 'r') as f:
            try:
                content = json.load(f)
            except:
                content = {}
        page_images = content.get('page_images', [])
        # update app_name
        with open(content_json_file_path, 'w') as f:
            content['app_name'] = app_name
            json.dump(content, f)

        try:
            task_id = add_dtable_io_big_data_screen_app_task(type='import', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id, 'page_images': page_images, 'app_name': app_name})


# All following apis belong to admins for app

class BigDataScreensCustomURLView(APIView):

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

        custom_url = custom_url.strip()
        if not self._check_custom_url(custom_url):
            error_msg = _('URL is invalid')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if len(custom_url) < 5 or len(custom_url) > 30:
            error_msg = _('The custom part of URL should have 5-30 characters.')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        big_data_screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not big_data_screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if big_data_screen_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(big_data_screen_app.dtable_uuid)
        app_config = json.loads(big_data_screen_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if DTableExternalApps.objects.filter(custom_url=custom_url).exists():
            error_msg = _('This custom domain is already in use and cannot be used for your app')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base %s not found' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            big_data_screen_app.custom_url = custom_url
            big_data_screen_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({
            "custom_url": big_data_screen_app.custom_url,
        })

    def delete(self, request, app_uuid):
        big_data_screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not big_data_screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if big_data_screen_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(big_data_screen_app.dtable_uuid)
        app_config = json.loads(big_data_screen_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            error_msg = 'Base %s not found' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = _('Permission denied.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not big_data_screen_app.custom_url:
            return Response({'success': True})

        try:
            big_data_screen_app.custom_url = None
            big_data_screen_app.save()
        except Exception as e:
            logger.error(e)
            error_msg = _('Internal Server Error')
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        return Response({'success': True})


class BigDataScreensExportView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, CanUseAdvancedPerms)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        # resource check
        screen_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not screen_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # if screen_app.inactive:
        #     error_msg = _('This app is not available')
        #     return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(screen_app.dtable_uuid)
        try:
            app_config = json.loads(screen_app.app_config)
        except Exception:
            return api_error(status.HTTP_400_BAD_REQUEST, 'App config invalid')
        app_type = app_config.get('app_type')
        if app_type != 'big-data-screen':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        params = {}
        params['username'] = username
        params['repo_id'] = dtable.workspace.repo_id
        params['dtable_uuid'] = str(dtable.uuid)
        params['app_uuid'] = app_uuid
        params['app_id'] = screen_app.id

        try:
            task_id = add_dtable_io_big_data_screen_app_task(type='export', params=params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id': task_id})

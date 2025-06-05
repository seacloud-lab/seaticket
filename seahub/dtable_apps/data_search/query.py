# -*- coding: utf-8 -*-
import time
import json
import logging
import re

from django.core.cache import cache
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import IdInOrgTuple, DTables, DTableExternalApps
from seahub.dtable.utils import is_valid_app_jwt
from seahub.dtable_apps.utils import SUPPORT_SEARCH_COLUMN_TYPES, is_filter_empty
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import DTABLE_PRIVATE_KEY, INNER_DTABLE_DB_URL, DATA_SEARCH_MAX_QUERY_TIMES_PER_MINUTE
from seahub.utils import uuid_str_to_36_chars, get_inner_dtable_server_url, normalize_cache_key


logger = logging.getLogger(__name__)


def get_metadata(dtable_uuid, app_uuid):
    """
    return: metadata -> dict or None, error -> api_error or None
    """
    dtable_server_url = get_inner_dtable_server_url().strip('/')
    dtable_server_api = DTableServerAPI('dtable-web', dtable_uuid, dtable_server_url)
    try:
        metadata = dtable_server_api.get_metadata()
        return metadata, None
    except Exception as e:
        logger.exception('app: %s request dtable: %s metadata error: %s', app_uuid, dtable_uuid, e)
        return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')


def get_columns(table, view):
    if not table:
        return []
    table_columns = table.get('columns', [])
    if not view:
        return table_columns
    
    hidden_column_keys = view.get('hidden_columns', [])
    return [ column for column in table_columns if column['key'] not in hidden_column_keys ]

def calculate_columns_name(columns, columns_name):
    if not columns:
        return []
    new_columns_name = [ column['name'] for column in columns ]
    if not columns_name:
        return new_columns_name
    
    valid_columns_name = [ column_name for column_name in columns_name if column_name in new_columns_name ]
    for column_name in new_columns_name:
        if column_name not in valid_columns_name:
            valid_columns_name.append(column_name)
    return valid_columns_name

DURATION_FORMATS = [
    'h:mm',
    'h:mm:ss',
]

def format_text_to_duration(column, value):
    if not column:
        return 'Column invalid', ''
    if not value:
        return 'Value invalid', ''

    data = column['data'] or {}
    duration_format = data['duration_format'] or 'h:mm'
    if duration_format not in DURATION_FORMATS:
        return 'Column data invalid', ''
    
    is_negative = value[0] == '-'
    if is_negative:
        value = value[1:]
    if not re.match(r'^-?\d+[:：]\d+([:：]\d+)?$', value):
        return 'Value invalid', ''
    time_parts = re.split(r'[:|：]', value)
    time_parts_len = len(time_parts)
    if time_parts_len == 0:
        return 'Value invalid', ''
    hours = 0
    minutes = 0
    seconds = 0
    invalid_value_count = 0
    if duration_format == 'h:mm':
        hours = time_parts[time_parts_len - 2]
        minutes = time_parts[time_parts_len - 1]
    else:
        hours = time_parts[time_parts_len - 3]
        minutes = time_parts[time_parts_len - 2]
        seconds = time_parts[time_parts_len - 1]

    try:
        hours = int(hours)
    except:
        invalid_value_count += 1
        hours = 0
    
    try:
        minutes = int(minutes)
    except:
        invalid_value_count += 1
        minutes = 0

    try:
        seconds = int(seconds)
    except:
        invalid_value_count += 1
        seconds = 0

    if invalid_value_count == 3:
        return 'Value invalid', ''
    
    result = hours * 3600 + minutes * 60 + seconds
    if is_negative:
        return '', -1 * result
    else:
        return '', result


CACHE_KEY_PREFIX_DTABLE_QUERY = 'DTABLE_QUERY_'
CACHE_TIMEOUT_DTABLE_QUERY = 60 * 60


class DTableDataSearchQueryView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def check_rate_limit(self, dtable_uuid):
        cache_key = normalize_cache_key(dtable_uuid, CACHE_KEY_PREFIX_DTABLE_QUERY)
        rate_cache = cache.get(cache_key)
        if not rate_cache:
            cache.set(cache_key, str(time.time()), timeout=CACHE_TIMEOUT_DTABLE_QUERY)
            return True
        times = rate_cache.split(',')
        if len(times) < DATA_SEARCH_MAX_QUERY_TIMES_PER_MINUTE:
            times.append(str(time.time()))
            cache.set(cache_key, ','.join(times), timeout=CACHE_TIMEOUT_DTABLE_QUERY)
            return True
        if time.time() - float(times[0]) < 60:
            return False
        times.append(str(time.time()))
        times = times[-DATA_SEARCH_MAX_QUERY_TIMES_PER_MINUTE:]
        cache.set(cache_key, ','.join(times), timeout=CACHE_TIMEOUT_DTABLE_QUERY)
        return True


    def post(self, request, app_uuid):
        # arguments check
        request_filters = request.data.get('filters')
        if not request_filters or not isinstance(request_filters, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'filters invalid')
        request_sort_by = request.data.get('sort_by')
        request_sort_type = request.data.get('sort_type', 'up')
        start = request.data.get('start', 0)
        limit = request.data.get('limit', 100)

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid, payload = is_valid_app_jwt(auth, app_uuid, return_payload=True)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        
        username = payload.get('username') or ''
        if username:
            id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
            id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

        # resource check
        external_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not external_app:
            return api_error(status.HTTP_404_NOT_FOUND, 'App not found')

        if external_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            app_config = json.loads(external_app.app_config)
        except:
            return api_error(status.HTTP_403_FORBIDDEN, 'app_config invalid')
        app_type = app_config.get('app_type')
        if app_type != 'sql-query':
            return api_error(status.HTTP_403_FORBIDDEN, 'app_type invalid')
        app_settings = app_config.get('settings')
        table_name = app_settings.get('table_name')
        view_name = app_settings.get('view_name')
        enable_sort_by_column = app_settings.get('enable_sort_by_column', False)
        sort_column_name = app_settings.get('sort_column_name', '')
        table_id = app_settings.get('table_id')
        view_id = app_settings.get('view_id')
        sort_column_key = app_settings.get('sort_column_key')
        columns_name = app_settings.get('columns_name')
        column_keys = app_settings.get('column_keys')
        un_shown_column_names = app_settings.get('un_shown_column_names')
        un_shown_column_keys = app_settings.get('un_shown_column_keys')
        sort_type = app_settings.get('sort_type', 'up')
        app_filters = app_settings.get('filters', [])
        if not table_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_id invalid')
        dtable_uuid = uuid_str_to_36_chars(external_app.dtable_uuid)
        # rate limit check
        if not self.check_rate_limit(dtable_uuid):
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, 'Too many requests')
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # request metadata
        metadata, error = get_metadata(str(dtable.uuid), app_uuid)
        if error:
            return error
        if table_id and not table_name:
            for tmp_table in metadata.get('tables', []):
                if tmp_table['_id'] == table_id:
                    table_name = tmp_table['name']
                    break
        table, view = None, None
        for tmp_table in metadata.get('tables', []):
            if tmp_table['name'] == table_name:
                table = tmp_table
                break
        if not table:
            return api_error(status.HTTP_404_NOT_FOUND, 'Table not found')
        if view_name and not view_id:
            for tmp_view in table.get('views', []):
                if tmp_view['name'] == view_name:
                    view_id = tmp_view['_id']
                    break
        if view_id:
            for tmp_view in table.get('views', []):
                if tmp_view['_id'] == view_id:
                    view = tmp_view
                    break
            if not view:
                return api_error(status.HTTP_404_NOT_FOUND, 'View not found')

        table_columns = get_columns(table, view)
        table_columns_dict = {col['key']: col for col in table_columns}

        if sort_column_key and not sort_column_name:
            sort_column = table_columns_dict.get(sort_column_key)
            if sort_column:
                sort_column_name = sort_column['name']
        if column_keys and not columns_name:
            columns_name = []
            for column_key in column_keys:
                tmp_column = table_columns_dict.get(column_key)
                if tmp_column:
                    columns_name.append(tmp_column['name'])
        if un_shown_column_keys and not un_shown_column_names:
            un_shown_column_names = []
            for un_shown_column_key in un_shown_column_keys:
                tmp_column = table_columns_dict.get(un_shown_column_key)
                if tmp_column:
                    un_shown_column_names.append(tmp_column['name'])
        if not un_shown_column_names:
            un_shown_column_names = []

        valid_columns_name = calculate_columns_name(table_columns, columns_name)
        shown_column_names = [ "`%s`" % column_name for column_name in valid_columns_name if column_name not in un_shown_column_names ]
        if len(shown_column_names) == 0:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Application configuration error')

        valid_request_filters = []
        for filter_item in request_filters:
            app_filter = None
            for app_filter_item in app_filters:
                if filter_item['column_key'] == app_filter_item['column_key']:
                    app_filter = app_filter_item
                    break
            if not app_filter:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Column %s not in config' % filter_item['column_key'])
            if app_filter['column_key'] not in table_columns_dict:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Column %s not in view or table' % app_filter['column_key'])
            app_filter_column = table_columns_dict[app_filter['column_key']]
            if app_filter_column['type'] not in SUPPORT_SEARCH_COLUMN_TYPES:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Column %s type invalid' % app_filter_column['name'])
            is_required = app_filter.get('is_required')
            is_empty = is_filter_empty(filter_item, app_filter_column)
            if is_empty:
                if is_required:
                    return api_error(status.HTTP_400_BAD_REQUEST, '%s missing' % app_filter_column['name'])
                continue
            valid_request_filters.append(filter_item)

        # view filter2sql
        filter_condition_groups = {
            'filter_groups': [],
            'group_conjunction': 'And'
        }
        if view:
            filters = view.get('filters', [])
            filter_conjunction = view.get('filter_conjunction', 'And')
            for item in filters:
                if item.get('filter_predicate') == 'include_me':
                    item['filter_term'].append(username)
                if item.get('filter_predicate') == 'is_current_user_ID':
                    item['filter_term'] = id_in_org
            filter_condition_groups['filter_groups'].append({
                'filters': filters,
                'filter_conjunction': filter_conjunction
            })
            filter_condition_groups['filter_groups'].append({
                'filters': valid_request_filters,
                'filter_conjunction': 'And'
            })
        else:
            filter_condition_groups['filter_groups'].append({
                'filters': valid_request_filters,
                'filter_conjunction': 'And'
            })

        # sort by
        if request_sort_by:
            filter_condition_groups['sorts'] = [{
                'column_name': request_sort_by,
                'sort_type': request_sort_type
            }]
        else:
            if enable_sort_by_column and sort_column_name:
                filter_condition_groups['sorts'] = [{
                    'column_name': sort_column_name,
                    'sort_type': sort_type
                }]

        # limit
        filter_condition_groups.update({
            'start': start,
            'limit': limit
        })
        import dtable_events
        try:
            sql = dtable_events.filter2sql(table_name, table['columns'], filter_condition_groups, by_group=True)
        except dtable_events.SQLGeneratorOptionInvalidError:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid option in single or multiple select columns')
        except dtable_events.DateTimeQueryInvalidError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid query in column %s' % e.column_name)
        except Exception as e:
            logger.exception(e)
            logger.error('app: %s filter_condition_groups: %s to sql error: %s', app_uuid, filter_condition_groups, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        sql = sql.replace('*', ', '.join(shown_column_names), 1)
        dtable_db_api = DTableDBAPI('data-search', dtable_uuid, INNER_DTABLE_DB_URL)
        try:
            rows = dtable_db_api.query(sql, convert=False)
        except Exception as e:
            logger.exception('query dtable: %s sql: %s error: %s', dtable_uuid, sql, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response(rows, status=status.HTTP_200_OK)


class DTableDataSearchMetadataView(APIView):
    authentication_classes = ()
    throttle_classes = (UserRateThrottle,)

    def get(self, request, app_uuid):
        # resource check
        external_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
        if not external_app:
            error_msg = 'app %s not found.' % app_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if external_app.inactive:
            error_msg = _('This app is not available')
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable_uuid = uuid_str_to_36_chars(external_app.dtable_uuid)
        app_config = json.loads(external_app.app_config)
        app_type = app_config.get('app_type')
        if app_type != 'sql-query':
            error_msg = 'app_type invalid.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()

        is_valid = is_valid_app_jwt(auth, app_uuid)
        if len(auth) != 2 or not is_valid:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        metadata, error = get_metadata(str(dtable.uuid), app_uuid)
        if error:
            return error

        return Response({'metadata': metadata})

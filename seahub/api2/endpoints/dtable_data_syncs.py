# -*- coding: utf-8 -*-
import logging
import json
import re
from datetime import timedelta
from email.utils import make_msgid

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.utils.translation import gettext as _

from seaserv import seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.constants import ColumnTypes
from seahub.dtable.models import DtableDataSyncs, DTables, BoundThirdPartyAccounts, ACCOUNT_TYPE_EMAIL
from seahub.dtable.utils import check_dtable_admin_permission, add_sync_email_task, add_plugin_email_send_email_task, \
    check_dtable_permission, query_dtable_data_sync_status, query_plugin_email_send_status
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.settings import SYNC_DATA_INTERVAL
from seahub.dtable.constants import EMAIL_SYNC_TABLES_DICT
from seahub.utils import get_inner_dtable_server_url, uuid_str_to_32_chars


logger = logging.getLogger(__name__)


class DTableDataSyncsView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, dtable_uuid):
        """get all dtable syncs by sync type
        """
        sync_type = request.GET.get('sync_type')
        if not sync_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'sync_type invalid.')

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            data_syncs = DtableDataSyncs.objects.get_data_sync_by_uuid(uuid_str_to_32_chars(dtable_uuid))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'data_sync_list': [data_sync.to_dict() for data_sync in data_syncs]})

    def post(self, request, dtable_uuid):
        """
        create a data sync
        """
        detail = request.data.get('detail')
        sync_type = request.data.get('sync_type')

        if not all([detail, sync_type]):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request.')

        if sync_type not in ['email']:
            return api_error(status.HTTP_400_BAD_REQUEST, 'sync_type invalid.')

        if not isinstance(detail, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'detail invalid.')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if sync_type == 'email':
            # check email table format
            try:
                dtable_server_url = get_inner_dtable_server_url()
                seatable = DTableServerAPI(request.user.username, dtable_uuid, dtable_server_url)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

            email_table_id = detail.get('email_table_id')
            link_table_id = detail.get('link_table_id')

            try:
                email_table, link_table, error_body, status_code = check_email_sync_tables(seatable, email_table_id, link_table_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            if error_body and status_code:
                if status_code == 400:
                    return api_error(status.HTTP_400_BAD_REQUEST, error_body)
                elif status_code == 404:
                    return api_error(status.HTTP_404_NOT_FOUND, error_body)

            detail.update({
                'email_table_id': email_table.get('_id'),
                'link_table_id': link_table.get('_id')
            })

        try:
            data_sync = DtableDataSyncs.objects.add_data_sync(uuid_str_to_32_chars(dtable_uuid), json.dumps(detail), sync_type)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({"data_sync": data_sync.to_dict()}, status=status.HTTP_200_OK)


class DTableDataSyncView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, dtable_uuid, data_sync_id):
        """update data sync
        """
        detail = request.data.get('detail')
        sync_type = request.data.get('sync_type')

        if not all([detail, sync_type]):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request.')

        if sync_type not in ['email']:
            return api_error(status.HTTP_400_BAD_REQUEST, 'sync_type invalid.')

        if not isinstance(detail, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'detail invalid.')

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if sync_type == 'email':
            # check email table format
            try:
                dtable_server_url = get_inner_dtable_server_url()
                seatable = DTableServerAPI(request.user.username, dtable_uuid, dtable_server_url)
            except Exception as e:
                logger.error(e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

            email_table_id = detail.get('email_table_id')
            link_table_id = detail.get('link_table_id')

            try:
                email_table, link_table, error_body, status_code = check_email_sync_tables(seatable, email_table_id, link_table_id)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

            if error_body and status_code:
                if status_code == 400:
                    return api_error(status.HTTP_400_BAD_REQUEST, error_body)
                elif status_code == 404:
                    return api_error(status.HTTP_404_NOT_FOUND, error_body)

            detail.update({
                'email_table_id': email_table.get('_id'),
                'link_table_id': link_table.get('_id')
            })

        try:
            data_sync = DtableDataSyncs.objects.get(id=data_sync_id, dtable_uuid=uuid_str_to_32_chars(str(dtable.uuid)))
            data_sync.sync_type = sync_type
            data_sync.detail = json.dumps(detail)
            data_sync.is_valid = True
            data_sync.consecutive_errors_times = 0
            data_sync.error_type = None
            data_sync.save()
        except DtableDataSyncs.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Data sync not found.')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'data_sync': data_sync.to_dict()})

    def delete(self, request, dtable_uuid, data_sync_id):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            dataSync = DtableDataSyncs.objects.filter(id=data_sync_id, dtable_uuid=uuid_str_to_32_chars(str(dtable.uuid)))
            dataSync.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class RunDtableDataSyncView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, dtable_uuid, data_sync_id):
        sync_type = request.data.get('sync_type')
        if not sync_type:
            error_msg = 'sync_type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        send_date = request.data.get('send_date')
        if not send_date:
            error_msg = 'send_date is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            data_sync = DtableDataSyncs.objects.get(id=data_sync_id, dtable_uuid=uuid_str_to_32_chars(dtable_uuid))
        except DtableDataSyncs.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Data sync not found.')

        if data_sync.last_sync_time and (timezone.now() - data_sync.last_sync_time) < timedelta(seconds=SYNC_DATA_INTERVAL):
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, _('Cannot sync too many times in a short time'))

        if sync_type == 'email':
            detail = json.loads(data_sync.detail)
            third_account_id = detail.get('third_account_id')
            email_table_id = detail.get('email_table_id')
            link_table_id = detail.get('link_table_id')
            if not all([third_account_id, email_table_id, link_table_id]):
                return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request.')

            context = {
                'data_sync_id': data_sync.id,
                'dtable_uuid': dtable_uuid,
                'repo_id': dtable.workspace.repo_id,
                'workspace_id': dtable.workspace.id,
                'detail': detail,
                'send_date': send_date,
                'username': request.user.username,
                'consecutive_errors_times': data_sync.consecutive_errors_times,
                'error_type': data_sync.error_type,
            }

            try:
                task_id = add_sync_email_task(context)
            except Exception as e:
                logger.error('add sync email error: %s', e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

            return Response({'task_id': task_id})


def get_non_duplicated_str(existed_strs, target_str):
    if not existed_strs:
        return target_str
    nos = []
    for s in existed_strs:
        re_target = r'%s\d+' % (re.escape(target_str),)
        if not re.match(re_target, s):
            continue
        nos.append(int(s[len(target_str):]))
    if not nos:
        return target_str + '1'
    nos.sort()
    for index, no in enumerate(nos, start=1):
        if index != no:
            return '%s%s' % (target_str, index)
    return '%s%s' % (target_str, nos[-1] + 1)


def get_table_by_seatable(seatable, table_name=None, table_id=None):
    if not table_name and not table_id:
        return None
    metadata = seatable.get_metadata()
    for table in metadata.get('tables', []):
        if table_name and table_name == table.get('name'):
            return table
        if table_id and table_id == table.get('_id'):
            return table
    return None


def create_table(seatable, table_name, lang='en', required_columns: list=None):
    """
    create table named table_name

    :param seatable: instance of SeaTableAPI
    :param table_name: name of new table
    :param required_columns: columns to be created when create table, list

    return table -> dict
    """
    metadata = seatable.get_metadata()
    fake_duplicated_table_names = [table.get('name') for table in metadata.get('tables') if table.get('name').startswith(table_name)]
    table_name = get_non_duplicated_str(fake_duplicated_table_names, table_name)
    columns = None
    if required_columns and isinstance(required_columns, list):
        columns = [{
            'column_name': required_column.get('column_name') or required_column.get('name'),
            'column_type': required_column.get('column_type') or required_column.get('type'),
            'column_data': required_column.get('column_data') or required_column.get('data')
        } for required_column in required_columns]
    return seatable.add_table(table_name, lang=lang, columns=columns)


def check_or_create_columns(seatable, table_id, required_columns=None, need_create=False):
    """
    check required columns are whether all are satified

    :param table_id: target table id
    :param required_columns: columns required to check
    :param need_create: if there are not required column(s) exist whether create them or not

    return: target_table -> dict or None, error_msg -> str or None
    """
    target_table = get_table_by_seatable(seatable, table_id=table_id)
    if not target_table:
        return None, 'Table %s not found.' % (table_id,)

    if not required_columns:
        return target_table, None

    # check all required columns exist or not
    columns_to_be_created = []
    for required_column in required_columns:
        required_column_name, required_column_type = required_column['column_name'], required_column['type']
        required_pass = False
        for col in target_table.get('columns'):
            if col.get('name') != required_column_name:
                continue
            if col.get('type') != required_column_type:
                return target_table, 'Type of column %s is not %s' % (required_column_name, required_column_type)
            else:
                required_pass = True
                break
        if required_pass:
            continue
        else:
            if need_create:
                columns_to_be_created.append(required_column)
            else:
                return target_table, 'Column %s not exists'

    if not need_create:
        return target_table, None

    # create columns
    for column in columns_to_be_created:
        column_type = column.get('type')
        column_name = column.get('column_name')
        column_data = column.get('data')
        seatable.insert_column(target_table.get('name'), column_name, column_type, column_data=column_data)

    return target_table, None


def check_email_sync_tables(seatable, email_table_id, link_table_id, lang='en'):
    """
    check tables about email-sync job

    We need specific columns with specific name and specific type exists in email_table and link_table in email-sync job.
    So, we wish tables strictly meet the condition.

    On the other hand, in order to facilitate user operation, we shoud allow the tables users pass don't meet these conditions.
    So, we should help user to check these conditions and create tables/columns to make tables meet there conditions to make programe work.

    Conditions:
        1. NOT email_table and NOT link_table
            1) create email_table and link_table and create required columns that doesn't exist in tables
            2) create the link column between them

        2. email_table and NOT link_table
            1) check email_table and create link_table
            2) create required columns that doesn't exist in tables and the link column between them

        3. NOT email_table and link_table
            1) check link_table and check whether Column `Emails` exists or not
            2) create email_table
            3) create required columns that doesn't exist in tables and the link column between them

        4. email_table and link_table
            1) check email_table and link_table
            2) check Column `Emails` in link_table exists or not
            3) create required columns that doesn't exist in tables

    :param seatable: instance of SeaTableAPI
    :param eamil_table_id: id of the table to fill emails
    :param link_table_id: id of the table to fill threads
    :param lang: user lang for creating table

    :return email_table -> dict or None, link_table -> dict or None, error_body -> dict or None, status_code -> int or None
    """
    if (email_table_id or link_table_id) and email_table_id == link_table_id:
        return None, None, {'error_msg': 'email_table_id or link_table_id invalid.'}, 400

    email_table_link_display_column = 'From'

    def reset_email_table_link_column(seatable, email_table, link_table):
        """
        Rename link column in email table to `Threads`.
        This is a soft function, which will not run when `Threads` column exists in email_table.

        Now only reset column name, display column hasn't been updated
        TODO: reset link column display column
        """
        new_email_table = get_table_by_seatable(seatable, table_id=email_table.get('_id'))
        target_column, target_index = None, None
        for index, col in enumerate(new_email_table.get('columns')):
            if col.get('name') == 'Threads':
                logger.info('`Threads` column exists in email table')
                return new_email_table
            if col.get('type') != ColumnTypes.LINK:
                continue
            if col['data'].get('table_id') != link_table.get('_id') or col['data'].get('other_table_id') != email_table.get('_id'):
                continue
            target_column = col
            target_index = index
        seatable.rename_column(email_table.get('name'), target_column.get('key'), 'Threads')
        new_email_table['columns'][target_index]['name'] = 'Threads'
        return new_email_table

    if not email_table_id and not link_table_id:
        # create email table
        email_table = create_table(seatable, 'Emails', lang=lang, required_columns=EMAIL_SYNC_TABLES_DICT['email_table'])
        # create link table
        link_table = create_table(seatable, 'Threads', lang=lang, required_columns=EMAIL_SYNC_TABLES_DICT['link_table'])
        # create link column between both tables
        seatable.insert_column(link_table.get('name'), 'Emails', ColumnTypes.LINK, column_data={
            'table': link_table.get('name'),
            'other_table': email_table.get('name'),
            'display_column_name': email_table_link_display_column
        })
        # reset link column in email_table
        email_table = reset_email_table_link_column(seatable, email_table, link_table)
    elif email_table_id and not link_table_id:
        # check email table
        email_table, error_msg = check_or_create_columns(seatable, email_table_id)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 404
        # create link table
        link_table = create_table(seatable, 'Threads', lang=lang, required_columns=EMAIL_SYNC_TABLES_DICT['link_table'])
        # create email table columns
        email_table, error_msg = check_or_create_columns(seatable, email_table.get('_id'), EMAIL_SYNC_TABLES_DICT['email_table'], True)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 400
        # create link column between both tables
        seatable.insert_column(link_table.get('name'), 'Emails', ColumnTypes.LINK, column_data={
            'table': link_table.get('name'),
            'other_table': email_table.get('name'),
            'display_column_name': email_table_link_display_column
        })
        # reset link column in email_table
        email_table = reset_email_table_link_column(seatable, email_table, link_table)
    elif not email_table_id and link_table_id:
        # check link table
        link_table, error_msg = check_or_create_columns(seatable, link_table_id)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 404
        # check Emails column exists or not before create email table
        for col in link_table.get('columns'):
            if col.get('name') == 'Emails':
                return None, None, {'error_msg': 'Column `Emails` exists.'}, 400
        if error_msg:
            return None, None, {'error_msg': error_msg}, 404
        # create email table
        email_table = create_table(seatable, 'Emails', lang=lang, required_columns=EMAIL_SYNC_TABLES_DICT['email_table'])
        # create link table columns
        link_table, error_msg = check_or_create_columns(seatable, link_table.get('_id'), EMAIL_SYNC_TABLES_DICT['link_table'], True)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 400
        # create link column between both tables
        seatable.insert_column(link_table.get('name'), 'Emails', ColumnTypes.LINK, column_data={
            'table': link_table.get('name'),
            'other_table': email_table.get('name'),
            'display_column_name': email_table_link_display_column
        })
        # reset link column in email_table
        email_table = reset_email_table_link_column(seatable, email_table, link_table)
    else:
        # check email table
        email_table, error_msg = check_or_create_columns(seatable, email_table_id)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 404
        # check link table
        link_table, error_msg = check_or_create_columns(seatable, link_table_id)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 404
        # create link column between both tables
        link_column_exists = False
        for col in link_table.get('columns'):
            if col.get('name') != 'Emails':
                continue
            if col.get('type') != ColumnTypes.LINK:
                return None, None, {'error_msg': 'Column `Emails` exists.'}, 400
            if col['data'].get('other_table_id') != email_table.get('_id'):
                return None, None, {'error_msg': 'Column `Emails` exists and its link column is not for email table.'}, 400
            link_column_exists = True
            break
        # create email table columns
        email_table, error_msg = check_or_create_columns(seatable, email_table.get('_id'), EMAIL_SYNC_TABLES_DICT['email_table'], True)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 400
        # create link table columns
        link_table, error_msg = check_or_create_columns(seatable, link_table.get('_id'), EMAIL_SYNC_TABLES_DICT['link_table'], True)
        if error_msg:
            return None, None, {'error_msg': error_msg}, 400
        if not link_column_exists:
            seatable.insert_column(link_table.get('name'), 'Emails', ColumnTypes.LINK, column_data={
                'table': link_table.get('name'),
                'other_table': email_table.get('name'),
                'display_column_name': email_table_link_display_column
            })
        # reset link column in email_table
        email_table = reset_email_table_link_column(seatable, email_table, link_table)

    return email_table, link_table, None, None


class DTableDataSyncStatus(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """
        Get task status by task id
        :param request:
        :return:
        """

        task_id = request.GET.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        resp = query_dtable_data_sync_status(task_id)

        if resp.status_code == 400:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not resp.ok:
            logger.error(resp.content)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        resp_info = json.loads(resp.content)
        is_finished = resp_info['is_finished']

        return Response({'is_finished': is_finished})


class DTablePluginEmailSendStatus(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """
        Get task status by task id
        :param request:
        :return:
        """

        task_id = request.GET.get('task_id', '')
        if not task_id:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        resp = query_plugin_email_send_status(task_id)

        if resp.status_code == 400:
            error_msg = 'task_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not resp.ok:
            logger.error(resp.content)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        resp_info = json.loads(resp.content)
        is_finished = resp_info['is_finished']

        return Response({'is_finished': is_finished})


class DtablePluginEmailSendEmail(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, dtable_uuid):
        email_info = request.data.get('email_info', {})
        table_info = request.data.get('table_info', {})
        account_name = request.data.get('account_name', '')

        send_to = email_info.get('send_to')
        subject = email_info.get('subject')

        text_message = email_info.get('text_message')
        html_message = email_info.get('html_message')
        if not all([send_to, subject, (text_message or html_message)]):
            error_msg = 'email_info is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        thread_row_id = table_info.get('thread_row_id')
        email_row_id = table_info.get('email_row_id')
        email_table_name = table_info.get('email_table_name')
        thread_table_name = table_info.get('thread_table_name')
        if not all([thread_row_id, email_row_id, email_table_name, thread_table_name]):
            error_msg = 'email_info is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library does not exist'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        org_id = request.user.org and request.user.org.org_id or None
        if not check_dtable_permission(username, dtable.workspace, dtable, org_id=org_id):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        email_account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str_to_32_chars(dtable_uuid), account_name)
        if not email_account:
            error_msg = 'Account does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if email_account.account_type != ACCOUNT_TYPE_EMAIL:
            error_msg = 'Account type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        account_detail = email_account.to_dict().get('detail', {})
        host_user = account_detail.get('host_user', '')
        email_info['from'] = host_user.split('@')[0] + ' <' + host_user + '>'

        message_id = make_msgid(domain='seatable.com')
        email_info['message_id'] = message_id

        params = {
            'account_id': email_account.pk,

            'username': username,
            'dtable_uuid': dtable_uuid,
            'repo_id': dtable.workspace.repo_id,
            'workspace_id': dtable.workspace.id,

            'email_info': email_info,
            'table_info': table_info,
        }

        try:
            task_id = add_plugin_email_send_email_task(params)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
        return Response({'task_id': task_id})

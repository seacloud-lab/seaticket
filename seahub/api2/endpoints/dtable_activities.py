# -*- coding: utf-8 -*-
import time
import logging
from datetime import datetime, timedelta

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from django.core.cache import cache

from seaserv import ccnet_api

from seahub.api2.utils import api_error
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.authentication import TokenAuthentication
from seahub.avatar.templatetags.avatar_tags import api_avatar_url, api_app_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.dtable.models import Workspaces, DTables, DTableShare, DTableGroupShare
from seahub.group.utils import get_user_groups
from seahub.utils import DTABLE_EVENTS_ENABLED, get_table_activities, get_table_activities_detail, \
    uuid_str_to_36_chars, uuid_str_to_32_chars, is_org_context
from seahub.utils.timeutils import utc_datetime_to_isoformat_timestr
from seahub.constants import PERMISSION_PREFIX

logger = logging.getLogger(__name__)

try:
    TO_TZ = time.strftime('%z')[:3] + ':' + time.strftime('%z')[3:]
except Exception as error:
    TO_TZ = '+00:00'


class DTableActivitiesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        if not DTABLE_EVENTS_ENABLED:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Events not enabled.')

        try:
            page = int(request.GET.get('page', ''))
        except ValueError:
            page = 1

        try:
            per_page = int(request.GET.get('per_page', ''))
        except ValueError:
            per_page = 25

        start = (page - 1) * per_page
        count = per_page

        days = 7

        # to_tz eg: +08:00
        to_tz = request.GET.get('to_tz', TO_TZ)

        username = request.user.username
        uuid_list = cache.get('activities_%s' % username)
        if not uuid_list:
            groups = get_user_groups(username, return_ancestors=True)

            owner_list = [username] + ['%s@seafile_group' % group.id for group in groups]
            group_id_list = [group.id for group in groups]

            workspaces = Workspaces.objects.filter(owner__in=owner_list)
            dtable_list = DTables.objects.filter(
                workspace__in=workspaces, deleted=False).select_related('workspace')
            shared_to_user_tables = DTableShare.objects.filter(
                to_user=username, dtable__deleted=False).select_related('dtable')
            shared_to_group_tables = DTableGroupShare.objects.filter(
                group_id__in=group_id_list, dtable__deleted=False).select_related('dtable')

            uuid_list = [table.uuid.hex for table in dtable_list]
            uuid_list.extend([table.dtable.uuid.hex for table in shared_to_user_tables
                              if PERMISSION_PREFIX not in table.permission])
            uuid_list.extend([table.dtable.uuid.hex for table in shared_to_group_tables
                              if PERMISSION_PREFIX not in table.permission])
            cache.set('activities_%s' % username, uuid_list, 24 * 60 * 60)

        try:
            activities = get_table_activities(uuid_list, days, start, count, to_tz)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dtable_uuid_map = dict()
        dtable_uuid_list = list()
        for activity in activities:
            if activity.dtable_uuid not in dtable_uuid_list:
                dtable_uuid_list.append(activity.dtable_uuid)

        if dtable_uuid_list:
            dtables = DTables.objects.filter(uuid__in=dtable_uuid_list, deleted=False)
            for dtable in dtables:
                dtable_uuid_map[dtable.uuid.hex] = \
                    {"name": dtable.name, "icon": dtable.icon, "color": dtable.color, "workspace_id": dtable.workspace_id}

        table_activities = []
        for activity in activities:
            if activity.insert_row == activity.modify_row == activity.delete_row == 0:
                continue
            activity_dict = dict(dtable_uuid=uuid_str_to_36_chars(activity.dtable_uuid))
            dtable_obj = dtable_uuid_map.get(activity.dtable_uuid, "")
            activity_dict['workspace_id'] = dtable_obj['workspace_id'] if dtable_obj else ''
            activity_dict['dtable_name'] = dtable_obj['name'] if dtable_obj and dtable_obj['name'] else ''
            activity_dict['dtable_icon'] = dtable_obj['icon'] if dtable_obj and dtable_obj['icon'] else ''
            activity_dict['dtable_color'] = dtable_obj['color'] if dtable_obj and dtable_obj['color'] else ''
            activity_dict['op_date'] = utc_datetime_to_isoformat_timestr(activity.op_date)
            activity_dict['insert_row'] = activity.insert_row
            activity_dict['modify_row'] = activity.modify_row
            activity_dict['delete_row'] = activity.delete_row

            table_activities.append(activity_dict)

        return Response({'table_activities': table_activities})


class DTableActivitiesDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        if not DTABLE_EVENTS_ENABLED:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Events not enabled.')

        dtable_uuid = request.GET.get('dtable_uuid', None)
        if not dtable_uuid:
            error_msg = 'dtable_uuid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        dtable_uuid = uuid_str_to_32_chars(dtable_uuid)

        op_date = request.GET.get('op_date', None)
        if not op_date:
            error_msg = 'op_date invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            # op_date eg: 2023-05-16T07:30:49+08:00
            op_date_format = datetime.strptime(op_date, '%Y-%m-%dT%H:%M:%S%z')
            to_tz = op_date[-6:]
            start_time = op_date_format.replace(hour=0, minute=0, second=0, tzinfo=None)
            end_time = start_time + timedelta(days=1)
        except Exception as e:
            logger.error(e)
            error_msg = 'op_date invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            page = int(request.GET.get('page', ''))
        except ValueError:
            page = 1

        try:
            per_page = int(request.GET.get('per_page', ''))
        except ValueError:
            per_page = 25
        start, count = (page - 1) * per_page, per_page

        try:
            activities_detail = get_table_activities_detail(
                dtable_uuid, start_time, end_time, start, count, to_tz)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        activities = []
        for activity in activities_detail:
            activity_dict = dict(dtable_uuid=uuid_str_to_36_chars(activity.dtable_uuid))
            activity_dict['row_id'] = activity.row_id
            activity_dict['op_type'] = activity.op_type
            activity_dict['author_email'] = activity.op_user
            activity_dict['author_name'] = email2nickname(activity.op_user)
            activity_dict['author_contact_email'] = email2contact_email(activity.op_user)
            activity_dict['op_time'] = utc_datetime_to_isoformat_timestr(activity.op_time)
            activity_dict['table_id'] = activity.table_id
            activity_dict['table_name'] = activity.table_name
            activity_dict['row_count'] = getattr(activity, 'row_count', 1)  # compatible with previous data
            activity_dict['row_name'] = getattr(activity, "row_name", "")  # compatible with previous data
            activity_dict['row_name_option'] = getattr(activity, 'row_name_option', '')  # compatible with previous data
            activity_dict['row_data'] = activity.row_data
            activity_dict['op_app'] = activity.op_app

            url, is_default, date_uploaded = api_avatar_url(activity.op_user)
            activity_dict['avatar_url'] = url

            if activity_dict['op_app']:
                activity_dict['app_avatar_url'] = api_app_avatar_url()[0]

            activities.append(activity_dict)

        return Response({'activities': activities})

# Copyright (c) 2012-2016 Seafile Ltd.
import json
import logging
import re

import jwt
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from django.core.cache import cache

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable_apps.universal_app.models import DTableAppNotifications
from seahub.dtable_apps.universal_app.utils import check_app_user
from seahub.dtable_apps.workflow.models import DTableWorkflowTasks
from seahub.notifications.models import MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED, MSG_TYPE_LICENSE_EXPIRING, \
    UserNotification, SysUserNotification, get_cache_key_of_unseen_notifications
from seahub.notifications.utils import update_notice_detail
from seahub.profile.models import Profile
from seahub.settings import DTABLE_PRIVATE_KEY
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.dtable.models import DTables, DTableNotifications, DTableExternalApps
from seahub.dtable.utils import check_dtable_permission

logger = logging.getLogger(__name__)
json_content_type = 'application/json; charset=utf-8'



def get_dtable_notifications(username):
    notification_sql = """
    SELECT
        `id`,
        dtable_uuid,
        COUNT(1) as `unseen_count`
    FROM
        dtable_notifications 
    WHERE 
        username = %s AND
        seen = 0
    GROUP BY
        dtable_uuid
    """

    notifications = DTableNotifications.objects.raw(notification_sql, (username, ))
    dtable_uuids = [n.dtable_uuid for n in notifications]

    dtable_query = DTables.objects.filter(uuid__in=dtable_uuids)
    uuid_dtable_map = {
        d.uuid.hex: d for d in dtable_query
    }

    dtable_notification_details = []
    global_total_count, global_unseen_count = 0, 0
    for notice in notifications:
        dtable_uuid = notice.dtable_uuid
        dtable = uuid_dtable_map.get(dtable_uuid)
        if not dtable:
            continue
        unseen_count = notice.unseen_count
        detail = {
            'dtable_uuid': dtable_uuid,
            'unseen_count': unseen_count,
            'workspace_id': dtable.workspace_id,
            'dtable_name': dtable.name,
            'dtable_icon': dtable.icon,
            'dtable_color': dtable.color,
        }
        dtable_notification_details.append(detail)
        global_unseen_count += unseen_count

    dtable_notifications = {
        "unseen_count": global_unseen_count,
        "details": dtable_notification_details
    }

    return dtable_notifications, global_unseen_count

def get_app_notificaitons(app_username):
    notification_sql = """
        SELECT
            `id`,
            app_id,
            COUNT(1) as `unseen_count`
        FROM
            dtable_app_notifications 
        WHERE 
            to_user = %s AND
            seen = 0
        GROUP BY
            app_id
        """

    notifications = DTableAppNotifications.objects.raw(notification_sql, (app_username, ))
    app_ids = [n.app_id for n in notifications]

    app_query = DTableExternalApps.objects.filter(pk__in=app_ids)
    uuid_app_map = {
        d.pk: d for d in app_query
    }

    dtable_app_notification_details = []
    global_total_count, global_unseen_count = 0, 0
    for notice in notifications:
        app_id = notice.app_id
        app = uuid_app_map.get(app_id)
        if not app:
            continue
        unseen_count = notice.unseen_count
        detail = {
            'app_uuid': app.app_uuid,
            'unseen_count': unseen_count,
            'app_name': app.app_name,
            'app_icon': json.loads(app.app_config).get('app_icon'),
            'use_custom_icon': json.loads(app.app_config).get('use_custom_icon'),
            'icon_class_name': json.loads(app.app_config).get('icon_class_name'),
            'app_link': app.custom_link or app.link
        }
        dtable_app_notification_details.append(detail)
        global_unseen_count += unseen_count

    dtable_app_notifications = {
        "unseen_count": global_unseen_count,
        "details": dtable_app_notification_details
    }

    return dtable_app_notifications, global_unseen_count

def get_user_notifications(username, page=1, per_page=25):
    start = (page - 1) * per_page
    end = page * per_page

    notice_list = UserNotification.objects.get_user_notifications(username)[start:end]
    result_notices = update_notice_detail(notice_list)
    notification_list = []
    for i in result_notices:
        if i.detail is not None:
            notice = {}
            notice['id'] = i.id
            notice['type'] = i.msg_type
            notice['detail'] = i.detail
            notice['time'] = datetime_to_isoformat_timestr(i.timestamp)
            notice['seen'] = i.seen
            notification_list.append(notice)

    total_count = UserNotification.objects.filter(to_user=username).count()
    unseen_count = UserNotification.objects.filter(to_user=username, seen=False).count()

    user_notifications = {
        "total_count": total_count,
        "unseen_count": unseen_count,
        "details": notification_list
    }

    return user_notifications, unseen_count


class NotificationsCenterView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        try:
            username = request.user.username
            user_notifications, user_unseen_count = get_user_notifications(username)
            app_notifications, app_unseen_count = get_app_notificaitons(username)
            dtable_notifications, dtable_unseen_count = get_dtable_notifications(username)

            result = {
                'unseen_count': user_unseen_count + app_unseen_count + dtable_unseen_count,
                'user_notifications': user_notifications,
                'dtable_notifications': dtable_notifications,
                'app_notifications': app_notifications
            }
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response(result)

class NotificationsView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        result = {}

        username = request.user.username

        try:
            per_page = int(request.GET.get('per_page', ''))
            page = int(request.GET.get('page', ''))
        except ValueError:
            per_page = 25
            page = 1

        notification_list, unseen_count = get_user_notifications(username, page, per_page)
        cache_key = get_cache_key_of_unseen_notifications(username)
        count_from_cache = cache.get(cache_key, None)

        if count_from_cache is not None:
            result['unseen_count'] = count_from_cache
            unseen_num = count_from_cache
        else:
            result['unseen_count'] = unseen_count
            # set cache
            cache.set(cache_key, unseen_count)
            unseen_num = unseen_count

        result['notification_list'] = notification_list['details']
        result['count'] = notification_list['total_count']
        result['unseen_count'] = unseen_num

        return Response(result)

    def put(self, request):
        """ currently only used for mark all notifications seen

        Permission checking:
        1. login user.
        """
        notice_type = request.data.get('notice_type')
        if (not notice_type) or notice_type not in ('base', 'app', 'user'):
            error_msg = 'notice_type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        username = request.user.username
        try:
            if notice_type == 'base':
                DTableNotifications.objects.filter(
                    username = username,
                    seen = False
                ).update(seen=True)

            if notice_type == 'app':
                DTableAppNotifications.objects.filter(
                    to_user = username,
                    seen = False
                ).update(seen=True)

            if notice_type == 'user':
                UserNotification.objects.filter(
                    to_user = username,
                    seen = False
                ).update(seen=True)
                cache_key = get_cache_key_of_unseen_notifications(username)
                cache.delete(cache_key)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

    def delete(self, request):
        """
        remove all user notifications
        """
        try:
            UserNotification.objects.remove_user_notifications(request.user.username)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class InternalNotificationsView(APIView):
    authentication_classes = ()
    permission_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        # arguments check
        to_users = request.data.get('to_users')
        if not to_users or not isinstance(to_users, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'to_users invalid')
        notification_type = request.data.get('type')
        if notification_type not in [MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED, MSG_TYPE_LICENSE_EXPIRING]:
            return api_error(status.HTTP_400_BAD_REQUEST, 'type invalid')
        detail = request.data.get('detail')
        if not detail or not isinstance(detail, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'detail invalid')
        if notification_type == MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED:
            token = detail.get('token')
            if not token:
                return api_error(status.HTTP_400_BAD_REQUEST, 'token of detail invalid')
            task_id = detail.get('task_id')
            if not task_id:
                return api_error(status.HTTP_400_BAD_REQUEST, 'task_id of detail invalid')
            offset = detail.get('offset')
            if not re.match(r'^\+\d+[dh]$', str(offset)):
                return api_error(status.HTTP_400_BAD_REQUEST, 'offset of detail invalid')
        elif notification_type == MSG_TYPE_LICENSE_EXPIRING:
            try:
                days = int(detail.get('days'))
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'days of detail invalid')
            if days <= 0:
                return api_error(status.HTTP_400_BAD_REQUEST, 'days of detail invalid')

        # permission check
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if len(auth) != 2:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        try:
            jwt.decode(auth[1], DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        except:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # resource check
        valid_users = list(Profile.objects.filter(user__in=to_users).values_list('user', flat=True))
        if len(valid_users) != len(to_users):
            return api_error(status.HTTP_400_BAD_REQUEST, 'There are invalid users in to_users')
        if notification_type == MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED:
            workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
            if not workflow_task:
                return api_error(status.HTTP_404_NOT_FOUND, 'Task not found')

        # main
        json_detail = json.dumps(detail)
        for user in to_users:
            if notification_type == MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED:
                UserNotification.objects.add_workflow_task_processing_expired_message(user, json_detail)
            elif notification_type == MSG_TYPE_LICENSE_EXPIRING:
                UserNotification.objects.add_license_expiring_message(user, json_detail)

        return Response({'success': True})

class NotificationView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request):
        """ currently only used for mark a notification seen

        Permission checking:
        1. login user.
        """

        notice_id = request.data.get('notice_id')

        # argument check
        try:
            int(notice_id)
        except Exception as e:
            error_msg = 'notice_id invalid.'
            logger.error(e)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        try:
            notice = UserNotification.objects.get(id=notice_id)
        except UserNotification.DoesNotExist as e:
            logger.error(e)
            error_msg = 'Notification %s not found.' % notice_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if notice.to_user != username:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not notice.seen:
            notice.seen = True
            notice.save()

        cache_key = get_cache_key_of_unseen_notifications(username)
        cache.delete(cache_key)

        return Response({'success': True})

class SysUserNotificationUnseenView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        get the unseen sys-user-notifications by login user
        """
        username = request.user.username
        notifications = SysUserNotification.objects.unseen_notes(username)
        return Response({
            'notifications': [n.to_dict() for n in notifications],
        })

class SysUserNotificationSeenView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, nid):
        """
        mark a sys-user-notification seen by login user

        Permission checking:
        1. login user.
        """
        # arguments check
        username = request.user.username
        try:
            nid = int(nid)
        except ValueError:
            error_msg = 'nid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if nid <= 0:
            error_msg = 'nid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resouce check
        notification = SysUserNotification.objects.filter(id=nid).first()
        if not notification:
            error_msg = 'notification %s not found.' % nid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if notification.to_user != username:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # set notification to seen
        try:
            notification.update_notification_to_seen()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'notification': notification.to_dict()})

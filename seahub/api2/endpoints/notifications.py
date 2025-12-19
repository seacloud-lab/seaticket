# -*- coding: utf-8 -*-
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.notifications.models import ProjectNotification, UserNotification
from seahub.project.models import Projects
from seahub.notifications.utils import get_user_notifications

logger = logging.getLogger(__name__)


class NotificationsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """ 
        general notifications
        """
        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '20'))
        except ValueError:
            page = 1
            per_page = 20

        if page < 1:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page invalid.')
        if per_page < 1:
            return api_error(status.HTTP_400_BAD_REQUEST, 'per_page invalid.')
        
        username = request.user.username
        user_notifications = get_user_notifications(username, page, per_page)
        return Response(user_notifications)
    

    def put(self, request):
        """Mark all notifications as read for current user."""
        username = request.user.username
        try:
            UserNotification.objects.get_user_notifications(username, seen=False).update(seen=True)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})

    def delete(self, request):
        """Clear all notifications for current user."""
        username = request.user.username
        try:
            UserNotification.objects.filter(to_user=username).delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class NotificationView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, notification_id):
        """Mark a notification as read."""
        username = request.user.username
        try:
            notice = UserNotification.objects.get(id=notification_id, to_user=username)
        except UserNotification.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Notification not found.')

        if not notice.seen:
            notice.seen = True
            notice.save()
        return Response({'success': True})


class ProjectNotificationsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, project_uuid):
        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '20'))
        except ValueError:
            page = 1
            per_page = 20

        if page < 1:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page invalid.')
        if per_page < 1:
            return api_error(status.HTTP_400_BAD_REQUEST, 'per_page invalid.')

        username = request.user.username
        start = (page - 1) * per_page
        end = start + per_page

        project_notifications = ProjectNotification.objects.filter(project_uuid=project_uuid, to_user=username).order_by('-timestamp')
        count = project_notifications.count()
        unseen_count = project_notifications.filter(seen=False).count()

        notification_list = [notification.to_dict() for notification in project_notifications[start:end]]

        return Response({
            'notification_list': notification_list,
            'count': count,
            'unseen_count': unseen_count,
        })

    def put(self, request, project_uuid):
        username = request.user.username
        try:
            ProjectNotification.objects.mark_all_read_by_project(project_uuid, username)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class ProjectNotificationView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def put(self, request, notification_id):
        username = request.user.username
        notice = ProjectNotification.objects.mark_as_read(notification_id, username)
        if not notice:
            return api_error(status.HTTP_404_NOT_FOUND, 'Notification not found.')
        return Response({'success': True})


class NotificationsAllView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            page = 1
            per_page = 25

        if page < 1:
            return api_error(status.HTTP_400_BAD_REQUEST, 'page invalid.')
        if per_page < 1:
            return api_error(status.HTTP_400_BAD_REQUEST, 'per_page invalid.')

        username = request.user.username
        user_notifications = UserNotification.objects.get_user_notifications(username)
        project_notifications = ProjectNotification.objects.filter(to_user=username).order_by('-timestamp')
        notification_list = []
        for user_notification in user_notifications:
            if user_notification.detail is not None:
                notice = user_notification.to_dict()
                notification_list.append(notice)
        project_stats_by_uuid = {}
        for project_notification in project_notifications:
            project_uuid = project_notification.project_uuid
            if project_uuid not in project_stats_by_uuid:
                project_stats_by_uuid[project_uuid] = {
                    'project_uuid': project_uuid,
                    'unseen_count': 0,
                    'count': 0,
                }

            project_stats_by_uuid[project_uuid]['count'] += 1
            if not project_notification.seen:
                project_stats_by_uuid[project_uuid]['unseen_count'] += 1

        result = {
            'general': {},
            'project': {}
        }
        unseen_count = UserNotification.objects.get_user_notifications(username, seen=False).count()
        result['general']['unseen_count'] = unseen_count

        total_count = UserNotification.objects.get_user_notifications(username).count()
        project_total_count = ProjectNotification.objects.filter(to_user=username).count()

        project_group_list = list(project_stats_by_uuid.values())
        project_uuids = [i.get('project_uuid') for i in project_group_list if i.get('project_uuid')]
        projects_by_uuid = {}
        try:
            projects = Projects.objects.filter(uuid__in=project_uuids)
            projects_by_uuid = {str(p.uuid): p for p in projects}
        except Exception as e:
            logger.error(e)

        for item in project_group_list:
            project = projects_by_uuid.get(item.get('project_uuid'))
            if project:
                item['project_name'] = project.project_name
                item['workspace_id'] = project.workspace_id
                item['project_icon'] = project.icon
                item['project_color'] = project.color
        project_unseen_count = sum(i['unseen_count'] for i in project_group_list)
        result['project']['unseen_count'] = project_unseen_count

        result['general']['notification_list'] = notification_list
        result['general']['count'] = total_count
        result['project']['count'] = project_total_count
        result['project']['project_list'] = project_group_list
        result['total_unseen_count'] = result['general']['unseen_count'] + result['project']['unseen_count']

        return Response(result)

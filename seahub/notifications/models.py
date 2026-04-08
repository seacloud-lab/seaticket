import json
import logging

from django.db import models

from seahub.base.fields import LowerCaseCharField

logger = logging.getLogger(__name__)


# user notification
class UserNotificationManager(models.Manager):
    def get_user_notifications(self, username, seen=None):
        """Get all notifications of a user."""
        user_notifications = super(UserNotificationManager, self).filter(to_user=username)
        if seen is not None:
            user_notifications = user_notifications.filter(seen=seen)
        return user_notifications


class UserNotification(models.Model):
    to_user = LowerCaseCharField(db_index=True, max_length=255)
    msg_type = models.CharField(max_length=30)
    detail = models.TextField()
    timestamp = models.DateTimeField(db_index=True, auto_now_add=True)
    seen = models.BooleanField(default=False)
    objects = UserNotificationManager()

    class InvalidDetailError(Exception):
        pass

    class Meta:
        ordering = ["-timestamp"]
        db_table = 'user_notifications'

    def to_dict(self):
        try:
            detail = json.loads(self.detail) if self.detail else {}
        except Exception:
            detail = {}
        return {
            'id': self.pk,
            'msg_type': self.msg_type,
            'detail': detail,
            'time': self.timestamp,
            'seen': self.seen,
        }


# project notifications
class ProjectNotificationManager(models.Manager):
    def add_project_notification(self, project_uuid, to_user, msg_type, detail):
        n = super(ProjectNotificationManager, self).create(
            project_uuid=project_uuid, to_user=to_user, msg_type=msg_type, detail=detail)
        n.save()
        return n

    def mark_as_read(self, notification_id, username):
        try:
            notice = super(ProjectNotificationManager, self).get(id=notification_id, to_user=username)
        except ProjectNotification.DoesNotExist:
            return None
        if not notice.seen:
            notice.seen = True
            notice.save()
        return notice

    def mark_all_read_by_project(self, project_uuid, username):
        return self.filter(project_uuid=project_uuid, to_user=username, seen=False).update(seen=True)
    
    def mark_read_by_project_ticket(self, project_uuid, username, ticket_id):
        notices = self.filter(project_uuid=project_uuid, to_user=username, seen=False, msg_type__contains='ticket_')
        unseen_count = 0
        for notice in notices:
            notice_dict = notice.to_dict()
            notice_detail = notice_dict.get('detail', {})
            notice_ticket_id = notice_detail.get('ticket_id', None)
            if str(notice_ticket_id) == str(ticket_id):
                notice.seen = True
                notice.save()
                unseen_count = unseen_count + 1
        return unseen_count


class ProjectNotification(models.Model):
    project_uuid = models.CharField(max_length=36)
    to_user = models.CharField(db_index=True, max_length=255)
    msg_type = models.CharField(max_length=36)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    detail = models.TextField()
    seen = models.BooleanField(db_index=True, default=False)

    objects = ProjectNotificationManager()

    class Meta:
        db_table = 'project_notification'

    def to_dict(self):
        try:
            detail = json.loads(self.detail) if self.detail else {}
        except Exception:
            detail = {}
        return {
            'id': self.pk,
            'project_uuid': self.project_uuid,
            'to_user': self.to_user,
            'msg_type': self.msg_type,
            'time': self.timestamp,
            'detail': detail,
            'seen': self.seen,
        }

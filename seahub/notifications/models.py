import json
import logging

from django.db import models
from django.dispatch import receiver

from seahub.base.fields import LowerCaseCharField
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.group.models import Group
from seahub.group.signals import add_user_to_group
from seahub.tickets.signals import ticket_assignees_added, ticket_commented
from seahub.notifications.utils import ticket_assignee_added_msg_to_json, ticket_comment_msg_to_json

logger = logging.getLogger(__name__)

MSG_TYPE_TICKET_ASSIGNEE_ADDED = 'ticket_assignee_added'
MSG_TYPE_TICKET_COMMENTED = 'ticket_commented'
MSG_TYPE_ADD_USER_TO_GROUP = 'add_user_to_group'

########## user notification
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


@receiver(add_user_to_group)
def add_user_to_group_msg_cb(sender, **kwargs):
    group_staff = kwargs.get('group_staff', None)
    group_id = kwargs.get('group_id', None)
    added_user = kwargs.get('added_user', None)

    if not added_user or not group_staff or group_id is None:
        logger.warning("Invalid add user to group signal kwargs: %s", kwargs)
        return

    if added_user == group_staff:
        return

    group_name = ''
    try:
        group = Group.objects.get_group(int(group_id))
        if group:
            group_name = group.group_name
    except Exception as e:
        logger.error(e)

    detail = {
        'group_staff_email': group_staff,
        'group_staff_name': email2nickname(group_staff),
        'group_id': group_id,
        'group_name': group_name,
    }

    try:
        UserNotification.objects.create(
            to_user=added_user,
            msg_type=MSG_TYPE_ADD_USER_TO_GROUP,
            detail=json.dumps(detail),
        )
    except Exception as e:
        logger.error(e)


@receiver(ticket_assignees_added)
def add_ticket_assignees_added_project_msg_cb(sender, **kwargs):
    project_uuid = kwargs.get('project_uuid', None)
    assignees = kwargs.get('assignees', None) or []
    msg_type = kwargs.get('msg_type', None)
    from_user_id = kwargs.get('from_user_id', None)
    workspace_id = kwargs.get('workspace_id', None)
    project_name = kwargs.get('project_name', None)
    ticket_id = kwargs.get('ticket_id', None)
    ticket_title = kwargs.get('ticket_title', None)

    if any([not project_uuid, not msg_type, not from_user_id,
            not ticket_title, not ticket_id]):
        logger.warning("Invalid ticket assignees added signal kwargs: %s", kwargs)
        return
    need_send_notification_users = set(assignees) - set([from_user_id])
    if not need_send_notification_users:
        return
    detail = ticket_assignee_added_msg_to_json(
        ticket_id, ticket_title, from_user_id,
        workspace_id=workspace_id, project_name=project_name
    )

    try:    
        ProjectNotification.objects.bulk_create([
            ProjectNotification(
                project_uuid=project_uuid,
                to_user=to_user,
                msg_type=msg_type,
                detail=detail,
            )
            for to_user in need_send_notification_users
        ])
    except Exception as e:
        logger.error(e)


@receiver(ticket_commented)
def add_ticket_commented_project_msg_cb(sender, **kwargs):
    project_uuid = kwargs.get('project_uuid', None)
    related_users = kwargs.get('related_users', None) or []
    msg_type = kwargs.get('msg_type', None)
    from_user_id = kwargs.get('from_user_id')
    ticket_title = kwargs.get('ticket_title')
    ticket_id = kwargs.get('ticket_id')
    comment_id = kwargs.get('comment_id')
    comment_content = kwargs.get('comment_content')
    workspace_id = kwargs.get('workspace_id')
    project_name = kwargs.get('project_name')

    if any([not project_uuid, not msg_type, not from_user_id,
            not ticket_title, not ticket_id, not comment_id, not comment_content]):
        logger.warning('Invalid ticket commented signal kwargs: %s', kwargs)
        return
    
    if from_user_id in related_users:
        related_users.remove(from_user_id)
    if not related_users:
        return

    detail = ticket_comment_msg_to_json(
            ticket_id, ticket_title, from_user_id, comment_id=comment_id,
            comment_content=comment_content,
            workspace_id=workspace_id, project_name=project_name)
    try:
        ProjectNotification.objects.bulk_create([
            ProjectNotification(
                project_uuid=project_uuid,
                to_user=to_user,
                msg_type=msg_type,
                detail=detail,
            )
            for to_user in related_users
        ])
    except Exception as e:
        logger.error(e)

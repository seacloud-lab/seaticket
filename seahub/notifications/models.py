# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
import datetime
import json
import logging
import re

from django.urls import reverse
from django.db import models
from django.conf import settings
from django.forms import ModelForm, Textarea
from django.utils.html import escape, urlize
from django.utils.translation import gettext as _
from django.core.cache import cache
from django.template.loader import render_to_string

import seaserv
from seaserv import seafile_api, ccnet_api

from seahub.base.fields import LowerCaseCharField
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import DTables, Workspaces
from seahub.invitations.models import Invitation
from seahub.profile.models import Profile
from seahub.utils.repo import get_repo_shared_users
from seahub.utils import normalize_cache_key
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.constants import HASH_URLS

# Get an instance of a logger
logger = logging.getLogger(__name__)


########## system notification
class NotificationManager(models.Manager):
    def create_sys_notification(self, message, is_primary=False):
        """
        Creates and saves a system notification.
        """
        notification = Notification()
        notification.message = message
        notification.primary = is_primary
        notification.save()

        return notification

class Notification(models.Model):
    """
    global system notification
    """
    message = models.CharField(max_length=512)
    primary = models.BooleanField(default=False, db_index=True)
    objects = NotificationManager()

    def update_notification_to_current(self):
        self.primary = 1
        self.save()

class NotificationForm(ModelForm):
    """
    Form for adding notification.
    """
    class Meta:
        model = Notification
        fields = ('message', 'primary')
        widgets = {
            'message': Textarea(),
        }

class SysUserNotificationManager(models.Manager):
    def create_sys_user_notificatioin(self, msg, user):
        notification = self.create(
            message = msg,
            to_user = user,
        )
        return notification

    def unseen_notes(self, user):
        notes = self.filter(to_user=user, seen=0)
        return notes


class SysUserNotification(models.Model):
    """
    system notification to designated user
    """
    message = models.TextField(null=False, blank=False)
    to_user = models.CharField(max_length=255, db_index=True)
    seen = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    objects = SysUserNotificationManager()

    class Meta:
        ordering = ["-created_at"]

    def update_notification_to_seen(self):
        self.seen = True
        self.save()

    @property
    def format_msg(self):
        return urlize(self.message, autoescape=True)

    def to_dict(self):
        email = self.to_user
        profile = Profile.objects.get_profile_by_user(email)
        orgs = ccnet_api.get_orgs_by_user(email)
        org_name = ''
        try:
            if orgs:
                org_name = orgs[0].org_name
        except Exception as e:
            logger.error(e)
        return {
            'id': self.id,
            'msg': self.message,
            'username': self.to_user,
            'name' : email2nickname(self.to_user),
            'contact_email': profile and profile.contact_email or '',
            'seen': self.seen,
            'org_name': org_name,
            'created_at': datetime_to_isoformat_timestr(self.created_at),
            'msg_format': self.format_msg
        }


########## user notification
MSG_TYPE_ADD_USER_TO_GROUP = 'add_user_to_group'
MSG_TYPE_GUEST_INVITATION_ACCEPTED = 'guest_invitation_accepted'
MSG_TYPE_SHARE_DTABLE_TO_USER = 'share_dtable_to_user'
MSG_TYPE_SUBMIT_FORM = 'submit_form'
MSG_TYPE_NEW_PENDING_WORKFLOW_TASK = 'new_pending_workflow_task'
MSG_TYPE_FINISH_WORKFLOW_TASK = 'finish_workflow_task'
MSG_TYPE_DISMISS_WORKFLOW_TASK = 'dismiss_workflow_task'
MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED = 'workflow_processing_expired'
MSG_TYPE_LICENSE_EXPIRING = 'license_expiring'
MSG_TYPE_SAML_SSO_FAILED = 'saml_sso_failed'

USER_NOTIFICATION_COUNT_CACHE_PREFIX = 'USER_NOTIFICATION_COUNT_'

def add_user_to_group_to_json(group_staff, group_id):
    return json.dumps({'group_staff': group_staff,
                       'group_id': group_id})

def guest_invitation_accepted_msg_to_json(invitation_id):
    return json.dumps({'invitation_id': invitation_id})

def share_dtable_to_user_msg_to_json(table_id, share_user):
    return json.dumps({'table_id': table_id, 'share_user': share_user})

def submit_form_msg_to_json(dtable_id, table_id, form_name, submit_user, row_id):
    return json.dumps({'dtable_id': dtable_id,
                       'table_id': table_id,
                       'form_name': form_name,
                       'submit_user': submit_user,
                       'row_id': row_id
                       })

def new_pending_workflow_task_msg_to_json(token, task_id):
    return json.dumps({
        'token': token,
        'task_id': task_id
    })

def finish_workflow_task_msg_to_json(token, task_id, finish_task_message):
    return json.dumps({
        'token': token,
        'task_id': task_id,
        'finish_task_message': finish_task_message
    })

def dismiss_workflow_task_msg_to_json(token, task_id):
    return json.dumps({
        'token': token,
        'task_id': task_id
    })


def saml_sso_error_msg_to_json(error_msg):
    return json.dumps({'error_msg': error_msg})


def get_cache_key_of_unseen_notifications(username):
    return normalize_cache_key(username,
            USER_NOTIFICATION_COUNT_CACHE_PREFIX)

class UserNotificationManager(models.Manager):
    def _add_user_notification(self, to_user, msg_type, detail):
        """Add generic user notification.

        Arguments:
        - `self`:
        - `username`:
        - `detail`:
        """
        n = super(UserNotificationManager, self).create(
            to_user=to_user, msg_type=msg_type, detail=detail)
        n.save()

        cache_key = get_cache_key_of_unseen_notifications(to_user)
        cache.delete(cache_key)

        return n

    def get_all_notifications(self, seen=None, time_since=None):
        """Get all notifications of all users.

        Arguments:
        - `self`:
        - `seen`:
        - `time_since`:
        """
        qs = super(UserNotificationManager, self).all()
        if seen is not None:
            qs = qs.filter(seen=seen)
        if time_since is not None:
            qs = qs.filter(timestamp__gt=time_since)
        return qs

    def get_user_notifications(self, username, seen=None):
        """Get all notifications(group_msg, grpmsg_reply, etc) of a user.

        Arguments:
        - `self`:
        - `username`:
        """
        qs = super(UserNotificationManager, self).filter(to_user=username)
        if seen is not None:
            qs = qs.filter(seen=seen)
        return qs

    def remove_user_notifications(self, username):
        """Remove all user notifications.

        Arguments:
        - `self`:
        - `username`:
        """
        self.get_user_notifications(username).delete()

    def count_unseen_user_notifications(self, username):
        """

        Arguments:
        - `self`:
        - `username`:
        """
        return super(UserNotificationManager, self).filter(
            to_user=username, seen=False).count()

    def set_add_user_to_group_notice(self, to_user, detail):
        """

        Arguments:
        - `self`:
        - `to_user`:
        - `detail`:
        """
        return self._add_user_notification(to_user,
                                           MSG_TYPE_ADD_USER_TO_GROUP,
                                           detail)

    def add_guest_invitation_accepted_msg(self, to_user, detail):
        """Nofity ``to_user`` that a guest has accpeted an invitation.
        """
        return self._add_user_notification(
            to_user, MSG_TYPE_GUEST_INVITATION_ACCEPTED, detail)

    def add_share_dtable_to_user_message(self, to_user, detail):
        return self._add_user_notification(to_user,
                                           MSG_TYPE_SHARE_DTABLE_TO_USER,
                                           detail)

    def add_submit_form_message(self, to_user, detail):
        return self._add_user_notification(to_user,
                                           MSG_TYPE_SUBMIT_FORM,
                                           detail)

    def add_new_pending_workflow_task_message(self, to_users, detail):
        ns = []
        for to_user in to_users:
            ns.append(UserNotification(to_user=to_user, msg_type=MSG_TYPE_NEW_PENDING_WORKFLOW_TASK, detail=detail))
            cache_key = get_cache_key_of_unseen_notifications(to_user)
            cache.delete(cache_key)
        super(UserNotificationManager, self).bulk_create(ns)
        return ns

    def add_finish_workflow_task_message(self, to_user, detail):
        self._add_user_notification(to_user,
                                    MSG_TYPE_FINISH_WORKFLOW_TASK,
                                    detail)

    def add_dismiss_workflow_task_message(self, to_user, detail):
        self._add_user_notification(to_user,
                                    MSG_TYPE_DISMISS_WORKFLOW_TASK,
                                    detail)

    def add_workflow_task_processing_expired_message(self, to_user, detail):
        self._add_user_notification(to_user,
                                    MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED,
                                    detail)

    def add_license_expiring_message(self, to_user, detail):
        self._add_user_notification(to_user,
                                    MSG_TYPE_LICENSE_EXPIRING,
                                    detail)

    def add_saml_sso_error_msg(self, to_user, detail):
        return self._add_user_notification(to_user, MSG_TYPE_SAML_SSO_FAILED, detail)


class UserNotification(models.Model):
    to_user = LowerCaseCharField(db_index=True, max_length=255)
    msg_type = models.CharField(db_index=True, max_length=30)
    detail = models.TextField()
    timestamp = models.DateTimeField(db_index=True, default=datetime.datetime.now)
    seen = models.BooleanField('seen', default=False)
    objects = UserNotificationManager()

    class InvalidDetailError(Exception):
        pass

    class Meta:
        ordering = ["-timestamp"]

    def __unicode__(self):
        return '%s|%s|%s' % (self.to_user, self.msg_type, self.detail)

    def is_seen(self):
        """Returns value of ``self.seen`` but also changes it to ``True``.

        Use this in a template to mark an unseen notice differently the first
        time it is shown.

        Arguments:
        - `self`:
        """
        seen = self.seen
        if seen is False:
            self.seen = True
            self.save()
        return seen

    def is_add_user_to_group_msg(self):
        """

        Arguments:
        - `self`:
        """
        return self.msg_type == MSG_TYPE_ADD_USER_TO_GROUP

    def is_guest_invitation_accepted_msg(self):
        return self.msg_type == MSG_TYPE_GUEST_INVITATION_ACCEPTED

    def is_share_dtable_to_user_msg(self):
        return self.msg_type == MSG_TYPE_SHARE_DTABLE_TO_USER

    def is_submit_form_msg(self):
        return self.msg_type == MSG_TYPE_SUBMIT_FORM

    def is_new_pending_workflow_task_msg(self):
        return self.msg_type == MSG_TYPE_NEW_PENDING_WORKFLOW_TASK

    def is_finish_workflow_task_msg(self):
        return self.msg_type == MSG_TYPE_FINISH_WORKFLOW_TASK

    def is_dismiss_workflow_task_msg(self):
        return self.msg_type == MSG_TYPE_DISMISS_WORKFLOW_TASK

    def is_workflow_processing_expired_msg(self):
        return self.msg_type == MSG_TYPE_WORKFLOW_PROCESSING_EXPIRED

    def is_license_expiring_msg(self):
        return self.msg_type == MSG_TYPE_LICENSE_EXPIRING

    def is_saml_sso_error_msg(self):
        return self.msg_type == MSG_TYPE_SAML_SSO_FAILED

    def _detail_link(self, dtable, tid='', vid='', row_id=''):
        from seahub.notifications.utils import get_dtable_row_url
        dtable_row_url = get_dtable_row_url(dtable, tid=tid, vid=vid, row_id=row_id)
        return dtable_row_url

    def format_msg(self, include_detail_link=False):
        if self.is_add_user_to_group_msg():
            return self.format_add_user_to_group()
        elif self.is_share_dtable_to_user_msg():
            return self.format_share_dtable_to_user_msg()
        elif self.is_submit_form_msg():
            return self.format_submit_form_msg(include_detail_link=include_detail_link)
        elif self.is_new_pending_workflow_task_msg():
            return self.format_new_pending_workflow_task_msg()
        elif self.is_finish_workflow_task_msg():
            return self.format_finish_workflow_task_msg()
        elif self.is_dismiss_workflow_task_msg():
            return self.format_dismiss_workflow_task_msg()
        elif self.is_workflow_processing_expired_msg():
            return self.format_workflow_processing_expired_msg()
        elif self.is_license_expiring_msg():
            return self.format_license_expiring_msg()
        elif self.is_saml_sso_error_msg():
             return self.format_saml_sso_error_msg()
        else:
            return ''

    def format_add_user_to_group(self):
        """

        Arguments:
        - `self`:
        """
        try:
            d = json.loads(self.detail)
        except Exception as e:
            logger.error(e)
            return _("Internal Server Error")

        group_staff = d['group_staff']
        group_id = d['group_id']

        group = ccnet_api.get_group(group_id)
        if group is None:
            self.delete()
            return None

        msg = _("User %(group_staff)s has added you to group %(group_name)s") % {
            'group_staff': escape(email2nickname(group_staff)),
            'group_name': escape(group.group_name)}
        return msg

    def format_guest_invitation_accepted_msg(self):
        try:
            d = json.loads(self.detail)
        except Exception as e:
            logger.error(e)
            return _("Internal Server Error")

        inv_id = d['invitation_id']
        try:
            inv = Invitation.objects.get(pk=inv_id)
        except Invitation.DoesNotExist:
            self.delete()
            return

        # Use same msg as in notice_email.html, so there will be only one msg
        # in django.po.
        msg = _('Guest %(user)s accepted your <a href="%(url_base)s%(inv_url)s">invitation</a> at %(time)s.') % {
            'user': inv.accepter,
            'url_base': '',
            'inv_url': settings.SITE_ROOT + '#invitations/',
            'time': inv.accept_time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        return msg

    def format_share_dtable_to_user_msg(self):
        try:
            d = json.loads(self.detail)
        except Exception as e:
            logger.error('dtable share to user msg notification_id: %s, error: %s', self.id, e)
            return _("Internal Server Error")
        share_from = email2nickname(d['share_user'])
        table_id = d['table_id']
        dtable = DTables.objects.filter(id=table_id).first()
        if not dtable:
            self.delete()
            return None
        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
        if not workspace:
            self.delete()
            return None

        msg = _("%(share_from)s has shared a base named <a href='%(table_link)s'>%(table_name)s</a> to you.") % {
            'share_from': share_from,
            'table_name': dtable.name,
            'table_link': self._detail_link(dtable)
        }
        return msg

    def format_submit_form_msg(self, include_detail_link=False):
        try:
            d = json.loads(self.detail)
        except Exception as e:
            logger.error(e)
            return _("Internal Server Error")
        submit_user = d['submit_user']
        dtable_id = d['dtable_id']
        form_name = d['form_name']
        # resource check
        dtable = DTables.objects.filter(id=dtable_id).first()
        if not dtable:
            self.delete()
            return None
        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
        if not workspace:
            self.delete()
            return None
        if not submit_user:
            submit_user = "Anonymous user"
        else:
            submit_user = email2nickname(submit_user)

        msg = _("%(submit_user)s has submitted form %(form_name)s.") % {
            'submit_user': submit_user,
            'form_name': form_name,
        }
        if include_detail_link:
            detail_link = self._detail_link(dtable, tid=d.get('table_id', ''), row_id=d.get('row_id', ''))
            msg = "%s%s" % (msg, '<a href="%s">%s</a>' % (detail_link, _("Details")))
        return msg

    def format_new_pending_workflow_task_msg(self):
        from seahub.dtable_apps.workflow.models import DTableWorkflows
        try:
            detail = json.loads(self.detail)
        except:
            logger.error('noti: %s detail invalid', self.pk)
            return None
        token = detail.get('token')
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            self.delete()
            return None
        try:
            workflow_config = json.loads(workflow.workflow_config)
            workflow_name = workflow_config['workflow_name']
        except:
            logger.error('workflow: %s workflow config invalid', token)
            return None
        return _('You have a new %s task to handle.') % workflow_name

    def format_finish_workflow_task_msg(self):
        from seahub.dtable_apps.workflow.models import DTableWorkflows
        try:
            detail = json.loads(self.detail)
        except:
            logger.error('noti: %s detail invalid', self.pk)
            return None
        token = detail.get('token')
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            self.delete()
            return None
        workflow_name = get_name_from_config(workflow.workflow_config)
        return _('%(workflow_name)s task submitted by you is finished. %(finish_task_message)s') % {
            'workflow_name': workflow_name,
            'finish_task_message': "%s" % (detail.get('finish_task_message') or '')
        }

    def format_dismiss_workflow_task_msg(self):
        from seahub.dtable_apps.workflow.models import DTableWorkflows
        try:
            detail = json.loads(self.detail)
        except:
            logger.error('noti: %s detail invalid', self.pk)
            return None
        token = detail.get('token')
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            self.delete()
            return None
        try:
            workflow_config = json.loads(workflow.workflow_config)
            workflow_name = workflow_config['workflow_name']
        except:
            logger.error('workflow: %s workflow config invalid', token)
            return None
        return _('You have a %s task that was dismissed. Resubmission is required.') % workflow_name

    def format_workflow_processing_expired_msg(self):
        from seahub.dtable_apps.workflow.models import DTableWorkflows
        try:
            detail = json.loads(self.detail)
        except:
            logger.error('noti: %s detail invalid', self.pk)
            return None
        token = detail.get('token')
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            self.delete()
            return None
        workflow_name = get_name_from_config(workflow.workflow_config)
        offset = detail.get('offset', '')
        if not re.match(r'^\+\d+[dh]$', offset):
            return
        expire_number = int(offset[1: -1])
        if expire_number == 1:
            expire_str = '1 ' + (_('day') if offset[-1] == 'd' else _('hour'))
        else:
            expire_str = ('%s ' % expire_number) + (_('days') if offset[-1] == 'd' else _('hours'))
        return _('You have a %(workflow_name)s task unprocessed for more than %(expire_str)s.') % {
            'workflow_name': workflow_name,
            'expire_str': expire_str
        }

    def format_license_expiring_msg(self):
        try:
            days = json.loads(self.detail)['days']
        except Exception as e:
            logger.error('noti: %s invalid', self.pk)
            return None
        mode = json.loads(self.detail).get('mode', '')
        if mode == 'life-time':
            return _('Your service period will end in %(days)s days.') % {
                'days': days
            }
        return _('Your license will expire in %(days)s days.') % {
            'days': days
        }

    def format_saml_sso_error_msg(self, notice):
        try:
            error_msg = json.loads(self.detail)['error_msg']
        except Exception as e:
            logger.error('notice: %s detail invalid', self.pk)
            return None
        return _(error_msg)


########## handle signals
from django.dispatch import receiver

from seahub.group.signals import add_user_to_group
from seahub.dtable.signals import share_dtable_to_user, submit_form
from seahub.dtable_apps.workflow.signals import new_pending_workflow_task, finish_workflow_task, dismiss_workflow_task
from seahub.dtable_apps.workflow.utils import get_filled_task_message, get_is_send_finish_task_message_from_config, get_name_from_config
from seahub.invitations.signals import accept_guest_invitation_successful
from seahub.saml.signals import saml_sso_failed


@receiver(add_user_to_group)
def add_user_to_group_cb(sender, **kwargs):
    group_staff = kwargs['group_staff']
    group_id = kwargs['group_id']
    added_user = kwargs['added_user']

    detail = add_user_to_group_to_json(group_staff,
                                       group_id)

    UserNotification.objects.set_add_user_to_group_notice(to_user=added_user,
                                                          detail=detail)

@receiver(accept_guest_invitation_successful)
def accept_guest_invitation_successful_cb(sender, **kwargs):
    inv_obj = kwargs['invitation_obj']

    detail = guest_invitation_accepted_msg_to_json(inv_obj.pk)
    UserNotification.objects.add_guest_invitation_accepted_msg(
        inv_obj.inviter, detail)

@receiver(share_dtable_to_user)
def share_dtable_to_user_cb(sender, **kwargs):
    table_id = kwargs.get('table_id')
    share_user = kwargs.get('share_user')
    to_user = kwargs.get('to_user')
    detail = share_dtable_to_user_msg_to_json(table_id, share_user)
    UserNotification.objects.add_share_dtable_to_user_message(to_user, detail)

@receiver(submit_form)
def submit_form_cb(sender, **kwargs):
    dtable_id = kwargs.get('dtable_id')
    table_id = kwargs.get('table_id')
    submit_user = kwargs.get('submit_user')
    form_name = kwargs.get('form_name')
    to_user = kwargs.get('to_user')
    row_id = kwargs.get('row_id')
    detail = submit_form_msg_to_json(dtable_id, table_id, form_name, submit_user, row_id)
    UserNotification.objects.add_submit_form_message(to_user, detail)


@receiver(new_pending_workflow_task)
def new_pending_workflow_task_cb(sender, **kwargs):
    token = kwargs.get('token')
    task_id = kwargs.get('task_id')
    participants = kwargs.get('participants', [])
    if not participants:
        return
    detail = new_pending_workflow_task_msg_to_json(token, task_id)
    UserNotification.objects.add_new_pending_workflow_task_message(participants, detail)


@receiver(finish_workflow_task)
def finish_workflow_task_cb(sender, **kwargs):
    task = kwargs.get('task')
    workflow = kwargs.get('workflow')
    token = workflow.token
    task_id = task.id
    initiator = task.initiator
    if initiator == 'Automation Rule':
        return
    if not get_is_send_finish_task_message_from_config(workflow.workflow_config):
        return
    try:
        finish_task_message = get_filled_task_message(task)
    except Exception as e:
        logger.exception(e)
        return
    detail = finish_workflow_task_msg_to_json(token, task_id, finish_task_message)
    UserNotification.objects.add_finish_workflow_task_message(initiator, detail)


@receiver(dismiss_workflow_task)
def dismiss_workflow_task_cb(sender, **kwargs):
    token = kwargs.get('token')
    task_id = kwargs.get('task_id')
    initiator = kwargs.get('initiator')
    if initiator == 'Automation Rule':
        return
    detail = dismiss_workflow_task_msg_to_json(token, task_id)
    UserNotification.objects.add_dismiss_workflow_task_message(initiator, detail)


@receiver(saml_sso_failed)
def saml_sso_failed_cb(sender, **kwargs):
    to_user = kwargs['to_user']
    error_msg = kwargs['error_msg']

    detail = saml_sso_error_msg_to_json(error_msg)
    UserNotification.objects.add_saml_sso_error_msg(to_user, detail)

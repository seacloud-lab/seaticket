# Copyright (c) 2012-2016 Seafile Ltd.
from datetime import timedelta
from uuid import uuid4
from datetime import datetime
from django.conf import settings
from django.db import models, IntegrityError
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext as _

from seahub.base.fields import LowerCaseCharField
from seahub.invitations.settings import INVITATIONS_TOKEN_AGE
from seahub.utils import gen_token, get_site_name
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.utils.mail import send_html_email_with_dj_template

GUEST = _('Guest')

class InvitationManager(models.Manager):
    def add(self, inviter, accepter, invite_type=GUEST):
        token = gen_token(max_length=32)
        expire_at = timezone.now() + timedelta(hours=int(INVITATIONS_TOKEN_AGE))

        i = self.model(token=token, inviter=inviter, accepter=accepter,
                       invite_type=invite_type, expire_time=expire_at)
        i.save(using=self._db)
        return i

    def get_by_inviter(self, inviter):
        return super(InvitationManager,
                self).filter(inviter=inviter).order_by('-invite_time')

    def delete_all_expire_invitation(self):
        super(InvitationManager, self).filter(expire_time__lte=timezone.now()).delete()

    def get_by_token(self, token):
        qs = self.filter(token=token)
        if qs.count() > 0:
            return qs[0]
        return None


class Invitation(models.Model):
    INVITE_TYPE_CHOICES = (
        (GUEST, _('Guest')),
    )

    token = models.CharField(max_length=40, db_index=True)
    inviter = LowerCaseCharField(max_length=255, db_index=True)
    accepter = LowerCaseCharField(max_length=255)
    invite_type = models.CharField(max_length=20,
                                   choices=INVITE_TYPE_CHOICES,
                                   default=GUEST)
    invite_time = models.DateTimeField(auto_now_add=True)
    accept_time = models.DateTimeField(null=True, blank=True)
    expire_time = models.DateTimeField()
    objects = InvitationManager()

    def __unicode__(self):
        return "Invitation from %s on %s (%s)" % (
            self.inviter, self.invite_time, self.token)

    def accept(self):
        self.accept_time = timezone.now()
        self.save()

    def to_dict(self):
        accept_time = datetime_to_isoformat_timestr(self.accept_time) \
                      if self.accept_time else ""
        return {
            "id": self.pk,
            "token": self.token,
            "inviter": self.inviter,
            "accepter": self.accepter,
            "type": self.invite_type,
            "invite_time": datetime_to_isoformat_timestr(self.invite_time),
            "accept_time": accept_time,
            "expire_time": datetime_to_isoformat_timestr(self.expire_time),
        }

    def is_guest(self):
        return self.invite_type == GUEST

    def is_expired(self):
        return timezone.now() >= self.expire_time

    def send_to(self, email=None):
        """
        Send an invitation email to ``email``.
        """
        if not email:
            email = self.accepter

        context = self.to_dict()
        context['site_name'] = get_site_name()

        # subject = render_to_string('invitations/invitation_email_subject.txt',
        #                            context).rstrip()
        subject = _('%(user)s invited you to join %(site_name)s.') % {
            'user': self.inviter, 'site_name': get_site_name()}
        return send_html_email_with_dj_template(
            email, dj_template='invitations/invitation_email.html',
            context=context,
            subject=subject
        )


class InvitationLinksManager(models.Manager):

    def get_invitation_link_by_user(self, user):
        invitation_link = super(InvitationLinksManager, self).filter(username=user.username).first()
        if not invitation_link:
            while True:
                try:
                    invitation_link = super(InvitationLinksManager, self).create(
                        username=user.username,
                        token=self.generate_token()
                    )
                except IntegrityError:
                    continue
                else:
                    break
        return invitation_link

    def generate_token(self):
        return uuid4().hex

    def get_invitation_link_by_token(self, token):
        invitation_link = super(InvitationLinksManager, self).filter(token=token).first()
        return invitation_link


class InvitationLinks(models.Model):
    username = models.CharField(max_length=255, unique=True, null=False)
    token = models.CharField(max_length=40, unique=True, null=False)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    objects = InvitationLinksManager()

    class Meta:
        db_table = 'invitation_links'

    @property
    def link(self):
        return '%s%s' % (settings.SEAQA_WEB_SERVICE_URL.rstrip('/'), reverse('invitations:invitation_link_view', args=(self.token,)))

    @property
    def poster_link(self):
        return '%s%s' % (settings.SEAQA_WEB_SERVICE_URL.rstrip('/'), reverse('invitations:invitation_poster_link_view', args=(self.token,)))


class RegistrationiLogsManager(models.Manager):

    def get_invitation_infos_by_date(self, register_date):
        logs = self.filter(
            registered_at__gte=register_date,
            registered_at__lt=register_date + timedelta(days=1),
            source='invitation'
        )
        return logs

class RegistrationLogs(models.Model):
    source = models.CharField(max_length=40, db_index=True, default='')
    token = models.CharField(max_length=40, null=True)
    accepter = models.CharField(max_length=255, null=True)
    registered_at = models.DateTimeField(auto_now_add=True, db_index=True)
    objects = RegistrationiLogsManager()

    class Meta:
        db_table = 'registration_logs'

    @property
    def inviter(self):
        invitation_link = InvitationLinks.objects.get_invitation_link_by_token(self.token)
        if invitation_link:
            return invitation_link.username
        return None

    def to_dict(self):
        return {
            'source': self.source,
            'token': self.token,
            'inviter': self.inviter,
            'accepter': self.accepter,
            'registered_at': self.registered_at
        }

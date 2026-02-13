from django.db import models
from django.utils import timezone
from uuid import uuid4
from django.urls import reverse
from django.conf import settings


class PortalExternalInvitationManager(models.Manager):

    def add(self, inviter, email, project_uuid, expire_hours=72):
        token = uuid4().hex
        expire_time = timezone.now() + timezone.timedelta(hours=int(expire_hours))
        obj = self.model(token=token, inviter=inviter, email=email, project_uuid=project_uuid, expire_time=expire_time)
        obj.save(using=self._db)
        return obj

    def list_invites_by_project_uuid(self, project_uuid):
        return super().filter(project_uuid=project_uuid).order_by('-created_at')

    def get_by_token(self, token):
        return super().filter(token=token).first()


class PortalExternalInvitation(models.Model):
    token = models.CharField(max_length=40, unique=True)
    inviter = models.CharField(max_length=255)
    email = models.CharField(max_length=255)
    project_uuid = models.CharField(max_length=36, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expire_time = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    objects = PortalExternalInvitationManager()

    class Meta:
        db_table = 'portal_external_invitations'

    def is_expired(self):
        return timezone.now() >= self.expire_time

    @property
    def link(self):
        base = getattr(settings, 'SEAQA_WEB_SERVICE_URL', '').rstrip('/')
        path = reverse('portal_external_invitation_accept_view', args=(self.token, self.project_uuid))
        return f"{base}{path}" if base else path


class ProjectExternalUserManager(models.Manager):

    def list_ext_users_by_project_uuid(self, project_uuid):
        return super().filter(project_uuid=project_uuid)
    
    def get_contact_email_by_user(self, username):
        return super().filter(username=username).first()


class ProjectExternalUser(models.Model):
    email = models.CharField(max_length=255, db_index=True)
    username = models.CharField(max_length=255, db_index=True)
    project_uuid = models.CharField(max_length=36, db_index=True)
    activated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    objects = ProjectExternalUserManager()

    class Meta:
        unique_together = (('email', 'project_uuid'),)
        db_table = 'project_external_users'

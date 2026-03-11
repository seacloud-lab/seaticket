import json
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


class PortalChatSessionsManager(models.Manager):

    def create_session(self, project_uuid, session_name, username):
        session_uuid = str(uuid4())
        session = self.model(
            project_uuid=project_uuid,
            session_uuid=session_uuid,
            username=username,
            session_name=session_name,
        )
        session.save()
        return session

    def get_sessions_by_project(self, project_uuid, username):
        return self.filter(project_uuid=project_uuid, username=username).order_by('-updated_at')

    def get_session_by_uuid(self, session_uuid):
        try:
            return self.get(session_uuid=session_uuid)
        except self.model.DoesNotExist:
            return None


class PortalChatSessions(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.CharField(max_length=36, db_index=True)
    session_uuid = models.CharField(max_length=36, unique=True, db_index=True)
    username = models.CharField(max_length=255, db_index=True)
    session_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PortalChatSessionsManager()

    class Meta:
        db_table = 'portal_chat_sessions'

    def to_dict(self):
        return {
            'id': self.id,
            'project_uuid': self.project_uuid,
            'session_uuid': self.session_uuid,
            'username': self.username,
            'session_name': self.session_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class PortalChatMessagesManager(models.Manager):

    def create_message(self, session_uuid, message_id, username, role, content, as_context=True):
        message = self.model(
            session_uuid=session_uuid,
            message_id=message_id,
            username=username,
            role=role,
            content=content,
            as_context=as_context,
        )
        message.save()
        return message

    def get_messages_by_session(self, session_uuid):
        return self.filter(session_uuid=session_uuid).order_by('created_at')

    def get_last_message_by_session(self, session_uuid):
        """Retrieve the last message of the session"""
        return self.filter(session_uuid=session_uuid).order_by('-created_at').first()

    def clear_context(self, session_uuid, username):
        self.create_message(session_uuid, None, username, 'chat_manager', '<break_context>', False)
        records = self.filter(session_uuid=session_uuid)
        records.update(as_context=False)


class PortalChatMessages(models.Model):
    id = models.BigAutoField(primary_key=True)
    session_uuid = models.CharField(max_length=36, null=False)
    message_id = models.CharField(max_length=4, null=True)
    username = models.CharField(max_length=255)
    role = models.CharField(max_length=20)
    content = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    as_context = models.BooleanField(default=True)

    objects = PortalChatMessagesManager()

    class Meta:
        db_table = 'portal_chat_messages'
        indexes = [
            models.Index(fields=['session_uuid', 'created_at']),
        ]

    def to_dict(self):
        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'username': self.username,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'as_context': self.as_context,
        }

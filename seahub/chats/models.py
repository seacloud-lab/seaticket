# -*- coding: utf-8 -*-
import uuid
import json
from django.db import models


class ChatSessionsManager(models.Manager):
    def create_session(self, project_uuid, session_name, username, is_portal=False):
        """Create a new chat session"""
        session_uuid = str(uuid.uuid4())
        session = self.model(
            project_uuid=project_uuid,
            session_uuid=session_uuid,
            username=username,
            session_name=session_name,
            is_portal=is_portal
        )
        session.save()
        return session

    def get_sessions_by_project(self, project_uuid, username, is_portal=False):
        """Retrieve all chat sessions of the project"""
        return self.filter(project_uuid=project_uuid, username=username, is_portal=is_portal).order_by('-updated_at')

    def get_session_by_uuid(self, session_uuid):
        """According to session_uuid to obtain the session"""
        try:
            return self.get(session_uuid=session_uuid)
        except self.model.DoesNotExist:
            return None

    def get_shared_sessions_by_project(self, project_uuid):
        """Retrieve all shared chat sessions of the team"""
        queryset = self.filter(project_uuid=project_uuid, is_shared=True)
        return queryset.order_by('-updated_at')

class ChatSessions(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.CharField(max_length=36, db_index=True)
    session_uuid = models.CharField(max_length=36, unique=True, db_index=True)
    username = models.CharField(max_length=255, db_index=True)
    session_name = models.CharField(max_length=255)
    is_portal = models.BooleanField(default=False)
    is_shared = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ChatSessionsManager()

    class Meta:
        db_table = 'chat_sessions'
        indexes = [
            models.Index(fields=['project_uuid', 'is_shared'], name='idx_project_uuid_is_shared')
        ]

    def to_dict(self):
        return {
            'id': self.id,
            'project_uuid': self.project_uuid,
            'session_uuid': self.session_uuid,
            'username': self.username,
            'session_name': self.session_name,
            'is_shared': self.is_shared,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class ChatMessageThoughtProcessManager(models.Manager):
    def create_thought_process(self, session_uuid, message_id, thought_process):
        """Create a new chat message"""
        record = self.model(
            session_uuid=session_uuid,
            message_id=message_id,
            thought_process=json.dumps(thought_process),
        )
        record.save()
        return record
    
    def get_thought_process_from_session_uuid_and_message_id(self, session_uuid, message_id):
        return self.filter(session_uuid=session_uuid, message_id=message_id).first().to_dict()['thought_process']

    def get_thought_process_from_session_uuid_and_message_ids(self, session_uuid, message_ids):
        """
        returns a map {message_id: <tool_calls>}
        """
        results = {}
        for record in self.filter(session_uuid=session_uuid, message_id__in=message_ids):
            record_to_dict = record.to_dict()
            results[record.message_id] = record_to_dict['thought_process']
        
        return results

class ChatMessageThoughtProcess(models.Model):
    id = models.BigAutoField(primary_key=True)
    session_uuid = models.CharField(max_length=36, null=False)
    message_id = models.CharField(max_length=4, null=False)
    thought_process = models.TextField()

    objects = ChatMessageThoughtProcessManager()

    class Meta:
        db_table = 'chat_message_thought_process'
        unique_together = [
            ['session_uuid', 'message_id']
        ]

    def to_dict(self):
        try:
            thought_process = json.loads(self.thought_process)
        except:
            thought_process = {}

        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'thought_process': thought_process,
        }

class ChatMessagesManager(models.Manager):
    def create_message(self, session_uuid, message_id, username, role, content, as_context=True, sources='', attachments=[]):
        """Create a new chat message"""
        message = self.model(
            session_uuid=session_uuid,
            message_id=message_id,
            username=username,
            role=role,
            content=content,
            attachments=json.dumps(attachments),
            sources=sources,
            as_context=as_context
        )
        message.save()
        return message

    def get_messages_by_session(self, session_uuid):
        """Retrieve all messages of the session"""
        return self.filter(session_uuid=session_uuid).order_by('created_at')
    
    def get_last_message_by_session(self, session_uuid):
        """Retrieve the last turn messages of the session"""
        return self.filter(session_uuid=session_uuid).order_by('-created_at').first()
    
    def clear_context(self, session_uuid, username):
        self.create_message(session_uuid, None, username, 'chat_manager', '<break_context>', False)
        records = self.filter(session_uuid=session_uuid)
        records.update(as_context=False)

class ChatMessages(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]

    id = models.BigAutoField(primary_key=True)
    session_uuid = models.CharField(max_length=36, null=False)
    message_id = models.CharField(max_length=4, null=False)
    username = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField(null=True)
    attachments = models.TextField(null=True)
    sources = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    as_context = models.BooleanField(default=True)

    objects = ChatMessagesManager()

    class Meta:
        db_table = 'chat_messages'
        indexes = [
            models.Index(fields=['session_uuid', 'created_at']),
            models.Index(fields=['session_uuid', 'role', '-created_at', '-as_context'])
        ]

    def to_dict(self):
        try:
            sources = json.loads(self.sources)
        except:
            sources = self.sources
        
        if not isinstance(sources, list):
            sources = []
        
        try:
            attachments = json.loads(self.attachments)
        except:
            attachments = self.attachments

        if not isinstance(attachments, list):
            attachments = []

        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'username': self.username,
            'role': self.role,
            'content': self.content,
            'attachments': attachments,
            'sources': sources,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'as_context': self.as_context
        }

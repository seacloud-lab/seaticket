# -*- coding: utf-8 -*-
import uuid
import json
from django.db import models


class ChatSessionsManager(models.Manager):
    def create_session(self, project_uuid, session_name, username):
        """Create a new chat session"""
        session_uuid = str(uuid.uuid4())
        session = self.model(
            project_uuid=project_uuid,
            session_uuid=session_uuid,
            username=username,
            session_name=session_name
        )
        session.save()
        return session

    def get_sessions_by_project(self, project_uuid, username):
        """Retrieve all chat sessions of the project"""
        return self.filter(project_uuid=project_uuid, username=username).order_by('-updated_at')

    def get_session_by_uuid(self, session_uuid):
        """According to session_uuid to obtain the session"""
        try:
            return self.get(session_uuid=session_uuid)
        except self.model.DoesNotExist:
            return None

class ChatSessions(models.Model):
    id = models.BigAutoField(primary_key=True)
    project_uuid = models.CharField(max_length=36, db_index=True)
    session_uuid = models.CharField(max_length=36, unique=True, db_index=True)
    username = models.CharField(max_length=255, db_index=True)
    session_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ChatSessionsManager()

    class Meta:
        db_table = 'chat_sessions'

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

class ChatToolCallsManager(models.Manager):
    def get_tool_calls_from_session_uuid_and_message_ids(self, session_uuid, message_ids):
        """
        returns a map {message_id: <tool_calls>}
        """
        results = {}
        for record in self.filter(session_uuid=session_uuid, message_id__in=message_ids):
            record_to_dict = record.to_dict()
            results[record.message_id] = record_to_dict['tool_calls']
        
        return results

class ChatToolCalls(models.Model):
    id = models.BigAutoField(primary_key=True)
    session_uuid = models.CharField(max_length=36, null=False)
    message_id = models.CharField(max_length=4, null=False)
    tool_calls = models.TextField()

    objects = ChatToolCallsManager()

    class Meta:
        db_table = 'chat_tool_calls'
        constraints = [
            models.UniqueConstraint(
                fields=['session_uuid', 'message_id'],
                name='uniq_session_uuid_message_id'
            )
        ]

    def to_dict(self):
        try:
            tool_calls = json.loads(self.tool_calls)
        except:
            tool_calls = {}

        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'tool_calls': tool_calls,
        }

class ChatMessagesManager(models.Manager):
    def create_message(self, session_uuid, message_id, username, role, content, is_agent_mode, sources='', extra_content={}):
        """Create a new chat message"""
        message = self.model(
            session_uuid=session_uuid,
            message_id=message_id,
            username=username,
            role=role,
            content=content,
            extra_content=json.dumps(extra_content),
            sources=sources,
            is_agent_mode=is_agent_mode
        )
        message.save()
        return message

    def get_messages_by_session(self, session_uuid):
        """Retrieve all messages of the session"""
        return self.filter(session_uuid=session_uuid).order_by('created_at')


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
    extra_content = models.TextField(null=True)
    sources = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_agent_mode = models.BooleanField()

    objects = ChatMessagesManager()

    class Meta:
        db_table = 'chat_messages'
        constraints = [
            models.Index(
                fields=['session_uuid', 'created_at'],
                name='idx_session_uuid_created_at'
            )
        ]

    def to_dict(self):
        try:
            sources = json.loads(self.sources)
        except:
            sources = self.sources
        
        if not isinstance(sources, list):
            sources = []
        
        try:
            extra_content = json.loads(self.extra_content)
        except:
            extra_content = self.extra_content

        if not isinstance(extra_content, dict):
            extra_content = {}

        return {
            'id': self.id,
            'session_uuid': self.session_uuid,
            'message_id': self.message_id,
            'username': self.username,
            'role': self.role,
            'content': self.content,
            'extra_content': extra_content,
            'sources': sources,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'is_agent_mode': self.is_agent_mode
        }

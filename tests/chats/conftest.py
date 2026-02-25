from types import SimpleNamespace
from uuid import uuid4

import pytest
from rest_framework.test import APIRequestFactory

from seahub.project.models import Projects, Workspaces
from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess
from seahub.project.models import ProjectConnections


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def user():
    return SimpleNamespace(
        id=1,
        pk=1,
        username='test@seafile.com',
        is_authenticated=True,
        is_active=True,
        org=SimpleNamespace(org_id=-1),
    )


@pytest.fixture
def real_project(db):
    owner = f"owner_{uuid4().hex[:6]}@example.com"
    workspace = Workspaces.objects.create(owner=owner, org_id=1)
    project = Projects.objects.create_project(
        username=owner,
        workspace=workspace,
        name=f"proj-{uuid4().hex[:6]}",
    )
    return project


@pytest.fixture
def project_creator(real_project):
    owner = real_project.creator
    return SimpleNamespace(
        id=1,
        pk=1,
        username=owner,
        is_authenticated=True,
        is_active=True,
        org=SimpleNamespace(org_id=-1),
        permissions=SimpleNamespace(can_add_project=lambda: True),
    )

@pytest.fixture
def auth_user():
    username = f"owner_{uuid4().hex[:6]}@example.com"
    return SimpleNamespace(
        id=2,
        pk=2,
        username=username,
        is_authenticated=True,
        is_active=True,
        org=SimpleNamespace(org_id=1),
        permissions=SimpleNamespace(can_add_project=lambda: True)
    )

@pytest.fixture
def no_org_user():
    username = f"owner_{uuid4().hex[:6]}@example.com"
    return SimpleNamespace(
        id=3,
        pk=3,
        username=username,
        is_authenticated=True,
        is_active=True,
        org=None
    )


@pytest.fixture
def chat_session(real_project, project_creator):
    return ChatSessions.objects.create_session(
        project_uuid=str(real_project.uuid),
        session_name='s1',
        username=project_creator.username,
    )


@pytest.fixture
def shared_chat_session(real_project, project_creator):
    session = ChatSessions.objects.create_session(
        project_uuid=str(real_project.uuid),
        session_name='s-team',
        username=project_creator.username,
    )
    session.is_shared = True
    session.save(update_fields=['is_shared'])
    return session


@pytest.fixture
def chat_messages_with_thought_process(chat_session, project_creator):
    user_msg = ChatMessages.objects.create_message(
        chat_session.session_uuid,
        'm1',
        project_creator.username,
        'user',
        'hello',
        attachments=[{'content': 'x', 'foo': 1}],
    )
    assistant_msg = ChatMessages.objects.create_message(
        chat_session.session_uuid,
        'm2',
        project_creator.username,
        'assistant',
        'hi',
        sources='[]',
    )
    ChatMessageThoughtProcess.objects.create_thought_process(
        chat_session.session_uuid,
        'm2',
        {'x': 1},
    )
    return user_msg, assistant_msg


@pytest.fixture
def site_connection(real_project, project_creator):
    return ProjectConnections.objects.create(
        username=project_creator.username,
        project=real_project,
        connection_type='site',
        name='site-conn',
        config={},
    )

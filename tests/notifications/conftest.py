import pytest
import json

from types import SimpleNamespace
from uuid import uuid4
from rest_framework.test import APIRequestFactory

from seahub.project.models import Projects, Workspaces
from seahub.notifications.models import UserNotification
from seahub.notifications.models import ProjectNotification
from seahub.notifications.signal_handler import MSG_TYPE_ADD_USER_TO_GROUP


@pytest.fixture
def factory():
    return APIRequestFactory()


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
def create_new_notification(db, project_creator):
    detail = {
        'inviter_email': 'test@example.com',
        'inviter_name': 'Test User',
        'accepter_email': 'accepter@example.com',
        'accepter_name': 'Accepter User',
    }
    return UserNotification.objects.create(
            to_user=project_creator.username,
            msg_type=MSG_TYPE_ADD_USER_TO_GROUP,
            detail=json.dumps(detail)
        )


@pytest.fixture
def user_notifications(project_creator, db):
    return [
        UserNotification.objects.create(
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=False,
        ),
        UserNotification.objects.create(
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=False,
        ),
    ]


@pytest.fixture
def seen_user_notification(project_creator, db):
    notice = UserNotification.objects.create(
        to_user=project_creator.username,
        msg_type='test',
        detail='{}',
        seen=True,
    )
    return notice


@pytest.fixture
def project_notifications_mixed(real_project, project_creator, db):
    return [
        ProjectNotification.objects.create(
            project_uuid=str(real_project.uuid),
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=False,
        ),
        ProjectNotification.objects.create(
            project_uuid=str(real_project.uuid),
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=True,
        ),
        ProjectNotification.objects.create(
            project_uuid=str(real_project.uuid),
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=True,
        ),
    ]


@pytest.fixture
def project_notifications_unseen(real_project, project_creator, db):
    return [
        ProjectNotification.objects.create(
            project_uuid=str(real_project.uuid),
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=False,
        ),
    ]


@pytest.fixture
def notifications_all_data(real_project, project_creator, db):
    user_notifications = [
        UserNotification.objects.create(
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=False,
        ),
        UserNotification.objects.create(
            to_user=project_creator.username,
            msg_type='test',
            detail='{}',
            seen=False,
        ),
    ]
    project_notifications = [
        ProjectNotification.objects.create(
            project_uuid=str(real_project.uuid),
            to_user=project_creator.username,
            msg_type='test',
            detail='{test content 1}',
            seen=False,
        ),
        ProjectNotification.objects.create(
            project_uuid=str(real_project.uuid),
            to_user=project_creator.username,
            msg_type='test',
            detail='{test content 2}',
            seen=False,
        ),
        ProjectNotification.objects.create(
            project_uuid=str(real_project.uuid),
            to_user=project_creator.username,
            msg_type='test',
            detail='{test content 3}',
            seen=False,
        ),
    ]
    return {
        'user_notifications': user_notifications,
        'project_notifications': project_notifications,
    }

@pytest.fixture
def project_creator(real_project):
    owner = real_project.creator
    return SimpleNamespace(
        id=1,
        pk=1,
        username=owner,
        is_authenticated=True,
        is_active=True,
        org=SimpleNamespace(org_id=1),
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

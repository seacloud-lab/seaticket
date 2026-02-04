import pytest
import json

from types import SimpleNamespace
from uuid import uuid4
from rest_framework.test import APIRequestFactory

from seahub.project.models import Projects, Workspaces
from seahub.notifications.models import UserNotification
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
def create_new_notification(db, auth_user):
    detail = {
        'inviter_email': 'test@example.com',
        'inviter_name': 'Test User',
        'accepter_email': 'accepter@example.com',
        'accepter_name': 'Accepter User',
    }
    return UserNotification.objects.create(
            to_user=auth_user.username,
            msg_type=MSG_TYPE_ADD_USER_TO_GROUP,
            detail=json.dumps(detail)
        )

@pytest.fixture
def auth_user(real_project):
    owner = real_project.creator
    return SimpleNamespace(
        id=1,
        pk=1,
        username=owner,
        is_authenticated=True,
        is_active=True,
    )

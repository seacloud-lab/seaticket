from unittest.mock import Mock

import pytest
from rest_framework.test import APIRequestFactory


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def user():
    u = Mock()
    u.id = 1
    u.pk = 1
    u.username = 'test@seafile.com'
    u.email = 'test@seafile.com'
    return u


@pytest.fixture
def user_with_permissions():
    """User with mocked permissions."""
    u = Mock()
    u.id = 1
    u.pk = 1
    u.username = 'test@seafile.com'
    u.email = 'test@seafile.com'
    u.permissions = Mock()
    return u

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
    return u

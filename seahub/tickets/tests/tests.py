# -*- coding: utf-8 -*-

import importlib.util

from unittest import TestCase
from unittest.mock import Mock

from rest_framework.test import APIRequestFactory


if importlib.util.find_spec('pytest'):
    import pytest

    class TicketAPITestBase:
        @pytest.fixture(autouse=True)
        def _setup(self):
            self.factory = APIRequestFactory()
            self.user = Mock()
            self.user.id = 1
            self.user.pk = 1
            self.user.username = "test@seafile.com"
else:

    class TicketAPITestBase(TestCase):
        def setUp(self):
            self.factory = APIRequestFactory()
            self.user = Mock()
            self.user.id = 1
            self.user.pk = 1
            self.user.username = "test@seafile.com"

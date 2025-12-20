# -*- coding: utf-8 -*-

from unittest import TestCase
from unittest.mock import Mock

from rest_framework.test import APIRequestFactory


class TicketAPITestBase(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = Mock()
        self.user.id = 1
        self.user.pk = 1
        self.user.username = "test@seafile.com"

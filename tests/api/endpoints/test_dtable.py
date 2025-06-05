# -*- coding: utf-8 -*-
import json
import uuid

from django.urls import reverse

from seaserv import seafile_api

from seahub.dtable.models import Workspaces
from seahub.test_utils import BaseTestCase
from tests.common.utils import randstring


class WorkspacesViewTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(
            self.user.username,
            self.repo.id,
            -1
        )
        self.url = reverse('api-v2.1-workspaces')
        self.login_as(self.user)

    def tearDown(self):
        assert len(Workspaces.objects.all()) == 1

        workspace = Workspaces.objects.get_workspace_by_owner(self.user.username)
        workspace_id = workspace.id

        Workspaces.objects.delete_workspace(workspace_id)
        self.remove_repo()

    # def test_can_list(self):
    #     assert len(Workspaces.objects.all()) == 1

    #     resp = self.client.get(self.url)
    #     self.assertEqual(200, resp.status_code)

    #     json_resp = json.loads(resp.content)
    #     self.assertIsNotNone(json_resp["workspace_list"])

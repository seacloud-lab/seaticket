import json
import datetime

from django.urls import reverse
from seahub.dtable.models import Workspaces, DTables, DTableCommonDataset
from seaserv import seafile_api

from seahub.test_utils import BaseTestCase
from seahub.base.templatetags.seahub_tags import email2nickname

try:
    from seahub.settings import LOCAL_PRO_DEV_ENV
except ImportError:
    LOCAL_PRO_DEV_ENV = False

GROUP_DOMAIN = '@seafile_group'

class DTableCommonDatasetsTest(BaseTestCase):
    def setUp(self):
        # create workspace
        self.workspace = Workspaces.objects.create_workspace(
            str(self.group.id)+'@seafile_group', self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(
            self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(
            self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1


        # share repo to group
        seafile_api.set_group_repo(self.repo.id,
                self.group.id, self.user.username, 'rw')


        self.table_id = '0000'
        self.view_id = '0000'
        self.dataset_name = 'test_dataset'
        self.common_dataset = DTableCommonDataset.objects.create(
            org_id=-1,
            group_id=self.group.id,
            dtable_uuid=self.dtable.uuid,
            table_id=self.table_id,
            view_id=self.view_id,
            creator=self.user.username,
            created_at=datetime.datetime.now(),
            dataset_name=self.dataset_name,
        )
        assert len(DTableCommonDataset.objects.all()) == 1

        self.common_datasets_url = reverse('api-v2.1-dtable-common-datasets')
        self.common_dataset_url = reverse('api-v2.1-dtable-common-dataset', args=[self.common_dataset.id])

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)

        self.remove_repo()

    def test_can_list(self):
        self.login_as(self.user)

        resp = self.client.get(self.common_datasets_url)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert len(json_resp["dataset_list"]) == 1
        assert json_resp["dataset_list"][0]
        assert json_resp['dataset_list'][0]['id'] == self.common_dataset.id
        assert json_resp['dataset_list'][0]['org_id'] == -1
        assert json_resp['dataset_list'][0]['group_id'] == self.group.id
        assert json_resp['dataset_list'][0]['dtable_uuid'] == str(self.dtable.uuid)
        assert json_resp['dataset_list'][0]['table_id'] == self.table_id
        assert json_resp['dataset_list'][0]['view_id'] == self.view_id
        assert json_resp['dataset_list'][0]['created_at']
        assert json_resp['dataset_list'][0]['creator'] == email2nickname(self.user.username)
        assert json_resp['dataset_list'][0]['dataset_name'] == self.common_dataset.dataset_name
        assert json_resp['dataset_list'][0]['can_manage'] == True


class DTableCommonDatasetTest(BaseTestCase):
    def setUp(self):
        # create workspace
        self.workspace = Workspaces.objects.create_workspace(
            str(self.group.id)+'@seafile_group', self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(
            self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(
            self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        # share repo to group
        seafile_api.set_group_repo(self.repo.id,
                self.group.id, self.user.username, 'rw')

        self.table_id = '0000'
        self.view_id = '0000'
        self.dataset_name = 'test_dataset'
        self.common_dataset = DTableCommonDataset.objects.create(
            org_id=-1,
            group_id=self.group.id,
            dtable_uuid=self.dtable.uuid,
            table_id=self.table_id,
            view_id=self.view_id,
            creator=self.user.username,
            created_at=datetime.datetime.now(),
            dataset_name=self.dataset_name,
        )
        assert len(DTableCommonDataset.objects.all()) == 1

        self.common_datasets_url = reverse('api-v2.1-dtable-common-datasets')
        self.common_dataset_url = reverse('api-v2.1-dtable-common-dataset', args=[self.common_dataset.id])


    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)

        self.remove_repo()

    def test_can_delete(self):

        self.login_as(self.user)

        resp = self.client.delete(self.common_dataset_url)
        self.assertEqual(200, resp.status_code)
        assert len(DTableCommonDataset.objects.all()) == 0


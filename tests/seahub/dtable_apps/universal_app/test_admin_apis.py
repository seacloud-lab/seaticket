import json
import datetime

from django.urls import reverse
from seaserv import seafile_api

from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.constants import PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_CUSTOM
from seahub.dtable.models import DTables, Workspaces, DTableExternalApps
from seahub.dtable_apps.universal_app.models import DTableAppUsers, DTableAppRoles, DTableAppInviteLinks, DTableAppUserSync
from seahub.test_utils import BaseTestCase
from seahub.dtable.utils import gen_share_unversal_app_link
from tests.common.utils import randstring

permission_tuple = (PERMISSION_READ, PERMISSION_READ_WRITE, PERMISSION_CUSTOM)


class AdminDtableUniversalAppUsersTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(self.user.username, self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(
            self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(
            self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        app_type = 'universal-app'
        app_name = "test_universal_app"
        self.app_config = json.dumps({'app_type': app_type, "app_name": app_name})
        self.universal_app = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username, app_config=self.app_config)
        self.app_role = DTableAppRoles.objects.generate_app_admin_role(self.universal_app)

        self.app_user = DTableAppUsers.objects.create(
            app=self.universal_app,
            role=self.app_role,
            username=self.user.username
        )

        self.temp_user = self.create_user('user_%s@test.com' % randstring(4), is_staff=False)
        self.app_users_url = reverse('api-v2.1-dtable-universal-app-users', args=[self.universal_app.app_uuid])
        self.app_user_url = reverse('api-v2.1-dtable-universal-app-user', args=[self.universal_app.app_uuid, self.app_user.id])

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)
        self.remove_repo()
        self.remove_user(self.user.email)
        self.remove_user(self.admin.email)
        self.remove_user(self.temp_user.email)

    def test_get_universal_app_users(self):
        self.login_as(self.user)
        resp = self.client.get(self.app_users_url)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert json_resp['app_users'][0]['id'] == self.app_user.id
        assert json_resp['app_users'][0]['name'] == email2nickname(self.user.username)
        assert json_resp['app_users'][0]['email'] == self.user.username
        assert json_resp['app_users'][0]['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_users'][0]['role_id'] == self.app_role.id
        assert json_resp['app_users'][0]['role_name'] == self.app_role.role_name
        assert json_resp['app_users'][0]['role_permission'] == self.app_role.role_permission
        assert json_resp['app_users'][0]['is_active'] is True
        assert json_resp['app_users'][0]['avatar_url'] is not None
        assert json_resp['total_count'] == 1

    def test_can_not_get_app_users(self):
        self.login_as(self.temp_user)

        resp = self.client.get(self.app_users_url)
        self.assertEqual(403, resp.status_code)

    def test_add_universal_app_user(self):
        self.login_as(self.user)

        data = {'app_user': self.temp_user.username, 'app_role_id': self.app_role.id}
        resp = self.client.post(self.app_users_url, data)
        self.assertEqual(200, resp.status_code)

        json_resp = json.loads(resp.content)
        assert json_resp['app_user']['name'] == email2nickname(self.temp_user.username)
        assert json_resp['app_user']['email'] == self.temp_user.username
        assert json_resp['app_user']['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_user']['role_id'] == self.app_role.id
        assert json_resp['app_user']['role_name'] == self.app_role.role_name
        assert json_resp['app_user']['role_permission'] == self.app_role.role_permission
        assert json_resp['app_user']['is_active'] is True
        assert json_resp['app_user']['avatar_url'] is not None

    def test_can_not_add_universal_app_user(self):
        self.login_as(self.temp_user)
        data = {'app_user': self.temp_user.username, 'app_role_id': self.app_role.id}
        resp = self.client.post(self.app_users_url, data)
        self.assertEqual(403, resp.status_code)

    def test_can_put_universal_app_user(self):
        self.login_as(self.user)

        data = {
            'is_active': 'false'
        }
        resp = self.client.put(self.app_user_url, json.dumps(data), 'application/json')
        self.assertEqual(200, resp.status_code)
        is_active = DTableAppUsers.objects.get(app=self.universal_app, username=self.user.username).is_active
        assert is_active is False

    def test_can_not_put_universal_app_user(self):
        self.login_as(self.temp_user)
        data = {
            'is_active': 'false'
        }
        resp = self.client.put(self.app_user_url, json.dumps(data), 'application/json')
        self.assertEqual(403, resp.status_code)

    def test_delete_universal_app_user(self):
        self.app_user1 = DTableAppUsers.objects.create(
            app=self.universal_app,
            role=self.app_role,
            username=self.admin.username
        )
        self.app_user_url1 = reverse('api-v2.1-dtable-universal-app-user', args=[self.universal_app.app_uuid, self.app_user1.id])
        self.login_as(self.user)
        resp = self.client.delete(self.app_user_url1)
        self.assertEqual(200, resp.status_code)
        assert len(DTableAppUsers.objects.all()) == 1


class AdminDtableUniversalAppRolesTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(self.user.username, self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        app_type = 'universal-app'
        app_name = "test_universal_app"
        self.app_config = json.dumps({'app_type': app_type, "app_name": app_name})
        self.universal_app = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username, app_config=self.app_config)
        self.app_role = DTableAppRoles.objects.generate_app_default_role(self.universal_app)

        self.temp_user = self.create_user('user_%s@test.com' % randstring(4), is_staff=False)
        self.app_roles_url = reverse('api-v2.1-dtable-universal-app-roles', args=[self.universal_app.app_uuid])
        self.app_role_url = reverse('api-v2.1-dtable-universal-app-role', args=[self.universal_app.app_uuid, self.app_role.id])

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)
        self.remove_repo()
        self.remove_user(self.user.email)
        self.remove_user(self.temp_user.email)

    def test_get_universal_app_roles(self):
        self.login_as(self.user)
        resp = self.client.get(self.app_roles_url)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert json_resp['app_roles'][0]['id'] == self.app_role.id
        assert json_resp['app_roles'][0]['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_roles'][0]['role_name'] == self.app_role.role_name
        assert json_resp['app_roles'][0]['role_permission'] == self.app_role.role_permission

    def test_can_not_get_app_roles(self):
        self.login_as(self.temp_user)
        resp = self.client.get(self.app_roles_url)
        self.assertEqual(403, resp.status_code)

    def test_add_universal_app_role(self):
        self.login_as(self.user)
        permission = 'rw'
        role_name = 'test_role'
        data = {'role_name': role_name, 'permission': permission}
        assert permission in permission_tuple
        resp = self.client.post(self.app_roles_url, data)
        self.assertEqual(200, resp.status_code)

        json_resp = json.loads(resp.content)
        assert json_resp['app_role']['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_role']['role_name'] == role_name
        assert json_resp['app_role']['role_permission'] == permission
        assert json_resp['app_role']['role_permission_detail'] is None

    def test_can_not_add_universal_app_role(self):
        self.login_as(self.temp_user)
        permission = 'rw'
        role_name = 'test_role'
        data = {'role_name': role_name, 'permission': permission}
        assert permission in permission_tuple
        resp = self.client.post(self.app_roles_url, data)
        self.assertEqual(403, resp.status_code)

    def test_get_universal_app_role(self):
        self.login_as(self.user)
        resp = self.client.get(self.app_role_url)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert json_resp['app_role']['id'] == self.app_role.id
        assert json_resp['app_role']['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_role']['role_name'] == self.app_role.role_name
        assert json_resp['app_role']['role_permission'] == self.app_role.role_permission
        assert json_resp['app_role']['role_permission_detail'] is None

    def test_can_not_get_universal_app_role(self):
        self.login_as(self.temp_user)
        resp = self.client.get(self.app_role_url)
        self.assertEqual(403, resp.status_code)

    def test_can_put_universal_app_role(self):
        self.login_as(self.user)

        role_name = 'test_role_name'
        permission = 'r'

        data = {
            'role_name': role_name,
            'permission': permission
        }
        resp = self.client.put(self.app_role_url, json.dumps(data), 'application/json')
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert json_resp['app_role']['id'] == self.app_role.id
        assert json_resp['app_role']['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_role']['role_name'] == role_name
        assert json_resp['app_role']['role_permission'] == permission
        assert json_resp['app_role']['role_permission_detail'] is None

    def test_can_not_put_universal_app_role(self):
        self.login_as(self.temp_user)
        role_name = 'test_role_name'
        permission = 'r'
        data = {
            'role_name': role_name,
            'permission': permission
        }
        resp = self.client.put(self.app_role_url, json.dumps(data), 'application/json')
        self.assertEqual(403, resp.status_code)

    def test_can_delete_universal_app_role(self):
        self.login_as(self.user)
        resp = self.client.delete(self.app_role_url)
        self.assertEqual(200, resp.status_code)


class AdminDtableUniversalAppInviteLinksTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(self.user.username, self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        app_type = 'universal-app'
        app_name = "test_universal_app"
        self.app_config = json.dumps({'app_type': app_type, "app_name": app_name})
        self.universal_app = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username, app_config=self.app_config)
        self.app_role = DTableAppRoles.objects.generate_app_default_role(self.universal_app)

        self.app_invite_link = DTableAppInviteLinks.objects.create_link(self.universal_app, self.app_role, self.user.username)

        self.temp_user = self.create_user('user_%s@test.com' % randstring(4), is_staff=False)
        self.app_invite_links_url = reverse('api-v2.1-dtable-universal-app-invite-links', args=[self.universal_app.app_uuid])
        self.app_invite_link_url = reverse('api-v2.1-dtable-universal-invite-link', args=[self.universal_app.app_uuid, self.app_invite_link.token])

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)
        self.remove_repo()
        self.remove_user(self.user.email)
        self.remove_user(self.temp_user.email)

    def test_get_app_invite_links(self):
        self.login_as(self.user)
        resp = self.client.get(self.app_invite_links_url)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert json_resp['app_share_links'][0]['app_id'] == self.universal_app.id
        assert json_resp['app_share_links'][0]['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_share_links'][0]['is_protected'] is False
        assert json_resp['app_share_links'][0]['link'] == gen_share_unversal_app_link(self.app_invite_link.token)
        assert json_resp['app_share_links'][0]['role_id'] == self.app_role.id
        assert json_resp['app_share_links'][0]['role_name'] == self.app_role.role_name
        assert json_resp['app_share_links'][0]['role_permission'] == self.app_role.role_permission
        assert json_resp['app_share_links'][0]['token'] == self.app_invite_link.token
        assert json_resp['app_share_links'][0]['username'] == self.user.username

    def test_can_not_get_app_invite_links(self):
        self.login_as(self.temp_user)
        resp = self.client.get(self.app_invite_links_url)
        self.assertEqual(403, resp.status_code)

    def test_add_app_invite_link(self):
        self.login_as(self.user)
        role_name = self.app_role.role_name
        data = {'role_name': role_name}
        resp = self.client.post(self.app_invite_links_url, data)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)

        assert json_resp['app_share_link']['app_id'] == self.universal_app.id
        assert json_resp['app_share_link']['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['app_share_link']['is_protected'] is False
        assert 'dtable/universal-app/links' in json_resp['app_share_link']['link']
        assert json_resp['app_share_link']['role_id'] == self.app_role.id
        assert json_resp['app_share_link']['role_name'] == role_name
        assert json_resp['app_share_link']['role_permission'] == self.app_role.role_permission
        assert len(json_resp['app_share_link']['token']) == 20
        assert json_resp['app_share_link']['username'] == self.user.username

    def test_can_not_add_universal_app_role(self):
        self.login_as(self.temp_user)
        role_name = self.app_role.role_name
        data = {'role_name': role_name}
        resp = self.client.post(self.app_invite_links_url, data)
        self.assertEqual(403, resp.status_code)

    def test_can_delete_app_invite_link(self):
        self.login_as(self.user)
        resp = self.client.delete(self.app_invite_link_url)
        self.assertEqual(200, resp.status_code)


class AdminDtableUniversalAppsTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(self.user.username, self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        app_type = 'universal-app'
        app_name1 = "test_universal_app1"
        app_name2 = "test_universal_app2"
        self.app_config1 = json.dumps({'app_type': app_type, "app_name": app_name1})
        self.app_config2 = json.dumps({'app_type': app_type, "app_name": app_name2})
        self.universal_app1 = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username, app_config=self.app_config1)
        self.universal_app2 = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username, app_config=self.app_config2)
        self.app_admin_role = DTableAppRoles.objects.generate_app_admin_role(self.universal_app1)
        self.app_default_role = DTableAppRoles.objects.generate_app_default_role(self.universal_app2)

        self.app_user1 = DTableAppUsers.objects.create(
            app=self.universal_app1,
            role=self.app_admin_role,
            username=self.user.username
        )

        self.app_user2 = DTableAppUsers.objects.create(
            app=self.universal_app2,
            role=self.app_default_role,
            username=self.user.username
        )

        self.url = reverse('api-v2.1-dtable-universal-apps')

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)
        self.remove_repo()
        self.remove_user(self.user.email)

    def test_get_universal_apps(self):
        self.login_as(self.user)
        resp = self.client.get(self.url)
        self.assertEqual(200, resp.status_code)

        json_resp = json.loads(resp.content)
        can_use_apps = json_resp['can_use_apps']
        my_managed_apps = json_resp['my_managed_apps']

        assert len(can_use_apps) == 1
        assert len(my_managed_apps) == 1
        assert json_resp['can_use_apps'][0]['app_name'] == json.loads(self.app_config2).get('app_name')
        assert json_resp['can_use_apps'][0]['role_name'] == self.app_default_role.role_name
        assert json_resp['can_use_apps'][0]['permission'] == self.app_default_role.role_permission
        assert json_resp['my_managed_apps'][0]['app_name'] == json.loads(self.app_config1).get('app_name')
        assert json_resp['my_managed_apps'][0]['role_name'] == self.app_admin_role.role_name
        assert json_resp['my_managed_apps'][0]['permission'] == self.app_admin_role.role_permission


class AdminDtableUniversalAppUsersBatchTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(self.user.username, self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        app_type = 'universal-app'
        app_name = "test_universal_app"
        self.app_config = json.dumps({'app_type': app_type, "app_name": app_name})
        self.universal_app = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username, app_config=self.app_config)
        self.app_default_role = DTableAppRoles.objects.generate_app_default_role(self.universal_app)
        self.temp_user1 = self.create_user('user_%s@test.com' % randstring(4), is_staff=False)
        self.temp_user2 = self.create_user('user_%s@test.com' % randstring(4), is_staff=False)

        self.url = reverse('api-v2.1-dtable-universal-app-users-batch', args=[self.universal_app.app_uuid])

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)
        self.remove_repo()
        self.remove_user(self.user.email)
        self.remove_user(self.temp_user1.email)
        self.remove_user(self.temp_user2.email)

    def test_add_universal_app_user_batch(self):
        self.login_as(self.user)
        unknown_role_id = 123
        data = {'users_info': [{'email': self.temp_user1.username, 'role_id': self.app_default_role.id},
                               {'email': self.temp_user2.username, 'role_id': unknown_role_id}
                               ]}
        resp = self.client.post(self.url, json.dumps(data), 'application/json')
        self.assertEqual(200, resp.status_code)

        json_resp = json.loads(resp.content)
        assert len(json_resp['success']) == 1
        assert len(json_resp['failed']) == 1
        assert json_resp['success'][0]['email'] == self.temp_user1.username
        assert json_resp['success'][0]['app_name'] == json.loads(self.app_config).get('app_name')
        assert json_resp['failed'][0]['email'] == self.temp_user2.username


class AdminDtableUniversalAppUsersSyncTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(self.user.username, self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        app_type = 'universal-app'
        app_name = "test_universal_app"
        self.app_config = json.dumps({'app_type': app_type, "app_name": app_name})
        self.universal_app = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username,
                                                                         app_config=self.app_config)

        self.dst_table_id = 'Scp0'
        self.app_user_sync = DTableAppUserSync(app=self.universal_app, dst_table_id=self.dst_table_id, updated_at=datetime.datetime.now())
        self.app_user_sync.save()

        self.url = reverse('api-v2.1-dtable-universal-app-users-sync', args=[self.universal_app.app_uuid])

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)
        self.remove_repo()
        self.remove_user(self.user.email)

    def test_get_universal_app_sync_info(self):
        self.login_as(self.user)
        resp = self.client.get(self.url)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert json_resp['sync_info']['app_id'] == self.universal_app.id
        assert json_resp['sync_info']['table_id'] == self.dst_table_id


class AdminDtableUniversalAppUserLeaveTest(BaseTestCase):

    def setUp(self):
        self.workspace = Workspaces.objects.create_workspace(self.user.username, self.repo.id, -1)
        assert len(Workspaces.objects.all()) == 1
        # create dtable
        seafile_api.post_empty_file(self.repo.id, '/', 'dtable1.dtable', self.user.username)
        self.dtable = DTables.objects.create_dtable(self.user.username, self.workspace, 'dtable1')
        assert len(DTables.objects.all()) == 1

        app_type = 'universal-app'
        app_name = "test_universal_app"
        self.app_config = json.dumps({'app_type': app_type, "app_name": app_name})
        self.universal_app = DTableExternalApps.objects.add_external_app(self.dtable.uuid, app_type, self.user.username, app_config=self.app_config)
        self.app_default_role = DTableAppRoles.objects.generate_app_default_role(self.universal_app)

        self.app_user = DTableAppUsers.objects.create(
            app=self.universal_app,
            role=self.app_default_role,
            username=self.user.username
        )

        self.url = reverse('api-v2.1-dtable-app-users', args=[self.app_user.id])

    def tearDown(self):
        Workspaces.objects.delete_workspace(self.workspace.id)
        self.remove_repo()
        self.remove_user(self.user.email)

    def test_leave_universal_app(self):
        self.login_as(self.user)
        resp = self.client.delete(self.url)
        self.assertEqual(200, resp.status_code)
        json_resp = json.loads(resp.content)
        assert json_resp['success'] is True

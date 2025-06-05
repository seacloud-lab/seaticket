import pytest
from django.urls import reverse

from seaserv import seafile_api

from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_READ
from seahub.dtable.models import Workspaces, DTables, DTableShare, DTableGroupShare
from seahub.dtable.utils import check_dtable_permission, check_dtable_admin_permission, list_dtable_related_users
from seahub.department_v2.models import DepartmentsV2, DepartmentMembersV2
from seahub.group.utils import is_group_admin, is_group_member, get_group_members, \
    get_user_groups
from seahub.test_utils import BaseTestCase

# department
class DepartmentV2Test(BaseTestCase):

    @pytest.fixture(autouse=True)
    def set_department_v2_setting(self, settings):
        settings.ENABLE_ADDRESSBOOK_V2 = True

    def setUp(self):
        self.login_as(self.admin)

    def tearDown(self):
        self.logout()

    # test create department
    def test_department(self):
        # create
        url = reverse('api-v2.1-admin-address-book-v2-departments')
        parent_id = -1
        department_name = 'top-department'
        data = {
            'parent_id': parent_id,
            'name': department_name
        }
        resp = self.client.post(url, data)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        department = resp_json['department']
        self.assertEqual(department_name, department['name'])

        # update
        url = reverse('api-v2.1-admin-address-book-v2-department', args=(department['id'],))
        new_department_name = 'new-top-department'
        data = {
            'name': new_department_name
        }
        resp = self.client.put(url, data, content_type='application/json')
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        department = resp_json['department']
        self.assertEqual(new_department_name, department['name'])

        # delete
        url = reverse('api-v2.1-admin-address-book-v2-department', args=(department['id'],))
        resp = self.client.delete(url)
        self.assertEqual(200, resp.status_code)


# department member
class DepartmentV2MembersTest(BaseTestCase):

    @pytest.fixture(autouse=True)
    def set_department_v2_setting(self, settings):
        settings.ENABLE_ADDRESSBOOK_V2 = True

    def setUp(self):
        self.login_as(self.admin)
        self.department = DepartmentsV2.objects.create_department('top-department', -1, -1)

    def tearDown(self):
        self.department.delete()
        self.logout()

    def test_department_v2_members(self):
        # add member
        url = reverse('api-v2.1-admin-address-book-v2-department-members', args=(self.department.id,))
        data = {'email': self.admin.username}
        resp = self.client.post(url, data)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        success, failed = resp_json['success'], resp_json['failed']
        self.assertEqual(1, len(success))
        self.assertEqual(0, len(failed))

        # get members
        url = reverse('api-v2.1-admin-address-book-v2-department-members', args=(self.department.id,))
        resp = self.client.get(url)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        member_list = resp_json['member_list']
        self.assertEqual(1, len(member_list))

        # update member
        put_url = reverse('api-v2.1-admin-address-book-v2-department-member', args=(self.department.id, self.admin.username))
        data = {
            'is_staff': 'True'
        }
        resp = self.client.put(put_url, data, content_type='application/json')
        self.assertEqual(200, resp.status_code)
        url = reverse('api-v2.1-admin-address-book-v2-department-members', args=(self.department.id,))
        resp = self.client.get(url)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        member_list = resp_json['member_list']
        admin_member = member_list[0]
        self.assertEqual(True, admin_member['is_staff'])

        # delete member
        delete_url = reverse('api-v2.1-admin-address-book-v2-department-member', args=(self.department.id, self.admin.username))
        resp = self.client.delete(delete_url)
        self.assertEqual(200, resp.status_code)


# department group
class DepartmentV2GroupTest(BaseTestCase):

    @pytest.fixture(autouse=True)
    def set_department_v2_setting(self, settings):
        settings.ENABLE_ADDRESSBOOK_V2 = True

    def setUp(self):
        self.login_as(self.admin)
        self.department = DepartmentsV2.objects.create_department('top-department', -1, -1)

    def tearDown(self):
        self.department.delete()
        self.logout()

    def test_department_v2_group(self):
        url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
        # get
        resp = self.client.get(url)
        self.assertEqual(404, resp.status_code)
        # create
        resp = self.client.post(url)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        group_id = resp_json.get('group_id')
        group_name = resp_json.get('group_name')
        self.assertIsNotNone(group_id)
        self.assertIsNotNone(group_name)


# department-group utils
class DepartmentV2GroupUtilsTest(BaseTestCase):

    @pytest.fixture(autouse=True)
    def set_department_v2_setting(self, settings):
        settings.ENABLE_ADDRESSBOOK_V2 = True

    def setUp(self):
        self.login_as(self.admin)
        self.department = DepartmentsV2.objects.create_department('top-department', -1, -1)
        # add members
        DepartmentMembersV2.objects.bulk_add_users([self.admin.username, self.user.username], self.department.id)
        # set admin is_staff=True user is_staff=False
        DepartmentMembersV2.objects.filter(department=self.department, username=self.admin.username).update(is_staff=True)
        DepartmentMembersV2.objects.filter(department=self.department, username=self.user.username).update(is_staff=False)
        # create department group
        url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
        resp = self.client.post(url)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        self.group_id = resp_json.get('group_id')
        self.group_name = resp_json.get('group_name')

    def tearDown(self):
        url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
        self.client.delete(url)
        self.department.delete()
        self.logout()

    def test_group_utils(self):
        # member
        self.assertTrue(is_group_member(self.group_id, self.admin.username))
        self.assertTrue(is_group_member(self.group_id, self.user.username))
        # admin
        self.assertTrue(is_group_admin(self.group_id, self.admin.username))
        self.assertFalse(is_group_admin(self.group_id, self.user.username))
        # group members
        members = get_group_members(self.group_id)
        self.assertEqual(2, len(members))
        for member in members:
            if member['username'] == self.admin.username:
                self.assertTrue(member['is_staff'])
            elif member['username'] == self.user.username:
                self.assertFalse(member['is_staff'])
        # TODO: django can not access ccnet-db in test cases, 
        # so some functions access ccnet-db by raw sql can not be tested
        # user groups
        # TODO: fix unittest by using mysql!
        # groups = get_user_groups(self.admin.username)
        # self.assertEqual(1, len(groups))
        # self.assertEqual(self.group_id, groups[0].id)


# department group dtable
class DepartmentV2DTableTest(BaseTestCase):

    @pytest.fixture(autouse=True)
    def set_department_v2_setting(self, settings):
        settings.ENABLE_ADDRESSBOOK_V2 = True

    def setUp(self):
        self.login_as(self.admin)
        self.department = DepartmentsV2.objects.create_department('top-department', -1, -1)
        DepartmentMembersV2.objects.bulk_add_users([self.admin.username], self.department.id)
        # create department group
        url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
        resp = self.client.post(url)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        self.group_id = resp_json.get('group_id')
        self.group_name = resp_json.get('group_name')
        self.owner = '%s@seafile_group' % self.group_id
        self.workspace = Workspaces.objects.get_workspace_by_owner(self.owner)

    def tearDown(self):
        url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
        self.client.delete(url)
        self.department.delete()
        self.logout()


# test dtable permission
# TODO: fix unittest by using mysql!
# class DepartmentV2DTablePermissionTest(BaseTestCase):

#     @pytest.fixture(autouse=True)
#     def set_department_v2_setting(self, settings):
#         settings.ENABLE_ADDRESSBOOK_V2 = True

#     def setUp(self):
#         self.login_as(self.admin)
#         self.department = DepartmentsV2.objects.create_department('top-department', -1, -1)
#         DepartmentMembersV2.objects.bulk_add_users([self.admin.username], self.department.id)
#         # create department group
#         url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
#         resp = self.client.post(url)
#         self.assertEqual(200, resp.status_code)
#         resp_json = resp.json()
#         self.group_id = resp_json.get('group_id')
#         self.group_name = resp_json.get('group_name')
#         self.owner = '%s@seafile_group' % self.group_id
#         self.workspace = Workspaces.objects.get_workspace_by_owner(self.owner)
#         # add dtable
#         self.dtable = DTables.objects.create_dtable(self.admin.username, self.workspace, 'demo')
#         # user workspace and dtable
#         self.user_repo_id = seafile_api.create_repo('Seatable', 'Seatable', self.user.username)
#         self.user_workspace = Workspaces.objects.create_workspace(self.user.username, self.user_repo_id, -1)
#         self.user_dtable = DTables.objects.create_dtable(self.user.username, self.user_workspace, 'user-demo')

#     def tearDown(self):
#         url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
#         self.client.delete(url)
#         # delete admin dtable workspace repo
#         Workspaces.objects.delete_workspace(self.workspace.id)
#         seafile_api.remove_repo(self.workspace.repo_id)
#         # delete user dtable workspace repo
#         Workspaces.objects.delete_workspace(self.user_workspace.id)
#         seafile_api.remove_repo(self.user_workspace.repo_id)
#         self.department.delete()
#         self.logout()

#     def test_dtable_permission(self):
#         # admin(in dep) permission
#         permission = check_dtable_permission(self.admin.username, self.workspace, self.dtable)
#         self.assertEqual(PERMISSION_READ_WRITE, permission)
#         # user(not in dep and no share) permission
#         permission = check_dtable_permission(self.user.username, self.workspace, self.dtable)
#         self.assertIsNone(permission)
#         # share dtable to user with permission 'r'
#         share_obj = DTableShare.objects.add(self.dtable, self.admin.username, self.user.username, PERMISSION_READ)
#         permission = check_dtable_permission(self.user.username, self.workspace, self.dtable)
#         self.assertEqual(PERMISSION_READ, permission)
#         # drop share
#         share_obj.delete()
#         # add user to dpeartment
#         DepartmentMembersV2.objects.bulk_add_users([self.user.username], self.department.id)
#         permission = check_dtable_permission(self.user.username, self.workspace, self.dtable)
#         self.assertEqual(PERMISSION_READ_WRITE, permission)
#         # drop member
#         DepartmentMembersV2.objects.filter(department=self.department, username=self.user.username).delete()
#         # share user dtable to department group with permission 'r'
#         group_share_obj = DTableGroupShare.objects.create(
#             dtable=self.user_dtable,
#             group_id=self.group_id,
#             permission=PERMISSION_READ,
#             created_by=self.user.username
#         )
#         permission = check_dtable_permission(self.admin.username, self.user_workspace, self.user_dtable)
#         self.assertEqual(PERMISSION_READ, permission)
#         # drop group share
#         group_share_obj.delete()

#     def test_dtable_admin_permission(self):
#         permission = check_dtable_admin_permission(self.admin.username, self.owner)
#         self.assertFalse(permission)
#         # set admin is_staff=True
#         DepartmentMembersV2.objects.filter(department=self.department, username=self.admin.username).update(is_staff=True)
#         permission = check_dtable_admin_permission(self.admin.username, self.owner)
#         self.assertTrue(permission)


class DepartmentV2DTableRelatedUsersTest(BaseTestCase):

    @pytest.fixture(autouse=True)
    def set_department_v2_setting(self, settings):
        settings.ENABLE_ADDRESSBOOK_V2 = True

    def setUp(self):
        self.login_as(self.admin)
        self.department = DepartmentsV2.objects.create_department('top-department', -1, -1)
        DepartmentMembersV2.objects.bulk_add_users([self.admin.username], self.department.id)
        # create department group
        url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
        resp = self.client.post(url)
        self.assertEqual(200, resp.status_code)
        resp_json = resp.json()
        self.group_id = resp_json.get('group_id')
        self.group_name = resp_json.get('group_name')
        self.owner = '%s@seafile_group' % self.group_id
        self.workspace = Workspaces.objects.get_workspace_by_owner(self.owner)
        # add dtable
        self.dtable = DTables.objects.create_dtable(self.admin.username, self.workspace, 'demo')
        # user workspace and dtable
        self.user_repo_id = seafile_api.create_repo('Seatable', 'Seatable', self.user.username)
        self.user_workspace = Workspaces.objects.create_workspace(self.user.username, self.user_repo_id, -1)
        self.user_dtable = DTables.objects.create_dtable(self.user.username, self.user_workspace, 'user-demo')
        # share department group dtable to user
        self.user_share_obj = DTableShare.objects.add(self.dtable, self.admin.username, self.user.username, PERMISSION_READ)
        # share user dtable to department group
        self.group_share_obj = DTableGroupShare.objects.create(
            dtable=self.user_dtable,
            group_id=self.group_id,
            permission=PERMISSION_READ,
            created_by=self.user.username
        )

    def tearDown(self):
        url = reverse('api-v2.1-admin-address-book-v2-department-group', args=(self.department.id,))
        self.client.delete(url)
        # delete admin dtable workspace repo
        self.user_share_obj.delete()
        Workspaces.objects.delete_workspace(self.workspace.id)
        seafile_api.remove_repo(self.workspace.repo_id)
        # delete user dtable workspace repo
        self.group_share_obj.delete()
        Workspaces.objects.delete_workspace(self.user_workspace.id)
        seafile_api.remove_repo(self.user_workspace.repo_id)
        self.department.delete()
        self.logout()

    def test_related_users(self):
        related_users = list_dtable_related_users(self.workspace, self.dtable)
        self.assertEqual(2, len(related_users))
        self.assertIn(self.admin.username, related_users)
        self.assertIn(self.user.username, related_users)
        related_users = list_dtable_related_users(self.user_workspace, self.user_dtable)
        self.assertEqual(2, len(related_users))
        self.assertIn(self.admin.username, related_users)
        self.assertIn(self.user.username, related_users)

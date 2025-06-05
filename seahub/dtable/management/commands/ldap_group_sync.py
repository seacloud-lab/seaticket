# -*- coding: utf-8 -*-
import logging
import uuid
from datetime import datetime

from django.core.management.base import BaseCommand

from seaserv import ccnet_api

from seahub.utils import is_pro_version
from seahub.auth.models import SocialAuthUser
from seahub.group.models import GroupIDLDAPUUIDPair
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.utils import create_repo_and_workspace
from seahub.settings import LDAP_SYNC_GROUP, LDAP_GROUP_FILTER, LDAP_GROUP_OBJECT_CLASS, LDAP_GROUP_UUID_ATTR, \
     LDAP_GROUP_MEMBER_ATTR, LDAP_USER_OBJECT_CLASS, LDAP_GROUP_MEMBER_UID_ATTR, SYNC_GROUP_AS_DEPARTMENT, \
     LDAP_DEPARTMENT_NAME_ATTR, ENABLE_SASL, SASL_MECHANISM, ENABLE_ADDRESSBOOK_V2
from seahub.department_v2.models import DepartmentsV2, DepartmentMembersV2

try:
    import ldap
    import ldap.sasl
    from ldap.controls.libldap import SimplePagedResultsControl
    from seahub.settings import LDAP_SERVER_URL, LDAP_BASE_DN, LDAP_ADMIN_DN, LDAP_ADMIN_PASSWORD, \
        LDAP_LOGIN_ATTR, LDAP_PROVIDER
except ImportError:
    ldap = None
    SimplePagedResultsControl = None
    LDAP_SERVER_URL = ''
    LDAP_BASE_DN = ''
    LDAP_ADMIN_DN = ''
    LDAP_ADMIN_PASSWORD = ''
    LDAP_LOGIN_ATTR = ''
    LDAP_PROVIDER = ''

try:
    from seahub.settings import LDAP_USER_UNIQUE_ID
except ImportError:
    LDAP_USER_UNIQUE_ID = ''

logger = logging.getLogger(__name__)


def bytes2str(data):
    if isinstance(data, bytes):
        try:
            return data.decode()
        except UnicodeDecodeError:
            return str(uuid.UUID(bytes=data))
    elif isinstance(data, dict):
        return dict(map(bytes2str, data.items()))
    elif isinstance(data, tuple):
        return tuple(map(bytes2str, data))
    elif isinstance(data, list):
        return list(map(bytes2str, data))
    elif isinstance(data, set):
        return set(map(bytes2str, data))
    else:
        return data


def search_ldap_data(base_dn, ldap_conn, scope, filterstr, attrlist):
    result_list = list()
    ctrl = SimplePagedResultsControl(True, size=100, cookie='')
    while True:
        try:
            res = ldap_conn.search_ext(base_dn, scope, filterstr, attrlist, serverctrls=[ctrl])
            rtype, rdata, rmsgid, ctrls = ldap_conn.result3(res)
        except ldap.LDAPError as e:
            logger.error('Search failed for base dn(%s), filter(%s) on server %s, error: %s'
                         % (base_dn, filterstr, LDAP_SERVER_URL, e))
            return None

        result_list.extend(rdata)
        page_ctrls = [c for c in ctrls if c.controlType == SimplePagedResultsControl.controlType]
        if not page_ctrls or not page_ctrls[0].cookie:
            break
        ctrl.cookie = page_ctrls[0].cookie
    result_list = bytes2str(result_list)
    return result_list


def diff_members(members_db, members_ldap):
    i = 0
    j = 0
    members_db_len = len(members_db)
    members_ldap_len = len(members_ldap)
    add_list = []
    del_list = []

    while i < members_db_len and j < members_ldap_len:
        if members_db[i] == members_ldap[j]:
            i += 1
            j += 1
        elif members_db[i] > members_ldap[j]:
            add_list.append(members_ldap[j])
            j += 1
        else:
            del_list.append(members_db[i])
            i += 1

    del_list.extend(members_db[i:])
    add_list.extend(members_ldap[j:])

    return add_list, del_list


def get_super_user():
    super_users = ccnet_api.get_superusers()
    if super_users is None or len(super_users) == 0:
        super_user = 'system admin'
    else:
        super_user = super_users[0].email
    return super_user


class LdapGroup(object):
    def __init__(self, name, creator, members, group_id=0, parent_uuid=None, is_department=False):
        self.name = name
        self.creator = creator
        self.members = members
        self.group_id = group_id
        self.parent_uuid = parent_uuid
        self.is_department = is_department


class Command(BaseCommand):
    help = 'ldap group sync'
    label = "ldap_group_sync"

    def __init__(self):
        BaseCommand.__init__(self)
        self.added_group = 0
        self.updated_group = 0
        self.deleted_group = 0
        self.sort_list = list()
        self.use_department_v2 = SYNC_GROUP_AS_DEPARTMENT and ENABLE_ADDRESSBOOK_V2

    def handle(self, *args, **options):
        if not is_pro_version() or not LDAP_SYNC_GROUP:
            logger.info('ldap not enabled')
            return

        logger.info('Start ldap group sync...')
        self.stdout.write('[%s] Start ldap group sync...\n' % datetime.now())

        groups_from_db = self.get_groups_from_db()
        groups_from_ldap = self.get_groups_from_ldap()

        try:
            self.do_action(groups_from_db, groups_from_ldap)
        except Exception as e:
            self.stderr.write('[%s] ldap group sync failed: %s' % (datetime.now(), e))
            logger.error('ldap group sync failed: %s' % e)

        self.stdout.write('[%s] LDAP group sync result: add [%d] group, update [%d] group, delete [%d] group.\n' %
                          (datetime.now(), self.added_group, self.updated_group, self.deleted_group))
        logger.info('LDAP group sync result: add [%d] group, update [%d] group, delete [%d] group.' %
                    (self.added_group, self.updated_group, self.deleted_group))
        self.stdout.write('[%s] Finish ldap group sync.\n' % datetime.now())
        logger.info('Finish ldap group sync.')

    def do_action(self, groups_from_db, groups_from_ldap):
        if self.use_department_v2:
            self.do_action_v2(groups_from_db, groups_from_ldap)
            return

        group_id_uuid_pair_query = GroupIDLDAPUUIDPair.objects.all()
        group_id_uuid_pairs = list()
        for obj in group_id_uuid_pair_query:
            data = dict(group_id=obj.group_id)
            data['group_uuid'] = obj.group_uuid
            group_id_uuid_pairs.append(data)

        if group_id_uuid_pairs is None:
            logger.warning('get group uuid pairs from db failed.')
            return

        group_uuid_pairs = dict()
        group_uuid_db = dict()

        for pair in group_id_uuid_pairs:
            group_uuid_pairs[str(pair['group_uuid'])] = pair['group_id']
            group_uuid_db[str(pair['group_uuid'])] = pair['group_id']

        # Sync deleted group in ldap to db. Delete in reversed group id order
        reversed_dict_by_group_id = {
            k: v for k, v in reversed(sorted(group_uuid_pairs.items(), key=lambda item: item[1]))}
        for k in reversed_dict_by_group_id:
            if group_uuid_pairs[k] in groups_from_db and k not in groups_from_ldap:
                group_uuid_db.pop(k)

                # delete group's bases
                owner = '%s@seafile_group' % group_uuid_pairs[k]
                workspace = Workspaces.objects.filter(owner=owner).first()
                try:
                    DTables.objects.filter(workspace=workspace, deleted=False).delete()
                except Exception as e:
                    logger.error('Failed to delete bases, workspace owner: %s, error: %s' % (owner, e))
                # mark group's workspace as deleted
                try:
                    Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now())
                except Exception as e:
                    logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
                # remove group and group_id_uuid_pair
                ret = ccnet_api.remove_group(group_uuid_pairs[k])
                GroupIDLDAPUUIDPair.objects.filter(group_id=group_uuid_pairs[k]).delete()

                if ret < 0:
                    logger.warning('remove group %s failed.' % group_uuid_pairs[k])
                    continue
                logger.info('remove group %s success.' % group_uuid_pairs[k])
                self.deleted_group += 1

        # ldap_tuples = [('uuid', LdapGroup)...]
        ldap_tuples = self.sort_list
        for k, v in ldap_tuples:
            if k in group_uuid_pairs:
                v.group_id = group_uuid_pairs[k]
                # group data lost in db
                if group_uuid_pairs[k] not in groups_from_db:
                    continue

                group_id = group_uuid_pairs[k]
                # update group name
                if v.name != groups_from_db[group_id].name:
                    ret = ccnet_api.set_group_name(group_id, v.name)
                    if ret < 0:
                        logger.warning('rename group %s failed.' % group_id)
                        continue
                    logger.info('rename group %s success.' % group_id)

                add_list, del_list = diff_members(groups_from_db[group_id].members, v.members)
                if len(add_list) > 0 or len(del_list) > 0:
                    self.updated_group += 1

                for member in del_list:
                    if groups_from_db[group_id].creator == member:
                        continue
                    ret = ccnet_api.group_remove_member(group_id, groups_from_db[group_id].creator, member)
                    if ret < 0:
                        logger.warning('remove member %s from group %s failed.' % (member, group_id))
                        continue
                    logger.info('remove member %s from group %s success.' % (member, group_id))

                for member in add_list:
                    if not member:
                        continue
                    ret = ccnet_api.group_add_member(group_id, groups_from_db[group_id].creator, member)
                    if ret < 0:
                        logger.warning('add member %s to group %s failed.' % (member, group_id))
                        continue
                    logger.info('add member %s to group %s success.' % (member, group_id))

                from seahub.dtable.utils import clean_related_users_cache_by_group
                clean_related_users_cache_by_group(group_id)
            else:
                self.create_and_add_group_to_db(k, v, group_uuid_db, groups_from_ldap)

    def create_and_add_group_to_db(self, group_uuid, group, group_uuid_db, groups_from_ldap):
        if group.is_department and group_uuid in group_uuid_db:
            return group_uuid_db[group_uuid]

        if group.is_department:
            super_user = 'system admin'
        else:
            super_user = get_super_user()

        if group.is_department:
            if not group.parent_uuid:
                parent_id = -1
            elif group.parent_uuid in group_uuid_db:
                parent_id = group_uuid_db[group.parent_uuid]
            else:
                parent_group = groups_from_ldap[group.parent_uuid]
                parent_id = self.create_and_add_group_to_db(
                    group.parent_uuid, parent_group, group_uuid_db, groups_from_ldap)
        else:
            parent_id = 0

        try:
            group_id = ccnet_api.create_group(group.name, super_user, 'LDAP', parent_id)
        except Exception as e:
            logger.warning('create ldap group [%s] failed. Error: %s' % (group.name, e))
            return

        if group_id < 0:
            logger.warning('create ldap group [%s] failed.' % group.name)
            return

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            try:
                create_repo_and_workspace(owner, -1)
            except Exception as e:
                logger.error('failed to create workspace for group %s, error: %s' % (group_id, e))
                return

        try:
            GroupIDLDAPUUIDPair.objects.add_group_id_uuid_pair(group_id, group_uuid)
        except Exception as e:
            logger.warning('add group uuid pair %s<->%s failed, error: %s' % (group_id, group_uuid, e))
            # admin should remove created group manually in web
            return
        logger.info('create group %s, and add uuid pair %s<->%s success.' % (group_id, group_uuid, group_id))
        self.added_group += 1

        group.group_id = group_id
        for member in group.members:
            if not member:
                continue
            ret = ccnet_api.group_add_member(group_id, super_user, member)
            if ret < 0:
                logger.warning('add member %s to group %s failed.' % (member, group_id))
                return
            logger.info('add member %s to group %s success.' % (member, group_id))

        group_uuid_db[group_uuid] = group_id
        return group_id

    def get_groups_from_db(self):
        if self.use_department_v2:
            return self.get_departments_v2_from_db()

        groups_from_db = None
        groups = ccnet_api.get_all_groups(-1, -1)
        if groups is None:
            logger.warning('get groups from db failed.')
            return groups_from_db

        # remove not exist group's uuid_pair
        group_ids = [int(group.id) for group in groups]
        GroupIDLDAPUUIDPair.objects.exclude(group_id__in=group_ids).delete()

        groups_from_db = dict()
        for group in groups:
            group_members = ccnet_api.get_group_members(group.id)
            if group_members is None:
                logger.warning('get members of group %s from db failed.' % group.id)
                groups_from_db = None
                break

            members = []
            for member in group_members:
                members.append(member.user_name)
            if group.parent_group_id == 0:
                groups_from_db[group.id] = LdapGroup(
                    group.group_name, group.creator_name, sorted(members), 0, None)
            else:
                groups_from_db[group.id] = LdapGroup(
                    group.group_name, group.creator_name, sorted(members), 0, None, True)

        return groups_from_db

    def get_groups_from_ldap(self):
        ldap_conn = ldap.initialize(LDAP_SERVER_URL)
        try:
            ldap_conn.set_option(ldap.OPT_REFERRALS, 0)
        except Exception as e:
            logger.error('Failed to set referrals option: %s' % e)
            return
        try:
            ldap_conn.protocol_version = ldap.VERSION3
            if ENABLE_SASL and SASL_MECHANISM:
                sasl_cb_value_dict = {}
                if SASL_MECHANISM != 'EXTERNAL' and SASL_MECHANISM != 'GSSAPI':
                    sasl_cb_value_dict = {
                        ldap.sasl.CB_AUTHNAME: LDAP_ADMIN_DN,
                        ldap.sasl.CB_PASS: LDAP_ADMIN_PASSWORD,
                    }
                sasl_auth = ldap.sasl.sasl(sasl_cb_value_dict, SASL_MECHANISM)
                ldap_conn.sasl_interactive_bind_s('', sasl_auth)
            else:
                ldap_conn.simple_bind_s(LDAP_ADMIN_DN, LDAP_ADMIN_PASSWORD)
        except Exception as e:
            logger.error('ldap admin bind failed: %s' % e)
            return

        if LDAP_GROUP_FILTER:
            filterstr = '(&(objectClass=%s)(%s))' % (LDAP_GROUP_OBJECT_CLASS, LDAP_GROUP_FILTER)
        else:
            filterstr = '(objectClass=%s)' % LDAP_GROUP_OBJECT_CLASS

        if LDAP_GROUP_FILTER:
            ou_filterstr = '(&(|(objectClass=organizationalUnit)(objectClass=%s))(%s))' % (
                LDAP_USER_OBJECT_CLASS, LDAP_GROUP_FILTER)
        else:
            ou_filterstr = '(|(objectClass=organizationalUnit)(objectClass=%s))' % LDAP_USER_OBJECT_CLASS

        uid_username_map = dict()
        ldap_users = SocialAuthUser.objects.filter(provider=LDAP_PROVIDER)
        for user in ldap_users:
            if user.uid not in uid_username_map:
                uid_username_map[user.uid] = user.username

        department_data_ldap = dict()
        if SYNC_GROUP_AS_DEPARTMENT:
            department_data_ldap = self.get_ou_data(ldap_conn, ou_filterstr, uid_username_map)

        if LDAP_GROUP_OBJECT_CLASS == 'posixGroup':
            group_data_ldap = self.get_posix_group_data(ldap_conn, filterstr, uid_username_map)
        else:
            group_data_ldap = self.get_common_group_data(ldap_conn, filterstr, uid_username_map)

        groups_from_ldap = department_data_ldap.copy()
        groups_from_ldap.update(group_data_ldap)

        ldap_conn.unbind_s()
        return groups_from_ldap

    def get_common_group_data(self, ldap_conn, filterstr, uid_username_map):
        groups_from_ldap = dict()

        # get ldap group members
        base_dns = LDAP_BASE_DN.split(';')
        for base_dn in base_dns:
            if base_dn == '':
                continue

            result_list = search_ldap_data(base_dn, ldap_conn, ldap.SCOPE_SUBTREE, filterstr,
                                           [LDAP_GROUP_MEMBER_ATTR, 'cn'])
            for result in result_list:
                group_dn, attrs = result
                if not isinstance(attrs, dict):
                    continue
                self.get_group_member_from_ldap(ldap_conn, group_dn, groups_from_ldap, uid_username_map, None, depth=1)

        self.sort_list.extend(list(groups_from_ldap.items()))
        return groups_from_ldap

    def get_group_member_from_ldap(self, ldap_conn, base_dn, groups_from_ldap, uid_username_map, parent_uuid, depth=1):
        if depth > 50:
            logger.error('50 recursion depth exceeded, this group is unusual.')
            return
        depth += 1

        all_uids = []
        members = []
        filterstr = '(|(objectClass=%s)(objectClass=%s))' % (LDAP_GROUP_OBJECT_CLASS, LDAP_USER_OBJECT_CLASS)
        result = ldap_conn.search_s(base_dn, ldap.SCOPE_BASE, filterstr,
                                    [LDAP_USER_UNIQUE_ID, LDAP_LOGIN_ATTR, 'cn',
                                     LDAP_GROUP_UUID_ATTR, LDAP_DEPARTMENT_NAME_ATTR])
        if not result:
            return []
        result = bytes2str(result)

        dn, attrs = result[0]
        if not isinstance(attrs, dict):
            return all_uids

        group_uuid = attrs[LDAP_GROUP_UUID_ATTR][0]
        if group_uuid in groups_from_ldap:
            if not groups_from_ldap[group_uuid].parent_uuid:
                groups_from_ldap[group_uuid].parent_uuid = parent_uuid
            return groups_from_ldap[group_uuid].members

        result = ldap_conn.search_s(base_dn, ldap.SCOPE_BASE, filterstr, [LDAP_GROUP_MEMBER_ATTR])
        if not result:
            return all_uids

        result = bytes2str(result)
        if LDAP_GROUP_MEMBER_ATTR in result[0][1]:
            attrs[LDAP_GROUP_MEMBER_ATTR] = result[0][1][LDAP_GROUP_MEMBER_ATTR]

        # group
        if LDAP_GROUP_MEMBER_ATTR in attrs and attrs[LDAP_GROUP_MEMBER_ATTR] != ['']:
            for member in attrs[LDAP_GROUP_MEMBER_ATTR]:
                uids = self.get_group_member_from_ldap(
                    ldap_conn, member, groups_from_ldap, uid_username_map, group_uuid, depth)
                if not uids:
                    continue
                members.extend([uid_username_map.get(uid, '') for uid in uids if uid_username_map.get(uid, '')])
                all_uids.extend(uids)

        # member
        elif LDAP_LOGIN_ATTR in attrs:
            for uid in attrs[LDAP_LOGIN_ATTR]:
                if uid_username_map.get(uid, ''):
                    members.append(uid_username_map.get(uid, ''))
                all_uids.append(uid.lower())
            if LDAP_USER_UNIQUE_ID in attrs:
                for uid in attrs[LDAP_USER_UNIQUE_ID]:
                    if uid_username_map.get(uid, ''):
                        members.append(uid_username_map.get(uid, ''))
                    all_uids.append(uid.lower())
            return all_uids

        if SYNC_GROUP_AS_DEPARTMENT:
            name = self.get_department_name(attrs, attrs['cn'][0])
        else:
            name = attrs['cn'][0]
        groups_from_ldap[group_uuid] = LdapGroup(
            name, None, sorted(set(members)), 0, parent_uuid, SYNC_GROUP_AS_DEPARTMENT)

        return all_uids

    def get_posix_group_data(self, ldap_conn, filterstr, uid_username_map):
        groups_from_ldap = dict()
        sort_list = []

        base_dns = LDAP_BASE_DN.split(';')
        for base_dn in base_dns:
            if base_dn == '':
                continue

            result_list = search_ldap_data(base_dn, ldap_conn, ldap.SCOPE_SUBTREE, filterstr,
                                           [LDAP_GROUP_MEMBER_ATTR, 'cn', LDAP_GROUP_UUID_ATTR,
                                            LDAP_DEPARTMENT_NAME_ATTR])
            for result in result_list:
                group_dn, attrs = result
                if not isinstance(attrs, dict):
                    continue
                group_uuid = attrs[LDAP_GROUP_UUID_ATTR][0]

                # empty group
                if LDAP_GROUP_MEMBER_ATTR not in attrs:
                    groups_from_ldap[group_uuid] = LdapGroup(
                        attrs['cn'][0], None, [], 0, None, SYNC_GROUP_AS_DEPARTMENT)
                    continue

                if group_uuid in groups_from_ldap:
                    if SYNC_GROUP_AS_DEPARTMENT:
                        name = self.get_department_name(attrs, attrs['cn'][0])
                    else:
                        name = attrs['cn'][0]
                    groups_from_ldap[group_uuid] = LdapGroup(name, None, [], 0, None, SYNC_GROUP_AS_DEPARTMENT)
                    continue

                members = []
                for member in attrs[LDAP_GROUP_MEMBER_ATTR]:
                    uids = self.get_posix_group_member_from_ldap(ldap_conn, base_dn, member)
                    if not uids:
                        continue
                    members.extend(
                        [uid_username_map.get(uid, '') for uid in uids if uid_username_map.get(uid, '')])

                groups_from_ldap[group_uuid] = LdapGroup(
                    attrs['cn'][0], None, sorted(set(members)), 0, None, SYNC_GROUP_AS_DEPARTMENT)
                sort_list.append((group_uuid, groups_from_ldap[group_uuid]))

        self.sort_list.extend(sort_list)
        return groups_from_ldap

    def get_posix_group_member_from_ldap(self, ldap_conn, base_dn, member):
        all_uids = []
        filterstr = '(&(objectClass=%s)(%s=%s))' % (LDAP_USER_OBJECT_CLASS, LDAP_GROUP_MEMBER_UID_ATTR, member)
        results = ldap_conn.search_s(base_dn, ldap.SCOPE_SUBTREE, filterstr,
                                     [LDAP_USER_UNIQUE_ID, LDAP_LOGIN_ATTR, 'cn'])
        results = bytes2str(results)
        if not results:
            return []

        for result in results:
            dn, attrs = result
            if not isinstance(attrs, dict):
                continue
            if LDAP_LOGIN_ATTR in attrs:
                for uid in attrs[LDAP_LOGIN_ATTR]:
                    all_uids.append(uid.lower())
                if LDAP_USER_UNIQUE_ID in attrs:
                    for uid in attrs[LDAP_USER_UNIQUE_ID]:
                        all_uids.append(uid.lower())

        return all_uids

    def get_ou_data(self, ldap_conn, filters, uid_username_map):
        ou_data = dict()
        base_dns = LDAP_BASE_DN.split(';')
        for base_dn in base_dns:
            if base_dn == '':
                continue

            s_idx = base_dn.find('=') + 1
            e_idx = base_dn.find(',')
            if e_idx == -1:
                e_idx = len(base_dn)
            name = base_dn[s_idx:e_idx]

            result = ldap_conn.search_s(base_dn, ldap.SCOPE_BASE, filters,
                                        ['ou', LDAP_GROUP_UUID_ATTR, LDAP_DEPARTMENT_NAME_ATTR])
            if not result:
                continue

            result = bytes2str(result)
            dn, attrs = result[0]
            if not isinstance(attrs, dict):
                continue

            group_uuid = attrs[LDAP_GROUP_UUID_ATTR][0]
            if 'ou' in attrs:
                ou_name = self.get_department_name(attrs, attrs['ou'][0])
            else:
                ou_name = name

            self.get_ou_member(ldap_conn, base_dn, filters, ou_name, group_uuid, None, ou_data, uid_username_map)

        self.sort_list.extend(list(ou_data.items()))
        return ou_data

    def get_ou_member(self, ldap_conn, base_dn, filters, ou_name, group_uuid, parent_uuid, ou_data, uid_username_map):
        all_uids = list()
        members = list()

        results = search_ldap_data(base_dn, ldap_conn, ldap.SCOPE_ONELEVEL, filters,
                                   [LDAP_USER_UNIQUE_ID, LDAP_LOGIN_ATTR, 'ou',
                                    LDAP_GROUP_UUID_ATTR, LDAP_DEPARTMENT_NAME_ATTR])
        results = bytes2str(results)

        # empty ou
        if not results:
            group = LdapGroup(ou_name, None, [], 0, parent_uuid, True)
            ou_data[group_uuid] = group
            return all_uids

        for pair in results:
            member_dn, attrs = pair
            if not isinstance(attrs, dict):
                continue

            # member
            if LDAP_LOGIN_ATTR in attrs and ('ou=' in base_dn or 'OU=' in base_dn):
                uid = attrs[LDAP_LOGIN_ATTR][0]
                if uid_username_map.get(uid, ''):
                    members.append(uid_username_map.get(uid, ''))
                all_uids.append(uid.lower())
                if LDAP_USER_UNIQUE_ID in attrs:
                    uid = attrs[LDAP_USER_UNIQUE_ID][0]
                    if uid_username_map.get(uid, ''):
                        members.append(uid_username_map.get(uid, ''))
                    all_uids.append(uid.lower())
                continue

            # ou
            if 'ou' in attrs:
                name = self.get_department_name(attrs, attrs['ou'][0])
                this_group_uuid = attrs[LDAP_GROUP_UUID_ATTR][0]

                uids = self.get_ou_member(ldap_conn, member_dn, filters, name,
                                          this_group_uuid, group_uuid, ou_data, uid_username_map)
                if not uids:
                    continue
                members.extend([uid_username_map.get(uid, '') for uid in uids if uid_username_map.get(uid, '')])
                all_uids.extend(uids)

        group = LdapGroup(ou_name, None, sorted(set(members)), 0, parent_uuid, True)
        ou_data[group_uuid] = group

        return all_uids

    def get_department_name(self, attrs, default_name):
        if LDAP_DEPARTMENT_NAME_ATTR != '' and LDAP_DEPARTMENT_NAME_ATTR in attrs and \
                attrs[LDAP_DEPARTMENT_NAME_ATTR] and len(attrs[LDAP_DEPARTMENT_NAME_ATTR][0]) <= 255:
            department_name = attrs[LDAP_DEPARTMENT_NAME_ATTR][0]
        else:
            department_name = default_name
        return department_name

    # -----  ----- ----- department_v2 -----  ----- ----- #

    def get_departments_v2_from_db(self):
        groups_from_db = None
        departments = DepartmentsV2.objects.all()
        if departments is None:
            logger.warning('get departments from db failed.')
            return groups_from_db

        # remove not exist group's uuid_pair
        group_ids = [department.id for department in departments]
        GroupIDLDAPUUIDPair.objects.exclude(group_id__in=group_ids).delete()

        groups_from_db = dict()
        for department in departments:
            department_members = DepartmentMembersV2.objects.get_department_members_by_id(department.id)
            members = []
            for member in department_members:
                members.append(member.username)
            groups_from_db[department.id] = LdapGroup(
                department.name, '', sorted(members), 0, None, True)

        return groups_from_db

    def do_action_v2(self, groups_from_db, groups_from_ldap):
        group_id_uuid_pair_query = GroupIDLDAPUUIDPair.objects.all()
        group_id_uuid_pairs = list()
        for obj in group_id_uuid_pair_query:
            data = dict(group_id=obj.group_id)
            data['group_uuid'] = obj.group_uuid
            group_id_uuid_pairs.append(data)

        if group_id_uuid_pairs is None:
            logger.warning('get group uuid pairs from db failed.')
            return

        group_uuid_pairs = dict()
        group_uuid_db = dict()

        for pair in group_id_uuid_pairs:
            group_uuid_pairs[str(pair['group_uuid'])] = pair['group_id']
            group_uuid_db[str(pair['group_uuid'])] = pair['group_id']

        # Sync deleted group in ldap to db. Delete in reversed group id order
        reversed_dict_by_group_id = {
            k: v for k, v in reversed(sorted(group_uuid_pairs.items(), key=lambda item: item[1]))}
        for k in reversed_dict_by_group_id:
            if group_uuid_pairs[k] in groups_from_db and k not in groups_from_ldap:
                group_uuid_db.pop(k)

                # delete group's bases
                owner = '%s@seafile_group' % group_uuid_pairs[k]
                workspace = Workspaces.objects.filter(owner=owner).first()
                try:
                    DTables.objects.filter(workspace=workspace, deleted=False).delete()
                except Exception as e:
                    logger.error('Failed to delete bases, workspace owner: %s, error: %s' % (owner, e))
                # mark group's workspace as deleted
                try:
                    Workspaces.objects.filter(owner=owner).update(deleted=True, delete_time=datetime.now())
                except Exception as e:
                    logger.error('Failed to delete workspace, owner: %s, error: %s' % (owner, e))
                # remove group and group_id_uuid_pair
                DepartmentsV2.objects.filter(id=group_uuid_pairs[k]).delete()
                GroupIDLDAPUUIDPair.objects.filter(group_id=group_uuid_pairs[k]).delete()
                logger.info('remove group %s success.' % group_uuid_pairs[k])
                self.deleted_group += 1

        # ldap_tuples = [('uuid', LdapGroup)...]
        ldap_tuples = self.sort_list
        for k, v in ldap_tuples:
            if k in group_uuid_pairs:
                v.group_id = group_uuid_pairs[k]
                # group data lost in db
                if group_uuid_pairs[k] not in groups_from_db:
                    continue

                group_id = group_uuid_pairs[k]
                # update group name
                if v.name != groups_from_db[group_id].name:
                    DepartmentsV2.objects.filter(id=group_id).update(name=v.name)
                    logger.info('rename group %s success.' % group_id)

                add_list, del_list = diff_members(groups_from_db[group_id].members, v.members)
                if len(add_list) > 0 or len(del_list) > 0:
                    self.updated_group += 1

                for member in del_list:
                    member_in_db = DepartmentMembersV2.objects.filter(department=group_id, username=member).first()
                    if member_in_db and member_in_db.is_staff:
                        continue
                    DepartmentMembersV2.objects.filter(department=group_id, username=member).delete()
                    logger.info('remove member %s from group %s success.' % (member, group_id))

                DepartmentMembersV2.objects.bulk_add_users(add_list, group_id)
                logger.info('add members %s to group %s success.' % (len(add_list), group_id))

                from seahub.dtable.utils import clean_related_users_cache_by_group
                clean_related_users_cache_by_group(group_id)
            else:
                self.create_and_add_group_to_db_v2(k, v, group_uuid_db, groups_from_ldap)

    def create_and_add_group_to_db_v2(self, group_uuid, group, group_uuid_db, groups_from_ldap):
        if group_uuid in group_uuid_db:
            return group_uuid_db[group_uuid]

        if not group.parent_uuid:
            parent_id = -1
        elif group.parent_uuid in group_uuid_db:
            parent_id = group_uuid_db[group.parent_uuid]
        else:
            parent_group = groups_from_ldap[group.parent_uuid]
            parent_id = self.create_and_add_group_to_db_v2(
                group.parent_uuid, parent_group, group_uuid_db, groups_from_ldap)

        try:
            department = DepartmentsV2.objects.create_department(group.name, parent_id, org_id=-1)
            group_id = department.id
        except Exception as e:
            logger.warning('create ldap department_v2 [%s] failed. Error: %s' % (group.name, e))
            return

        owner = '%s@seafile_group' % group_id
        workspace = Workspaces.objects.get_workspace_by_owner(owner)
        if not workspace:
            try:
                create_repo_and_workspace(owner, -1)
            except Exception as e:
                logger.error('failed to create workspace for department_v2 %s, error: %s' % (group_id, e))
                return
        try:
            GroupIDLDAPUUIDPair.objects.add_group_id_uuid_pair(group_id, group_uuid)
        except Exception as e:
            logger.warning('add department_v2 uuid pair %s<->%s failed, error: %s' % (group_id, group_uuid, e))
            # admin should remove created department_v2 manually in web
            return
        logger.info('create department_v2 %s, and add uuid pair %s<->%s success.' % (group_id, group_uuid, group_id))
        self.added_group += 1

        group.group_id = group_id
        if group.members:
            try:
                DepartmentMembersV2.objects.bulk_add_users(group.members, department.id)
            except Exception as e:
                logger.warning('failed to add members to department %s, error: %s' % (department.id, e))
            logger.info('add members %s to department_v2 %s success.' % (len(group.members), group_id))

        group_uuid_db[group_uuid] = group_id
        return group_id


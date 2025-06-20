import axios from 'axios';
import cookie from 'react-cookies';
import { siteRoot } from '../constants';

class SysAdminServiceApi {

  constructor(config) {
    this.server = config?.server;
    this.accessToken = config?.accessToken;
    if (this.accessToken && this.server) {
      this.req = axios.create({
        baseURL: this.server,
        headers: { 'Authorization': 'Token ' + this.accessToken }
      });
    } else {
      this.initForDTableUsage();
    }
  }

  initForDTableUsage() {
    const xcsrfHeaders = cookie.load('seaqa_csrftoken');
    if (siteRoot && siteRoot.charAt(siteRoot.length - 1) === '/') {
      var server = siteRoot.substring(0, siteRoot.length - 1);
      this.server = server;
    } else {
      this.server = siteRoot;
    }

    this.req = axios.create({
      headers: {
        'X-CSRFToken': xcsrfHeaders,
      }
    });
  }

  _sendPostRequest(url, form) {
    if (form.getHeaders) {
      return this.req.post(url, form, {
        headers: form.getHeaders()
      });
    } else {
      return this.req.post(url, form);
    }
  }

  // sys-admin
  sysAdminListAllDTables(page, perPage) {
    const url = this.server + '/api/v2.1/admin/dtables/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListTrashDTables(page, perPage) {
    let url = this.server + '/api/v2.1/admin/trash-dtables/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminListDTableArchives(page, perPage) {
    let url = this.server + '/api/v2.1/admin/dtable-archives/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminDeleteDTableArchives(dtable_uuids) {
    let url = this.server + '/api/v2.1/admin/dtable-archives/';
    let params = {
      dtable_uuids: dtable_uuids,
    };

    return this.req.delete(url, {
      data: params
    });
  }

  sysAdminListArchiveBackups(dtable_uuid) {
    let url = this.server + '/api/v2.1/admin/dtable-archives/' + dtable_uuid + '/backups/';
    return this.req.get(url);
  }

  sysAdminRestoreTrashDTable(dtableID, restoreToAdminAccount) {
    const url = this.server + '/api/v2.1/admin/trash-dtables/' + dtableID + '/';
    const data = {
      restore_to_admin_account: restoreToAdminAccount
    };
    return this.req.put(url, data);
  }

  sysAdminSearchDTables(query, page, perPage) {
    let url = this.server + '/api/v2.1/admin/search-dtable/';
    let params = {
      query: query,
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminDeleteDTable(dtable_uuid) {
    const url = this.server + '/api/v2.1/admin/dtable/' + dtable_uuid + '/';
    return this.req.delete(url);
  }

  sysAdminUnsetDTablePassword(dtable_uuid) {
    const url = this.server + '/api/v2.1/admin/dtable/' + dtable_uuid + '/unset-password/';
    return this.req.put(url);
  }

  sysAdminRepairDtable(dtable_uuid) {
    const url = this.server + '/api/v2.1/admin/dtable/' + dtable_uuid + '/repair/';
    return this.req.put(url);
  }

  sysAdminListEmailSendingLogs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/email-sending-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  listVirusFiles(page, perPage, hasHandled) {
    const url = this.server + '/api/v2.1/admin/virus-files/';
    let params = {
      page: page,
      per_page: perPage
    };
    if (hasHandled !== undefined) {
      params.has_handled = hasHandled;
    }
    return this.req.get(url, { params: params });
  }

  deleteVirusFile(virusID) {
    const url = this.server + '/api/v2.1/admin/virus-files/' + virusID + '/';
    return this.req.delete(url);
  }

  toggleIgnoreVirusFile(virusID, ignore) {
    const url = this.server + '/api/v2.1/admin/virus-files/' + virusID + '/';
    let formData = new FormData();
    formData.append('ignore', ignore);
    return this.req.put(url, formData);
  }

  batchProcessVirusFiles(virusIDs, operation) {
    const url = this.server + '/api/v2.1/admin/virus-files/batch/';
    let formData = new FormData();
    for (let i = 0; i < virusIDs.length; i++) {
      formData.append('virus_ids', virusIDs[i]);
    }
    formData.append('operation', operation);
    return this.req.post(url, formData);
  }

  // sys admin org
  sysAdminListOrgs(page, per_page, role) {
    const url = this.server + '/api/v2.1/admin/organizations/';
    let params = {
      page,
      per_page,
      role
    };
    return this.req.get(url, {
      params
    });
  }

  sysAdminListOrgBigDataStorageStats(page, per_page) {
    const url = this.server + '/api/v2.1/admin/organizations/big-data-storage-stats/';
    let params = {
      page,
      per_page
    };
    return this.req.get(url, {
      params
    });
  }

  sysAdminListOrgUniversalAppsStats(page, per_page) {
    const url = this.server + '/api/v2.1/admin/organizations/universal-app-stats/';
    let params = {
      page,
      per_page
    };
    return this.req.get(url, {
      params
    });
  }

  sysAdminGetOrg(orgID) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/';
    return this.req.get(url);
  }

  sysAdminUpdateOrg(orgID, orgInfo) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/';
    let formData = new FormData();
    if (orgInfo.orgName) {
      formData.append('org_name', orgInfo.orgName);
    }
    if (orgInfo.maxUserNumber) {
      formData.append('max_user_number', orgInfo.maxUserNumber);
    }
    if (orgInfo.quota) {
      formData.append('quota', orgInfo.quota);
    }
    if (orgInfo.role) {
      formData.append('role', orgInfo.role);
    }
    if (orgInfo.rowLimit) {
      formData.append('row_limit', orgInfo.rowLimit);
    }
    if (orgInfo.assetQuotaMb) {
      formData.append('asset_quota_mb', orgInfo.assetQuotaMb);
    }
    if (orgInfo.bigDataRowLimit) {
      formData.append('big_data_row_limit', orgInfo.bigDataRowLimit);
    }
    if (orgInfo.smsMessageLimitPerMonth) {
      formData.append('sms_message_limit_per_month', orgInfo.smsMessageLimitPerMonth);
    }
    if (orgInfo.bigDataStorageQuotaMb) {
      formData.append('big_data_storage_quota_mb', orgInfo.bigDataStorageQuotaMb);
    }
    if (orgInfo.monthlyAPICallLimitPerUser) {
      formData.append('monthly_api_call_limit_per_user', orgInfo.monthlyAPICallLimitPerUser);
    }
    return this.req.put(url, formData);
  }

  sysAdminAddOrg(orgName, adminEmail, adminName, password) {
    const url = this.server + '/api/v2.1/admin/organizations/';
    let formData = new FormData();
    formData.append('org_name', orgName);
    formData.append('admin_email', adminEmail);
    formData.append('admin_name', adminName);
    formData.append('password', password);
    return this._sendPostRequest(url, formData);
  }

  sysAdminDeleteOrg(orgID) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/';
    return this.req.delete(url);
  }

  sysAdminListOrgUsers(orgID, is_staff) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/users/?is_staff=' + is_staff;
    return this.req.get(url);
  }

  sysAdminAddOrgUser(orgID, email, name, password) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/users/';
    let formData = new FormData();
    formData.append('email', email);
    formData.append('name', name);
    formData.append('password', password);
    return this._sendPostRequest(url, formData);
  }

  sysAdminUpdateOrgUser(orgID, email, attribute, value) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/users/' + encodeURIComponent(email) + '/';
    let formData = new FormData();
    switch (attribute) {
      case 'active':
        formData.append('active', value);
        break;
      case 'name':
        formData.append('name', value);
        break;
      case 'contact_email':
        formData.append('contact_email', value);
        break;
      case 'quota_total':
        formData.append('quota_total', value);
        break;
      case 'is_admin':
        formData.append('is_admin', value);
        break;
      default:
        break;
    }
    return this.req.put(url, formData);
  }

  sysAdminDeleteOrgUser(orgID, email) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/users/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  sysAdminListOrgGroups(orgID) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/groups/';
    return this.req.get(url);
  }

  sysAdminListOrgDTables(orgID, page, perPage) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/dtables/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminListOrgExternalApps(orgID, page, perPage) {
    const url = this.server + '/api/v2.1/admin/organizations/' + orgID + '/external-apps/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminSearchOrgs(query) {
    let url = this.server + '/api/v2.1/admin/search-organization/';
    let params = {
      query: query
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListUsers(page, perPage, isLDAPImport) {
    let url = this.server + '/api/v2.1/admin/users/';
    let params = {
      page: page,
      per_page: perPage
    };
    if (isLDAPImport) {
      url += '?source=ldapimport';
    }
    return this.req.get(url, { params: params });
  }

  sysAdminAddUser(email, name, role, password) {
    const url = this.server + '/api/v2.1/admin/users/';
    let formData = new FormData();
    formData.append('email', email);
    formData.append('name', name);
    formData.append('role', role);
    formData.append('password', password);
    return this._sendPostRequest(url, formData);
  }

  sysAdminUpdateUser(email, attribute, value) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/';
    let formData = new FormData();
    switch (attribute) {
      case 'password':
        formData.append('password', value);
        break;
      case 'is_active':
        formData.append('is_active', value);
        break;
      case 'is_staff':
        formData.append('is_staff', value);
        break;
      case 'role':
        formData.append('role', value);
        break;
      case 'name':
        formData.append('name', value);
        break;
      case 'login_id':
        formData.append('login_id', value);
        break;
      case 'contact_email':
        formData.append('contact_email', value);
        break;
      case 'phone':
        formData.append('phone', value);
        break;
      case 'reference_id':
        formData.append('reference_id', value);
        break;
      case 'department':
        formData.append('department', value);
        break;
      case 'quota_total':
        formData.append('quota_total', value);
        break;
      case 'institution':
        formData.append('institution', value);
        break;
      case 'row_limit':
        formData.append('row_limit', value);
        break;
      case 'asset_quota_mb':
        formData.append('asset_quota_mb', value);
        break;
      case 'id_in_org':
        formData.append('id_in_org', value);
        break;
      case 'unit':
        formData.append('unit', value);
        break;
      case 'monthly_api_call_limit_per_user':
        formData.append('monthly_api_call_limit_per_user', value);
        break;
      default:
        break;
    }
    return this.req.put(url, formData);
  }

  sysAdminDeleteUser(email) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  sysAdminGetUser(email) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/';
    let params = {};
    return this.req.get(url, { params: params });
  }

  sysAdminResetUserPassword(email) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/reset-password/';
    return this.req.put(url);
  }

  sysAdminDeleteUserInBatch(emails) {
    const url = this.server + '/api/v2.1/admin/users/batch/';
    let formData = new FormData();
    emails.map(email => formData.append('email', email));
    formData.append('operation', 'delete-user');
    return this._sendPostRequest(url, formData);
  }

  sysAdminSetForceTwoFactorAuth(email, isForce2FA) {
    let isForce = isForce2FA ? 1 : 0;
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    let formData = new FormData();
    formData.append('force_2fa', isForce);
    return this.req.put(url, formData);
  }

  sysAdminDeleteTwoFactorAuth(email) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    return this.req.delete(url);
  }

  sysAdminImportUserViaFile(file) {
    const url = this.server + '/api/v2.1/admin/import-users/';
    let formData = new FormData();
    formData.append('file', file);
    return this._sendPostRequest(url, formData);
  }

  sysAdminListAdmins() {
    const url = this.server + '/api/v2.1/admin/admin-users/';
    return this.req.get(url);
  }

  sysAdminUpdateAdminRole(email, role) {
    const url = this.server + '/api/v2.1/admin/admin-role/';
    let formData = new FormData();
    formData.append('email', email);
    formData.append('role', role);
    return this.req.put(url, formData);
  }

  sysAdminAddAdminInBatch(emails) {
    const url = this.server + '/api/v2.1/admin/admin-users/batch/';
    let formData = new FormData();
    emails.map(email => formData.append('email', email));
    return this._sendPostRequest(url, formData);
  }

  sysAdminListGroupsJoinedByUser(email) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/groups/';
    return this.req.get(url);
  }

  sysAdminAddUserToGroups(email, groupIds) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/groups/';
    const form = new FormData();
    groupIds.forEach(groupId => form.append('group_id', groupId));
    return this._sendPostRequest(url, form);
  }

  sysAdminListDepartGroups() {
    const url = this.server + '/api/v2.1/admin/address-book/groups/';
    return this.req.get(url);
  }

  sysAdminAddDepartGroup(groupName, parentGroup) {
    const url = this.server + '/api/v2.1/admin/address-book/groups/';
    let form = new FormData();
    form.append('group_name', groupName);
    form.append('parent_group', parentGroup);
    return this._sendPostRequest(url, form);
  }

  sysAdminGetDepartGroupInfo(groupID, showAncestors) {
    const url = `${this.server}/api/v2.1/admin/address-book/groups/${groupID}/?return_ancestors=${showAncestors}`;
    return this.req.get(url);
  }

  sysAdminUpdateDepartGroup(groupID, groupName) {
    const url = this.server + '/api/v2.1/admin/address-book/groups/' + groupID + '/';
    let form = new FormData();
    form.append('group_name', groupName);
    return this.req.put(url, form);
  }

  sysAdminDeleteDepartGroup(groupID) {
    const url = this.server + '/api/v2.1/admin/address-book/groups/' + groupID + '/';
    return this.req.delete(url);
  }

  sysAdminListAddressBookV2Departments(parentId) {
    const url = this.server + '/api/v2.1/admin/address-book-v2/departments/';
    const params = { parent_id: parentId };
    return this.req.get(url, { params });
  }

  sysAdminCreateAddressBookV2Department(parentId, name) {
    const url = this.server + '/api/v2.1/admin/address-book-v2/departments/';
    const form = new FormData();
    form.append('parent_id', parentId);
    form.append('name', name);
    return this._sendPostRequest(url, form);
  }

  sysAdminUpdateAddressBookV2DepartmentName(departmentId, name) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/`;
    const form = new FormData();
    form.append('name', name);
    return this.req.put(url, form);
  }

  sysAdminDeleteAddressBookV2Department(departmentId) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/`;
    return this.req.delete(url);
  }

  sysAdminListAddressBookV2DepartmentMembers(departmentId) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/members/`;
    return this.req.get(url);
  }

  sysAdminAddAddressBookV2DepartmentMembers(departmentId, emails) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/members/`;
    const form = new FormData();
    emails.forEach(email => form.append('email', email));
    return this._sendPostRequest(url, form);
  }

  sysAdminUpdateAddressBookV2DepartmentMember(departmentId, email, options) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/members/${email}/`;
    const form = new FormData();
    if (typeof options.is_staff === 'boolean') {
      form.append('is_staff', options.is_staff);
    }
    return this.req.put(url, form);
  }

  sysAdminDeleteAddressBookV2DepartmentMember(departmentId, email) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/members/${email}/`;
    return this.req.delete(url);
  }

  sysAdminCreateAddressBookV2DepartmentGroup(departmentId) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/group/`;
    return this.req.post(url);
  }

  sysAdminGetAddressBookV2DepartmentGroup(departmentId) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/group/`;
    return this.req.get(url);
  }

  sysAdminDeleteAddressBookV2DepartmentGroup(departmentId) {
    const url = this.server + `/api/v2.1/admin/address-book-v2/departments/${departmentId}/group/`;
    return this.req.delete(url);
  }

  sysAdminAddressBookV2DepartmentsMigrate() {
    const url = this.server + '/api/v2.1/admin/address-book-v2/departments-migrate/';
    return this.req.post(url);
  }

  sysAdminListAddressBookV2NonDepartmentUsers() {
    const url = this.server + '/api/v2.1/admin/address-book-v2/non-department-users/';
    return this.req.get(url);
  }

  sysAdminAddressBookV2AddUserToDepartments(email, departmentIds) {
    const url = this.server + '/api/v2.1/admin/address-book-v2/departments/add-to-departments/';
    const data = {
      email: email,
      department_ids: departmentIds
    };
    return this.req.post(url, data, { headers: { 'Content-Type': 'application/json' } });
  }

  sysAdminListUserDTables(email, page, per_page) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/dtables/';
    let params = {
      page: page,
      per_page: per_page
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminListUserSharedDTables(email, page, per_page) {
    const url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/shared-dtables/';
    let params = {
      page: page,
      per_page: per_page
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminListUserRepoDirents(email, parentDir) {
    let url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/storage/';
    let params = {
      parent_dir: parentDir
    };
    return this.req.get(url, { params: params });
  }

  sysAdminRenameUserFile(email, direntPath, newName) {
    let url = this.server + '/api/v2.1/admin/users/' + encodeURIComponent(email) + '/storage/' + direntPath;
    let form = new FormData();
    form.append('new_name', newName);
    return this.req.put(url, form);
  }

  sysAdminSearchUsers(query, page, perPage) {
    var url = this.server + '/api/v2.1/admin/search-user/';
    var params = {
      query: query,
      page: page,
      per_page: perPage,
    };
    return this.req.get(url, { params: params });
  }

  sysAdminSearchUserByOrgID(queryStr, orgID, limit) {
    const url = this.server + '/api/v2.1/admin/search-user-by-org-id/?query=' + encodeURIComponent(queryStr) + '&org_id=' + orgID + '&limit=' + limit;
    return this.req.get(url);
  }

  sysAdminDismissGroupByID(groupID) {
    const url = this.server + '/api/v2.1/admin/groups/' + groupID + '/';
    return this.req.delete(url);
  }

  sysAdminListGroupDTables(groupID) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/dtables/';
    return this.req.get(url);
  }

  sysAdminDeleteDTableFromGroup(groupID, tableID) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/dtables/' + tableID + '/';
    return this.req.delete(url);
  }

  sysAdminListGroupMembers(groupID) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/members/';
    return this.req.get(url);
  }

  sysAdminDeleteGroupMember(groupID, email) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/members/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  sysAdminAddGroupMember(groupID, emails) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/members/';
    let form = new FormData();
    for (var i = 0; i < emails.length; i++) {
      form.append('email', emails[i]);
    }
    return this._sendPostRequest(url, form);
  }

  sysAdminUpdateGroupMemberRole(groupID, email, isAdmin) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/members/' + encodeURIComponent(email) + '/';
    let formData = new FormData();
    formData.append('is_admin', isAdmin);
    return this.req.put(url, formData);
  }

  sysAdminListAllGroups(page, perPage) {
    let url = this.server + '/api/v2.1/admin/groups/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminCreateNewGroup(groupName, ownerEmail) {
    let url = this.server + '/api/v2.1/admin/groups/';
    let formData = new FormData();
    formData.append('group_name', groupName);
    formData.append('group_owner', ownerEmail);
    return this._sendPostRequest(url, formData);
  }

  sysAdminTransferGroup(receiverEmail, groupID) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/';
    let formData = new FormData();
    formData.append('new_owner', receiverEmail);
    return this.req.put(url, formData);
  }

  sysAdminSearchGroups(query) {
    let url = this.server + '/api/v2.1/admin/search-group/';
    let params = {
      query: query
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListGroupRepoDirents(groupID, parentDir) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/storages/';
    let params = {
      parent_dir: parentDir
    };
    return this.req.get(url, { params: params });
  }

  sysAdminRenameGroupFile(groupID, direntPath, newName) {
    let url = this.server + '/api/v2.1/admin/groups/' + groupID + '/storage/' + direntPath;
    let form = new FormData();
    form.append('new_name', newName);
    return this.req.put(url, form);
  }

  sysAdminListAllSysNotifications() {
    let url = this.server + '/api/v2.1/admin/sys-notifications/';
    return this.req.get(url);
  }

  sysAdminAddSysNotification(msg) {
    let url = this.server + '/api/v2.1/admin/sys-notifications/';
    let formData = new FormData();
    formData.append('msg', msg);
    return this._sendPostRequest(url, formData);
  }

  sysAdminDeleteSysNotification(nid) {
    let url = this.server + '/api/v2.1/admin/sys-notifications/' + nid + '/';
    return this.req.delete(url);
  }

  sysAdminUpdateSysNotification(nid, msg, primary) {
    let url = this.server + '/api/v2.1/admin/sys-notifications/' + nid + '/';
    let formData = new FormData();
    if (msg) {
      formData.append('msg', msg);
    }
    if (primary) {
      formData.append('primary', primary);
    }
    return this.req.put(url, formData);
  }

  sysAdminListAllSysUserNotifications(page, perPage) {
    let url = this.server + '/api/v2.1/admin/sys-user-notifications/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminAddSysUserNotification(msg, username) {
    let url = this.server + '/api/v2.1/admin/sys-user-notifications/';
    let formData = new FormData();
    formData.append('msg', msg);
    formData.append('username', username);
    return this._sendPostRequest(url, formData);
  }

  sysAdminDeleteSysUserNotification(nid) {
    let url = this.server + '/api/v2.1/admin/sys-user-notifications/' + nid + '/';
    return this.req.delete(url);
  }

  sysAdminListAllNotificationRules(page, perPage) {
    let url = this.server + '/api/v2.1/admin/notification-rules/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListInvalidNotificationRules(page, perPage) {
    let url = this.server + '/api/v2.1/admin/invalid-notification-rules/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminDeleteNotificationRule(rid) {
    let url = this.server + '/api/v2.1/admin/notification-rules/' + rid + '/';
    return this.req.delete(url);
  }

  sysAdminDeleteInvalidNotificationRules() {
    let url = this.server + '/api/v2.1/admin/invalid-notification-rules/';
    return this.req.delete(url);
  }

  sysAdminListAllAutomationRules(page, perPage) {
    let url = this.server + '/api/v2.1/admin/automation-rules/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListInvalidAutomationRules(page, perPage) {
    let url = this.server + '/api/v2.1/admin/invalid-automation-rules/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminDeleteAutomationRule(rid) {
    let url = this.server + '/api/v2.1/admin/automation-rules/' + rid + '/';
    return this.req.delete(url);
  }

  sysAdminDeleteInvalidAutomationRules() {
    let url = this.server + '/api/v2.1/admin/invalid-automation-rules/';
    return this.req.delete(url);
  }

  sysAdminListCommonDatasets(page, perPage) {
    let url = this.server + '/api/v2.1/admin/common-datasets/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListCommonDatasetPeriodicalSyncs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/common-dataset/periodical-syncs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListInvalidCommonDatasetSyncs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/common-dataset/invalid-syncs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminDeleteCommonDatasetSync(sid) {
    let url = this.server + '/api/v2.1/admin/common-dataset/sync/' + sid + '/';
    return this.req.delete(url);
  }

  sysAdminDeleteCommonDatasetInvalidSyncs() {
    let url = this.server + '/api/v2.1/admin/common-dataset/invalid-syncs/';
    return this.req.delete(url);
  }

  sysAdminListAuditLogs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/audit-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListAdminLogs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/admin-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListLoginLogs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/logs/login-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListAdminLoginLogs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/admin-login-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListActiveUsersStatistics(startTime, endTime) {
    const url = this.server + '/api/v2.1/admin/statistics/active-users/';
    let params = {
      start: startTime,
      end: endTime,
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListScriptsRunningStatistics(is_user, month, page, perPage, orderBy) {
    const url = this.server + '/api/v2.1/admin/statistics/scripts-running/';
    let params = {
      is_user: is_user,
      month: month,
      page: page,
      per_page: perPage
    };
    if (orderBy) {
      params.order_by = orderBy;
    }
    return this.req.get(url, { params: params });
  }

  sysAdminListAutoRulesStatistics(is_user, month, page, perPage, orderBy) {
    const url = this.server + '/api/v2.1/admin/statistics/auto-rules/';
    let params = {
      is_user: is_user,
      month: month,
      page: page,
      per_page: perPage
    };
    if (orderBy) {
      params.order_by = orderBy;
    }
    return this.req.get(url, { params: params });
  }

  sysAdminListAutoRuleStatisticDetails(is_user, month, username, org_id) {
    const url = this.server + '/api/v2.1/admin/statistics/auto-rules-details/';
    let params = {
      is_user: is_user,
      month: month,
      owner: username,
      org_id: org_id
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListExternalAppsStatistics(is_user, month, page, perPage, orderBy) {
    const url = this.server + '/api/v2.1/admin/statistics/external-apps/';
    let params = {
      is_user: is_user,
      month: month,
      page: page,
      per_page: perPage
    };
    if (orderBy) {
      params.order_by = orderBy;
    }
    return this.req.get(url, { params: params });
  }

  sysAdminGetSysSettingInfo() {
    let url = this.server + '/api/v2.1/admin/web-settings/';
    return this.req.get(url);
  }

  sysAdminSetSysSettingInfo(key, value) {
    let url = this.server + '/api/v2.1/admin/web-settings/';
    let formData = new FormData();
    formData.append(key, value);
    return this.req.put(url, formData);
  }

  sysAdminUpdateLogo(file) {
    let url = this.server + '/api/v2.1/admin/logo/';
    let formData = new FormData();
    formData.append('logo', file);
    return this._sendPostRequest(url, formData);
  }

  sysAdminUpdateLoginBG(file) {
    let url = this.server + '/api/v2.1/admin/login-background-image/';
    let formData = new FormData();
    formData.append('login_bg_image', file);
    return this._sendPostRequest(url, formData);
  }

  sysAdminListExternalLinks(page, perPage, options) {
    let url = this.server + '/api/v2.1/admin/external-links/';
    let params = {
      page: page,
      per_page: perPage
    };
    const { orgID = null } = options || {};
    if (orgID) {
      params['org_id'] = orgID;
    }
    return this.req.get(url, { params: params });
  }

  sysAdminDeleteExternalLink(token) {
    let url = this.server + '/api/v2.1/admin/external-links/' + token + '/';
    return this.req.delete(url);
  }

  sysAdminSearchExternalLinks(query) {
    let url = this.server + '/api/v2.1/admin/search-external-links/';
    let params = {
      query: query
    };
    return this.req.get(url, { params });
  }

  sysAdminListViewExternalLinks(page, perPage, options) {
    let url = this.server + '/api/v2.1/admin/view-external-links/';
    let params = {
      page: page,
      per_page: perPage
    };
    const { orgID = null } = options || {};
    if (orgID) {
      params['org_id'] = orgID;
    }
    return this.req.get(url, { params: params });
  }

  sysAdminDeleteViewExternalLink(token) {
    let url = this.server + '/api/v2.1/admin/view-external-links/' + token + '/';
    return this.req.delete(url);
  }

  sysAdminSearchViewExternalLinks(query) {
    let url = this.server + '/api/v2.1/admin/search-view-external-links/';
    let params = {
      query: query
    };
    return this.req.get(url, { params });
  }

  sysAdminListDTableExternalLinks(dtable_id) {
    let url = this.server + '/api/v2.1/admin/dtable/' + dtable_id + '/external-links/';
    return this.req.get(url);
  }

  sysAdminListDTableAPITokens(dtableUuid) {
    let url = this.server + '/api/v2.1/admin/dtables/' + dtableUuid + '/api-tokens/';
    return this.req.get(url);
  }

  sysAdminDeleteDTableAPIToken(dtableUuid, apiToken) {
    let url = this.server + '/api/v2.1/admin/dtables/' + dtableUuid + '/api-tokens/' + apiToken + '/';
    return this.req.delete(url);
  }

  sysAdminExportDtable(dtableUuid) {
    const url = this.server + '/api/v2.1/admin/dtables/' + dtableUuid + '/export-dtable/';
    return this.req.get(url);
  }

  sysAdminGetSharePermissions(dtableUuid) {
    const url = this.server + '/api/v2.1/admin/dtables/share-permissions/' + dtableUuid + '/';
    return this.req.get(url);
  }

  sysAdminListTableShares(dtableUuid) {
    const url = this.server + '/api/v2.1/admin/dtables/share/' + dtableUuid + '/';
    return this.req.get(url);
  }

  sysAdminAddTableShare(dtableUuid, email, permission) {
    const url = this.server + '/api/v2.1/admin/dtables/share/' + dtableUuid + '/';
    let data = {
      email: email,
      permission: permission
    };
    return this.req.post(url, data);
  }

  sysAdminDeleteTableShare(dtableUuid, email) {
    const url = this.server + '/api/v2.1/admin/dtables/share/' + dtableUuid + '/';
    let params = { email: email };
    return this.req.delete(url, { data: params });
  }

  sysAdminUpdateTableShare(dtableUuid, email, permission) {
    const url = this.server + '/api/v2.1/admin/dtables/share/' + dtableUuid + '/';
    let data = {
      email: email,
      permission: permission
    };
    return this.req.put(url, data);
  }

  sysAdminListTableGroupShares(dtableUuid) {
    const url = this.server + '/api/v2.1/admin/dtables/group-shares/' + dtableUuid + '/';
    return this.req.get(url);
  }

  sysAdminAddTableGroupShare(dtableUuid, groupID, permission) {
    const url = this.server + '/api/v2.1/admin/dtables/group-shares/' + dtableUuid + '/';
    let params = {
      group_id: groupID,
      permission: permission
    };
    return this.req.post(url, params);
  }

  sysAdminDeleteTableGroupShare(dtableUuid, groupID) {
    const url = this.server + '/api/v2.1/admin/dtables/group-shares/' + dtableUuid + '/';
    let params = {
      group_id: groupID,
    };
    return this.req.delete(url, {
      data: params
    });
  }

  sysAdminUpdateTableGroupShare(dtableUuid, groupID, permission) {
    const url = this.server + '/api/v2.1/admin/dtables/group-shares/' + dtableUuid + '/';
    let params = {
      group_id: groupID,
      permission: permission
    };
    return this.req.put(url, params);
  }

  sysAdminCopyDTable(srcWorkspaceID, dstWorkspaceID, name) {
    const url = this.server + '/api/v2.1/admin/dtable-copy/';
    let formData = new FormData();
    formData.append('src_workspace_id', srcWorkspaceID);
    formData.append('dst_workspace_id', dstWorkspaceID);
    formData.append('name', name);
    return this._sendPostRequest(url, formData);
  }

  sysAdminDoTaskAfterCopyDTable(dst_dtable_uuid) {
    const url = this.server + '/api/v2.1/admin/dtable-copy/do-task-after-copy/';
    let formData = new FormData();
    formData.append('dst_dtable_uuid', dst_dtable_uuid);
    return this._sendPostRequest(url, formData);
  }

  sysAdminGetRepoHistorySetting(repoID) {
    const url = this.server + '/api/v2.1/admin/libraries/' + repoID + '/history-limit/';
    return this.req.get(url);
  }

  sysAdminGetSysInfo() {
    const url = this.server + '/api/v2.1/admin/sysinfo/';
    return this.req.get(url);
  }

  sysAdminUpdateRepoHistorySetting(repoID, keepDays) {
    const url = this.server + '/api/v2.1/admin/libraries/' + repoID + '/history-limit/';
    let form = new FormData();
    form.append('keep_days', keepDays);
    return this.req.put(url, form);
  }

  sysAdminUploadLicense(file) {
    const url = this.server + '/api/v2.1/admin/license/';
    let formData = new FormData();
    formData.append('license', file);
    return this._sendPostRequest(url, formData);
  }

  sysAdminListPlugins() {
    const url = this.server + '/api/v2.1/admin/dtable-system-plugins/';
    return this.req.get(url);
  }

  sysAdminAddPlugin(formData) {
    const url = this.server + '/api/v2.1/admin/dtable-system-plugins/';
    return this.req.post(url, formData);
  }

  sysAdminUpdatePlugin(plugin_id, formData) {
    const url = this.server + '/api/v2.1/admin/dtable-system-plugins/' + plugin_id + '/';
    return this.req.put(url, formData);
  }

  sysAdminDeletePlugin(plugin_id) {
    const url = this.server + '/api/v2.1/admin/dtable-system-plugins/' + plugin_id + '/';
    return this.req.delete(url);
  }

  sysAdminListPluginsInstallCount(page, per_page) {
    const url = this.server + '/api/v2.1/admin/plugins-install-count/';
    let params = {
      page: page,
      per_page: per_page
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListAbuseReports(page, per_page) {
    const url = this.server + '/api/v2.1/admin/abuse-reports/';
    let params = {
      page: page,
      per_page: per_page
    };
    return this.req.get(url, { params: params });
  }

  sysAdminUpdateAbuseReport(reportId, handled) {
    const url = this.server + '/api/v2.1/admin/abuse-reports/' + reportId + '/';
    let formData = new FormData();
    formData.append('handled', handled);
    return this.req.put(url, formData);
  }

  adminAddWorkWeixinUsersBatch(userList) {
    const url = this.server + '/api/v2.1/admin/work-weixin/users/batch/';
    return this.req.post(url, { userlist: userList });
  }

  adminImportWorkWeixinDepartment(departmentID) {
    const url = this.server + '/api/v2.1/admin/work-weixin/departments/import/';
    return this.req.post(url, { work_weixin_department_id: departmentID });
  }

  adminListWorkWeixinDepartmentMembers(departmentID, params) {
    const url = this.server + '/api/v2.1/admin/work-weixin/departments/' + departmentID + '/members/';
    return this.req.get(url, { params: params });
  }

  adminListWorkWeixinDepartments(departmentID) {
    const url = this.server + '/api/v2.1/admin/work-weixin/departments/';
    const params = {};
    if (departmentID) {
      params.department_id = departmentID;
    }
    return this.req.get(url, { params: params });
  }

  sysAdminListExternalApps(page, per_page) {
    const url = this.server + '/api/v2.1/admin/external-apps/';
    const params = {
      page: page,
      per_page: per_page
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminSearchExternalApps(query, page, perPage) {
    let url = this.server + '/api/v2.1/admin/external-apps/search/';
    let params = {
      query: query,
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminChangeExternalAppActiveStatus(appUuid, inactive){
    const url = this.server + '/api/v2.1/admin/external-apps/' + appUuid + '/';
    const data = {
      inactive: inactive
    };
    return this.req.put(url, data);
  }

  sysAdminDeleteExternalApp(appUuid){
    const url = this.server + '/api/v2.1/admin/external-apps/' + appUuid + '/';
    return this.req.delete(url);
  }

  sysAdminChangeExternalAppOpenAccessStatus(appUuid, enabled){
    const url = this.server + '/api/v2.1/admin/external-apps/' + appUuid + '/open-access/';
    const data = {
      enabled: enabled
    };
    return this.req.put(url, data);
  }

  sysAdminAddExternalAppAdmin(appUuid, username){
    const url = this.server + '/api/v2.1/admin/external-apps/' + appUuid + '/administrators/';
    const data = {
      username: username
    };
    return this.req.post(url, data);
  }

  sysAdminListFileAccessLogs(page, perPage) {
    let url = this.server + '/api/v2.1/admin/file-access-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }
}

const sysAdminServiceApi = new SysAdminServiceApi();

export { sysAdminServiceApi };

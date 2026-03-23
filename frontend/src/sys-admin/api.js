import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants';

class SysAdminServiceApi {

  init({ server, username, password, token } = {}) {
    this.server = server;
    this.username = username;
    this.password = password;
    this.token = token;
    if (this.token && this.server) {
      this.req = axios.create({
        baseURL: this.server,
        headers: { 'Authorization': 'Token ' + this.token }
      });
    }
    return this;
  }

  initForUsage({ siteRoot, xcsrfHeaders }) {
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
    return this;
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
  sysAdminListAllProjects(page, perPage) {
    const url = this.server + '/api/v1/admin/projects/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListTrashProjects(page, perPage) {
    let url = this.server + '/api/v1/admin/trash-projects/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminRestoreTrashProject(projectID, restoreToAdminAccount) {
    const url = this.server + '/api/v1/admin/trash-projects/' + projectID + '/';
    const data = {
      restore_to_admin_account: restoreToAdminAccount
    };
    return this.req.put(url, data);
  }

  sysAdminDeleteProject(project_uuid) {
    const url = this.server + '/api/v1/admin/projects/' + project_uuid + '/';
    return this.req.delete(url);
  }

  sysAdminSearchProjects(query, page, perPage) {
    const url = this.server + '/api/v1/admin/search-projects/';
    let params = {
      query: query,
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }


  sysAdminListEmailSendingLogs(page, perPage) {
    let url = this.server + '/api/v1/admin/email-sending-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  listVirusFiles(page, perPage, hasHandled) {
    const url = this.server + '/api/v1/admin/virus-files/';
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
    const url = this.server + '/api/v1/admin/virus-files/' + virusID + '/';
    return this.req.delete(url);
  }

  toggleIgnoreVirusFile(virusID, ignore) {
    const url = this.server + '/api/v1/admin/virus-files/' + virusID + '/';
    let formData = new FormData();
    formData.append('ignore', ignore);
    return this.req.put(url, formData);
  }

  batchProcessVirusFiles(virusIDs, operation) {
    const url = this.server + '/api/v1/admin/virus-files/batch/';
    let formData = new FormData();
    for (let i = 0; i < virusIDs.length; i++) {
      formData.append('virus_ids', virusIDs[i]);
    }
    formData.append('operation', operation);
    return this.req.post(url, formData);
  }

  // sys admin org
  sysAdminListOrgs(page, per_page, role) {
    const url = this.server + '/api/v1/admin/organizations/';
    let params = {
      page,
      per_page,
      role
    };
    return this.req.get(url, {
      params
    });
  }

  sysAdminGetOrg(orgID) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/';
    return this.req.get(url);
  }

  sysAdminUpdateOrg(orgID, orgInfo) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/';
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
    if (orgInfo.assetQuotaMb) {
      formData.append('asset_quota_mb', orgInfo.assetQuotaMb);
    }
    return this.req.put(url, formData);
  }

  sysAdminAddOrg(orgName, adminEmail, adminName, password) {
    const url = this.server + '/api/v1/admin/organizations/';
    let formData = new FormData();
    formData.append('org_name', orgName);
    formData.append('admin_email', adminEmail);
    formData.append('admin_name', adminName);
    formData.append('password', password);
    return this._sendPostRequest(url, formData);
  }

  sysAdminDeleteOrg(orgID) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/';
    return this.req.delete(url);
  }

  sysAdminListOrgUsers(orgID, is_staff) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/users/?is_staff=' + is_staff;
    return this.req.get(url);
  }

  sysAdminAddOrgUser(orgID, email, name, password) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/users/';
    let formData = new FormData();
    formData.append('email', email);
    formData.append('name', name);
    formData.append('password', password);
    return this._sendPostRequest(url, formData);
  }

  sysAdminUpdateOrgUser(orgID, email, attribute, value) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/users/' + encodeURIComponent(email) + '/';
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
      case 'is_admin':
        formData.append('is_admin', value);
        break;
      default:
        break;
    }
    return this.req.put(url, formData);
  }

  sysAdminDeleteOrgUser(orgID, email) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/users/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  sysAdminListOrgGroups(orgID) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/groups/';
    return this.req.get(url);
  }

  sysAdminListOrgProjects(orgID, page, perPage) {
    const url = this.server + '/api/v1/admin/organizations/' + orgID + '/projects/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, {
      params: params
    });
  }

  sysAdminSearchOrgs(query) {
    let url = this.server + '/api/v1/admin/search-organization/';
    let params = {
      query: query
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListUsers(page, perPage, isLDAPImport) {
    let url = this.server + '/api/v1/admin/users/';
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
    const url = this.server + '/api/v1/admin/users/';
    let formData = new FormData();
    formData.append('email', email);
    formData.append('name', name);
    formData.append('role', role);
    formData.append('password', password);
    return this._sendPostRequest(url, formData);
  }

  sysAdminUpdateUser(email, attribute, value) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/';
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
      case 'reference_id':
        formData.append('reference_id', value);
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
      default:
        break;
    }
    return this.req.put(url, formData);
  }

  sysAdminDeleteUser(email) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  sysAdminGetUser(email) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/';
    let params = {};
    return this.req.get(url, { params: params });
  }

  sysAdminResetUserPassword(email) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/reset-password/';
    return this.req.put(url);
  }

  sysAdminDeleteUserInBatch(emails) {
    const url = this.server + '/api/v1/admin/users/batch/';
    let formData = new FormData();
    emails.map(email => formData.append('email', email));
    formData.append('operation', 'delete-user');
    return this._sendPostRequest(url, formData);
  }

  sysAdminSetForceTwoFactorAuth(email, isForce2FA) {
    let isForce = isForce2FA ? 1 : 0;
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    let formData = new FormData();
    formData.append('force_2fa', isForce);
    return this.req.put(url, formData);
  }

  sysAdminDeleteTwoFactorAuth(email) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    return this.req.delete(url);
  }

  sysAdminImportUserViaFile(file) {
    const url = this.server + '/api/v1/admin/import-users/';
    let formData = new FormData();
    formData.append('file', file);
    return this._sendPostRequest(url, formData);
  }

  sysAdminListAdmins() {
    const url = this.server + '/api/v1/admin/admin-users/';
    return this.req.get(url);
  }

  sysAdminUpdateAdminRole(email, role) {
    const url = this.server + '/api/v1/admin/admin-role/';
    let formData = new FormData();
    formData.append('email', email);
    formData.append('role', role);
    return this.req.put(url, formData);
  }

  sysAdminAddAdminInBatch(emails) {
    const url = this.server + '/api/v1/admin/admin-users/batch/';
    let formData = new FormData();
    emails.map(email => formData.append('email', email));
    return this._sendPostRequest(url, formData);
  }

  sysAdminListGroupsJoinedByUser(email) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/groups/';
    return this.req.get(url);
  }

  sysAdminAddUserToGroups(email, groupIds) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/groups/';
    const form = new FormData();
    groupIds.forEach(groupId => form.append('group_id', groupId));
    return this._sendPostRequest(url, form);
  }

  sysAdminListUserProjects(email) {
    const url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/projects/';
    return this.req.get(url);
  }

  sysAdminRenameUserFile(email, direntPath, newName) {
    let url = this.server + '/api/v1/admin/users/' + encodeURIComponent(email) + '/storage/' + direntPath;
    let form = new FormData();
    form.append('new_name', newName);
    return this.req.put(url, form);
  }

  sysAdminSearchUsers(query, page, perPage) {
    var url = this.server + '/api/v1/admin/search-user/';
    var params = {
      query: query,
      page: page,
      per_page: perPage,
    };
    return this.req.get(url, { params: params });
  }

  sysAdminSearchUserByOrgID(queryStr, orgID, limit = 10) {
    const url = this.server + '/api/v1/admin/search-user-by-org-id/?query=' + encodeURIComponent(queryStr) + '&org_id=' + orgID + '&limit=' + limit;
    return this.req.get(url);
  }

  sysAdminDismissGroupByID(groupID) {
    const url = this.server + '/api/v1/admin/groups/' + groupID + '/';
    return this.req.delete(url);
  }

  sysAdminListGroupProjects(groupID) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/projects/';
    return this.req.get(url);
  }

  sysAdminDeleteProjectsFromGroup(groupID, projectUuid) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/projects/' + projectUuid + '/';
    return this.req.delete(url);
  }

  sysAdminListGroupMembers(groupID) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/members/';
    return this.req.get(url);
  }

  sysAdminDeleteGroupMember(groupID, email) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/members/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  sysAdminAddGroupMember(groupID, emails) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/members/';
    let form = new FormData();
    for (var i = 0; i < emails.length; i++) {
      form.append('email', emails[i]);
    }
    return this._sendPostRequest(url, form);
  }

  sysAdminUpdateGroupMemberRole(groupID, email, isAdmin) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/members/' + encodeURIComponent(email) + '/';
    let formData = new FormData();
    formData.append('is_admin', isAdmin);
    return this.req.put(url, formData);
  }

  sysAdminListAllGroups(page, perPage) {
    let url = this.server + '/api/v1/admin/groups/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminCreateNewGroup(groupName, ownerEmail) {
    let url = this.server + '/api/v1/admin/groups/';
    let formData = new FormData();
    formData.append('group_name', groupName);
    formData.append('group_owner', ownerEmail);
    return this._sendPostRequest(url, formData);
  }

  sysAdminTransferGroup(receiverEmail, groupID) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/';
    let formData = new FormData();
    formData.append('new_owner', receiverEmail);
    return this.req.put(url, formData);
  }

  sysAdminSearchGroups(query) {
    let url = this.server + '/api/v1/admin/search-group/';
    let params = {
      query: query
    };
    return this.req.get(url, { params: params });
  }

  sysAdminRenameGroupFile(groupID, direntPath, newName) {
    let url = this.server + '/api/v1/admin/groups/' + groupID + '/storage/' + direntPath;
    let form = new FormData();
    form.append('new_name', newName);
    return this.req.put(url, form);
  }

  sysAdminListAllSysNotifications() {
    let url = this.server + '/api/v1/admin/sys-notifications/';
    return this.req.get(url);
  }

  sysAdminAddSysNotification(msg) {
    let url = this.server + '/api/v1/admin/sys-notifications/';
    let formData = new FormData();
    formData.append('msg', msg);
    return this._sendPostRequest(url, formData);
  }

  sysAdminDeleteSysNotification(nid) {
    let url = this.server + '/api/v1/admin/sys-notifications/' + nid + '/';
    return this.req.delete(url);
  }

  sysAdminUpdateSysNotification(nid, msg, primary) {
    let url = this.server + '/api/v1/admin/sys-notifications/' + nid + '/';
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
    let url = this.server + '/api/v1/admin/sys-user-notifications/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminAddSysUserNotification(msg, username) {
    let url = this.server + '/api/v1/admin/sys-user-notifications/';
    let formData = new FormData();
    formData.append('msg', msg);
    formData.append('username', username);
    return this._sendPostRequest(url, formData);
  }

  sysAdminDeleteSysUserNotification(nid) {
    let url = this.server + '/api/v1/admin/sys-user-notifications/' + nid + '/';
    return this.req.delete(url);
  }

  sysAdminListAuditLogs(page, perPage) {
    let url = this.server + '/api/v1/admin/audit-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListLoginLogs(page, perPage) {
    let url = this.server + '/api/v1/admin/logs/login-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListAdminLoginLogs(page, perPage) {
    let url = this.server + '/api/v1/admin/admin-login-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  sysAdminListActiveUsersStatistics(startTime, endTime) {
    const url = this.server + '/api/v1/admin/statistics/active-users/';
    let params = {
      start: startTime,
      end: endTime,
    };
    return this.req.get(url, { params: params });
  }

  sysAdminUpdateLogo(file) {
    let url = this.server + '/api/v1/admin/logo/';
    let formData = new FormData();
    formData.append('logo', file);
    return this._sendPostRequest(url, formData);
  }

  sysAdminUpdateLoginBG(file) {
    let url = this.server + '/api/v1/admin/login-background-image/';
    let formData = new FormData();
    formData.append('login_bg_image', file);
    return this._sendPostRequest(url, formData);
  }

  sysAdminExportProject(projectUuid) {
    const url = this.server + '/api/v1/admin/projects/' + projectUuid + '/export-project/';
    return this.req.get(url);
  }

  sysAdminGetSysInfo() {
    const url = this.server + '/api/v1/admin/sysinfo/';
    return this.req.get(url);
  }

  // upload license
  sysAdminUploadLicense(file) {
    const url = this.server + '/api/v1/admin/license/';
    let formData = new FormData();
    formData.append('license', file);
    return this._sendPostRequest(url, formData);
  }

  // AI statistics
  sysAdminGetAIStatistics(date, month, groupBy, page, perPage) {
    const url = this.server + '/api/v1/admin/statistics/ai/';
    let params = {
      group_by: groupBy,
      page: page,
      per_page: perPage
    };
    if (date) {
      params.date = date;
    }
    if (month) {
      params.month = month;
    }
    return this.req.get(url, { params: params });
  }


  sysAdminGetAIStatisticsDetail(groupBy, startDate, endDate, condition, scenarios) {
    const url = this.server + '/api/v1/admin/statistics/ai/detail/';
    let params = {
      group_by: groupBy,
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      condition
    };
    if (scenarios && scenarios.length > 0) {
      params.scenarios = scenarios.join(',');
    }
    return this.req.get(url, { params: params });
  }

}

const sysAdminAPI = new SysAdminServiceApi();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
sysAdminAPI.initForUsage({ siteRoot, xcsrfHeaders });

export default sysAdminAPI;

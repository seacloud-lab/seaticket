import axios from 'axios';
import cookie from 'react-cookies';
import { siteRoot } from '../constants/config';

class OrgAdminServiceApi {

  constructor(config) {
    this.server = config?.server;
    this.accessToken = config?.accessToken;
    if (this.accessToken && this.server) {
      this.req = axios.create({
        baseURL: this.server,
        headers: { 'Authorization': 'Token ' + this.accessToken }
      });
    } else {
      this.initForUsage();
    }
  }

  initForUsage() {
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

  orgAdminUpdateOrgInfo(newOrgName) {
    let url = this.server + '/api/v2.1/org/admin/info/';
    let formData = new FormData();
    formData.append('new_org_name', newOrgName);
    return this.req.put(url, formData);
  }

  orgAdminAddDepartGroup(orgID, parentGroup, groupName, groupOwner, groupStaff) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/address-book/groups/';
    let form = new FormData();
    form.append('parent_group', parentGroup);
    form.append('group_name', groupName);
    if (groupOwner) {
      form.append('group_owner', groupOwner);
    }
    if (groupStaff) {
      form.append('group_staff', groupStaff.join(','));
    }
    return this._sendPostRequest(url, form);
  }

  orgAdminUpdateDepartGroup(orgID, groupID, groupName) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/address-book/groups/' + groupID + '/';
    let form = new FormData();
    form.append('group_name', groupName);
    return this.req.put(url, form);
  }

  orgAdminAddGroupMember(orgID, groupID, userEmail) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/members/';
    let form = new FormData();
    form.append('email', userEmail);
    return this._sendPostRequest(url, form);
  }

  orgAdminListGroupProjects(orgID, groupID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/projects/';
    return this.req.get(url);
  }

  orgAdminDeleteProjectFromGroup(orgID, groupID, projectID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/projects/' + projectID + '/';
    return this.req.delete(url);
  }

  orgAdminAddOrgUser(orgID, email, name, password) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/';
    let form = new FormData();
    form.append('email', email);
    form.append('name', name);
    form.append('password', password);
    return this._sendPostRequest(url, form);
  }

  orgAdminInviteOrgUser(orgID, emails) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/invite-user-email/';
    let form = new FormData();
    emails.forEach(email => {
      form.append('email', email);
    });
    return this._sendPostRequest(url, form);
  }

  orgAdminChangeOrgUserStatus(orgID, email, statusCode) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    let form = new FormData();
    form.append('is_active', statusCode);
    return this.req.put(url, form);
  }

  orgAdminDeleteDepartGroup(orgID, groupID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/address-book/groups/' + groupID + '/';
    return this.req.delete(url);
  }

  orgAdminDeleteGroupMember(orgID, groupID, userEmail) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/members/' + encodeURIComponent(userEmail) + '/';
    return this.req.delete(url);
  }

  orgAdminDeleteOrgGroup(orgID, groupID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/';
    return this.req.delete(url);
  }

  orgAdminTransferOrgGroup(orgID, receiverEmail, groupID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/';
    let formData = new FormData();
    formData.append('new_owner', receiverEmail);
    return this.req.put(url, formData);
  }

  orgAdminDeleteOrgUser(orgID, email) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  orgAdminGetFileUpdateDetail(repoID, commitID) {
    let url = this.server + '/ajax/repo/' + repoID + '/history/changes/?commit_id=' + commitID;
    return this.req.get(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  }

  orgAdminGetGroup(orgID, groupID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/';
    return this.req.get(url);
  }

  orgAdminGetOrgInfo() {
    const url = this.server + '/api/v2.1/org/admin/info/';
    return this.req.get(url);
  }

  orgAdminGetOrgUserInfo(orgID, email) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    return this.req.get(url);
  }

  orgAdminListDepartGroups(orgID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/address-book/groups/';
    return this.req.get(url);
  }

  orgAdminSetForceTwoFactorAuth(orgID, email, isForce2FA) {
    let isForce = isForce2FA ? 1 : 0;
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    let formData = new FormData();
    formData.append('force_2fa', isForce);
    return this.req.put(url, formData);
  }

  orgAdminDeleteTwoFactorAuth(orgID, email) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    return this.req.delete(url);
  }

  orgAdminListGroupInfo(orgID, groupID, showAncestors) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/address-book/groups/' + groupID + '/?return_ancestors=' + showAncestors;
    return this.req.get(url);
  }

  orgAdminListAddressBookV2Departments(orgId, parentId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/`;
    const params = { parent_id: parentId };
    return this.req.get(url, { params });
  }

  orgAdminCreateAddressBookV2Department(orgId, parentId, name) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/`;
    const form = new FormData();
    form.append('parent_id', parentId);
    form.append('name', name);
    return this._sendPostRequest(url, form);
  }

  orgAdminUpdateAddressBookV2DepartmentName(orgId, departmentId, name) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/`;
    const form = new FormData();
    form.append('name', name);
    return this.req.put(url, form);
  }

  orgAdminDeleteAddressBookV2Department(orgId, departmentId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/`;
    return this.req.delete(url);
  }

  orgAdminListAddressBookV2DepartmentMembers(orgId, departmentId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/members/`;
    return this.req.get(url);
  }

  orgAdminAddAddressBookV2DepartmentMembers(orgId, departmentId, emails) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/members/`;
    const form = new FormData();
    emails.forEach(email => form.append('email', email));
    return this._sendPostRequest(url, form);
  }

  orgAdminUpdateAddressBookV2DepartmentMember(orgId, departmentId, email, options) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/members/${email}/`;
    const form = new FormData();
    if (typeof options.is_staff === 'boolean') {
      form.append('is_staff', options.is_staff);
    }
    return this.req.put(url, form);
  }

  orgAdminDeleteAddressBookV2DepartmentMember(orgId, departmentId, email) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/members/${email}/`;
    return this.req.delete(url);
  }

  orgAdminCreateAddressBookV2DepartmentGroup(orgId, departmentId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/group/`;
    return this.req.post(url);
  }

  orgAdminGetAddressBookV2DepartmentGroup(orgId, departmentId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/group/`;
    return this.req.get(url);
  }

  orgAdminDeleteAddressBookV2DepartmentGroup(orgId, departmentId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/${departmentId}/group/`;
    return this.req.delete(url);
  }

  orgAdminAddressBookV2DepartmentsMigrate(orgId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments-migrate/`;
    return this.req.post(url);
  }

  orgAdminListAddressBookV2NonDepartmentUsers(orgId) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/non-department-users/`;
    return this.req.get(url);
  }

  orgAdminAddressBookV2AddUserToDepartments(orgId, email, departmentIds) {
    const url = this.server + `/api/v2.1/org/${orgId}/admin/address-book-v2/departments/add-to-departments/`;
    const data = {
      email: email,
      department_ids: departmentIds
    };
    return this.req.post(url, data, { headers: { 'Content-Type': 'application/json' } });
  }

  orgAdminListGroupMembers(orgID, groupID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/members/';
    return this.req.get(url);
  }

  orgAdminListOrgGroups(orgID, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/?page=' + page;
    let params = {
      per_page: perPage
    };
    return this.req.get(url, { params });
  }

  orgAdminListAdminLogs(orgID, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/admin-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminListLoginLogs(orgID, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/login-logs/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }


  orgAdminListOrgUsers(orgID, isStaff, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/?is_staff=' + isStaff + '&page=' + page;
    const params = {
      per_page: perPage,
    };
    return this.req.get(url, { params });
  }

  orgAdminResetOrgUserPassword(orgID, email) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/set-password/';
    return this.req.put(url);
  }

  orgAdminSearchUsers(orgID, query, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/search-users/';
    let params = {
      query: query,
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminSetGroupMemberRole(orgID, groupID, userEmail, isAdmin) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/groups/' + groupID + '/members/' + encodeURIComponent(userEmail) + '/';
    let form = new FormData();
    form.append('is_admin', isAdmin);
    return this.req.put(url, form);
  }

  orgAdminSetOrgAdmin(orgID, email, isStaff) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    let form = new FormData();
    form.append('is_staff', isStaff);
    return this.req.put(url, form);
  }

  orgAdminSetOrgUserContactEmail(orgID, email, contactEmail) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    const data = {
      contact_email: contactEmail
    };
    return this.req.put(url, data);
  }

  orgAdminSetOrgUserName(orgID, email, name) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    const data = {
      name: name
    };
    return this.req.put(url, data);
  }

  orgAdminSetOrgUserQuota(orgID, email, quota) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    const data = {
      quota_total: quota
    };
    return this.req.put(url, data);
  }

  orgAdminListProjects(orgID, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/projects/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminDeleteProject(orgID, projectID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/projects/' + projectID + '/';
    return this.req.delete(url);
  }

  orgAdminListTrashProjects(orgID, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/trash-projects/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminCleanTrashProjects(orgID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/trash-projects/';
    return this.req.delete(url);
  }

  orgAdminRestoreTrashProject(orgID, projectID, restoreToAdminAccount) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/trash-projects/' + projectID + '/';
    const data = {
      restore_to_admin_account: restoreToAdminAccount
    };
    return this.req.put(url, data);
  }

  orgAdminSearchProjects(orgID, query, page, perPage) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/search-projects/';
    let params = {
      query: query,
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminGetSettings() {
    const url = this.server + '/api/v2.1/org/admin/settings/';
    return this.req.get(url);
  }

  orgAdminUpdateSettings(key, value) {
    const url = this.server + '/api/v2.1/org/admin/settings/';
    let form = new FormData();
    form.append(key, value);
    return this.req.put(url, form);
  }

  orgAdminUpdateOrgLogo(orgID, file) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/org-logo/';
    let form = new FormData();
    form.append('file', file);
    return this._sendPostRequest(url, form);
  }

  orgAdminDeleteOrgLogo(orgID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/org-logo/';
    return this.req.delete(url);
  }

  orgAdminSearchGroups(orgID, query) {
    let url = this.server + '/api/v2.1/org/' + orgID + '/admin/search-groups/';
    let params = {
      query: query
    };
    return this.req.get(url, {
      params: params
    });
  }

  orgAdminGetSamlConfig(orgID) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/saml-config/';
    return this.req.get(url);
  }

  orgAdminUpdateSamlConfig(orgID, metadataUrl, domain, idpCertificate) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/saml-config/';
    let formData = new FormData();
    if (metadataUrl) {
      formData.append('metadata_url', metadataUrl);
    }
    if (domain) {
      formData.append('domain', domain);
    }
    if (idpCertificate) {
      formData.append('idp_certificate', idpCertificate);
    }
    return this.req.put(url, formData);
  }

  orgAdminVerifyDomain(orgID, domain) {
    const url = this.server + '/api/v2.1/org/' + orgID + '/admin/verify-domain/';
    let data = {
      domain: domain
    };
    return this.req.put(url, data);
  }

}

const orgAdminServiceApi = new OrgAdminServiceApi();

export { orgAdminServiceApi };

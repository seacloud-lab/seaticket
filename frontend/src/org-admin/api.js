import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants/config';

class OrgAdminAPI {

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
    const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
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

  orgAdminListGroupProjects(orgID, groupID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/groups/' + groupID + '/projects/';
    return this.req.get(url);
  }

  orgAdminDeleteProjectFromGroup(orgID, groupID, projectID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/groups/' + groupID + '/projects/' + projectID + '/';
    return this.req.delete(url);
  }

  orgAdminAddOrgUser(orgID, email, name, password) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/';
    let form = new FormData();
    form.append('email', email);
    form.append('name', name);
    form.append('password', password);
    return this._sendPostRequest(url, form);
  }

  orgAdminChangeOrgUserStatus(orgID, email, statusCode) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    let form = new FormData();
    form.append('is_active', statusCode);
    return this.req.put(url, form);
  }

  orgAdminDeleteOrgGroup(orgID, groupID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/groups/' + groupID + '/';
    return this.req.delete(url);
  }

  orgAdminTransferOrgGroup(orgID, receiverEmail, groupID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/groups/' + groupID + '/';
    let formData = new FormData();
    formData.append('new_owner', receiverEmail);
    return this.req.put(url, formData);
  }

  orgAdminDeleteOrgUser(orgID, email) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    return this.req.delete(url);
  }

  orgAdminGetGroup(orgID, groupID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/groups/' + groupID + '/';
    return this.req.get(url);
  }

  orgAdminGetOrgInfo() {
    const url = this.server + '/api/v1/org/admin/info/';
    return this.req.get(url);
  }

  orgAdminUpdateName(orgID, orgName) {
    const url = this.server + '/api/v1/org/admin/info/';
    let form = new FormData();
    form.append('org_name', orgName);
    return this.req.put(url, form);
  }

  orgAdminGetOrgUserInfo(orgID, email) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    return this.req.get(url);
  }

  orgAdminSetForceTwoFactorAuth(orgID, email, isForce2FA) {
    let isForce = isForce2FA ? 1 : 0;
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    let formData = new FormData();
    formData.append('force_2fa', isForce);
    return this.req.put(url, formData);
  }

  orgAdminDeleteTwoFactorAuth(orgID, email) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/two-factor-auth/';
    return this.req.delete(url);
  }

  orgAdminListGroupMembers(orgID, groupID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/groups/' + groupID + '/members/';
    return this.req.get(url);
  }

  orgAdminListOrgGroups(orgID, page, perPage) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/groups/?page=' + page;
    let params = {
      per_page: perPage
    };
    return this.req.get(url, { params });
  }

  // users
  orgAdminListOrgUsers(orgID, isStaff, page, perPage) {
    let url = this.server + '/api/v1/org/' + orgID + '/admin/users/?is_staff=' + isStaff;
    if (page) {
      url += '&page=' + page;
    }
    let params = {};
    if (perPage) {
      params.per_page = perPage;
    }
    return this.req.get(url, { params });
  }

  orgAdminResetOrgUserPassword(orgID, email) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/set-password/';
    return this.req.put(url);
  }

  orgAdminInviteUsers(orgID, emails) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/invite-users/';
    const form = new FormData();
    emails.forEach(email => form.append('email', email));
    return this._sendPostRequest(url, form);
  }

  orgAdminSearchUsers(orgID, query, page, perPage) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/search-users/';
    let params = {
      query: query,
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminSetOrgAdmin(orgID, email, isStaff) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    let form = new FormData();
    form.append('is_staff', isStaff);
    return this.req.put(url, form);
  }

  orgAdminSetOrgUserContactEmail(orgID, email, contactEmail) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    const data = {
      contact_email: contactEmail
    };
    return this.req.put(url, data);
  }

  orgAdminSetOrgUserName(orgID, email, name) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/users/' + encodeURIComponent(email) + '/';
    const data = {
      name: name
    };
    return this.req.put(url, data);
  }

  // projects
  orgAdminListProjects(orgID, page, perPage) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/projects/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminDeleteProject(orgID, projectID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/projects/' + projectID + '/';
    return this.req.delete(url);
  }

  orgAdminListTrashProjects(orgID, page, perPage) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/trash-projects/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  orgAdminCleanTrashProjects(orgID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/trash-projects/';
    return this.req.delete(url);
  }

  orgAdminRestoreTrashProject(orgID, projectID, restoreToAdminAccount) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/trash-projects/' + projectID + '/';
    const data = {
      restore_to_admin_account: restoreToAdminAccount
    };
    return this.req.put(url, data);
  }

  orgAdminSearchProjects(orgID, query, page, perPage) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/search-projects/';
    let params = {
      query: query,
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  // settings
  orgAdminGetSettings() {
    const url = this.server + '/api/v1/org/admin/settings/';
    return this.req.get(url);
  }

  orgAdminUpdateSettings(key, value) {
    const url = this.server + '/api/v1/org/admin/settings/';
    let form = new FormData();
    form.append(key, value);
    return this.req.put(url, form);
  }

  // saml
  orgAdminGetSamlConfig(orgID) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/saml-config/';
    return this.req.get(url);
  }

  orgAdminUpdateSamlConfig(orgID, metadataUrl, domain, idpCertificate) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/saml-config/';
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
    const url = this.server + '/api/v1/org/' + orgID + '/admin/verify-domain/';
    let data = {
      domain: domain
    };
    return this.req.put(url, data);
  }

  // AI statistics
  orgAdminGetAIStatistics(orgID, date, month, groupBy, page, perPage) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/statistics/ai/';
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

  orgAdminGetAIStatisticsDetail(orgID, groupBy, startDate, endDate, condition, scenarios) {
    const url = this.server + '/api/v1/org/' + orgID + '/admin/statistics/ai/detail/';
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

const orgAdminAPI = new OrgAdminAPI();

export default orgAdminAPI;

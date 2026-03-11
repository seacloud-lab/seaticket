import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class PortalAPI {

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

  _sendPostRequest(url, form, options = {}) {
    const { onUploadProgress } = options;
    if (form.getHeaders) {
      return this.req.post(url, form, {
        headers: form.getHeaders(),
        onUploadProgress,
      });
    } else {
      return this.req.post(url, form, { onUploadProgress });
    }
  }

  _sendPutRequest(url, form, options = {}) {
    const { onUploadProgress } = options;
    if (form.getHeaders) {
      return this.req.put(url, form, {
        headers: form.getHeaders(),
        onUploadProgress,
      });
    } else {
      return this.req.put(url, form, { onUploadProgress });
    }
  }

  createTicket(projectUuid, data) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/tickets/';
    let form = new FormData();
    Object.keys(data).forEach(key => {
      let value = data[key];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      if (value !== undefined) {
        form.append(key, value);
      }
    });
    return this._sendPostRequest(url, form);
  }

  getTicket(projectUuid, ticketNumber) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/tickets/' + ticketNumber + '/';
    return this.req.get(url);
  }

  listMyTickets(projectUuid, { view_id = 'open', start = 0, limit = 1000, config = {} } = {}) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/my-tickets/';
    let form = new FormData();
    form.append('view_id', view_id);
    form.append('start', start);
    form.append('limit', limit);
    form.append('config', JSON.stringify(config));
    return this._sendPostRequest(url, form);
  }

  listTags(projectUuid) {
    let url = this.server + '/api/v1/portal/' + projectUuid + '/tags/';
    return this.req.get(url);
  }

  listTicketTags(projectUuid) {
    return this.listTags(projectUuid);
  }

  getTicketMetadata(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/ticket/metadata/';
    return this.req.get(url);
  }

  listExternalInvitations(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/external-invitations/';
    return this.req.get(url);
  }

  createExternalInvitation(projectUuid, email) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/external-invitations/';
    const data = { email };
    return this.req.post(url, data);
  }

  listExternalUsers(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/external-users/';
    return this.req.get(url);
  }

  deleteExternalUser(projectUuid, email) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/external-users/';
    let params = { email: email };
    return this.req.delete(url, { data: params });
  }

  revokeExternalInvitation(projectUuid, token) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/external-invitations/' + token + '/';
    return this.req.delete(url);
  }

  uploadFile(projectUuid, file, onUploadProgress = null) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/upload-file/';
    const formData = new FormData();
    formData.append('file', file);
    return this._sendPostRequest(url, formData, { onUploadProgress });
  }

  listKBViews(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/knowledge-base-views/';
    return this.req.get(url);
  }

  listKBRecords(projectUuid, { view_id, start = 0, limit = 1000 } = {}) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/knowledge-bases/?view_id=' + encodeURIComponent(view_id) + '&start=' + start + '&limit=' + limit;
    return this.req.get(url);
  }

  getKBRecord(projectUuid, recordId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/knowledge-bases/' + recordId + '/';
    return this.req.get(url);
  }

  listUserInfo(userIdList) {
    const { projectUuid } = (window.app && window.app.pageOptions) || {};
    const url = this.server + '/api/v1/portal/' + projectUuid + '/user-list/';
    return this.req.post(url, { user_id_list: userIdList });
  }

  getSettings(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/settings/';
    return this.req.get(url);
  }

  updateSettings(projectUuid, settings) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/settings/';
    return this.req.post(url, settings);
  }
}

const portalAPI = new PortalAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
portalAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { portalAPI };

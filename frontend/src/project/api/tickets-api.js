import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class TicketsAPI {

  init({ server, username, password, token }) {
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

  login() {
    const url = this.server + '/api2/auth-token/';
    return axios.post(url, {
      username: this.username,
      password: this.password
    }).then((response) => {
      this.token = response.data.token;
      this.req = axios.create({
        baseURL: this.server,
        headers: { 'Authorization': 'Token ' + this.token }
      });
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

  listProjectTicketsBySearch(projectUuid, query = '', signal) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/search/';
    const params = {
      query,
    };
    return this.req.get(url, { params: params, signal: signal });
  }

  listProjectTickets(projectUuid, { view_id = '0000', start = 0, limit = 100 }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/';
    const params = {
      view_id,
      start,
      limit
    };
    return this.req.get(url, { params: params });
  }

  createProjectTicket(projectUuid, update) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      let value = update[key];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      form.append(key, value);
    });
    return this._sendPostRequest(url, form);
  }

  modifyProjectTicket(projectUuid, ticketNumber, update) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/' + ticketNumber + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      let value = update[key];
      if (value && typeof value === 'object') {
        value = JSON.stringify(value);
      }
      if (value === null) {
        value = '';
      }
      form.append(key, value);
    });
    return this.req.put(url, form);
  }

  getProjectTicket(projectUuid, ticketNumber) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/' + ticketNumber + '/';
    return this.req.get(url);
  }

  deleteProjectTicket(projectUuid, ticketNumber) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/' + ticketNumber + '/';
    return this.req.delete(url);
  }

  listProjectTicketReplies(projectUuid, ticketNumber, page, perPage) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/' + ticketNumber + '/replies/';
    let params = {};
    if (page) {
      params.page = page;
    }
    if (perPage) {
      params.per_page = perPage;
    }
    return this.req.get(url, { params });
  }

  createProjectTicketReply(projectUuid, ticketNumber, content) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/' + ticketNumber + '/replies/';
    let form = new FormData();
    if (content) {
      form.append('content', JSON.stringify(content));
    }
    return this._sendPostRequest(url, form);
  }

  modifyProjectTicketReply(projectUuid, ticketNumber, replyNumber, content) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/' + ticketNumber + '/replies/' + replyNumber + '/';
    let form = new FormData();
    if (content) {
      form.append('content', JSON.stringify(content));
    }
    return this.req.put(url, form);
  }

  deleteProjectTicketReply(projectUuid, ticketNumber, replyNumber) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tickets/' + ticketNumber + '/replies/' + replyNumber + '/';
    return this.req.delete(url);
  }

  listProjectRelatedUsers(projectUuid) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/related-users/';
    return this.req.get(url);
  }

  // user
  listUserInfo(userIdList) {
    var url = this.server + '/api/v2.1/user-list/';
    let params = {
      user_id_list: userIdList
    };
    return this._sendPostRequest(url, params, { headers: { 'Content-type': 'application/json' } });
  }

  getUserCommonInfo(email) {
    const url = this.server + '/api/v2.1/user-common-info/' + email + '/';
    return this.req.get(url);
  }

  // upload file
  uploadFile(projectUuid, file, onUploadProgress = null) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/upload-file/';
    const formData = new FormData();
    formData.append('file', file);
    return this._sendPostRequest(url, formData, { onUploadProgress });
  }

  // views
  listViews(projectUuid) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket-views/';
    return this.req.get(url);
  }

  insertView(projectUuid, name, viewData) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket-views/';
    let form = new FormData();
    if (name) {
      form.append('name', name);
    }
    if (viewData) {
      form.append('data', viewData);
    }
    return this._sendPostRequest(url, form);
  }

  getView(projectUuid, viewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket-views/' + viewID + '/';
    return this.req.get(url);
  }

  modifyView(projectUuid, viewID, viewData) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket-views/' + viewID + '/';
    const params = {
      view_data: viewData,
    };
    return this.req.put(url, params);
  }

  deleteView(projectUuid, viewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket-views/' + viewID + '/';
    return this.req.delete(url);
  }

  moveView(projectUuid, sourceViewID, targetViewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket-move-views/';
    let form = new FormData();
    if (sourceViewID) {
      form.append('source_view_id', sourceViewID);
    }
    if (targetViewID) {
      form.append('target_view_id', targetViewID);
    }
    return this._sendPostRequest(url, form);
  }

  duplicateView(projectUuid, viewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket-duplicate-view/';

    let form = new FormData();
    if (viewID) {
      form.append('view_id', viewID);
    }
    return this._sendPostRequest(url, form);
  }

  // substates
  listTicketSubstates(projectUuid, { status_id = '' } = {}) {
    let url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/substates/';
    const params = {};
    if (status_id) params.status_id = status_id;
    return this.req.get(url, { params });
  }

  createTicketSubstate(projectUuid, { name, color, text_color }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/substates/';
    let form = new FormData();
    if (name) form.append('name', name);
    if (color) form.append('color', color);
    if (text_color) form.append('text_color', text_color);
    return this._sendPostRequest(url, form);
  }

  modifyTicketSubstate(projectUuid, substateId, update) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/substates/' + substateId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deleteTicketSubstate(projectUuid, substateId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/substates/' + substateId + '/';
    return this.req.delete(url);
  }

  listTicketsBySubstate(projectUuid, substateId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/substates/' + substateId + '/';
    return this.req.get(url);
  }

  // tags
  listTicketTags(projectUuid) {
    let url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/tags/';
    return this.req.get(url);
  }

  createTicketTag(projectUuid, { name, description, color, text_color }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/tags/';
    let form = new FormData();
    if (name) {
      form.append('name', name);
    }
    if (description) {
      form.append('description', description);
    }
    if (color) {
      form.append('color', color);
    }
    if (text_color) {
      form.append('text_color', text_color);
    }
    return this._sendPostRequest(url, form);
  }

  modifyTicketTag(projectUuid, tagId, update,) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/tags/' + tagId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deleteTicketTag(projectUuid, tagId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/tags/' + tagId + '/';
    return this.req.delete(url);
  }

  deleteTicketTags(projectUuid, tagIds) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/tags/';
    return this.req.delete(url, { data: { tag_ids: tagIds } });
  }

  listTicketsByTag(projectUuid, tagId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/tags/' + tagId + '/';
    return this.req.get(url);
  }

  // types
  listTicketTypes(projectUuid) {
    let url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/types/';
    return this.req.get(url);
  }

  createTicketType(projectUuid, { name, color, text_color }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/types/';
    let form = new FormData();
    if (name) {
      form.append('name', name);
    }
    if (color) {
      form.append('color', color);
    }
    if (text_color) {
      form.append('text_color', text_color);
    }
    return this._sendPostRequest(url, form);
  }

  modifyTicketType(projectUuid, typeId, update,) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/types/' + typeId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deleteTicketType(projectUuid, typeId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/types/' + typeId + '/';
    return this.req.delete(url);
  }

  listTicketsByType(projectUuid, typeId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/ticket/types/' + typeId + '/';
    return this.req.get(url);
  }

}

const ticketsAPI = new TicketsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
ticketsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { ticketsAPI };

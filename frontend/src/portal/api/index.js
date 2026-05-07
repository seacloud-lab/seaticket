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

  createIssue(projectUuid, data) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/';
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

  listIssues(projectUuid, { view_id = 'open', start = 0, limit = 1000 } = {}) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/';
    const params = { start, limit, view_id };
    return this.req.get(url, { params });
  }

  listMyIssues(projectUuid, { view_id = 'open', start = 0, limit = 1000, filters, filter_conjunction, basic_filters, sorts } = {}) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/my-issues/';
    let form = new FormData();
    form.append('view_id', view_id);
    form.append('start', start);
    form.append('limit', limit);
    form.append('config', JSON.stringify({
      filters: filters || [],
      filter_conjunction: filter_conjunction || 'And',
      basic_filters: basic_filters || [],
      sorts: sorts || []
    }));
    return this._sendPostRequest(url, form);
  }

  listTags(projectUuid) {
    let url = this.server + '/api/v1/portal/' + projectUuid + '/tags/';
    return this.req.get(url);
  }

  getPortalIssueMetadata(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issue/metadata/';
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

  // Portal Issues API
  getPortalIssue(projectUuid, issueId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/' + issueId + '/';
    return this.req.get(url);
  }

  modifyPortalIssue(projectUuid, issueId, update) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/' + issueId + '/';
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

  modifyPortalIssues(projectUuid, issues, isCopyPaste) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/';
    return this.req.put(url, { issues_data: issues, is_copy_paste: isCopyPaste });
  }

  deletePortalIssue(projectUuid, issueId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/' + issueId + '/';
    return this.req.delete(url);
  }

  deletePortalIssues(projectUuid, issueIds) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/';
    return this.req.delete(url, { data: { issue_ids: issueIds } });
  }

  // Portal Issue Comments API
  getPortalIssueComments(projectUuid, issueId, start = 0, end = 25) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/' + issueId + '/comments/?start=' + start + '&end=' + end;
    return this.req.get(url);
  }

  createPortalIssueComment(projectUuid, issueId, content) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/' + issueId + '/comments/';
    let form = new FormData();
    if (content) {
      const contentObj = typeof content === 'string' ? { text: content } : content;
      form.append('content', JSON.stringify(contentObj));
    }
    return this._sendPostRequest(url, form);
  }

  modifyPortalIssueComment(projectUuid, issueId, commentId, content) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/' + issueId + '/comments/' + commentId + '/';
    let form = new FormData();
    if (content) {
      const contentObj = typeof content === 'string' ? { text: content } : content;
      form.append('content', JSON.stringify(contentObj));
    }
    return this.req.put(url, form);
  }

  deletePortalIssueComment(projectUuid, issueId, commentId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/issues/' + issueId + '/comments/' + commentId + '/';
    return this.req.delete(url);
  }

  // convert issue to ticket
  convertPortalIssueToTicket(projectUuid, issueId) {
    const url = this.server + '/api/v1/ai/convert-portal-issue-to-ticket/';
    return this.req.post(url, { project_uuid: projectUuid, issue_id: issueId });
  }

  // Portal issues views API
  listPortalIssuesViews(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/views/';
    return this.req.get(url);
  }

  getPortalIssuesView(projectUuid, viewId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/views/' + viewId + '/';
    return this.req.get(url);
  }

  insertPortalIssuesView(projectUuid, name, viewData) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/views/';
    return this.req.post(url, { name, ...viewData });
  }

  modifyPortalIssuesView(projectUuid, viewId, viewData) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/views/' + viewId + '/';
    return this.req.put(url, { view_data: viewData });
  }

  deletePortalIssuesView(projectUuid, viewId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/views/' + viewId + '/';
    return this.req.delete(url);
  }

  movePortalIssuesView(projectUuid, sourceViewId, targetViewId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/views/move/';
    return this.req.post(url, { source_view_id: sourceViewId, target_view_id: targetViewId });
  }

  duplicatePortalIssuesView(projectUuid, viewId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/views/duplicate/';
    return this.req.post(url, { view_id: viewId });
  }

  // Portal Issue Types API
  listPortalIssueTypes(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/types/';
    return this.req.get(url);
  }

  createPortalIssueType(projectUuid, { name, color, text_color }) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/types/';
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

  modifyPortalIssueType(projectUuid, typeId, update) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/types/' + typeId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deletePortalIssueType(projectUuid, typeId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/types/' + typeId + '/';
    return this.req.delete(url);
  }

  deletePortalIssueTypes(projectUuid, typeIds) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/types/';
    return this.req.delete(url, { data: { type_ids: typeIds } });
  }

  listPortalIssuesByType(projectUuid, typeId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/types/' + typeId + '/';
    return this.req.get(url);
  }

  // Portal Issue Substates API
  listPortalIssueSubstates(projectUuid, stateId) {
    let url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/substates/';
    if (stateId) {
      url += '?state_id=' + stateId;
    }
    return this.req.get(url);
  }

  createPortalIssueSubstate(projectUuid, { name, color, text_color, description, parent_id }) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/substates/';
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
    if (description) {
      form.append('description', description);
    }
    if (parent_id) {
      form.append('parent_id', parent_id);
    }
    return this._sendPostRequest(url, form);
  }

  modifyPortalIssueSubstate(projectUuid, substateId, update) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/substates/' + substateId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deletePortalIssueSubstate(projectUuid, substateId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/substates/' + substateId + '/';
    return this.req.delete(url);
  }

  deletePortalIssueSubstates(projectUuid, substateIds) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/substates/';
    return this.req.delete(url, { data: { substate_ids: substateIds } });
  }

  listPortalIssuesBySubstate(projectUuid, substateId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/substates/' + substateId + '/';
    return this.req.get(url);
  }

  // portal issues trash
  listPortalIssuesTrash(projectUuid, { start = 0, limit = 1000 }) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/trash/';
    const params = { start, limit };
    return this.req.get(url, { params });
  }

  cleanPortalIssuesTrash(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/trash/';
    return this.req.delete(url);
  }

  restorePortalIssues(projectUuid, issueIds) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/portal-issues/trash/';
    return this.req.put(url, { issue_ids: issueIds });
  }

  uploadPortalLogo(projectUuid, file, onUploadProgress = null) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/logo/';
    const formData = new FormData();
    formData.append('file', file);
    return this._sendPostRequest(url, formData, { onUploadProgress });
  }
}

const portalAPI = new PortalAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
portalAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { portalAPI };

import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class KnowledgeBaseAPI {

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

  getKnowledgeBases(projectUuid, { view_id = 'open', start = 0, limit = 100, } = {}){
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/';
    let params = {
      view_id,
      start,
      limit
    };
    return this.req.get(url, { params: params });
  }

  listViews(projectUuid) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base-views/';
    return this.req.get(url);
  }

  insertView(projectUuid, name, viewData) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base-views/';
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
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base-views/' + viewID + '/';
    return this.req.get(url);
  }

  modifyView(projectUuid, viewID, viewData) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base-views/' + viewID + '/';
    const params = {
      view_data: viewData,
    };
    return this.req.put(url, params);
  }

  deleteView(projectUuid, viewID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base-views/' + viewID + '/';
    return this.req.delete(url);
  }

  moveView(projectUuid, sourceViewID, targetViewID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base-move-views/';
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
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base-duplicate-views/';

    let form = new FormData();
    if (viewID) {
      form.append('view_id', viewID);
    }
    return this._sendPostRequest(url, form);
  }

  createRecord(projectUuid, update) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      let value = update[key];
      if (key === 'content') {
        const obj = (value && typeof value === 'object') ? value : {
          text: value || '',
          preview: value || '',
          images: [],
          links: [],
          checklist: { total: 0, completed: 0 }
        };
        value = JSON.stringify(obj);
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      form.append(key, value);
    });
    return this._sendPostRequest(url, form);
  }

  updateRecord(projectUuid, recordId, update = {}) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/' + recordId + '/';
    let payload = { ...update };
    if ('content' in payload) {
      const value = payload.content;
      const obj = (value && typeof value === 'object') ? value : {
        text: value || '',
        preview: value || '',
        images: [],
        links: [],
        checklist: { total: 0, completed: 0 }
      };
      payload.content = JSON.stringify(obj);
    }
    return this.req.put(url, payload);
  }

  deleteRecord(projectUuid, recordId) {
    return this.deleteRecords(projectUuid, [recordId]);
  }

  deleteRecords(projectUuid, recordIds) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/';
    if (!Array.isArray(recordIds)) {
      return Promise.reject(new Error('recordIds must be an array'));
    }
    return this.req.delete(url, {
      data: { record_ids: recordIds }
    });
  }

  getRecord(projectUuid, knowledgeID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/' + knowledgeID + '/';
    return this.req.get(url);
  }

  convertViewToExcel(projectUuid, viewId) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/convert-view-to-excel/?view_id=' + encodeURIComponent(viewId);
    return this.req.get(url);
  }

  queryIOStatus(taskId) {
    const url = this.server + '/api/v1/kb-io-status/?task_id=' + taskId;
    return this.req.get(url);
  }

  getExportExcelUrl(projectUuid, taskId, viewId) {
    return this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/export-excel/?task_id=' + taskId + '&view_id=' + encodeURIComponent(viewId);
  }

  uploadFile(projectUuid, file, onUploadProgress = null) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/upload-file/';
    const formData = new FormData();
    formData.append('file', file);
    return this._sendPostRequest(url, formData, { onUploadProgress });
  }

  importExcel(projectUuid, file, previewOnly = false) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/import-excel/';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview_only', previewOnly ? 'true' : 'false');
    return this._sendPostRequest(url, formData);
  }

  commitImportExcel(projectUuid, fileName) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-bases/import-excel/';
    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('preview_only', 'false');
    return this._sendPostRequest(url, formData);
  }

  // tags
  listKnowledgeBaseTags(projectUuid) {
    let url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base/tags/';
    return this.req.get(url);
  }

  createKnowledgeBaseTag(projectUuid, { name, description, color, text_color }) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base/tags/';
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

  modifyKnowledgeBaseTag(projectUuid, tagId, update) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base/tags/' + tagId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deleteKnowledgeBaseTag(projectUuid, tagId) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base/tags/' + tagId + '/';
    return this.req.delete(url);
  }

  deleteKnowledgeBaseTags(projectUuid, tagIds) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base/tags/';
    return this.req.delete(url, { data: { tag_ids: tagIds } });
  }

  listKnowledgeBaseByTag(projectUuid, tagId) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base/tags/' + tagId + '/';
    return this.req.get(url);
  }

  getKnowledgeBaseMetadata(projectUuid) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/knowledge-base/metadata/';
    return this.req.get(url);
  }

}

const knowledgeBaseAPI = new KnowledgeBaseAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
knowledgeBaseAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { knowledgeBaseAPI };

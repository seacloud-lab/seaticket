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

  getKnowledgeBase(projectUuid, { view_id = 'open', start = 0, limit = 100, } = {}){
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base/';
    let params = {
      view_id,
      start,
      limit
    };
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ data: {
          'records': [
            {
              '_pk': 1,
              'kCed': '11',
              'G0Fv': '11\n',
              '9NkH': 'cc85011e6cfd441f9071f7cec7ee78cb@auth.local',
              '6XGR': '2025-11-29T10:12:57.042709+08:00',
              'Geb8': 'cc85011e6cfd441f9071f7cec7ee78cb@auth.local',
              'Xyhg': '2025-11-29T10:12:57.042727+08:00'
            }
          ],
          'columns': [
            {
              'key': '_pk',
              'name': '_pk',
              'type': 'float64',
              'data': null
            },
            {
              'key': 'kCed',
              'name': 'question',
              'type': 'text',
              'data': null
            },
            {
              'key': 'G0Fv',
              'name': 'answer',
              'type': 'text',
              'data': null
            },
            {
              'key': '9NkH',
              'name': 'creator',
              'type': 'text',
              'data': null
            },
            {
              'key': '6XGR',
              'name': 'created_time',
              'type': 'datetime',
              'data': null
            },
            {
              'key': 'Geb8',
              'name': 'last_modifier',
              'type': 'text',
              'data': null
            },
            {
              'key': 'Xyhg',
              'name': 'modified_time',
              'type': 'datetime',
              'data': null
            }
          ]
        } });
      }, 1000);
    });
    return this.req.get(url, { params: params });
  }

  listViews(projectUuid) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base-views/';
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ data: {
          'views': [
            {
              '_id': '0000',
              'name': 'All',
              'type': 'table',
              'basic_filters': [],
              'columns_keys': [],
              'filter_conjunction': 'Or',
              'filters': [],
              'sorts': [],
              'groupbys': [],
              'hidden_columns': []
            }
          ],
          'navigation': [
            {
              '_id': '0000',
              'type': 'view'
            }
          ]
        } });
      }, 500);
    });

    return this.req.get(url);
  }

  insertView(projectUuid, name, viewData) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base-views/';
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
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base-views/' + viewID + '/';
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ data: {
          'view': {
            '_id': '0000',
            'name': 'All',
            'type': 'table',
            'basic_filters': [],
            'columns_keys': [],
            'filter_conjunction': 'Or',
            'filters': [],
            'sorts': [],
            'groupbys': [],
            'hidden_columns': []
          }
        } });
      }, 1000);
    });
    return this.req.get(url);
  }

  modifyView(projectUuid, viewID, viewData) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base-views/' + viewID + '/';
    const params = {
      view_data: viewData,
    };
    return this.req.put(url, params);
  }

  deleteView(projectUuid, viewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base-views/' + viewID + '/';
    return this.req.delete(url);
  }

  moveView(projectUuid, sourceViewID, targetViewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base-move-views/';
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
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base-duplicate-views/';

    let form = new FormData();
    if (viewID) {
      form.append('view_id', viewID);
    }
    return this._sendPostRequest(url, form);
  }

  createRecord(projectUuid, { question, answer }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base/';
    const payload = { question, answer: (answer && typeof answer === 'object') ? JSON.stringify(answer) : answer };
    return this.req.post(url, payload);
  }

  updateRecord(projectUuid, recordNumber, { question, answer }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base/';
    const payload = { question, answer: (answer && typeof answer === 'object') ? JSON.stringify(answer) : answer };
    return this.req.put(url, payload, { params: { record_number: recordNumber } });
  }

  deleteRecord(projectUuid, recordNumber) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/knowledge-base/';
    return this.req.delete(url, { params: { record_number: recordNumber } });
  }

  uploadFile(projectUuid, file, onUploadProgress = null) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/upload-file/';
    const formData = new FormData();
    formData.append('file', file);
    return this._sendPostRequest(url, formData, { onUploadProgress });
  }
}

const knowledgeBaseAPI = new KnowledgeBaseAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
knowledgeBaseAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { knowledgeBaseAPI };

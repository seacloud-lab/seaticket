import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class ConnectionsAPI {

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

  listConnections(projectUuid, page, perPage) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/';
    let params = {
      page: page,
      per_page: perPage,
    };
    return this.req.get(url, { params: params });
  }

  createConnection(projectUuid, { type, name, config }) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/';
    let form = new FormData();
    form.append('name', name);
    form.append('type', type);
    form.append('config', JSON.stringify(config));
    return this._sendPostRequest(url, form);
  }

  modifyConnection(projectUuid, connectionID, { name, config }) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/';
    let form = new FormData();
    form.append('name', name);
    form.append('config', JSON.stringify(config));
    return this.req.put(url, form);
  }

  deleteConnection(projectUuid, connectionID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/';
    return this.req.delete(url);
  }

  getConnection(projectUuid, connectionID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/';
    return this.req.get(url);
  }

  triggerSync(projectUuid, connectionID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/sync/';
    return this.req.post(url);
  }

  getConnectionDetails(projectUuid, connectionID, { view_id = 'open', start = 0, limit = 100, } = {}){
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/details/';
    let params = {
      view_id,
      start,
      limit
    };
    return this.req.get(url, { params: params });
  }

  getConnectionRowDetail(projectUuid, connectionID, params) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/details/row-detail/';
    return this.req.get(url, { params: params });
  }

  getConnectionLogs(projectUuid, connectionID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/logs/';
    return this.req.get(url);
  }

  queryConnectionsStatus(projectUuid, connectionIds) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/query-status/';
    const params = {
      connection_ids: connectionIds.join(','),
    };
    return this.req.get(url, { params: params });
  }

  updateConnectionStatus(projectUuid, connectionID, { is_active }) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/';
    let form = new FormData();
    form.append('is_active', is_active);
    return this.req.put(url, form);
  }

  listViews(projectUuid, connectionID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/views/';
    return this.req.get(url);
  }

  insertView(projectUuid, connectionID, name, viewData) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/views/';
    let form = new FormData();
    if (name) {
      form.append('name', name);
    }
    if (viewData) {
      form.append('data', viewData);
    }
    return this._sendPostRequest(url, form);
  }

  getView(projectUuid, viewID, connectionID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/views/' + viewID + '/';
    return this.req.get(url);
  }

  modifyView(projectUuid, connectionID, viewID, viewData) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/views/' + viewID + '/';
    const params = {
      view_data: viewData,
    };
    return this.req.put(url, params);
  }

  deleteView(projectUuid, connectionID, viewID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/views/' + viewID + '/';
    return this.req.delete(url);
  }

  moveView(projectUuid, connectionID, sourceViewID, targetViewID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/move-views/';
    let form = new FormData();
    if (sourceViewID) {
      form.append('source_view_id', sourceViewID);
    }
    if (targetViewID) {
      form.append('target_view_id', targetViewID);
    }
    return this._sendPostRequest(url, form);
  }

  duplicateView(projectUuid, connectionID, viewID) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/duplicate-view/';

    let form = new FormData();
    if (viewID) {
      form.append('view_id', viewID);
    }
    return this._sendPostRequest(url, form);
  }

  convertRecordToTicket(projectUuid, connectionID, recordID) {
    const url = this.server + '/api/v1/ai/convert-record-to-ticket/';
    let form = new FormData();
    form.append('project_uuid', projectUuid);
    form.append('connection_id', connectionID);
    form.append('record_id', recordID);
    return this._sendPostRequest(url, form);
  }


  getConnectionsEmbeddingAnalysis(projectUuid, connectionIds) {
    const url = this.server + '/api/v1/ai/embedding-analysis/';
    const data = {
      project_uuid: projectUuid,
      connection_ids: connectionIds.join(',')
    };
    return this.req.post(url, data);
  }

  getEmbeddingAnalysisTaskStatus(taskId) {
    const url = this.server + `/api/v1/ai/embedding-analysis-task-status/${taskId}`;
    return this.req.get(url);
  }

  findRelatedRecords(projectUuid, connectionID, recordID) {
    const url = this.server + '/api/v1/ai/related-records/';
    const data = {
      project_uuid: projectUuid,
      connection_id: connectionID,
      record_id: recordID
    };
    return this.req.post(url, data);
  }

  // records
  modifyConnectionRecord(projectUuid, connectionID, row_id, rowData) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/records/' + row_id + '/';
    return this.req.put(url, rowData);
  }

  modifyConnectionRecords(projectUuid, connectionID, rowsData) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/records/';
    return this.req.put(url, { records_data: rowsData });
  }

  deleteConnectionRecords(projectUuid, connectionID, recordIDs) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/connections/' + connectionID + '/records/';
    return this.req.delete(url, { data: { record_ids: recordIDs } });
  }

}

const connectionsAPI = new ConnectionsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
connectionsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { connectionsAPI };

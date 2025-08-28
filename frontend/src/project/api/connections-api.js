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
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/';
    let params = {
      page: page,
      per_page: perPage,
    };
    return this.req.get(url, { params: params });
  }

  createConnection(projectUuid, { type, name, config }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/';
    let form = new FormData();
    form.append('name', name);
    form.append('type', type);
    form.append('config', JSON.stringify(config));
    return this._sendPostRequest(url, form);
  }

  modifyConnection(projectUuid, connectionID, { name, config }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    let form = new FormData();
    form.append('name', name);
    form.append('config', JSON.stringify(config));
    return this.req.put(url, form);
  }

  deleteConnection(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    return this.req.delete(url);
  }

  getConnection(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    return this.req.get(url);
  }

  triggerSync(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/sync/';
    return this.req.post(url);
  }

  getConnectionDetails(projectUuid, connectionID, { start = 0, limit = 100 } = {}){
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/details/';
    let params = {
      start,
      limit
    };
    return this.req.get(url, { params: params });
  }

  getConnectionRowDetail(projectUuid, connectionID, params) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/details/row-detail/';

    return this.req.get(url, { params: params });
  }

  updateConnectionStatus(projectUuid, connectionID, { is_active }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    let form = new FormData();
    form.append('is_active', is_active);
    return this.req.put(url, form);
  }

  insertView(projectUuid, name, viewData) {
    console.log(111, projectUuid, name, viewData);
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connection-views/';
    let form = new FormData();
    if (name) {
      form.append('name', name);
    }
    if (viewData) {
      form.append('data', viewData);
    }
    return this._sendPostRequest(url, form);
  }

}

const connectionsAPI = new ConnectionsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
connectionsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { connectionsAPI };

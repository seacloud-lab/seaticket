import axios from 'axios';
import FormData from 'form-data';
import cookie from 'react-cookies';
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

}

const connectionsAPI = new ConnectionsAPI();
const xcsrfHeaders = cookie.load('seaqa_csrftoken');
connectionsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { connectionsAPI };

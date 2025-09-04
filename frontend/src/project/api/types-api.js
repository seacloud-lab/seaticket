import axios from 'axios';
import FormData from 'form-data';
import cookie from 'react-cookies';
import { siteRoot } from '../../constants';

class TypesAPI {

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

  listProjectTypes(projectUuid, tickets_count = 0) {
    let url = this.server + '/api/v2.1/project/' + projectUuid + '/types/';
    if (tickets_count) {
      url += '?tickets_count=1';
    }
    return this.req.get(url);
  }

  createProjectType(projectUuid, { name, color, text_color }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/types/';
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

  modifyProjectType(projectUuid, typeId, update,) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/types/' + typeId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deleteProjectType(projectUuid, typeId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/types/' + typeId + '/';
    return this.req.delete(url);
  }

  listProjectTicketsByType(projectUuid, typeId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/types/' + typeId + '/tickets/';
    return this.req.get(url);
  }

}

const typesAPI = new TypesAPI();
const xcsrfHeaders = cookie.load('seaqa_csrftoken');
typesAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { typesAPI };

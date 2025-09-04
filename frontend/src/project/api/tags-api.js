import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class TagsAPI {

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

  listProjectTags(projectUuid, tickets_count = 0) {
    let url = this.server + '/api/v2.1/project/' + projectUuid + '/tags/';
    if (tickets_count) {
      url += '?tickets_count=1';
    }
    return this.req.get(url);
  }

  createProjectTag(projectUuid, { name, description, color, text_color }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tags/';
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

  modifyProjectTag(projectUuid, tagId, update,) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tags/' + tagId + '/';
    let form = new FormData();
    Object.keys(update).forEach(key => {
      form.append(key, update[key]);
    });
    return this.req.put(url, form);
  }

  deleteProjectTag(projectUuid, tagId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tags/' + tagId + '/';
    return this.req.delete(url);
  }

  listProjectTicketsByTag(projectUuid, tagId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/tags/' + tagId + '/tickets/';
    return this.req.get(url);
  }

}

const tagsAPI = new TagsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
tagsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { tagsAPI };

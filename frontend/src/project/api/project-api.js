import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants/config';

class ProjectAPI {

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

  updateProject(workspaceID, project_name, updates) {
    const url = this.server + '/api/v1/workspace/' + workspaceID + '/project/';
    let form = new FormData();

    form.append('name', project_name);
    if (updates.color) {
      form.append('color', updates.color);
    }
    if (updates.text_color) {
      form.append('text_color', updates.text_color);
    }
    if (updates.icon) {
      form.append('icon', updates.icon);
    }
    if (updates.settings) {
      form.append('settings', JSON.stringify(updates.settings));
    }
    return this.req.put(url, form);
  }

  // related users
  listProjectRelatedUsers(projectUuid) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/related-users/';
    return this.req.get(url);
  }

}

const projectAPI = new ProjectAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
projectAPI.initForUsage({ siteRoot, xcsrfHeaders });

export default projectAPI;

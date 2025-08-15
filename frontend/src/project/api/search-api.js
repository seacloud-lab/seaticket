import axios from 'axios';
import cookie from 'react-cookies';
import { siteRoot } from '../../constants';

class SearchAPI {

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

  search(workspaceID, projectUuid, query, connectionIds, cancelToken) {
    const url = `${this.server}/api/v2.1/search/`;
    let params = {
      query: query,
      project_uuid: projectUuid,
      workspace_id: workspaceID,
    };
    if (connectionIds) {
      params.connection_ids = connectionIds;
    }
    return this.req.post(url, params, { cancelToken: cancelToken });
  }

}

const searchAPI = new SearchAPI();
const xcsrfHeaders = cookie.load('seaqa_csrftoken');
searchAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { searchAPI };

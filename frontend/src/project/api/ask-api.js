import axios from 'axios';
import cookie from 'react-cookies';
import { siteRoot } from '../../constants';

class AskAPI {

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

  askQuestion(params) {
    const url = this.server + '/api/v2.1/qa/';
    return this._sendPostRequest(url, params);
  }
  // chat sessions api
  getChatSessions(projectUuid, workspaceId) {
    const url = this.server + '/api/v2.1/chat/sessions/?project_uuid=' + projectUuid + '&workspace_id=' + workspaceId;
    return this.req.get(url);
  }

  createChatSession(projectUuid, sessionName, workspaceId) {
    const url = this.server + '/api/v2.1/chat/sessions/';
    const data = {
      project_uuid: projectUuid,
      session_name: sessionName,
      workspace_id: workspaceId
    };
    return this.req.post(url, data);
  }

  deleteChatSession(sessionUuid, workspaceId) {
    const url = this.server + '/api/v2.1/chat/sessions/' + sessionUuid + '/';
    const data = {
      workspace_id: workspaceId
    };
    return this.req.delete(url, { data });
  }

  getChatMessages(sessionUuid, workspaceId) {
    const url = this.server + '/api/v2.1/chat/sessions/' + sessionUuid + '/messages/?workspace_id=' + workspaceId;
    return this.req.get(url);
  }

}

const askAPI = new AskAPI();
const xcsrfHeaders = cookie.load('seaqa_csrftoken');
askAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { askAPI };

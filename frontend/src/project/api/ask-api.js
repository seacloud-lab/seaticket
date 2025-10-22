import axios from 'axios';
import Cookies from 'js-cookie';
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
    const url = this.server + '/api/v2.1/ai/qa/';
    return this._sendPostRequest(url, params);
  }
  // chat sessions api
  listChatSessions(projectUuid) {
    const url = this.server + '/api/v2.1/chat/sessions/?project_uuid=' + projectUuid;
    return this.req.get(url);
  }

  createChatSession(projectUuid, sessionName) {
    const url = this.server + '/api/v2.1/chat/sessions/';
    const data = {
      project_uuid: projectUuid,
      session_name: sessionName,
    };
    return this.req.post(url, data);
  }

  deleteChatSession(projectUuid, sessionUuid) {
    const url = this.server + '/api/v2.1/chat/sessions/' + sessionUuid + '/';
    const data = {
      project_uuid: projectUuid
    };
    return this.req.delete(url, { data });
  }

  modifyChatSession(projectUuid, sessionUuid, update) {
    const url = this.server + '/api/v2.1/chat/sessions/' + sessionUuid + '/';
    const data = {
      ...update,
      project_uuid: projectUuid
    };
    return this.req.put(url, data);
  }

  getChatMessages(projectUuid, sessionUuid) {
    const url = this.server + '/api/v2.1/chat/sessions/' + sessionUuid + '/messages/?project_uuid=' + projectUuid;
    return this.req.get(url);
  }

}

const askAPI = new AskAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
askAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { askAPI };

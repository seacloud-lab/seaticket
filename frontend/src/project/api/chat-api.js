import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class ChatAPI {

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

  sendChatMessage(params, options) {
    const url = this.server + '/api/v1/ai/chat/';
    return this._sendPostRequest(url, params);
  }

  _handleEventStreamRequest(url, form, options = {}) {
    let body = form;
    let headers = { ...options.headers };
    if (!headers['X-CSRFToken']) {
      const csrfToken = Cookies.get('seaqa_csrftoken');
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }
    }
    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = 'Token ' + this.token;
    }
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (!form) {
      return fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
        signal: options.signal,
      });
    }

    if (form.getHeaders) {
      body = form;
      const formHeaders = form.getHeaders();
      headers = { ...headers, ...formHeaders };
    } else if (typeof form === 'object') {
      body = JSON.stringify(form);
    }
    return fetch(url, {
      method: 'POST',
      body: body,
      headers: headers,
      credentials: 'include',
      signal: options.signal,
    });
  }

  sendChatMessageByStream(params, options = {}) {
    const url = this.server + '/api/v1/ai/chat/';
    return this._handleEventStreamRequest(url, params, options);
  }

  getChatMessage(projectUuid, sessionId) {
    const url = this.server + '/api/v1/ai/chat/?session_uuid=' + sessionId;
    return this.req.get(url);
  }

  getChatMessageByStream(projectUuid, sessionId, streamed_length, options) {
    const url = this.server + '/api/v1/ai/chat/?session_uuid=' + sessionId + '&streamed_length=' + streamed_length;
    return this._handleEventStreamRequest(url, undefined, options);
  }

  // chat sessions api
  listChatSessions(projectUuid) {
    const url = this.server + '/api/v1/chat/sessions/?project_uuid=' + projectUuid;
    return this.req.get(url);
  }

  listTeamSharedSessions(projectUuid) {
    const url = this.server + '/api/v1/chat/sessions/?project_uuid=' + projectUuid + '&type=team';
    return this.req.get(url);
  }

  shareChatSession(projectUuid, sessionUuid, isShared) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/';
    const data = {
      project_uuid: projectUuid,
      is_shared: isShared
    };
    return this.req.put(url, data);
  }

  createChatSession(projectUuid, sessionName) {
    const url = this.server + '/api/v1/chat/sessions/';
    const data = {
      project_uuid: projectUuid,
      session_name: sessionName,
    };
    return this.req.post(url, data);
  }

  copyChatSession(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/copy/';
    const data = {
      project_uuid: projectUuid
    };
    return this.req.post(url, data);
  }

  deleteChatSession(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/';
    const data = {
      project_uuid: projectUuid
    };
    return this.req.delete(url, { data });
  }

  modifyChatSession(projectUuid, sessionUuid, update) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/';
    const data = {
      ...update,
      project_uuid: projectUuid
    };
    return this.req.put(url, data);
  }

  generateChatSessionTitle(projectUuid, sessionUuid, params) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/generate-title/';
    const data = {
      ...params,
      project_uuid: projectUuid,
    };
    return this.req.post(url, data);
  }

  getChatMessages(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/messages/?project_uuid=' + projectUuid;
    return this.req.get(url);
  }

  uploadChatImage(projectUuid, file, onUploadProgress) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/upload-file/';
    const formData = new FormData();
    formData.append('file', file);
    return this.req.post(url, formData, { onUploadProgress });
  }

}

const chatAPI = new ChatAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
chatAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { chatAPI };

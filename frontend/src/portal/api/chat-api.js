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

  _sendPostRequest(url, form) {
    if (form.getHeaders) {
      return this.req.post(url, form, {
        headers: form.getHeaders()
      });
    } else {
      return this.req.post(url, form);
    }
  }

  // Portal Chat APIs
  sendChatMessage(params) {
    const url = this.server + '/api/v1/portal/' + params?.project_uuid + '/chat/';
    return this.req.post(url, params);
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
    const url = this.server + '/api/v1/portal/' + params?.project_uuid + '/chat/';
    return this._handleEventStreamRequest(url, params, options);
  }

  listChatSessions(projectUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/';
    return this.req.get(url);
  }

  createChatSession(projectUuid, sessionName) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/';
    return this.req.post(url, { session_name: sessionName });
  }

  modifyChatSession(projectUuid, sessionUuid, update) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/' + sessionUuid + '/';
    return this.req.put(url, update);
  }

  deleteChatSession(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/' + sessionUuid + '/';
    return this.req.delete(url);
  }

  getChatMessages(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/' + sessionUuid + '/messages/';
    return this.req.get(url);
  }

  getChatMessage(sessionId) {
    const { projectUuid } = (window.app && window.app.pageOptions) || {};
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/?session_uuid=' + sessionId;
    return this.req.get(url);
  }

  getChatMessageByStream(sessionId, streamed_length, options) {
    const { projectUuid } = (window.app && window.app.pageOptions) || {};
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/?session_uuid=' + sessionId + '&streamed_length=' + streamed_length;
    return this._handleEventStreamRequest(url, undefined, options);
  }

}

const chatAPI = new ChatAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
chatAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { chatAPI };

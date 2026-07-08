import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';
import { buildPortalPath } from '../path-utils';

class ChatAPI {

  _getPortalChatRootURL() {
    const { origin } = window.location;
    return `${origin}${buildPortalPath('chat')}`;
  }

  _handleVisitorSessionExpired(status, data) {
    if (status !== 401) return;
    if (data?.error_code !== 'visitor_session_expired') return;
    window.setTimeout(() => window.location.replace(this._getPortalChatRootURL()), 0);
  }

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
    this.req.interceptors.response.use(
      response => response,
      error => {
        this._handleVisitorSessionExpired(error?.response?.status, error?.response?.data);
        return Promise.reject(error);
      }
    );
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
    const validParams = {};
    validParams.clear_context = params.clear_context;
    validParams.query = params.query;
    validParams.session_uuid = params.session_uuid;
    validParams.stream = params.stream;
    if (Array.isArray(params.attachments)) {
      validParams.attachments = params.attachments;
    }
    const url = this.server + '/api/v1/portal/' + params?.project_uuid + '/chat/';
    return this.req.post(url, validParams);
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
      }).then(response => {
        if (response.status === 401) {
          return response.json().then(data => {
            this._handleVisitorSessionExpired(response.status, data);
            return response;
          }).catch(() => response);
        }
        return response;
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
    }).then(response => {
      if (response.status === 401) {
        return response.json().then(data => {
          this._handleVisitorSessionExpired(response.status, data);
          return response;
        }).catch(() => response);
      }
      return response;
    });
  }

  sendChatMessageByStream(params, options = {}) {
    const validParams = {};
    validParams.clear_context = params.clear_context;
    validParams.query = params.query;
    validParams.session_uuid = params.session_uuid;
    validParams.stream = params.stream;
    if (Array.isArray(params.attachments)) {
      validParams.attachments = params.attachments;
    }
    const url = this.server + '/api/v1/portal/' + params?.project_uuid + '/chat/';
    return this._handleEventStreamRequest(url, validParams, options);
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

  generateChatSessionTitle(projectUuid, sessionUuid, params) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/' + sessionUuid + '/generate-title/';
    return this.req.post(url, params);
  }

  deleteChatSession(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/' + sessionUuid + '/';
    return this.req.delete(url);
  }

  getChatMessages(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/sessions/' + sessionUuid + '/messages/';
    return this.req.get(url);
  }

  getChatMessage(projectUuid, sessionId) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/?session_uuid=' + sessionId;
    return this.req.get(url);
  }

  getChatMessageByStream(projectUuid, sessionId, streamed_length, options) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/chat/?session_uuid=' + sessionId + '&streamed_length=' + streamed_length;
    return this._handleEventStreamRequest(url, undefined, options);
  }

  uploadChatImage(projectUuid, file, onUploadProgress) {
    const url = this.server + '/api/v1/portal/' + projectUuid + '/upload-file/';
    const formData = new FormData();
    formData.append('file', file);
    return this.req.post(url, formData, { onUploadProgress });
  }

}

const chatAPI = new ChatAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
chatAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { chatAPI };

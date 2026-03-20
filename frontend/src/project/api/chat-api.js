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

  getChatMessages(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/messages/?project_uuid=' + projectUuid;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ data: {
    "messages": [
        {
            "id": 3046,
            "session_uuid": "acc11428-11c2-4829-8d79-b006338f9ff2",
            "message_id": "ab37",
            "username": "cc85011e6cfd441f9071f7cec7ee78cb@auth.local",
            "role": "user",
            "content": "g2 如何升级",
            "attachments": [],
            "sources": [],
            "created_at": "2026-03-18T02:05:29.003664Z",
            "updated_at": "2026-03-18T02:05:29.003741Z",
            "as_context": true
        },
        {
            "id": 3047,
            "session_uuid": "acc11428-11c2-4829-8d79-b006338f9ff2",
            "message_id": "ab37",
            "username": "cc85011e6cfd441f9071f7cec7ee78cb@auth.local",
            "role": "assistant",
            "content": "关于 AntV G2 从 v4 升级到 v5 的指南如下：\n\n### 1. 版本目标\n升级涉及的主要相关包及建议版本如下：\n*   **@antv/g2**: 升级至 `v5.2.7`\n*   **@antv/scale**: 需要同步升级到 `v0.4.0`\n*   **@antv/data-set**: 维持在 `v0.11.8`（根据文档，此版本仍兼容）[Reference 1][Reference 2]\n\n### 2. 核心变化与注意事项\n*   **不兼容性**：G2 5.x 版本在架构上做了较大调整，对 4.x 版本的部分语法和 API **不完全兼容**，因此在升级过程中必须手动更改现有代码[Reference 1][Reference 3]。\n*   **Scale 升级**：`@antv/scale` 的升级非常关键，可参考[相关技术社区说明](https://juejin.cn/post/6971306926344765453)进行调整[Reference 4]。\n\n### 3. 详细迁移步骤\nAntV 官方提供了详细的迁移文档，建议在执行代码重构时重点参考：\n*   **官方迁移指南**：[从 G2 v4 迁移到 v5](https://g2.antv.antgroup.com/manual/extra-topics/migration-from-g2v4)[Reference 1][Reference 5]\n\n升级前请务必先备份代码，并按照官方文档逐步检查 API 变化，特别是在坐标轴（Axis）、几何图形（Geometry）和图例（Legend）等常用组件的定义语法上。",
            "attachments": [],
            "sources": [
                {
                    "_id": "4",
                    "connection_id": "225",
                    "modified_time": "2025-09-13T17:02:21+08:00",
                    "path": "/",
                    "repo_id": "5b2b040e-45c6-4300-b469-12d35d32f03e",
                    "repo_name": "私人资料库",
                    "score": 0.497322678565979,
                    "server_url": "https://dev.seafile.com/seahub/",
                    "source_type": "summary",
                    "title": "g2升级5.x文档.sdoc",
                    "type": "seafile",
                    "url": "https://dev.seafile.com/seahub/lib/5b2b040e-45c6-4300-b469-12d35d32f03e/file//g2升级5.x文档.sdoc",
                    "ai_summary": "This document guides upgrading G2 from v4.x to v5.x, highlighting breaking changes and dependency updates, specifically for `@antv/scale`."
                },
                {
                    "_id": "3",
                    "connection_id": "226",
                    "modified_time": "2025-09-13T17:02:21+08:00",
                    "path": "/",
                    "repo_id": "5b2b040e-45c6-4300-b469-12d35d32f03e",
                    "repo_name": "私人资料库",
                    "score": 0.5026623010635376,
                    "server_url": "https://dev.seafile.com/seahub/",
                    "source_type": "summary",
                    "title": "g2升级5.x文档new.sdoc",
                    "type": "seafile",
                    "url": "https://dev.seafile.com/seahub/lib/5b2b040e-45c6-4300-b469-12d35d32f03e/file//g2升级5.x文档new.sdoc",
                    "ai_summary": "This document guides users on upgrading @antv/g2 from v4.x to v5.x, highlighting breaking changes and necessary dependency updates."
                },
                {
                    "_id": "5",
                    "connection_id": "225",
                    "modified_time": "2025-09-13T17:02:21+08:00",
                    "path": "/",
                    "repo_id": "5b2b040e-45c6-4300-b469-12d35d32f03e",
                    "repo_name": "私人资料库",
                    "score": 0.5054238438606262,
                    "server_url": "https://dev.seafile.com/seahub/",
                    "source_type": "summary",
                    "title": "g2升级5.x文档-版本2.sdoc",
                    "type": "seafile",
                    "url": "https://dev.seafile.com/seahub/lib/5b2b040e-45c6-4300-b469-12d35d32f03e/file//g2升级5.x文档-版本2.sdoc",
                    "ai_summary": "This document outlines the upgrade process from G2 v4.x to v5.x, highlighting breaking changes and the need to update @antv/scale."
                },
                {
                    "_id": "5",
                    "connection_id": "226",
                    "modified_time": "2025-09-13T17:02:21+08:00",
                    "path": "/",
                    "repo_id": "5b2b040e-45c6-4300-b469-12d35d32f03e",
                    "repo_name": "私人资料库",
                    "score": 0.5073699355125427,
                    "server_url": "https://dev.seafile.com/seahub/",
                    "source_type": "summary",
                    "title": "g2升级5.x文档.sdoc",
                    "type": "seafile",
                    "url": "https://dev.seafile.com/seahub/lib/5b2b040e-45c6-4300-b469-12d35d32f03e/file//g2升级5.x文档.sdoc",
                    "ai_summary": "This document provides a guide for upgrading @antv/g2 from v4.x to v5.x, highlighting breaking changes and necessary dependency updates."
                }
            ],
            "created_at": "2026-03-18T02:05:29.005641Z",
            "updated_at": "2026-03-18T02:05:29.005681Z",
            "as_context": true
        }
    ],
    "running_task": false
} });
      }, 100);
    });
    // return this.req.get(url);
  }

}

const chatAPI = new ChatAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
chatAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { chatAPI };

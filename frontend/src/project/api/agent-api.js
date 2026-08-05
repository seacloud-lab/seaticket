import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class AgentAPI {

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

  getGithubIssueTypes(projectUuid) {
    const url = this.server + `/api/v1/project/${projectUuid}/github/issue-types/`;
    return this.req.get(url);
  }

  syncGithubIssueTypes(projectUuid) {
    const url = this.server + `/api/v1/project/${projectUuid}/github/issue-types/`;
    return this.req.post(url);
  }

  // Agent run logs
  testListAgentRunLogs(projectUuid, page = 1, perPage = 20) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/items/?page=${page}&per_page=${perPage}`;
    return this.req.get(url);
  }

  testListAgentItemLogs(projectUuid, source_id, source_type) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/item/runs/?source_id=${source_id}&source_type=${source_type}`;
    return this.req.get(url);
  }

  listAgentRunLogs(projectUuid, page = 1, perPage = 20) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/runs/?page=${page}&per_page=${perPage}`;
    return this.req.get(url);
  }

  getAgentRunDetails(projectUuid, runId, options = {}) {
    const { includeDetails = false } = options;
    const url = this.server + `/api/v1/project/${projectUuid}/agent/runs/${runId}/`;
    const params = includeDetails ? { include_details: true } : undefined;
    return this.req.get(url, { params });
  }

  // Agent action operations
  confirmAgentAction(projectUuid, runId, actionId, options = {}) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/runs/${runId}/actions/${actionId}/confirm/`;
    const data = { project_uuid: projectUuid };
    if (options.linked_github_issues_to_close) {
      data.linked_github_issues_to_close = options.linked_github_issues_to_close;
    }
    return this.req.post(url, data);
  }

  cancelAgentAction(projectUuid, runId, actionId) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/runs/${runId}/actions/${actionId}/cancel/`;
    const data = { project_uuid: projectUuid };
    return this.req.post(url, data);
  }

  updateAgentAction(projectUuid, runId, actionId, data) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/runs/${runId}/actions/${actionId}/`;
    return this.req.patch(url, data);
  }

  // Execute agent immediately
  executeAgent(projectUuid) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/execute/`;
    const data = { project_uuid: projectUuid };
    return this.req.post(url, data);
  }

}

const agentAPI = new AgentAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
agentAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { agentAPI };

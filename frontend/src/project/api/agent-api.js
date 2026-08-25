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
  listAgentLogs(projectUuid, page = 1, perPage = 20) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/logs/`;
    return this.req.get(url, { params: { page, per_page: perPage } });
  }

  listAgentLogRuns(projectUuid, owner_source_id, owner_source_type, signal) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/log/runs/`;
    return this.req.get(url, { params: { owner_source_id, owner_source_type }, signal });
  }

  getAgentRunDetails(projectUuid, runId) {
    const url = this.server + `/api/v1/project/${projectUuid}/agent/runs/${runId}/`;
    return this.req.get(url);
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

import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants/config';

class HomeAPI {

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

  listWorkspaces(detail) {
    let url = this.server + '/api/v2.1/workspaces/';
    if (detail !== undefined) {
      url = url + '?detail=' + detail;
    }
    return this.req.get(url);
  }

  // ---- project api
  createProject(name, owner, icon, bgColor, textColor) {
    const url = this.server + '/api/v2.1/projects/';
    let form = new FormData();
    form.append('name', name);
    form.append('owner', owner);
    if (bgColor) {
      form.append('color', bgColor);
    }
    if (icon) {
      form.append('icon', icon);
    }
    if (textColor) {
      form.append('text_color', textColor);
    }
    return this._sendPostRequest(url, form);
  }

  updateProject(workspaceID, project_name, updates) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/';
    let form = new FormData();
    form.append('name', project_name);
    if (updates.color) {
      form.append('color', updates.color);
    }
    if (updates.new_name) {
      form.append('new_name', updates.new_name);
    }
    if (updates.text_color) {
      form.append('text_color', updates.text_color);
    }
    if (updates.icon) {
      form.append('icon', updates.icon);
    }
    return this.req.put(url, form);
  }

  deleteProject(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/';
    let params = { name: name };
    return this.req.delete(url, { data: params });
  }

  // invite link
  getProjectInviteLink(workspaceID, name) {
    var url = this.server + '/api/v2.1/projects/invite-links/?workspace_id=' + workspaceID + '&project_name=' + encodeURIComponent(name);
    return this.req.get(url);
  }

  createProjectInviteLink(workspaceID, name, permission, password, expire_days) {
    let url = this.server + '/api/v2.1/projects/invite-links/';
    let form = new FormData();
    form.append('workspace_id', workspaceID);
    form.append('project_name', name);

    if (permission) {
      form.append('permission', permission);
    }

    if (password) {
      form.append('password', password);
    }

    if (expire_days) {
      form.append('expire_days', expire_days);
    }

    return this._sendPostRequest(url, form);
  }

  deleteProjectInviteLink(token) {
    var url = this.server + '/api/v2.1/projects/invite-links/' + token + '/';
    return this.req.delete(url);
  }

  // search
  searchItems(query_str, query_type) {
    let url = this.server + '/api/v2.1/project/items-search/';
    let params = {};
    if (query_str) {
      params.query_str = query_str;
    }
    if (query_type) {
      params.query_type = query_type;
    }
    return this.req.get(url, {
      params
    });
  }

  // group
  listGroups(includingAllDeps = false) {
    const url = this.server + '/api/v2.1/groups/';
    let params = { including_all_deps: includingAllDeps };
    return this.req.get(url, { params: params });
  }

  getGroup(groupID) {
    const url = this.server + '/api/v2.1/groups/' + groupID + '/';
    return this.req.get(url);
  }

  createGroup(name) {
    const url = this.server + '/api/v2.1/groups/';
    let form = new FormData();
    form.append('name', name);
    return this._sendPostRequest(url, form);
  }

  renameGroup(groupID, name) {
    const url = this.server + '/api/v2.1/groups/' + groupID + '/';
    const params = {
      name: name
    };
    return this.req.put(url, params);
  }

  transferGroup(groupID, newOwner) {
    const url = this.server + '/api/v2.1/groups/' + groupID + '/';
    const form = {
      owner: newOwner
    };
    return this.req.put(url, form);
  }

  deleteGroup(groupID) {
    var url = this.server + '/api/v2.1/groups/' + groupID + '/';
    return this.req.delete(url);
  }

  addGroupMembers(groupID, userNames) {
    const url = this.server + '/api/v2.1/groups/' + groupID + '/members/bulk/';
    let form = new FormData();
    form.append('emails', userNames.join(','));
    return this._sendPostRequest(url, form);
  }

  searchGroupMember(groupID, q) {
    const url = this.server + '/api/v2.1/groups/' + groupID + '/search-member/';
    const params = {
      q: q
    };
    return this.req.get(url, { params: params });
  }

  listGroupMembers(groupID, isAdmin = false) {
    let url = this.server + '/api/v2.1/groups/' + groupID + '/members/?is_admin=' + isAdmin;
    return this.req.get(url);
  }

  listGroupTrashProjects(groupID) {
    let url = this.server + '/api/v2.1/groups/' + groupID + '/trash-projects/';
    return this.req.get(url);
  }

  restoreGroupTrashProject(projectUuid, groupID) {
    let url = this.server + '/api/v2.1/groups/' + groupID + '/trash-projects/' + projectUuid + '/';
    return this.req.put(url);
  }

  setGroupAdmin(groupID, userName, isAdmin) {
    let name = encodeURIComponent(userName);
    let url = this.server + '/api/v2.1/groups/' + groupID + '/members/' + name + '/';
    const params = {
      is_admin: isAdmin
    };
    return this.req.put(url, params);
  }

  deleteGroupMember(groupID, userName) {
    const name = encodeURIComponent(userName);
    const url = this.server + '/api/v2.1/groups/' + groupID + '/members/' + name + '/';
    return this.req.delete(url);
  }

  moveUserGroupsOrder(group_id, anchor_group_id, to_last) {
    let url = this.server + '/api/v2.1/groups/move-group/';
    const params = {
      group_id,
      anchor_group_id,
      to_last
    };
    return this.req.put(url, params);
  }

  // users
  listUserInfo(userIdList) {
    var url = this.server + '/api/v2.1/user-list/';
    let operation = {
      user_id_list: userIdList
    };
    return this._sendPostRequest(url, operation, { headers: { 'Content-type': 'application/json' } });
  }

  // Group invite links
  getGroupInviteLinks(groupId) {
    const url = this.server + '/api/v2.1/groups/' + groupId + '/invite-links/';
    return this.req.get(url);
  }

  addGroupInviteLinks(groupId) {
    const url = this.server + '/api/v2.1/groups/' + groupId + '/invite-links/';
    return this.req.post(url);
  }

  deleteGroupInviteLinks(groupId, token) {
    const url = this.server + '/api/v2.1/groups/' + groupId + '/invite-links/' + token + '/';
    return this.req.delete(url);
  }

  listProjectAPITokens(projectUuid) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/api-tokens/';
    return this.req.get(url);
  }

  createProjectAPIToken(projectUuid, appName, permission = 'rw') {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/api-tokens/';
    return this.req.post(url, {
      app_name: appName,
      permission: permission
    });
  }

  deleteProjectAPIToken(projectUuid, tokenId) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/api-tokens/' + tokenId + '/';
    return this.req.delete(url);
  }

  updateProjectAPIToken(projectUuid, tokenId, permission) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/api-tokens/' + tokenId + '/';
    return this.req.put(url, {
      permission: permission
    });
  }

  // project trash
  listTrashProjects() {
    const url = this.server + '/api/v2.1/trash-projects/';
    return this.req.get(url);
  }

  cleanTrashProjects() {
    const url = this.server + '/api/v2.1/trash-projects/';
    return this.req.delete(url);
  }

}

const homeAPI = new HomeAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
homeAPI.initForUsage({ siteRoot, xcsrfHeaders });

export default homeAPI;

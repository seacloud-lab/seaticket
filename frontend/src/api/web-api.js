import axios from 'axios';
import FormData from 'form-data';
import cookie from 'react-cookies';
import { siteRoot } from '../constants/config';

class SeaQAAPI {

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

  listProjectShares(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/share/';
    return this.req.get(url);
  }

  addProjectShare(workspaceID, name, email, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/share/';
    let params = {
      email: email,
      permission: permission
    };
    return this.req.post(url, params);
  }

  deleteProjectShare(workspaceID, name, email) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/share/';
    let params = { email: email };
    return this.req.delete(url, { data: params });
  }

  updateProjectShare(workspaceID, name, email, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/share/';
    let params = {
      email: email,
      permission: permission
    };
    return this.req.put(url, params);
  }

  listProjectGroupShares(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/group-shares/';
    return this.req.get(url);
  }

  addProjectGroupShare(workspaceID, name, groupIDs, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/group-shares/';
    let params = {
      group_ids: groupIDs,
      permission: permission
    };
    return this.req.post(url, params);
  }

  deleteProjectGroupShare(workspaceID, name, groupID) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/group-shares/' + groupID + '/';
    return this.req.delete(url);
  }

  updateProjectGroupShare(workspaceID, name, groupID, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/group-shares/' + groupID + '/';
    let params = {
      permission: permission
    };
    return this.req.put(url, params);
  }

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

  getProjectExternalLink(workspaceID, name) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/external-links/';
    return this.req.get(url);
  }

  createProjectExternalLink(workspaceID, name, token, password, expireDays) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/external-links/';
    let form = new FormData();
    if (token) {
      form.append('token', token);
    }
    if (password) {
      form.append('password', password);
    }
    if (expireDays) {
      form.append('expire_days', expireDays);
    }
    return this._sendPostRequest(url, form);
  }

  deleteProjectExternalLink(workspaceID, name, token) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + encodeURIComponent(name) + '/external-links/' + token + '/';
    return this.req.delete(url);
  }

  queryProjectIOStatusByTaskId(taskId) {
    let url = this.server + '/api/v2.1/project-io-status/?task_id=' + taskId;
    return this.req.get(url);
  }

  cancelProjectIOTask(taskId, project_uuid, task_type) {
    let url = this.server + '/api/v2.1/project-io-status/';
    let params = {
      task_id: taskId,
      project_uuid: project_uuid,
      task_type: task_type
    };
    return this.req.delete(url, { params: params });
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

  // other not-admin APIs
  getUserInfo() {
    const url = this.server + '/api/v2.1/user/';
    return this.req.get(url);
  }

  getUserCommonInfo(email) {
    const url = this.server + '/api/v2.1/user-common-info/' + email + '/';
    return this.req.get(url);
  }

  getOrganization(org_id) {
    const url = this.server + '/api/v2.1/organizations/' + org_id + '/';
    return this.req.get(url);
  }

  getOrganizationMembers(org_id, page) {
    const url = this.server + '/api/v2.1/organizations/' + org_id + '/members/?page=' + page;
    return this.req.get(url);
  }

  getChargebeeCustomer() {
    const url = this.server + '/api/v2.1/chargebee/customer/';
    return this.req.get(url);
  }

  chargebeeCheckout(planID) {
    const url = this.server + '/api/v2.1/chargebee/checkout/';
    return this.req.post(url, { plan_id: planID });
  }

  getSubscription() {
    const url = this.server + '/api/v2.1/subscription/';
    return this.req.get(url);
  }

  getSubscriptionPlans(paymentType) {
    const url = this.server + '/api/v2.1/subscription/plans/';
    let params = {
      payment_type: paymentType,
    };
    return this.req.get(url, { params: params });
  }

  getSubscriptionLogs() {
    const url = this.server + '/api/v2.1/subscription/logs/';
    return this.req.get(url);
  }

  getSlideCaptcha() {
    const url = this.server + '/api/v2.1/slide-captcha/';
    return this.req.get(url);
  }

  verifySlideCaptcha(x, y) {
    const url = this.server + '/api/v2.1/slide-captcha/';
    let params = {
      x: x,
      y: y,
    };
    return this.req.post(url, params);
  }

  listGroups(includingAllDeps = false) {
    const url = this.server + '/api/v2.1/groups/';
    let params = { including_all_deps: includingAllDeps };
    return this.req.get(url, { params: params });
  }

  exchangeCoinByCode(code) {
    const url = this.server + '/api/v2.1/subscription/coin-exchange/';
    return this.req.post(url, { code: code });
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

  listShareableGroups() {
    const url = this.server + '/api/v2.1/shareable-groups/';
    return this.req.get(url);
  }

  listUserInfo(userIdList) {
    var url = this.server + '/api/v2.1/user-list/';
    let operation = {
      user_id_list: userIdList
    };
    return this._sendPostRequest(url, operation, { headers: { 'Content-type': 'application/json' } });
  }


  markNoticeAsRead(noticeId) {
    const url = this.server + '/api/v2.1/notification/';
    let from = new FormData();
    from.append('notice_id', noticeId);
    return this.req.put(url, from);
  }

  listNotifications(page, perPage) {
    const url = this.server + '/api/v2.1/notifications/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  listNotificationsCenter() {
    const url = this.server + '/api/v2.1/notifications-center/';
    return this.req.get(url);
  }

  listSysUserUnseenNotifications() {
    const url = this.server + '/api/v2.1/sys-user-notifications/unseen/';
    return this.req.get(url);
  }

  setSysUserNotificationToSeen(nid) {
    let url = this.server + '/api/v2.1/sys-user-notifications/' + nid + '/seen/';
    return this.req.put(url);
  }

  updateNotifications(noticeType) {
    const url = this.server + '/api/v2.1/notifications/';
    const data = {
      notice_type: noticeType
    };
    return this.req.put(url, data);
  }

  deleteNotifications() {
    const url = this.server + '/api/v2.1/notifications/';
    return this.req.delete(url);
  }

  queryOfficeFileConvertStatus(repoID, commitID, path, fileType, shareToken) {
    const url = this.server + '/office-convert/status/';
    const params = {
      repo_id: repoID,
      commit_id: commitID,
      path: path,
      doctype: fileType // 'document' or 'spreadsheet'
    };
    // for view of share link
    if (shareToken) {
      params['token'] = shareToken;
    }
    return this.req.get(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      params: params
    });
  }

  searchUsers(searchParam) {
    const url = this.server + '/api2/search-user/?q=' + encodeURIComponent(searchParam);
    return this.req.get(url);
  }

  sendUploadLink(token, email, extraMsg) {
    const url = this.server + '/api2/send-upload-link/';
    let form = new FormData();
    form.append('token', token);
    form.append('email', email);
    if (extraMsg) {
      form.append('extra_msg', extraMsg);
    }
    return this._sendPostRequest(url, form);
  }

  sendShareLink(token, email, extraMsg) {
    const url = this.server + '/api2/send-share-link/';
    let form = new FormData();
    form.append('token', token);
    form.append('email', email);
    if (extraMsg) {
      form.append('extra_msg', extraMsg);
    }
    return this._sendPostRequest(url, form);
  }

  shareableGroups() {
    const url = this.server + '/api/v2.1/shareable-groups/';
    return this.req.get(url);
  }

  listAddressBookDepartments() {
    const url = this.server + '/api/v2.1/address-book/departments/';
    return this.req.get(url);
  }

  listAddressBookDepartmentMembers(department_id) {
    const url = this.server + '/api/v2.1/address-book/departments/' + department_id + '/members/';
    return this.req.get(url);
  }

  listAddressBookV2UserDepartments() {
    const url = this.server + '/api/v2.1/address-book-v2/user-departments/';
    return this.req.get(url);
  }

  listAddressBookV2Departments() {
    const url = this.server + '/api/v2.1/address-book-v2/departments/';
    return this.req.get(url);
  }

  listAddressBookV2SubDepartments(departmentId) {
    const url = this.server + `/api/v2.1/address-book-v2/departments/${departmentId}/sub-departments/`;
    return this.req.get(url);
  }

  listAddressBookV2DepartmentMembers(departmentId) {
    const url = this.server + `/api/v2.1/address-book-v2/departments/${departmentId}/members/`;
    return this.req.get(url);
  }

  getAddressBookV2DepartmentGroupMembersCount(groupId) {
    const url = this.server + `/api/v2.1/address-book-v2/departments/groups/${groupId}/members-count/`;
    return this.req.get(url);
  }

  getInvitationLink() {
    const url = this.server + '/api/v2.1/invitation-link/';
    return this.req.get(url);
  }

  listSessions() {
    const url = this.server + '/api/v2.1/sessions/';
    return this.req.get(url);
  }

  deleteSession(session_key) {
    const url = this.server + '/api/v2.1/sessions/' + session_key + '/';
    return this.req.delete(url);
  }

  logOutSession(session_key) {
    const url = this.server + '/api/v2.1/online-sessions/' + session_key + '/';
    return this.req.delete(url);
  }

  // account api
  getAccountInfo() {
    const url = this.server + '/api2/account/info/';
    return this.req.get(url);
  }

  sendVerifyCode(phone, type) {
    let url = this.server + '/api/v2.1/user/sms-verify/';
    let data = {
      phone: phone,
      type: type
    };
    return this.req.post(url, data);
  }

  bindPhoneNumber(phone, code) {
    let url = this.server + '/api/v2.1/user/bind-phone/';
    let data = {
      phone: phone,
      code: code
    };
    return this.req.post(url, data);
  }

  unbindPhoneNumber(phone, code) {
    let url = this.server + '/api/v2.1/user/unbind-phone/';
    let data = {
      phone: phone,
      code: code
    };
    return this.req.post(url, data);
  }

  removePassword() {
    const url = this.server + '/api/v2.1/user/remove-password/';
    return this.req.put(url);
  }

  resetPasswordByPhone(phone, code, newPassword, confirmPassword) {
    let url = this.server + '/api/v2.1/user/reset-password-by-phone/';
    let data = {
      phone: phone,
      code: code,
      new_password: newPassword,
      confirm_password: confirmPassword,
    };
    return this.req.post(url, data);
  }

  resetPassword(oldPassword, newPassword) {
    let url = this.server + '/api/v2.1/user/reset-password/';
    let data = {
      old_password: oldPassword,
      new_password: newPassword
    };
    return this.req.post(url, data);
  }

  userConvertToTeam() {
    const url = this.server + '/api/v2.1/user/convert-to-team/';
    return this.req.post(url);
  }

  updateEmailNotificationInterval(emailInterval, collaborateEmailInterval) {
    const url = this.server + '/api2/account/info/';
    const data = {
      'project_updates_email_interval': emailInterval,
      'project_collaborate_email_interval': collaborateEmailInterval,
    };
    return this.req.put(url, data);
  }

  updateUserAvatar(avatarFile) {
    const url = this.server + '/api/v2.1/user-avatar/';
    let form = new FormData();
    form.append('avatar', avatarFile);
    return this._sendPostRequest(url, form);
  }

  updateUserInfo({ name, telephone, contact_email, list_in_address_book, sms_2fa }) {
    const url = this.server + '/api/v2.1/user/';
    let data = {};
    if (name !== undefined) {
      data.name = name;
    }
    if (telephone !== undefined) {
      data.telephone = telephone;
    }
    if (contact_email !== undefined) {
      data.contact_email = contact_email;
    }
    if (list_in_address_book !== undefined) {
      data.list_in_address_book = list_in_address_book;
    }
    if (sms_2fa !== undefined) {
      data.sms_2fa = sms_2fa;
    }
    return this.req.put(url, data);
  }

  bindContactEmail(newContactEmail) {
    let url = this.server + '/api/v2.1/user/contact-email/';
    let form = new FormData();
    form.append('new_contact_email', newContactEmail);
    return this.req.put(url, form);
  }

  getBaseSharePermission(workspaceId, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/project/' + encodeURIComponent(name) + '/base-share-permission/';
    return this.req.get(url);
  }

  getSharePermission(workspaceId, name, permissionId) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/project/' + encodeURIComponent(name) + '/share-permissions/' + permissionId + '/';
    return this.req.get(url);
  }

  getSharePermissions(workspaceId, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/project/' + encodeURIComponent(name) + '/share-permissions/';
    return this.req.get(url);
  }

  addSharePermission(workspaceId, name, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/project/' + encodeURIComponent(name) + '/share-permissions/';
    return this.req.post(url, permission);
  }

  updateSharePermission(workspaceId, name, permissionId, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/project/' + encodeURIComponent(name) + '/share-permissions/' + permissionId + '/';
    return this.req.put(url, permission);
  }

  deleteSharePermission(workspaceId, name, permissionId) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/project/' + encodeURIComponent(name) + '/share-permissions/' + permissionId + '/';
    return this.req.delete(url);
  }

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

  getSdocAccessToken(file_uuid) {
    const url = this.server + '/api/v2.1/seadoc/access-token/' + file_uuid + '/';
    return this.req.get(url);
  }

}

const seaQAAPI = new SeaQAAPI();
const xcsrfHeaders = cookie.load('seaqa_csrftoken');
seaQAAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { seaQAAPI };

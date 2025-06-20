import { seaQAAPI } from '../api/web-api';
import { toaster } from 'dtable-ui-component';
import { Utils } from './utils';

export default class UserService {

  constructor() {
    this.waitingQueryEmails = [];
    this.waitingExecCallbacks = [];
    this.emailUserMap = {};
  }

  getRelatedUsers(workspaceID, fileName, params, callback) {
    seaQAAPI.getTableRelatedUsers(workspaceID, fileName, params).then(res => {
      res.data.user_list.forEach(user => {
        this.emailUserMap[user.email] = user;
      });
      if (callback) callback(this.emailUserMap);
    }).catch((error) => {
      if (error.response.status === 403) {
        return;
      }
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  getEmailUserMap() {
    return this.emailUserMap;
  }

  queryUsers(emails, callback) {
    if (!Array.isArray(emails) || emails.length === 0) {
      return;
    }
    let validEmails = [];
    emails.forEach(email => {
      this.waitingExecCallbacks.push(callback);
      if (this.emailUserMap[email] || this.waitingQueryEmails.includes(email)) {
        return;
      }
      validEmails.push(email);
    });
    if (validEmails.length === 0) {
      return;
    }
    this.waitingQueryEmails.push(...validEmails);
    this.startQueryUsers();
  }

  startQueryUsers() {
    const PENDING_INTERVAL = 1000; // 1s
    if (this.pendingTimer || this.waitingQueryEmails.length === 0) {
      return;
    }
    this.pendingTimer = setTimeout(() => {
      seaQAAPI.listUserInfo(this.waitingQueryEmails).then(res => {
        const { user_list } = res.data;
        user_list.forEach(user => {
          this.emailUserMap[user.email] = user;
        });
        this.queryUserCallback();
      }).catch((error) => {
        const errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
        this.queryUserCallback();
      });
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }, PENDING_INTERVAL);
  }

  queryUserCallback() {
    this.waitingExecCallbacks.forEach(callback => {
      callback(this.emailUserMap);
    });
    this.waitingQueryEmails = [];
    this.waitingExecCallbacks = [];
  }
}

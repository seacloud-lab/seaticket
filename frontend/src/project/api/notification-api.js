import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class NotificationAPI {

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
      this.server = siteRoot.substring(0, siteRoot.length - 1);
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

  listNotifications(page = 1, perPage = 20) {
    const url = this.server + '/api/v2.1/notifications/';
    const params = { page, per_page: perPage };
    return this.req.get(url, { params });
  }

  listAllNotifications(page = 1, perPage = 25) {
    const url = this.server + '/api/v2.1/notifications/all/';
    const params = { page, per_page: perPage };
    return this.req.get(url, { params });
  }

  listProjectNotifications(projectUuid, page = 1, perPage = 20) {
    const url = this.server + '/api/v2.1/projects/' + projectUuid + '/notifications/';
    const params = { page, per_page: perPage };
    return this.req.get(url, { params });
  }

  markProjectNoticeAsRead(notificationID) {
    const url = this.server + '/api/v2.1/projects/notifications/' + notificationID + '/';
    return this.req.put(url, {});
  }

  markAllProjectRead(projectUuid) {
    const url = this.server + '/api/v2.1/projects/' + projectUuid + '/notifications/';
    return this.req.put(url, {});
  }

  markAllRead() {
    const url = this.server + '/api/v2.1/notifications/';
    return this.req.put(url, {});
  }

  markNoticeAsRead(notificationID) {
    const url = this.server + '/api/v2.1/notifications/' + notificationID + '/';
    return this.req.put(url, {});
  }

  clearAll() {
    const url = this.server + '/api/v2.1/notifications/';
    return this.req.delete(url);
  }
}

const notificationAPI = new NotificationAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
notificationAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { notificationAPI };

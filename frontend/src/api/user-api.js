import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants/config';

class UserAPI {

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

  searchUsers(searchParam) {
    const url = this.server + '/api2/search-user/?q=' + encodeURIComponent(searchParam);
    return this.req.get(url);
  }

  getUserInfo() {
    const url = this.server + '/api/v2.1/user/';
    return this.req.get(url);
  }

  getUserCommonInfo(email) {
    const url = this.server + '/api/v2.1/user-common-info/' + email + '/';
    return this.req.get(url);
  }

  listUserInfo(userIdList) {
    var url = this.server + '/api/v2.1/user-list/';
    let operation = {
      user_id_list: userIdList
    };
    return this._sendPostRequest(url, operation, { headers: { 'Content-type': 'application/json' } });
  }

  getAccountInfo() {
    const url = this.server + '/api2/account/info/';
    return this.req.get(url);
  }

}

const userAPI = new UserAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
userAPI.initForUsage({ siteRoot, xcsrfHeaders });

export default userAPI;

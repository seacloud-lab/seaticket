import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants/config';

class ProfileSettingsAPI {

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

  bindContactEmail(newContactEmail) {
    let url = this.server + '/api/v1/user/contact-email/';
    let form = new FormData();
    form.append('new_contact_email', newContactEmail);
    return this.req.put(url, form);
  }

  updateEmailNotificationInterval(emailInterval, collaborateEmailInterval) {
    const url = this.server + '/api2/account/info/';
    const data = {
      'project_updates_email_interval': emailInterval,
      'collaborate_email_interval': collaborateEmailInterval,
    };
    return this.req.put(url, data);
  }

  // user info
  getUserInfo() {
    const url = this.server + '/api/v1/user/';
    return this.req.get(url);
  }

  updateUserAvatar(avatarFile) {
    const url = this.server + '/api/v1/user-avatar/';
    let form = new FormData();
    form.append('avatar', avatarFile);
    return this._sendPostRequest(url, form);
  }

  updateUserInfo({ name, telephone, contact_email, list_in_address_book }) {
    const url = this.server + '/api/v1/user/';
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
    return this.req.put(url, data);
  }

  // sessions
  listSessions() {
    const url = this.server + '/api/v1/sessions/';
    return this.req.get(url);
  }

  deleteSession(session_key) {
    const url = this.server + '/api/v1/sessions/' + session_key + '/';
    return this.req.delete(url);
  }

  logOutSession(session_key) {
    const url = this.server + '/api/v1/online-sessions/' + session_key + '/';
    return this.req.delete(url);
  }

  updateWebdavSecret() {
    // todo
  }

  userConvertToTeam() {
    const url = this.server + '/api/v1/user/convert-to-team/';
    return this.req.post(url);
  }

  removePassword() {
    const url = this.server + '/api/v1/user/remove-password/';
    return this.req.put(url);
  }

  resetPassword(oldPassword, newPassword) {
    let url = this.server + '/api/v1/user/reset-password/';
    let data = {
      old_password: oldPassword,
      new_password: newPassword
    };
    return this.req.post(url, data);
  }

}

const profileSettingsAPI = new ProfileSettingsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
profileSettingsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export default profileSettingsAPI;

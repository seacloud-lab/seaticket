import axios from 'axios';
import FormData from 'form-data';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class ConnectionsAPI {

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

  listConnections(projectUuid, page, perPage) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/';
    let params = {
      page: page,
      per_page: perPage,
    };
    return this.req.get(url, { params: params });
  }

  createConnection(projectUuid, { type, name, config }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/';
    let form = new FormData();
    form.append('name', name);
    form.append('type', type);
    form.append('config', JSON.stringify(config));
    return this._sendPostRequest(url, form);
  }

  modifyConnection(projectUuid, connectionID, { name, config }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    let form = new FormData();
    form.append('name', name);
    form.append('config', JSON.stringify(config));
    return this.req.put(url, form);
  }

  deleteConnection(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    return this.req.delete(url);
  }

  getConnection(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    return this.req.get(url);
  }

  triggerSync(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/sync/';
    return this.req.post(url);
  }

  getConnectionDetails(projectUuid, connectionID, { view_id = 'open', start = 0, limit = 100, } = {}){
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/details/';
    let params = {
      view_id,
      start,
      limit
    };
    return this.req.get(url, { params: params });
  }

  getConnectionRowDetail(projectUuid, connectionID, params) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/details/row-detail/';
    return this.req.get(url, { params: params });
  }

  getConnectionLogs(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/logs/';
    return this.req.get(url);
  }

  queryConnectionsStatus(projectUuid, connectionIds) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/query-status/';
    const params = {
      connection_ids: connectionIds.join(','),
    };
    return this.req.get(url, { params: params });
  }

  updateConnectionStatus(projectUuid, connectionID, { is_active }) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/';
    let form = new FormData();
    form.append('is_active', is_active);
    return this.req.put(url, form);
  }

  listViews(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/views/';
    return this.req.get(url);
  }

  insertView(projectUuid, connectionID, name, viewData) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/views/';
    let form = new FormData();
    if (name) {
      form.append('name', name);
    }
    if (viewData) {
      form.append('data', viewData);
    }
    return this._sendPostRequest(url, form);
  }

  getView(projectUuid, viewID, connectionID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/views/' + viewID + '/';
    return this.req.get(url);
  }

  modifyView(projectUuid, connectionID, viewID, viewData) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/views/' + viewID + '/';
    const params = {
      view_data: viewData,
    };
    return this.req.put(url, params);
  }

  deleteView(projectUuid, connectionID, viewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/views/' + viewID + '/';
    return this.req.delete(url);
  }

  moveView(projectUuid, connectionID, sourceViewID, targetViewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/move-views/';
    let form = new FormData();
    if (sourceViewID) {
      form.append('source_view_id', sourceViewID);
    }
    if (targetViewID) {
      form.append('target_view_id', targetViewID);
    }
    return this._sendPostRequest(url, form);
  }

  duplicateView(projectUuid, connectionID, viewID) {
    const url = this.server + '/api/v2.1/project/' + projectUuid + '/connections/' + connectionID + '/duplicate-view/';

    let form = new FormData();
    if (viewID) {
      form.append('view_id', viewID);
    }
    return this._sendPostRequest(url, form);
  }

  convertRecordToTicket(projectUuid, connectionID, recordID) {
    const url = this.server + '/api/v2.1/ai/convert-record-to-ticket/';
    let form = new FormData();
    form.append('project_uuid', projectUuid);
    form.append('connection_id', connectionID);
    form.append('record_id', recordID);
    return this._sendPostRequest(url, form);
  }


  getEmbeddingAnalysis(projectUuid, connectionID) {
    const url = this.server + '/api/v2.1/ai/embedding-analysis/';
    const data = {
      project_uuid: projectUuid,
      connection_id: connectionID
    };
    return this.req.post(url, data);
  }

  getEmbeddingAnalysisTaskStatus(taskId) {
    const url = this.server + `/api/v2.1/ai/embedding-analysis-task-status/${taskId}`;
    return this.req.get(url);
  }

  findRelatedRecords(projectUuid, connectionID, recordID) {
    const url = this.server + '/api/v2.1/ai/related-records/';
    const data = {
      project_uuid: projectUuid,
      connection_id: connectionID,
      record_id: recordID
    };
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({
          data: {
            'related_records': [
              {
                '_id': 3943,
                'connection_id': 86,
                'score': 0.7359083294868469,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing crashes with Seafile client 7.0.7 on macOS Catalina.',
                'url': 'https://forum.seafile.com/t/seafile-client-7-0-7-crash-macos-catalina/11476',
                'content': 'The user is experiencing crashes with Seafile client 7.0.7 on macOS Catalina.',
                'title': 'Seafile client 7.0.7 crash macOS Catalina',
                'slug': 'seafile-client-7-0-7-crash-macos-catalina',
                'topic_id': 11476,
                'modified_time': '2020-05-23T11:32:19.557+08:00'
              },
              {
                '_id': 4173,
                'connection_id': 86,
                'score': 0.608302652835846,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing crashes with the desktop drive client on Mac Catalina.',
                'url': 'https://forum.seafile.com/t/desktop-drive-client-crash-on-mac-catalina/10096',
                'content': 'The user is experiencing crashes with the desktop drive client on Mac Catalina.',
                'title': 'Desktop Drive Client Crash on Mac Catalina',
                'slug': 'desktop-drive-client-crash-on-mac-catalina',
                'topic_id': 10096,
                'modified_time': '2020-03-09T18:22:43.075+08:00'
              },
              {
                '_id': 1147,
                'connection_id': 86,
                'score': 0.6600740551948547,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with the Seafile client on their Mac.',
                'url': 'https://forum.seafile.com/t/problem-with-seafile-client-for-mac/19319',
                'content': 'The user is experiencing issues with the Seafile client on their Mac.',
                'title': 'Problem with Seafile Client for Mac',
                'slug': 'problem-with-seafile-client-for-mac',
                'topic_id': 19319,
                'modified_time': '2024-02-16T00:02:28.754+08:00'
              },
              {
                '_id': 2909,
                'connection_id': 86,
                'score': 0.6329598426818848,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with Seafile Drive on macOS Monterey.',
                'url': 'https://forum.seafile.com/t/seafile-drive-osx-monterey-not-working/14794',
                'content': 'The user is experiencing issues with Seafile Drive on macOS Monterey.',
                'title': 'Seafile Drive OSX Monterey Not Working',
                'slug': 'seafile-drive-osx-monterey-not-working',
                'topic_id': 14794,
                'modified_time': '2021-07-08T00:51:54.424+08:00'
              },
              {
                '_id': 1354,
                'connection_id': 86,
                'score': 0.6118935942649841,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with Seafile Drive not loading on MacOS Sonoma 14.0.',
                'url': 'https://forum.seafile.com/t/seafile-drive-not-loading-under-macos-sonoma-14-0/18676',
                'content': 'The user is experiencing issues with Seafile Drive not loading on MacOS Sonoma 14.0.',
                'title': 'Seafile Drive not loading under MacOS Sonoma 14.0',
                'slug': 'seafile-drive-not-loading-under-macos-sonoma-14-0',
                'topic_id': 18676,
                'modified_time': '2023-10-31T05:00:43.066+08:00'
              },
              {
                '_id': 3943,
                'connection_id': 86,
                'score': 0.7359083294868469,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing crashes with Seafile client 7.0.7 on macOS Catalina.',
                'url': 'https://forum.seafile.com/t/seafile-client-7-0-7-crash-macos-catalina/11476',
                'content': 'The user is experiencing crashes with Seafile client 7.0.7 on macOS Catalina.',
                'title': 'Seafile client 7.0.7 crash macOS Catalina',
                'slug': 'seafile-client-7-0-7-crash-macos-catalina',
                'topic_id': 11476,
                'modified_time': '2020-05-23T11:32:19.557+08:00'
              },
              {
                '_id': 4173,
                'connection_id': 86,
                'score': 0.608302652835846,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing crashes with the desktop drive client on Mac Catalina.',
                'url': 'https://forum.seafile.com/t/desktop-drive-client-crash-on-mac-catalina/10096',
                'content': 'The user is experiencing crashes with the desktop drive client on Mac Catalina.',
                'title': 'Desktop Drive Client Crash on Mac Catalina',
                'slug': 'desktop-drive-client-crash-on-mac-catalina',
                'topic_id': 10096,
                'modified_time': '2020-03-09T18:22:43.075+08:00'
              },
              {
                '_id': 1147,
                'connection_id': 86,
                'score': 0.6600740551948547,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with the Seafile client on their Mac.',
                'url': 'https://forum.seafile.com/t/problem-with-seafile-client-for-mac/19319',
                'content': 'The user is experiencing issues with the Seafile client on their Mac.',
                'title': 'Problem with Seafile Client for Mac',
                'slug': 'problem-with-seafile-client-for-mac',
                'topic_id': 19319,
                'modified_time': '2024-02-16T00:02:28.754+08:00'
              },
              {
                '_id': 2909,
                'connection_id': 86,
                'score': 0.6329598426818848,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with Seafile Drive on macOS Monterey.',
                'url': 'https://forum.seafile.com/t/seafile-drive-osx-monterey-not-working/14794',
                'content': 'The user is experiencing issues with Seafile Drive on macOS Monterey.',
                'title': 'Seafile Drive OSX Monterey Not Working',
                'slug': 'seafile-drive-osx-monterey-not-working',
                'topic_id': 14794,
                'modified_time': '2021-07-08T00:51:54.424+08:00'
              },
              {
                '_id': 1354,
                'connection_id': 86,
                'score': 0.6118935942649841,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with Seafile Drive not loading on MacOS Sonoma 14.0.',
                'url': 'https://forum.seafile.com/t/seafile-drive-not-loading-under-macos-sonoma-14-0/18676',
                'content': 'The user is experiencing issues with Seafile Drive not loading on MacOS Sonoma 14.0.',
                'title': 'Seafile Drive not loading under MacOS Sonoma 14.0',
                'slug': 'seafile-drive-not-loading-under-macos-sonoma-14-0',
                'topic_id': 18676,
                'modified_time': '2023-10-31T05:00:43.066+08:00'
              },
              {
                '_id': 3943,
                'connection_id': 86,
                'score': 0.7359083294868469,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing crashes with Seafile client 7.0.7 on macOS Catalina.',
                'url': 'https://forum.seafile.com/t/seafile-client-7-0-7-crash-macos-catalina/11476',
                'content': 'The user is experiencing crashes with Seafile client 7.0.7 on macOS Catalina.',
                'title': 'Seafile client 7.0.7 crash macOS Catalina',
                'slug': 'seafile-client-7-0-7-crash-macos-catalina',
                'topic_id': 11476,
                'modified_time': '2020-05-23T11:32:19.557+08:00'
              },
              {
                '_id': 4173,
                'connection_id': 86,
                'score': 0.608302652835846,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing crashes with the desktop drive client on Mac Catalina.',
                'url': 'https://forum.seafile.com/t/desktop-drive-client-crash-on-mac-catalina/10096',
                'content': 'The user is experiencing crashes with the desktop drive client on Mac Catalina.',
                'title': 'Desktop Drive Client Crash on Mac Catalina',
                'slug': 'desktop-drive-client-crash-on-mac-catalina',
                'topic_id': 10096,
                'modified_time': '2020-03-09T18:22:43.075+08:00'
              },
              {
                '_id': 1147,
                'connection_id': 86,
                'score': 0.6600740551948547,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with the Seafile client on their Mac.',
                'url': 'https://forum.seafile.com/t/problem-with-seafile-client-for-mac/19319',
                'content': 'The user is experiencing issues with the Seafile client on their Mac.',
                'title': 'Problem with Seafile Client for Mac',
                'slug': 'problem-with-seafile-client-for-mac',
                'topic_id': 19319,
                'modified_time': '2024-02-16T00:02:28.754+08:00'
              },
              {
                '_id': 2909,
                'connection_id': 86,
                'score': 0.6329598426818848,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with Seafile Drive on macOS Monterey.',
                'url': 'https://forum.seafile.com/t/seafile-drive-osx-monterey-not-working/14794',
                'content': 'The user is experiencing issues with Seafile Drive on macOS Monterey.',
                'title': 'Seafile Drive OSX Monterey Not Working',
                'slug': 'seafile-drive-osx-monterey-not-working',
                'topic_id': 14794,
                'modified_time': '2021-07-08T00:51:54.424+08:00'
              },
              {
                '_id': 1354,
                'connection_id': 86,
                'score': 0.6118935942649841,
                'type': 'discourse_forum',
                'ai_summary': 'The user is experiencing issues with Seafile Drive not loading on MacOS Sonoma 14.0.',
                'url': 'https://forum.seafile.com/t/seafile-drive-not-loading-under-macos-sonoma-14-0/18676',
                'content': 'The user is experiencing issues with Seafile Drive not loading on MacOS Sonoma 14.0.',
                'title': 'Seafile Drive not loading under MacOS Sonoma 14.0',
                'slug': 'seafile-drive-not-loading-under-macos-sonoma-14-0',
                'topic_id': 18676,
                'modified_time': '2023-10-31T05:00:43.066+08:00'
              },
            ]
          }
        });
      }, 500);
    });
    return this.req.post(url, data);
  }
}

const connectionsAPI = new ConnectionsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
connectionsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { connectionsAPI };

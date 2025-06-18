import axios from 'axios';
import FormData from 'form-data';
import cookie from 'react-cookies';
import { siteRoot } from '../utils/constants';

class DTableWebAPI {

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

  initForDTableUsage({ siteRoot, xcsrfHeaders }) {
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

  uploadImage(uploadLink, formData, onUploadProgress = null) {
    return (
      axios.create()({
        method: 'post',
        data: formData,
        url: uploadLink,
        onUploadProgress: onUploadProgress
      })
    );
  }

  listWorkspaces(detail) {
    let url = this.server + '/api/v2.1/workspaces/';
    if (detail !== undefined) {
      url = url + '?detail=' + detail;
    }
    return this.req.get(url);
  }

  listWebsites(workspaceID, projectName, page, perPage) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + projectName + '/websites/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  createWebsite(workspaceID, projectName, webUrl, sitemapUrl) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + projectName + '/websites/';
    let form = new FormData();
    form.append('url', webUrl);
    form.append('sitemap_url', sitemapUrl);
    return this._sendPostRequest(url, form);
  }

  deleteWebsite(workspaceID, projectName, websiteID) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/' + projectName + '/websites/' + websiteID + '/';
    return this.req.delete(url);
  }

  listSharedViews() {
    let url = this.server + '/api/v2.1/dtables/view-shares-user-shared/';
    return this.req.get(url);
  }

  leaveViewShare(viewShareId) {
    let url = this.server + '/api/v2.1/dtables/view-shares-user-shared/' + viewShareId + '/';
    return this.req.delete(url);
  }

  listGroupSharedViews() {
    let url = this.server + '/api/v2.1/dtables/view-shares-group-shared/';
    return this.req.get(url);
  }

  leaveGroupViewShare(viewShareId) {
    let url = this.server + '/api/v2.1/dtables/view-shares-group-shared/' + viewShareId + '/';
    return this.req.delete(url);
  }

  // ---- project api
  createProject(name, owner, dtableIcon, dtableColor, textColor, folderID) {
    const url = this.server + '/api/v2.1/projects/';
    let form = new FormData();
    form.append('name', name);
    form.append('owner', owner);
    if (dtableColor) {
      form.append('color', dtableColor);
    }
    if (dtableIcon) {
      form.append('icon', dtableIcon);
    }
    if (textColor) {
      form.append('text_color', textColor);
    }
    if (folderID) {
      form.append('folder_id', folderID);
    }
    return this._sendPostRequest(url, form);
  }

  renameTable(workspaceID, old_name, new_name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/';
    let form = new FormData();
    form.append('name', old_name);
    form.append('new_name', new_name);
    return this.req.put(url, form);
  }

  updateTable(workspaceID, project_name, updates) {
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
    if (Object.prototype.hasOwnProperty.call(updates, 'password')) {
      form.append('password', updates.password);
    }
    return this.req.put(url, form);
  }

  updateDTablePassword(workspaceID, dtableName, operation, password, new_password, code) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(dtableName) + '/password/';
    let form = new FormData();
    form.append('operation', operation);
    if (new_password) {
      form.append('new_password', new_password);
    }
    if (password) {
      form.append('password', password);
    }
    if (code) {
      form.append('code', code);
    }
    return this.req.put(url, form);
  }

  deleteTable(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/project/';
    let params = { name: name };
    return this.req.delete(url, { data: params });
  }

  listTableShares(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/share/';
    return this.req.get(url);
  }

  addTableShare(workspaceID, name, email, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/share/';
    let params = {
      email: email,
      permission: permission
    };
    return this.req.post(url, params);
  }

  deleteTableShare(workspaceID, name, email) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/share/';
    let params = { email: email };
    return this.req.delete(url, { data: params });
  }

  updateTableShare(workspaceID, name, email, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/share/';
    let params = {
      email: email,
      permission: permission
    };
    return this.req.put(url, params);
  }

  listTableGroupShares(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/group-shares/';
    return this.req.get(url);
  }

  addTableGroupShare(workspaceID, name, groupIDs, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/group-shares/';
    let params = {
      group_ids: groupIDs,
      permission: permission
    };
    return this.req.post(url, params);
  }

  deleteTableGroupShare(workspaceID, name, groupID) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/group-shares/' + groupID + '/';
    return this.req.delete(url);
  }

  updateTableGroupShare(workspaceID, name, groupID, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/group-shares/' + groupID + '/';
    let params = {
      permission: permission
    };
    return this.req.put(url, params);
  }

  getDTableInviteLink(workspaceID, name) {
    var url = this.server + '/api/v2.1/dtables/invite-links/?workspace_id=' + workspaceID + '&table_name=' + encodeURIComponent(name);
    return this.req.get(url);
  }

  createDTableInviteLink(workspaceID, name, permission, password, expire_days) {
    let url = this.server + '/api/v2.1/dtables/invite-links/';
    let form = new FormData();
    form.append('workspace_id', workspaceID);
    form.append('table_name', name);

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

  deleteDTableInviteLink(token) {
    var url = this.server + '/api/v2.1/dtables/invite-links/' + token + '/';
    return this.req.delete(url);
  }

  getDTableExternalLink(workspaceID, name) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/external-links/';
    return this.req.get(url);
  }

  createDTableExternalLink(workspaceID, name, token, password, expireDays) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/external-links/';
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

  deleteDTableExternalLink(workspaceID, name, token) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/external-links/' + token + '/';
    return this.req.delete(url);
  }

  listTableAPITokens(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/api-tokens/';
    return this.req.get(url);
  }

  addTableAPIToken(workspaceID, name, appName, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/api-tokens/';
    let params = {
      app_name: appName,
      permission: permission
    };
    return this.req.post(url, params);
  }

  updateTableAPIToken(workspaceID, name, appName, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/api-tokens/' + encodeURIComponent(appName) + '/';
    let params = {
      permission: permission
    };
    return this.req.put(url, params);
  }

  deleteTableAPIToken(workspaceID, name, appName) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/api-tokens/' + encodeURIComponent(appName) + '/';
    return this.req.delete(url);
  }

  getDTableTempAPIToken(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/temp-api-token/';
    return this.req.get(url);
  }

  copyDTable(srcWorkspaceID, dstWorkspaceID, name, password, isCopyDatasetSyncs) {
    let url = this.server + '/api/v2.1/dtable-copy/';
    let formData = new FormData();
    formData.append('src_workspace_id', srcWorkspaceID);
    formData.append('dst_workspace_id', dstWorkspaceID);
    formData.append('name', name);
    if (password) {
      formData.append('password', password);
    }
    if (isCopyDatasetSyncs !== null && typeof isCopyDatasetSyncs !== 'undefined') {
      formData.append('is_copy_dataset_syncs', isCopyDatasetSyncs);
    }
    return this._sendPostRequest(url, formData);
  }

  queryCopyDTableStatus(taskId) {
    let url = this.server + '/api/v2.1/dtable-copy/status/?task_id=' + taskId;
    return this.req.get(url);
  }

  doTaskAfterCopyDTable(dst_dtable_uuid) {
    let url = this.server + '/api/v2.1/dtable-copy/do-task-after-copy/';
    let formData = new FormData();
    formData.append('dst_dtable_uuid', dst_dtable_uuid);
    return this._sendPostRequest(url, formData);
  }

  copyDTablePerCDSsCheck(srcWorkspaceID, name, dstWorkspaceID) {
    let url = this.server + '/api/v2.1/dtable-copy/pre-common-dataset-syncs-check/';
    let form = new FormData();
    form.append('src_workspace_id', srcWorkspaceID);
    form.append('name', name);
    form.append('dst_workspace_id', dstWorkspaceID);
    return this._sendPostRequest(url, form);
  }

  copyExternalDtable(dstWorkspaceID, link, folderID) {
    let url = this.server + '/api/v2.1/dtable-external-link/dtable-copy/';
    let formData = new FormData();
    formData.append('link', link);
    formData.append('dst_workspace_id', dstWorkspaceID);
    if (folderID) {
      formData.append('folder_id', folderID);
    }
    return this._sendPostRequest(url, formData);
  }

  addExportDTableTask(workspaceId, dtable_name, password, ignore_asset) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtable_name) + '/export-dtable/';
    let formData = new FormData();
    if (password) {
      formData.append('password', password);
    }
    if (ignore_asset) {
      formData.append('ignore_asset', ignore_asset);
    }

    return this._sendPostRequest(url, formData);
  }

  addImportDTableTask(workspaceId, file, folderID) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/import-dtable/';
    let formData = new FormData();
    formData.append('dtable', file);
    if (folderID) {
      formData.append('folder_id', folderID);
    }
    return this._sendPostRequest(url, formData);
  }

  queryDTableIOStatusByTaskId(taskId) {
    let url = this.server + '/api/v2.1/dtable-io-status/?task_id=' + taskId;
    return this.req.get(url);
  }

  cancelDTableIOTask(taskId, dtable_uuid, task_type) {
    let url = this.server + '/api/v2.1/dtable-io-status/';
    let params = {
      task_id: taskId,
      dtable_uuid: dtable_uuid,
      task_type: task_type
    };
    return this.req.delete(url, { params: params });
  }

  importExcelCSVPreview(workspaceId, dtableName) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/import-excel-csv/?dtable_name=' + encodeURIComponent(dtableName);
    return this.req.get(url);
  }

  importExcelCSVCancel(workspaceId, dtableName, fileType) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/import-excel-csv/?dtable_name=' + encodeURIComponent(dtableName) + '&file_type=' + fileType;
    return this.req.delete(url);
  }

  addImportExcelCSVTask(workspaceId, dtableName, folderID, includedTables) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/import-excel-csv/';
    let params = {
      dtable_name: dtableName,
      included_tables: includedTables
    };
    if (folderID) {
      params['folder_id'] = folderID;
    }
    return this.req.post(url, params);
  }

  addConvertPageTask(workspaceId, dtableName, params) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtableName) + '/convert-page/';
    return this.req.get(url, { params: params });
  }

  addStarDTable(dtable_uuid) {
    let url = this.server + '/api/v2.1/starred-dtables/';
    let formData = new FormData();
    formData.append('dtable_uuid', dtable_uuid);
    return this.req.post(url, formData);
  }

  unstarProject(dtable_uuid) {
    let url = this.server + '/api/v2.1/starred-dtables/?dtable_uuid=' + dtable_uuid;
    return this.req.delete(url);
  }

  searchItems(query_str, query_type) {
    let url = this.server + '/api/v2.1/dtable/items-search/';
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

  getDTableWebhooks(workspaceID, name) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/webhooks/';
    return this.req.get(url);
  }

  createDTableWebhook(workspaceID, name, hookURL, secret) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/webhooks/';
    let form = new FormData();
    form.append('url', hookURL);
    if (secret) {
      form.append('secret', secret);
    }
    return this._sendPostRequest(url, form);
  }

  deleteDTableWebhook(workspaceID, name, webhookID) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/webhooks/' + webhookID + '/';
    return this.req.delete(url);
  }

  updateDTableWebhook(workspaceID, name, webhookID, updates) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/webhooks/' + webhookID + '/';
    let form = new FormData();
    if (updates.url) {
      form.append('url', updates.url);
    }
    if (updates.secret) {
      form.append('secret', updates.secret);
    }
    return this.req.put(url, form);
  }

  updateDTableCollectionTable(token, config) {
    let url = this.server + '/api/v2.1/collection-tables/' + token + '/';
    let formData = new FormData();
    formData.append('config', config);
    return this.req.put(url, formData);
  }

  listForms() {
    let url = this.server + '/api/v2.1/forms/';
    return this.req.get(url);
  }

  listSharedForms() {
    let url = this.server + '/api/v2.1/forms/shared/';
    return this.req.get(url);
  }

  addFormCustomUrls(token, customUrl) {
    const url = this.server + '/api/v2.1/forms/' + token + '/custom-urls/';
    let formData = new FormData();
    formData.append('custom_url', customUrl);
    return this.req.post(url, formData);
  }

  deleteFormCustomUrl(token, customUrl) {
    let url = this.server + '/api/v2.1/forms/' + token + '/custom-urls/';
    let params = { custom_url: customUrl };
    return this.req.delete(url, { data: params });
  }

  updateDTableForm(token, formConfig) {
    let url = this.server + '/api/v2.1/forms/' + token + '/';
    let formData = new FormData();
    formData.append('form_config', formConfig);
    return this.req.put(url, formData);
  }

  dTableFormShare(token, shareType, groupIDs) {
    let url = this.server + '/api/v2.1/forms/' + token + '/share/';
    let params = {
      share_type: shareType,
      group_ids: groupIDs
    };
    return this.req.post(url, params);
  }

  getPublicUploadLinkViaFormToken(token) {
    let url = this.server + '/api/v2.1/forms/' + token + '/public-upload-link/';
    return this.req.get(url);
  }

  getUploadLinkViaFormToken(token, uploadType) {
    let url = this.server + '/api/v2.1/forms/' + token + '/upload-link/';
    return this.req.get(url, { params: { upload_type: uploadType } });
  }

  submitFormData(token, table_id, row_data, link_data) {
    const url = this.server + '/api/v2.1/form-submit/' + token + '/';
    let form = new FormData();
    form.append('table_id', table_id);
    form.append('row_data', row_data);
    if (link_data) {
      form.append('link_data', link_data);
    }
    return this._sendPostRequest(url, form);
  }

  getFormLinkedRows(customUrl, formToken, linkColumnKey) {
    const url = `${this.server}/api/v2.1/forms/linked-rows/`;
    const params = {
      link_column_key: linkColumnKey
    };
    if (customUrl) {
      params['custom_url'] = customUrl;
    }
    if (formToken) {
      params['form_token'] = formToken;
    }
    return this.req.get(url, { params });
  }

  getActivitiesDetail(dtable_uuid, opDate, pageNum) {
    let params = 'dtable_uuid=' + dtable_uuid + '&op_date=' + encodeURIComponent(opDate) + '&page=' + pageNum;
    let url = this.server + '/api/v2.1/dtable-activities/detail/?' + params;
    return this.req.get(url);
  }

  getDTableActivities(pageNum, to_tz) {
    let url = this.server + '/api/v2.1/dtable-activities/?page=' + pageNum + '&to_tz=' + encodeURIComponent(to_tz);
    return this.req.get(url);
  }

  listDTableSnapshots(workspaceID, dtableName, page, perPage) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(dtableName) + '/snapshots/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, { params: params });
  }

  restoreDTableSnapshot(workspaceID, dtableName, commitId, snapshotName, password, backupVersion) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(dtableName) + '/snapshots/' + commitId + '/restore/';
    let form = new FormData();
    form.append('snapshot_name', snapshotName);
    if (password) {
      form.append('password', password);
    }
    if (backupVersion) {
      form.append('backup_version', backupVersion);
    }

    return this._sendPostRequest(url, form);
  }

  listArchiveBackups(workspaceID, dtableName) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(dtableName) + '/archive-backups/';
    return this.req.get(url);
  }

  getBigDataState(workspaceID, dtableName) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(dtableName) + '/big-data-state/';
    return this.req.get(url);
  }

  listTrashDTables(page, perPage) {
    let url = this.server + '/api/v2.1/trash-dtables/';
    let params = {
      page: page,
      per_page: perPage
    };
    return this.req.get(url, {
      params: params
    });
  }

  cleanTrashDTables() {
    let url = this.server + '/api/v2.1/trash-dtables/';
    return this.req.delete(url);
  }

  restoreTrashDTable(dtableID) {
    let url = this.server + '/api/v2.1/trash-dtables/' + dtableID + '/';
    return this.req.put(url);
  }

  createFolder(workspaceID, name) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/folders/';
    let form = new FormData();
    form.append('name', name);
    return this._sendPostRequest(url, form);
  }

  updateFolder(workspaceID, folderID, name) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/folders/' + folderID + '/';
    let form = new FormData();
    form.append('name', name);
    return this.req.put(url, form);
  }

  deleteFolder(workspaceID, folderID) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/folders/' + folderID + '/';
    return this.req.delete(url);
  }

  moveFolderItem(workspaceID, itemType, itemID, moveFrom, moveTo) {
    let url = this.server + '/api/v2.1/workspace/' + workspaceID + '/folder-item-moving/';
    let form = new FormData();
    form.append('item_type', itemType);
    form.append('item_id', itemID);
    form.append('from', moveFrom);
    form.append('to', moveTo);
    return this._sendPostRequest(url, form);
  }

  createShareFolder(name) {
    let url = this.server + '/api/v2.1/dtables/share-folders/';
    let form = new FormData();
    form.append('name', name);
    return this._sendPostRequest(url, form);
  }

  renameShareFolder(name, share_folder_id) {
    let url = this.server + '/api/v2.1/dtables/share-folders/' + share_folder_id + '/';
    let form = new FormData();
    form.append('name', name);
    return this.req.put(url, form);
  }

  deleteShareFolder(share_folder_id) {
    let url = this.server + '/api/v2.1/dtables/share-folders/' + share_folder_id + '/';
    return this.req.delete(url);
  }

  getShareFolderContent(share_folder_id) {
    let url = this.server + '/api/v2.1/dtables/share-folders/' + share_folder_id + '/';
    return this.req.get(url);
  }

  moveShareTableToFolder(dtable_share_id, move_to) {
    let url = this.server + '/api/v2.1/dtables/share-table-move-to-folder/' + dtable_share_id + '/';
    let form = new FormData();
    form.append('move_to', move_to);
    return this._sendPostRequest(url, form);
  }

  moveShareViewToFolder(view_share_id, move_to) {
    let url = this.server + '/api/v2.1/dtables/share-view-move-to-folder/' + view_share_id + '/';
    let form = new FormData();
    form.append('move_to', move_to);
    return this._sendPostRequest(url, form);
  }

  querySql(dtableUuid, sql) {
    let url = this.server + '/api/v2.1/dtable-db/query/' + dtableUuid + '/';
    let form = new FormData();
    form.append('sql', sql);
    return this._sendPostRequest(url, form);
  }

  pageDesignQueryRowLinkRecords(dtableUuid, tableId, rowId, linkColumns) {
    let url = this.server + '/api/v2.1/page-design/row-link-records/' + dtableUuid + '/';
    let form = new FormData();
    form.append('table_id', tableId);
    form.append('row_id', rowId);
    form.append('link_columns', linkColumns);
    return this._sendPostRequest(url, form);
  }

  pageDesignQueryRowsLinkRecords(dtableUuid, tableId, rowIds, linkColumns) {
    let url = this.server + '/api/v2.1/page-design/rows-link-records/' + dtableUuid + '/';
    let form = new FormData();
    form.append('table_id', tableId);
    form.append('row_ids', rowIds);
    form.append('link_columns', linkColumns);
    return this._sendPostRequest(url, form);
  }

  listUserApps() {
    let url = this.server + '/api/v2.1/universal-apps/';
    return this.req.get(url);
  }

  leaveApp(appUserId) {
    let url = this.server + '/api/v2.1/app-users/' + appUserId + '/';
    return this.req.delete(url);
  }

  // universal-app-folders module
  createAppFolder(name, folder_type) {
    let url = this.server + '/api/v2.1/universal-apps/folders/';
    let form = new FormData();
    form.append('name', name);
    form.append('folder_type', folder_type);
    return this._sendPostRequest(url, form);
  }

  deleteAppFolder(app_folder_id) {
    let url = this.server + '/api/v2.1/universal-apps/folders/' + app_folder_id + '/';
    return this.req.delete(url);
  }

  renameAppFolder(name, app_folder_id) {
    let url = this.server + '/api/v2.1/universal-apps/folders/' + app_folder_id + '/';
    let form = new FormData();
    form.append('name', name);
    return this.req.put(url, form);
  }

  getAppFolderContent(app_folder_id) {
    let url = this.server + '/api/v2.1/universal-apps/folders/' + app_folder_id + '/';
    return this.req.get(url);
  }

  moveAppToFolder(appUuid, move_from, move_to) {
    let url = this.server + `/api/v2.1/universal-apps/${appUuid}/move-app-to-folder/`;
    let form = new FormData();
    form.append('move_from', move_from);
    form.append('move_to', move_to);
    return this._sendPostRequest(url, form);
  }

  // ---- dtable data api
  getTableRelatedUsers(workspaceID, name, reqParams) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + encodeURIComponent(name) + '/related-users/';
    let params = {};
    if (reqParams) {
      if (reqParams.workflowToken) {
        params.workflow_token = reqParams.workflowToken;
      }
      if (reqParams.taskId) {
        params.task_id = reqParams.taskId;
      }
    }
    return this.req.get(url, { params });
  }

  getTableAssetUploadLink(workspaceID, name) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable-asset-upload-link/?name=' + encodeURIComponent(name);
    return this.req.get(url);
  }

  isDTableAssetExist(workspaceID, tableName, path) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceID + '/dtable/' + tableName + '/asset-exists/?path=' + path;
    return this.req.get(url);
  }

  listThirdPartyAccounts(dtableUuid) {
    let url = this.server + '/api/v2.1/third-party-accounts/' + dtableUuid + '/';
    return this.req.get(url);
  }

  // workflow apis
  updateWorkflow(token, workflowConfig) {
    let url = this.server + '/api/v2.1/workflows/' + token + '/';
    let form = new FormData();
    form.append('workflow_config', workflowConfig);
    return this.req.put(url, form);
  }

  updateWorkflowProperties(token, updates) {
    let url = this.server + '/api/v2.1/workflows/' + token + '/';
    let form = new FormData();
    if (updates.workflow_name) {
      form.append('workflow_name', updates.workflow_name);
    }
    if (updates.can_any_user_submit_via_link) {
      form.append('can_any_user_submit_via_link', updates.can_any_user_submit_via_link);
    }
    if (updates.icon) {
      form.append('icon', updates.icon);
    }
    if (updates.color) {
      form.append('color', updates.color);
    }
    return this.req.put(url, form);
  }

  deleteWorkflow(token) {
    let url = this.server + '/api/v2.1/workflows/' + token + '/';
    return this.req.delete(url);
  }

  submitWorkflowTask(token, rowData, tableId, rowId, replace, link_rows, new_linked_rows) {
    let url = this.server + `/api/v2.1/workflows/${token}/task-submit/`;
    let form = new FormData();
    form.append('row_data', rowData);
    form.append('table_id', tableId);
    if (rowId) {
      form.append('row_id', rowId);
    }
    if (replace) {
      form.append('replace', 'true');
    }
    if (link_rows) {
      form.append('link_rows', link_rows);
    }
    if (new_linked_rows) {
      form.append('new_linked_rows', new_linked_rows);
    }
    return this._sendPostRequest(url, form);
  }

  transferWorkflowTask(token, taskId, rowData, nodeId, nextNodeId, link_rows, new_linked_rows) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/transfer/`;
    let form = new FormData();
    form.append('row_data', JSON.stringify(rowData));
    form.append('node_id', nodeId);
    if (nextNodeId) {
      form.append('next_node_id', nextNodeId);
    }
    if (link_rows) {
      form.append('link_rows', link_rows);
    }
    if (new_linked_rows) {
      form.append('new_linked_rows', new_linked_rows);
    }
    return this._sendPostRequest(url, form);
  }

  getLinkedTableRowsWithWorkflow(token, link_column_key, task_id) {
    let url = this.server + `/api/v2.1/workflows/${token}/linked-rows/`;
    let params = {
      link_column_key
    };
    if (task_id) {
      params.task_id = task_id;
    }
    return this.req.get(url, {
      params: params
    });
  }

  cancelWorkflowTask(token, taskId) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/cancel/`;
    return this.req.post(url);
  }

  resubmitWorkflowTask(token, taskId) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/resubmit/`;
    return this.req.post(url);
  }

  getWorkflowTaskAdminView(token, taskId) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/admin-view/`;
    return this.req.get(url);
  }

  getWorkflowTaskParticipantView(token, taskId) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/participant-view/`;
    return this.req.get(url);
  }

  getWorkflowTaskInitiatorView(token, taskId) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/initiator-view/`;
    return this.req.get(url);
  }

  getWorkflowTaskParticipants(token, taskId) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/participants/`;
    return this.req.get(url);
  }

  updateWorkflowTaskParticipants(token, taskId, participants) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/participants/`;
    let form = new FormData();
    form.append('participants', participants.join(','));
    return this.req.put(url, form);
  }

  listSubmittedWorkflowTasks(page = null, perPage = null) {
    let url = this.server + '/api/v2.1/workflows/submitted-tasks/';
    let params = {
      page: page || 1,
      per_page: perPage || 25
    };
    return this.req.get(url, {
      params: params
    });
  }

  getWorkflowOngoingTasksCount() {
    let url = this.server + '/api/v2.1/workflows/ongoing-tasks/count/';
    return this.req.get(url);
  }

  listWorkflowOngoingTasks(page = null, perPage = null) {
    let url = this.server + '/api/v2.1/workflows/ongoing-tasks/';
    let params = {
      page: page || 1,
      per_page: perPage || 25
    };
    return this.req.get(url, {
      params: params
    });
  }

  deleteWorkflowTask(token, taskId) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/`;
    return this.req.delete(url);
  }

  listWorkflowShares(token) {
    let url = this.server + `/api/v2.1/workflows/${token}/shares/`;
    return this.req.get(url);
  }

  shareWorkflow(token, groupIdList) {
    let url = this.server + `/api/v2.1/workflows/${token}/shares/`;
    let form = new FormData();
    for (let i = 0; i < groupIdList.length; i++) {
      form.append('group_id', groupIdList[i]);
    }
    return this._sendPostRequest(url, form);
  }

  deleteWorkflowShare(token, groupId) {
    let url = this.server + `/api/v2.1/workflows/${token}/shares/${groupId}/`;
    return this.req.delete(url);
  }

  listSharedWorkflows() {
    let url = this.server + '/api/v2.1/workflows/shared/';
    return this.req.get(url);
  }

  // workflow-folders module
  createWorkflowFolder(name, folder_type) {
    let url = this.server + '/api/v2.1/workflows/folders/';
    let form = new FormData();
    form.append('name', name);
    form.append('folder_type', folder_type);
    return this._sendPostRequest(url, form);
  }

  deleteWorkflowFolder(workflow_folder_id) {
    let url = this.server + '/api/v2.1/workflows/folders/' + workflow_folder_id + '/';
    return this.req.delete(url);
  }

  renameWorkflowFolder(name, workflow_folder_id) {
    let url = this.server + '/api/v2.1/workflows/folders/' + workflow_folder_id + '/';
    let form = new FormData();
    form.append('name', name);
    return this.req.put(url, form);
  }

  getWorkflowFolderContent(workflow_folder_id) {
    let url = this.server + '/api/v2.1/workflows/folders/' + workflow_folder_id + '/';
    return this.req.get(url);
  }

  moveWorkflowToFolder(token, move_from, move_to) {
    let url = this.server + `/api/v2.1/workflows/${token}/move-workflow-to-folder/`;
    let form = new FormData();
    form.append('move_from', move_from);
    form.append('move_to', move_to);
    return this._sendPostRequest(url, form);
  }

  getPublicUploadLinkViaWorkflowToken(token) {
    let url = this.server + '/api/v2.1/workflows/' + token + '/public-upload-link/';
    return this.req.get(url);
  }

  getUploadLinkViaWorkflowToken(token, uploadType, taskId = null) {
    let url = this.server + '/api/v2.1/workflows/' + token + '/upload-link/';
    const params = { upload_type: uploadType };
    if (taskId) {
      params.task_id = taskId;
    }
    return this.req.get(url, { params });
  }

  getWorkflowInitForm(token) {
    const url = this.server + '/api/v2.1/workflows/' + token + '/init-form/';
    return this.req.get(url);
  }

  listWorkflowTaskLogs(token, taskId, page, perPage) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/${taskId}/logs/`;
    let params = {};
    if (page) {
      params.page = page;
    }
    if (perPage) {
      params.per_page = perPage;
    }
    return this.req.get(url, {
      params
    });
  }

  listWorkflowTasksByType(token, filterType, page, perPage) {
    let url = this.server + `/api/v2.1/workflows/${token}/tasks/`;
    let params = {};
    if (filterType) {
      params.filter_type = filterType;
    }
    if (page) {
      params.page = page;
    }
    if (perPage) {
      params.per_page = perPage;
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

  listSmsMessageTemplates() {
    let url = this.server + '/api/v2.1/dtable-sms-message/templates/';
    return this.req.get(url);
  }

  sendSmsMessage(template_name, phone, msg_dict) {
    let url = this.server + '/api/v2.1/dtable-sms-message/send/';
    let data = {
      'template_name': template_name,
      'phone': phone,
      'msg_dict': msg_dict,
    };
    return this.req.post(url, data);
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

  listGroupTrashDTables(groupID) {
    let url = this.server + '/api/v2.1/groups/' + groupID + '/trash-dtables/';
    return this.req.get(url);
  }

  restoreGroupTrashDTable(dtableUuid, groupID) {
    let url = this.server + '/api/v2.1/groups/' + groupID + '/trash-dtables/' + dtableUuid + '/';
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

  getDTableAssetSize(dtableUuid) {
    let url = this.server + '/api/v2.1/dtable-asset/' + dtableUuid + '/asset-size/';
    return this.req.get(url);
  }

  listCommonDatasets(dstDTableUuid, byGroup = false) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/';
    let params = {};
    if (dstDTableUuid) {
      params.dst_dtable_uuid = dstDTableUuid;
    }
    params.by_group = byGroup;
    return this.req.get(url, {
      params: params
    });
  }

  getCommonDataset(datasetId, start, limit) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/' + datasetId + '/?';
    if (start || start === 0) {
      url += `start=${start}&`;
    }
    if (limit) {
      url += `limit=${limit}`;
    }
    return this.req.get(url);
  }

  getCommonDatasetInfo(datasetId) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/' + datasetId + '/info/';
    return this.req.get(url);
  }

  renameCommonDataset(datasetId, datasetName) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/' + datasetId + '/';
    let form = new FormData();
    form.append('dataset_name', datasetName);
    return this.req.put(url, form);
  }

  deleteCommonDataset(datasetId) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/' + datasetId + '/';
    return this.req.delete(url);
  }

  forceSyncCommonDataset(datasetId, dst_dtable_uuids = []) {
    const url = this.server + `/api/v2.1/dtable/common-datasets/${datasetId}/force-sync/`;
    const data = {
      dst_dtable_uuids: dst_dtable_uuids,
    };
    return this.req.post(url, data);
  }

  listCommonDatasetSyncs(dst_dtable_uuid) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/syncs/';
    url += '?dst_dtable_uuid=' + dst_dtable_uuid;
    return this.req.get(url);
  }

  listDatasetAccessibleGroups(datasetId) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/' + datasetId + '/access-groups/';
    return this.req.get(url);
  }

  addDatasetAccessibleGroup(datasetId, groupIdList) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/' + datasetId + '/access-groups/';
    let formData = new FormData();
    groupIdList.map(groupId => formData.append('group_id', groupId));
    return this._sendPostRequest(url, formData);
  }

  deleteDatasetAccessibleGroup(datasetId, groupId) {
    let url = this.server + '/api/v2.1/dtable/common-datasets/' + datasetId + '/access-groups/' + groupId + '/';
    return this.req.delete(url);
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

  listAddressBookV2DepartmentMemberDTables(departmentId, email) {
    const url = this.server + `/api/v2.1/address-book-v2/departments/${departmentId}/members/${email}/dtables/`;
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

  updateEmailNotificationInterval(dtableUpdatesEmailInterval, dtableCollaborateEmailInterval) {
    const url = this.server + '/api2/account/info/';
    const data = {
      'dtable_updates_email_interval': dtableUpdatesEmailInterval,
      'dtable_collaborate_email_interval': dtableCollaborateEmailInterval,
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

  listTemplates() {
    const url = '/api/v2.1/templates/';
    return this.req.get(url);
  }

  getBaseSharePermission(workspaceId, dtableName) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtableName) + '/base-share-permission/';
    return this.req.get(url);
  }

  getSharePermission(workspaceId, dtableName, permissionId) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtableName) + '/share-permissions/' + permissionId + '/';
    return this.req.get(url);
  }

  getSharePermissions(workspaceId, dtableName) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtableName) + '/share-permissions/';
    return this.req.get(url);
  }

  addSharePermission(workspaceId, dtableName, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtableName) + '/share-permissions/';
    return this.req.post(url, permission);
  }

  updateSharePermission(workspaceId, dtableName, permissionId, permission) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtableName) + '/share-permissions/' + permissionId + '/';
    return this.req.put(url, permission);
  }

  deleteSharePermission(workspaceId, dtableName, permissionId) {
    const url = this.server + '/api/v2.1/workspace/' + workspaceId + '/dtable/' + encodeURIComponent(dtableName) + '/share-permissions/' + permissionId + '/';
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

const dtableWebAPI = new DTableWebAPI();
const xcsrfHeaders = cookie.load('seaqa_csrftoken');
dtableWebAPI.initForDTableUsage({ siteRoot, xcsrfHeaders });

export { dtableWebAPI };

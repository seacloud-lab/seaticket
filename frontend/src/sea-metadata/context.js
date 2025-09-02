import LocalStorage from '@/utils/local-storage';
import eventBus from '@/utils/event-bus';
import Translate from './utils/translate';

class Context {

  constructor() {
    this.username = '';
    this.settings = {};
    this.api = null;
    this.localStorage = null;
    this.permission = 'r';
    this.isViewComputedOnServer = true;
    this.collaboratorsCache = {};
    this.translate = (key) => key;
    this.eventBus = eventBus;
  }

  init = ({
    username = '',
    settings = {},
    permission = 'r',
    api,
    localStorageName,
    isViewComputedOnServer = true,
    t,
  }) => {
    this.username = username;
    this.settings = settings;
    this.api = api;
    this.permission = permission;
    this.isViewComputedOnServer = isViewComputedOnServer;
    this.collaboratorsCache = {};
    const translate = new Translate(t);
    this.translate = translate.translate;

    this.re_set({ localStorageName });
  };

  re_set = ({ localStorageName, t }) => {
    if (localStorageName) {
      this.localStorage = new LocalStorage(localStorageName);
    }
    if (t) {
      const translate = new Translate(t);
      this.translate = translate.translate;
    }
  };

  destroy = () => {
    console.log('de');
    this.username = '';
    this.settings = {};
    this.api = null;
    this.localStorage = null;
    this.eventBus = null;
    this.permission = 'r';
    this.translate = (key) => key;
  };

  getSetting = (key) => {
    if (this.settings[key] === false) return this.settings[key];
    return this.settings[key] || '';
  };

  setSetting = (key, value) => {
    this.settings[key] = value;
  };

  getUsername = () => {
    return this.username;
  };

  // metadata
  getMetadata = (params) => {
    if (!this.api) return null;
    return this.api.getMetadata(params);
  };

  // view
  getViews = () => {
    return this.api.getViews();
  };

  getView = (viewId) => {
    return this.api.getView(viewId);
  };

  getPermission = () => {
    return this.permission;
  };

  canModify = () => {
    if (this.permission === 'r') return false;
    return true;
  };

  canModifyCell = (column, row) => {
    if (!this.canModify()) return false;
    if (!this.api?.modifyRow) return false;
    return Boolean(column?.editable);
  };

  canInsertRow = (row) => {
    if (!this.canModify()) return false;
    if (!this.api?.insertRow) return false;
    return true;
  };

  canModifyRow = (row) => {
    if (!this.canModify()) return false;
    if (!this.api?.modifyRow) return false;
    return true;
  };

  canDeleteRow = () => {
    if (!this.canModify()) return false;
    if (!this.api?.deleteRows && !this.api?.deleteRow) return false;
    return true;
  };

  canModifyRows = () => {
    if (!this.canModify()) return false;
    if (!this.api?.modifyRows && !this.api?.modifyRow) return false;
    return true;
  };

  canDuplicateRow = () => {
    if (!this.canModify()) return false;
    if (!this.api?.insertRow) return false;
    return true;
  };

  canInsertColumn = () => {
    if (!this.canModify()) return false;
    if (!this.api?.insertColumn) return false;
    return true;
  };

  canModifyColumn = (column) => {
    if (!this.canModify()) return false;
    if (!this.api?.modifyColumn) return false;
    return Boolean(column?.editable);
  };

  canRenameColumn = (column) => {
    if (!this.canModify()) return false;
    if (!this.api?.renameColumn) return false;
    return Boolean(column?.rename_able);
  };

  canModifyColumnData = (column) => {
    if (!this.canModify()) return false;
    // if (!this.api?.modifyColumnData) return false;
    return Boolean(column?.modify_data_able);
  };

  canDeleteColumn = (column) => {
    if (!this.canModify()) return false;
    if (!this.api?.deleteColumn) return false;
    return Boolean(column?.delete_able);
  };

  canModifyColumnOrder = () => {
    if (!this.canModify()) return false;
    return Boolean(this.api?.modifyView);
  };

  canInsertView = () => {
    if (!this.canModify()) return false;
    return Boolean(this.api?.insertView);
  };

  canDeleteView = (view) => {
    if (!this.canModify()) return false;
    return Boolean(this.api?.deleteView);
  };

  canModifyView = (view) => {
    if (!this.canModify()) return false;
    return Boolean(this.api?.modifyView);
  };

  canMoveView = () => {
    if (!this.canModify()) return false;
    return Boolean(this.api?.moveView);
  };

  canDuplicateView = () => {
    if (!this.canModify()) return false;
    return Boolean(this.api?.duplicateView);
  };

  canPreview = () => {
    return true;
  };

  canUploadFile = () => {
    if (!this.canModify()) return false;
    return Boolean(this.api?.uploadFile);
  };

  restoreRows = () => {
    // todo
  };

  updateRows = () => {
    // todo
  };

  lockRowViaButton = () => {
    // todo
  };

  updateRowViaButton = () => {
    // todo
  };

  // column
  insertColumn = (name, type, { key, data }) => {
    return this.api.insertColumn(name, type, { key, data });
  };

  deleteColumn = (columnKey) => {
    return this.api.deleteColumn(columnKey);
  };

  renameColumn = (columnKey, name) => {
    return this.api.renameColumn(columnKey, name);
  };

  modifyColumnData = (columnKey, data) => {
    return this.api.modifyColumnData(columnKey, data);
  };

  // row
  insertRow = (data) => {
    return this.api.insertRow(data);
  };

  modifyRow = (rowId, update) => {
    return this.api.modifyRow(rowId, update);
  };

  modifyRows = (rowsData, isCopyPaste) => {
    if (this.api.modifyRows) return this.api.modifyRows(rowsData, isCopyPaste);
    let modifyRows = [];
    rowsData.forEach(rowData => {
      const { row_id, row } = rowData;
      modifyRows.push(this.modifyRow(row_id, row));
    });
    return Promise.all(modifyRows);
  };

  deleteRow = (rowId) => {
    return this.api.deleteRow(rowId);
  };

  deleteRows = (rowIds = []) => {
    if (this.api.deleteRows) return this.api.deleteRows(rowIds);
    let deletedRows = [];
    rowIds.forEach(rowId => {
      deletedRows.push(this.deleteRow(rowId));
    });
    return Promise.all(deletedRows);
  };

  // view
  insertView = (name, viewData) => {
    return this.api.insertView(name, viewData);
  };

  deleteView = (viewID) => {
    return this.api.deleteView(viewID);
  };

  modifyView = (viewId, viewData) => {
    return this.api.modifyView(viewId, viewData);
  };

  moveView = (sourceViewID, targetViewID) => {
    return this.api.moveView(sourceViewID, targetViewID);
  };

  duplicateView = (viewID) => {
    return this.api.duplicateView(viewID);
  };

  getRowsByIds = () => {
    // todo
  };

  // upload file
  uploadFile = (file, ...params) => {
    return this.api.uploadFile(file, ...params);
  };

}

const context = new Context();

export default context;

import { EventBus } from '@/utils/event-bus';
import LocalStorage from '@/utils/local-storage';
import { isFunction } from '@/utils/type-detection';
import { CellType } from './constants';
import Translate from './utils/translate';

const SETTINGS = {
  stateColumnKey: 'state',
  typeColumnKey: 'type',
  tagsColumnKey: 'tags',
  enableExportAndImportXlsx: false,
  isFilterComputedOnServer: true,
  isSortComputedOnServer: true,
  canManageView: true,
  canClearCells: true,
  canPasteCells: true,
  canDragFillCells: true,
};

const isVisibleElement = (element) => {
  for (let node = element; node; node = node.parentElement) {
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
};

export class Context {

  constructor(eventBus = new EventBus()) {
    this.listeners = new Set();
    this.version = 0;
    this.overrides = {};
    this.body = null;
    this.root = null;
    this.username = '';
    this.settings = { ...SETTINGS };
    this.api = null;
    this.localStorage = null;
    this.permission = 'r';
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
    t,
  }, callback) => {
    this.configure({ username, settings, permission, api, t });
    this.re_set({ localStorageName });
    callback && callback();
  };

  re_set = ({ localStorageName, legacyLocalStorageName, t, api }) => {
    if (localStorageName) {
      this.localStorage = new LocalStorage(localStorageName);
      if (legacyLocalStorageName) {
        const storage = this.localStorage;
        const read = storage.getStorage.bind(storage);
        storage.getStorage = () => {
          if (window.localStorage.getItem(localStorageName) !== null) return read();
          return new LocalStorage(legacyLocalStorageName).getStorage();
        };
      }
    }
    if (t) {
      const translate = new Translate(t);
      this.translate = translate.translate;
    }
    if (api) {
      this.api = api;
    }
  };

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  configure = ({ username = '', settings = {}, permission = 'r', api, t }) => {
    this.username = username;
    this.settings = { ...SETTINGS, ...settings, ...this.overrides };
    this.api = api;
    this.permission = permission;
    this.translate = new Translate(t).translate;
    this.version += 1;
    this.listeners.forEach(listener => listener());
  };

  ownsEvent = (event, { allowOutside = false } = {}) => {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const owner = target?.closest('[data-sea-metadata-instance]');
    return Boolean(this.root && target && (owner ? owner.getAttribute('data-sea-metadata-instance') === this.id : allowOutside));
  };

  ownsSearchShortcut = (event) => {
    if (this.ownsEvent(event)) return true;
    const root = this.root;
    if (!root?.isConnected || root.getAttribute('data-sea-metadata-primary') !== 'true') return false;
    const doc = root.ownerDocument;
    const isPage = node => node === doc.body || node === doc.documentElement;
    if (!isPage(event.target) || !isPage(doc.activeElement)) return false;
    const dialogSelector = '[role="dialog"], [aria-modal="true"], .modal';
    if (Array.from(doc.querySelectorAll(dialogSelector)).some(isVisibleElement)) return false;
    const primaryTables = Array.from(doc.querySelectorAll('[data-sea-metadata-primary="true"]')).filter(node => !node.closest(dialogSelector) && isVisibleElement(node));
    // Ambiguous pages must receive focus before a table can own a shortcut.
    return primaryTables.length === 1 && primaryTables[0] === root;
  };

  storageName = (prefix, viewID) => {
    return `${prefix || 'sea-metadata'}-${this.storageNamespace}-${viewID}`;
  };

  destroy = () => {
    this.api = null;
    this.localStorage = null;
    this.body = null;
    this.root = null;
    this.collaboratorsCache = {};
    this.overrides = {};
    this.listeners.clear();
    this.eventBus.destroy();
  };

  getSetting = (key, defaultValue = '') => {
    return this.settings[key] ?? defaultValue;
  };

  setSetting = (key, value) => {
    this.overrides[key] = value;
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.version += 1;
    this.listeners.forEach(listener => listener());
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
    if (!this.api?.deleteRow) return false;
    return true;
  };

  canDeleteRows = () => {
    if (!this.canModify()) return false;
    if (!this.api?.deleteRows) return false;
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
    if (column?.name === 'substate') return Boolean(column?.modify_data_able);
    if (column.type === CellType.TAGS || column.type === CellType.TYPE) return Boolean(column?.modify_data_able);
    if (!this.api?.modifyColumnData) return false;
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
  getColumns = () => {
    if (isFunction(this.api.getColumns)) return this.api.getColumns();
    return new Promise((resolve, reject) => {
      resolve({
        data: { columns: [] }
      });
    });
  };

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

  modifyRow = (...params) => {
    return this.api.modifyRow(...params);
  };

  modifyRows = (rowsData, ...params) => {
    if (this.api.modifyRows) return this.api.modifyRows(rowsData, ...params);
    let modifyRows = [];
    rowsData.forEach(rowData => {
      const { row_id, row } = rowData;
      modifyRows.push(this.modifyRow(row_id, row, ...params));
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

export const createMetadataContext = (eventBus) => new Context(eventBus);

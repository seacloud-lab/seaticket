import deepCopy from 'deep-copy';
import { getRowById, getRowsByIds } from '../utils/row';
import { getColumnByKey, normalizeColumns } from '../utils/column';
import {
  Operation, LOCAL_APPLY_OPERATION_TYPE, NEED_APPLY_AFTER_SERVER_OPERATION, OPERATION_TYPE,
  UNDO_OPERATION_TYPE, RE_SEARCH_ROWS_OPERATION, NEED_LOADING_OPERATION,
} from './operations';
import { EVENT_BUS_TYPE, PER_LOAD_NUMBER } from '../constants';
import DataProcessor from './data-processor';
import ServerOperator from './server-operator';
import LocalOperator from './local-operator';
import { Metadata } from '../models';
import context from '../context';

class Store {

  constructor(props) {
    this.viewId = props.viewId;
    this.data = null;
    this.startIndex = 0;
    this.redos = [];
    this.undo = [];
    this.pendingOperations = [];
    this.isSendingOperation = false;
    this.isReadonly = false;
    this.serverOperator = new ServerOperator();
    this.localOperator = new LocalOperator();
    this.collaborators = props.collaborators || [];
    this.tagsData = props?.tagsData || {};
    this.typesData = props?.typesData || {};
    this.mounted = true;
  }

  destroy = () => {
    this.viewId = '';
    this.data = null;
    this.startIndex = 0;
    this.redos = [];
    this.undo = [];
    this.pendingOperations = [];
    this.isSendingOperation = false;
    this.tagsData = {};
    this.typesData = {};
    this.mounted = false;
  };

  initStartIndex = () => {
    this.startIndex = 0;
  };

  async loadMetadata(view, limit) {
    if (!view) {
      throw Error('View_not_exist');
    }
    return context.getMetadata({ view_id: view._id, start: this.startIndex, limit })?.then(res => {
      if (!this.mounted) return;
      const rows = res?.data?.rows || [];
      const columns = normalizeColumns(res?.data?.columns || []);
      let data = new Metadata({ rows, columns, view });
      data.view.rows = data.row_ids;
      const loadedCount = rows.length;
      data.hasMore = loadedCount >= limit;
      this.data = data;
      this.startIndex += loadedCount;
      DataProcessor.run(this.data, {
        collaborators: this.collaborators,
        typesData: this.typesData,
      });
    });
  }

  async load(limit = PER_LOAD_NUMBER) {
    return context.getView(this.viewId).then(res => {
      const view = res?.data?.view;
      return this.loadMetadata(view, limit);
    });
  }

  async reload(limit = PER_LOAD_NUMBER) {
    this.startIndex = 0;
    return this.loadMetadata(this.data.view, limit);
  }

  async loadMore(limit) {
    if (!this.data) return;
    const res = await context.getMetadata({ view_id: this.viewId, start: this.startIndex, limit });
    const rows = res?.data?.rows || [];
    if (!Array.isArray(rows) || rows.length === 0) {
      this.hasMore = false;
      return;
    }

    this.data.rows.push(...rows);
    rows.forEach(row => {
      this.data.row_ids.push(row._id);
      this.data.id_row_map[row._id] = row;
    });
    const loadedCount = rows.length;
    this.data.hasMore = loadedCount === limit;
    this.data.rowsCount = this.data.row_ids.length;
    this.startIndex = this.startIndex + loadedCount;
    DataProcessor.run(this.data, { collaborators: this.collaborators, typesData: this.typesData, });
    context.eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_DATA_CHANGED);
    context.eventBus.dispatch(EVENT_BUS_TYPE.RE_SEARCH_ROWS);
  }

  async updateRowData(newRowId) {
    const res = await context.getRowsByIds(this.repoId, [newRowId]);
    if (!res || !res.data) {
      return;
    }
    const newRow = res.data.results[0];
    const rowIndex = this.data.rows.findIndex(row => row._id === newRowId);
    this.data.id_row_map[newRowId] = newRow;
    this.data.rows[rowIndex] = newRow;
    DataProcessor.run(this.data, { collaborators: this.collaborators, typesData: this.typesData, });
  }

  createOperation(op) {
    return new Operation(op);
  }

  applyOperation(operation, undoRedoHandler = { handleUndo: true }) {
    const { op_type } = operation;

    if (NEED_LOADING_OPERATION.includes(op_type)) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.LOADING, true);
    }

    if (!NEED_APPLY_AFTER_SERVER_OPERATION.includes(op_type)) {
      this.handleUndoRedos(undoRedoHandler, operation);
      this.data = deepCopy(operation.apply(this.data));
      this.syncOperationOnData(operation);
      context.eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_DATA_CHANGED);
    }

    if (LOCAL_APPLY_OPERATION_TYPE.includes(op_type)) {
      this.localOperator.applyOperation(operation);
    } else {
      this.addPendingOperations(operation, undoRedoHandler);
    }

    if (op_type === OPERATION_TYPE.MODIFY_FILTERS) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.CLEAR_SEARCH_ROWS);
    } else if (RE_SEARCH_ROWS_OPERATION.includes(op_type)) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.RE_SEARCH_ROWS);
    }
  }

  addPendingOperations(operation, undoRedoHandler) {
    this.pendingOperations.push(operation);
    this.startSendOperation(undoRedoHandler);
  }

  startSendOperation(undoRedoHandler) {
    if (this.isSendingOperation || this.pendingOperations.length === 0) {
      return;
    }
    this.isSendingOperation = true;
    context.eventBus.dispatch(EVENT_BUS_TYPE.SAVING);
    this.sendNextOperation(undoRedoHandler);
  }

  sendNextOperation(undoRedoHandler) {
    if (this.pendingOperations.length === 0) {
      this.isSendingOperation = false;
      context.eventBus.dispatch(EVENT_BUS_TYPE.SAVED);
      return;
    }
    const operation = this.pendingOperations.shift();
    this.serverOperator.applyOperation(operation, this.data, this.sendOperationCallback.bind(this, undoRedoHandler));
  }

  sendOperationCallback = (undoRedoHandler, { operation, error }) => {
    if (error) {
      if (operation && operation.fail_callback) {
        operation.fail_callback(error);
      } else {
        context.eventBus.dispatch(EVENT_BUS_TYPE.TABLE_ERROR, { error });
      }
      this.sendNextOperation(undoRedoHandler);
      return;
    }

    const isAfterServerOperation = NEED_APPLY_AFTER_SERVER_OPERATION.includes(operation.op_type);
    if (isAfterServerOperation) {
      this.handleUndoRedos(undoRedoHandler, operation);
      this.data = deepCopy(operation.apply(this.data));
      this.syncOperationOnData(operation);
    }

    if (isAfterServerOperation) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.SERVER_DATA_CHANGED);
    }
    operation.success_callback && operation.success_callback(operation);

    // need reload rows if has related formula columns
    this.serverOperator.handleReloadRows(this.data, operation, ({ reloadedRows, idRowNotExistMap, relatedColumnKeyMap }) => {
      if (reloadedRows.length > 0) {
        DataProcessor.handleReloadedRows(this.data, reloadedRows, relatedColumnKeyMap);
      }
      if (Object.keys(idRowNotExistMap).length > 0) {
        DataProcessor.handleNotExistRows(this.data, idRowNotExistMap);
      }
      context.eventBus.dispatch(EVENT_BUS_TYPE.SERVER_DATA_CHANGED);
    });

    this.sendNextOperation(undoRedoHandler);
  };

  syncOperationOnData(operation) {
    DataProcessor.syncOperationOnData(this.data, operation, {
      collaborators: this.collaborators,
      tagsData: this.tagsData,
      typesData: this.typesData,
    });
  }

  // redo/undo
  handleUndoRedos(undoRedoHandler, operation) {
    const { handleUndo, asyncUndoRedo } = undoRedoHandler;
    if (handleUndo) {
      if (this.redos.length > 0) {
        this.redos = [];
      }
      if (this.undo.length > 10) {
        this.undo = this.undo.slice(-10);
      }
      if (UNDO_OPERATION_TYPE.includes(operation.op_type)) {
        this.undo.push(operation);
      }
    }
    asyncUndoRedo && asyncUndoRedo(operation);
  }

  undoOperation() {
    if (this.isReadonly || this.undo.length === 0) return;
    const lastOperation = this.undo.pop();
    const lastInvertOperation = lastOperation.invert();
    this.applyOperation(lastInvertOperation, { handleUndo: false, asyncUndoRedo: (operation) => {
      this.redos.push(lastOperation);
    } });
  }

  redoOperation() {
    if (this.isReadonly || this.redos.length === 0) return;
    let lastOperation = this.redos.pop();
    this.applyOperation(lastOperation, { handleUndo: false, asyncUndoRedo: (operation) => {
      this.undo.push(lastOperation);
    } });
  }

  // row
  insertRow(rowData, { success_callback, fail_callback } = {}) {
    const type = OPERATION_TYPE.INSERT_ROW;
    const operation = this.createOperation({
      type,
      row_data: rowData,
      fail_callback,
      success_callback,
    });
    this.applyOperation(operation);
  }

  modifyRow(row_id, row_update, old_row_data, original_update, original_old_row_data, is_copy_paste, { success_callback, fail_callback } = {}) {
    const type = OPERATION_TYPE.MODIFY_ROW;
    const operation = this.createOperation({
      type,
      row_id: row_id,
      row_update: row_update,
      original_update: original_update,
      old_row_data: old_row_data,
      original_old_row_data: original_old_row_data,
      is_copy_paste,
      fail_callback,
      success_callback,
    });
    this.applyOperation(operation);
  }

  modifyRows(row_ids, id_row_updates, id_original_row_updates, id_old_row_data, id_original_old_row_data, is_copy_paste, { fail_callback, success_callback } = {}) {
    const originalRows = getRowsByIds(this.data, row_ids);
    let valid_row_ids = [];
    let valid_id_row_updates = {};
    let valid_id_original_row_updates = {};
    let valid_id_old_row_data = {};
    let valid_id_original_old_row_data = {};
    originalRows.forEach(row => {
      if (row && context.canModifyRow(row)) {
        const rowId = row._id;
        valid_row_ids.push(rowId);
        valid_id_row_updates[rowId] = id_row_updates[rowId];
        valid_id_original_row_updates[rowId] = id_original_row_updates[rowId];
        valid_id_old_row_data[rowId] = id_old_row_data[rowId];
        valid_id_original_old_row_data[rowId] = id_original_old_row_data[rowId];
      }
    });

    const type = OPERATION_TYPE.MODIFY_ROWS;
    const operation = this.createOperation({
      type,
      row_ids: valid_row_ids,
      id_row_updates: valid_id_row_updates,
      id_original_row_updates: valid_id_original_row_updates,
      id_old_row_data: valid_id_old_row_data,
      id_original_old_row_data: valid_id_original_old_row_data,
      is_copy_paste,
      fail_callback,
      success_callback,
    });
    this.applyOperation(operation);
  }

  deleteRow(row_id, { fail_callback, success_callback }) {
    if (!row_id) return;
    const row = getRowById(this.data, row_id);
    if (!row) return;
    if (!context.canDeleteRow(row)) return;
    const type = OPERATION_TYPE.DELETE_ROW;
    const operation = this.createOperation({
      type,
      row_id: row_id,
      row_data: row,
      fail_callback,
      success_callback,
    });
    this.applyOperation(operation);
  }

  deleteRows(rows_ids, { fail_callback, success_callback }) {
    if (!Array.isArray(rows_ids) || rows_ids.length === 0) return;
    const type = OPERATION_TYPE.DELETE_ROWS;

    const valid_rows_ids = rows_ids.filter((rowId) => {
      const row = getRowById(this.data, rowId);
      return row && context.canDeleteRow(row);
    });

    if (valid_rows_ids.length === 0) return;
    const deleted_rows = valid_rows_ids.map((rowId) => getRowById(this.data, rowId));
    const operation = this.createOperation({
      type,
      rows_ids: valid_rows_ids,
      deleted_rows,
      fail_callback,
      success_callback,
    });
    this.applyOperation(operation);
  }

  reloadRows(row_ids) {
    const type = OPERATION_TYPE.RELOAD_ROWS;
    const operation = this.createOperation({
      type,
      row_ids,
    });
    this.applyOperation(operation);
  }

  lockRowViaButton(row_id, button_column_key, { success_callback, fail_callback }) {
    const type = OPERATION_TYPE.LOCK_ROW_VIA_BUTTON;
    const operation = this.createOperation({
      type,
      row_id,
      button_column_key,
      success_callback,
      fail_callback,
    });
    this.applyOperation(operation);
  }

  /**
   * @param {String} row_id target row id
   * @param {Object} updates { [column.name]: cell_value }
   * @param {Object} original_updates { [column.key]: cell_value }
   * @param {Object} old_row_data { [column.name]: cell_value }
   * @param {Object} original_old_row_data { [column.key]: cell_value }
   * @param {String} button_column_key button column key
   */
  modifyRowViaButton(row_id, updates, old_row_data, original_updates, original_old_row_data, button_column_key, { success_callback, fail_callback }) {
    const row = getRowById(this.data, row_id);
    if (!row) {
      return;
    }
    const type = OPERATION_TYPE.MODIFY_ROW_VIA_BUTTON;
    const operation = this.createOperation({
      type,
      row_id,
      updates,
      old_row_data,
      original_updates,
      original_old_row_data,
      button_column_key,
      success_callback,
      fail_callback,
    });
    this.applyOperation(operation);
  }

  modifyLocalRow({ parent_dir, file_name, row_id }, updates) {
    const type = OPERATION_TYPE.MODIFY_LOCAL_ROW;
    const operation = this.createOperation({
      type,
      row_id: row_id,
      parent_dir,
      file_name,
      updates
    });
    this.applyOperation(operation);
  }

  // view
  modifyFilters(filterConjunction, filters, basicFilters = []) {
    const type = OPERATION_TYPE.MODIFY_FILTERS;
    const operation = this.createOperation({
      type,
      filter_conjunction: filterConjunction,
      filters,
      basic_filters: basicFilters,
      view_id: this.viewId,
      success_callback: () => {
        context.eventBus.dispatch(EVENT_BUS_TYPE.RELOAD_DATA);
      }
    });
    this.applyOperation(operation);
  }

  modifySorts(sorts, displaySorts = false) {
    const type = OPERATION_TYPE.MODIFY_SORTS;
    const operation = this.createOperation({
      type,
      sorts,
      view_id: this.viewId,
      success_callback: () => {
        context.eventBus.dispatch(EVENT_BUS_TYPE.RELOAD_DATA);
        displaySorts && context.eventBus.dispatch(EVENT_BUS_TYPE.DISPLAY_SORTS);
      }
    });
    this.applyOperation(operation);
  }

  modifyLocalView(update) {
    const type = OPERATION_TYPE.MODIFY_LOCAL_VIEW;
    const operation = this.createOperation({
      type,
      update,
      view_id: this.viewId,
    });
    this.applyOperation(operation);
  }

  modifyGroupbys(groupbys) {
    const type = OPERATION_TYPE.MODIFY_GROUPBYS;
    const operation = this.createOperation({
      type, groupbys, view_id: this.viewId
    });
    this.applyOperation(operation);
  }

  modifyRowHeight(row_height) {
    const type = OPERATION_TYPE.MODIFY_ROW_HEIGHT;
    const operation = this.createOperation({
      type, row_height, view_id: this.viewId,
    });
    this.applyOperation(operation);
  }

  modifyHiddenColumns(hidden_columns) {
    const type = OPERATION_TYPE.MODIFY_HIDDEN_COLUMNS;
    const operation = this.createOperation({
      type,
      hidden_columns,
      view_id: this.viewId,
    });
    this.applyOperation(operation);
  }

  modifySettings = (settings) => {
    const type = OPERATION_TYPE.MODIFY_SETTINGS;
    const operation = this.createOperation({
      type, view_id: this.viewId, settings
    });
    this.applyOperation(operation);
  };

  modifyViewType(viewId, update) {
    const type = OPERATION_TYPE.MODIFY_VIEW_TYPE;
    const operation = this.createOperation({
      type, view_id: viewId, update
    });
    this.applyOperation(operation);
  }

  // column
  insertColumn = (name, columnType, { key, data }) => {
    const operationType = OPERATION_TYPE.INSERT_COLUMN;
    const operation = this.createOperation({
      type: operationType, name, column_type: columnType, column_key: key, data
    });
    this.applyOperation(operation);
  };

  deleteColumn = (columnKey, column) => {
    const type = OPERATION_TYPE.DELETE_COLUMN;
    const operation = this.createOperation({
      type, column_key: columnKey, column,
    });
    this.applyOperation(operation);
  };

  renameColumn = (columnKey, newName, oldName) => {
    const type = OPERATION_TYPE.RENAME_COLUMN;
    const operation = this.createOperation({
      type, column_key: columnKey, new_name: newName, old_name: oldName
    });
    this.applyOperation(operation);
  };

  modifyColumnData = (columnKey, newData, oldData, { optionModifyType } = {}) => {
    const type = OPERATION_TYPE.MODIFY_COLUMN_DATA;
    const operation = this.createOperation({
      type, column_key: columnKey, new_data: newData, old_data: oldData, option_modify_type: optionModifyType
    });
    this.applyOperation(operation);
  };

  modifyColumnWidth = (columnKey, newWidth) => {
    const type = OPERATION_TYPE.MODIFY_COLUMN_WIDTH;
    const column = getColumnByKey(this.data.columns, columnKey);
    const operation = this.createOperation({
      type, column_key: columnKey, new_width: newWidth, old_width: column.width
    });
    this.applyOperation(operation);
  };

  modifyColumnOrder = (sourceColumnKey, targetColumnKey) => {
    const type = OPERATION_TYPE.MODIFY_COLUMN_ORDER;
    const { columns_keys } = this.data.view;
    const targetColumnIndex = columns_keys.indexOf(targetColumnKey);
    let newColumnsKeys = columns_keys.slice(0);
    newColumnsKeys = newColumnsKeys.filter(key => key !== sourceColumnKey);
    newColumnsKeys.splice(targetColumnIndex, 0, sourceColumnKey);
    const operation = this.createOperation({
      type, view_id: this.viewId, new_columns_keys: newColumnsKeys, old_columns_keys: columns_keys
    });
    this.applyOperation(operation);
  };

  modifyLocalColumnData(column_key, new_data, old_data) {
    const type = OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA;
    const operation = this.createOperation({
      type,
      column_key,
      new_data,
      old_data,
    });
    this.applyOperation(operation);
  }

  searchRows(value) {
    const type = OPERATION_TYPE.SEARCH_ROWS;
    const operation = this.createOperation({
      type,
      value,
    });
    this.applyOperation(operation);
  }

}

export default Store;

import { gettext } from '@/constants';
import ObjectUtils from '@/utils/object-utils';
import { OPERATION_TYPE } from './operations';
import { getColumnByKey, getServerOptions } from '../utils/column';
import { CellType } from '../constants';
import context from '../context';
import { Utils } from '@/utils/utils';

const MAX_LOAD_ROWS = 100;

class ServerOperator {

  applyOperation(operation, data, callback) {
    const { op_type } = operation;

    switch (op_type) {
      case OPERATION_TYPE.INSERT_ROW: {
        const { row_data } = operation;
        context.insertRow(row_data).then(row => {
          operation.row = row;
          callback({ operation });
        }).catch(error => {
          const errorMessage = Utils.getErrorMsg(error);
          callback({ operation, error: errorMessage });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_ROW: {
        const { row_id, row_update, is_copy_paste } = operation;
        context.modifyRow(row_id, row_update, is_copy_paste).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify row') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_ROWS: {
        const { row_ids, id_row_updates, is_copy_paste } = operation;
        const rowsData = row_ids.map(rowId => {
          return { row_id: rowId, row: id_row_updates[rowId] };
        }).filter(rowData => rowData.row && !ObjectUtils.isEmpty(rowData.row));
        if (rowsData.length === 0) {
          callback({ operation });
        } else {
          context.modifyRows(rowsData, is_copy_paste).then(res => {
            callback({ operation });
          }).catch(error => {
            if (error.response && error.response.status === 413) {
              callback({ operation, error: gettext('Number of rows exceeds the limit of 1000') });
            } else {
              callback({ operation, error: gettext('Failed to modify rows') });
            }
          });
        }
        break;
      }
      case OPERATION_TYPE.DELETE_ROW: {
        const { row_id } = operation;
        context.deleteRow(row_id).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to delete row') });
        });
        break;
      }
      case OPERATION_TYPE.DELETE_ROWS: {
        const { deleted_rows } = operation;
        const rowIds = deleted_rows.map((row) => row._id).filter(Boolean);
        context.deleteRows(rowIds).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to delete rows') });
        });
        break;
      }
      case OPERATION_TYPE.RESTORE_ROWS: {
        const { rows_data } = operation;
        if (!Array.isArray(rows_data) || rows_data.length === 0) {
          callback({ operation, error: gettext('Failed to restore rows') });
          break;
        }
        context.restoreRows(rows_data).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to restore rows') });
        });
        break;
      }
      case OPERATION_TYPE.RELOAD_ROWS: {
        callback({ operation });
        break;
      }
      case OPERATION_TYPE.INSERT_COLUMN: {
        const { name, column_type, column_key, data } = operation;
        context.insertColumn(name, column_type, { key: column_key, data }).then(res => {
          operation.column = res.data.column;
          operation.column_key = operation.column.key;
          operation.data = operation.column.data;
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to insert column') });
        });
        break;
      }
      case OPERATION_TYPE.DELETE_COLUMN: {
        const { column_key } = operation;
        context.deleteColumn(column_key).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to delete column') });
        });
        break;
      }
      case OPERATION_TYPE.RENAME_COLUMN: {
        const { column_key, new_name } = operation;
        context.renameColumn(column_key, new_name).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to rename column') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_COLUMN_DATA: {
        const { column_key, new_data } = operation;
        const column = getColumnByKey(data.columns, column_key);
        let origin_data = new_data;

        if (column.type === CellType.SINGLE_SELECT) {
          origin_data.options = getServerOptions({ key: column_key, data: origin_data });
        }
        context.modifyColumnData(column_key, origin_data).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify {column} data') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_COLUMN_ORDER: {
        const { view_id, new_columns_keys } = operation;
        context.modifyView(view_id, { columns_keys: new_columns_keys }).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify {column} order') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_FILTERS: {
        const { view_id, filter_conjunction, filters, basic_filters } = operation;
        context.modifyView(view_id, { filters, filter_conjunction, basic_filters }).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify filter') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_SORTS: {
        const { view_id, sorts } = operation;
        context.modifyView(view_id, { sorts }).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify sort') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_GROUPBYS: {
        const { view_id, groupbys } = operation;
        context.modifyView(view_id, { groupbys }).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify group') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_HIDDEN_COLUMNS: {
        const { view_id, hidden_columns } = operation;
        context.modifyView(view_id, { hidden_columns }).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify hidden columns') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_SETTINGS: {
        const { view_id, settings } = operation;
        context.modifyView(view_id, { settings }).then(res => {
          callback({ operation });
        }).catch(error => {
          callback({ operation, error: gettext('Failed to modify settings') });
        });
        break;
      }
      case OPERATION_TYPE.MODIFY_VIEW_TYPE: {
        callback({ operation });
        break;
      }

      default: {
        break;
      }
    }
  }

  checkReloadRowsOperation = (operation) => {
    const { op_type } = operation;
    switch (op_type) {
      case OPERATION_TYPE.RELOAD_ROWS: {
        return true;
      }
      default: {
        return false;
      }
    }
  };

  handleReloadRows(table, operation, callback) {
    const { relatedColumnKeyMap } = this.getOperationRelatedColumns(table, operation);
    const isReloadRowsOp = this.checkReloadRowsOperation(operation);
    if (!isReloadRowsOp) return;

    const rowsIds = this.getOperatedRowsIds(operation);
    this.asyncReloadRows(rowsIds, relatedColumnKeyMap, callback);
  }

  asyncReloadRows(rowsIds, relatedColumnKeyMap, callback) {
    if (!Array.isArray(rowsIds) || rowsIds.length === 0) return;
    const restRowsIds = [...rowsIds];
    const currentRowsIds = restRowsIds.splice(0, MAX_LOAD_ROWS);

    context.getRowsByIds(currentRowsIds).then(res => {
      if (!res || !res.data || !res.data.results) {
        this.asyncReloadRows(restRowsIds, relatedColumnKeyMap, callback);
        return;
      }
      const fetchedRows = res.data.results;
      let reloadedRows = [];
      let idRowLoadedMap = {};
      let idRowNotExistMap = {};
      if (fetchedRows.length > 0) {
        fetchedRows.forEach((row) => {
          reloadedRows.push(row);
          idRowLoadedMap[row._id] = true;
        });
      }
      currentRowsIds.forEach((rowId) => {
        if (!idRowLoadedMap[rowId]) {
          idRowNotExistMap[rowId] = true;
        }
      });
      callback({
        reloadedRows,
        idRowNotExistMap,
        relatedColumnKeyMap,
      });
      this.asyncReloadRows(restRowsIds, relatedColumnKeyMap, callback);
    }).catch (error => {
      // for debug
      // eslint-disable-next-line no-console
      console.log(error);
      this.asyncReloadRows(restRowsIds, relatedColumnKeyMap, callback);
    });
  }

  getOperationRelatedColumns(table, operation) {
    const { op_type } = operation;
    let relatedColumnKeys;
    switch (op_type) {
      case OPERATION_TYPE.MODIFY_ROWS: {
        const { id_original_row_updates } = operation;
        relatedColumnKeys = this.getRelatedColumnKeysFromRowUpdates(id_original_row_updates);
        break;
      }
      case OPERATION_TYPE.RELOAD_ROWS: {
        const { available_columns } = table.view;
        let relatedColumnKeyMap = {};
        available_columns.forEach(column => {
          const { key } = column;
          relatedColumnKeyMap[key] = true;
        });
        return {
          relatedColumnKeyMap,
          relatedColumns: available_columns,
        };
      }
      case OPERATION_TYPE.MODIFY_ROW_VIA_BUTTON: {
        const { row_id, original_updates } = operation;
        relatedColumnKeys = this.getRelatedColumnKeysFromRowUpdates({ [row_id]: original_updates });
        break;
      }
      default: {
        relatedColumnKeys = [];
        break;
      }
    }
    return this.getRelatedColumns(relatedColumnKeys, table);
  }

  getOperatedRowsIds(operation) {
    const { op_type } = operation;
    switch (op_type) {
      case OPERATION_TYPE.MODIFY_ROWS:
      case OPERATION_TYPE.RELOAD_ROWS: {
        const { row_ids } = operation;
        return Array.isArray(row_ids) ? [...row_ids] : [];
      }
      case OPERATION_TYPE.MODIFY_ROW_VIA_BUTTON: {
        const { row_id } = operation;
        return row_id ? [row_id] : [];
      }
      default: {
        return [];
      }
    }
  }

  /**
   * @param {array} relatedColumnKeys
   * @param {object} pageData
   * @param {object} table
   * @returns relatedColumnKeyMap, relatedFormulaColumnKeyMap, relatedColumns, relatedFormulaColumns
   */
  getRelatedColumns(relatedColumnKeys, table) {
    if (!relatedColumnKeys || relatedColumnKeys.length === 0) {
      return {
        relatedColumnKeyMap: {},
        relatedColumns: [],
      };
    }
    let relatedColumnKeyMap = {};
    let relatedColumns = [];
    const { available_columns } = table.view;
    relatedColumnKeys.forEach(columnKey => {
      if (!relatedColumnKeyMap[columnKey]) {
        const column = getColumnByKey(available_columns, columnKey);
        if (column) {
          relatedColumnKeyMap[columnKey] = true;
          relatedColumns.push(column);
        }
      }
    });
    return {
      relatedColumnKeyMap,
      relatedColumns,
    };
  }

  /**
   * @param {object} rowUpdates: { [row._id]: { [column.key]: '', ... }, ... }
   * @returns related column keys: [ column.key, ... ]
   */
  getRelatedColumnKeysFromRowUpdates(rowUpdates) {
    if (!rowUpdates) return [];
    const rowIds = Object.keys(rowUpdates);
    return rowIds.reduce((keys, rowId) => {
      const rowData = rowUpdates[rowId];
      if (rowData) {
        keys.push(...Object.keys(rowData));
      }
      return keys;
    }, []);
  }
}

export default ServerOperator;

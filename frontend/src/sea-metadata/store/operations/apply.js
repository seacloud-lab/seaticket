import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { UTC_FORMAT_DEFAULT } from '../../constants';
import { OPERATION_TYPE } from './constants';
import Column from '../../models/column';
import View from '../../models/view';
import { getColumnOriginName } from '../../utils/column';
import { getRowIdFromRow } from '../../utils/row';
import context from '@/sea-metadata/context';
import { Row } from '@/sea-metadata/models';

dayjs.extend(utc);

export default function apply(data, operation) {
  const { op_type } = operation;

  const updateDataByModifyRows = ({ id_row_updates = {} } = {}) => {
    const { rows } = data;
    const modifyTime = dayjs().utc().format(UTC_FORMAT_DEFAULT);
    const modifier = context.getUsername();
    let updatedRows = [...rows];

    rows.forEach((row, index) => {
      const { _id: rowId } = row;
      const rowUpdates = id_row_updates[rowId];
      if (rowUpdates) {
        const updatedRow = Object.assign({}, row, rowUpdates, {
          '_mtime': modifyTime,
          '_last_modifier': modifier,
        });
        updatedRows[index] = updatedRow;
        data.id_row_map[rowId] = updatedRow;
      }
    });

    data.rows = updatedRows;
  };

  const updateDataByDeleteRows = (deletedIds = []) => {
    const idNeedDeletedMap = deletedIds.reduce((currIdNeedDeletedMap, rowId) => ({ ...currIdNeedDeletedMap, [rowId]: true }), {});
    data.rows = data.rows.filter((row) => !idNeedDeletedMap[row._id]);

    // delete rows in id_row_map
    deletedIds.forEach(rowId => {
      delete data.id_row_map[rowId];
    });

    data.row_ids = data.row_ids.filter(row_id => !idNeedDeletedMap[row_id]);
  };

  switch (op_type) {
    case OPERATION_TYPE.INSERT_ROW: {
      const { row: rowData } = operation;
      const row = new Row(rowData);
      const { rows } = data;
      const updatedRows = [...rows];
      const rowIndex = updatedRows.findIndex(r => r._id === row._id);
      data.id_row_map[row._id] = row;
      if (rowIndex === -1) {
        data.row_ids.push(row._id);
        updatedRows.push(row);
      } else {
        updatedRows[rowIndex] = row;
      }
      data.rows = updatedRows;
      return data;
    }
    case OPERATION_TYPE.MODIFY_ROW: {
      const { row_id, row_update } = operation;
      updateDataByModifyRows({
        id_row_updates: { [row_id]: row_update },
      });
      return data;
    }

    case OPERATION_TYPE.MODIFY_ROWS: {
      const { id_row_updates } = operation;
      updateDataByModifyRows({ id_row_updates });
      return data;
    }
    case OPERATION_TYPE.DELETE_ROW: {
      const { row_id } = operation;
      updateDataByDeleteRows([row_id]);
      return data;
    }
    case OPERATION_TYPE.DELETE_ROWS: {
      const { success_rows } = operation;
      updateDataByDeleteRows(success_rows);
      return data;
    }
    case OPERATION_TYPE.DELETE_LOCAL_ROWS: {
      const { row_ids = [] } = operation;
      updateDataByDeleteRows(row_ids);
      return data;
    }
    case OPERATION_TYPE.RESTORE_ROWS: {
      const { original_rows } = operation;
      const currentTime = dayjs().utc().format(UTC_FORMAT_DEFAULT);
      const username = context.getUsername();
      let insertRows = [];
      original_rows.forEach(row => {
        const insertRow = {
          ...row,
          _ctime: currentTime,
          _mtime: currentTime,
          _creator: username,
          _last_modifier: username,
        };
        insertRows.push(insertRow);
        data.id_row_map[row._id] = insertRow;
      });
      data.rows.push(insertRows);
      return data;
    }
    case OPERATION_TYPE.LOCK_ROW_VIA_BUTTON: {
      const { row_id } = operation;
      const { rows } = data;
      const updatedRowIndex = rows.findIndex(row => row_id === row._id);
      if (updatedRowIndex < 0) return data;
      const updatedRow = { ...rows[updatedRowIndex], _locked: true };
      data.rows[updatedRowIndex] = updatedRow;
      data.id_row_map[row_id] = updatedRow;
      return data;
    }
    case OPERATION_TYPE.MODIFY_ROW_VIA_BUTTON: {
      const { row_id, original_updates } = operation;
      const { rows } = data;
      const updatedRowIndex = rows.findIndex(row => row_id === row._id);
      if (updatedRowIndex < 0) {
        return data;
      }
      const modifyTime = dayjs().utc().format(UTC_FORMAT_DEFAULT);
      const modifier = context.getUsername();
      const updatedRow = Object.assign({},
        rows[updatedRowIndex],
        original_updates,
        { '_mtime': modifyTime, '_last_modifier': modifier },
      );
      data.rows[updatedRowIndex] = updatedRow;
      data.id_row_map[row_id] = updatedRow;
      return data;
    }
    case OPERATION_TYPE.MODIFY_LOCAL_ROW: {
      const { row_id, updates } = operation;
      updateDataByModifyRows({
        id_row_updates: { [row_id]: updates },
      });
      return data;
    }
    case OPERATION_TYPE.MODIFY_LOCAL_ROWS: {
      const { updates } = operation;
      updateDataByModifyRows({ id_row_updates: updates });
      return data;
    }
    case OPERATION_TYPE.MOVE_ROW: {
      const { update_data } = operation;
      const {
        modify_row_ids: updateRowIds,
        modify_id_row_updates: idRowUpdates,
        delete_row_ids: deletedRowIds,
      } = update_data;

      if (Array.isArray(updateRowIds) && updateRowIds.length > 0) {
        updateDataByModifyRows({ id_row_updates: idRowUpdates });
      }

      if (Array.isArray(deletedRowIds) && deletedRowIds.length > 0) {
        updateDataByDeleteRows(deletedRowIds);
      }
      return data;
    }
    case OPERATION_TYPE.MODIFY_FILTERS: {
      const { filter_conjunction, filters, basic_filters } = operation;
      data.view.filter_conjunction = filter_conjunction;
      data.view.filters = filters;
      data.view.basic_filters = basic_filters;
      return data;
    }
    case OPERATION_TYPE.MODIFY_SORTS: {
      const { sorts } = operation;
      data.view.sorts = sorts;
      return data;
    }
    case OPERATION_TYPE.MODIFY_GROUPBYS: {
      const { groupbys } = operation;
      data.view.groupbys = groupbys;
      return data;
    }
    case OPERATION_TYPE.MODIFY_ROW_COLOR: {
      const { colorbys } = operation;
      data.view.colorbys = colorbys;
      return data;
    }
    case OPERATION_TYPE.MODIFY_ROW_HEIGHT: {
      const { row_height } = operation;
      data.view.row_height = row_height;
      return data;
    }
    case OPERATION_TYPE.MODIFY_HIDDEN_COLUMNS: {
      const { hidden_columns } = operation;
      data.view.hidden_columns = hidden_columns;
      return data;
    }
    case OPERATION_TYPE.MODIFY_LOCAL_VIEW: {
      const { update } = operation;
      data.view = { ...data.view, ...update };
      return data;
    }
    case OPERATION_TYPE.MODIFY_VIEW_TYPE: {
      const { update } = operation;
      data.view = { ...data.view, ...update };
      return data;
    }
    case OPERATION_TYPE.MODIFY_VIEW_LOCK: {
      const { is_locked } = operation;
      data.view.is_locked = is_locked;
      return data;
    }
    case OPERATION_TYPE.INSERT_COLUMN: {
      const { column } = operation;
      const newColumn = new Column(column);
      data.columns.push(newColumn);
      data.view = new View(data.view, data.columns, data.not_display_columns);
      data.key_column_map[newColumn.key] = newColumn;
      return data;
    }
    case OPERATION_TYPE.DELETE_COLUMN: {
      const { column_key } = operation;
      const newColumns = data.columns.slice(0);
      const columnIndex = newColumns.findIndex(column => column.key === column_key);
      const deletedColumn = data.columns[columnIndex];
      if (columnIndex !== -1) {
        newColumns.splice(columnIndex, 1);
        data.columns = newColumns;
        data.view = new View(data.view, data.columns, data.not_display_columns);

        // Delete invalid file attribute data
        const columnOriginName = getColumnOriginName(deletedColumn);
        let rows = [];
        let id_row_map = {};
        data.rows.forEach(row => {
          delete row[columnOriginName];
          const id = getRowIdFromRow(row);
          rows.push(row);
          id_row_map[id] = row;
        });
        data.id_row_map = id_row_map;
        delete data.key_column_map[column_key];
      }
      return data;
    }
    case OPERATION_TYPE.RENAME_COLUMN: {
      const { column_key, new_name } = operation;
      const columnIndex = data.columns.findIndex(column => column.key === column_key);
      if (columnIndex !== -1) {
        const newColumn = new Column({ ...data.columns[columnIndex], name: new_name });
        data.columns[columnIndex] = newColumn;
        data.key_column_map[column_key] = newColumn;
      }
      data.view = new View(data.view, data.columns, data.not_display_columns);
      return data;
    }
    case OPERATION_TYPE.MODIFY_COLUMN_DATA:
    case OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA: {
      const { column_key, new_data } = operation;
      const columnIndex = data.columns.findIndex(column => column.key === column_key);
      if (columnIndex !== -1) {
        const oldColumn = data.columns[columnIndex];
        const newColumn = new Column({ ...oldColumn, data: { ...oldColumn.data, ...new_data } });
        data.columns[columnIndex] = newColumn;
        data.key_column_map[column_key] = newColumn;
      }
      data.view = new View(data.view, data.columns, data.not_display_columns);
      return data;
    }
    case OPERATION_TYPE.MODIFY_COLUMN_WIDTH: {
      const { column_key, new_width } = operation;
      const columnIndex = data.columns.findIndex(column => column.key === column_key);
      if (columnIndex !== -1) {
        const oldColumn = data.columns[columnIndex];
        const newColumn = new Column({ ...oldColumn, width: new_width });
        data.columns[columnIndex] = newColumn;
      }
      data.view = new View(data.view, data.columns, data.not_display_columns);
      return data;
    }
    case OPERATION_TYPE.MODIFY_COLUMN_ORDER: {
      const { new_columns_keys } = operation;
      data.view = new View({ ...data.view, columns_keys: new_columns_keys }, data.columns, data.not_display_columns);
      return data;
    }
    case OPERATION_TYPE.MODIFY_SETTINGS: {
      const { settings } = operation;
      data.view.settings = settings;
      return data;
    }

    default: {
      return data;
    }
  }
}

import { CellType } from '../../constants';
import { getTableById, getTableColumnByKey, getTableColumnByName } from '../table';
import {
  getOptionNameById, getColumnOptionNamesByIds, getOption,
  getColumnOptionIdsByNames, getColumnOptions
} from '../column';
import ObjectUtils from '@/utils/object-utils';

/**
 * Check is table rows
 * @param {array} rows e.g. table rows: [{ _id, xxx }, ...] | view rows: [ row._id, ... ]
 * @returns bool
 */
const isTableRows = (rows) => (
  Array.isArray(rows) && typeof rows[0] === 'object'
);

const updateTableRowsWithRowsData = (tables, tableId, rowsData = []) => {
  let table = getTableById(tables, tableId);
  let idRowDataMap = {};
  rowsData.forEach((rowData) => idRowDataMap[rowData._id] = rowData);
  table.rows.forEach((row, index) => {
    const rowId = row._id;
    const newRowData = idRowDataMap[rowId];
    if (!newRowData) {
      return;
    }
    const newRow = Object.assign({}, row, newRowData);
    table.rows[index] = newRow;
    table.id_row_map[rowId] = newRow;
  });
};

/**
 * Get table row by id
 * @param {object} table
 * @param {string} rowId the id of row
 * @returns row, object
 */
const getRowById = (table, rowId) => {
  if (!table || !table.id_row_map || !rowId) return null;
  return table.id_row_map[rowId];
};

/**
 * Get table rows by ids
 * @param {object} table { id_row_map, ... }
 * @param {array} rowsIds [ row._id, ... ]
 * @returns rows, array
 */
const getRowsByIds = (table, rowsIds) => {
  if (!table || !table.id_row_map || !Array.isArray(rowsIds)) return [];
  return rowsIds.map((rowId) => table.id_row_map[rowId]).filter(Boolean);
};

const getRowIdFromRow = row => {
  if (!row) return '';
  return row._id || '';
};

// server use name-optionName to update single-select/multiple-select
// server use name-value to update row
const convertRowToNameValue = (rowUpdate, { data, typesData, tagsData }) => {
  let newRowData = {};
  Object.keys(rowUpdate).forEach(key => {
    const column = getTableColumnByKey(data, key);
    if (!column) return;
    const { name, type } = column;
    let cellValue = rowUpdate[key];
    if (type === CellType.SINGLE_SELECT ) {
      if (cellValue) {
        cellValue = getOptionNameById(column, cellValue);
      }
    } else if (type === CellType.TYPE) {
      if (cellValue) {
        const option = getRowById(typesData, cellValue);
        cellValue = option.name;
      }
    } else if (type === CellType.TAGS) {
      if (Array.isArray(cellValue) && cellValue.length > 0) {
        const tags = getRowsByIds(tagsData, cellValue);
        cellValue = tags.map(tag => tag.name);
      }
    } else if (type === CellType.MULTIPLE_SELECT) {
      if (Array.isArray(cellValue) && cellValue.length > 0) {
        cellValue = getColumnOptionNamesByIds(column, cellValue);
      }
    }
    newRowData[name] = cellValue;
  });
  return newRowData;
};

const convertRowsToNameValue = (rowsUpdate, { data, typesData, tagsData }) => {
  return rowsUpdate.map(rowUpdate => {
    const { row_id, row } = rowUpdate;
    return { row_id, row: convertRowToNameValue(row, { data, typesData, tagsData }) };
  }).filter(rowUpdate => rowUpdate.row && !ObjectUtils.isEmpty(rowUpdate.row));
};

const convertRowToKeyValue = (rowUpdate, { data, typesData, tagsData }) => {
  let newRowData = {};
  Object.keys(rowUpdate).forEach(name => {
    const column = getTableColumnByName(data, name);
    if (!column) return;
    const { key, type } = column;
    let cellValue = rowUpdate[name];
    if (type === CellType.SINGLE_SELECT ) {
      if (cellValue) {
        const options = getColumnOptions(column);
        let option = getOption(options, cellValue);
        cellValue = option?.id;
      }
    } else if (type === CellType.TYPE) {
      if (cellValue) {
        const option = getRowById(typesData, cellValue);
        cellValue = option._id;
      }
    } else if (type === CellType.MULTIPLE_SELECT) {
      if (Array.isArray(cellValue) && cellValue.length > 0) {
        cellValue = getColumnOptionIdsByNames(column, cellValue);
      }
    }
    newRowData[key] = cellValue;
  });
  return newRowData;
};

const convertRowsToKeyValue = (rowsUpdate, { data, typesData, tagsData }) => {
  return rowsUpdate.map(rowUpdate => {
    const { row_id, row } = rowUpdate;
    return { row_id, row: convertRowToKeyValue(row, { data, typesData, tagsData }) };
  }).filter(rowUpdate => rowUpdate.row && !ObjectUtils.isEmpty(rowUpdate.row));
};

export {
  isTableRows,
  updateTableRowsWithRowsData,
  getRowById,
  getRowsByIds,
  getRowIdFromRow,
  convertRowToNameValue,
  convertRowsToNameValue,
  convertRowToKeyValue,
  convertRowsToKeyValue,
};

import { getTableById } from '../table';

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

export {
  isTableRows,
  updateTableRowsWithRowsData,
  getRowById,
  getRowsByIds,
  getRowIdFromRow,
};

import { CellType } from '../../constants';

/**
 * @param {any} value
 */
export const isValidCellValue = (value, column) => {
  if (value === undefined) return false;
  if (value === null) return false;
  if (value === '') return false;
  if (JSON.stringify(value) === '{}') return false;
  if (JSON.stringify(value) === '[]') return false;
  if (column.type === CellType.LONG_TEXT) return typeof value === 'string' ? Boolean(value) : Boolean(value?.text);
  return true;
};

/**
 * @param {object} row eg: { [column_key]: value, [column_name]: value }
 * @param {object} column
 * @return {any} value
 */
export const getCellValueByColumn = (row, column) => {
  if (!row || !column) return null;
  const { key } = column;
  return row[key];
};

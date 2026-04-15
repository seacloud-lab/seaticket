import { CellType } from '../../constants';
import { getRowById } from '../row';

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
export const getCellValueByColumn = (row, column, { tagsData } = {}) => {
  if (!row || !column) return null;
  const { key, name } = column;
  if (Object.prototype.hasOwnProperty.call(row, key) || Object.prototype.hasOwnProperty.call(row, name)) {
    const cellValue = row[key] || row[name];
    if (column.type === CellType.TAGS && Array.isArray(cellValue) && tagsData) {
      return cellValue.filter(tagID => getRowById(tagsData, tagID + ''));
    }
    return cellValue;
  }
  return null;
};

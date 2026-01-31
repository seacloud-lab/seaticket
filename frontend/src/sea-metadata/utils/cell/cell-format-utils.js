import dayjs from 'dayjs';
import { CellType } from '../../constants';
import { getCellValueByColumn } from './core';
import { getCellValueDisplayString } from './common';

const getAutoTimeDisplayString = (autoTime) => {
  if (!autoTime) {
    return null;
  }
  const date = dayjs(autoTime);
  if (!date.isValid()) return autoTime;
  return date.format('YYYY-MM-DD HH:mm:ss');
};

// { [column.key]: cellValue } -> { [column.name]: cellValue }
// { [option-column.key]: option.id } -> { [option-column.name]: option.name }
function convertedToRowData(originRowData, keyColumnMap, excludesColumnTypes = []) {
  if (!originRowData || !keyColumnMap) {
    return {};
  }
  let rowData = {};
  Object.keys(originRowData).forEach(key => {
    const column = keyColumnMap[key];
    if (!column) return;

    const { type } = column;
    if (excludesColumnTypes && excludesColumnTypes.includes(type)) {
      return;
    }

    let cellValue = originRowData[key];
    rowData[key] = cellValue;
    switch (type) {
      case CellType.TEXT: {
        rowData[key] = typeof cellValue === 'string' ? cellValue.trim() : '';
        break;
      }
      default: {
        break;
      }
    }
  });
  return rowData;
}

export const getClientCellValueDisplayString = (row, column, { collaborators = [], tagsData = {} } = {}) => {
  const { type } = column;
  if (type === CellType.CTIME || type === CellType.MTIME) {
    const cellValue = getCellValueByColumn(row, column);
    return getAutoTimeDisplayString(cellValue);
  }
  return getCellValueDisplayString(row, column, { collaborators, tagsData });
};

export const getFormatRowData = (columns, rowData) => {
  let keyColumnMap = {};
  columns.forEach(column => {
    keyColumnMap[column.key] = column;
  });
  return convertedToRowData(rowData, keyColumnMap);
};

export const getFormattedRowsData = (rowsData, columns, excludesColumnTypes) => {
  let keyColumnMap = {};
  columns.forEach(column => {
    keyColumnMap[column.key] = column;
  });
  return rowsData.map(rowData => {
    let formattedRowsData = convertedToRowData(rowData, keyColumnMap, excludesColumnTypes);
    if (rowData._id) {
      formattedRowsData._id = rowData._id;
    }
    if (Object.prototype.hasOwnProperty.call(rowData, '_archived')) {
      formattedRowsData._archived = rowData._archived ? 'true' : 'false';
    }
    return formattedRowsData;
  });
};

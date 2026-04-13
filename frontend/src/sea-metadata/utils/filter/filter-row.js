import {
  getFormattedFilters,
  deleteInvalidFilter,
} from './core';
import {
  creatorFilter,
  dateFilter,
  textFilter,
  checkboxFilter,
  singleSelectFilter,
  collaboratorFilter,
  numberFilter,
  multipleSelectFilter,
} from './filter-column';
import { DateUtils } from '../date';
import { CellType, DATE_FORMAT_MAP, FILTER_CONJUNCTION_TYPE } from '../../constants';
import { getCellValueByColumn } from '../cell';

const getFilterResult = (row, filter, { username, userId, tagsData }) => {
  const { column } = filter;
  let cellValue = getCellValueByColumn(row, column, { tagsData });
  switch (column.type) {
    case CellType.CTIME:
    case CellType.MTIME:
    case CellType.DATE: {
      cellValue = DateUtils.format(cellValue, DATE_FORMAT_MAP.YYYY_MM_DD);
      return dateFilter(cellValue, filter);
    }
    case CellType.URL:
    case CellType.FILE_NAME:
    case CellType.TEXT:
    case CellType.JSON: {
      return textFilter(cellValue, filter, userId);
    }
    case CellType.LAST_MODIFIER:
    case CellType.CREATOR: {
      return creatorFilter(cellValue, filter, username);
    }
    case CellType.CHECKBOX: {
      return checkboxFilter(cellValue, filter);
    }
    case CellType.SINGLE_SELECT:
    case CellType.TYPE: {
      return singleSelectFilter(cellValue, filter);
    }
    case CellType.MULTIPLE_SELECT:
    case CellType.TAGS: {
      return multipleSelectFilter(cellValue, filter);
    }
    case CellType.NUMBER:
    case CellType.RATE:
    case CellType.PRIORITY: {
      return numberFilter(cellValue, filter);
    }
    case CellType.COLLABORATOR: {
      return collaboratorFilter(cellValue, filter, username);
    }
    default: {
      return false;
    }
  }
};

/**
 * Filter row
 * @param {object} row e.g. { _id, .... }
 * @param {string} filterConjunction e.g. 'And' | 'Or'
 * @param {array} filters e.g. [{ column_key, filter_predicate, ... }, ...]
 * @param {object} formulaRow
 * @param {string} username
 * @param {string} userId
 * @returns filter result, bool
 */
const filterRow = (row, filterConjunction, filters, { username = '', userId, tagsData } = {}) => {
  if (filterConjunction === FILTER_CONJUNCTION_TYPE.AND) {
    return filters.every((filter) => (
      getFilterResult(row, filter, { username, userId, tagsData })
    ));
  }
  if (filterConjunction === FILTER_CONJUNCTION_TYPE.OR) {
    return filters.some((filter) => (
      getFilterResult(row, filter, { username, userId, tagsData })
    ));
  }
  return false;
};

/**
 * Filter rows
 * @param {string} filterConjunction e.g. 'And' | 'Or'
 * @param {array} filters e.g. [{ column_key, filter_predicate, ... }, ...]
 * @param {array} rows e.g. [{ _id, .... }, ...]
 * @param {string} username
 * @param {string} userId
 * @returns filtered rows ids, array
 */
const filterRows = (filterConjunction, filters, rows, { username, userId, tagsData, isReturnID = true }) => {
  let filteredRows = [];
  const formattedFilters = getFormattedFilters(filters);
  rows.forEach((row) => {
    if (filterRow(row, filterConjunction, formattedFilters, { username, userId, tagsData })) {
      filteredRows.push(isReturnID ? row._id : row);
    }
  });
  return filteredRows;
};

/**
 * Filter rows without formula calculation
 * The "formulaRows" need to be provided if you want to filter formula, link columns etc.
 * @param {object} table e.g. { columns, ... }
 * @param {array} rows e.g. [{ _id, .... }, ...]
 * @param {string} filterConjunction e.g. 'And' | 'Or'
 * @param {array} filters e.g. [{ column_key, filter_predicate, ... }, ...]
 * @param {string} username
 * @param {string} userId
 * @returns filtered rows: row_ids and error message: error_message, object
 */
const getFilteredRows = (table, rows, { basicFilters, filters, filterConjunction }, { username = null, userId = null, isReturnID = true, tagsData } = {}) => {
  const { columns } = table;
  let validFilters = [];
  try {
    validFilters = deleteInvalidFilter(filters, columns);
  } catch (err) {
    return { rows: [], error_message: err.message };
  }

  let validBasicFilters = [];
  try {
    validBasicFilters = deleteInvalidFilter(basicFilters, columns);
  } catch (err) {
    return { rows: [], error_message: err.message };
  }

  let filteredRows = [];
  if (validFilters.length === 0 && validBasicFilters.length === 0) {
    filteredRows = isReturnID ? rows.map((row) => row._id) : rows;
  } else {
    filteredRows = filterRows(FILTER_CONJUNCTION_TYPE.AND, validBasicFilters, rows, { username, userId, isReturnID: false, tagsData });
    filteredRows = filterRows(filterConjunction, validFilters, filteredRows, { username, userId, isReturnID, tagsData });
  }

  return { rows: filteredRows, error_message: null };
};

export {
  filterRow,
  filterRows,
  getFilteredRows,
};

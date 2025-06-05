import { CellType, FORMULA_RESULT_TYPE, getCellValueStringResult } from 'dtable-utils';
import { SUPPORT_SEARCH_COLUMN_LIST, SUPPORT_SEARCH_FORMULA_ARRAY_TYPES } from '../constants';

const isCellValueMatchedRegVal = (row, column, regVal, view) => {
  // not support
  const { type, data } = column;
  if ([CellType.FORMULA, CellType.LINK_FORMULA, CellType.LINK].includes(type)) {
    const { result_type, array_type } = data;
    // string | bool | number | array
    if (FORMULA_RESULT_TYPE.BOOL === result_type) return false;
    if (FORMULA_RESULT_TYPE.ARRAY === result_type && !SUPPORT_SEARCH_FORMULA_ARRAY_TYPES.includes(array_type)) {
      return false;
    }
  }
  const { formula_rows: formulaRows, type: viewType } = view;
  const collaborators = [];
  const isArchiveView = viewType === 'archive';
  const cellValueDisplayString = getCellValueStringResult(row, column, { formulaRows, collaborators, isArchiveView });
  const isMatched = regVal.test(cellValueDisplayString);
  return isMatched;
};

const escapeRegExp = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[.\\[\]{}()|^$?*+]/g, '\\$&');
};

export const getSearchRegExps = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const searchContents = value.split(/ +/g);
  return searchContents.map((content) => {
    const reg = new RegExp(escapeRegExp(content), 'i');
    return { reg, content, isMatched: false };
  });
};

// name column is only support: text| number | date | single-select | auto-number
export const searchRowsByName = ({ rows = [], columns = [], searchValue = '' }) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!Array.isArray(columns) || columns.length === 0) return [];
  if (searchValue === '') return rows;

  const nameColumn = columns.find(column => column.key === '0000');
  if (!nameColumn) return rows;

  searchValue = searchValue.toLowerCase();
  return rows.filter((row) => {
    const formattedCellValue = getCellValueStringResult(row, nameColumn);
    if (!formattedCellValue || formattedCellValue.trim() === '') {
      return false;
    }
    return formattedCellValue.toLowerCase().indexOf(searchValue) > -1;
  });
};

export const searchRowsBySearchValue = ({ rows = [], columns = [], searchValue = '', formulaRows = {}, isArchiveView = false }) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!Array.isArray(columns) || columns.length === 0) return [];
  if (searchValue === '') return rows;

  const regExps = searchValue && getSearchRegExps(searchValue);
  if (!regExps || regExps.length === 0) {
    return rows;
  }

  let searchResult = [];
  const view = { formula_rows: formulaRows, type: isArchiveView ? 'archive' : '' };
  // search matched rows from support columns
  const validColumns = columns.filter(column => SUPPORT_SEARCH_COLUMN_LIST.includes(column.type));
  rows.forEach(row => {
    // generate a regexp duplicate
    const dupRegExps = regExps.map(item => ({ ...item }));
    for (let i = 0; i < validColumns.length; i++) {
      const column = validColumns[i];
      dupRegExps.forEach(regExp => {
        const isMatched = isCellValueMatchedRegVal(row, column, regExp.reg, view);
        // add an attribute to mark the current rule match successfully
        if (isMatched) regExp.isMatched = true;
      });
    }
    const isAllRegMatched = dupRegExps.every(regExp => regExp.isMatched);
    if (isAllRegMatched) searchResult.push(row);
  });
  return searchResult;
};
